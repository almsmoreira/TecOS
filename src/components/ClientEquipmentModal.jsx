import { useState } from "react";
import { Modal, Btn, Card } from "./ui";
import { deleteEquipment } from "../api";
import EquipmentForm from "./EquipmentForm";

function InfoBadge({ label, value }) {
  if (!value) return null;
  return (
    <span style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:6, padding:"2px 8px", fontSize:11, color:"var(--muted)", display:"inline-flex", alignItems:"center", gap:4 }}>
      <span style={{ color:"var(--text)", fontWeight:600 }}>{label}:</span> {value}
    </span>
  );
}

export default function ClientEquipmentModal({ client, equipment, setEquipment, os, onClose }) {
  const [editTarget, setEditTarget] = useState(null);
  const [expanded, setExpanded]     = useState(null);

  const clientEquip = equipment.filter(e => String(e.clientId) === String(client.id));

  const handleSave = (data) => {
    if (editTarget?.id) {
      setEquipment(es => es.map(e => e.id === editTarget.id ? {...e, ...data} : e));
    } else {
      setEquipment(es => [...es, { id:Date.now(), ...data }]);
    }
    setEditTarget(null);
  };

  const del = async (e) => {
    if (os.some(o => o.equipmentId === e.id)) { alert("Equipamento possui OS vinculadas."); return; }
    await deleteEquipment(e.id);
    setEquipment(es => es.filter(x => x.id !== e.id));
  };

  const icon = (type) => {
    const t = type?.toLowerCase() || "";
    if (t.includes("note") || t.includes("laptop")) return "💻";
    if (t.includes("smart") || t.includes("cel"))   return "📱";
    return "🖥️";
  };

  return (
    <>
      <Modal title={`🖥️ Equipamentos — ${client.name}`} onClose={onClose} wide>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ fontSize:13, color:"var(--muted)" }}>{clientEquip.length} equipamento(s) cadastrado(s)</span>
          <Btn onClick={() => setEditTarget({ clientId: client.id })}>＋ Novo Equipamento</Btn>
        </div>

        {clientEquip.length === 0 ? (
          <div style={{ textAlign:"center", padding:"48px 0", color:"var(--muted)" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🖥️</div>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:8 }}>Nenhum equipamento</div>
            <div style={{ fontSize:13, marginBottom:20 }}>Cadastre o primeiro equipamento deste cliente</div>
            <Btn onClick={() => setEditTarget({ clientId: client.id })}>＋ Adicionar Equipamento</Btn>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {clientEquip.map(e => {
              const isExpanded = expanded === e.id;
              return (
                <Card key={e.id} style={{ padding:0, overflow:"hidden" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }} onClick={() => setExpanded(isExpanded ? null : e.id)}>
                    <div style={{ width:36, height:36, borderRadius:8, background:"rgba(79,142,247,.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                      {icon(e.type)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>
                        {[e.type, e.brand, e.model].filter(Boolean).join(" ")}
                        {e.collaborator && <span style={{ fontSize:12, color:"var(--accent)", fontWeight:400, marginLeft:8 }}>👤 {e.collaborator}</span>}
                      </div>
                      <div style={{ fontSize:12, color:"var(--muted)", marginTop:2, display:"flex", gap:6, flexWrap:"wrap" }}>
                        {e.serial && <span>S/N: {e.serial}</span>}
                        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:4 }}>
                          <InfoBadge label="OS" value={e.osVersion} />
                          <InfoBadge label="RAM" value={e.ram} />
                          <InfoBadge label="CPU" value={e.processor} />
                          <InfoBadge label="HD" value={e.storage} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                      <Btn small variant="ghost" onClick={ev => { ev.stopPropagation(); setEditTarget(e); }}>✏ Editar</Btn>
                      <Btn small variant="danger" onClick={ev => { ev.stopPropagation(); del(e); }}>🗑</Btn>
                      <span style={{ color:"var(--muted)", fontSize:14, padding:"0 4px" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop:"1px solid var(--border)", padding:"12px 14px", background:"var(--surface2)" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:10 }}>
                        {(e.remoteId || e.remoteUser || e.remotePass) && (
                          <div style={{ padding:"10px 12px", background:"var(--bg)", borderRadius:8, border:"1px solid var(--border)" }}>
                            <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:6 }}>🖥 Acesso Remoto</div>
                            {e.remoteUser && <div style={{ fontSize:12, marginBottom:3 }}><span style={{ color:"var(--muted)" }}>Usuário:</span> <strong>{e.remoteUser}</strong></div>}
                            {e.remoteId   && <div style={{ fontSize:12, marginBottom:3 }}><span style={{ color:"var(--muted)" }}>ID:</span> <strong style={{ fontFamily:"monospace" }}>{e.remoteId}</strong></div>}
                            {e.remotePass && <div style={{ fontSize:12 }}><span style={{ color:"var(--muted)" }}>Senha:</span> <strong style={{ fontFamily:"monospace" }}>{e.remotePass}</strong></div>}
                          </div>
                        )}
                        <div style={{ padding:"10px 12px", background:"var(--bg)", borderRadius:8, border:"1px solid var(--border)" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--purple)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:6 }}>⚙ Hardware</div>
                          {[["Processador",e.processor],["RAM",e.ram],["Armazenamento",e.storage]].map(([k,v]) => v ? (
                            <div key={k} style={{ fontSize:12, marginBottom:3 }}><span style={{ color:"var(--muted)" }}>{k}:</span> <strong>{v}</strong></div>
                          ) : null)}
                        </div>
                        <div style={{ padding:"10px 12px", background:"var(--bg)", borderRadius:8, border:"1px solid var(--border)" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--green)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:6 }}>💿 Software</div>
                          {[["Sistema",e.osVersion],["Office",e.office]].map(([k,v]) => v ? (
                            <div key={k} style={{ fontSize:12, marginBottom:3 }}><span style={{ color:"var(--muted)" }}>{k}:</span> <strong>{v}</strong></div>
                          ) : null)}
                        </div>
                        {e.problem && (
                          <div style={{ padding:"10px 12px", background:"var(--bg)", borderRadius:8, border:"1px solid var(--border)" }}>
                            <div style={{ fontSize:11, fontWeight:700, color:"var(--red)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:6 }}>⚠ Defeito</div>
                            <div style={{ fontSize:12 }}>{e.problem}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Modal>

      {editTarget !== null && (
        <EquipmentForm
          editing={editTarget?.id ? editTarget : null}
          clients={[client]}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
          lockedClient={client}
        />
      )}
    </>
  );
}
