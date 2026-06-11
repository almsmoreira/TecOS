import { useState, useEffect } from "react";
import { getChamados, addChamado, updChamado, delChamado, convertChamado } from "../api";
import { Btn, Card, Empty, Modal, Field, Tabs } from "../components/ui";
import ChamadoForm from "../components/ChamadoForm";

const STATUS_MAP = {
  aberto:         { label:"Aberto",         color:"#e55b5b", bg:"rgba(229,91,91,.15)"   },
  em_atendimento: { label:"Em Atendimento", color:"#f5c542", bg:"rgba(245,197,66,.15)"  },
  resolvido:      { label:"Resolvido",      color:"#3ecf8e", bg:"rgba(62,207,142,.15)"  },
  cancelado:      { label:"Cancelado",      color:"#7b849a", bg:"rgba(123,132,154,.15)" },
};

const PRIORITY_MAP = {
  baixa:   { label:"Baixa",   color:"#3ecf8e" },
  normal:  { label:"Normal",  color:"#4f8ef7" },
  alta:    { label:"Alta",    color:"#f5c542" },
  urgente: { label:"Urgente", color:"#e55b5b" },
};

const SOURCE_ICON = { manual:"✍️", webhook:"🔗", chatwoot:"💬", n8n:"⚡", typebot:"🤖" };

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.aberto;
  return <span style={{ background:s.bg, color:s.color, borderRadius:99, fontSize:11, fontWeight:700, padding:"3px 10px", whiteSpace:"nowrap" }}>{s.label}</span>;
}

function PriorityBadge({ priority }) {
  const p = PRIORITY_MAP[priority] || PRIORITY_MAP.normal;
  return <span style={{ color:p.color, fontSize:12, fontWeight:700 }}>● {p.label}</span>;
}

function ConvertModal({ chamado, users, currentUser, onConvert, onClose }) {
  const [techId, setTechId] = useState(String(currentUser.id));
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    const res = await convertChamado(chamado.id, { technicianId: Number(techId)||null, username: currentUser.username });
    if (res.ok) onConvert(res.os_id);
    setLoading(false);
  };
  return (
    <Modal title="Converter em Ordem de Serviço" onClose={onClose}>
      <div style={{ padding:"12px 14px", background:"rgba(62,207,142,.08)", border:"1px solid rgba(62,207,142,.2)", borderRadius:8, marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>📋 {chamado.title}</div>
        <div style={{ fontSize:12, color:"var(--muted)" }}>{chamado.client_name||chamado.client_name_db||"Cliente não identificado"}</div>
      </div>
      <Field label="Técnico Responsável">
        <select value={techId} onChange={e => setTechId(e.target.value)}>
          <option value="">Não atribuído</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <p style={{ fontSize:12, color:"var(--muted)", marginBottom:16 }}>
        Uma OS será criada com status <strong>Orçamento</strong> e este chamado será marcado como <strong>Resolvido</strong>.
      </p>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="success" onClick={handle} disabled={loading}>{loading ? "Convertendo…" : "✅ Converter em OS"}</Btn>
      </div>
    </Modal>
  );
}

export default function Chamados({ clients, users, equipment=[], currentUser, onNavigateOS }) {
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [converting, setConverting] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("todos");

  const load = () => {
    setLoading(true);
    getChamados().then(data => { setChamados(data||[]); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (editTarget?.id) {
      await updChamado(editTarget.id, form);
    } else {
      await addChamado({ ...form, source:"manual" });
    }
    setEditTarget(null);
    load();
  };

  const [confirmDel, setConfirmDel] = useState(null);
  const handleDelete = (id) => setConfirmDel(id);
  const confirmDelete = async () => {
    await delChamado(confirmDel);
    setConfirmDel(null);
    load();
  };

  const handleQuickStatus = async (chamado, newStatus) => {
    await updChamado(chamado.id, { ...chamado, clientId:chamado.client_id, technicianId:chamado.technician_id, status:newStatus });
    setChamados(cs => cs.map(c => c.id===chamado.id ? {...c, status:newStatus} : c));
  };

  const handleConverted = (osId) => {
    setConverting(null);
    load();
    if (onNavigateOS) onNavigateOS();
  };

  const byStatus = s => chamados.filter(c => c.status===s).length;
  const stats = [
    { label:"Abertos",         value:byStatus("aberto"),         color:"var(--red)"    },
    { label:"Em Atendimento",  value:byStatus("em_atendimento"), color:"var(--yellow)" },
    { label:"Resolvidos",      value:byStatus("resolvido"),      color:"var(--green)"  },
    { label:"Total",           value:chamados.length,            color:"var(--muted)"  },
  ];

  const filtered = chamados.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = c.title?.toLowerCase().includes(q) || (c.client_name||c.client_name_db||"").toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
    const matchStatus   = filterStatus   === "" || c.status   === filterStatus;
    const matchPriority = filterPriority === "" || c.priority === filterPriority;
    const matchTab = tab==="todos" || c.status===tab;
    return matchSearch && matchStatus && matchPriority && matchTab;
  });

  return (
    <div className="fu">
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontFamily:"var(--fh)", fontSize:24 }}>Chamados</h2>
        <Btn onClick={() => setEditTarget({})}>＋ Novo Chamado</Btn>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {stats.map(s => (
          <Card key={s.label} style={{ padding:14 }}>
            <div style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", fontWeight:600, marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:28, fontFamily:"var(--fn)", fontWeight:800, color:s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, borderBottom:"1px solid var(--border)", marginBottom:16 }}>
        {[{id:"todos",label:"Todos"},{id:"aberto",label:"🔴 Abertos"},{id:"em_atendimento",label:"🟡 Em Atendimento"},{id:"resolvido",label:"🟢 Resolvidos"}].map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ padding:"10px 16px", background:"none", border:"none", color:tab===t.id?"var(--accent)":"var(--muted)", fontWeight:tab===t.id?700:400, fontSize:13, borderBottom:tab===t.id?"2px solid var(--accent)":"2px solid transparent", cursor:"pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:10, marginBottom:14 }}>
        <div style={{ flex:1 }}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Buscar por título, cliente ou descrição..." /></div>
        <div style={{ width:160 }}>
          <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
            <option value="">Todas prioridades</option>
            {Object.entries(PRIORITY_MAP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <Card><div style={{ textAlign:"center", padding:"40px 0", color:"var(--muted)" }}>⏳ Carregando...</div></Card>
      ) : filtered.length === 0 ? (
        <Card><Empty icon="📬" text="Nenhum chamado encontrado" /></Card>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtered.map(c => {
            const clientName = c.client_name_db || c.client_name || "Cliente não identificado";
            const phone = c.client_phone || "";
            return (
              <Card key={c.id} style={{ padding:0, overflow:"hidden" }}>
                <div style={{ display:"flex", gap:0 }}>
                  {/* Priority stripe */}
                  <div style={{ width:4, background:PRIORITY_MAP[c.priority]?.color||"var(--accent)", flexShrink:0 }} />
                  <div style={{ flex:1, padding:"14px 16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                          <span style={{ fontFamily:"var(--fh)", fontSize:13, color:"var(--muted)" }}>#{c.id}</span>
                          <span style={{ fontWeight:700, fontSize:15 }}>{c.title}</span>
                          <StatusBadge status={c.status} />
                          <PriorityBadge priority={c.priority} />
                          {c.source && c.source !== "manual" && (
                            <span title={`Origem: ${c.source}`} style={{ fontSize:14 }}>{SOURCE_ICON[c.source]||"🔗"}</span>
                          )}
                          {c.os_id && <span style={{ background:"rgba(62,207,142,.12)", color:"var(--green)", borderRadius:99, fontSize:11, fontWeight:700, padding:"2px 8px" }}>OS #{c.os_id}</span>}
                        </div>
                        <div style={{ fontSize:13, color:"var(--muted)", marginBottom:4 }}>
                          👤 {clientName}
                          {phone && <span style={{ marginLeft:8 }}>📞 {phone}</span>}
                          {c.technician_name && <span style={{ marginLeft:8 }}>🔧 {c.technician_name}</span>}
                        </div>
                        {c.description && <div style={{ fontSize:13, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:600 }}>{c.description}</div>}
                        <div style={{ fontSize:11, color:"var(--muted)", marginTop:6 }}>
                          {new Date(c.created_at).toLocaleString("pt-BR")}
                          {c.source && <span style={{ marginLeft:8 }}>via {c.source}</span>}
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{ display:"flex", flexDirection:"column", gap:5, flexShrink:0 }}>
                        {c.status === "aberto" && (
                          <Btn small variant="yellow" onClick={() => handleQuickStatus(c,"em_atendimento")}>▶ Atender</Btn>
                        )}
                        {c.status === "em_atendimento" && (
                          <Btn small variant="success" onClick={() => handleQuickStatus(c,"resolvido")}>✓ Resolver</Btn>
                        )}
                        {!c.os_id && c.status !== "cancelado" && (
                          <Btn small variant="purple" onClick={() => setConverting(c)}>📋 → OS</Btn>
                        )}
                        <Btn small variant="ghost" onClick={() => setEditTarget(c)}>✏ Editar</Btn>
                        <Btn small variant="danger" onClick={() => handleDelete(c.id)}>🗑</Btn>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Isolated form */}
      {editTarget !== null && (
        <ChamadoForm
          editing={editTarget?.id ? editTarget : null}
          clients={clients}
          users={users}
          equipment={equipment}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}

      {confirmDel !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:28, maxWidth:340, width:"100%", margin:16, textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🗑</div>
            <div style={{ fontFamily:"var(--fh)", fontSize:17, fontWeight:700, marginBottom:8 }}>Excluir chamado?</div>
            <div style={{ fontSize:13, color:"var(--muted)", marginBottom:20 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button type="button" onClick={() => setConfirmDel(null)} style={{ background:"transparent", border:"1px solid var(--border)", color:"var(--muted)", padding:"9px 20px", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:14 }}>Cancelar</button>
              <button type="button" onClick={confirmDelete} style={{ background:"#e55b5b", color:"#fff", border:"none", padding:"9px 20px", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:14 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Convert modal */}
      {converting && (
        <ConvertModal
          chamado={converting}
          users={users}
          currentUser={currentUser}
          onConvert={handleConverted}
          onClose={() => setConverting(null)}
        />
      )}
    </div>
  );
}
