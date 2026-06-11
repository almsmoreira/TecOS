import { useState } from "react";
import { Modal, Field, G2, Btn } from "./ui";

export default function ClientForm({ editing, clients=[], onSave, onClose }) {
  const [form, setForm] = useState(editing || { name:"", phone:"", email:"", cpf:"", address:"", client_type:"avulso", monthly_value:"", billing_day:"1", billing_email:"", parent_id:"" });
  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const save = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Modal title={editing ? "Editar Cliente" : "Novo Cliente"} onClose={onClose}>
      <G2>
        <Field label="Nome"><input value={form.name} onChange={f("name")} placeholder="João Silva" /></Field>
        <Field label="Telefone (com DDD)"><input value={form.phone} onChange={f("phone")} placeholder="43987654321" /></Field>
        <Field label="E-mail"><input value={form.email} onChange={f("email")} placeholder="email@exemplo.com" /></Field>
        <Field label="CPF / CNPJ"><input value={form.cpf} onChange={f("cpf")} placeholder="000.000.000-00" /></Field>
      </G2>
      <Field label="Endereço"><input value={form.address} onChange={f("address")} placeholder="Rua, número, cidade" /></Field>
      <Field label="Empresa Mãe (opcional)">
        <select value={form.parent_id || ""} onChange={f("parent_id")}>
          <option value="">— Cliente independente —</option>
          {clients.filter(c => c.id !== editing?.id && !c.parent_id).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Tipo de Cliente">
        <div style={{ display:"flex", gap:8 }}>
          {["avulso","contrato"].map(t => (
            <button key={t} type="button" onClick={() => setForm(p=>({...p,client_type:t}))} style={{
              flex:1, padding:"10px", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13, transition:"all .15s",
              background: form.client_type===t ? (t==='contrato'?'rgba(62,207,142,.15)':'rgba(123,132,154,.1)') : 'var(--surface2)',
              border: `1px solid ${form.client_type===t ? (t==='contrato'?'rgba(62,207,142,.3)':'var(--border)') : 'var(--border)'}`,
              color: form.client_type===t ? (t==='contrato'?'var(--green)':'var(--text)') : 'var(--muted)',
            }}>
              {t==='contrato' ? '📋 Contrato' : '👤 Avulso'}
            </button>
          ))}
        </div>
      </Field>
      {form.client_type==='contrato' && (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--green)", textTransform:"uppercase", letterSpacing:".6px", margin:"4px 0 10px" }}>💰 Contrato / Mensalidade</div>
          <G2>
            <Field label="Valor Mensal (R$)"><input type="number" value={form.monthly_value||""} onChange={f("monthly_value")} placeholder="0,00" min={0} step={0.01} /></Field>
            <Field label="Dia de Vencimento"><input type="number" value={form.billing_day||"1"} onChange={f("billing_day")} placeholder="1" min={1} max={28} /></Field>
            <Field label="E-mail para cobrança"><input value={form.billing_email||""} onChange={f("billing_email")} placeholder="financeiro@cliente.com" /></Field>
          </G2>
        </>
      )}
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save}>Salvar</Btn>
      </div>
    </Modal>
  );
}
