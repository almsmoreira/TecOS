import { useEffect, useState } from "react";
import { getBillings, generateBillings, updBilling, delBilling, sendBilling, getSystemConfig, saveSystemConfig } from "../api";
import { Btn, Card, Empty, Modal, Field, G2 } from "../components/ui";

const STATUS_MAP = {
  pendente: { label:"Pendente", color:"#f5c542", bg:"rgba(245,197,66,.15)" },
  enviado:  { label:"Enviado",  color:"#4f8ef7", bg:"rgba(79,142,247,.15)" },
  pago:     { label:"Pago",     color:"#3ecf8e", bg:"rgba(62,207,142,.15)" },
  cancelado:{ label:"Cancelado",color:"#7b849a", bg:"rgba(123,132,154,.15)"},
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pendente;
  return <span style={{ background:s.bg, color:s.color, borderRadius:99, fontSize:11, fontWeight:700, padding:"3px 10px" }}>{s.label}</span>;
}

function currMonth() { return new Date().toISOString().slice(0,7); }
function fmtMonth(m, reference=false) {
  const [y,mo] = m.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  if (!reference) return months[parseInt(mo)-1] + '/' + y;
  // Reference month = previous month (billing in May refers to April)
  const date = new Date(parseInt(y), parseInt(mo)-2, 1);
  return months[date.getMonth()] + '/' + date.getFullYear();
}
function fmt(v) { return `R$ ${Number(v||0).toFixed(2)}`; }

// ── Config Modal ─────────────────────────────────────────────────────────────
function ConfigModal({ onClose }) {
  const [cfg, setCfg] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { getSystemConfig().then(setCfg).catch(()=>{}); }, []);

  const f = k => e => setCfg(p => ({...p,[k]:e.target.value}));
  const save = async () => {
    setSaving(true);
    await saveSystemConfig(cfg);
    setMsg("✓ Configurações salvas!"); setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <Modal title="⚙ Configurações de Envio" onClose={onClose} wide>
      <div style={{ fontSize:11, fontWeight:700, color:"var(--yellow)", textTransform:"uppercase", letterSpacing:".6px", marginBottom:10 }}>💬 WhatsApp — Evolution API</div>
      <G2>
        <Field label="URL da Evolution API"><input value={cfg.evolution_url||""} onChange={f("evolution_url")} placeholder="https://evolution.seudominio.com.br" /></Field>
        <Field label="API Key"><input value={cfg.evolution_key||""} onChange={f("evolution_key")} placeholder="sua-api-key" /></Field>
        <Field label="Nome da Instância"><input value={cfg.evolution_instance||""} onChange={f("evolution_instance")} placeholder="nome-da-instancia" /></Field>
      </G2>

      <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:".6px", margin:"16px 0 10px" }}>📧 E-mail — SMTP</div>
      <G2>
        <Field label="Servidor SMTP"><input value={cfg.smtp_host||""} onChange={f("smtp_host")} placeholder="smtp.gmail.com" /></Field>
        <Field label="Porta"><input value={cfg.smtp_port||""} onChange={f("smtp_port")} placeholder="587" /></Field>
        <Field label="Usuário"><input value={cfg.smtp_user||""} onChange={f("smtp_user")} placeholder="seu@email.com" /></Field>
        <Field label="Senha"><input type="password" value={cfg.smtp_pass||""} onChange={f("smtp_pass")} placeholder="••••••••" /></Field>
        <Field label="Remetente (From)"><input value={cfg.smtp_from||""} onChange={f("smtp_from")} placeholder="ALMS Tecnologia <noreply@alms.com.br>" /></Field>
      </G2>

      <div style={{ fontSize:11, fontWeight:700, color:"var(--green)", textTransform:"uppercase", letterSpacing:".6px", margin:"16px 0 10px" }}>🏢 Empresa</div>
      <G2>
        <Field label="Nome da Empresa"><input value={cfg.company_name||""} onChange={f("company_name")} placeholder="ALMS Tecnologia" /></Field>
        <Field label="Chave PIX"><input value={cfg.pix_key||""} onChange={f("pix_key")} placeholder="CPF, CNPJ, email ou chave aleatória" /></Field>
        <Field label="Telefone da Empresa"><input value={cfg.company_phone||""} onChange={f("company_phone")} placeholder="(43) 99999-9999" /></Field>
      </G2>

      {msg && <div style={{ padding:"10px 14px", background:"rgba(62,207,142,.12)", border:"1px solid rgba(62,207,142,.3)", borderRadius:8, color:"var(--green)", fontSize:13, fontWeight:600, marginBottom:12 }}>{msg}</div>}
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
        <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Btn>
      </div>
    </Modal>
  );
}

// ── Build preview message ───────────────────────────────────────────────────
function buildPreview(billing) {
  const [y,m] = billing.month.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const monthName = months[parseInt(m)-1];
  return `Olá ${billing.client_name}! 👋

Sua mensalidade referente a *${monthName}/${y}* está disponível.

💰 Valor: R$ ${Number(billing.amount).toFixed(2)}

Qualquer dúvida, entre em contato!

*ALMS Tecnologia*`;
}

// ── Send Modal ───────────────────────────────────────────────────────────────
function SendModal({ billing, onSent, onClose }) {
  const [method, setMethod] = useState(billing.send_method||"whatsapp");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [cfg, setCfg] = useState({});

  useEffect(() => { getSystemConfig().then(setCfg).catch(()=>{}); }, []);

  const send = async () => {
    setSending(true); setErr("");
    const res = await sendBilling(billing.id, method);
    if (res.ok) onSent();
    else setErr(res.error || "Erro ao enviar");
    setSending(false);
  };

  return (
    <Modal title="Enviar Cobrança" onClose={onClose}>
      <div style={{ padding:"12px 14px", background:"var(--surface2)", borderRadius:8, marginBottom:16 }}>
        <div style={{ fontWeight:600, marginBottom:4 }}>{billing.client_name}</div>
        <div style={{ fontSize:13, color:"var(--muted)" }}>{fmtMonth(billing.month, true)} · {fmt(billing.amount)}</div>
      </div>
      <Field label="Método de Envio">
        <div style={{ display:"flex", gap:8 }}>
          {[["whatsapp","💬 WhatsApp"],["email","📧 E-mail"]].map(([k,l]) => (
            <button key={k} type="button" onClick={() => setMethod(k)} style={{
              flex:1, padding:"10px", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13,
              background: method===k ? "rgba(79,142,247,.15)" : "var(--surface2)",
              border: `1px solid ${method===k ? "var(--accent)" : "var(--border)"}`,
              color: method===k ? "var(--accent)" : "var(--muted)",
            }}>{l}</button>
          ))}
        </div>
      </Field>
      {method==="whatsapp" && <p style={{ fontSize:12, color:"var(--muted)", marginBottom:4 }}>📞 {billing.phone||"Sem telefone cadastrado"}</p>}
      {method==="email"    && <p style={{ fontSize:12, color:"var(--muted)", marginBottom:4 }}>📧 {billing.email||"Sem e-mail cadastrado"}</p>}

      {/* Template preview */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:6 }}>
          {method==="whatsapp" ? "💬 Mensagem que será enviada:" : "📧 Corpo do e-mail:"}
        </div>
        <div style={{ background:"var(--bg)", border:"1px solid var(--border)", borderRadius:8, padding:"12px 14px", fontSize:13, whiteSpace:"pre-wrap", lineHeight:1.6, color:"var(--text)", maxHeight:200, overflowY:"auto", fontFamily: method==="whatsapp" ? "inherit" : "monospace" }}>
          {method==="whatsapp"
            ? buildPreview(billing, cfg.pix_key||'', cfg.company_name||'ALMS Tecnologia')
            : `Para: ${billing.email||"sem e-mail"}
Assunto: Cobrança de Mensalidade — ${fmtMonth(billing.month, true)}

Olá ${billing.client_name},

Sua mensalidade de ${fmtMonth(billing.month, true)} está disponível.

Valor: R$ ${Number(billing.amount).toFixed(2)}

Atenciosamente,
ALMS Tecnologia`
          }
        </div>
      </div>
      {err && <div style={{ padding:"8px 12px", background:"rgba(229,91,91,.12)", border:"1px solid rgba(229,91,91,.25)", borderRadius:8, color:"var(--red)", fontSize:13, marginBottom:8 }}>⚠ {err}</div>}
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={send} disabled={sending}>{sending ? "Enviando…" : "📤 Enviar"}</Btn>
      </div>
    </Modal>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Mensalidades({ clients }) {
  const [billings, setBillings] = useState([]);
  const [month, setMonth]       = useState(currMonth());
  const [loading, setLoading]   = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [sending, setSending]   = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [genMsg, setGenMsg]     = useState("");

  const load = () => {
    setLoading(true);
    getBillings(month)
      .then(d => { setBillings(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(e => { console.error('[Mensalidades]',e); setLoading(false); });
  };

  useEffect(() => { load(); }, [month]);

  const generate = async () => {
    setGenerating(true);
    const res = await generateBillings(month);
    setGenMsg(`✓ ${res.created} cobranças e OS criadas (${res.skipped} já existiam)`);
    setTimeout(() => setGenMsg(""), 4000);
    setGenerating(false);
    load();
  };

  const markPaid = async (b) => {
    await updBilling(b.id, { status:"pago", amount:b.amount, notes:b.notes, sendMethod:b.send_method });
    load();
  };

  const handleDelete = async () => {
    await delBilling(confirmDel);
    setConfirmDel(null);
    load();
  };

  const contractClients = clients.filter(c => c.client_type==='contrato' && c.monthly_value > 0);
  const total   = billings.reduce((s,b) => s+Number(b.amount), 0);
  const paid    = billings.filter(b=>b.status==='pago').reduce((s,b) => s+Number(b.amount), 0);
  const pending = billings.filter(b=>b.status!=='pago'&&b.status!=='cancelado').reduce((s,b) => s+Number(b.amount), 0);

  return (
    <div className="fu">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontFamily:"var(--fh)", fontSize:24 }}>Mensalidades</h2>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="ghost" onClick={() => setShowConfig(true)}>⚙ Configurar Envio</Btn>
          <Btn onClick={generate} disabled={generating}>{generating ? "Gerando…" : "⚡ Gerar Mensalidades"}</Btn>
        </div>
      </div>

      {/* Month selector */}
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:16 }}>
        <label style={{ fontSize:12, color:"var(--muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:".4px" }}>Mês:</label>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{ width:180, padding:"8px 12px" }} />
        {genMsg && <div style={{ padding:"6px 14px", background:"rgba(62,207,142,.12)", border:"1px solid rgba(62,207,142,.3)", borderRadius:8, color:"var(--green)", fontSize:13, fontWeight:600 }}>{genMsg}</div>}
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:18 }}>
        {[
          { label:"Total do Mês",   value:fmt(total),   color:"var(--accent)" },
          { label:"Recebido",       value:fmt(paid),    color:"var(--green)"  },
          { label:"A Receber",      value:fmt(pending), color:"var(--yellow)" },
          { label:"Clientes Ativos",value:contractClients.length+" contratos", color:"var(--purple)" },
        ].map(s => (
          <Card key={s.label} style={{ padding:14 }}>
            <div style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", fontWeight:600, marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:20, fontFamily:"var(--fn)", fontWeight:800, color:s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Billings table */}
      <Card style={{ padding:0 }}>
        {loading ? (
          <div style={{ padding:40, textAlign:"center", color:"var(--muted)" }}>⏳ Carregando...</div>
        ) : billings.length === 0 ? (
          <div style={{ padding:40, textAlign:"center", color:"var(--muted)" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:14, marginBottom:8 }}>Nenhuma mensalidade para {fmtMonth(month, true)}</div>
            <div style={{ fontSize:12, color:"var(--muted)" }}>Clique em "Gerar Mensalidades" para criar as cobranças de {fmtMonth(month, true)} dos {contractClients.length} clientes de contrato</div>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr style={{ borderBottom:"1px solid var(--border)" }}>
              {["Cliente","Mês","Valor","Status","Enviado em","Ações"].map(h => (
                <th key={h} style={{ textAlign:"left", padding:"10px 14px", fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".4px" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{billings.map(b => (
              <tr key={b.id} style={{ borderBottom:"1px solid var(--border)" }}>
                <td style={{ padding:"13px 14px", fontWeight:600 }}>{b.client_name}</td>
                <td style={{ padding:"13px 14px", fontSize:13, color:"var(--muted)" }}>{fmtMonth(b.month, true)}</td>
                <td style={{ padding:"13px 14px", fontWeight:700, color:"var(--green)" }}>{fmt(b.amount)}</td>
                <td style={{ padding:"13px 14px" }}><StatusBadge status={b.status} /></td>
                <td style={{ padding:"13px 14px", fontSize:12, color:"var(--muted)" }}>{b.sent_at ? new Date(b.sent_at).toLocaleString("pt-BR") : "—"}</td>
                <td style={{ padding:"13px 14px" }}>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {b.status !== "pago" && b.status !== "cancelado" && (
                      <Btn small variant="success" onClick={() => markPaid(b)}>✓ Pago</Btn>
                    )}
                    <Btn small variant="yellow" onClick={() => setSending(b)}>📤 Enviar</Btn>
                    <Btn small variant="danger" onClick={() => setConfirmDel(b.id)}>🗑</Btn>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      {/* Contract clients without billing */}
      {contractClients.length > 0 && billings.length === 0 && (
        <Card style={{ marginTop:16, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color:"var(--muted)" }}>📋 Clientes de contrato cadastrados</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {contractClients.map(c => (
              <div key={c.id} style={{ padding:"6px 12px", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, fontSize:13 }}>
                {c.name} · <span style={{ color:"var(--green)", fontWeight:700 }}>{fmt(c.monthly_value)}/mês</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modals */}
      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}
      {sending && <SendModal billing={sending} onSent={() => { setSending(null); load(); }} onClose={() => setSending(null)} />}

      {confirmDel !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:28, maxWidth:340, width:"100%", margin:16, textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🗑</div>
            <div style={{ fontFamily:"var(--fh)", fontSize:17, fontWeight:700, marginBottom:8 }}>Excluir cobrança?</div>
            <div style={{ fontSize:13, color:"var(--muted)", marginBottom:20 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button type="button" onClick={() => setConfirmDel(null)} style={{ background:"transparent", border:"1px solid var(--border)", color:"var(--muted)", padding:"9px 20px", borderRadius:8, cursor:"pointer", fontWeight:600 }}>Cancelar</button>
              <button type="button" onClick={handleDelete} style={{ background:"#e55b5b", color:"#fff", border:"none", padding:"9px 20px", borderRadius:8, cursor:"pointer", fontWeight:600 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
