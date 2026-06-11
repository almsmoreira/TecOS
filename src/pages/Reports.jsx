import * as XLSX from "xlsx";
import { STATUS } from "../constants";
import { Card, Empty, Th, Td, Tr } from "../components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

export default function Reports({ os, clients, users }) {
  const bySt = s => os.filter(o => o.status===s).length;
  const totalBudget = os.reduce((s,o) => s+Number(o.budget), 0);
  const totalConc   = os.filter(o=>o.status==="concluido").reduce((s,o)=>s+Number(o.budget),0);
  const TT = { contentStyle:{ background:"#181c27", border:"1px solid #2a3047", borderRadius:8, color:"#eef0f6" } };

  const techData = users.map(u => {
    const uOs = os.filter(o=>o.technicianId===u.id);
    return { name:u.name.split(" ")[0], total:uOs.length, concluidas:uOs.filter(o=>o.status==="concluido").length, faturado:uOs.filter(o=>o.status==="concluido").reduce((s,o)=>s+Number(o.budget),0) };
  });

  const exportFull = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(os.map(o => {
      const c=clients.find(c=>c.id===o.clientId); const tech=users.find(u=>u.id===o.technicianId);
      return {"Nº OS":o.id,Cliente:c?.name,Técnico:tech?.name,Status:STATUS[o.status]?.label,Descrição:o.description,"Valor R$":Number(o.budget).toFixed(2),Abertura:o.createdAt,Atualizado:o.updatedAt};
    })), "OS");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clients.map(c=>({Nome:c.name,Telefone:c.phone,Email:c.email,CPF:c.cpf,"Nº OS":os.filter(o=>o.clientId===c.id).length}))), "Clientes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(techData.map(t=>({Técnico:t.name,"Total OS":t.total,Concluídas:t.concluidas,"Faturado R$":t.faturado.toFixed(2)}))), "Por Técnico");
    XLSX.writeFile(wb, "relatorio-completo.xlsx");
  };

  return (
    <div className="fu">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
        <h2 style={{ fontFamily:"var(--fh)", fontSize:24 }}>Relatórios</h2>
        <button onClick={exportFull} style={{ background:"#4f8ef7", color:"#fff", border:"none", padding:"10px 20px", borderRadius:8, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>📥 Exportar Completo</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:22 }}>
        {[
          { label:"Total Orçado",      value:`R$ ${totalBudget.toLocaleString("pt-BR",{minimumFractionDigits:2})}`, color:"var(--accent)"  },
          { label:"Total Faturado",    value:`R$ ${totalConc.toLocaleString("pt-BR",{minimumFractionDigits:2})}`,   color:"var(--green)"   },
          { label:"Taxa de Conclusão", value:os.length>0?`${Math.round(bySt("concluido")/os.length*100)}%`:"0%",   color:"var(--purple)"  },
          { label:"Ticket Médio",      value:os.length>0?`R$ ${(totalBudget/os.length).toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"R$ 0,00", color:"var(--yellow)" },
        ].map(s => (
          <Card key={s.label} style={{ padding:16 }}>
            <div style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", fontWeight:600, marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:22, fontFamily:"var(--fn)", fontWeight:800, color:s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 }}>
        <Card>
          <h3 style={{ fontFamily:"var(--fh)", fontSize:15, marginBottom:14 }}>OS por Status</h3>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={Object.entries(STATUS).map(([k,v])=>({name:v.label,total:bySt(k),cor:v.color}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3047" />
              <XAxis dataKey="name" tick={{ fill:"#7b849a", fontSize:11 }} />
              <YAxis tick={{ fill:"#7b849a", fontSize:11 }} allowDecimals={false} />
              <Tooltip {...TT} />
              <Bar dataKey="total" radius={[4,4,0,0]}>{Object.entries(STATUS).map(([k,v])=><Cell key={k} fill={v.color}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 style={{ fontFamily:"var(--fh)", fontSize:15, marginBottom:14 }}>Por Técnico</h3>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={techData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3047" />
              <XAxis dataKey="name" tick={{ fill:"#7b849a", fontSize:11 }} />
              <YAxis tick={{ fill:"#7b849a", fontSize:11 }} allowDecimals={false} />
              <Tooltip {...TT} />
              <Bar dataKey="total" name="Total OS" fill="#4f8ef7" radius={[4,4,0,0]} />
              <Bar dataKey="concluidas" name="Concluídas" fill="#3ecf8e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card style={{ padding:0 }}>
        <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)" }}><h3 style={{ fontFamily:"var(--fh)", fontSize:15 }}>Resumo por Técnico</h3></div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr style={{ borderBottom:"1px solid var(--border)" }}><Th>Técnico</Th><Th>Total</Th><Th>Concluídas</Th><Th>Em Aberto</Th><Th>Faturado</Th></tr></thead>
          <tbody>{techData.map(t => (
            <Tr key={t.name}>
              <Td style={{ fontWeight:600 }}>{t.name}</Td>
              <Td>{t.total}</Td>
              <Td style={{ color:"var(--green)", fontWeight:600 }}>{t.concluidas}</Td>
              <Td style={{ color:"var(--yellow)" }}>{t.total-t.concluidas}</Td>
              <Td style={{ fontWeight:700, color:"var(--green)" }}>R$ {t.faturado.toLocaleString("pt-BR",{minimumFractionDigits:2})}</Td>
            </Tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}
