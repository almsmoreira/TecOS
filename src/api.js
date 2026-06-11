const TOKEN_KEY = "techos_jwt";

export const getToken  = ()       => localStorage.getItem(TOKEN_KEY);
export const setToken  = (t)      => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = ()      => localStorage.removeItem(TOKEN_KEY);

function headers(extra = {}) {
  const t = getToken();
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra };
}

async function handle(r) {
  if (r.status === 401) { clearToken(); window.location.reload(); return null; }
  return r.json();
}

export const apiGet  = (path)       => fetch(path, { headers: headers() }).then(handle);
export const apiPost   = (path, body) => fetch(path, { method:"POST",   headers: headers(), body: JSON.stringify(body) }).then(handle);
export const apiPut    = (path, body) => fetch(path, { method:"PUT",    headers: headers(), body: JSON.stringify(body) }).then(handle);
export const apiDelete = (path)       => fetch(path, { method:"DELETE", headers: headers() }).then(handle);

export async function login(username, password) {
  const r = await fetch("/api/auth/login", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ username, password }) });
  const data = await r.json();
  if (data.token) setToken(data.token);
  return data;
}

export function logout() { clearToken(); }

// ── Vault ──────────────────────────────────────────────────────────────────
export const getVault      = (clientId)      => apiGet(`/api/vault/${clientId}`);
export const addCredential = (data)          => apiPost('/api/vault/credential', data);
export const updCredential = (id, data)      => fetch(`/api/vault/credential/${id}`, { method:'PUT',  headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`}, body:JSON.stringify(data) }).then(r=>r.json());
export const delCredential = (id)            => fetch(`/api/vault/credential/${id}`, { method:'DELETE', headers:{Authorization:`Bearer ${getToken()}`} }).then(r=>r.json());
export const addFile       = (data)          => apiPost('/api/vault/file', data);
export const getFile       = (id)            => apiGet(`/api/vault/file/${id}`);
export const delFile       = (id)            => fetch(`/api/vault/file/${id}`,  { method:'DELETE', headers:{Authorization:`Bearer ${getToken()}`} }).then(r=>r.json());

// ── Client type ────────────────────────────────────────────────────────────
export const toggleClientType = (id, client_type) =>
  fetch(`/api/clients/${id}/type`, { method:'PATCH', headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`}, body:JSON.stringify({client_type}) }).then(r=>r.json());

// ── Chamados ────────────────────────────────────────────────────────────────
export const getChamados    = ()       => apiGet('/api/chamados');
export const addChamado     = (data)   => apiPost('/api/chamados', data);
export const updChamado     = (id, d)  => fetch(`/api/chamados/${id}`,{method:'PUT',headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`},body:JSON.stringify(d)}).then(r=>r.json());
export const delChamado     = (id)     => fetch(`/api/chamados/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${getToken()}`}}).then(r=>r.json());
export const convertChamado = (id, d)  => fetch(`/api/chamados/${id}/convert`,{method:'POST',headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`},body:JSON.stringify(d)}).then(r=>r.json());

// ── Delete direto (imediato, sem esperar auto-save) ────────────────────────
export const deleteOS        = (id) => fetch(`/api/os/${id}`,        { method:'DELETE', headers:{Authorization:`Bearer ${getToken()}`} }).then(r=>r.json());
export const deleteClient    = (id) => fetch(`/api/clients/${id}`,   { method:'DELETE', headers:{Authorization:`Bearer ${getToken()}`} }).then(r=>r.json());
export const deleteEquipment = (id) => fetch(`/api/equipment/${id}`, { method:'DELETE', headers:{Authorization:`Bearer ${getToken()}`} }).then(r=>r.json());

// ── Financeiro ──────────────────────────────────────────────────────────────
export const getFinancialSummary = () => apiGet('/api/financial/summary');

// ── Mensalidades ────────────────────────────────────────────────────────────
export const getBillings        = (month) => apiGet('/api/billings' + (month ? '?month=' + month : ''));
export const generateBillings   = (month) => apiPost('/api/billings/generate', {month});
export const updBilling         = (id, d)  => fetch(`/api/billings/${id}`,{method:'PUT',headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`},body:JSON.stringify(d)}).then(r=>r.json());
export const delBilling         = (id)     => fetch(`/api/billings/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${getToken()}`}}).then(r=>r.json());
export const sendBilling        = (id, method) => apiPost(`/api/billings/${id}/send`,{method});

// ── Config do sistema ────────────────────────────────────────────────────────
export const getSystemConfig    = ()       => apiGet('/api/settings/config');
export const saveSystemConfig   = (data)   => apiPost('/api/settings/config', data);
