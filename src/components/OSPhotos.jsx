import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { apiGet, apiPost, apiDelete } from "../api";
import { Btn } from "./ui";

const TIPOS = [
  { id:"antes",   label:"📷 Antes",   color:"var(--yellow)" },
  { id:"depois",  label:"✅ Depois",  color:"var(--green)"  },
  { id:"defeito", label:"⚠️ Defeito", color:"var(--red)"    },
  { id:"outro",   label:"📎 Outro",   color:"var(--muted)"  },
];

export default function OSPhotos({ osId }) {
  const [photos, setPhotos]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState(null);
  const [tipo, setTipo]           = useState("antes");
  const inputRef = useRef();

  const load = () => {
    setLoading(true);
    apiGet(`/api/os/${osId}/photos`).then(d => {
      setPhotos(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  };

  useEffect(() => { if (osId) load(); }, [osId]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1];
      await apiPost(`/api/os/${osId}/photos`, {
        name: file.name, tipo, data: base64, mimeType: file.type,
      });
      load();
      setUploading(false);
      inputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const del = async (id) => {
    await apiDelete(`/api/os/photos/${id}`);
    setPhotos(ps => ps.filter(p => p.id !== id));
  };

  const openPhoto = async (photo) => {
    const d = await apiGet(`/api/os/photos/${photo.id}/data`);
    setPreview({ ...photo, data: d.data, mimeType: d.mime_type });
  };

  const grouped = TIPOS.reduce((acc, t) => {
    acc[t.id] = photos.filter(p => p.tipo === t.id);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:6 }}>
          {TIPOS.map(t => (
            <button key={t.id} onClick={() => setTipo(t.id)} style={{
              padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
              background: tipo===t.id ? t.color+"22" : "var(--surface2)",
              border: `1px solid ${tipo===t.id ? t.color : "var(--border)"}`,
              color: tipo===t.id ? t.color : "var(--muted)",
            }}>{t.label}</button>
          ))}
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }} />
        <Btn onClick={() => inputRef.current.click()} disabled={uploading}>
          {uploading ? "⏳ Enviando..." : "📷 Adicionar Foto"}
        </Btn>
      </div>

      {loading ? (
        <div style={{ color:"var(--muted)", fontSize:13 }}>Carregando fotos...</div>
      ) : photos.length === 0 ? (
        <div style={{ textAlign:"center", padding:"32px 0", color:"var(--muted)" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📷</div>
          <div style={{ fontSize:13 }}>Nenhuma foto anexada</div>
        </div>
      ) : (
        <div>
          {TIPOS.filter(t => grouped[t.id]?.length > 0).map(t => (
            <div key={t.id} style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:t.color, textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>
                {t.label} ({grouped[t.id].length})
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {grouped[t.id].map(p => (
                  <div key={p.id} style={{ position:"relative", width:100 }}>
                    <div onClick={() => openPhoto(p)} style={{
                      width:100, height:100, borderRadius:8, border:"1px solid var(--border)",
                      background:"var(--surface2)", cursor:"pointer", display:"flex",
                      alignItems:"center", justifyContent:"center", fontSize:32,
                    }}>📷</div>
                    <div style={{ fontSize:10, color:"var(--muted)", textAlign:"center", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {p.name}
                    </div>
                    <button onClick={() => del(p.id)} style={{
                      position:"absolute", top:2, right:2, width:18, height:18, borderRadius:99,
                      background:"#e55b5b", color:"#fff", border:"none", fontSize:10,
                      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                    }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && createPortal(
        <div onClick={() => setPreview(null)} style={{
          position:"fixed", top:0, left:0, right:0, bottom:0,
          background:"rgba(0,0,0,.9)", zIndex:99999,
          display:"flex", alignItems:"center", justifyContent:"center", padding:24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)",
            maxWidth:800, width:"100%", maxHeight:"90vh",
            display:"flex", flexDirection:"column",
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ fontWeight:600, fontSize:14 }}>{preview.name}</div>
              <button onClick={() => setPreview(null)} style={{ background:"transparent", border:"none", color:"var(--muted)", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ padding:16, textAlign:"center", overflowY:"auto", flex:1 }}>
              <img
                src={"data:" + preview.mimeType + ";base64," + preview.data}
                alt={preview.name}
                style={{ maxWidth:"100%", maxHeight:"75vh", borderRadius:8, objectFit:"contain" }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
