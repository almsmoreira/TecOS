import { useState, useEffect, useRef } from "react";
import { getVault, addCredential, updCredential, delCredential, addFile, getFile, delFile } from "../api";

// ── Ícones SVG ───────────────────────────────────────────────────────────────
const Icon = {
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  eye: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  eyeOff: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  edit: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  trash: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  key: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
  link: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  zap: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  upload: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  ),
  download: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.83"/>
    </svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  note: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
};

// ── Categorias ────────────────────────────────────────────────────────────────
const CATEGORIES = {
  geral:        { label: "Geral",         color: "#7b849a", bg: "rgba(123,132,154,.15)" },
  remoto:       { label: "Acesso Remoto", color: "#4f8ef7", bg: "rgba(79,142,247,.15)"  },
  email:        { label: "E-mail",        color: "#f5c542", bg: "rgba(245,197,66,.15)"  },
  servidor:     { label: "Servidor",      color: "#e55b5b", bg: "rgba(229,91,91,.15)"   },
  wifi:         { label: "Wi-Fi",         color: "#3ecf8e", bg: "rgba(62,207,142,.15)"  },
  sistema:      { label: "Sistema/ERP",   color: "#9b72f7", bg: "rgba(155,114,247,.15)" },
  site:         { label: "Site/Painel",   color: "#f78c4f", bg: "rgba(247,140,79,.15)"  },
  outro:        { label: "Outro",         color: "#7b849a", bg: "rgba(123,132,154,.15)" },
};

function CategoryBadge({ category }) {
  const cat = CATEGORIES[category] || CATEGORIES.geral;
  return (
    <span style={{ background: cat.bg, color: cat.color, borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "2px 8px", letterSpacing: ".3px" }}>
      {cat.label}
    </span>
  );
}

// ── Gerador de senha forte ────────────────────────────────────────────────────
function generatePassword(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*()_+-=';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => chars[b % chars.length]).join('');
}

// ── Clipboard com timeout ────────────────────────────────────────────────────
function useCopyTimeout(seconds = 30) {
  const [copied, setCopied] = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);
  const countRef = useRef(null);

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setCountdown(seconds);
    clearInterval(countRef.current);
    clearTimeout(timerRef.current);
    countRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(countRef.current);
          navigator.clipboard.writeText('').catch(() => {});
          setCopied("");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  return { copied, countdown, copy };
}

// ── CopyBtn ──────────────────────────────────────────────────────────────────
function CopyBtn({ text, label, copied, countdown, onCopy }) {
  const active = copied === label;
  return (
    <button
      onClick={() => onCopy(text, label)}
      title={`Copiar ${label}`}
      style={{
        background: active ? "rgba(62,207,142,.15)" : "var(--surface2)",
        border: `1px solid ${active ? "rgba(62,207,142,.3)" : "var(--border)"}`,
        color: active ? "var(--green)" : "var(--muted)",
        borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer",
        display: "flex", alignItems: "center", gap: 5, fontWeight: 600,
        transition: "all .15s", whiteSpace: "nowrap", minWidth: 80,
      }}
    >
      {active ? Icon.check : Icon.copy}
      {active ? `${countdown}s` : label}
    </button>
  );
}

// ── CredentialCard ────────────────────────────────────────────────────────────
function CredentialCard({ cred, onEdit, onDelete }) {
  const [showPwd, setShowPwd] = useState(false);
  const { copied, countdown, copy } = useCopyTimeout(30);

  // detecta se username/password parecem hash não descriptografado
  const looksEncrypted = (v) => typeof v === 'string' && v.includes(':') && v.length > 60 && /^[0-9a-f]+:[0-9a-f]+$/.test(v);

  const displayUser = looksEncrypted(cred.username) ? '⚠ erro de descriptografia' : cred.username;
  const displayPass = looksEncrypted(cred.password) ? '⚠ erro de descriptografia' : cred.password;

  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "16px 18px", position: "relative",
      transition: "border-color .15s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(79,142,247,.3)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "rgba(79,142,247,.12)", border: "1px solid rgba(79,142,247,.2)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#4f8ef7",
          }}>
            {Icon.key}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{cred.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <CategoryBadge category={cred.category || 'geral'} />
              {cred.url && (
                <a
                  href={cred.url.startsWith("http") ? cred.url : `https://${cred.url}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
                >
                  {Icon.link} {cred.url.replace(/^https?:\/\//, '').slice(0, 30)}
                </a>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, flexShrink: 0, marginLeft: 8 }}>
          <button
            onClick={() => onEdit(cred)}
            title="Editar"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 7, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", transition: "all .15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
          >
            {Icon.edit}
          </button>
          <button
            onClick={() => onDelete(cred.id)}
            title="Excluir"
            style={{ background: "rgba(229,91,91,.08)", border: "1px solid rgba(229,91,91,.2)", color: "#e55b5b", borderRadius: 7, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", transition: "all .15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(229,91,91,.18)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(229,91,91,.08)"; }}
          >
            {Icon.trash}
          </button>
        </div>
      </div>

      {/* Username */}
      {cred.username && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 5 }}>Usuário</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              flex: 1, background: "var(--bg)", borderRadius: 7, padding: "7px 11px",
              fontSize: 13, fontFamily: "monospace", border: "1px solid var(--border)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              color: looksEncrypted(cred.username) ? "var(--red)" : "var(--text)",
            }}>
              {displayUser}
            </div>
            <CopyBtn text={cred.username} label="usuário" copied={copied} countdown={countdown} onCopy={copy} />
          </div>
        </div>
      )}

      {/* Password */}
      {cred.password && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 5 }}>Senha</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              flex: 1, background: "var(--bg)", borderRadius: 7, padding: "7px 11px",
              fontSize: 13, fontFamily: "monospace", border: "1px solid var(--border)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              color: looksEncrypted(cred.password) ? "var(--red)" : "var(--text)",
            }}>
              {looksEncrypted(cred.password) ? displayPass : (showPwd ? cred.password : "•".repeat(Math.min(cred.password.length, 20)))}
            </div>
            <button
              onClick={() => setShowPwd(v => !v)}
              title={showPwd ? "Ocultar" : "Mostrar"}
              style={{
                background: showPwd ? "rgba(79,142,247,.12)" : "var(--surface2)",
                border: `1px solid ${showPwd ? "rgba(79,142,247,.3)" : "var(--border)"}`,
                color: showPwd ? "var(--accent)" : "var(--muted)",
                borderRadius: 6, padding: "5px 8px", cursor: "pointer",
                display: "flex", alignItems: "center", transition: "all .15s",
              }}
            >
              {showPwd ? Icon.eyeOff : Icon.eye}
            </button>
            <CopyBtn text={cred.password} label="senha" copied={copied} countdown={countdown} onCopy={copy} />
          </div>
        </div>
      )}

      {/* Notes */}
      {cred.notes && !looksEncrypted(cred.notes) && (
        <div style={{
          marginTop: 8, padding: "8px 11px",
          background: "rgba(245,197,66,.05)", border: "1px solid rgba(245,197,66,.15)",
          borderRadius: 7, fontSize: 12, color: "var(--muted)",
          display: "flex", alignItems: "flex-start", gap: 6,
        }}>
          <span style={{ color: "#f5c542", marginTop: 1, flexShrink: 0 }}>{Icon.note}</span>
          {cred.notes}
        </div>
      )}
    </div>
  );
}

// ── CredentialForm ────────────────────────────────────────────────────────────
function CredentialForm({ clientId, editing, onSave, onCancel }) {
  const [form, setForm] = useState(editing || { title: "", username: "", password: "", url: "", notes: "", category: "geral" });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const genPassword = () => {
    const pwd = generatePassword(16);
    setForm(p => ({ ...p, password: pwd }));
    setShowPwd(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    if (editing) await updCredential(editing.id, form);
    else await addCredential({ clientId, ...form });
    onSave();
  };

  const inputStyle = {
    background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 7,
    color: "var(--text)", fontSize: 13, padding: "8px 11px", width: "100%",
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: ".5px", marginBottom: 5, display: "block",
  };

  return (
    <div style={{ background: "var(--surface2)", border: "1px solid rgba(79,142,247,.25)", borderRadius: 12, padding: 18, marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}>
        {editing ? Icon.edit : Icon.plus}
        {editing ? "Editar Credencial" : "Nova Credencial"}
      </div>

      {/* Título + Categoria */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Título</label>
          <input value={form.title} onChange={f("title")} placeholder="Ex: Painel do Servidor" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Categoria</label>
          <select value={form.category || "geral"} onChange={f("category")} style={{ ...inputStyle, cursor: "pointer" }}>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Usuário + URL */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Usuário / Login</label>
          <input value={form.username} onChange={f("username")} placeholder="usuario@exemplo.com" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>URL / Site</label>
          <input value={form.url} onChange={f("url")} placeholder="https://painel.exemplo.com" style={inputStyle} />
        </div>
      </div>

      {/* Senha com gerador */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Senha</label>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type={showPwd ? "text" : "password"}
              value={form.password}
              onChange={f("password")}
              placeholder="••••••••"
              style={{ ...inputStyle, paddingRight: 36 }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer",
                display: "flex", alignItems: "center",
              }}
            >
              {showPwd ? Icon.eyeOff : Icon.eye}
            </button>
          </div>
          <button
            type="button"
            onClick={genPassword}
            title="Gerar senha forte"
            style={{
              background: "rgba(155,114,247,.12)", border: "1px solid rgba(155,114,247,.3)",
              color: "#9b72f7", borderRadius: 7, padding: "0 12px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, fontWeight: 600, fontSize: 12,
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {Icon.zap} Gerar
          </button>
        </div>
      </div>

      {/* Notas */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Observações</label>
        <textarea
          value={form.notes}
          onChange={f("notes")}
          rows={2}
          placeholder="Notas adicionais..."
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={save}
          disabled={loading}
          style={{ background: "#4f8ef7", color: "#fff", border: "none", borderRadius: 7, padding: "8px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          {loading ? "Salvando…" : <>{Icon.check} Salvar</>}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 7, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── FileGrid ──────────────────────────────────────────────────────────────────
function fileTypeLabel(t) { return { qrcode: "QR Code", photo: "Foto", document: "Documento", image: "Imagem" }[t] || t; }
function fileTypeIcon(t)  { return { qrcode: "📲", photo: "📷", document: "📄", image: "🖼️" }[t] || "📎"; }

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

  return (
    <div>
      {/* Upload */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, padding: "12px 14px", background: "var(--surface2)", borderRadius: 10, border: "1px dashed var(--border)" }}>
        <select value={fileType} onChange={e => setFileType(e.target.value)} style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 7, padding: "7px 10px", fontSize: 13, cursor: "pointer" }}>
          <option value="qrcode">📲 QR Code (2FA)</option>
          <option value="photo">📷 Foto</option>
          <option value="image">🖼️ Imagem</option>
          <option value="document">📄 Documento</option>
        </select>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ background: "rgba(79,142,247,.12)", border: "1px solid rgba(79,142,247,.25)", color: "var(--accent)", borderRadius: 7, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          {Icon.upload} {uploading ? "Enviando…" : "Enviar Arquivo"}
        </button>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={upload} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>PNG, JPG, PDF · máx 10MB</span>
      </div>

      {files.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
          <div style={{ fontSize: 14 }}>Nenhum arquivo ainda</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Envie QR codes, fotos ou documentos</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12 }}>
          {files.map(f => (
            <div key={f.id} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "border-color .15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(79,142,247,.3)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              onClick={() => openFile(f)}
            >
              <div style={{ height: 90, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
                {fileTypeIcon(f.file_type)}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>{fileTypeLabel(f.file_type)}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>{f.name}</div>
              </div>
              <div style={{ padding: "0 10px 10px" }} onClick={e => e.stopPropagation()}>
                <button onClick={() => removeFile(f.id)} style={{ background: "rgba(229,91,91,.1)", border: "1px solid rgba(229,91,91,.2)", color: "#e55b5b", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                  {Icon.trash} Excluir
                </button>
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
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Carregando...</div>
            ) : viewFile && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{fileTypeIcon(viewFile.file_type)} {viewFile.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{fileTypeLabel(viewFile.file_type)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { const a = document.createElement("a"); a.href = viewFile.data; a.download = viewFile.name; a.click(); }} style={{ background: "rgba(79,142,247,.12)", border: "1px solid rgba(79,142,247,.25)", color: "var(--accent)", borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                      {Icon.download} Baixar
                    </button>
                    <button onClick={() => setViewFile(null)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 7, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      {Icon.close}
                    </button>
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
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const load = () => {
    setLoading(true);
    getVault(client.id).then(data => {
      setCredentials(data.credentials || []);
      setFiles(data.files || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [client.id]);

  const handleDelete = async (id) => {
    if (!window.confirm("Excluir credencial?")) return;
    await delCredential(id);
    load();
  };

  const handleSave = () => { setShowForm(false); setEditCred(null); load(); };

  const filtered = credentials.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || (c.title||"").toLowerCase().includes(q) || (c.username||"").toLowerCase().includes(q) || (c.url||"").toLowerCase().includes(q) || (c.notes||"").toLowerCase().includes(q);
    const matchCat = !filterCat || c.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", backdropFilter: "blur(4px)", padding: "40px 16px 20px", overflowY: "auto" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "calc(100vh - 60px)", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1, borderRadius: "16px 16px 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(79,142,247,.12)", border: "1px solid rgba(79,142,247,.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4f8ef7", fontSize: 20 }}>
              🔐
            </div>
            <div>
              <div style={{ fontFamily: "var(--fh)", fontSize: 17, fontWeight: 700 }}>Cofre — {client.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>Credenciais criptografadas com AES-256</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.borderColor = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            {Icon.close}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, padding: "0 24px", borderBottom: "1px solid var(--border)" }}>
          {[
            { id: "credentials", label: `Credenciais (${credentials.length})` },
            { id: "files",       label: `Arquivos (${files.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "12px 18px", background: "none", border: "none",
              color: tab === t.id ? "var(--accent)" : "var(--muted)",
              fontWeight: tab === t.id ? 700 : 400, fontSize: 13,
              borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>Carregando cofre...</div>
          ) : tab === "credentials" ? (
            <>
              {/* Search + Filter + Add */}
              {!showForm && !editCred && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200, position: "relative", display: "flex", alignItems: "center" }}>
                    <span style={{ position: "absolute", left: 10, color: "var(--muted)", display: "flex" }}>{Icon.search}</span>
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar por título, usuário, URL..."
                      style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)", fontSize: 13, padding: "9px 14px 9px 34px", outline: "none", boxSizing: "border-box" }}
                    />
                    {search && (
                      <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center" }}>{Icon.close}</button>
                    )}
                  </div>
                  <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: filterCat ? "var(--text)" : "var(--muted)", borderRadius: 9, padding: "9px 12px", fontSize: 13, cursor: "pointer" }}>
                    <option value="">Todas categorias</option>
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button
                    onClick={() => setShowForm(true)}
                    style={{ background: "rgba(79,142,247,.1)", border: "1px solid rgba(79,142,247,.3)", color: "var(--accent)", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                  >
                    {Icon.plus} Nova
                  </button>
                </div>
              )}

              {(showForm || editCred) && (
                <CredentialForm
                  clientId={client.id}
                  editing={editCred}
                  onSave={handleSave}
                  onCancel={() => { setShowForm(false); setEditCred(null); }}
                />
              )}

              {filtered.length === 0 && !showForm ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
                  <div style={{ fontSize: 14 }}>{search || filterCat ? "Nenhuma credencial encontrada" : "Nenhuma credencial salva"}</div>
                  {!search && !filterCat && <div style={{ fontSize: 12, marginTop: 4 }}>Clique em "+ Nova" para adicionar</div>}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filtered.map(c => (
                    <CredentialCard
                      key={c.id}
                      cred={c}
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
