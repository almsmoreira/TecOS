import { useState } from "react";
import { RoleBadge, Btn, Card, Modal, Field, G2, Th, Td, Tr } from "../components/ui";

export default function Settings({ users, setUsers, currentUser }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:"", username:"", password:"", role:"tecnico" });

  const openNew  = () => { setEditing(null); setForm({ name:"",username:"",password:"",role:"tecnico" }); setModal(true); };
  const openEdit = u  => { setEditing(u); setForm({...u, password:""}); setModal(true); };
  const save = () => {
    if (!form.name.trim() || !form.username.trim()) return;
    if (!editing && !form.password) { alert("Defina uma senha."); return; }
    // Se senha vazia em edição, mantém a existente (backend detecta hash $2b$)
    const data = { ...form, ...(editing && !form.password ? { password: editing.password } : {}) };
    if (editing) setUsers(us => us.map(u => u.id===editing.id ? {...u,...data} : u));
    else setUsers(us => [...us, { id:Date.now(), ...data }]);
    setModal(false);
  };
  const del = id => {
    if (id===currentUser.id) { alert("Não é possível excluir o usuário logado."); return; }
    if (!window.confirm("Excluir usuário?")) return;
    setUsers(us => us.filter(u => u.id!==id));
  };
  const f = k => e => setForm(p => ({...p,[k]:e.target.value}));

  return (
    <div className="fu">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
        <h2 style={{ fontFamily:"var(--fh)", fontSize:24 }}>Usuários & Técnicos</h2>
        <Btn onClick={openNew}>＋ Novo Usuário</Btn>
      </div>
      <div style={{ padding:"12px 16px", background:"rgba(79,142,247,.08)", border:"1px solid rgba(79,142,247,.2)", borderRadius:8, marginBottom:16, fontSize:13, color:"var(--muted)" }}>
        🔐 As senhas são armazenadas com <strong style={{ color:"var(--text)" }}>hash bcrypt</strong> — nem o banco de dados exibe a senha real.
      </div>
      <Card style={{ padding:0 }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr style={{ borderBottom:"1px solid var(--border)" }}><Th>Nome</Th><Th>Username</Th><Th>Perfil</Th><Th>Ações</Th></tr></thead>
          <tbody>{users.map(u => (
            <Tr key={u.id}>
              <Td style={{ fontWeight:600 }}>{u.name}{u.id===currentUser.id && <span style={{ fontSize:11, color:"var(--muted)", marginLeft:6 }}>(você)</span>}</Td>
              <Td style={{ fontFamily:"monospace", color:"var(--muted)" }}>{u.username}</Td>
              <Td><RoleBadge role={u.role} /></Td>
              <Td>
                <div style={{ display:"flex", gap:5 }}>
                  <Btn small variant="ghost" onClick={() => openEdit(u)}>✏ Editar</Btn>
                  <Btn small variant="danger" disabled={u.id===currentUser.id} onClick={() => del(u.id)}>🗑</Btn>
                </div>
              </Td>
            </Tr>
          ))}</tbody>
        </table>
      </Card>
      {modal && (
        <Modal title={editing?"Editar Usuário":"Novo Usuário"} onClose={() => setModal(false)}>
          <G2>
            <Field label="Nome completo"><input value={form.name} onChange={f("name")} placeholder="Nome" /></Field>
            <Field label="Username"><input value={form.username} onChange={f("username")} placeholder="usuario" /></Field>
            <Field label={editing?"Nova Senha (vazio = manter)":"Senha"}><input type="password" value={form.password} onChange={f("password")} placeholder="••••••••" /></Field>
            <Field label="Perfil">
              <select value={form.role} onChange={f("role")}>
                <option value="admin">Administrador</option>
                <option value="tecnico">Técnico</option>
              </select>
            </Field>
          </G2>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={save}>Salvar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
