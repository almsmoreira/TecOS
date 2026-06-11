import { useState, useEffect } from "react";
import { apiGet, apiPost } from "../api";
import { Card } from "../components/ui";

export default function Webhook() {
  const [cfg, setCfg] = useState(null);
  const [copied, setCopied] = useState("");
  const [rotating, setRotating] = useState(false);

  const host           = window.location.origin;
  const webhookOsUrl   = `${host}/api/webhook/os`;
  const webhookChamUrl = `${host}/api/webhook/chamado`;

  useEffect(() => { apiGet("/api/config").then(setCfg).catch(() => {}); }, []);

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const rotate = async () => {
    if (!window.confirm("Isso invalidará o token atual. Continuar?")) return;
    setRotating(true);
    const c = await apiPost("/api/config/rotate-token", {});
    setCfg(c);
    setRotating(false);
  };

  const token = cfg?.webhookToken || "Carregando...";

  const CopyBtn = ({ text, label }) => (
    <button type="button" onClick={() => copy(text, label)} style={{
      background:"transparent", border:"1px solid var(--border)", color:"var(--muted)",
      padding:"8px 12px", borderRadius:8, cursor:"pointer", whiteSpace:"nowrap", fontSize:12,
    }}>
      {copied === label ? "✓ Copiado!" : "📋 Copiar"}
    </button>
  );

  const curlOS = `curl -X POST ${webhookOsUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: ${token}" \\
  -d '{
    "client_name": "João Silva",
    "client_phone": "43987654321",
    "description": "Notebook não liga",
    "equipment_type": "Notebook",
    "equipment_brand": "Dell",
    "source": "n8n"
  }'`;

  const curlChamado = `curl -X POST ${webhookChamUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: ${token}" \\
  -d '{
    "client_name": "Maria Oliveira",
    "client_phone": "43991234567",
    "title": "Sem acesso à internet",
    "description": "Rede caiu desde ontem",
    "priority": "alta",
    "source": "chatwoot"
  }'`;

  return (
    <div className="fu">
      <h2 style={{ fontFamily:"var(--fh)", fontSize:24, marginBottom:6 }}>Webhook</h2>
      <p style={{ color:"var(--muted)", fontSize:14, marginBottom:22 }}>
        Receba chamados e OS automaticamente de n8n, Chatwoot, Typebot e outros sistemas.
      </p>

      {/* Token */}
      <Card style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, color:"var(--muted)", fontWeight:700, letterSpacing:".5px", textTransform:"uppercase", marginBottom:10 }}>🔑 Token de Autenticação</div>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
          <input readOnly value={token} style={{ fontSize:12, fontFamily:"monospace", flex:1 }} />
          <CopyBtn text={token} label="token" />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button type="button" onClick={rotate} disabled={rotating} style={{ background:"rgba(229,91,91,.12)", border:"1px solid rgba(229,91,91,.25)", color:"#e55b5b", padding:"6px 14px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:600 }}>
            {rotating ? "Gerando..." : "🔄 Gerar Novo Token"}
          </button>
          <span style={{ fontSize:12, color:"var(--muted)" }}>Header: <code style={{ color:"var(--yellow)" }}>x-webhook-token: TOKEN</code></span>
        </div>
      </Card>

      {/* OS Webhook */}
      <Card style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ background:"rgba(79,142,247,.15)", color:"var(--accent)", borderRadius:99, padding:"3px 10px", fontSize:11 }}>POST</span>
          📋 Webhook — Ordem de Serviço
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
          <input readOnly value={webhookOsUrl} style={{ fontSize:13, flex:1 }} />
          <CopyBtn text={webhookOsUrl} label="url-os" />
        </div>
        <p style={{ fontSize:12, color:"var(--muted)", marginBottom:12 }}>
          Cria uma OS diretamente. Campos principais: <code style={{ color:"var(--accent)" }}>client_name, client_phone, description, equipment_type, equipment_brand, equipment_model, source</code>
        </p>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <span style={{ fontSize:11, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:".5px" }}>Exemplo cURL</span>
          <CopyBtn text={curlOS} label="curl-os" />
        </div>
        <pre style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, padding:14, fontSize:12, color:"var(--green)", overflowX:"auto", lineHeight:1.6, fontFamily:"monospace" }}>{curlOS}</pre>
      </Card>

      {/* Chamado Webhook */}
      <Card style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ background:"rgba(155,114,247,.15)", color:"var(--purple)", borderRadius:99, padding:"3px 10px", fontSize:11 }}>POST</span>
          📬 Webhook — Chamado
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
          <input readOnly value={webhookChamUrl} style={{ fontSize:13, flex:1 }} />
          <CopyBtn text={webhookChamUrl} label="url-chamado" />
        </div>
        <p style={{ fontSize:12, color:"var(--muted)", marginBottom:12 }}>
          Abre um chamado leve (sem equipamento/valor). Ideal para triagem via chat. Campos: <code style={{ color:"var(--accent)" }}>client_name, client_phone, title, description, priority (baixa/normal/alta/urgente), source</code>
        </p>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <span style={{ fontSize:11, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:".5px" }}>Exemplo cURL</span>
          <CopyBtn text={curlChamado} label="curl-chamado" />
        </div>
        <pre style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, padding:14, fontSize:12, color:"var(--purple)", overflowX:"auto", lineHeight:1.6, fontFamily:"monospace" }}>{curlChamado}</pre>
      </Card>

      {/* n8n tip */}
      <Card>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>💡 Integração com n8n</div>
        <div style={{ fontSize:13, color:"var(--muted)", lineHeight:1.7 }}>
          Use um nó <strong style={{ color:"var(--text)" }}>HTTP Request</strong>:<br />
          • Method: <code>POST</code><br />
          • URL: URL do webhook acima<br />
          • Headers: <code>x-webhook-token</code> com o token<br />
          • Body (JSON): campos conforme o endpoint escolhido
        </div>
      </Card>
    </div>
  );
}
