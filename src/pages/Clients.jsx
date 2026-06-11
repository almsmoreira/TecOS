import { useState } from "react";
import * as XLSX from "xlsx";
import { waLink } from "../constants";
import { Btn, Card, Empty, Th, Td, Tr } from "../components/ui";
import ClientForm from "../components/ClientForm";
import VaultModal from "../components/VaultModal";
import { toggleClientType, deleteClient } from "../api";
import ClientEquipmentModal from "../components/ClientEquipmentModal";

const SORT_OPTIONS = [
  { id:"name_asc",      label:"A → Z"            },
  { id:"name_desc",     label:"Z → A"            },
  { id:"contrato_first",label:"Contrato primeiro" },
  { id:"avulso_first",  label:"Avulso primeiro"   },
  { id:"os_desc",       label:"Mais OS"           },
];

function sortClients(list, sort, os) {
  const arr = [...list];
  let sorted;
  switch (sort) {
    case "name_asc":       sorted = arr.sort((a,b) => a.name.localeCompare(b.name, 'pt-BR')); break;
    case "name_desc":      sorted = arr.sort((a,b) => b.name.localeCompare(a.name, 'pt-BR')); break;
    case "contrato_first": sorted = arr.sort((a,b) => {
      if (a.client_type === b.client_type) return a.name.localeCompare(b.name, 'pt-BR');
      return a.client_type === 'contrato' ? -1 : 1;
    }); break;
    case "avulso_first":   sorted = arr.sort((a,b) => {
      if (a.client_type === b.client_type) return a.name.localeCompare(b.name, 'pt-BR');
      return a.client_type === 'avulso' ? -1 : 1;
    }); break;
    case "os_desc":        sorted = arr.sort((a,b) => os.filter(o=>o.clientId===b.id).length - os.filter(o=>o.clientId===a.id).length); break;
    default:               sorted = arr;
  }
  // Agrupar: pais primeiro, filhos logo após o pai
  const parents = sorted.filter(c => !c.parent_id);
  const childrenMap = {};
  sorted.filter(c => c.parent_id).forEach(c => {
    const pid = String(c.parent_id);
    if (!childrenMap[pid]) childrenMap[pid] = [];
    childrenMap[pid].push(c);
  });
  const result = [];
  parents.forEach(p => {
    result.push(p);
    const kids = childrenMap[String(p.id)] || [];
    kids.forEach(k => result.push({ ...k, _isChild: true }));
  });
  // Adicionar filhos órfãos (caso pai não exista mais)
  sorted.filter(c => c.parent_id && !parents.find(p => String(p.id) === String(c.parent_id))).forEach(c => result.push(c));
  return result;
}

export default function Clients({ clients, setClients, os, equipment, setEquipment }) {
  const [editTarget, setEditTarget] = useState(null);
  const [vaultClient, setVaultClient] = useState(null);
  const [search, setSearch]   = useState("");
  const [sort, setSort]       = useState("name_asc");
  const [typeFilter, setTypeFilter] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [equipClient, setEquipClient] = useState(null);

  const openNew   = () => setEditTarget({});
  const openEdit  = c  => setEditTarget(c);
  const closeForm = () => setEditTarget(null);

  const handleSave = (form) => {
    if (editTarget?.id) setClients(cs => cs.map(c => c.id===editTarget.id ? {...c,...form} : c));
    else setClients(cs => [...cs, { id:Date.now(), ...form }]);
    closeForm();
  };

  const del = id => {
    if (os.some(o => o.clientId===id)) { setConfirmDel({id, blocked:true}); return; }
    setConfirmDel({id, blocked:false});
  };
  const confirmDelete = async () => {
    if (!confirmDel.blocked) { await deleteClient(confirmDel.id); setClients(cs => cs.filter(c => c.id!==confirmDel.id)); }
    setConfirmDel(null);
  };

  const handleToggleType = async (c) => {
    const newType = c.client_type === 'contrato' ? 'avulso' : 'contrato';
    setClients(cs => cs.map(x => x.id===c.id ? {...x, client_type:newType} : x));
    await toggleClientType(c.id, newType);
  };

  const exportExcel = () => {
    const rows = filtered.map(c => ({ Nome:c.name, Tipo:c.client_type||'avulso', Telefone:c.phone, Email:c.email, CPF:c.cpf, "Valor Mensal":c.monthly_value||0, "Nº OS":os.filter(o=>o.clientId===c.id).length }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "clientes.xlsx");
  };

  const base = clients.filter(c =>
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || c.email.toLowerCase().includes(search.toLowerCase())) &&
    (typeFilter === "" || c.client_type === typeFilter)
  );
  const filtered = sortClients(base, sort, os);

  const totalContrato = clients.filter(c=>c.client_type==='contrato').length;
  const totalAvulso   = clients.filter(c=>c.client_type==='avulso').length;

  return (
    <div className="fu">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h2 style={{ fontFamily:"var(--fh)", fontSize:24 }}>Clientes</h2>
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <span style={{ fontSize:12, color:"var(--green)", fontWeight:600 }}>📋 {totalContrato} contratos</span>
            <span style={{ fontSize:12, color:"var(--muted)", fontWeight:600 }}>👤 {totalAvulso} avulsos</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="ghost" onClick={exportExcel}>📥 Excel</Btn>
          <Btn onClick={openNew}>＋ Novo Cliente</Btn>
        </div>
      </div>

      {/* Filters & Sort */}
      <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:180 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Buscar..." />
        </div>
        {/* Type filter buttons */}
        <div style={{ display:"flex", gap:6 }}>
          {[["","Todos"],["contrato","📋 Contrato"],["avulso","👤 Avulso"]].map(([v,l]) => (
            <button key={v} type="button" onClick={() => setTypeFilter(v)} style={{
              padding:"8px 14px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", transition:"all .15s",
              background: typeFilter===v ? "rgba(79,142,247,.15)" : "var(--surface2)",
              border: `1px solid ${typeFilter===v ? "var(--accent)" : "var(--border)"}`,
              color: typeFilter===v ? "var(--accent)" : "var(--muted)",
            }}>{l}</button>
          ))}
        </div>
        {/* Sort */}
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:11, color:"var(--muted)", fontWeight:600, whiteSpace:"nowrap" }}>Ordenar:</span>
          {SORT_OPTIONS.map(s => (
            <button key={s.id} type="button" onClick={() => setSort(s.id)} style={{
              padding:"8px 12px", borderRadius:8, fontSize:11, fontWeight:600, cursor:"pointer", transition:"all .15s",
              background: sort===s.id ? "rgba(155,114,247,.15)" : "var(--surface2)",
              border: `1px solid ${sort===s.id ? "var(--purple)" : "var(--border)"}`,
              color: sort===s.id ? "var(--purple)" : "var(--muted)",
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      <Card style={{ padding:0 }}>
        {filtered.length===0 ? <Empty icon="👥" text="Nenhum cliente" /> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr style={{ borderBottom:"1px solid var(--border)" }}>
              <Th>Nome</Th><Th>Tipo</Th><Th>Telefone</Th><Th>E-mail</Th><Th>Mensalidade</Th><Th>OS</Th><Th>Ações</Th>
            </tr></thead>
            <tbody>{filtered.map(c => {
              const osCount = os.filter(o=>o.clientId===c.id).length;
              return (
                <Tr key={c.id}>
                  <Td style={{ fontWeight:600 }}>{c._isChild && <span style={{ color:"var(--muted)", marginRight:6 }}>↳</span>}{c.name}</Td>
                  <Td>
                    <button type="button" onClick={() => handleToggleType(c)} title="Clique para alternar" style={{
                      background: c.client_type==='contrato' ? 'rgba(62,207,142,.15)' : 'rgba(123,132,154,.1)',
                      border: `1px solid ${c.client_type==='contrato' ? 'rgba(62,207,142,.3)' : 'var(--border)'}`,
                      color: c.client_type==='contrato' ? 'var(--green)' : 'var(--muted)',
                      borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
                    }}>
                      {c.client_type==='contrato' ? '📋 Contrato' : '👤 Avulso'}
                    </button>
                  </Td>
                  <Td style={{ color:"var(--muted)" }}>{c.phone}</Td>
                  <Td style={{ color:"var(--muted)", fontSize:13 }}>{c.email}</Td>
                  <Td style={{ fontSize:13 }}>
                    {c.client_type==='contrato' && c.monthly_value>0
                      ? <span style={{ color:"var(--green)", fontWeight:700 }}>R$ {Number(c.monthly_value).toFixed(2)}/mês</span>
                      : <span style={{ color:"var(--muted)" }}>—</span>}
                  </Td>
                  <Td><span style={{ background:"rgba(79,142,247,.12)", color:"var(--accent)", borderRadius:99, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{osCount}</span></Td>
                  <Td>
                    <div style={{ display:"flex", gap:5 }}>
                      {c.phone && <Btn small variant="success" onClick={() => window.open(waLink(c.phone,`Olá ${c.name}! Entramos em contato da ALMS Tecnologia.`),"_blank")}>💬 WA</Btn>}
                      <Btn small variant="secondary" onClick={() => setEquipClient(c)}>🖥️ {equipment.filter(e=>String(e.clientId)===String(c.id)).length > 0 ? equipment.filter(e=>String(e.clientId)===String(c.id)).length : "+"}</Btn>
                      <Btn small variant="purple" onClick={() => setVaultClient(c)}>🔐 Cofre</Btn>
                      <Btn small variant="ghost" onClick={() => openEdit(c)}>✏ Editar</Btn>
                      <Btn small variant="danger" onClick={() => del(c.id)}>🗑</Btn>
                    </div>
                  </Td>
                </Tr>
              );
            })}</tbody>
          </table>
        )}
      </Card>

      {editTarget !== null && <ClientForm editing={editTarget?.id ? editTarget : null} clients={clients} onSave={handleSave} onClose={closeForm} />}
      {vaultClient && <VaultModal client={vaultClient} onClose={() => setVaultClient(null)} />}
      {equipClient && <ClientEquipmentModal client={equipClient} equipment={equipment} setEquipment={setEquipment} os={os} onClose={() => setEquipClient(null)} />}

      {confirmDel !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:28, maxWidth:340, width:"100%", margin:16, textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>{confirmDel.blocked ? "⚠️" : "🗑"}</div>
            <div style={{ fontFamily:"var(--fh)", fontSize:17, fontWeight:700, marginBottom:8 }}>{confirmDel.blocked ? "Não é possível excluir" : "Excluir cliente?"}</div>
            <div style={{ fontSize:13, color:"var(--muted)", marginBottom:20 }}>{confirmDel.blocked ? "Este cliente possui Ordens de Serviço vinculadas." : "Esta ação não pode ser desfeita."}</div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button type="button" onClick={() => setConfirmDel(null)} style={{ background:"transparent", border:"1px solid var(--border)", color:"var(--muted)", padding:"9px 20px", borderRadius:8, cursor:"pointer", fontWeight:600 }}>Fechar</button>
              {!confirmDel.blocked && <button type="button" onClick={confirmDelete} style={{ background:"#e55b5b", color:"#fff", border:"none", padding:"9px 20px", borderRadius:8, cursor:"pointer", fontWeight:600 }}>Excluir</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
