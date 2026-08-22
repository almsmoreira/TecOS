export const LOGO = "/logo.png";

export const STATUS = {
  orcamento:    { label:"Orçamento",    color:"#f5c542", bg:"rgba(245,197,66,.15)"  },
  aprovado:     { label:"Aprovado",     color:"#4f8ef7", bg:"rgba(79,142,247,.15)"  },
  em_andamento: { label:"Em Andamento", color:"#9b72f7", bg:"rgba(155,114,247,.15)" },
  concluido:    { label:"Concluído",    color:"#3ecf8e", bg:"rgba(62,207,142,.15)"  },
  cancelado:    { label:"Cancelado",    color:"#e55b5b", bg:"rgba(229,91,91,.15)"   },
};

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Inter:wght@400;600;700;800&family=Roboto+Mono:wght@400;600;700&family=Space+Grotesk:wght@400;600;700;800&family=Poppins:wght@400;600;700;800&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ── Tema Escuro (padrão) ── */
:root {
  --bg:#0f1117;
  --surface:#181c27;
  --surface2:#1e2435;
  --border:#2a3047;
  --accent:#4f8ef7;
  --accent-hover:#3d7de8;
  --red:#e55b5b;
  --green:#3ecf8e;
  --yellow:#f5c542;
  --purple:#9b72f7;
  --orange:#f78c4f;
  --text:#eef0f6;
  --muted:#7b849a;
  --fh:'Syne',sans-serif;
  --fb:'DM Sans',sans-serif;
  --fn:'Inter',sans-serif;
  --r:12px;
  --sh:0 4px 24px rgba(0,0,0,.4);
  --sh-card:0 1px 3px rgba(0,0,0,.3);
}

/* ── Tema Claro ── */
body.theme-light {
  --bg:#f0f2f7;
  --surface:#ffffff;
  --surface2:#f5f7fc;
  --border:#e2e6f0;
  --accent:#3b7ef6;
  --accent-hover:#2c6ee0;
  --red:#d94f4f;
  --green:#27b67a;
  --yellow:#d4a017;
  --purple:#7c5acf;
  --orange:#d4732a;
  --text:#111827;
  --muted:#6b7280;
  --sh:0 1px 4px rgba(0,0,0,.08);
  --sh-card:0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
}

body { background:var(--bg); color:var(--text); font-family:var(--fb); transition:background .2s, color .2s; }

input,select,textarea {
  background:var(--surface2);
  border:1px solid var(--border);
  border-radius:8px;
  color:var(--text);
  font-family:var(--fb);
  font-size:14px;
  padding:10px 14px;
  width:100%;
  outline:none;
  transition:border-color .2s, background .2s;
}
input:focus,select:focus,textarea:focus { border-color:var(--accent); }
input::placeholder,textarea::placeholder { color:var(--muted); }
select option { background:var(--surface); color:var(--text); }
label { font-size:11px; color:var(--muted); margin-bottom:4px; display:block; font-weight:600; letter-spacing:.6px; text-transform:uppercase; }
button { cursor:pointer; font-family:var(--fb); border:none; }

/* Scrollbar */
::-webkit-scrollbar { width:5px; }
::-webkit-scrollbar-track { background:var(--bg); }
::-webkit-scrollbar-thumb { background:var(--border); border-radius:99px; }

/* Animações */
@keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
@keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:none} }
.fu { animation:fadeUp .22s ease both; }

/* Print */
@media print {
  .no-print { display:none!important; }
  body { background:#fff!important; color:#000!important; }
}
`;

export const today  = () => new Date().toISOString().slice(0,10);
export const nowStr = () => new Date().toLocaleString("pt-BR");
export const fmtPhone = p => p?.replace(/\D/g,"") || "";
export const waLink = (phone,msg) => `https://wa.me/55${fmtPhone(phone)}?text=${encodeURIComponent(msg)}`;

// ── Utilitários de tema ───────────────────────────────────────────────────────
export function getTheme() {
  const saved = localStorage.getItem('techos_theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }
  localStorage.setItem('techos_theme', theme);
}

export function toggleTheme() {
  const current = document.body.classList.contains('theme-light') ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
}
