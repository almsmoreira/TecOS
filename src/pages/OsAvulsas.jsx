import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Btn, Card, Empty, Th, Td, Tr } from "../components/ui";
import { STATUS } from "../constants";

const STATUS_RECEBIDO = ["concluido","aprovado"];

const fmtMoney = v => Number(v||0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const fmtMonth = (ym) => {
  const [y,m] = ym.split("-");
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${months[parseInt(m)-1]}/${y}`;
};
const fmtDate = d => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "—";

export default function OsAvulsas({ os=[], clients=[], users=[] }) {
  const today = new Date();
  const [month, setMonth] = useState(today.toISOString().slice(0,7));
  const [statusFilter, setStatusFilter] = useState("recebido"); // "recebido" = aprovado+concluido

  // Mapas auxiliares
  const clientById = useMemo(() => {
    const m = {};
    clients.forEach(c => m[c.id] = c);
    return m;
  }, [clients]);

  const techById = useMemo(() => {
    const m = {};
    users.forEach(u => m[u.id] = u);
    return m;
  }, [users]);

  // Filtra OS avulsas: clientes do tipo 'avulso' E não-mensalidade
  const osAvulsas = useMemo(() => {
    return os.filter(o => {
      const c = clientById[o.clientId];
      if (!c) return false;
      if (c.client_type === "contrato") return false; // ignora contratos
      // ignora OS de mensalidade (descrição padrão)
      if ((o.description||"").startsWith("Mensalidade de Serviços de TI")) return false;
      return true;
    });
  }, [os, clientById]);

  // OS do mês selecionado
  const osNoMes = useMemo(() => {
    return osAvulsas.filter(o => (o.createdAt||"").startsWith(month));
  }, [osAvulsas, month]);

  // Filtro de status
  const filtered = useMemo(() => {
    if (statusFilter === "recebido") return osNoMes.filter(o => STATUS_RECEBIDO.includes(o.status));
    if (statusFilter === "todos") return osNoMes;
    return osNoMes.filter(o => o.status === statusFilter);
  }, [osNoMes, statusFilter]);

  // Estatísticas do mês
  const stats = useMemo(() => {
    const recebidos = osNoMes.filter(o => STATUS_RECEBIDO.includes(o.status));
    const aReceber = osNoMes.filter(o => !STATUS_RECEBIDO.includes(o.status) && o.status !== "cancelado");
    return {
      total: recebidos.reduce((s,o) => s + Number(o.budget||0), 0),
      qtdRecebido: recebidos.length,
      aReceber: aReceber.reduce((s,o) => s + Number(o.budget||0), 0),
      qtdAReceber: aReceber.length,
      ticketMedio: recebidos.length ? recebidos.reduce((s,o) => s + Number(o.budget||0), 0) / recebidos.length : 0,
    };
  }, [osNoMes]);

  // Comparativo últimos 6 meses
  const ultimosMeses = useMemo(() => {
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const ym = d.toISOString().slice(0,7);
      const osM = osAvulsas.filter(o => (o.createdAt||"").startsWith(ym) && STATUS_RECEBIDO.includes(o.status));
      arr.push({
        month: ym,
        label: fmtMonth(ym).split("/")[0].slice(0,3) + "/" + ym.slice(2,4),
        total: osM.reduce((s,o) => s + Number(o.budget||0), 0),
        count: osM.length,
      });
    }
    return arr;
  }, [osAvulsas]);

  const maxValue = Math.max(...ultimosMeses.map(m => m.total), 1);

  const exportExcel = () => {
    const rows = filtered.map(o => {
      const c = clientById[o.clientId];
      const t = techById[o.technicianId];
      return {
        "Nº OS": o.id,
        "Cliente": c?.name || "—",
        "Telefone": c?.phone || "",
        "Descrição": o.description || "",
        "Técnico": t?.name || "",
        "Status": STATUS[o.status]?.label || o.status,
        "Valor (R$)": Number(o.budget||0).toFixed(2),
        "Abertura": o.createdAt || "",
        "Atualização": o.updatedAt || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `OS Avulsas ${month}`);
    XLSX.writeFile(wb, `os_avulsas_${month}.xlsx`);
  };

  const StatCard = ({ label, value, subtitle, color }) => (
    <Card style={{ flex:1, minWidth:160 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color }}>{value}</div>
      {subtitle && <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>{subtitle}</div>}
    </Card>
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:700 }}>💼 OS Avulsas</h2>
          <div style={{ color:"var(--muted)", fontSize:13, marginTop:2 }}>Controle mensal de OS de clientes avulsos</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <label style={{ fontSize:12, color:"var(--muted)" }}>Mês:</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding:"7px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:13 }} />
          <Btn variant="ghost" onClick={exportExcel} disabled={!filtered.length}>📥 Excel</Btn>
        </div>
      </div>

      {/* Cards de resumo */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <StatCard label="Recebido no mês" value={fmtMoney(stats.total)} subtitle={`${stats.qtdRecebido} OS`} color="var(--green)" />
        <StatCard label="A receber" value={fmtMoney(stats.aReceber)} subtitle={`${stats.qtdAReceber} OS pendentes`} color="var(--yellow)" />
        <StatCard label="Ticket médio" value={fmtMoney(stats.ticketMedio)} subtitle="por OS recebida" color="var(--accent)" />
        <StatCard label="Total geral" value={fmtMoney(stats.total + stats.aReceber)} subtitle="recebido + a receber" color="var(--purple)" />
      </div>

      {/* Gráfico de barras dos últimos 6 meses */}
      <Card style={{ marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:14 }}>📊 Últimos 6 meses (recebido)</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:12, height:140, padding:"0 8px" }}>
          {ultimosMeses.map(m => {
            const h = m.total > 0 ? Math.max(8, (m.total/maxValue)*100) : 4;
            const isCurrent = m.month === month;
            return (
              <div key={m.month} onClick={() => setMonth(m.month)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", cursor:"pointer" }}>
                <div style={{ fontSize:11, color:"var(--muted)", marginBottom:4, fontWeight:600 }}>{fmtMoney(m.total)}</div>
                <div style={{
                  width:"100%", height:`${h}%`, minHeight:4,
                  background: isCurrent ? "var(--accent)" : "rgba(79,142,247,.35)",
                  borderRadius:"6px 6px 0 0", transition:"all .2s",
                }} />
                <div style={{ fontSize:11, color: isCurrent ? "var(--accent)" : "var(--muted)", marginTop:6, fontWeight: isCurrent?700:400, textTransform:"capitalize" }}>{m.label}</div>
                <div style={{ fontSize:10, color:"var(--muted)" }}>{m.count} OS</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Filtro de status */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        <span style={{ fontSize:11, color:"var(--muted)", fontWeight:600, marginRight:4, alignSelf:"center" }}>Status:</span>
        {[
          ["recebido", `✓ Recebidas (${osNoMes.filter(o => STATUS_RECEBIDO.includes(o.status)).length})`],
          ["todos",    `Todas (${osNoMes.length})`],
          ["em_andamento", "🔄 Em andamento"],
          ["orcamento", "📝 Orçamento"],
          ["cancelado", "❌ Canceladas"],
        ].map(([v,l]) => (
          <button key={v} onClick={() => setStatusFilter(v)} style={{
            padding:"6px 12px", borderRadius:8, fontSize:12, cursor:"pointer", fontWeight:600,
            background: statusFilter===v ? "rgba(79,142,247,.15)" : "var(--surface2)",
            border: `1px solid ${statusFilter===v ? "var(--accent)" : "var(--border)"}`,
            color: statusFilter===v ? "var(--accent)" : "var(--muted)",
          }}>{l}</button>
        ))}
      </div>

      <Card style={{ padding:0 }}>
        {filtered.length === 0 ? <Empty icon="💼" text={`Nenhuma OS avulsa em ${fmtMonth(month)}`} /> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                <Th>Nº OS</Th>
                <Th>Cliente</Th>
                <Th>Descrição</Th>
                <Th>Técnico</Th>
                <Th>Status</Th>
                <Th>Valor</Th>
                <Th>Abertura</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const c = clientById[o.clientId];
                const t = techById[o.technicianId];
                const st = STATUS[o.status];
                return (
                  <Tr key={o.id}>
                    <Td><span style={{ color:"var(--accent)", fontWeight:700 }}>#{o.id}</span></Td>
                    <Td style={{ fontWeight:600 }}>{c?.name || "—"}</Td>
                    <Td style={{ fontSize:12, color:"var(--muted)", maxWidth:260 }}>
                      <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{o.description || "—"}</div>
                    </Td>
                    <Td style={{ fontSize:12 }}>{t?.name || "—"}</Td>
                    <Td>
                      <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99, background:`${st?.color}22`, color:st?.color }}>{st?.label}</span>
                    </Td>
                    <Td style={{ fontWeight:700, color: STATUS_RECEBIDO.includes(o.status) ? "var(--green)" : "var(--muted)" }}>
                      {fmtMoney(o.budget)}
                    </Td>
                    <Td style={{ fontSize:12, color:"var(--muted)" }}>{fmtDate(o.createdAt)}</Td>
                  </Tr>
                );
              })}
              {filtered.length > 0 && (
                <tr style={{ borderTop:"2px solid var(--border)", background:"var(--surface2)" }}>
                  <td colSpan="5" style={{ padding:"12px 14px", fontWeight:700, textAlign:"right", fontSize:13 }}>TOTAL DO MÊS:</td>
                  <td style={{ padding:"12px 14px", fontWeight:700, color:"var(--green)", fontSize:14 }}>
                    {fmtMoney(filtered.reduce((s,o) => s + Number(o.budget||0), 0))}
                  </td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
