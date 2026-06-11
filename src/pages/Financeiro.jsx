import { useEffect, useState } from "react";
import { getFinancialSummary } from "../api";
import { Card, Empty } from "../components/ui";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie } from "recharts";

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const TT = { contentStyle:{ background:"#181c27", border:"1px solid #2a3047", borderRadius:8, color:"#eef0f6" } };

function fmt(v) { return `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`; }

export default function Financeiro({ os }) {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFinancialSummary().then(d => { setData(d && typeof d === 'object' && !d.error ? d : {}); setLoading(false); }).catch(e => { console.error('[Financeiro]',e); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--muted)" }}>⏳ Carregando dados financeiros...</div>;

  const monthly = data?.monthly || [];
  const byClient = data?.byClient || [];
  const byTech = data?.byTech || [];
  const mrr = data?.mrr || 0;
  const pendingAmount = data?.pendingAmount || 0;

  // Format monthly data for chart
  const monthlyChart = monthly.map(m => ({
    name: MONTHS_PT[parseInt(m.month.split('-')[1])-1] + '/' + m.month.split('-')[0].slice(2),
    total: m.total,
    count: m.count,
  }));

  // This month stats
  const thisMonth = new Date().toISOString().slice(0,7);
  const thisMonthData = monthly.find(m => m.month === thisMonth);
  const lastMonth = new Date(new Date().setMonth(new Date().getMonth()-1)).toISOString().slice(0,7);
  const lastMonthData = monthly.find(m => m.month === lastMonth);
  const growth = lastMonthData?.total > 0
    ? (((thisMonthData?.total||0) - lastMonthData.total) / lastMonthData.total * 100).toFixed(1)
    : null;

  const totalReceived = monthly.reduce((s,m) => s + m.total, 0);

  const stats = [
    { label:"MRR (Mensalidades)",    value:fmt(mrr),           color:"var(--accent)", icon:"🔄", sub:"Recorrência mensal"          },
    { label:"Faturado este mês",     value:fmt(thisMonthData?.total||0), color:"var(--green)", icon:"💰", sub: growth ? `${growth>0?'+':''}${growth}% vs mês anterior` : "Sem comparativo" },
    { label:"Faturado (12 meses)",   value:fmt(totalReceived), color:"var(--purple)", icon:"📊", sub:`${monthly.reduce((s,m)=>s+m.count,0)} OS concluídas` },
    { label:"A Receber (OS abertas)",value:fmt(pendingAmount), color:"var(--yellow)", icon:"⏳", sub:"OS em aberto/andamento"        },
  ];

  const COLORS = ["#4f8ef7","#3ecf8e","#9b72f7","#f5c542","#f78c4f","#e55b5b","#00bcd4","#e91e8c"];

  return (
    <div className="fu">
      <h2 style={{ fontFamily:"var(--fh)", fontSize:24, marginBottom:20 }}>Dashboard Financeiro</h2>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:22 }}>
        {stats.map(s => (
          <Card key={s.label} style={{ padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", fontWeight:600, marginBottom:8 }}>{s.label}</div>
                <div style={{ fontSize:22, fontFamily:"var(--fn)", fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>{s.sub}</div>
              </div>
              <div style={{ fontSize:26 }}>{s.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Revenue over time */}
      <Card style={{ marginBottom:16 }}>
        <h3 style={{ fontFamily:"var(--fh)", fontSize:15, marginBottom:16 }}>📈 Faturamento Mensal (últimos 12 meses)</h3>
        {monthlyChart.length === 0 ? <Empty icon="📊" text="Sem dados de OS concluídas ainda" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3047" />
              <XAxis dataKey="name" tick={{ fill:"#7b849a", fontSize:11 }} />
              <YAxis tick={{ fill:"#7b849a", fontSize:11 }} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`} />
              <Tooltip {...TT} formatter={v=>[fmt(v),"Faturado"]} />
              <Line type="monotone" dataKey="total" stroke="#4f8ef7" strokeWidth={2} dot={{ fill:"#4f8ef7", r:4 }} activeDot={{ r:6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        {/* By client */}
        <Card>
          <h3 style={{ fontFamily:"var(--fh)", fontSize:15, marginBottom:16 }}>👥 Faturamento por Cliente</h3>
          {byClient.length === 0 ? <Empty icon="👥" text="Sem dados" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byClient} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3047" />
                <XAxis type="number" tick={{ fill:"#7b849a", fontSize:10 }} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fill:"#7b849a", fontSize:11 }} width={110} />
                <Tooltip {...TT} formatter={v=>[fmt(v),"Faturado"]} />
                <Bar dataKey="total" radius={[0,4,4,0]}>
                  {byClient.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* By technician */}
        <Card>
          <h3 style={{ fontFamily:"var(--fh)", fontSize:15, marginBottom:16 }}>🔧 Faturamento por Técnico</h3>
          {byTech.length === 0 ? <Empty icon="🔧" text="Sem dados" /> : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={byTech} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="total" paddingAngle={3}>
                    {byTech.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TT} formatter={v=>[fmt(v),"Faturado"]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8 }}>
                {byTech.map((t,i) => (
                  <div key={t.name} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
                    <div style={{ width:10, height:10, borderRadius:99, background:COLORS[i%COLORS.length] }} />
                    <span style={{ color:"var(--muted)" }}>{t.name}:</span>
                    <span style={{ fontWeight:600 }}>{fmt(t.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Recent concluded OS */}
      <Card style={{ padding:0 }}>
        <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
          <h3 style={{ fontFamily:"var(--fh)", fontSize:15 }}>✅ OS Concluídas Recentes</h3>
        </div>
        {(() => {
          const concluded = [...os].filter(o=>o.status==='concluido').sort((a,b)=>b.id-a.id).slice(0,8);
          if (!concluded.length) return <Empty icon="📋" text="Nenhuma OS concluída ainda" />;
          return (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ borderBottom:"1px solid var(--border)" }}>
                {["Nº","Data","Descrição","Valor"].map(h=><th key={h} style={{ textAlign:"left",padding:"10px 14px",fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".4px" }}>{h}</th>)}
              </tr></thead>
              <tbody>{concluded.map(o=>(
                <tr key={o.id} style={{ borderBottom:"1px solid var(--border)" }}>
                  <td style={{ padding:"12px 14px", color:"var(--accent)", fontWeight:700, fontSize:12 }}>#{o.id}</td>
                  <td style={{ padding:"12px 14px", fontSize:12, color:"var(--muted)" }}>{o.updatedAt}</td>
                  <td style={{ padding:"12px 14px", fontSize:13, maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{o.description}</td>
                  <td style={{ padding:"12px 14px", fontWeight:700, color:"var(--green)" }}>{fmt(o.budget)}</td>
                </tr>
              ))}</tbody>
            </table>
          );
        })()}
      </Card>
    </div>
  );
}
