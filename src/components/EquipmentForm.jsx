import { useState } from "react";
import { Modal, Field, G2, Btn } from "./ui";
import AgentModal from "./AgentModal";
import { useState as useStateMod } from "react";

const OS_OPTIONS = ["Windows 11 Home","Windows 11 Pro","Windows 10 Home","Windows 10 Pro","Windows 7","Ubuntu","Debian","macOS Sonoma","macOS Ventura","macOS Monterey","Outro"];
const EQUIPMENT_TYPES = ["Notebook","Desktop","Servidor","Tablet","Smartphone","Impressora","Access Point","Monitor","Teclado","Mouse","Nobreak","Switch","Roteador","Headset","Webcam","Outro"];
const OFFICE_OPTIONS = ["Microsoft 365","Office 2021","Office 2019","Office 2016","Office 2013","LibreOffice","Não possui","Outro"];

const EMPTY = { clientId:"", type:"", brand:"", model:"", serial:"", collaborator:"", problem:"", remoteUser:"", remoteId:"", remotePass:"", osVersion:"", office:"", ram:"", processor:"", storage:"" };

export default function EquipmentForm({ editing, clients, onSave, onClose }) {
  const [form, setForm] = useState(editing ? {...EMPTY,...editing, clientId:String(editing.clientId)} : EMPTY);
  const [showAgent, setShowAgent] = useState(false);
  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const save = () => {
    if (!form.clientId || !form.type.trim()) return;
    onSave({...form, clientId: Number(form.clientId)});
  };

  return (
    <Modal title={editing ? "Editar Equipamento" : "Novo Equipamento"} onClose={onClose} wide>
      <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:".6px", marginBottom:10 }}>📋 Identificação</div>
      <Field label="Cliente">
        <select value={form.clientId} onChange={e => setForm(p=>({...p,clientId:e.target.value}))}>
          <option value="">Selecione</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <G2>
        <Field label="Tipo">
          <select value={form.type} onChange={f("type")}>
            <option value="">Selecione</option>
            {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Marca"><input value={form.brand} onChange={f("brand")} placeholder="Dell, Apple, Samsung..." /></Field>
        <Field label="Modelo"><input value={form.model} onChange={f("model")} placeholder="Inspiron 15, iPhone 14..." /></Field>
        <Field label="Nº de Série"><input value={form.serial} onChange={f("serial")} placeholder="SN000000" /></Field>
        <Field label="Colaborador"><input value={form.collaborator} onChange={f("collaborator")} placeholder="Nome de quem utiliza o equipamento" /></Field>
      </G2>

      <div style={{ fontSize:11, fontWeight:700, color:"var(--purple)", textTransform:"uppercase", letterSpacing:".6px", margin:"16px 0 10px" }}>⚙ Hardware</div>
      <G2>
        <Field label="Processador"><input value={form.processor} onChange={f("processor")} placeholder="Intel Core i5-11400, AMD Ryzen 5..." /></Field>
        <Field label="Memória RAM"><input value={form.ram} onChange={f("ram")} placeholder="8GB, 16GB DDR4..." /></Field>
        <Field label="Armazenamento"><input value={form.storage} onChange={f("storage")} placeholder="256GB SSD, 1TB HDD..." /></Field>
      </G2>

      <div style={{ fontSize:11, fontWeight:700, color:"var(--green)", textTransform:"uppercase", letterSpacing:".6px", margin:"16px 0 10px" }}>💿 Software</div>
      <G2>
        <Field label="Sistema Operacional">
          <select value={form.osVersion} onChange={f("osVersion")}>
            <option value="">Selecione</option>
            {OS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Office / Pacote Office">
          <select value={form.office} onChange={f("office")}>
            <option value="">Selecione</option>
            {OFFICE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      </G2>

      <div style={{ fontSize:11, fontWeight:700, color:"var(--yellow)", textTransform:"uppercase", letterSpacing:".6px", margin:"16px 0 10px" }}>🖥 Acesso Remoto (TeamViewer / RustDesk)</div>
      <G2>
        <Field label="ID / Código"><input value={form.remoteId} onChange={f("remoteId")} placeholder="123 456 789" /></Field>
        <Field label="Usuário"><input value={form.remoteUser} onChange={f("remoteUser")} placeholder="Usuario do sistema" /></Field>
        <Field label="Senha de Acesso"><input value={form.remotePass} onChange={f("remotePass")} placeholder="senha123" /></Field>
      </G2>

      <div style={{ fontSize:11, fontWeight:700, color:"var(--red)", textTransform:"uppercase", letterSpacing:".6px", margin:"16px 0 10px" }}>⚠ Defeito Relatado</div>
      <Field label="Descrição do problema">
        <textarea value={form.problem} onChange={f("problem")} rows={2} style={{ resize:"vertical" }} placeholder="Descreva o problema..." />
      </Field>

      {editing && (
        <div style={{ marginTop:16, padding:"12px 14px", background:"var(--surface2)", borderRadius:8, border:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontWeight:600, fontSize:13 }}>🤖 Agente de Inventário</div>
            <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>Monitoramento automático de hardware e software</div>
          </div>
          <Btn variant="secondary" onClick={() => setShowAgent(true)}>Abrir</Btn>
        </div>
      )}
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:16 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save}>Salvar</Btn>
      </div>
    {showAgent && <AgentModal equipment={editing} onClose={() => setShowAgent(false)} />}
    </Modal>
  );
}
