import { useState } from "react";
import { LOGO } from "../constants";
import { Card, Field, Btn } from "./ui";

export default function Login({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!u || !p) { setErr("Preencha todos os campos."); return; }
    setLoading(true);
    const res = await onLogin(u, p);
    if (!res.ok) { setErr(res.error || "Erro ao autenticar."); setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"radial-gradient(ellipse at 60% 20%,#1a2240 0%,var(--bg) 65%)" }}>
      <div style={{ width:"100%", maxWidth:370, padding:16 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <img src={LOGO} alt="ALMS Tecnologia" style={{ width:90, height:90, objectFit:"contain", marginBottom:12 }} />
          <h1 style={{ fontFamily:"var(--fh)", fontSize:26, fontWeight:800 }}>ALMS Tecnologia</h1>
          <p style={{ color:"var(--muted)", fontSize:13, marginTop:3 }}>Sistema de Ordem de Serviço</p>
        </div>
        <Card>
          <Field label="Usuário">
            <input value={u} onChange={e => setU(e.target.value)} placeholder="admin" />
          </Field>
          <Field label="Senha">
            <input type="password" value={p} onChange={e => setP(e.target.value)} placeholder="••••••••"
              onKeyDown={e => e.key === "Enter" && handle()} />
          </Field>
          {err && <p style={{ color:"var(--red)", fontSize:13, marginBottom:12 }}>⚠ {err}</p>}
          <Btn onClick={handle} disabled={loading} style={{ width:"100%", justifyContent:"center" }}>
            {loading ? "Entrando…" : "Entrar"}
          </Btn>
        </Card>
      </div>
    </div>
  );
}
