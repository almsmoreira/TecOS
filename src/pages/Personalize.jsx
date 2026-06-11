import { useState, useEffect } from "react";
import { Card } from "../components/ui";

const FONTS_NUMBER = [
  { id:"'Inter',sans-serif",         label:"Inter",         sample:"R$ 1.234,56" },
  { id:"'Syne',sans-serif",          label:"Syne",          sample:"R$ 1.234,56" },
  { id:"'DM Sans',sans-serif",       label:"DM Sans",       sample:"R$ 1.234,56" },
  { id:"'Space Grotesk',sans-serif", label:"Space Grotesk", sample:"R$ 1.234,56" },
  { id:"'Poppins',sans-serif",       label:"Poppins",       sample:"R$ 1.234,56" },
  { id:"'Roboto Mono',monospace",    label:"Roboto Mono",   sample:"R$ 1.234,56" },
];

const FONTS_BODY = [
  { id:"'DM Sans',sans-serif",       label:"DM Sans"       },
  { id:"'Inter',sans-serif",         label:"Inter"         },
  { id:"'Poppins',sans-serif",       label:"Poppins"       },
  { id:"'Space Grotesk',sans-serif", label:"Space Grotesk" },
];

const FONTS_HEAD = [
  { id:"'Syne',sans-serif",          label:"Syne"          },
  { id:"'Inter',sans-serif",         label:"Inter"         },
  { id:"'Space Grotesk',sans-serif", label:"Space Grotesk" },
  { id:"'Poppins',sans-serif",       label:"Poppins"       },
];

const ACCENT_COLORS = [
  { id:"#4f8ef7", label:"Azul (padrão)" },
  { id:"#3ecf8e", label:"Verde"         },
  { id:"#9b72f7", label:"Roxo"          },
  { id:"#f5c542", label:"Amarelo"       },
  { id:"#e55b5b", label:"Vermelho"      },
  { id:"#f78c4f", label:"Laranja"       },
  { id:"#00bcd4", label:"Ciano"         },
  { id:"#e91e8c", label:"Rosa"          },
];

const BG_THEMES = [
  { id:"#0f1117", surface:"#181c27", surface2:"#1e2435", border:"#2a3047", label:"Escuro (padrão)" },
  { id:"#0a0e1a", surface:"#111827", surface2:"#1f2937", border:"#374151", label:"Midnight"        },
  { id:"#0d1117", surface:"#161b22", surface2:"#21262d", border:"#30363d", label:"GitHub Dark"     },
  { id:"#1a1a2e", surface:"#16213e", surface2:"#0f3460", border:"#533483", label:"Deep Purple"     },
];

const PREF_KEY = "techos_prefs";

export function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { return {}; }
}

export function applyPrefs(prefs) {
  const r = document.documentElement.style;
  if (prefs.accent)   r.setProperty("--accent",   prefs.accent);
  if (prefs.fontNum)  r.setProperty("--fn",        prefs.fontNum);
  if (prefs.fontBody) r.setProperty("--fb",        prefs.fontBody);
  if (prefs.fontHead) r.setProperty("--fh",        prefs.fontHead);
  if (prefs.bg) {
    r.setProperty("--bg",      prefs.bg.id);
    r.setProperty("--surface", prefs.bg.surface);
    r.setProperty("--surface2",prefs.bg.surface2);
    r.setProperty("--border",  prefs.bg.border);
    document.body.style.background = prefs.bg.id;
  }
}

function savePrefs(prefs) {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  applyPrefs(prefs);
}

function Section({ title, children }) {
  return (
    <Card style={{ marginBottom:20 }}>
      <div style={{ fontSize:13, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".6px", marginBottom:16 }}>{title}</div>
      {children}
    </Card>
  );
}

function OptionBtn({ label, active, onClick, style:sx={}, children }) {
  return (
    <button onClick={onClick} style={{
      padding:"10px 16px", borderRadius:8, fontSize:13, cursor:"pointer", transition:"all .15s",
      background: active ? "rgba(79,142,247,.15)" : "var(--surface2)",
      border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
      color: active ? "var(--accent)" : "var(--text)",
      fontWeight: active ? 700 : 400, display:"flex", flexDirection:"column", alignItems:"center", gap:6,
      ...sx,
    }}>
      {children || label}
    </button>
  );
}

export default function Personalize() {
  const [prefs, setPrefs] = useState(loadPrefs);

  const set = (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    savePrefs(next);
  };

  const reset = () => {
    localStorage.removeItem(PREF_KEY);
    const r = document.documentElement.style;
    ["--accent","--fn","--fb","--fh","--bg","--surface","--surface2","--border"].forEach(v => r.removeProperty(v));
    document.body.style.background = "";
    setPrefs({});
  };

  return (
    <div className="fu">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
        <h2 style={{ fontFamily:"var(--fh)", fontSize:24 }}>Personalizar</h2>
        <button onClick={reset} style={{ background:"rgba(229,91,91,.12)", border:"1px solid rgba(229,91,91,.25)", color:"#e55b5b", padding:"8px 16px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
          ↺ Restaurar padrão
        </button>
      </div>

      {/* Cor de destaque */}
      <Section title="🎨 Cor de Destaque">
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
          {ACCENT_COLORS.map(c => (
            <OptionBtn key={c.id} active={prefs.accent===c.id} onClick={() => set("accent", c.id)}>
              <div style={{ width:32, height:32, borderRadius:8, background:c.id, boxShadow: prefs.accent===c.id ? `0 0 12px ${c.id}` : "none" }} />
              <span style={{ fontSize:11 }}>{c.label}</span>
            </OptionBtn>
          ))}
        </div>
      </Section>

      {/* Tema de fundo */}
      <Section title="🌑 Tema de Fundo">
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
          {BG_THEMES.map(t => (
            <OptionBtn key={t.id} active={prefs.bg?.id===t.id} onClick={() => set("bg", t)}>
              <div style={{ width:56, height:32, borderRadius:6, background:t.id, border:`2px solid ${t.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ width:32, height:18, borderRadius:4, background:t.surface }} />
              </div>
              <span style={{ fontSize:11 }}>{t.label}</span>
            </OptionBtn>
          ))}
        </div>
      </Section>

      {/* Fonte dos números */}
      <Section title="🔢 Fonte dos Números e Valores">
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
          {FONTS_NUMBER.map(f => (
            <OptionBtn key={f.id} active={prefs.fontNum===f.id} onClick={() => set("fontNum", f.id)}>
              <span style={{ fontFamily:f.id, fontSize:18, fontWeight:700, color:"var(--accent)" }}>{f.sample}</span>
              <span style={{ fontSize:11, color:"var(--muted)" }}>{f.label}</span>
            </OptionBtn>
          ))}
        </div>
      </Section>

      {/* Fonte dos títulos */}
      <Section title="📝 Fonte dos Títulos">
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
          {FONTS_HEAD.map(f => (
            <OptionBtn key={f.id} active={prefs.fontHead===f.id} onClick={() => set("fontHead", f.id)}>
              <span style={{ fontFamily:f.id, fontSize:18, fontWeight:700 }}>Dashboard</span>
              <span style={{ fontSize:11, color:"var(--muted)" }}>{f.label}</span>
            </OptionBtn>
          ))}
        </div>
      </Section>

      {/* Fonte do corpo */}
      <Section title="📄 Fonte do Texto">
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
          {FONTS_BODY.map(f => (
            <OptionBtn key={f.id} active={prefs.fontBody===f.id} onClick={() => set("fontBody", f.id)}>
              <span style={{ fontFamily:f.id, fontSize:14 }}>Ordem de Serviço #0001</span>
              <span style={{ fontSize:11, color:"var(--muted)" }}>{f.label}</span>
            </OptionBtn>
          ))}
        </div>
      </Section>

      {/* Preview */}
      <Card>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".6px", marginBottom:16 }}>👁 Preview</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
          {[{label:"Total Faturado",value:"R$ 12.450,00",color:"var(--green)"},{label:"OS Concluídas",value:"47",color:"var(--accent)"},{label:"Clientes",value:"36",color:"var(--orange)"},{label:"Ticket Médio",value:"R$ 264,89",color:"var(--yellow)"}].map(s => (
            <div key={s.label} style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, padding:14 }}>
              <div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", fontWeight:600, marginBottom:8 }}>{s.label}</div>
              <div style={{ fontSize:22, fontFamily:"var(--fn)", fontWeight:800, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
