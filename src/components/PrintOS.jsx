import { LOGO, STATUS } from "../constants";

export default function PrintOS({ os, client, equip, tech, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#fff", zIndex:2000, padding:"36px 56px", color:"#111", fontFamily:"DM Sans,sans-serif", overflowY:"auto" }}>
      <style>{`@media print{.no-print{display:none!important}}`}</style>
      <div className="no-print" style={{ marginBottom:22, display:"flex", gap:8 }}>
        <button onClick={() => window.print()} style={{ background:"#4f8ef7", color:"#fff", border:"none", padding:"10px 22px", borderRadius:8, fontWeight:600, cursor:"pointer" }}>🖨 Imprimir / Salvar PDF</button>
        <button onClick={onClose} style={{ background:"#f0f0f0", border:"none", padding:"10px 22px", borderRadius:8, fontWeight:600, cursor:"pointer" }}>✕ Fechar</button>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", borderBottom:"3px solid #111", paddingBottom:18, marginBottom:22, alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <img src={LOGO} alt="ALMS" style={{ width:56, height:56, objectFit:"contain" }} />
          <div><div style={{ fontSize:22, fontWeight:800 }}>ALMS Tecnologia</div><div style={{ fontSize:12, color:"#555" }}>Assistência Técnica</div></div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:18, fontWeight:800 }}>OS #{String(os.id).padStart(4,"0")}</div>
          <div style={{ fontSize:12, color:"#555", marginTop:4 }}>Abertura: {os.createdAt} | Atualizado: {os.updatedAt}</div>
          <div style={{ fontSize:12, marginTop:5, fontWeight:700 }}>Status: {STATUS[os.status]?.label}</div>
        </div>
      </div>
      {[
        { title:"Cliente",     rows:[["Nome",client?.name],["Telefone",client?.phone],["E-mail",client?.email],["CPF/CNPJ",client?.cpf],["Endereço",client?.address]], twoCol:false },
        { title:"Equipamento", rows:[["Tipo",equip?.type],["Marca",equip?.brand],["Modelo",equip?.model],["Nº Série",equip?.serial],["Colaborador",equip?.collaborator],["Processador",equip?.processor],["Memória RAM",equip?.ram],["Armazenamento",equip?.storage],["Sistema Operacional",equip?.osVersion],["Office",equip?.office],["Defeito",equip?.problem]], twoCol:true },
        { title:"Serviço",     rows:[["Técnico",tech?.name],["Descrição",os.description],["Valor",`R$ ${Number(os.budget).toFixed(2)}`],["Notas",os.technicianNotes||"—"]], twoCol:false },
      ].map(sec => {
        // Para 2 colunas, divide as linhas em pares
        const half = Math.ceil(sec.rows.length / 2);
        const col1 = sec.twoCol ? sec.rows.slice(0, half) : sec.rows;
        const col2 = sec.twoCol ? sec.rows.slice(half) : [];
        const renderTable = (rows) => (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <tbody>{rows.map(([k,v]) => <tr key={k} style={{ borderBottom:"1px solid #e5e5e5" }}><td style={{ padding:"7px 10px", width:"40%", fontSize:12, color:"#666", fontWeight:600 }}>{k}</td><td style={{ padding:"7px 10px", fontSize:13 }}>{v||"—"}</td></tr>)}</tbody>
          </table>
        );
        return (
          <div key={sec.title} style={{ marginBottom:18 }}>
            <div style={{ background:"#111", color:"#fff", padding:"5px 12px", borderRadius:5, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:8, textTransform:"uppercase" }}>{sec.title}</div>
            {sec.twoCol ? (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
                {renderTable(col1)}
                {renderTable(col2)}
              </div>
            ) : renderTable(sec.rows)}
          </div>
        );
      })}
      {(os.history||[]).length > 0 && (
        <div className="no-print" style={{ marginBottom:18 }}>
          <div style={{ background:"#555", color:"#fff", padding:"5px 12px", borderRadius:5, fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:8, textTransform:"uppercase" }}>Histórico</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <tbody>{os.history.map((h,i) => <tr key={i} style={{ borderBottom:"1px solid #eee" }}><td style={{ padding:"5px 10px", width:"25%", fontSize:11, color:"#888" }}>{h.date}</td><td style={{ padding:"5px 10px", width:"18%", fontSize:11, fontWeight:600 }}>{h.user}</td><td style={{ padding:"5px 10px", fontSize:11, color:"#555" }}>{h.action} — {h.detail}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:50, marginTop:48 }}>
        {["Assinatura do Cliente","Assinatura do Técnico"].map(l => <div key={l} style={{ textAlign:"center" }}><div style={{ borderTop:"1px solid #aaa", paddingTop:7, fontSize:12, color:"#666" }}>{l}</div></div>)}
      </div>
    </div>
  );
}
