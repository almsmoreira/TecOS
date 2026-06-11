import { useState, useEffect } from "react";
import { Modal, Btn, Card, Tabs } from "./ui";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";

const fmtDate = d => d ? new Date(d).toLocaleString("pt-BR") : "—";
const fmtDateShort = d => d ? new Date(d).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "—";

function relativeTime(date) {
  if (!date) return "nunca";
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `${Math.floor(diff/60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff/3600)} h atrás`;
  return `${Math.floor(diff/86400)} dias atrás`;
}

function StatusBadge({ status, color, icon }) {
  const colors = {
    online:  { c:"var(--green)",  bg:"rgba(62,207,142,.15)" },
    offline: { c:"var(--red)",    bg:"rgba(229,91,91,.15)" },
    warn:    { c:"var(--yellow)", bg:"rgba(245,197,66,.15)" },
  };
  const s = colors[color] || colors.online;
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:99, background:s.bg, color:s.c }}>
      {icon} {status}
    </span>
  );
}

function StatCard({ label, value, color = "var(--text)", subtitle, warn }) {
  return (
    <Card style={{ flex:1, minWidth:140, position:"relative", border: warn ? "1px solid rgba(245,197,66,.4)" : undefined, background: warn ? "rgba(245,197,66,.06)" : undefined }}>
      <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={value}>{value}</div>
      {subtitle && <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>{subtitle}</div>}
    </Card>
  );
}

function DiskBar({ disk }) {
  const usedPct = 100 - (disk.percentFree || 0);
  const color = usedPct >= 90 ? "var(--red)" : usedPct >= 75 ? "var(--yellow)" : "var(--green)";
  return (
    <div style={{ padding:"10px 12px", background:"var(--surface2)", borderRadius:8, border:"1px solid var(--border)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <strong style={{ fontSize:13 }}>{disk.drive} {disk.label && `(${disk.label})`}</strong>
        <span style={{ fontSize:12, color:"var(--muted)" }}>{disk.freeGB} GB livre de {disk.sizeGB} GB</span>
      </div>
      <div style={{ background:"var(--bg)", borderRadius:99, height:8, overflow:"hidden" }}>
        <div style={{ width:`${usedPct}%`, height:"100%", background:color, transition:"width .3s" }} />
      </div>
      <div style={{ fontSize:10, color:"var(--muted)", marginTop:4 }}>{usedPct.toFixed(1)}% usado</div>
    </div>
  );
}

const asArray = v => !v ? [] : Array.isArray(v) ? v : [v];

export default function AgentModal({ equipment, onClose }) {
  const [tab, setTab] = useState("status");
  const [tokens, setTokens] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [usage, setUsage] = useState([]);
  const [usageSummary, setUsageSummary] = useState([]);
  const [usageDays, setUsageDays] = useState(7);

  const load = async () => {
    setLoading(true);
    const [tks, snaps] = await Promise.all([
      apiGet(`/api/equipment/${equipment.id}/agent-tokens`),
      apiGet(`/api/equipment/${equipment.id}/inventory`),
    ]);
    setTokens(Array.isArray(tks) ? tks : []);
    setSnapshots(Array.isArray(snaps) ? snaps : []);
    setLoading(false);
  };

  const loadConfig = async (token) => {
    if (!token) return;
    setConfigLoading(true);
    try {
      const cfg = await apiGet(`/api/agent/config/${token}`);
      setConfig(cfg);
    } catch {}
    setConfigLoading(false);
  };

  const loadUsage = async () => {
    const [u, s] = await Promise.all([
      apiGet(`/api/equipment/${equipment.id}/usage?days=${usageDays}`),
      apiGet(`/api/equipment/${equipment.id}/usage/summary?days=${usageDays}`),
    ]);
    setUsage(Array.isArray(u) ? u : []);
    setUsageSummary(Array.isArray(s) ? s : []);
  };

  const saveConfig = async () => {
    const activeToken = tokens.find(t => t.status === "active" || t.active === true);
    if (!activeToken || !config) return;
    await apiPut(`/api/agent/config/${activeToken.token}`, config);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  useEffect(() => { load(); }, [equipment.id]);
  useEffect(() => {
    const activeToken = tokens.find(t => t.status === "active" || t.active === true);
    if (activeToken) loadConfig(activeToken.token);
  }, [tokens]);
  useEffect(() => { if (tab === "usage") loadUsage(); }, [tab, usageDays]);
  useEffect(() => {
    if (tab === "config" && tokens.length > 0) {
      const activeToken = tokens.find(t => t.status === "active" || t.active === true);
      if (activeToken) loadConfig(activeToken.token);
    }
  }, [tab, tokens]);

  const generateToken = async () => {
    if (!window.confirm("Gerar novo token para este equipamento?")) return;
    await apiPost(`/api/equipment/${equipment.id}/agent-token`, {});
    load();
  };

  const revokeToken = async (token) => {
    if (!window.confirm("Revogar este token?")) return;
    await apiDelete(`/api/agent-tokens/${token}`);
    load();
  };

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const latest = snapshots[0];
  const data = latest?.data || {};
  const isOnline = latest && (Date.now() - new Date(latest.collected_at).getTime()) < 1000 * 60 * 60 * 24;

  const alerts = [];
  if (data.logicalDisks) {
    asArray(data.logicalDisks).forEach(d => {
      if (d.percentFree !== undefined && d.percentFree < 15) {
        alerts.push({ level: d.percentFree < 5 ? "critical" : "warn", msg: `Disco ${d.drive} com apenas ${d.percentFree}% livre` });
      }
    });
  }
  if (latest && !isOnline) alerts.push({ level: "warn", msg: `Sem checkin há ${relativeTime(latest.collected_at)}` });
  if (data.antivirus && asArray(data.antivirus).length === 0) alerts.push({ level: "warn", msg: "Nenhum antivírus detectado" });

  return (
    <Modal title={`🤖 Agente — ${equipment.brand} ${equipment.model || equipment.type}`} onClose={onClose} wide>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id:"status",    label:"📊 Status" },
          { id:"hardware",  label:"🔩 Hardware" },
          { id:"software",  label:"💿 Software" },
          { id:"config",    label:"🔧 Configuração" },
          { id:"usage",     label:"📈 Uso" },
          { id:"tokens",    label:`🔑 Tokens (${tokens.length})` },
          { id:"history",   label:`📜 Histórico (${snapshots.length})` },
        ]}
      />

      <div style={{ marginTop:14 }}>
        {loading ? (
          <div style={{ padding:32, textAlign:"center", color:"var(--muted)" }}>Carregando...</div>
        ) : !latest && tab !== "tokens" && tab !== "config" ? (
          <Card style={{ textAlign:"center", padding:40 }}>
            <div style={{ fontSize:38, marginBottom:12 }}>🤖</div>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:8 }}>Agente ainda não instalado</div>
            <div style={{ fontSize:13, color:"var(--muted)", marginBottom:18 }}>Gere um token na aba "🔑 Tokens" e instale o TechOS Agent.</div>
            <Btn onClick={() => setTab("tokens")}>Ir para Tokens</Btn>
          </Card>
        ) : (
          <>
            {tab === "status" && latest && (
              <>
                <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <StatusBadge status={isOnline ? "Online" : "Offline"} color={isOnline ? "online" : "offline"} icon={isOnline ? "●" : "○"} />
                    <span style={{ fontSize:12, color:"var(--muted)" }}>Último checkin: {relativeTime(latest.collected_at)} ({fmtDate(latest.collected_at)})</span>
                  </div>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>Agente v{data.agentVersion || "?"}</div>
                </div>
                {alerts.length > 0 && (
                  <Card style={{ marginBottom:12, border:"1px solid rgba(245,197,66,.4)", background:"rgba(245,197,66,.06)" }}>
                    <div style={{ fontWeight:700, fontSize:13, color:"var(--yellow)", marginBottom:6 }}>⚠ Alertas ({alerts.length})</div>
                    {alerts.map((a,i) => <div key={i} style={{ fontSize:12, color: a.level === "critical" ? "var(--red)" : "var(--muted)", marginTop:3 }}>• {a.msg}</div>)}
                  </Card>
                )}
                <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
                  <StatCard label="Hostname" value={data.hostname || "—"} subtitle={data.user ? `Usuário: ${data.user}` : ""} />
                  <StatCard label="Modelo" value={data.productName || "—"} subtitle={data.manufacturer || ""} />
                  <StatCard label="Serial" value={data.serialNumber || "—"} />
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
                  <StatCard label="Sistema" value={data.os?.name || "—"} subtitle={`${data.os?.architecture || ""} · ${data.os?.build ? `Build ${data.os.build}` : ""}`} />
                  <StatCard label="Uptime" value={`${data.os?.uptime_hours || 0}h`} subtitle={`Último boot: ${data.os?.last_boot?.split("T")[0] || "—"}`} />
                  <StatCard label="IP Local" value={asArray(data.network)[0]?.ip || "—"} subtitle={asArray(data.network)[0]?.interface || ""} />
                </div>
                {asArray(data.logicalDisks).length > 0 && (
                  <div style={{ marginTop:14 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>💾 Espaço em Disco</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {asArray(data.logicalDisks).map((d,i) => <DiskBar key={i} disk={d} />)}
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === "hardware" && latest && (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <Card>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", marginBottom:8 }}>🧠 Processador</div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{data.cpu?.name}</div>
                    <div style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>{data.cpu?.cores} núcleos · {data.cpu?.threads} threads · {data.cpu?.speedMHz} MHz</div>
                  </Card>
                  <Card>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", marginBottom:8 }}>🎮 GPU</div>
                    {asArray(data.gpus).map((g,i) => <div key={i} style={{ marginBottom:6 }}><div style={{ fontSize:13, fontWeight:600 }}>{g.name}</div><div style={{ fontSize:11, color:"var(--muted)" }}>Driver: {g.driver}</div></div>)}
                  </Card>
                </div>
                <Card style={{ marginTop:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", marginBottom:8 }}>💾 RAM — Total: {data.ram?.totalGB} GB</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:8 }}>
                    {asArray(data.ram?.modules).map((m,i) => (
                      <div key={i} style={{ padding:"8px 10px", background:"var(--surface2)", borderRadius:6, fontSize:12 }}>
                        <div style={{ fontWeight:600 }}>{m.slot}</div>
                        <div style={{ color:"var(--muted)" }}>{m.sizeGB} GB · {m.speedMHz} MHz</div>
                        <div style={{ color:"var(--muted)", fontSize:10 }}>{m.manufacturer}</div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card style={{ marginTop:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", marginBottom:8 }}>🗄 Discos Físicos</div>
                  {asArray(data.physicalDisks).map((d,i) => (
                    <div key={i} style={{ padding:"8px 10px", background:"var(--surface2)", borderRadius:6, marginBottom:6 }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <strong style={{ fontSize:13 }}>{d.model}</strong>
                        <span style={{ fontSize:11, color: d.healthStatus === "Healthy" ? "var(--green)" : "var(--red)", fontWeight:600 }}>{d.healthStatus === "Healthy" ? "✓ Saudável" : `⚠ ${d.healthStatus}`}</span>
                      </div>
                      <div style={{ fontSize:11, color:"var(--muted)", marginTop:3 }}>{d.mediaType} · {d.sizeGB} GB · SN: {d.serial}</div>
                    </div>
                  ))}
                </Card>
                <Card style={{ marginTop:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", marginBottom:8 }}>🌐 Rede</div>
                  {asArray(data.network).map((n,i) => (
                    <div key={i} style={{ padding:"8px 10px", background:"var(--surface2)", borderRadius:6, marginBottom:6, fontSize:12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <strong>{n.interface}</strong>
                        <span style={{ color: n.status === "Up" ? "var(--green)" : "var(--muted)" }}>{n.status}</span>
                      </div>
                      <div style={{ color:"var(--muted)", marginTop:3 }}>IP: {n.ip} · MAC: {n.mac} · Gateway: {n.gateway || "—"}</div>
                    </div>
                  ))}
                </Card>
              </>
            )}

            {tab === "software" && latest && (
              <>
                <Card style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", marginBottom:8 }}>🛡 Antivírus</div>
                  {asArray(data.antivirus).length === 0 ? <div style={{ color:"var(--red)", fontSize:13 }}>⚠ Nenhum antivírus detectado</div> : asArray(data.antivirus).map((av,i) => <div key={i} style={{ fontSize:13, padding:"6px 0" }}>✓ {av.name}</div>)}
                </Card>
                {data.office && <Card style={{ marginBottom:10 }}><div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", marginBottom:8 }}>📊 Office</div><div style={{ fontSize:13 }}>{data.office}</div></Card>}
                <Card>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", marginBottom:8 }}>📦 Programas ({asArray(data.software).length})</div>
                  <div style={{ maxHeight:400, overflowY:"auto" }}>
                    <table style={{ width:"100%", fontSize:12 }}>
                      <thead style={{ position:"sticky", top:0, background:"var(--surface)" }}>
                        <tr style={{ borderBottom:"1px solid var(--border)" }}>
                          <th style={{ textAlign:"left", padding:"6px 8px", fontWeight:700, color:"var(--muted)" }}>Nome</th>
                          <th style={{ textAlign:"left", padding:"6px 8px", fontWeight:700, color:"var(--muted)" }}>Versão</th>
                          <th style={{ textAlign:"left", padding:"6px 8px", fontWeight:700, color:"var(--muted)" }}>Editor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asArray(data.software).map((sw,i) => (
                          <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                            <td style={{ padding:"6px 8px", fontWeight:500 }}>{sw.name}</td>
                            <td style={{ padding:"6px 8px", color:"var(--muted)" }}>{sw.version}</td>
                            <td style={{ padding:"6px 8px", color:"var(--muted)" }}>{sw.publisher}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}

            {tab === "config" && (
              <>
                {configLoading ? (
                  <div style={{ textAlign:"center", padding:32, color:"var(--muted)" }}>Carregando configuração...</div>
                ) : !config ? (
                  <Card style={{ textAlign:"center", padding:32, color:"var(--muted)" }}>
                    <div style={{ fontSize:32, marginBottom:10 }}>⚙</div>
                    <div>Nenhum agente ativo para configurar.</div>
                  </Card>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                    <Card>
                      <div style={{ fontSize:12, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", marginBottom:12 }}>⏱ Frequência de Coleta</div>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                        {[{label:"1x/dia",value:24},{label:"2x/dia",value:12},{label:"4x/dia",value:6},{label:"A cada hora",value:1}].map(opt => (
                          <button key={opt.value} onClick={() => setConfig(c => ({...c, collect_interval_hours: opt.value}))} style={{
                            padding:"8px 16px", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13,
                            background: config.collect_interval_hours === opt.value ? "rgba(79,142,247,.15)" : "var(--surface2)",
                            border: `1px solid ${config.collect_interval_hours === opt.value ? "var(--accent)" : "var(--border)"}`,
                            color: config.collect_interval_hours === opt.value ? "var(--accent)" : "var(--muted)",
                          }}>{opt.label}</button>
                        ))}
                      </div>
                    </Card>
                    <Card>
                      <div style={{ fontSize:12, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", marginBottom:12 }}>📦 O que coletar</div>
                      {[
                        {key:"collect_hardware",label:"⚙ Hardware",desc:"CPU, RAM, discos, GPU"},
                        {key:"collect_software",label:"💿 Software",desc:"Programas instalados, SO, Office, antivírus"},
                        {key:"collect_network", label:"🌐 Rede",    desc:"IPs, MACs, interfaces de rede"},
                        {key:"collect_usage",   label:"📈 Uso/Home Office",desc:"Horários de uso, idle time, programas ativos"},
                      ].map(item => (
                        <label key={item.key} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid var(--border)", cursor:"pointer" }}>
                          <div style={{ width:40, height:22, borderRadius:99, position:"relative", transition:"all .2s", flexShrink:0, background: config[item.key] ? "var(--accent)" : "var(--border)" }}
                            onClick={() => setConfig(c => ({...c, [item.key]: !c[item.key]}))}>
                            <div style={{ width:18, height:18, borderRadius:99, background:"#fff", position:"absolute", top:2, left: config[item.key] ? 20 : 2, transition:"all .2s" }} />
                          </div>
                          <div>
                            <div style={{ fontWeight:600, fontSize:13 }}>{item.label}</div>
                            <div style={{ fontSize:11, color:"var(--muted)" }}>{item.desc}</div>
                          </div>
                        </label>
                      ))}
                    </Card>
                    <Card>
                      <div style={{ fontSize:12, fontWeight:700, color:"var(--accent)", textTransform:"uppercase", marginBottom:12 }}>🚨 Alertas</div>
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:12, fontWeight:600, marginBottom:6 }}>Disco mínimo livre (%)</div>
                        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                          <input type="range" min={5} max={30} value={config.alert_disk_pct || 10}
                            onChange={e => setConfig(c => ({...c, alert_disk_pct: parseInt(e.target.value)}))} style={{ flex:1 }} />
                          <span style={{ fontWeight:700, color:"var(--yellow)", minWidth:40 }}>{config.alert_disk_pct || 10}%</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, marginBottom:6 }}>Serviços monitorados (um por linha)</div>
                        <textarea
                          value={(config.alert_services || []).join("\n")}
                          onChange={e => setConfig(c => ({...c, alert_services: e.target.value.split("\n").map(s => s.trim()).filter(Boolean)}))}
                          rows={4}
                          style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--border)", borderRadius:6, color:"var(--text)", fontSize:12, padding:"8px 10px", resize:"vertical" }}
                        />
                      </div>
                    </Card>
                    <Btn onClick={saveConfig} style={{ alignSelf:"flex-end" }}>
                      {configSaved ? "✓ Salvo!" : "💾 Salvar Configuração"}
                    </Btn>
                  </div>
                )}
              </>
            )}

            {tab === "usage" && (
              <>
                <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
                  <span style={{ fontSize:12, color:"var(--muted)" }}>Período:</span>
                  {[7,14,30].map(d => (
                    <button key={d} onClick={() => setUsageDays(d)} style={{
                      padding:"5px 12px", borderRadius:6, fontSize:12, cursor:"pointer", fontWeight:600,
                      background: usageDays===d ? "rgba(79,142,247,.15)" : "var(--surface2)",
                      border: `1px solid ${usageDays===d ? "var(--accent)" : "var(--border)"}`,
                      color: usageDays===d ? "var(--accent)" : "var(--muted)",
                    }}>{d} dias</button>
                  ))}
                </div>
                {usageSummary.length === 0 ? (
                  <Card style={{ textAlign:"center", padding:40, color:"var(--muted)" }}>
                    <div style={{ fontSize:36, marginBottom:12 }}>📈</div>
                    <div style={{ fontWeight:600, marginBottom:6 }}>Sem dados de uso</div>
                    <div style={{ fontSize:12 }}>Ative "Monitoramento de Uso" na aba 🔧 Configuração e aguarde o próximo checkin.</div>
                  </Card>
                ) : (
                  <>
                    <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
                      {[
                        {label:"Total ativo", value:`${Math.round(usageSummary.reduce((s,d)=>s+Number(d.total_active||0),0)/3600)}h`, color:"var(--green)"},
                        {label:"Total idle",  value:`${Math.round(usageSummary.reduce((s,d)=>s+Number(d.total_idle||0),0)/3600)}h`,   color:"var(--yellow)"},
                        {label:"Dias com uso",value:usageSummary.length, color:"var(--accent)"},
                        {label:"Média diária",value:`${Math.round(usageSummary.reduce((s,d)=>s+Number(d.total_active||0),0)/usageSummary.length/3600)}h`, color:"var(--purple)"},
                      ].map(s => (
                        <Card key={s.label} style={{ flex:1, minWidth:120, textAlign:"center" }}>
                          <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
                          <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>{s.label}</div>
                        </Card>
                      ))}
                    </div>
                    <Card style={{ padding:0 }}>
                      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                        <thead>
                          <tr style={{ borderBottom:"1px solid var(--border)", background:"var(--surface2)" }}>
                            {["Data","Usuário","Tempo Ativo","Idle","Sessões"].map(h => (
                              <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontWeight:700, color:"var(--muted)", textTransform:"uppercase", fontSize:10 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {usageSummary.map((d,i) => {
                            const activeH = Math.round(Number(d.total_active||0)/3600*10)/10;
                            const idleH   = Math.round(Number(d.total_idle||0)/3600*10)/10;
                            return (
                              <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                                <td style={{ padding:"8px 12px", fontWeight:600 }}>{new Date(d.day).toLocaleDateString("pt-BR")}</td>
                                <td style={{ padding:"8px 12px", color:"var(--muted)" }}>{d.last_user || "—"}</td>
                                <td style={{ padding:"8px 12px", fontWeight:700, color: activeH>=6?"var(--green)":activeH>=3?"var(--yellow)":"var(--red)" }}>{activeH}h</td>
                                <td style={{ padding:"8px 12px", color:"var(--muted)" }}>{idleH}h</td>
                                <td style={{ padding:"8px 12px", color:"var(--muted)" }}>{d.sessions}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </Card>
                  </>
                )}
              </>
            )}

            {tab === "tokens" && (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ fontSize:13, color:"var(--muted)" }}>Tokens vinculam o agente neste PC ao equipamento.</div>
                  <Btn onClick={generateToken}>+ Gerar Token</Btn>
                </div>
                {tokens.length === 0 ? (
                  <Card style={{ textAlign:"center", padding:30, color:"var(--muted)" }}>Nenhum token gerado.</Card>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {tokens.map(t => (
                      <Card key={t.token}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                              <strong style={{ fontSize:13 }}>{t.hostname || "(aguardando primeiro checkin)"}</strong>
                              {t.last_checkin && (Date.now()-new Date(t.last_checkin).getTime())<86400000 ? <StatusBadge status="Online" color="online" icon="●" /> : t.last_checkin ? <StatusBadge status="Offline" color="offline" icon="○" /> : <StatusBadge status="Aguardando" color="warn" icon="⏳" />}
                            </div>
                            <div style={{ fontFamily:"monospace", fontSize:11, color:"var(--muted)", padding:"4px 8px", background:"var(--surface2)", borderRadius:4 }}>{t.token}</div>
                            <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>Criado: {fmtDate(t.created_at)} · Último checkin: {t.last_checkin ? relativeTime(t.last_checkin) : "nunca"}</div>
                          </div>
                          <div style={{ display:"flex", gap:4 }}>
                            <Btn small variant={copied===t.token?"success":"secondary"} onClick={() => copy(t.token, t.token)}>{copied===t.token?"✓ Copiado":"📋 Copiar"}</Btn>
                            <Btn small variant="danger" onClick={() => revokeToken(t.token)}>🗑</Btn>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
                <Card style={{ marginTop:14, background:"rgba(79,142,247,.08)", border:"1px solid rgba(79,142,247,.25)" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--accent)", marginBottom:6 }}>💡 Como instalar</div>
                  <ol style={{ fontSize:12, color:"var(--muted)", paddingLeft:20, lineHeight:1.6 }}>
                    <li>Copie o token acima</li>
                    <li>No PC do cliente, execute o <strong>ALMS-Setup.exe</strong> como Administrador</li>
                    <li>Aguarde a instalação e aprovação automática</li>
                  </ol>
                </Card>
              </>
            )}

            {tab === "history" && (
              <>
                {snapshots.length === 0 ? (
                  <Card style={{ textAlign:"center", padding:30, color:"var(--muted)" }}>Nenhum snapshot recebido ainda.</Card>
                ) : (
                  <Card style={{ padding:0 }}>
                    <table style={{ width:"100%", fontSize:12 }}>
                      <thead>
                        <tr style={{ borderBottom:"1px solid var(--border)" }}>
                          <th style={{ textAlign:"left", padding:"8px 12px", fontWeight:700, color:"var(--muted)" }}>Data/Hora</th>
                          <th style={{ textAlign:"left", padding:"8px 12px", fontWeight:700, color:"var(--muted)" }}>Hostname</th>
                          <th style={{ textAlign:"left", padding:"8px 12px", fontWeight:700, color:"var(--muted)" }}>Uptime</th>
                          <th style={{ textAlign:"left", padding:"8px 12px", fontWeight:700, color:"var(--muted)" }}>IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshots.map(s => (
                          <tr key={s.id} style={{ borderBottom:"1px solid var(--border)" }}>
                            <td style={{ padding:"8px 12px" }}>{fmtDateShort(s.collected_at)}</td>
                            <td style={{ padding:"8px 12px", fontWeight:600 }}>{s.data?.hostname || "—"}</td>
                            <td style={{ padding:"8px 12px", color:"var(--muted)" }}>{s.data?.os?.uptime_hours}h</td>
                            <td style={{ padding:"8px 12px", color:"var(--muted)" }}>{asArray(s.data?.network)[0]?.ip || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
