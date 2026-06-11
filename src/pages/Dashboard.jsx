import { useEffect, useState } from "react";
import { STATUS } from "../constants";
import { Card, Empty, Th, Td, Tr, Badge } from "../components/ui";
import { getChamados, apiGet } from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";

const CHAMADO_STATUS = {
  aberto:         { label:"Aberto",         color:"#e55b5b", bg:"rgba(229,91,91,.15)"  },
  em_atendimento: { label:"Em Atendimento", color:"#f5c542", bg:"rgba(245,197,66,.15)" },
  resolvido:      { label:"Resolvido",      color:"#3ecf8e", bg:"rgba(62,207,142,.15)" },
  cancelado:      { label:"Cancelado",      color:"#7b849a", bg:"rgba(123,132,154,.15)"},
};

function ChamadoBadge({ status }) {
  const s = CHAMADO_STATUS[status] || CHAMADO_STATUS.aberto;
  return <span style={{ background:s.bg, color:s.color, borderRadius:99, fontSize:11, fontWeight:700, padding:"2px 8px" }}>{s.label}</span>;
}

const SOURCE_ICON = { manual:"✍️", webhook:"🔗", chatwoot:"💬", n8n:"⚡", typebot:"🤖" };

export default function Dashboard({ os, clients, users, onNavigate, equipment=[] }) {
  const [chamados, setChamados] = useState([]);
  const [agents, setAgents] = useState([]);
  const [expSummary, setExpSummary] = useState({ total:0, paid:0, pending:0, overdue:0 });
  const [mrr, setMrr] = useState(0);

  const thisMonth = new Date().toISOString().slice(0,7);
  useEffect(() => {
    getChamados().then(d => setChamados(d||[])).catch(()=>{});
    apiGet('/api/agents').then(d => setAgents(Array.isArray(d) ? d : [])).catch(()=>{});
    apiGet(`/api/expenses/summary?month=${thisMonth}`).then(d => setExpSummary(d||{})).catch(()=>{});
    apiGet('/api/billings/summary').then(d => setMrr(d?.mrr||0)).catch(()=>{});
  }, []);

  const bySt = s => os.filter(o => o.status === s).length;
  const chamAbertos = chamados.filter(c => c.status === "aberto").length;
  const chamAtendimento = chamados.filter(c => c.status === "em_atendimento").length;
  const faturado = os.filter(o => o.status==="concluido").reduce((s,o) => s+Number(o.budget), 0);

  const stats = [
    { label:"Total de OS",    value:os.length,                           color:"var(--accent)",  icon:"📋", page:"os"       },
    { label:"OS Aguardando",  value:bySt("orcamento")+bySt("aprovado"), color:"var(--yellow)",  icon:"⏳", page:"os"       },
    { label:"Em Andamento",   value:bySt("em_andamento"),                color:"var(--purple)",  icon:"🔧", page:"os"       },
    { label:"OS Concluídas",  value:bySt("concluido"),                   color:"var(--green)",   icon:"✅", page:"os"       },
    { label:"Chamados Abertos",    value:chamAbertos,                    color:"var(--red)",     icon:"📬", page:"chamados" },
    { label:"Em Atendimento",      value:chamAtendimento,                color:"var(--yellow)",  icon:"🎧", page:"chamados" },
    { label:"Clientes",            value:clients.length,                 color:"var(--orange)",  icon:"👥", page:"clients"  },
    { label:"Faturado",            value:`R$\u00a0${faturado.toLocaleString("pt-BR",{minimumFractionDigits:2})}`, color:"var(--green)", icon:"💰", page:"reports" },
  ];

  const pieData = Object.entries(STATUS).map(([k,v]) => ({ name:v.label, value:bySt(k), color:v.color })).filter(d=>d.value>0);
  const recentOS = [...os].sort((a,b) => b.id-a.id).slice(0,5);
  const recentChamados = [...chamados].sort((a,b) => b.id-a.id).slice(0,5);
  const TT = { contentStyle:{ background:"#181c27", border:"1px solid #2a3047", borderRadius:8, color:"#eef0f6" } };

  return (
    <div className="fu">
      <h2 style={{ fontFamily:"var(--fh)", fontSize:24, marginBottom:20 }}>Dashboard</h2>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:22 }}>
        {stats.map(s => (
          <Card key={s.label} style={{ padding:14, cursor:s.page?"pointer":"auto", transition:"border-color .15s" }}
            onClick={() => s.page && onNavigate && onNavigate(s.page)}
            onMouseEnter={e => s.page && (e.currentTarget.style.borderColor="var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor="var(--border)")}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:11, color:"var(--muted)", marginBottom:8, textTransform:"uppercase", letterSpacing:".5px", fontWeight:600 }}>{s.label}</div>
                <div style={{ fontSize:24, fontFamily:"var(--fn)", fontWeight:800, color:s.color }}>{s.value}</div>
              </div>
              <div style={{ fontSize:22 }}>{s.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:16, marginBottom:18 }}>
        <Card>
          <h3 style={{ fontFamily:"var(--fh)", fontSize:15, marginBottom:14 }}>OS por Status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={Object.entries(STATUS).map(([k,v])=>({name:v.label,total:bySt(k)}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3047" />
              <XAxis dataKey="name" tick={{ fill:"#7b849a", fontSize:11 }} />
              <YAxis tick={{ fill:"#7b849a", fontSize:11 }} allowDecimals={false} />
              <Tooltip {...TT} />
              <Bar dataKey="total" radius={[4,4,0,0]}>{Object.entries(STATUS).map(([k,v]) => <Cell key={k} fill={v.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 style={{ fontFamily:"var(--fh)", fontSize:15, marginBottom:14 }}>Distribuição OS</h3>
          {pieData.length===0 ? <Empty icon="📊" text="Sem dados" /> : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={72} dataKey="value" paddingAngle={3}>{pieData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie><Tooltip {...TT}/></PieChart>
            </ResponsiveContainer>
          )}
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:8 }}>
            {pieData.map(d=><div key={d.name} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"var(--muted)" }}><div style={{ width:7,height:7,borderRadius:99,background:d.color}}/>{d.name}: {d.value}</div>)}
          </div>
        </Card>
      </div>

      {/* Financeiro + Agentes */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 }}>

        {/* Resumo Financeiro */}
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <h3 style={{ fontFamily:"var(--fh)", fontSize:15, margin:0 }}>💰 Financeiro — {thisMonth}</h3>
            {onNavigate && <button type="button" onClick={()=>onNavigate("financeiro")} style={{ background:"none",border:"none",color:"var(--accent)",fontSize:12,cursor:"pointer",fontWeight:600 }}>Ver mais →</button>}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[
              { label:"MRR (Contratos)", value:`R$ ${Number(mrr).toLocaleString("pt-BR",{minimumFractionDigits:2})}`, color:"var(--accent)" },
              { label:"OS Avulsas (mês)", value:`R$ ${os.filter(o=>{ const c=clients.find(c=>c.id===o.clientId); return c?.client_type==="avulso" && ["concluido","aprovado"].includes(o.status) && (o.createdAt||"").startsWith(thisMonth); }).reduce((s,o)=>s+Number(o.budget||0),0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`, color:"var(--green)" },
              { label:"Despesas pagas", value:`R$ ${Number(expSummary.paid||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`, color:"var(--yellow)" },
              { label:"Despesas atrasadas", value:`R$ ${Number(expSummary.overdue||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`, color: expSummary.overdue > 0 ? "var(--red)" : "var(--muted)" },
            ].map(item => (
              <div key={item.label} style={{ padding:"10px 12px", background:"var(--surface2)", borderRadius:8, border:"1px solid var(--border)" }}>
                <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", marginBottom:4 }}>{item.label}</div>
                <div style={{ fontSize:16, fontWeight:700, color:item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
          {expSummary.overdue > 0 && (
            <div style={{ marginTop:10, padding:"8px 10px", background:"rgba(229,91,91,.08)", border:"1px solid rgba(229,91,91,.2)", borderRadius:6, fontSize:12, color:"var(--red)", cursor:"pointer" }}
              onClick={() => onNavigate && onNavigate("expenses")}>
              ⚠ Há despesas atrasadas — clique para ver
            </div>
          )}
        </Card>

        {/* Status dos Agentes */}
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <h3 style={{ fontFamily:"var(--fh)", fontSize:15, margin:0 }}>🤖 Agentes</h3>
            {onNavigate && <button type="button" onClick={()=>onNavigate("agents")} style={{ background:"none",border:"none",color:"var(--accent)",fontSize:12,cursor:"pointer",fontWeight:600 }}>Ver todos →</button>}
          </div>
          {agents.length === 0 ? (
            <div style={{ textAlign:"center", padding:"20px 0", color:"var(--muted)", fontSize:13 }}>Nenhum agente instalado</div>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
                {[
                  { label:"Online", value:agents.filter(a=>a.status==="active"&&a.last_checkin&&(Date.now()-new Date(a.last_checkin).getTime())<86400000).length, color:"var(--green)" },
                  { label:"Offline", value:agents.filter(a=>a.status==="active"&&(!a.last_checkin||(Date.now()-new Date(a.last_checkin).getTime())>=86400000)).length, color:"var(--muted)" },
                  { label:"Pendentes", value:agents.filter(a=>a.status==="pending").length, color:"var(--yellow)" },
                ].map(item => (
                  <div key={item.label} style={{ padding:"10px 12px", background:"var(--surface2)", borderRadius:8, textAlign:"center" }}>
                    <div style={{ fontSize:22, fontWeight:700, color:item.color }}>{item.value}</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
              {agents.filter(a=>a.status==="pending").length > 0 && (
                <div style={{ padding:"8px 10px", background:"rgba(245,197,66,.08)", border:"1px solid rgba(245,197,66,.2)", borderRadius:6, fontSize:12, color:"var(--yellow)", cursor:"pointer" }}
                  onClick={() => onNavigate && onNavigate("agents")}>
                  ⏳ {agents.filter(a=>a.status==="pending").length} agente(s) aguardando aprovação
                </div>
              )}
              <div style={{ marginTop:10 }}>
                {agents.filter(a=>a.status==="active").slice(0,4).map(a => {
                  const online = a.last_checkin && (Date.now()-new Date(a.last_checkin).getTime()) < 86400000;
                  return (
                    <div key={a.token} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid var(--border)", fontSize:12 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:6, height:6, borderRadius:99, background:online?"var(--green)":"var(--muted)" }} />
                        <strong>{a.hostname}</strong>
                      </div>
                      <span style={{ color:"var(--muted)", fontSize:11 }}>{a.client_name||"—"}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Recent lists side by side */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        {/* Recent OS */}
        <Card style={{ padding:0 }}>
          <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h3 style={{ fontFamily:"var(--fh)", fontSize:15 }}>Últimas OS</h3>
            {onNavigate && <button type="button" onClick={()=>onNavigate("os")} style={{ background:"none",border:"none",color:"var(--accent)",fontSize:12,cursor:"pointer",fontWeight:600 }}>Ver todas →</button>}
          </div>
          {recentOS.length===0 ? <Empty icon="📋" text="Sem OS" /> : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ borderBottom:"1px solid var(--border)" }}><Th>Nº</Th><Th>Cliente</Th><Th>Status</Th><Th>Valor</Th></tr></thead>
              <tbody>{recentOS.map(o => {
                const c = clients.find(c=>c.id===o.clientId);
                return (
                  <Tr key={o.id}>
                    <Td style={{ color:"var(--accent)", fontWeight:700, fontSize:12 }}>#{o.id}</Td>
                    <Td style={{ fontWeight:500, fontSize:13 }}>{c?.name||"—"}</Td>
                    <Td><Badge status={o.status}/></Td>
                    <Td style={{ fontSize:13 }}>R$ {Number(o.budget).toFixed(2)}</Td>
                  </Tr>
                );
              })}</tbody>
            </table>
          )}
        </Card>

        {/* Recent Chamados */}
        <Card style={{ padding:0 }}>
          <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h3 style={{ fontFamily:"var(--fh)", fontSize:15 }}>Últimos Chamados</h3>
            {onNavigate && <button type="button" onClick={()=>onNavigate("chamados")} style={{ background:"none",border:"none",color:"var(--accent)",fontSize:12,cursor:"pointer",fontWeight:600 }}>Ver todos →</button>}
          </div>
          {recentChamados.length===0 ? <Empty icon="📬" text="Sem chamados" /> : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ borderBottom:"1px solid var(--border)" }}><Th>Título</Th><Th>Cliente</Th><Th>Status</Th><Th>Orig.</Th></tr></thead>
              <tbody>{recentChamados.map(c => (
                <Tr key={c.id}>
                  <Td style={{ fontWeight:500, fontSize:13, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.title}</Td>
                  <Td style={{ fontSize:12, color:"var(--muted)" }}>{c.client_name_db||c.client_name||"—"}</Td>
                  <Td><ChamadoBadge status={c.status}/></Td>
                  <Td style={{ fontSize:16 }} title={c.source}>{SOURCE_ICON[c.source]||"✍️"}</Td>
                </Tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
