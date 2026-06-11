import { useState, useEffect, useMemo } from "react";
import { apiGet, apiPost, apiDelete } from "../api";
import AgentModal from "../components/AgentModal";
import { Btn, Card, Modal, Field, Empty } from "../components/ui";

const fmtDate = d => d ? new Date(d).toLocaleString("pt-BR") : "—";
const relTime = d => {
  if (!d) return "nunca";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "agora mesmo";
  if (s < 3600) return `${Math.floor(s/60)}min atrás`;
  if (s < 86400) return `${Math.floor(s/3600)}h atrás`;
  return `${Math.floor(s/86400)} dias atrás`;
};

export default function Agents({ clients = [], equipment = [] }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [approveModal, setApproveModal] = useState(null);
  const [agentModal, setAgentModal] = useState(null); // {equipment, token} // token sendo aprovado
  const [form, setForm] = useState({ mode:"existing", clientId:"", equipmentId:"", collaborator:"" });

  const load = async () => {
    setLoading(true);
    const data = await apiGet("/api/agents");
    setAgents(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const pending = agents.filter(a => a.status === "pending");
  const active  = agents.filter(a => a.status === "active");
  const revoked = agents.filter(a => a.status === "revoked");

  const filtered = useMemo(() => {
    if (tab === "pending") return pending;
    if (tab === "active")  return active;
    if (tab === "revoked") return revoked;
    return agents;
  }, [agents, tab]);

  const openApprove = (agent) => {
    setForm({ mode:"existing", clientId:"", equipmentId:"", collaborator: agent.auto_info?.user || "" });
    setApproveModal(agent);
  };

  const clientEquipment = useMemo(() => {
    if (!form.clientId) return [];
    return equipment.filter(e => String(e.clientId) === String(form.clientId));
  }, [form.clientId, equipment]);

  const approve = async () => {
    if (!approveModal) return;
    if (form.mode === "existing") {
      if (!form.equipmentId) return alert("Selecione um equipamento!");
      await apiPost(`/api/agent/approve/${approveModal.token}`, { equipmentId: form.equipmentId });
    } else {
      if (!form.clientId) return alert("Selecione um cliente!");
      await apiPost(`/api/agent/approve-new/${approveModal.token}`, {
        clientId: form.clientId,
        collaborator: form.collaborator,
      });
    }
    setApproveModal(null);
    load();
  };

  const revoke = async (token, hostname) => {
    if (!window.confirm(`Revogar agente "${hostname}"? O agente parará de funcionar.`)) return;
    await apiDelete(`/api/agent-tokens/${token}`);
    load();
  };

  const StatusBadge = ({ status, lastCheckin }) => {
    const isOnline = lastCheckin && (Date.now() - new Date(lastCheckin).getTime()) < 86400000;
    const cfg = {
      pending: { color:"var(--yellow)", bg:"rgba(245,197,66,.15)", label:"⏳ Pendente" },
      active:  { color: isOnline ? "var(--green)" : "var(--muted)", bg: isOnline ? "rgba(62,207,142,.15)" : "rgba(123,132,154,.1)", label: isOnline ? "● Online" : "○ Offline" },
      revoked: { color:"var(--red)", bg:"rgba(229,91,91,.15)", label:"✕ Revogado" },
    };
    const c = cfg[status] || cfg.pending;
    return <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99, background:c.bg, color:c.color }}>{c.label}</span>;
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:700 }}>🤖 Agentes</h2>
          <div style={{ color:"var(--muted)", fontSize:13, marginTop:2 }}>
            {pending.length > 0 && <span style={{ color:"var(--yellow)", fontWeight:600 }}>⚠ {pending.length} pendente(s) de aprovação · </span>}
            {active.length} ativo(s) · {agents.length} total
          </div>
        </div>
        <Btn variant="ghost" onClick={load}>↺ Atualizar</Btn>
      </div>

      {/* Alerta de pendentes */}
      {pending.length > 0 && (
        <Card style={{ marginBottom:16, border:"1px solid rgba(245,197,66,.4)", background:"rgba(245,197,66,.06)" }}>
          <div style={{ fontWeight:700, fontSize:13, color:"var(--yellow)", marginBottom:6 }}>
            ⚠ {pending.length} agente(s) aguardando aprovação
          </div>
          {pending.map(a => (
            <div key={a.token} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(245,197,66,.15)" }}>
              <div>
                <strong style={{ fontSize:13 }}>{a.hostname}</strong>
                <span style={{ fontSize:11, color:"var(--muted)", marginLeft:8 }}>{fmtDate(a.created_at)}</span>
                {a.auto_info && (
                  <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>
                    {a.auto_info.manufacturer} {a.auto_info.productName} · {a.auto_info.osName} · {a.auto_info.cpu}
                  </div>
                )}
              </div>
              <Btn onClick={() => openApprove(a)}>✓ Aprovar</Btn>
            </div>
          ))}
        </Card>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, borderBottom:"1px solid var(--border)", marginBottom:16 }}>
        {[
          ["pending", `⏳ Pendentes (${pending.length})`],
          ["active",  `✓ Ativos (${active.length})`],
          ["revoked", `✕ Revogados (${revoked.length})`],
          ["all",     `Todos (${agents.length})`],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding:"10px 16px", background:"none", border:"none", cursor:"pointer", fontSize:13,
            color: tab===id ? "var(--accent)" : "var(--muted)",
            fontWeight: tab===id ? 700 : 400,
            borderBottom: tab===id ? "2px solid var(--accent)" : "2px solid transparent",
          }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"var(--muted)" }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <Empty icon="🤖" text="Nenhum agente nesta categoria" />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                {["Hostname","Cliente / Equipamento","Sistema","Último Checkin","Status","Ações"].map(h => (
                  <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:11, color:"var(--muted)", fontWeight:700, textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.token} style={{ borderBottom:"1px solid var(--border)" }}>
                  <td style={{ padding:"10px 12px", fontWeight:700 }}>{a.hostname}</td>
                  <td style={{ padding:"10px 12px", fontSize:12 }}>
                    {a.client_name ? (
                      <>
                        <div style={{ fontWeight:600 }}>{a.client_name}</div>
                        <div style={{ color:"var(--muted)" }}>{a.equip_type} {a.brand} {a.model}</div>
                      </>
                    ) : (
                      <span style={{ color:"var(--muted)" }}>— não vinculado</span>
                    )}
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:12, color:"var(--muted)" }}>
                    {a.auto_info?.osName ? a.auto_info.osName.replace("Microsoft ","").replace(" Evaluation","") : "—"}
                    {a.auto_info?.ramGB && <div>{a.auto_info.ramGB} GB RAM</div>}
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:12, color:"var(--muted)" }}>
                    {a.last_checkin ? (
                      <>
                        <div>{relTime(a.last_checkin)}</div>
                        <div style={{ fontSize:10 }}>{fmtDate(a.last_checkin)}</div>
                      </>
                    ) : "nunca"}
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <StatusBadge status={a.status} lastCheckin={a.last_checkin} />
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      {a.status === "pending" && (
                        <Btn small onClick={() => openApprove(a)}>✓ Aprovar</Btn>
                      )}
                      {a.status === "active" && (
                        <>
                          <Btn small variant="secondary" onClick={() => {
                            if (a.equipment_id) {
                              setAgentModal({ id: a.equipment_id, brand: a.brand || "", model: a.model || a.hostname, type: a.equip_type || "Computador" });
                            } else {
                              alert("Este agente não está vinculado a um equipamento. Aprove-o primeiro.");
                            }
                          }}>⚙</Btn>
                          <Btn small variant="danger" onClick={() => revoke(a.token, a.hostname)}>Revogar</Btn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal de aprovação */}
      {approveModal && (
        <Modal title={`Aprovar Agente — ${approveModal.hostname}`} onClose={() => setApproveModal(null)}>
          {approveModal.auto_info && (
            <Card style={{ marginBottom:14, background:"var(--surface2)" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", marginBottom:8 }}>📋 Informações coletadas</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, fontSize:12 }}>
                {[
                  ["Fabricante", approveModal.auto_info.manufacturer],
                  ["Modelo", approveModal.auto_info.productName],
                  ["Serial", approveModal.auto_info.serialNumber],
                  ["Tipo", approveModal.auto_info.deviceType],
                  ["Sistema", approveModal.auto_info.osName?.replace("Microsoft ","")],
                  ["CPU", approveModal.auto_info.cpu],
                  ["RAM", `${approveModal.auto_info.ramGB} GB`],
                  ["HD", `${approveModal.auto_info.storageGB} GB`],
                ].map(([k,v]) => v && (
                  <div key={k} style={{ padding:"6px 8px", background:"var(--bg)", borderRadius:6 }}>
                    <div style={{ color:"var(--muted)", fontSize:10 }}>{k}</div>
                    <div style={{ fontWeight:600, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            {["existing","new"].map(m => (
              <button key={m} onClick={() => setForm(f=>({...f, mode:m, equipmentId:"", clientId:""}))} style={{
                flex:1, padding:"10px", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13,
                background: form.mode===m ? "rgba(79,142,247,.15)" : "var(--surface2)",
                border: `1px solid ${form.mode===m ? "var(--accent)" : "var(--border)"}`,
                color: form.mode===m ? "var(--accent)" : "var(--muted)",
              }}>
                {m === "existing" ? "🔗 Vincular a equipamento existente" : "➕ Criar novo equipamento"}
              </button>
            ))}
          </div>

          {form.mode === "existing" ? (
            <>
              <Field label="Cliente">
                <select value={form.clientId} onChange={e => setForm(f=>({...f, clientId:e.target.value, equipmentId:""}))}>
                  <option value="">Selecione o cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              {form.clientId && (
                <Field label="Equipamento">
                  <select value={form.equipmentId} onChange={e => setForm(f=>({...f, equipmentId:e.target.value}))}>
                    <option value="">Selecione o equipamento</option>
                    {clientEquipment.map(e => <option key={e.id} value={e.id}>{e.type} {e.brand} {e.model} {e.collaborator ? `(${e.collaborator})` : ""}</option>)}
                  </select>
                </Field>
              )}
            </>
          ) : (
            <>
              <Field label="Cliente">
                <select value={form.clientId} onChange={e => setForm(f=>({...f, clientId:e.target.value}))}>
                  <option value="">Selecione o cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Colaborador (usuário do PC)">
                <input value={form.collaborator} onChange={e => setForm(f=>({...f, collaborator:e.target.value}))}
                  placeholder="Nome do colaborador" />
              </Field>
              <div style={{ fontSize:11, color:"var(--muted)", marginTop:-8, marginBottom:8 }}>
                O equipamento será criado automaticamente com os dados coletados pelo agente.
              </div>
            </>
          )}

          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            <Btn onClick={approve} style={{ flex:1 }}>✓ Aprovar e Vincular</Btn>
            <Btn variant="ghost" onClick={() => setApproveModal(null)}>Cancelar</Btn>
          </div>
        </Modal>
      )}
    {agentModal && <AgentModal equipment={agentModal} onClose={() => setAgentModal(null)} />}
    </div>
  );
}
