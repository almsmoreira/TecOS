import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Btn, Card, Empty, Th, Td, Tr } from "../components/ui";
import { apiGet } from "../api";

const fmtDate = d => d ? new Date(d).toLocaleString("pt-BR") : "—";
const relTime = d => {
  if (!d) return "nunca";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s/60)}min atrás`;
  if (s < 86400) return `${Math.floor(s/3600)}h atrás`;
  return `${Math.floor(s/86400)}d atrás`;
};

export default function Inventory({ clients=[], equipment=[], os=[], users=[] }) {
  const [clientId, setClientId] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [agentFilter, setAgentFilter] = useState("Todos");
  const [agentData, setAgentData] = useState({}); // token -> last snapshot
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Clientes com subclientes agrupados
  const clientOptions = useMemo(() => {
    const parents = clients.filter(c => !c.parent_id);
    const result = [];
    parents.forEach(p => {
      result.push(p);
      clients.filter(c => String(c.parent_id) === String(p.id)).forEach(child => {
        result.push({ ...child, _isChild: true });
      });
    });
    return result;
  }, [clients]);

  // Equipamentos do cliente selecionado
  const clientEquipment = useMemo(() => {
    if (!clientId) return [];
    return equipment.filter(e => String(e.clientId) === String(clientId));
  }, [equipment, clientId]);

  // Tipos únicos para filtro
  const types = useMemo(() => {
    const t = [...new Set(clientEquipment.map(e => e.type).filter(Boolean))];
    return ["Todos", ...t];
  }, [clientEquipment]);

  // Carrega dados do agente quando muda cliente
  const loadAgentData = async (cid) => {
    setClientId(cid);
    if (!cid) return;
    setLoadingAgents(true);
    const equips = equipment.filter(e => String(e.clientId) === String(cid));
    const data = {};
    await Promise.all(equips.map(async e => {
      try {
        const [tokens, snaps] = await Promise.all([
          apiGet(`/api/equipment/${e.id}/agent-tokens`),
          apiGet(`/api/equipment/${e.id}/inventory`),
        ]);
        const activeToken = (tokens || []).find(t => t.status === "active");
        const lastSnap = (snaps || [])[0];
        data[e.id] = { token: activeToken, snapshot: lastSnap };
      } catch {}
    }));
    setAgentData(data);
    setLoadingAgents(false);
  };

  // Determina status do agente
  const getAgentStatus = (equipId) => {
    const d = agentData[equipId];
    if (!d) return "no_agent";
    if (!d.token) return "no_agent";
    if (d.token.status === "pending") return "pending";
    if (!d.token.last_checkin) return "offline";
    const diff = Date.now() - new Date(d.token.last_checkin).getTime();
    return diff < 86400000 ? "online" : "offline";
  };

  const AGENT_STATUS = {
    online:   { label:"● Online",    color:"var(--green)",  bg:"rgba(62,207,142,.15)" },
    offline:  { label:"○ Offline",   color:"var(--muted)",  bg:"rgba(123,132,154,.1)" },
    pending:  { label:"⏳ Pendente", color:"var(--yellow)", bg:"rgba(245,197,66,.15)" },
    no_agent: { label:"— Sem agente",color:"var(--border)", bg:"transparent" },
  };

  // Filtros aplicados
  const filtered = useMemo(() => {
    return clientEquipment.filter(e => {
      if (typeFilter !== "Todos" && e.type !== typeFilter) return false;
      if (agentFilter !== "Todos") {
        const st = getAgentStatus(e.id);
        if (agentFilter === "online"   && st !== "online")   return false;
        if (agentFilter === "offline"  && st !== "offline")  return false;
        if (agentFilter === "no_agent" && st !== "no_agent") return false;
      }
      return true;
    });
  }, [clientEquipment, typeFilter, agentFilter, agentData]);

  // Stats
  const stats = useMemo(() => {
    const total = clientEquipment.length;
    const online   = clientEquipment.filter(e => getAgentStatus(e.id) === "online").length;
    const offline  = clientEquipment.filter(e => getAgentStatus(e.id) === "offline").length;
    const pending  = clientEquipment.filter(e => getAgentStatus(e.id) === "pending").length;
    const noAgent  = clientEquipment.filter(e => getAgentStatus(e.id) === "no_agent").length;
    const osAbertos = os.filter(o => String(o.clientId) === String(clientId) && !["concluido","cancelado"].includes(o.status)).length;
    return { total, online, offline, pending, noAgent, osAbertos };
  }, [clientEquipment, agentData, clientId, os]);

  // Exportar Excel
  const exportExcel = () => {
    const client = clients.find(c => String(c.id) === String(clientId));
    const rows = filtered.map(e => {
      const ag = agentData[e.id];
      const snap = ag?.snapshot?.data || {};
      const st = getAgentStatus(e.id);
      return {
        "Tipo": e.type || "",
        "Marca": e.brand || "",
        "Modelo": e.model || "",
        "Nº Série": e.serial || "",
        "Colaborador": e.collaborator || "",
        "Processador": e.processor || snap.cpu?.name || "",
        "RAM": e.ram || (snap.ram?.totalGB ? `${snap.ram.totalGB} GB` : ""),
        "Armazenamento": e.storage || "",
        "Sistema Operacional": e.osVersion || snap.os?.name || "",
        "Office": e.office || snap.office || "",
        "Acesso Remoto ID": e.remoteId || "",
        "Status Agente": AGENT_STATUS[st]?.label || "",
        "Último Checkin": ag?.token?.last_checkin ? fmtDate(ag.token.last_checkin) : "",
        "Hostname": snap.hostname || ag?.token?.hostname || "",
        "IP": snap.network?.[0]?.ip || "",
        "Disco C: Livre": snap.logicalDisks?.find(d => d.drive === "C:")?.freeGB ? `${snap.logicalDisks.find(d => d.drive === "C:").freeGB} GB` : "",
        "Antivírus": snap.antivirus?.[0]?.name || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Inventário`);
    XLSX.writeFile(wb, `inventario_${client?.name?.replace(/\s+/g,'_') || clientId}.xlsx`);
  };

  const StatCard = ({ label, value, color }) => (
    <Card style={{ flex:1, minWidth:120, textAlign:"center" }}>
      <div style={{ fontSize:24, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>{label}</div>
    </Card>
  );

  const client = clients.find(c => String(c.id) === String(clientId));

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:700 }}>📦 Inventário</h2>
          <div style={{ color:"var(--muted)", fontSize:13, marginTop:2 }}>Inventário completo de equipamentos por cliente</div>
        </div>
        {clientId && (
          <Btn variant="ghost" onClick={exportExcel} disabled={!filtered.length}>
            📥 Exportar Excel
          </Btn>
        )}
      </div>

      {/* Seletor de cliente */}
      <Card style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>Selecione o cliente</div>
        <select value={clientId} onChange={e => loadAgentData(e.target.value)}
          style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:14 }}>
          <option value="">— Selecione um cliente —</option>
          {clientOptions.map(c => (
            <option key={c.id} value={c.id}>
              {c._isChild ? "  ↳ " : ""}{c.name}
            </option>
          ))}
        </select>
      </Card>

      {!clientId ? (
        <Empty icon="📦" text="Selecione um cliente para ver o inventário" />
      ) : loadingAgents ? (
        <div style={{ textAlign:"center", padding:40, color:"var(--muted)" }}>⏳ Carregando dados dos agentes...</div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            <StatCard label="Total" value={stats.total} color="var(--accent)" />
            <StatCard label="Online" value={stats.online} color="var(--green)" />
            <StatCard label="Offline" value={stats.offline} color="var(--muted)" />
            <StatCard label="Pendentes" value={stats.pending} color="var(--yellow)" />
            <StatCard label="Sem agente" value={stats.noAgent} color="var(--border)" />
            <StatCard label="OS abertas" value={stats.osAbertos} color="var(--red)" />
          </div>

          {/* Filtros */}
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:11, color:"var(--muted)", fontWeight:600 }}>Tipo:</span>
            {types.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} style={{
                padding:"5px 10px", borderRadius:6, fontSize:11, cursor:"pointer", fontWeight:600,
                background: typeFilter===t ? "rgba(79,142,247,.15)" : "var(--surface2)",
                border: `1px solid ${typeFilter===t ? "var(--accent)" : "var(--border)"}`,
                color: typeFilter===t ? "var(--accent)" : "var(--muted)",
              }}>{t}</button>
            ))}
            <span style={{ fontSize:11, color:"var(--muted)", fontWeight:600, marginLeft:8 }}>Agente:</span>
            {[["Todos","Todos"],["online","Online"],["offline","Offline"],["no_agent","Sem agente"]].map(([v,l]) => (
              <button key={v} onClick={() => setAgentFilter(v)} style={{
                padding:"5px 10px", borderRadius:6, fontSize:11, cursor:"pointer", fontWeight:600,
                background: agentFilter===v ? "rgba(79,142,247,.15)" : "var(--surface2)",
                border: `1px solid ${agentFilter===v ? "var(--accent)" : "var(--border)"}`,
                color: agentFilter===v ? "var(--accent)" : "var(--muted)",
              }}>{l}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <Empty icon="🖥" text="Nenhum equipamento encontrado" />
          ) : (
            <Card style={{ padding:0, overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid var(--border)", background:"var(--surface2)" }}>
                    <Th>Equipamento</Th>
                    <Th>Colaborador</Th>
                    <Th>Configuração</Th>
                    <Th>Sistema</Th>
                    <Th>Agente</Th>
                    <Th>Último Checkin</Th>
                    <Th>Disco</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const ag = agentData[e.id];
                    const snap = ag?.snapshot?.data || {};
                    const st = getAgentStatus(e.id);
                    const stCfg = AGENT_STATUS[st];
                    const diskC = snap.logicalDisks?.find ? snap.logicalDisks.find(d => d.drive === "C:") : null;
                    const diskWarn = diskC && diskC.percentFree < 15;
                    const osAbertos = os.filter(o => String(o.equipmentId) === String(e.id) && !["concluido","cancelado"].includes(o.status)).length;

                    return (
                      <Tr key={e.id}>
                        {/* Equipamento */}
                        <Td>
                          <div style={{ fontWeight:700, fontSize:13 }}>
                            {e.type} {e.brand} {e.model}
                          </div>
                          <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>
                            {e.serial && `SN: ${e.serial}`}
                            {snap.hostname && ` · ${snap.hostname}`}
                          </div>
                          {osAbertos > 0 && (
                            <div style={{ fontSize:10, color:"var(--red)", marginTop:2, fontWeight:600 }}>
                              ⚠ {osAbertos} OS aberta(s)
                            </div>
                          )}
                        </Td>

                        {/* Colaborador */}
                        <Td style={{ fontSize:12 }}>
                          {e.collaborator || snap.user || "—"}
                        </Td>

                        {/* Configuração */}
                        <Td style={{ fontSize:11 }}>
                          <div>{e.processor || snap.cpu?.name || "—"}</div>
                          <div style={{ color:"var(--muted)" }}>
                            RAM: {e.ram || (snap.ram?.totalGB ? `${snap.ram.totalGB} GB` : "—")}
                          </div>
                          <div style={{ color:"var(--muted)" }}>
                            HD: {e.storage || "—"}
                          </div>
                        </Td>

                        {/* Sistema */}
                        <Td style={{ fontSize:11 }}>
                          <div>{e.osVersion || (snap.os?.name?.replace("Microsoft ","")) || "—"}</div>
                          <div style={{ color:"var(--muted)" }}>
                            {e.office || (snap.office?.split(",")?.[0]) || ""}
                          </div>
                          {e.remoteId && (
                            <div style={{ color:"var(--accent)", marginTop:2 }}>🖥 {e.remoteId}</div>
                          )}
                        </Td>

                        {/* Status agente */}
                        <Td>
                          <span style={{ fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:99, background:stCfg.bg, color:stCfg.color }}>
                            {stCfg.label}
                          </span>
                          {ag?.token?.hostname && (
                            <div style={{ fontSize:10, color:"var(--muted)", marginTop:3 }}>{ag.token.hostname}</div>
                          )}
                          {snap.network?.[0]?.ip && (
                            <div style={{ fontSize:10, color:"var(--muted)" }}>{snap.network[0].ip}</div>
                          )}
                        </Td>

                        {/* Último checkin */}
                        <Td style={{ fontSize:11, color:"var(--muted)" }}>
                          {ag?.token?.last_checkin ? (
                            <>
                              <div>{relTime(ag.token.last_checkin)}</div>
                              <div style={{ fontSize:10 }}>{fmtDate(ag.token.last_checkin)}</div>
                            </>
                          ) : "—"}
                        </Td>

                        {/* Disco */}
                        <Td>
                          {diskC ? (
                            <div>
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                                <span style={{ color: diskWarn ? "var(--red)" : "var(--text)" }}>C:</span>
                                <span style={{ color:"var(--muted)" }}>{diskC.freeGB} GB livre</span>
                              </div>
                              <div style={{ background:"var(--surface2)", borderRadius:99, height:6, overflow:"hidden", width:80 }}>
                                <div style={{
                                  width:`${100 - diskC.percentFree}%`, height:"100%",
                                  background: diskWarn ? "var(--red)" : "var(--green)",
                                }} />
                              </div>
                              <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>{diskC.percentFree}% livre</div>
                            </div>
                          ) : (
                            <span style={{ fontSize:11, color:"var(--muted)" }}>—</span>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
