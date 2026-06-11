import { LOGO } from "../constants";
import { RoleBadge } from "./ui";

const MENU = [
  { id:"dashboard",    icon:"📊", label:"Dashboard" },
  { id:"os",           icon:"📋", label:"Ordens de Serviço" },
  { id:"chamados",     icon:"📬", label:"Chamados" },
  { id:"clients",      icon:"👥", label:"Clientes" },
  { id:"equipment",    icon:"🖥️",  label:"Equipamentos" },
  { id:"services",     icon:"🛠️",  label:"Serviços" },
  { id:"financeiro",   icon:"💰", label:"Financeiro" },
  { id:"osavulsas",    icon:"💼", label:"OS Avulsas" },
  { id:"expenses",     icon:"💳", label:"Despesas" },
  { id:"agents",       icon:"🤖", label:"Agentes" },
  { id:"inventory",    icon:"📦", label:"Inventário" },
  { id:"mensalidades", icon:"📅", label:"Mensalidades" },
  { id:"reports",      icon:"📈", label:"Relatórios" },
  { id:"webhook",      icon:"🔗", label:"Webhook" },
  { id:"personalize",  icon:"🎨", label:"Personalizar" },
  { id:"settings",     icon:"⚙️",  label:"Usuários", adminOnly:true },
];

export default function Sidebar({ active, onChange, onLogout, user, collapsed, onToggle }) {
  const w = collapsed ? 56 : 220;

  return (
    <div style={{
      width: w, minHeight:"100vh", background:"var(--surface)",
      borderRight:"1px solid var(--border)", display:"flex",
      flexDirection:"column", flexShrink:0,
      transition:"width .25s ease", overflow:"hidden",
      padding: collapsed ? "16px 0" : "16px 10px",
    }}>

      {/* Header: logo + botão toggle */}
      <div style={{ display:"flex", alignItems:"center", justifyContent: collapsed ? "center" : "space-between", marginBottom:20, paddingLeft: collapsed ? 0 : 8 }}>
        {!collapsed && (
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <img src={LOGO} alt="ALMS" style={{ width:36, height:36, objectFit:"contain", borderRadius:8 }} />
            <div>
              <div style={{ fontFamily:"var(--fh)", fontSize:15, fontWeight:800, color:"var(--accent)", lineHeight:1.1 }}>ALMS</div>
              <div style={{ fontSize:10, color:"var(--muted)" }}>Tecnologia</div>
            </div>
          </div>
        )}
        {collapsed && (
          <img src={LOGO} alt="ALMS" style={{ width:32, height:32, objectFit:"contain", borderRadius:8, marginBottom:4 }} />
        )}
        <button onClick={onToggle} title={collapsed ? "Expandir menu" : "Recolher menu"} style={{
          background:"transparent", border:"1px solid var(--border)", borderRadius:7,
          width:28, height:28, cursor:"pointer", color:"var(--muted)", fontSize:14,
          display:"flex", alignItems:"center", justifyContent:"center",
          flexShrink:0, marginLeft: collapsed ? 0 : 4,
        }}>
          {collapsed ? "▶" : "✕"}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex:1 }}>
        {MENU.filter(m => !m.adminOnly || user.role === "admin").map(m => (
          <button key={m.id} onClick={() => onChange(m.id)}
            title={collapsed ? m.label : undefined}
            style={{
              width:"100%", display:"flex", alignItems:"center",
              gap: collapsed ? 0 : 9,
              justifyContent: collapsed ? "center" : "flex-start",
              padding: collapsed ? "10px 0" : "9px 12px",
              borderRadius:8, marginBottom:2,
              background: active===m.id ? "rgba(79,142,247,.14)" : "transparent",
              color: active===m.id ? "var(--accent)" : "var(--muted)",
              border: active===m.id ? "1px solid rgba(79,142,247,.22)" : "1px solid transparent",
              fontWeight: active===m.id ? 600 : 400,
              fontSize:13, cursor:"pointer", transition:"all .14s", textAlign:"left",
            }}>
            <span style={{ fontSize:16 }}>{m.icon}</span>
            {!collapsed && m.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop:"1px solid var(--border)", paddingTop:12, marginTop:8 }}>
        {!collapsed && (
          <div style={{ paddingLeft:12, marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>{user.name}</div>
            <RoleBadge role={user.role} />
          </div>
        )}
        <button onClick={onLogout} title="Sair" style={{
          display:"flex", alignItems:"center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : 8,
          padding: collapsed ? "10px 0" : "9px 12px",
          borderRadius:8, background:"transparent", color:"var(--muted)",
          border:"1px solid transparent", fontSize:13, cursor:"pointer", width:"100%",
        }}>
          ⏻ {!collapsed && "Sair"}
        </button>
      </div>
    </div>
  );
}
