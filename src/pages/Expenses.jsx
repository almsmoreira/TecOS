import { useState, useEffect } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import { Btn, Card, Modal, Field, G2 } from "../components/ui";

const CATEGORIES = ["Internet","Energia","Aluguel","Software/SaaS","Telefonia","Domínios","Hospedagem","Salários","Impostos","Contador","Marketing","Outros"];
const FREQUENCIES = [
  { id:"mensal",     label:"Mensal" },
  { id:"trimestral", label:"Trimestral" },
  { id:"anual",      label:"Anual" },
  { id:"semanal",    label:"Semanal" },
];

const STATUS_COLORS = {
  pago:     { color:"var(--green)",  bg:"rgba(62,207,142,.15)",  label:"✓ Pago" },
  pendente: { color:"var(--yellow)", bg:"rgba(245,197,66,.15)",  label:"⏱ Pendente" },
  atrasado: { color:"var(--red)",    bg:"rgba(229,91,91,.18)",   label:"⚠ Atrasado" },
};

const emptyForm = () => ({
  description:"", category:"Outros", amount:"", dueDate: new Date().toISOString().slice(0,10),
  status:"pendente", recurring:false, frequency:"mensal", notes:"", paymentMethod:"",
});

const fmtMoney = v => Number(v||0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const fmtDate  = d => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "—";

export default function Expenses() {
  const today = new Date();
  const [month, setMonth] = useState(today.toISOString().slice(0,7));
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary]   = useState({ total:0, paid:0, pending:0, overdue:0, due_soon_count:0 });
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(emptyForm());
  const [editing, setEditing]   = useState(null);
  const [catFilter, setCatFilter]       = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const load = async () => {
    setLoading(true);
    const [es, sm] = await Promise.all([
      apiGet(`/api/expenses?month=${month}`),
      apiGet(`/api/expenses/summary?month=${month}`),
    ]);
    setExpenses(Array.isArray(es) ? es : []);
    setSummary(sm || { total:0, paid:0, pending:0, overdue:0, due_soon_count:0 });
    setLoading(false);
  };
  useEffect(() => { load(); }, [month]);

  const openNew  = () => { setForm(emptyForm()); setEditing(null); setModal(true); };
  const openEdit = e  => {
    setForm({
      description: e.description, category: e.category, amount: e.amount,
      dueDate: e.due_date, status: e.status === "atrasado" ? "pendente" : e.status,
      recurring: !!e.recurring, frequency: e.frequency,
      notes: e.notes || "", paymentMethod: e.payment_method || "",
    });
    setEditing(e.id);
    setModal(true);
  };

  const save = async () => {
    if (!form.description.trim() || !form.dueDate) return;
    const payload = { ...form, amount: Number(form.amount)||0 };
    if (editing) await apiPut(`/api/expenses/${editing}`, payload);
    else         await apiPost(`/api/expenses`, payload);
    setModal(false);
    load();
  };

  const togglePaid = async (e) => {
    const newStatus = e.status === "pago" ? "pendente" : "pago";
    await apiPut(`/api/expenses/${e.id}`, {
      description: e.description, category: e.category, amount: e.amount,
      dueDate: e.due_date, status: newStatus, recurring: !!e.recurring,
      frequency: e.frequency, notes: e.notes || "", paymentMethod: e.payment_method || "",
    });
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir esta despesa?")) return;
    await apiDelete(`/api/expenses/${id}`);
    load();
  };

  const filtered = expenses.filter(e => {
    if (catFilter !== "Todas" && e.category !== catFilter) return false;
    if (statusFilter !== "Todos" && e.status !== statusFilter) return false;
    return true;
  });

  const dueSoon = expenses.filter(e => e.status === "pendente" && (new Date(e.due_date) - today) / 86400000 <= 7 && new Date(e.due_date) >= new Date(today.toDateString()));
  const overdueList = expenses.filter(e => e.status === "atrasado");

  const StatCard = ({ label, value, color }) => (
    <Card style={{ flex:1, minWidth:150 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color }}>{value}</div>
    </Card>
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:700 }}>💳 Controle de Despesas</h2>
          <div style={{ color:"var(--muted)", fontSize:13, marginTop:2 }}>{expenses.length} despesa(s) em {month}</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <label style={{ fontSize:12, color:"var(--muted)" }}>Mês:</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding:"7px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:13 }} />
          <Btn onClick={openNew}>+ Nova Despesa</Btn>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <StatCard label="Total do mês" value={fmtMoney(summary.total)} color="var(--accent)" />
        <StatCard label="Pago" value={fmtMoney(summary.paid)} color="var(--green)" />
        <StatCard label="A pagar" value={fmtMoney(summary.pending)} color="var(--yellow)" />
        <StatCard label="Atrasado" value={fmtMoney(summary.overdue)} color="var(--red)" />
      </div>

      {(dueSoon.length > 0 || overdueList.length > 0) && (
        <div style={{ marginBottom:16, display:"flex", gap:10, flexWrap:"wrap" }}>
          {overdueList.length > 0 && (
            <Card style={{ flex:1, minWidth:280, border:"1px solid rgba(229,91,91,.4)", background:"rgba(229,91,91,.06)" }}>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--red)", marginBottom:6 }}>⚠ {overdueList.length} despesa(s) atrasada(s)</div>
              {overdueList.slice(0,3).map(e => (
                <div key={e.id} style={{ fontSize:12, color:"var(--muted)", marginTop:3 }}>
                  • <strong style={{ color:"var(--text)" }}>{e.description}</strong> — venceu em {fmtDate(e.due_date)} ({fmtMoney(e.amount)})
                </div>
              ))}
            </Card>
          )}
          {dueSoon.length > 0 && (
            <Card style={{ flex:1, minWidth:280, border:"1px solid rgba(245,197,66,.4)", background:"rgba(245,197,66,.06)" }}>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--yellow)", marginBottom:6 }}>⏰ {dueSoon.length} vencendo em até 7 dias</div>
              {dueSoon.slice(0,3).map(e => (
                <div key={e.id} style={{ fontSize:12, color:"var(--muted)", marginTop:3 }}>
                  • <strong style={{ color:"var(--text)" }}>{e.description}</strong> — vence em {fmtDate(e.due_date)} ({fmtMoney(e.amount)})
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:"var(--muted)", fontWeight:600, marginRight:4 }}>Categoria:</span>
          {["Todas", ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding:"5px 10px", borderRadius:6, fontSize:11, cursor:"pointer",
              background: catFilter===c ? "rgba(79,142,247,.15)" : "var(--surface2)",
              border: `1px solid ${catFilter===c ? "var(--accent)" : "var(--border)"}`,
              color: catFilter===c ? "var(--accent)" : "var(--muted)",
            }}>{c}</button>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        <span style={{ fontSize:11, color:"var(--muted)", fontWeight:600, marginRight:4 }}>Status:</span>
        {["Todos","pago","pendente","atrasado"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding:"5px 10px", borderRadius:6, fontSize:11, cursor:"pointer", textTransform:"capitalize",
            background: statusFilter===s ? "rgba(79,142,247,.15)" : "var(--surface2)",
            border: `1px solid ${statusFilter===s ? "var(--accent)" : "var(--border)"}`,
            color: statusFilter===s ? "var(--accent)" : "var(--muted)",
          }}>{s}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color:"var(--muted)", padding:32, textAlign:"center" }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card style={{ textAlign:"center", padding:48, color:"var(--muted)" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>💳</div>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>Nenhuma despesa encontrada</div>
          <div style={{ fontSize:13, marginBottom:20 }}>Adicione a primeira despesa do mês</div>
          <Btn onClick={openNew}>+ Nova Despesa</Btn>
        </Card>
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                <th style={{ padding:"10px 12px", textAlign:"left", fontSize:11, color:"var(--muted)", fontWeight:700, textTransform:"uppercase" }}>Descrição</th>
                <th style={{ padding:"10px 12px", textAlign:"left", fontSize:11, color:"var(--muted)", fontWeight:700, textTransform:"uppercase" }}>Categoria</th>
                <th style={{ padding:"10px 12px", textAlign:"left", fontSize:11, color:"var(--muted)", fontWeight:700, textTransform:"uppercase" }}>Vencimento</th>
                <th style={{ padding:"10px 12px", textAlign:"right", fontSize:11, color:"var(--muted)", fontWeight:700, textTransform:"uppercase" }}>Valor</th>
                <th style={{ padding:"10px 12px", textAlign:"center", fontSize:11, color:"var(--muted)", fontWeight:700, textTransform:"uppercase" }}>Status</th>
                <th style={{ padding:"10px 12px", textAlign:"right", fontSize:11, color:"var(--muted)", fontWeight:700, textTransform:"uppercase" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const st = STATUS_COLORS[e.status] || STATUS_COLORS.pendente;
                return (
                  <tr key={e.id} style={{ borderBottom:"1px solid var(--border)" }}>
                    <td style={{ padding:"10px 12px", fontSize:13 }}>
                      {e.recurring && <span title="Recorrente" style={{ marginRight:6 }}>🔁</span>}
                      <strong>{e.description}</strong>
                      {e.notes && <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{e.notes}</div>}
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:"var(--muted)" }}>{e.category}</td>
                    <td style={{ padding:"10px 12px", fontSize:13 }}>{fmtDate(e.due_date)}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontWeight:600, fontSize:13 }}>{fmtMoney(e.amount)}</td>
                    <td style={{ padding:"10px 12px", textAlign:"center" }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99, background:st.bg, color:st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right" }}>
                      <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                        <Btn small variant={e.status==="pago" ? "secondary" : "success"} onClick={() => togglePaid(e)}>
                          {e.status === "pago" ? "↺" : "✓ Pagar"}
                        </Btn>
                        <Btn small variant="secondary" onClick={() => openEdit(e)}>✏</Btn>
                        <Btn small variant="danger" onClick={() => remove(e.id)}>🗑</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {modal && (
        <Modal title={editing ? "Editar Despesa" : "Nova Despesa"} onClose={() => setModal(false)} wide>
          <Field label="Descrição">
            <input value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Ex: Internet do escritório" autoFocus />
          </Field>
          <G2>
            <Field label="Categoria">
              <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Valor (R$)">
              <input type="number" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))} placeholder="0,00" min={0} step={0.01} />
            </Field>
            <Field label="Vencimento">
              <input type="date" value={form.dueDate} onChange={e => setForm(f=>({...f,dueDate:e.target.value}))} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
                <option value="pendente">⏱ Pendente</option>
                <option value="pago">✓ Pago</option>
              </select>
            </Field>
          </G2>

          <div style={{ marginTop:8, padding:"12px 14px", background:"var(--surface2)", borderRadius:8, border:"1px solid var(--border)" }}>
            <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", fontSize:13 }}>
              <input type="checkbox" checked={form.recurring} onChange={e => setForm(f=>({...f,recurring:e.target.checked}))} style={{ marginTop:3, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600 }}>🔁 Despesa recorrente</div>
                <div style={{ color:"var(--muted)", fontSize:11, marginTop:2 }}>Gera próxima automaticamente quando marcada como paga</div>
              </div>
            </label>
            {form.recurring && (
              <div style={{ marginTop:10 }}>
                <Field label="Frequência">
                  <select value={form.frequency} onChange={e => setForm(f=>({...f,frequency:e.target.value}))}>
                    {FREQUENCIES.map(fr => <option key={fr.id} value={fr.id}>{fr.label}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>

          {form.status === "pago" && (
            <Field label="Método de Pagamento (opcional)">
              <input value={form.paymentMethod} onChange={e => setForm(f=>({...f,paymentMethod:e.target.value}))} placeholder="Ex: PIX, Boleto, Cartão" />
            </Field>
          )}

          <Field label="Observações (opcional)">
            <textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="..." style={{ resize:"vertical" }} />
          </Field>

          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <Btn onClick={save} style={{ flex:1 }}>💾 Salvar</Btn>
            <Btn onClick={() => setModal(false)} variant="secondary">Cancelar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
