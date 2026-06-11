import { useState, useEffect, useRef } from "react";
import { getVault, addCredential, updCredential, delCredential, addFile, getFile, delFile } from "../api";

// ── Helpers ─────────────────────────────────────────────────────────────────
function copyText(text, label, setCopied) {
  navigator.clipboard.writeText(text);
  setCopied(label);
  setTimeout(() => setCopied(""), 2000);
}

function fileTypeLabel(t) {
  const m = { qrcode:"QR Code", photo:"Foto", document:"Documento", image:"Imagem" };
  return m[t] || t;
}

function fileTypeIcon(t) {
  const m = { qrcode:"📲", photo:"📷", document:"📄", image:"🖼️" };
  return m[t] || "📎";
}

// ── CopyBtn ──────────────────────────────────────────────────────────────────
function CopyBtn({ text, label, copied, setCopied }) {
  const active = copied === label;
  return (
    <button onClick={() => copyText(text, label, setCopied)} title={`Copiar ${label}`} style={{
      background: active ? "rgba(62,207,142,.15)" : "var(--surface2)",
      border: `1px solid ${active ? "rgba(62,207,142,.3)" : "var(--border)"}`,
      color: active ? "var(--green)" : "var(--muted)",
      borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 4, fontWeight: 600, transition: "all .15s",
    }}>
      {active ? "✓" : "📋"} {active ? "Copiado!" : label}
    </button>
  );
}

// ── CredentialCard ────────────────────────────────────────────────────────────
function CredentialCard({ cred, onEdit, onDelete, copied, setCopied }) {
  const [showPwd, setShowPwd] = useState(false);
  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "14px 16px", position: "relative",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(79,142,247,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔑</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{cred.title}</div>
            {cred.url && <a href={cred.url.startsWith("http") ? cred.url : `https://${cred.url}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>🔗 {cred.url}</a>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={() => onEdit(cred)} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>✏</button>
          <button onClick={() => onDelete(cred.id)} style={{ background: "rgba(229,91,91,.1)", border: "1px solid rgba(229,91,91,.2)", color: "#e55b5b", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>🗑</button>
        </div>
      </div>

      {/* Username */}
      {cred.username && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Usuário</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, background: "var(--bg)", borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: "monospace", border: "1px solid var(--border)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cred.username}</div>
            <CopyBtn text={cred.username} label="usuário" copied={copied} setCopied={setCopied} />
          </div>
        </div>
      )}

      {/* Password */}
      {cred.password && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Senha</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, background: "var(--bg)", borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: "monospace", border: "1px solid var(--border)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {showPwd ? cred.password : "•".repeat(Math.min(cred.password.length, 20))}
            </div>
            <button onClick={() => setShowPwd(v => !v)} title={showPwd ? "Ocultar" : "Mostrar"} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14 }}>
              {showPwd ? "🙈" : "👁"}
            </button>
            <CopyBtn text={cred.password} label="senha" copied={copied} setCopied={setCopied} />
          </div>
        </div>
      )}

      {/* Notes */}
      {cred.notes && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(245,197,66,.06)", border: "1px solid rgba(245,197,66,.15)", borderRadius: 6, fontSize: 12, color: "var(--muted)" }}>
          📝 {cred.notes}
        </div>
      )}
    </div>
  );
}

// ── CredentialForm ────────────────────────────────────────────────────────────
function CredentialForm({ clientId, editing, onSave, onCancel }) {
  const [form, setForm] = useState(editing || { title:"", username:"", password:"", url:"", notes:"" });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const save = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    if (editing) await updCredential(editing.id, form);
    else await addCredential({ clientId, ...form });
    onSave();
  };

  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "var(--accent)" }}>{editing ? "✏ Editar Credencial" : "＋ Nova Credencial"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {[["title","Título (ex: Painel do Servidor)","text"],["username","Usuário / Login","text"],["password","Senha","password"],["url","URL / Site","text"]].map(([k,ph,t]) => (
          <div key={k}>
            <label style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4, display: "block" }}>{ph}</label>
            <input type={t} value={form[k]} onChange={f(k)} placeholder={ph} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, padding: "7px 10px", width: "100%", outline: "none" }} />
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4, display: "block" }}>Observações</label>
        <textarea value={form.notes} onChange={f("notes")} rows={2} placeholder="Notas adicionais..." style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, padding: "7px 10px", width: "100%", outline: "none", resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={loading} style={{ background: "#4f8ef7", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{loading ? "Salvando…" : "Salvar"}</button>
        <button onClick={onCancel} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 7, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
      </div>
    </div>
  );
}

// ── FileGrid ──────────────────────────────────────────────────────────────────
function FileGrid({ files, clientId, onRefresh }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [fileType, setFileType] = useState("qrcode");
  const [viewFile, setViewFile] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Arquivo muito grande. Máximo: 10MB"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      await addFile({ clientId, name: file.name, fileType, data: ev.target.result, mimeType: file.type });
      setUploading(false);
      onRefresh();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const openFile = async (f) => {
    setLoadingFile(true);
    const full = await getFile(f.id);
    setViewFile(full);
    setLoadingFile(false);
  };

  const removeFile = async (id) => {
    if (!window.confirm("Excluir arquivo?")) return;
    await delFile(id);
    onRefresh();
  };

  const download = (f) => {
    const a = document.createElement("a");
    a.href = viewFile?.data || f.data;
    a.download = f.name;
    a.click();
  };

  return (
    <div>
      {/* Upload */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, padding: "12px 14px", background: "var(--surface2)", borderRadius: 10, border: "1px dashed var(--border)" }}>
        <select value={fileType} onChange={e => setFileType(e.target.value)} style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer" }}>
          <option value="qrcode">📲 QR Code (2FA)</option>
          <option value="photo">📷 Foto</option>
          <option value="image">🖼️ Imagem</option>
          <option value="document">📄 Documento</option>
        </select>
        <button onClick={() => inputRef.current?.click()} disabled={uploading} style={{ background: "#4f8ef7", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          {uploading ? "⏳ Enviando…" : "⬆ Enviar Arquivo"}
        </button>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={upload} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>PNG, JPG, PDF • máx 10MB</span>
      </div>

      {/* Grid */}
      {files.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
          <div style={{ fontSize: 14 }}>Nenhum arquivo ainda</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Envie QR codes, fotos ou documentos</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12 }}>
          {files.map(f => (
            <div key={f.id} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", cursor: "pointer" }} onClick={() => openFile(f)}>
              {/* Preview placeholder */}
              <div style={{ height: 100, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>
                {fileTypeIcon(f.file_type)}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>{fileTypeLabel(f.file_type)}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>{f.name}</div>
              </div>
              <div style={{ padding: "0 10px 10px", display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => removeFile(f.id)} style={{ background: "rgba(229,91,91,.1)", border: "1px solid rgba(229,91,91,.2)", color: "#e55b5b", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>🗑 Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {(viewFile || loadingFile) && (
        <div onClick={() => setViewFile(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 20, maxWidth: 600, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            {loadingFile ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>⏳ Carregando...</div>
            ) : viewFile && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{fileTypeIcon(viewFile.file_type)} {viewFile.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{fileTypeLabel(viewFile.file_type)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => download(viewFile)} style={{ background: "rgba(79,142,247,.12)", border: "1px solid rgba(79,142,247,.25)", color: "var(--accent)", borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⬇ Baixar</button>
                    <button onClick={() => setViewFile(null)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                </div>
                {viewFile.data && viewFile.mime_type?.startsWith("image") && (
                  <img src={viewFile.data} alt={viewFile.name} style={{ width: "100%", borderRadius: 8, objectFit: "contain", maxHeight: 500 }} />
                )}
                {viewFile.data && viewFile.mime_type === "application/pdf" && (
                  <iframe src={viewFile.data} style={{ width: "100%", height: 500, borderRadius: 8, border: "none" }} title={viewFile.name} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main VaultModal ───────────────────────────────────────────────────────────
export default function VaultModal({ client, onClose }) {
  const [tab, setTab] = useState("credentials");
  const [credentials, setCredentials] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCred, setEditCred] = useState(null);
  const [copied, setCopied] = useState("");
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    getVault(client.id).then(data => {
      setCredentials(data.credentials || []);
      setFiles(data.files || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [client.id]);

  const handleDelete = async (id) => {
    if (!window.confirm("Excluir credencial?")) return;
    await delCredential(id);
    load();
  };

  const handleSave = () => { setShowForm(false); setEditCred(null); load(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", backdropFilter: "blur(4px)", padding: "40px 16px 20px", overflowY: "auto" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "calc(100vh - 60px)", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1, borderRadius: "16px 16px 0 0" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 22 }}>🔐</div>
              <div>
                <div style={{ fontFamily: "var(--fh)", fontSize: 17, fontWeight: 700 }}>Cofre — {client.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>Credenciais criptografadas com AES-256</div>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "var(--surface2)", border: "none", color: "var(--muted)", width: 30, height: 30, borderRadius: 7, fontSize: 17, cursor: "pointer" }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, padding: "0 24px", borderBottom: "1px solid var(--border)" }}>
          {[{ id:"credentials", label:`🔑 Credenciais (${credentials.length})` }, { id:"files", label:`📁 Arquivos (${files.length})` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "12px 18px", background: "none", border: "none", color: tab===t.id ? "var(--accent)" : "var(--muted)", fontWeight: tab===t.id ? 700 : 400, fontSize: 13, borderBottom: tab===t.id ? "2px solid var(--accent)" : "2px solid transparent", cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>⏳ Carregando cofre...</div>
          ) : tab === "credentials" ? (
            <>
              {/* Search + Add */}
              {!showForm && !editCred && (
                <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                  <div style={{ flex:1, position:"relative" }}>
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="🔍 Buscar por título, usuário ou notas..."
                      style={{ width:"100%", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, color:"var(--text)", fontSize:13, padding:"10px 14px", outline:"none" }}
                    />
                    {search && (
                      <button onClick={() => setSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"transparent", border:"none", color:"var(--muted)", cursor:"pointer", fontSize:16 }}>×</button>
                    )}
                  </div>
                  <button onClick={() => setShowForm(true)} style={{ background:"rgba(79,142,247,.08)", border:"1px dashed rgba(79,142,247,.3)", color:"var(--accent)", borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
                    ＋ Nova
                  </button>
                </div>
              )}

              {/* Form */}
              {(showForm || editCred) && (
                <CredentialForm
                  clientId={client.id}
                  editing={editCred}
                  onSave={handleSave}
                  onCancel={() => { setShowForm(false); setEditCred(null); }}
                />
              )}

              {/* List */}
              {credentials.length === 0 && !showForm ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
                  <div style={{ fontSize: 14 }}>Nenhuma credencial salva</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Adicione usuários, senhas e acessos do cliente</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {credentials.filter(c => {
                    if (!search.trim()) return true;
                    const q = search.toLowerCase();
                    return (c.title||"").toLowerCase().includes(q) || (c.username||"").toLowerCase().includes(q) || (c.notes||"").toLowerCase().includes(q) || (c.url||"").toLowerCase().includes(q);
                  }).map(c => (
                    <CredentialCard
                      key={c.id}
                      cred={c}
                      copied={copied}
                      setCopied={setCopied}
                      onEdit={c => { setEditCred(c); setShowForm(false); }}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <FileGrid files={files} clientId={client.id} onRefresh={load} />
          )}
        </div>
      </div>
    </div>
  );
}
