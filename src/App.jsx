import { useState, useEffect, useRef, Component } from "react";
import { apiGet, apiPost, login as apiLogin, logout as apiLogout, getToken } from "./api";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import OSList from "./pages/OSList";
import Clients from "./pages/Clients";
import Equipment from "./pages/Equipment";
import Reports from "./pages/Reports";
import Webhook from "./pages/Webhook";
import Settings from "./pages/Settings";
import Personalize, { loadPrefs, applyPrefs } from "./pages/Personalize";
import Chamados from "./pages/Chamados";
import Financeiro from "./pages/Financeiro";
import Mensalidades from "./pages/Mensalidades";
import Expenses from "./pages/Expenses";
import OsAvulsas from "./pages/OsAvulsas";
import Agents from "./pages/Agents";
import Inventory from "./pages/Inventory";
import Services from "./pages/Services";

// ── Error Boundary ─────────────────────────────────────────────────────────

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error("[ErrorBoundary]", e, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:32, color:"#e55b5b", fontFamily:"monospace", background:"#0f1117", minHeight:"100vh" }}>
          <div style={{ fontSize:20, fontWeight:700, marginBottom:16 }}>Erro na pagina</div>
          <div style={{ background:"#181c27", padding:16, borderRadius:8, border:"1px solid #2a3047", fontSize:13 }}>
            {String(this.state.error)}
          </div>
          <button type="button" onClick={() => this.setState({error:null})} style={{ marginTop:16, background:"#4f8ef7", color:"#fff", border:"none", padding:"10px 20px", borderRadius:8, cursor:"pointer", fontWeight:600 }}>
            Voltar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage]               = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [users, setUsers]             = useState([]);
  const [clients, setClients]         = useState([]);
  const [equipment, setEquipment]     = useState([]);
  const [os, setOs]                   = useState([]);
  const [saveMsg, setSaveMsg]         = useState("");
  const [loaded, setLoaded]           = useState(false);
  const [services, setServices]        = useState([]);
  const [checking, setChecking]       = useState(true);
  const saveTimer = useRef(null);

  // Aplicar preferências salvas ao carregar
  useEffect(() => { applyPrefs(loadPrefs()); }, []);

  // Verificar token existente ao carregar
  useEffect(() => {
    if (getToken()) {
      apiGet("/api/auth/me")
        .then(data => { if (data?.user) setCurrentUser(data.user); })
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  // Carregar dados quando logado
  useEffect(() => {
    if (!currentUser) return;
    apiGet("/api/data").then(data => {
      if (data) {
        if (data.users)     setUsers(data.users);
        if (data.clients)   setClients(data.clients);
        if (data.equipment) setEquipment(data.equipment);
        apiGet("/api/services").then(d => { if (Array.isArray(d)) setServices(d); });
        if (data.os)        setOs(data.os);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [currentUser]);

  // Auto-save com debounce
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      apiPost("/api/data", { users, clients, equipment, os }).then(() => {
        setSaveMsg("✓ Salvo");
        setTimeout(() => setSaveMsg(""), 2000);
      });
    }, 800);
  }, [users, clients, equipment, os, loaded]);

  const handleLogin = async (username, password) => {
    const res = await apiLogin(username, password);
    if (res.token) { setCurrentUser(res.user); return { ok:true }; }
    return { ok:false, error:res.error };
  };

  const handleLogout = () => {
    apiLogout();
    setCurrentUser(null);
    setLoaded(false);
    setUsers([]); setClients([]); setEquipment([]); setOs([]);
    setPage("dashboard");
  };

  if (checking) {
    return (
      <div style={{ minHeight:"100vh", background:"#0f1117", display:"flex", alignItems:"center", justifyContent:"center", color:"#7b849a", fontFamily:"DM Sans,sans-serif", fontSize:16 }}>
          🔧 Carregando...
      </div>
    );
  }

  if (!currentUser) return <Login onLogin={handleLogin} />;

  const pages = {
    dashboard: <Dashboard os={os} clients={clients} users={users} onNavigate={setPage} equipment={equipment} />,
    os:        <OSList os={os} setOs={setOs} clients={clients} equipment={equipment} users={users} currentUser={currentUser} services={services} />,
    clients:   <Clients clients={clients} setClients={setClients} os={os} equipment={equipment} setEquipment={setEquipment} />,
    equipment: <Equipment equipment={equipment} setEquipment={setEquipment} clients={clients} os={os} />,
    services:  <Services services={services} setServices={setServices} />,
    reports:   <Reports os={os} clients={clients} users={users} />,
    webhook:   <Webhook />,
    settings:  <Settings users={users} setUsers={setUsers} currentUser={currentUser} />,
    chamados:   <Chamados clients={clients} users={users} equipment={equipment} currentUser={currentUser} onNavigateOS={() => setPage("os")} />,
    financeiro:  <Financeiro os={os} />,
    mensalidades: <Mensalidades clients={clients} />,
    expenses:    <Expenses />,
    osavulsas:   <OsAvulsas os={os} clients={clients} users={users} />,
    agents:      <Agents clients={clients} equipment={equipment} />,
    inventory:   <Inventory clients={clients} equipment={equipment} os={os} users={users} />,
    personalize: <Personalize />,
  };

  return (
    <>
      <div style={{ display:"flex", minHeight:"100vh" }}>
        <Sidebar active={page} onChange={setPage} onLogout={handleLogout} user={currentUser} collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
        <main style={{ flex:1, padding:"28px 32px", overflowY:"auto", maxWidth: sidebarOpen ? "calc(100vw - 220px)" : "calc(100vw - 56px)", transition:"max-width .25s ease" }}>
          {saveMsg && (
            <div style={{ position:"fixed", bottom:24, right:24, background:"rgba(62,207,142,.15)", border:"1px solid rgba(62,207,142,.3)", color:"var(--green)", padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:600, zIndex:999 }}>
              {saveMsg}
            </div>
          )}
          <ErrorBoundary>{pages[page] || pages.dashboard}</ErrorBoundary>
        </main>
      </div>
    </>
  );
}
