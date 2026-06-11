import { useState } from "react";
import { Modal, Field, G2, Btn } from "./ui";

const PRIORITIES = [
  { id:"baixa",   label:"🟢 Baixa",   color:"var(--green)"  },
  { id:"normal",  label:"🔵 Normal",  color:"var(--accent)" },
  { id:"alta",    label:"🟡 Alta",    color:"var(--yellow)" },
  { id:"urgente", label:"🔴 Urgente", color:"var(--red)"    },
];

export default function ChamadoForm({ editing, clients, users, equipment=[], onSave, onClose }) {
  const [form, setForm] = useState(editing ? {
    clientId:      String(editing.client_id || ""),
    equipmentId:   String(editing.equipment_id || ""),
    clientName:    editing.client_name  || "",
    clientPhone:   editing.client_phone || "",
    clientEmail:   editing.client_email || "",
    title:         editing.title        || "",
    description:   editing.description  || "",
    priority:      editing.priority     || "normal",
    status:        editing.status       || "aberto",
    technicianId:  String(editing.technician_id || ""),
    createdAt:     editing.created_at ? String(editing.created_at).slice(0,10) : "",
    updatedAt:     editing.updated_at ? String(editing.updated_at).slice(0,10) : "",
  } : {
    clientId:"", equipmentId:"", clientName:"", clientPhone:"", clientEmail:"",
    title:"", description:"", priority:"normal", status:"aberto", technicianId:"",
    createdAt: new Date().toISOString().slice(0,10),
    updatedAt: new Date().toISOString().slice(0,10),
  });

  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));
  const clientEquip = equipment.filter(e => String(e.clientId) === String(form.clientId));

  const save = () => {
    if (!form.title.trim()) return;
    onSave({
      ...form,
      clientId:     form.clientId ? Number(form.clientId) : null,
      equipmentId:  form.equipmentId ? Number(form.equipmentId) : null,
      technicianId: form.technicianId ? Number(form.technicianId) : null,
    });
  };

  return (
    <Modal title={editing ? `Editar Chamado #${editing.id}` : "Novo Chamado"} onClose={onClose} wide>
      <Field label="Título do Chamado *">
        <input value={form.title} onChange={f("title")} placeholder="Ex: Computador não liga, Sem internet..." />
      </Field>

      <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:".6px", margin:"4px 0 10px" }}>👤 Cliente</div>
      <G2>
        <Field label="Cliente cadastrado">
          <select value={form.clientId} onChange={e => setForm(p=>({...p, clientId:e.target.value, equipmentId:""}))}>
            <option value="">Selecione (opcional)</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Equipamento">
          <select value={form.equipmentId} onChange={f("equipmentId")} disabled={!form.clientId}>
            <option value="">Selecione (opcional)</option>
            {clientEquip.map(e => <option key={e.id} value={e.id}>{[e.type,e.brand,e.model].filter(Boolean).join(' ')}{e.collaborator ? ` — ${e.collaborator}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Nome (se não cadastrado)">
          <input value={form.clientName} onChange={f("clientName")} placeholder="João Silva" />
        </Field>
        <Field label="Telefone">
          <input value={form.clientPhone} onChange={f("clientPhone")} placeholder="43987654321" />
        </Field>
        <Field label="E-mail">
          <input value={form.clientEmail} onChange={f("clientEmail")} placeholder="cliente@email.com" />
        </Field>
      </G2>

      <div style={{ fontSize:11, fontWeight:700, color:"var(--purple)", textTransform:"uppercase", letterSpacing:".6px", margin:"4px 0 10px" }}>⚙ Configurações</div>
      <G2>
        <Field label="Técnico Responsável">
          <select value={form.technicianId} onChange={f("technicianId")}>
            <option value="">Não atribuído</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={f("status")}>
            <option value="aberto">🔴 Aberto</option>
            <option value="em_atendimento">🟡 Em Atendimento</option>
            <option value="resolvido">🟢 Resolvido</option>
            <option value="cancelado">⚫ Cancelado</option>
          </select>
        </Field>
      </G2>

      <Field label="Prioridade">
        <div style={{ display:"flex", gap:8 }}>
          {PRIORITIES.map(p => (
            <button key={p.id} type="button" onClick={() => setForm(f=>({...f,priority:p.id}))} style={{
              flex:1, padding:"8px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:600, transition:"all .15s",
              background: form.priority===p.id ? `${p.color}22` : "var(--surface2)",
              border: `1px solid ${form.priority===p.id ? p.color : "var(--border)"}`,
              color: form.priority===p.id ? p.color : "var(--muted)",
            }}>{p.label}</button>
          ))}
        </div>
      </Field>

      <Field label="Descrição / Detalhes">
        <textarea value={form.description} onChange={f("description")} rows={4} style={{ resize:"vertical" }} placeholder="Descreva o problema com detalhes..." />
      </Field>

      <div style={{ fontSize:11, fontWeight:700, color:"var(--green)", textTransform:"uppercase", letterSpacing:".6px", margin:"4px 0 10px" }}>📅 Datas</div>
      <G2>
        <Field label="Data de Abertura">
          <input type="date" value={form.createdAt || ""} onChange={f("createdAt")} />
        </Field>
        <Field label={form.status === "resolvido" ? "Data de Conclusão" : "Última Atualização"}>
          <input type="date" value={form.updatedAt || ""} onChange={f("updatedAt")} />
        </Field>
      </G2>

      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save}>{editing ? "Salvar" : "Abrir Chamado"}</Btn>
      </div>
    </Modal>
  );
}
