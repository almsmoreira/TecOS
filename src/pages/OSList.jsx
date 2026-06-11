import { useState } from "react";
import * as XLSX from "xlsx";
import { STATUS, waLink, today, nowStr } from "../constants";
import { deleteOS } from "../api";
import { Badge, Btn, Card, Modal, Empty, Tabs, Th, Td, Tr } from "../components/ui";
import PrintOS from "../components/PrintOS";
import OSForm from "../components/OSForm";

export default function OSList({ os, setOs, clients, equipment, users, currentUser, services=[] }) {
  const [editTarget, setEditTarget] = useState(null);
  const [detailOS, setDetailOS]     = useState(null);
  const [printOS,  setPrintOS]      = useState(null);
  const [search,   setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTech,   setFilterTech]   = useState("");
  const [detailTab, setDetailTab]   = useState("dados");

  const openNew   = ()  => { setEditTarget({}); };
  const openEdit  = (o) => { setEditTarget(o); };
  const closeForm = ()  => setEditTarget(null);

  const handleSave = (data) => {
    if (editTarget?.id) {
      setOs(list => list.map(o => o.id === editTarget.id ? { ...o, ...data } : o));
    } else {
      const nextId = os.length > 0 ? Math.max(...os.map(o => Number(o.id) || 0)) + 1 : 6418;
      setOs(list => [...list, { id: nextId, ...data }]);
    }
    closeForm();
    setDetailOS(null);
  };

  const [confirmDel, setConfirmDel] = useState(null);

  const del = (id) => setConfirmDel(id);
  const confirmDelete = async () => {
    await deleteOS(confirmDel);
    setOs(list => list.filter(o => o.id !== confirmDel));
    setConfirmDel(null);
  };

  const exportExcel = () => {
    const rows = filtered.map(o => {
      const c    = clients.find(c => c.id === o.clientId);
      const eq   = equipment.find(e => e.id === o.equipmentId);
      const tech = users.find(u => u.id === o.technicianId);
      return { "Nº OS": o.id, Cliente: c?.name, Equipamento: eq ? `${eq.brand} ${eq.model}` : "", Status: STATUS[o.status]?.label, Técnico: tech?.name, Descrição: o.description, "Valor R$": Number(o.budget).toFixed(2), Abertura: o.createdAt, Atualizado: o.updatedAt };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OS");
    XLSX.writeFile(wb, "ordens-de-servico.xlsx");
  };

  const filtered = os.filter(o => {
    const c = clients.find(c => c.id === o.clientId);
    const q = search.toLowerCase();
    return (
      (String(o.id).includes(q) || o.description.toLowerCase().includes(q) || c?.name?.toLowerCase().includes(q)) &&
      (filterStatus === "" || o.status === filterStatus) &&
      (filterTech   === "" || String(o.technicianId) === filterTech)
    );
  }).sort((a, b) => b.id - a.id);

  // ── Print view ──────────────────────────────────────────────────────────
  if (printOS) {
    const c    = clients.find(c => c.id === printOS.clientId);
    const eq   = equipment.find(e => e.id === printOS.equipmentId);
    const tech = users.find(u => u.id === printOS.technicianId);
    return <PrintOS os={printOS} client={c} equip={eq} tech={tech} onClose={() => setPrintOS(null)} />;
  }

  // ── HistList ─────────────────────────────────────────────────────────────
  const HistList = ({ history }) => {
    if (!history?.length) return <Empty icon="🕒" text="Sem histórico" />;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {[...history].reverse().map((h, i) => (
          <div key={i} style={{ display:"flex", gap:12, padding:"12px 14px", background:"var(--surface2)", borderRadius:8, border:"1px solid var(--border)" }}>
            <div style={{ fontSize:18 }}>{h.action.includes("criada") ? "🆕" : h.action.includes("Status") ? "🔄" : "✏️"}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:600 }}>{h.action}</div>
              <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{h.detail}</div>
              <div style={{ fontSize:11, color:"var(--muted)", marginTop:3 }}>👤 {h.user} · {h.date}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fu">
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontFamily:"var(--fh)", fontSize:24 }}>Ordens de Serviço</h2>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="ghost" onClick={exportExcel}>📥 Excel</Btn>
          <Btn onClick={openNew}>＋ Nova OS</Btn>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:200 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Buscar por nº, cliente ou descrição..." />
        </div>
        <div style={{ width:160 }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ width:160 }}>
          <select value={filterTech} onChange={e => setFilterTech(e.target.value)}>
            <option value="">Todos técnicos</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <Card style={{ padding:0 }}>
        {filtered.length === 0
          ? <Empty icon="📋" text="Nenhuma OS encontrada" />
          : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--border)" }}>
                  <Th>Nº OS</Th><Th>Cliente</Th><Th>Equipamento</Th><Th>Técnico</Th><Th>Status</Th><Th>Valor</Th><Th>Data</Th><Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const c    = clients.find(c => c.id === o.clientId);
                  const eq   = equipment.find(e => e.id === o.equipmentId);
                  const tech = users.find(u => u.id === o.technicianId);
                  return (
                    <Tr key={o.id} onClick={() => { setDetailOS(o); setDetailTab("dados"); }}>
                      <Td style={{ color:"var(--accent)", fontWeight:700 }}>#{o.id}</Td>
                      <Td style={{ fontWeight:500 }}>{c?.name || "—"}</Td>
                      <Td style={{ color:"var(--muted)", fontSize:13 }}>{eq ? `${eq.brand} ${eq.model}` : "—"}</Td>
                      <Td style={{ color:"var(--muted)", fontSize:13 }}>{tech?.name || "—"}</Td>
                      <Td><Badge status={o.status} /></Td>
                      <Td style={{ fontWeight:600 }}>R$ {Number(o.budget).toFixed(2)}</Td>
                      <Td style={{ color:"var(--muted)", fontSize:12 }}>{o.createdAt}</Td>
                      <Td onClick={e => e.stopPropagation()}>
                        <div style={{ display:"flex", gap:4 }}>
                          <Btn small variant="success" onClick={() => setPrintOS(o)}>🖨</Btn>
                          {c?.phone && (
                            <Btn small variant="yellow" onClick={() => window.open(waLink(c.phone, `Olá ${c?.name}! Sua OS #${o.id} está: *${STATUS[o.status]?.label}*. Valor: R$ ${Number(o.budget).toFixed(2)}.`), "_blank")}>💬</Btn>
                          )}
                          <Btn small variant="ghost" onClick={() => openEdit(o)}>✏</Btn>
                          <Btn small variant="danger" onClick={() => del(o.id)}>🗑</Btn>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </Card>

      {/* Isolated OS Form — only re-renders itself on typing */}
      {editTarget !== null && (
        <OSForm
          editing={editTarget?.id ? editTarget : null}
          clients={clients}
          equipment={equipment}
          users={users}
          currentUser={currentUser}
          services={services}
          onSave={handleSave}
          onClose={closeForm}
        />
      )}

      {/* Detail Modal */}
      {detailOS && editTarget === null && (() => {
        const o    = os.find(x => x.id === detailOS.id) || detailOS;
        const c    = clients.find(c => c.id === o.clientId);
        const eq   = equipment.find(e => e.id === o.equipmentId);
        const tech = users.find(u => u.id === o.technicianId);
        return (
          <Modal title={`OS #${o.id} — Detalhes`} onClose={() => setDetailOS(null)} wide>
            <Tabs
              tabs={[{ id:"dados", label:"📋 Dados" }, { id:"historico", label:`🕒 Histórico (${o.history?.length || 0})` }]}
              active={detailTab}
              onChange={setDetailTab}
            />
            {detailTab === "dados" && (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                  {[["Cliente",c?.name],["Telefone",c?.phone],["Equipamento",eq?`${eq.brand} ${eq.model}`:"—"],["Nº Série",eq?.serial],["Técnico",tech?.name],["Valor",`R$ ${Number(o.budget).toFixed(2)}`],["Criado",o.createdAt],["Atualizado",o.updatedAt]].map(([k,v]) => (
                    <div key={k} style={{ padding:"10px 14px", background:"var(--surface2)", borderRadius:8, border:"1px solid var(--border)" }}>
                      <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", marginBottom:3 }}>{k}</div>
                      <div style={{ fontSize:14, fontWeight:500 }}>{v || "—"}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom:14, padding:"12px 14px", background:"var(--surface2)", borderRadius:8, border:"1px solid var(--border)" }}>
                  <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>Alterar Status</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {Object.entries(STATUS).map(([k,v]) => (
                      <button key={k} type="button" onClick={() => {
                        const newH = [...(o.history||[])];
                        newH.push({ date: nowStr(), user: currentUser.username, action: "Status alterado", detail: `${STATUS[o.status]?.label} → ${STATUS[k]?.label}` });
                        const updated = { ...o, status: k, updatedAt: today(), history: newH };
                        setOs(list => list.map(x => x.id === o.id ? updated : x));
                        setDetailOS(updated);
                      }} style={{
                        padding:"6px 14px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", transition:"all .15s",
                        background: o.status===k ? `${v.color}22` : "var(--bg)",
                        border: `1px solid ${o.status===k ? v.color : "var(--border)"}`,
                        color: o.status===k ? v.color : "var(--muted)",
                      }}>{v.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ padding:"12px 14px", background:"var(--surface2)", borderRadius:8, marginBottom:8 }}>
                  <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, letterSpacing:".5px", textTransform:"uppercase", marginBottom:4 }}>Descrição</div>
                  <div style={{ fontSize:14 }}>{o.description || "—"}</div>
                </div>
                {o.technicianNotes && (
                  <div style={{ padding:"12px 14px", background:"var(--surface2)", borderRadius:8, marginBottom:12 }}>
                    <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, letterSpacing:".5px", textTransform:"uppercase", marginBottom:4 }}>Notas</div>
                    <div style={{ fontSize:14 }}>{o.technicianNotes}</div>
                  </div>
                )}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <Btn variant="success" onClick={() => { setPrintOS(o); setDetailOS(null); }}>🖨 Gerar PDF</Btn>
                  {c?.phone && (
                    <Btn variant="yellow" onClick={() => window.open(waLink(c.phone, `Olá ${c?.name}! Sua OS #${o.id} está: *${STATUS[o.status]?.label}*. Valor: R$ ${Number(o.budget).toFixed(2)}.`), "_blank")}>💬 WhatsApp</Btn>
                  )}
                  <Btn variant="ghost" onClick={() => { setDetailOS(null); openEdit(o); }}>✏ Editar</Btn>
                </div>
              </>
            )}
            {detailTab === "historico" && <HistList history={o.history} />}
          </Modal>
        );
      })()}

      {/* Confirm delete modal */}
      {confirmDel !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:28, maxWidth:340, width:"100%", margin:16, textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🗑</div>
            <div style={{ fontFamily:"var(--fh)", fontSize:17, fontWeight:700, marginBottom:8 }}>Excluir OS #{confirmDel}?</div>
            <div style={{ fontSize:13, color:"var(--muted)", marginBottom:20 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button type="button" onClick={() => setConfirmDel(null)} style={{ background:"transparent", border:"1px solid var(--border)", color:"var(--muted)", padding:"9px 20px", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:14 }}>Cancelar</button>
              <button type="button" onClick={confirmDelete} style={{ background:"#e55b5b", color:"#fff", border:"none", padding:"9px 20px", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:14 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
