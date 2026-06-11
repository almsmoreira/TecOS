import { createPortal } from 'react-dom';
import { STATUS } from "../constants";

export function Badge({ status }) {
  const s = STATUS[status] || STATUS.orcamento;
  return <span style={{ background:s.bg, color:s.color, borderRadius:99, fontSize:11, fontWeight:700, padding:"3px 10px", whiteSpace:"nowrap" }}>{s.label}</span>;
}

export function RoleBadge({ role }) {
  const m = { admin:{label:"Admin",color:"#f5c542",bg:"rgba(245,197,66,.15)"}, tecnico:{label:"Técnico",color:"#9b72f7",bg:"rgba(155,114,247,.15)"} };
  const s = m[role] || m.tecnico;
  return <span style={{ background:s.bg, color:s.color, borderRadius:99, fontSize:11, fontWeight:700, padding:"3px 10px" }}>{s.label}</span>;
}

export function Btn({ children, onClick, variant="primary", style:sx={}, small, disabled, title }) {
  const base = { padding:small?"6px 12px":"10px 20px", borderRadius:8, fontSize:small?12:14, fontWeight:600, transition:"all .15s", display:"inline-flex", alignItems:"center", gap:6, opacity:disabled?.45:1, cursor:disabled?"not-allowed":"pointer", ...sx };
  const v = {
    primary: { background:"#4f8ef7", color:"#fff" },
    danger:  { background:"rgba(229,91,91,.12)", color:"#e55b5b", border:"1px solid rgba(229,91,91,.25)" },
    ghost:   { background:"transparent", color:"#7b849a", border:"1px solid #2a3047" },
    success: { background:"rgba(62,207,142,.12)", color:"#3ecf8e", border:"1px solid rgba(62,207,142,.25)" },
    yellow:  { background:"rgba(245,197,66,.12)", color:"#f5c542", border:"1px solid rgba(245,197,66,.25)" },
    purple:  { background:"rgba(155,114,247,.12)", color:"#9b72f7", border:"1px solid rgba(155,114,247,.25)" },
  };
  return <button type="button" title={title} onClick={disabled?undefined:onClick} style={{ ...base, ...v[variant] }}>{children}</button>;
}

export function Card({ children, style:sx={} }) {
  return <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:20, boxShadow:"var(--sh)", ...sx }}>{children}</div>;
}

export function Modal({ title, children, onClose, wide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.78)", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center", backdropFilter:"blur(4px)", padding:"60px 16px 20px" }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, width:"100%", maxWidth:wide?780:580, maxHeight:"calc(100vh - 80px)", overflowY:"auto", animation:"slideIn .2s ease" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 24px", borderBottom:"1px solid var(--border)", position:"sticky", top:0, background:"var(--surface)", zIndex:1, borderRadius:"16px 16px 0 0" }}>
          <h3 style={{ fontFamily:"var(--fh)", fontSize:17 }}>{title}</h3>
          <button onClick={onClose} style={{ background:"var(--surface2)", border:"none", color:"var(--muted)", width:30, height:30, borderRadius:7, fontSize:17, cursor:"pointer" }}>×</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return <div style={{ marginBottom:14 }}><label>{label}</label>{children}</div>;
}

export function G2({ children }) {
  return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>{children}</div>;
}

export function Empty({ icon, text }) {
  return <div style={{ textAlign:"center", padding:"52px 0", color:"var(--muted)" }}><div style={{ fontSize:38, marginBottom:10 }}>{icon}</div><div style={{ fontSize:14 }}>{text}</div></div>;
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display:"flex", gap:2, borderBottom:"1px solid var(--border)", marginBottom:20 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{ padding:"10px 18px", background:"none", border:"none", color:active===t.id?"var(--accent)":"var(--muted)", fontWeight:active===t.id?700:400, fontSize:13, borderBottom:active===t.id?"2px solid var(--accent)":"2px solid transparent", cursor:"pointer" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Th({ children }) {
  return <th style={{ textAlign:"left", padding:"10px 14px", fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", fontWeight:600 }}>{children}</th>;
}

export function Td({ children, style:sx={} }) {
  return <td style={{ padding:"13px 14px", fontSize:14, ...sx }}>{children}</td>;
}

export function Tr({ children, onClick }) {
  return (
    <tr onClick={onClick} style={{ borderBottom:"1px solid var(--border)", cursor:onClick?"pointer":"auto", transition:"background .1s" }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background="rgba(255,255,255,.02)")}
      onMouseLeave={e => (e.currentTarget.style.background="transparent")}>
      {children}
    </tr>
  );
}
