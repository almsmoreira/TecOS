import { useState } from "react";
import { Modal, Field, G2, Btn } from "./ui";
import AgentModal from "./AgentModal";

const OS_OPTIONS = ["Windows 11 Home","Windows 11 Pro","Windows 10 Home","Windows 10 Pro","Windows Server 2022","Windows Server 2019","Windows 7","Ubuntu","Debian","macOS Sonoma","macOS Ventura","macOS Monterey","Outro"];
const OFFICE_OPTIONS = ["Microsoft 365","Office 2021","Office 2019","Office 2016","Office 2013","LibreOffice","Não possui","Outro"];
const EQUIPMENT_TYPES = ["Notebook","Desktop","Servidor","Tablet","Smartphone","Impressora","Access Point","Monitor","Nobreak","Switch","Roteador","Teclado","Mouse","Headset","Webcam","Outro"];

const EMPTY = {
  clientId:"", type:"", brand:"", model:"", serial:"", collaborator:"", problem:"",
  remoteUser:"", remoteId:"", remotePass:"", osVersion:"", office:"",
  ram:"", processor:"", storage:"", ipAddress:"", extraInfo:{}
};

// Tipos que TÊM hardware de computador (CPU/RAM/HD/SO)
const PC_TYPES = ["Notebook","Desktop","Servidor","Tablet","Smartphone"];
// Tipos com IP de rede
const NETWORK_TYPES = ["Impressora","Access Point","Switch","Roteador","Servidor"];
// Tipos com acesso remoto
const REMOTE_TYPES = ["Notebook","Desktop","Servidor"];

// Campos extras por tipo
const EXTRA_FIELDS = {
  Impressora: [
    { key:"ip",          label:"IP da Impressora",      placeholder:"192.168.1.100" },
    { key:"toner",       label:"Toner/Cartucho",        placeholder:"HP 85A, Canon 728..." },
    { key:"pages",       label:"Contador de Páginas",   placeholder:"15000" },
    { key:"connection",  label:"Conexão",               placeholder:"USB, Rede, WiFi" },
    { key:"functions",   label:"Funções",               placeholder:"Impressora, Scanner, Copiadora" },
  ],
  "Access Point": [
    { key:"ip",          label:"IP do AP",              placeholder:"192.168.1.1" },
    { key:"ssid",        label:"SSID (Rede WiFi)",      placeholder:"MinhaRede" },
    { key:"wifi_pass",   label:"Senha WiFi",            placeholder:"senha123" },
    { key:"firmware",    label:"Firmware",              placeholder:"v2.1.0" },
    { key:"band",        label:"Frequência",            placeholder:"2.4GHz, 5GHz, Dual Band" },
  ],
  Monitor: [
    { key:"size",        label:"Tamanho (polegadas)",   placeholder:"24, 27, 32..." },
    { key:"resolution",  label:"Resolução",             placeholder:"1920x1080, 2560x1440..." },
    { key:"connection",  label:"Conexão",               placeholder:"HDMI, DisplayPort, VGA" },
    { key:"panel",       label:"Tipo de Painel",        placeholder:"IPS, VA, TN..." },
  ],
  Nobreak: [
    { key:"va",          label:"Capacidade (VA)",       placeholder:"700VA, 1200VA..." },
    { key:"battery",     label:"Vencimento da Bateria", placeholder:"2025-12", type:"month" },
    { key:"autonomy",    label:"Autonomia",             placeholder:"10 min, 30 min..." },
    { key:"outlets",     label:"Nº de Tomadas",         placeholder:"6, 8..." },
  ],
  Switch: [
    { key:"ip",          label:"IP do Switch",          placeholder:"192.168.1.254" },
    { key:"ports",       label:"Nº de Portas",          placeholder:"8, 16, 24, 48" },
    { key:"speed",       label:"Velocidade",            placeholder:"10/100, Gigabit" },
    { key:"managed",     label:"Gerenciável?",          placeholder:"Sim / Não" },
    { key:"firmware",    label:"Firmware",              placeholder:"v1.2.3" },
  ],
  Roteador: [
    { key:"ip",          label:"IP do Roteador",        placeholder:"192.168.1.1" },
    { key:"wan",         label:"IP WAN / PPPoE",        placeholder:"IP externo ou PPPoE" },
    { key:"firmware",    label:"Firmware",              placeholder:"v1.2.3" },
    { key:"provider",    label:"Operadora",             placeholder:"Claro, Vivo, Sercomtel..." },
    { key:"speed",       label:"Velocidade Contratada", placeholder:"100Mbps, 500Mbps..." },
  ],
  Tablet: [
    { key:"imei",        label:"IMEI",                  placeholder:"356938035643809" },
    { key:"chip",        label:"Chip/SIM",              placeholder:"Sim / Não" },
    { key:"capacity",    label:"Capacidade",            placeholder:"32GB, 128GB..." },
  ],
  Smartphone: [
    { key:"imei",        label:"IMEI",                  placeholder:"356938035643809" },
    { key:"number",      label:"Número",                placeholder:"(43) 99999-9999" },
    { key:"chip",        label:"Operadora",             placeholder:"Claro, Vivo, TIM..." },
    { key:"capacity",    label:"Capacidade",            placeholder:"128GB, 256GB..." },
  ],
};

export default function EquipmentForm({ editing, clients, onSave, onClose }) {
  const [form, setForm] = useState(editing ? {
    ...EMPTY, ...editing,
    clientId: String(editing.clientId),
    extraInfo: editing.extraInfo || {}
  } : EMPTY);
  const [showAgent, setShowAgent] = useState(false);

  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));
  const fExtra = k => e => setForm(p => ({...p, extraInfo: {...(p.extraInfo||{}), [k]: e.target.value}}));

  const isPC      = PC_TYPES.includes(form.type);
  const hasNet    = NETWORK_TYPES.includes(form.type);
  const hasRemote = REMOTE_TYPES.includes(form.type);
  const extraFields = EXTRA_FIELDS[form.type] || [];

  const save = () => {
    if (!form.clientId || !form.type.trim()) return;
    onSave({ ...form, clientId: Number(form.clientId) });
  };

  return (
    <Modal title={editing ? "Editar Equipamento" : "Novo Equipamento"} onClose={onClose} wide>

      {/* ── Identificação ── */}
      <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:".6px", marginBottom:10 }}>📋 Identificação</div>
      <Field label="Cliente">
        <select value={form.clientId} onChange={e => setForm(p=>({...p, clientId:e.target.value}))}>
          <option value="">Selecione</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <G2>
        <Field label="Tipo">
          <select value={form.type} onChange={e => setForm(p=>({...p, type:e.target.value, extraInfo:{}}))}>
            <option value="">Selecione</option>
            {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Marca"><input value={form.brand} onChange={f("brand")} placeholder="Dell, HP, Cisco, TP-Link..." /></Field>
        <Field label="Modelo"><input value={form.model} onChange={f("model")} placeholder="Modelo do equipamento" /></Field>
        <Field label="Nº de Série / Patrimônio"><input value={form.serial} onChange={f("serial")} placeholder="SN000000 ou PAT-001" /></Field>
        <Field label="Colaborador / Localização"><input value={form.collaborator} onChange={f("collaborator")} placeholder="Nome ou sala/andar" /></Field>
      </G2>

      {/* ── Hardware (só para PCs) ── */}
      {isPC && (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--purple)", textTransform:"uppercase", letterSpacing:".6px", margin:"16px 0 10px" }}>⚙ Hardware</div>
          <G2>
            <Field label="Processador"><input value={form.processor} onChange={f("processor")} placeholder="Intel Core i5-11400, AMD Ryzen 5..." /></Field>
            <Field label="Memória RAM"><input value={form.ram} onChange={f("ram")} placeholder="8GB DDR4, 16GB DDR5..." /></Field>
            <Field label="Armazenamento"><input value={form.storage} onChange={f("storage")} placeholder="256GB SSD, 1TB HDD..." /></Field>
          </G2>
        </>
      )}

      {/* ── Software (só para PCs) ── */}
      {isPC && (
        <>
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
        </>
      )}

      {/* ── Rede (IP para tipos de rede que não tem campo próprio no extra) ── */}
      {hasNet && !extraFields.find(f => f.key === "ip") && (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", letterSpacing:".6px", margin:"16px 0 10px" }}>🌐 Rede</div>
          <Field label="Endereço IP">
            <input value={form.ipAddress} onChange={f("ipAddress")} placeholder="192.168.1.x" />
          </Field>
        </>
      )}

      {/* ── Campos específicos por tipo ── */}
      {extraFields.length > 0 && (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--yellow)", textTransform:"uppercase", letterSpacing:".6px", margin:"16px 0 10px" }}>
            🔧 Detalhes — {form.type}
          </div>
          <G2>
            {extraFields.map(field => (
              <Field key={field.key} label={field.label}>
                <input
                  type={field.type || "text"}
                  value={form.extraInfo?.[field.key] || ""}
                  onChange={fExtra(field.key)}
                  placeholder={field.placeholder}
                />
              </Field>
            ))}
          </G2>
        </>
      )}

      {/* ── Acesso Remoto (só para PCs) ── */}
      {hasRemote && (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--yellow)", textTransform:"uppercase", letterSpacing:".6px", margin:"16px 0 10px" }}>🖥 Acesso Remoto (RustDesk / TeamViewer)</div>
          <G2>
            <Field label="ID / Código"><input value={form.remoteId} onChange={f("remoteId")} placeholder="123 456 789" /></Field>
            <Field label="Usuário"><input value={form.remoteUser} onChange={f("remoteUser")} placeholder="Usuário do sistema" /></Field>
            <Field label="Senha de Acesso"><input value={form.remotePass} onChange={f("remotePass")} placeholder="senha123" /></Field>
          </G2>
        </>
      )}

      {/* ── Defeito ── */}
      <div style={{ fontSize:11, fontWeight:700, color:"var(--red)", textTransform:"uppercase", letterSpacing:".6px", margin:"16px 0 10px" }}>⚠ Observações / Defeito</div>
      <Field label="Descrição">
        <textarea value={form.problem} onChange={f("problem")} rows={2} style={{ resize:"vertical" }} placeholder="Defeito, observações ou informações adicionais..." />
      </Field>

      {/* ── Agente ── */}
      {editing && isPC && (
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
