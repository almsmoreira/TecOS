import { useState } from "react";
import OSPhotos from "./OSPhotos";
import { STATUS, today, nowStr } from "../constants";
import { Modal, Field, G2, Btn, Tabs } from "./ui";

function HistList({ history }) {
  if (!history?.length) return <div style={{ textAlign:"center", padding:"40px 0", color:"var(--muted)" }}>Sem histórico</div>;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {[...history].reverse().map((h,i) => (
        <div key={i} style={{ display:"flex", gap:12, padding:"12px 14px", background:"var(--surface2)", borderRadius:8, border:"1px solid var(--border)" }}>
          <div style={{ fontSize:18 }}>{h.action.includes("criada")?"🆕":h.action.includes("Status")?"🔄":"✏️"}</div>
          <div>
            <div style={{ fontSize:13, fontWeight:600 }}>{h.action}</div>
            <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{h.detail}</div>
            <div style={{ fontSize:11, color:"var(--muted)", marginTop:3 }}>👤 {h.user} · {h.date}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OSForm({ editing, clients, equipment, users, currentUser, services=[], onSave, onClose }) {
  const [tab, setTab] = useState("dados");
  const [showTemplates, setShowTemplates] = useState(false);
  const [form, setForm] = useState(editing
    ? {...editing, clientId:String(editing.clientId), equipmentId:String(editing.equipmentId||""), technicianId:String(editing.technicianId||"")}
    : { clientId:"", equipmentId:"", status:"orcamento", description:"", budget:"", technicianNotes:"", technicianId:String(currentUser.id), createdAt: new Date().toISOString().slice(0,10), updatedAt: new Date().toISOString().slice(0,10) }
  );

  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const applyTemplate = (s) => {
    setForm(p => ({
      ...p,
      description: s.description ? s.name + "\n\n" + s.description : s.name,
      budget: s.default_price || p.budget,
    }));
    setShowTemplates(false);
  };

  const applyService = (s) => {
    setForm(p => ({
      ...p,
      description: s.description ? s.name + "\n\n" + s.description : s.name,
      budget: s.default_price || p.budget,
    }));
  };
  const clientEquip = equipment.filter(e => e.clientId === Number(form.clientId));

  const save = () => {
    if (!form.clientId || !form.description.trim()) return;
    const data = {
      ...form,
      clientId: Number(form.clientId),
      equipmentId: Number(form.equipmentId)||null,
      budget: Number(form.budget)||0,
      technicianId: Number(form.technicianId)||null,
    };
    if (editing) {
      const newH = [...(editing.history||[])];
      if (editing.status !== data.status)
        newH.push({ date:nowStr(), user:currentUser.username, action:"Status alterado", detail:`${STATUS[editing.status]?.label} → ${STATUS[data.status]?.label}` });
      else
        newH.push({ date:nowStr(), user:currentUser.username, action:"OS editada", detail:`Valor: R$ ${data.budget.toFixed(2)}` });
      onSave({...data, updatedAt:data.updatedAt||today(), history:newH});
    } else {
      onSave({...data, createdAt:data.createdAt||today(), updatedAt:data.updatedAt||today(), history:[{date:nowStr(),user:currentUser.username,action:"OS criada",detail:`Status: ${STATUS[data.status]?.label}`}]});
    }
  };

  return (
    <Modal title={editing ? `Editar OS #${editing.id}` : "Nova OS"} onClose={onClose} wide>
      {editing && (
        <Tabs
          tabs={[{id:"dados",label:"📋 Dados"},{id:"historico",label:`🕒 Histórico (${editing.history?.length||0})`},{id:"fotos",label:"📷 Fotos"}]}
          active={tab}
          onChange={setTab}
        />
      )}
      {tab === "dados" && (
        <>
          <G2>
            <Field label="Cliente">
              <select value={form.clientId} onChange={e => setForm(p=>({...p,clientId:e.target.value,equipmentId:""}))}>
                <option value="">Selecione</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Equipamento">
              <select value={form.equipmentId} onChange={f("equipmentId")} disabled={!form.clientId}>
                <option value="">Selecione</option>
                {clientEquip.map(e => <option key={e.id} value={e.id}>{[e.type,e.brand,e.model].filter(Boolean).join(' ')}{e.collaborator ? ` — ${e.collaborator}` : ''}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={f("status")}>
                {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Técnico Responsável">
              <select value={form.technicianId} onChange={f("technicianId")}>
                <option value="">Selecione</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
          </G2>
          {/* Templates */}
          <div style={{ marginBottom:12 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:".5px" }}>📋 Serviço do Catálogo</span>
              <button type="button" onClick={() => setShowTemplates(o => !o)} style={{ fontSize:11, padding:"3px 10px", borderRadius:6, border:"1px solid var(--border)", background:"var(--surface2)", color:"var(--muted)", cursor:"pointer" }}>
                {showTemplates ? "▲ Fechar" : "▼ Selecionar template"}
              </button>
            </div>
            {showTemplates && services.filter(s => s.active).length === 0 && (
              <div style={{ fontSize:12, color:"var(--muted)", padding:"8px 12px", background:"var(--surface2)", borderRadius:8 }}>Nenhum serviço no catálogo. Cadastre em Serviços.</div>
            )}
            {showTemplates && services.filter(s => s.active).length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:6, padding:"10px", background:"var(--surface2)", borderRadius:8, border:"1px solid var(--border)" }}>
                {services.filter(s => s.active).map(s => (
                  <button key={s.id} type="button" onClick={() => applyTemplate(s)} style={{
                    padding:"8px 10px", borderRadius:7, border:"1px solid var(--border)",
                    background:"var(--bg)", cursor:"pointer", textAlign:"left", transition:"all .15s", color:"var(--text)",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="var(--accent)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}
                  >
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{s.name}</div>
                    <div style={{ fontSize:11, color:"var(--green)", fontWeight:700 }}>R$ {parseFloat(s.default_price||0).toFixed(2)}</div>
                    <div style={{ fontSize:10, color:"var(--muted)" }}>{s.category}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Field label="Valor (R$)">
            <input type="number" value={form.budget} onChange={f("budget")} placeholder="0,00" min={0} step={0.01} />
          </Field>
          <Field label="Descrição do Serviço">
            <textarea value={form.description} onChange={f("description")} rows={3} placeholder="Descreva o serviço..." style={{ resize:"vertical" }} />
          </Field>
          <Field label="Notas do Técnico">
            <textarea value={form.technicianNotes} onChange={f("technicianNotes")} rows={2} placeholder="Observações internas..." style={{ resize:"vertical" }} />
          </Field>
          <G2>
            <Field label="📅 Data de Abertura">
              <input type="date" value={form.createdAt || ""} onChange={f("createdAt")} />
            </Field>
            <Field label={form.status === "concluido" ? "✅ Data de Conclusão" : "🔄 Última Atualização"}>
              <input type="date" value={form.updatedAt || ""} onChange={f("updatedAt")} />
            </Field>
          </G2>

          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={save}>Salvar OS</Btn>
          </div>
        </>
      )}
      {tab === "historico" && editing && <HistList history={editing.history} />}
      {tab === "fotos" && editing && <OSPhotos osId={editing.id} />}
    </Modal>
  );
}
