import { useState } from "react";
import { Btn, Card, Empty, Th, Td, Tr } from "../components/ui";
import { deleteEquipment } from "../api";
import EquipmentForm from "../components/EquipmentForm";

function InfoBadge({ label, value }) {
  if (!value) return null;
  return (
    <span style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:6, padding:"2px 8px", fontSize:11, color:"var(--muted)", display:"inline-flex", alignItems:"center", gap:4 }}>
      <span style={{ color:"var(--text)", fontWeight:600 }}>{label}:</span> {value}
    </span>
  );
}

export default function Equipment({ equipment, setEquipment, clients, os }) {
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const openNew  = () => setEditTarget({});
  const openEdit = e  => setEditTarget(e);
  const closeForm = () => setEditTarget(null);

  const handleSave = (data) => {
    if (editTarget?.id) {
      setEquipment(es => es.map(e => e.id===editTarget.id ? {...e,...data} : e));
    } else {
      setEquipment(es => [...es, { id:Date.now(), ...data }]);
    }
    closeForm();
  };

  const del = async (id) => {
    if (os.some(o => o.equipmentId===id)) { alert("Equipamento possui OS vinculadas."); return; }
    await deleteEquipment(id);
    setEquipment(es => es.filter(e => e.id!==id));
  };

  const filtered = equipment.filter(e => {
    const c = clients.find(c => c.id===e.clientId);
    const q = search.toLowerCase();
    return e.brand?.toLowerCase().includes(q) || e.model?.toLowerCase().includes(q) ||
      e.serial?.toLowerCase().includes(q) || c?.name?.toLowerCase().includes(q) ||
      e.processor?.toLowerCase().includes(q) || e.osVersion?.toLowerCase().includes(q);
  });

  return (
    <div className="fu">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontFamily:"var(--fh)", fontSize:24 }}>Equipamentos</h2>
        <Btn onClick={openNew}>＋ Novo Equipamento</Btn>
      </div>
      <div style={{ marginBottom:14 }}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Buscar por marca, modelo, série, cliente..." /></div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.length===0 && <Card><Empty icon="🖥️" text="Nenhum equipamento" /></Card>}
        {filtered.map(e => {
          const c = clients.find(c => c.id===e.clientId);
          const isExpanded = expanded===e.id;
          const icon = e.type?.toLowerCase().includes("note")||e.type?.toLowerCase().includes("laptop")?"💻":e.type?.toLowerCase().includes("smart")||e.type?.toLowerCase().includes("cel")?"📱":"🖥️";
          return (
            <Card key={e.id} style={{ padding:0, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", cursor:"pointer" }} onClick={() => setExpanded(isExpanded ? null : e.id)}>
                <div style={{ width:40, height:40, borderRadius:10, background:"rgba(79,142,247,.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{e.brand} {e.model} <span style={{ fontSize:12, color:"var(--muted)", fontWeight:400 }}>({e.type})</span></div>
                  <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{c?.name||"—"}{e.serial && ` · S/N: ${e.serial}`}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                    <InfoBadge label="OS" value={e.osVersion} />
                    <InfoBadge label="RAM" value={e.ram} />
                    <InfoBadge label="CPU" value={e.processor} />
                    <InfoBadge label="HD" value={e.storage} />
                    <InfoBadge label="Office" value={e.office} />
                  </div>
                </div>
                <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                  <Btn small variant="ghost" onClick={ev=>{ev.stopPropagation();openEdit(e);}}>✏ Editar</Btn>
                  <Btn small variant="danger" onClick={ev=>{ev.stopPropagation();del(e.id);}}>🗑</Btn>
                  <span style={{ color:"var(--muted)", fontSize:16, padding:"0 4px" }}>{isExpanded?"▲":"▼"}</span>
                </div>
              </div>
              {isExpanded && (
                <div style={{ borderTop:"1px solid var(--border)", padding:"14px 16px", background:"var(--surface2)" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
                    {(e.remoteId||e.remoteUser||e.remotePass) && (
                      <div style={{ padding:"12px 14px", background:"var(--bg)", borderRadius:8, border:"1px solid var(--border)" }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>🖥 Acesso Remoto</div>
                        {e.remoteUser && <div style={{ fontSize:13, marginBottom:4 }}><span style={{ color:"var(--muted)" }}>Usuário:</span> <strong>{e.remoteUser}</strong></div>}
                        {e.remoteId   && <div style={{ fontSize:13, marginBottom:4 }}><span style={{ color:"var(--muted)" }}>ID:</span> <strong style={{ fontFamily:"monospace" }}>{e.remoteId}</strong></div>}
                        {e.remotePass && <div style={{ fontSize:13 }}><span style={{ color:"var(--muted)" }}>Senha:</span> <strong style={{ fontFamily:"monospace" }}>{e.remotePass}</strong></div>}
                      </div>
                    )}
                    <div style={{ padding:"12px 14px", background:"var(--bg)", borderRadius:8, border:"1px solid var(--border)" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--purple)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>⚙ Hardware</div>
                      {[["Processador",e.processor],["Memória RAM",e.ram],["Armazenamento",e.storage]].map(([k,v])=>v?(<div key={k} style={{ fontSize:13, marginBottom:4 }}><span style={{ color:"var(--muted)" }}>{k}:</span> <strong>{v}</strong></div>):null)}
                    </div>
                    <div style={{ padding:"12px 14px", background:"var(--bg)", borderRadius:8, border:"1px solid var(--border)" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--green)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>💿 Software</div>
                      {[["Sistema Operacional",e.osVersion],["Office",e.office]].map(([k,v])=>v?(<div key={k} style={{ fontSize:13, marginBottom:4 }}><span style={{ color:"var(--muted)" }}>{k}:</span> <strong>{v}</strong></div>):null)}
                    </div>
                    {e.problem && (
                      <div style={{ padding:"12px 14px", background:"var(--bg)", borderRadius:8, border:"1px solid var(--border)" }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--red)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>⚠ Defeito Relatado</div>
                        <div style={{ fontSize:13 }}>{e.problem}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Isolated form — only re-renders itself when user types */}
      {editTarget !== null && (
        <EquipmentForm
          editing={editTarget?.id ? editTarget : null}
          clients={clients}
          onSave={handleSave}
          onClose={closeForm}
        />
      )}
    </div>
  );
}
