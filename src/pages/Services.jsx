import { useState, useEffect } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import { Btn, Card, Modal, Field } from "../components/ui";

const CATEGORIES = ["Manutenção", "Formatação", "Rede", "Suporte Remoto", "Instalação", "Outros"];

const DEFAULTS = [
  { name:"Formatação e Reinstalação Windows", category:"Formatação", default_price:150 },
  { name:"Manutenção Preventiva", category:"Manutenção", default_price:80 },
  { name:"Remoção de Vírus/Malware", category:"Manutenção", default_price:100 },
  { name:"Troca de HD por SSD", category:"Manutenção", default_price:60 },
  { name:"Limpeza Interna (Hardware)", category:"Manutenção", default_price:70 },
  { name:"Configuração de Rede", category:"Rede", default_price:120 },
  { name:"Suporte Remoto (hora)", category:"Suporte Remoto", default_price:80 },
  { name:"Instalação de Programas", category:"Instalação", default_price:50 },
  { name:"Backup de Dados", category:"Manutenção", default_price:60 },
  { name:"Configuração de Email", category:"Instalação", default_price:50 },
];

const empty = () => ({ name:"", description:"", default_price:"", category:"Manutenção", active:true });

export default function Services() {
  const [services, setServices] = useState([]);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(empty());
  const [editing, setEditing]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [catFilter, setCat]     = useState("Todos");

  const load = () => apiGet("/api/services").then(d => { setServices(d||[]); setLoading(false); });
  useEffect(() => { load(); }, []);

  const openNew  = () => { setForm(empty()); setEditing(null); setModal(true); };
  const openEdit = s => { setForm({ ...s, default_price: s.default_price||"" }); setEditing(s.id); setModal(true); };

  const save = async () => {
    const payload = { ...form, default_price: parseFloat(form.default_price)||0 };
    if (editing) await apiPut(`/api/services/${editing}`, payload);
    else         await apiPost("/api/services", payload);
    setModal(false); load();
  };

  const remove = async id => {
    if (!window.confirm("Excluir serviço?")) return;
    await apiDelete(`/api/services/${id}`);
    load();
  };

  const importDefaults = async () => {
    if (!window.confirm(`Importar ${DEFAULTS.length} serviços padrão?`)) return;
    for (const s of DEFAULTS) await apiPost("/api/services", { ...s, active:true });
    load();
  };

  const toggle = async s => {
    await apiPut(`/api/services/${s.id}`, { ...s, active: !s.active });
    load();
  };

  const cats = ["Todos", ...CATEGORIES];
  const filtered = services.filter(s => {
    const matchCat = catFilter === "Todos" || s.category === catFilter;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:700 }}>🛠️ Catálogo de Serviços</h2>
          <div style={{ color:"var(--muted)", fontSize:13, marginTop:2 }}>{services.length} serviço(s) cadastrado(s)</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {services.length === 0 && (
            <Btn onClick={importDefaults} variant="secondary">⬇️ Importar Padrões</Btn>
          )}
          <Btn onClick={openNew}>+ Novo Serviço</Btn>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input
          placeholder="Buscar serviço..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding:"8px 12px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:13, flex:1, minWidth:200 }}
        />
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            padding:"8px 14px", borderRadius:8, fontSize:13, cursor:"pointer",
            background: catFilter===c ? "var(--accent)" : "var(--surface)",
            color: catFilter===c ? "#fff" : "var(--muted)",
            border: "1px solid var(--border)", fontWeight: catFilter===c ? 600 : 400
          }}>{c}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color:"var(--muted)", padding:32, textAlign:"center" }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card style={{ textAlign:"center", padding:48, color:"var(--muted)" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🛠️</div>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>Nenhum serviço encontrado</div>
          <div style={{ fontSize:13, marginBottom:20 }}>Crie seu catálogo ou importe os serviços padrão</div>
          {services.length === 0 && <Btn onClick={importDefaults}>⬇️ Importar 10 Serviços Padrão</Btn>}
        </Card>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:12 }}>
          {filtered.map(s => (
            <Card key={s.id} style={{ opacity: s.active ? 1 : 0.55 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>{s.name}</div>
                  <span style={{ fontSize:11, background:"rgba(79,142,247,.15)", color:"var(--accent)", padding:"2px 8px", borderRadius:12 }}>{s.category}</span>
                </div>
                <div style={{ fontSize:18, fontWeight:700, color:"var(--accent)", marginLeft:12 }}>
                  R$ {parseFloat(s.default_price||0).toFixed(2)}
                </div>
              </div>
              {s.description && <div style={{ fontSize:12, color:"var(--muted)", marginBottom:10 }}>{s.description}</div>}
              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                <Btn onClick={() => openEdit(s)} variant="secondary" style={{ flex:1, fontSize:12, padding:"5px 0" }}>✏️ Editar</Btn>
                <Btn onClick={() => toggle(s)} variant="secondary" style={{ fontSize:12, padding:"5px 10px" }}>{s.active ? "⏸" : "▶️"}</Btn>
                <Btn onClick={() => remove(s.id)} variant="danger" style={{ fontSize:12, padding:"5px 10px" }}>🗑</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={editing ? "Editar Serviço" : "Novo Serviço"} onClose={() => setModal(false)}>
          <Field label="Nome do Serviço">
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
              placeholder="Ex: Formatação Windows" autoFocus
              style={{ width:"100%", padding:"8px 10px", borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:14 }} />
          </Field>
          <Field label="Categoria">
            <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}
              style={{ width:"100%", padding:"8px 10px", borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:14 }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Preço Padrão (R$)">
            <input type="number" value={form.default_price} onChange={e => setForm(f=>({...f,default_price:e.target.value}))}
              placeholder="0.00"
              style={{ width:"100%", padding:"8px 10px", borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:14 }} />
          </Field>
          <Field label="Descrição (opcional)">
            <textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))}
              placeholder="Descreva o serviço..." rows={3}
              style={{ width:"100%", padding:"8px 10px", borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:14, resize:"vertical" }} />
          </Field>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <Btn onClick={save} style={{ flex:1 }}>💾 Salvar</Btn>
            <Btn onClick={() => setModal(false)} variant="secondary">Cancelar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
