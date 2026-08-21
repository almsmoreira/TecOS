/**
 * TechOS — ALMS Tecnologia
 * Backend monolítico Node/Express
 * Módulos: Auth, Clientes, Equipamentos, Ordens de Serviço, Vault,
 *          Financeiro, Billing, Chamados, Agente v2, Bot Telegram,
 *          Monitor WAN (UniFi), Licenças, Auditoria
 */

'use strict';

// ─── Dependências ────────────────────────────────────────────────────────────
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const { Pool }     = require('pg');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const https        = require('https');
const http         = require('http');
const multer       = require('multer');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Banco de dados ───────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

// ─── Configurações globais ────────────────────────────────────────────────────
const JWT_SECRET   = process.env.JWT_SECRET  || 'changeme';
const JWT_EXPIRES  = process.env.JWT_EXPIRES || '7d';
const VAULT_KEY    = process.env.VAULT_KEY   || 'changeme-vault-key';
const REGISTER_SECRET = process.env.REGISTER_SECRET || 'changeme';

// Telegram
const TG_TOKEN   = process.env.TELEGRAM_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Evolution / WhatsApp
const EVO_URL      = process.env.EVOLUTION_URL;
const EVO_KEY      = process.env.EVOLUTION_KEY;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;
const EVO_MY_NUM   = process.env.EVOLUTION_MY_NUMBER;

// PIX
const PIX_KEY  = process.env.PIX_KEY;
const PIX_NAME = process.env.PIX_NAME || 'ALMS Tecnologia';
const PIX_CITY = process.env.PIX_CITY || 'Londrina';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Utilitários de criptografia (Vault) ─────────────────────────────────────
const ALGO = 'aes-256-cbc';

function vaultEncrypt(text) {
  if (!text) return text;
  const key = crypto.scryptSync(VAULT_KEY, 'alms_salt', 32);
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

function vaultDecrypt(enc) {
  if (!enc || !enc.includes(':')) return enc;
  try {
    const key = crypto.scryptSync(VAULT_KEY, 'alms_salt', 32);
    const [ivHex, dataHex] = enc.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch { return enc; }
}

// ─── Autenticação JWT ─────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito' });
  next();
}

// ─── Audit log ────────────────────────────────────────────────────────────────
async function auditLog(userId, username, action, entity, entityId, details, ip) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id,username,action,entity,entity_id,details,ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, username, action, entity, String(entityId || ''), details || {}, ip || '']
    );
  } catch {}
}

// ─── Schema / migrations idempotentes ────────────────────────────────────────
async function initSchema() {
  const client = await pool.connect();
  try {
    // Tabelas que podem não existir em bancos antigos
    await client.query(`
      CREATE TABLE IF NOT EXISTS config (
        key   VARCHAR(100) PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS billings (
        id          BIGSERIAL PRIMARY KEY,
        client_id   BIGINT REFERENCES clients(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
        month       VARCHAR(7) NOT NULL,
        amount      NUMERIC(10,2) DEFAULT 0,
        status      VARCHAR(20) DEFAULT 'pendente',
        send_method VARCHAR(20) DEFAULT 'whatsapp',
        sent_at     TIMESTAMP,
        paid_at     TIMESTAMP,
        notes       TEXT DEFAULT '',
        created_at  TIMESTAMP DEFAULT now(),
        os_id       BIGINT REFERENCES orders(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS chamados (
        id            BIGSERIAL PRIMARY KEY,
        client_id     BIGINT REFERENCES clients(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
        client_name   VARCHAR(255) DEFAULT '',
        client_phone  VARCHAR(100) DEFAULT '',
        client_email  VARCHAR(255) DEFAULT '',
        title         VARCHAR(255) NOT NULL,
        description   TEXT DEFAULT '',
        priority      VARCHAR(20) DEFAULT 'normal',
        status        VARCHAR(20) DEFAULT 'aberto',
        source        VARCHAR(50) DEFAULT 'manual',
        technician_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        os_id         BIGINT REFERENCES orders(id) ON DELETE SET NULL,
        created_at    TIMESTAMP DEFAULT now(),
        updated_at    TIMESTAMP DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id                  BIGSERIAL PRIMARY KEY,
        description         TEXT NOT NULL,
        category            VARCHAR(100) DEFAULT 'Outros',
        amount              NUMERIC(12,2) DEFAULT 0 NOT NULL,
        due_date            DATE NOT NULL,
        status              VARCHAR(20) DEFAULT 'pendente',
        paid_at             DATE,
        payment_method      VARCHAR(50) DEFAULT '',
        recurring           BOOLEAN DEFAULT false,
        frequency           VARCHAR(20) DEFAULT 'mensal',
        parent_recurring_id BIGINT,
        notes               TEXT DEFAULT '',
        created_at          TIMESTAMP DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS licenses (
        id           BIGSERIAL PRIMARY KEY,
        client_id    BIGINT REFERENCES clients(id) ON DELETE CASCADE,
        equipment_id BIGINT REFERENCES equipment(id) ON DELETE SET NULL,
        name         VARCHAR(255) NOT NULL,
        type         VARCHAR(50) DEFAULT 'software',
        key          VARCHAR(500),
        seats        INTEGER DEFAULT 1,
        expires_at   DATE,
        alert_days   INTEGER DEFAULT 30,
        status       VARCHAR(20) DEFAULT 'ativa',
        notes        TEXT,
        created_at   TIMESTAMP DEFAULT now(),
        updated_at   TIMESTAMP DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS telegram_state (
        chat_id           VARCHAR(50) PRIMARY KEY,
        pending_chamado   JSONB,
        conversa_memoria  JSONB,
        modo_silencioso   BIGINT,
        assistente_config JSONB DEFAULT '{"nome":"ALMS","humor":true}',
        updated_at        TIMESTAMP DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id        BIGSERIAL PRIMARY KEY,
        user_id   INTEGER,
        username  VARCHAR(100),
        action    VARCHAR(50),
        entity    VARCHAR(50),
        entity_id VARCHAR(100),
        details   JSONB DEFAULT '{}',
        ip        VARCHAR(50),
        created_at TIMESTAMP DEFAULT now()
      );
    `);

    // Coluna category no vault (pode não existir em backups antigos)
    await client.query(`
      ALTER TABLE vault_credentials ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'geral';
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES clients(id) ON DELETE SET NULL;
      ALTER TABLE agent_tokens ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
    `).catch(() => {});

    console.log('[DB] Schema verificado/atualizado');
  } finally {
    client.release();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ROTAS
// ═════════════════════════════════════════════════════════════════════════════

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Dados incompletos' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    if (!rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, username, password, role, secret } = req.body;
  if (secret !== REGISTER_SECRET) return res.status(403).json({ error: 'Secret inválido' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (name,username,password,role) VALUES ($1,$2,$3,$4) RETURNING id,name,username,role',
      [name, username, hash, role || 'tecnico']
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id,name,username,role FROM users WHERE id=$1', [req.user.id]);
    // frontend espera { user: {...} }
    res.json({ user: rows[0] || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Rota /api/data — carrega/salva tudo de uma vez (compatibilidade App.jsx) ─
app.get('/api/data', authMiddleware, async (req, res) => {
  try {
    const [usersR, clientsR, equipR, osR] = await Promise.all([
      pool.query('SELECT id,name,username,role FROM users ORDER BY name'),
      pool.query('SELECT * FROM clients ORDER BY name'),
      pool.query(`SELECT e.*, c.name as client_name FROM equipment e LEFT JOIN clients c ON e.client_id=c.id ORDER BY c.name, e.brand`),
      pool.query(`SELECT o.*, c.name as client_name, e.brand, e.model, e.type as equip_type, u.name as technician_name
                  FROM orders o
                  LEFT JOIN clients c ON o.client_id=c.id
                  LEFT JOIN equipment e ON o.equipment_id=e.id
                  LEFT JOIN users u ON o.technician_id=u.id
                  ORDER BY o.created_at DESC`),
    ]);

    // normaliza campos para o formato que o frontend usa (camelCase)
    const normalizeOS = (o) => ({
      ...o,
      clientId:      o.client_id,
      equipmentId:   o.equipment_id,
      technicianId:  o.technician_id,
      technicianNotes: o.technician_notes,
      createdAt:     o.created_at,
      updatedAt:     o.updated_at,
      history:       [],
      photos:        [],
    });

    const normalizeEquip = (e) => ({
      ...e,
      clientId: e.client_id,
    });

    res.json({
      users:     usersR.rows,
      clients:   clientsR.rows,
      equipment: equipR.rows.map(normalizeEquip),
      os:        osR.rows.map(normalizeOS),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/data', authMiddleware, async (req, res) => {
  // O frontend faz auto-save via esta rota — ignoramos pois gerenciamos pelo banco
  res.json({ ok: true });
});

// ─── Usuários ─────────────────────────────────────────────────────────────────
app.get('/api/users', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT id,name,username,role FROM users ORDER BY name');
  res.json(rows);
});

app.post('/api/users', authMiddleware, adminOnly, async (req, res) => {
  const { name, username, password, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (name,username,password,role) VALUES ($1,$2,$3,$4) RETURNING id,name,username,role',
      [name, username, hash, role || 'tecnico']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, username, password, role } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET name=$1,username=$2,password=$3,role=$4 WHERE id=$5',
        [name, username, hash, role, req.params.id]);
    } else {
      await pool.query('UPDATE users SET name=$1,username=$2,role=$3 WHERE id=$4',
        [name, username, role, req.params.id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
  await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── Clientes ─────────────────────────────────────────────────────────────────
app.get('/api/clients', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients ORDER BY name');
  res.json(rows);
});

app.get('/api/clients/:id', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
  res.json(rows[0]);
});

app.post('/api/clients', authMiddleware, async (req, res) => {
  const { name, phone, email, cpf, address, client_type, monthly_value, billing_day, billing_email, parent_id } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO clients (name,phone,email,cpf,address,client_type,monthly_value,billing_day,billing_email,parent_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, phone||'', email||'', cpf||'', address||'', client_type||'avulso',
       monthly_value||0, billing_day||1, billing_email||'', parent_id||null]
    );
    await auditLog(req.user.id, req.user.username, 'CREATE', 'client', rows[0].id, { name }, req.ip);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/clients/:id', authMiddleware, async (req, res) => {
  const { name, phone, email, cpf, address, client_type, monthly_value, billing_day, billing_email, parent_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE clients SET name=$1,phone=$2,email=$3,cpf=$4,address=$5,client_type=$6,
       monthly_value=$7,billing_day=$8,billing_email=$9,parent_id=$10 WHERE id=$11 RETURNING *`,
      [name, phone||'', email||'', cpf||'', address||'', client_type||'avulso',
       monthly_value||0, billing_day||1, billing_email||'', parent_id||null, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/clients/:id', authMiddleware, adminOnly, async (req, res) => {
  await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// Contatos do cliente
app.get('/api/clients/:id/contacts', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM client_contacts WHERE client_id=$1', [req.params.id]);
  res.json(rows);
});

app.post('/api/clients/:id/contacts', authMiddleware, async (req, res) => {
  const { phone, contato_nome } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO client_contacts (phone,client_id,contato_nome) VALUES ($1,$2,$3) ON CONFLICT (phone) DO UPDATE SET contato_nome=$3 RETURNING *',
      [phone, req.params.id, contato_nome || '']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/clients/:id/contacts/:phone', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM client_contacts WHERE client_id=$1 AND phone=$2', [req.params.id, req.params.phone]);
  res.json({ ok: true });
});

// ─── Equipamentos ─────────────────────────────────────────────────────────────
app.get('/api/equipment', authMiddleware, async (req, res) => {
  const { client_id } = req.query;
  let q = 'SELECT e.*, c.name as client_name FROM equipment e LEFT JOIN clients c ON e.client_id=c.id';
  const params = [];
  if (client_id) { q += ' WHERE e.client_id=$1'; params.push(client_id); }
  q += ' ORDER BY c.name, e.type, e.brand';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

app.get('/api/equipment/:id', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT e.*, c.name as client_name FROM equipment e LEFT JOIN clients c ON e.client_id=c.id WHERE e.id=$1',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Equipamento não encontrado' });
  res.json(rows[0]);
});

app.post('/api/equipment', authMiddleware, async (req, res) => {
  const { client_id, type, brand, model, serial, problem, remote_user, remote_id, remote_pass,
          os_version, office, ram, processor, storage, collaborator, ip_address, extra_info, device_name } = req.body;
  try {
    const id = Date.now();
    const { rows } = await pool.query(
      `INSERT INTO equipment (id,client_id,type,brand,model,serial,problem,remote_user,remote_id,remote_pass,
       os_version,office,ram,processor,storage,collaborator,ip_address,extra_info,device_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [id, client_id||null, type||'', brand||'', model||'', serial||'', problem||'',
       remote_user||'', remote_id||'', remote_pass||'', os_version||'', office||'',
       ram||'', processor||'', storage||'', collaborator||'', ip_address||'',
       extra_info||{}, device_name||'']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/equipment/:id', authMiddleware, async (req, res) => {
  const { client_id, type, brand, model, serial, problem, remote_user, remote_id, remote_pass,
          os_version, office, ram, processor, storage, collaborator, ip_address, extra_info, device_name } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE equipment SET client_id=$1,type=$2,brand=$3,model=$4,serial=$5,problem=$6,
       remote_user=$7,remote_id=$8,remote_pass=$9,os_version=$10,office=$11,ram=$12,
       processor=$13,storage=$14,collaborator=$15,ip_address=$16,extra_info=$17,device_name=$18
       WHERE id=$19 RETURNING *`,
      [client_id||null, type||'', brand||'', model||'', serial||'', problem||'',
       remote_user||'', remote_id||'', remote_pass||'', os_version||'', office||'',
       ram||'', processor||'', storage||'', collaborator||'', ip_address||'',
       extra_info||{}, device_name||'', req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/equipment/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM equipment WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── Ordens de Serviço ────────────────────────────────────────────────────────
app.get('/api/orders', authMiddleware, async (req, res) => {
  const { client_id, status, paid } = req.query;
  let q = `SELECT o.*, c.name as client_name, e.brand, e.model, e.type as equip_type,
            u.name as technician_name
           FROM orders o
           LEFT JOIN clients c ON o.client_id=c.id
           LEFT JOIN equipment e ON o.equipment_id=e.id
           LEFT JOIN users u ON o.technician_id=u.id`;
  const where = []; const params = [];
  if (client_id) { where.push(`o.client_id=$${params.length+1}`); params.push(client_id); }
  if (status)    { where.push(`o.status=$${params.length+1}`);    params.push(status); }
  if (paid !== undefined) { where.push(`o.paid=$${params.length+1}`); params.push(paid === 'true'); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY o.created_at DESC';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

app.get('/api/orders/:id', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.*, c.name as client_name, e.brand, e.model, e.type as equip_type,
            u.name as technician_name
     FROM orders o
     LEFT JOIN clients c ON o.client_id=c.id
     LEFT JOIN equipment e ON o.equipment_id=e.id
     LEFT JOIN users u ON o.technician_id=u.id
     WHERE o.id=$1`, [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'OS não encontrada' });

  // histórico
  const hist = await pool.query('SELECT * FROM order_history WHERE order_id=$1 ORDER BY id', [req.params.id]);
  // fotos
  const photos = await pool.query('SELECT id,name,tipo,mime_type,created_at FROM os_photos WHERE order_id=$1', [req.params.id]);

  res.json({ ...rows[0], history: hist.rows, photos: photos.rows });
});

app.post('/api/orders', authMiddleware, async (req, res) => {
  const { client_id, equipment_id, technician_id, status, description, budget, technician_notes } = req.body;
  try {
    const id = Date.now();
    const { rows } = await pool.query(
      `INSERT INTO orders (id,client_id,equipment_id,technician_id,status,description,budget,technician_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, client_id||null, equipment_id||null, technician_id||null,
       status||'orcamento', description||'', budget||0, technician_notes||'']
    );
    await pool.query(
      `INSERT INTO order_history (order_id,action_date,username,action,detail) VALUES ($1,$2,$3,$4,$5)`,
      [id, new Date().toLocaleDateString('pt-BR'), req.user.username, 'Criação', `OS criada com status: ${status||'orcamento'}`]
    );
    await auditLog(req.user.id, req.user.username, 'CREATE', 'order', id, { client_id, status }, req.ip);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id', authMiddleware, async (req, res) => {
  const { client_id, equipment_id, technician_id, status, description, budget, technician_notes, paid, paid_at } = req.body;
  try {
    const prev = await pool.query('SELECT status, paid FROM orders WHERE id=$1', [req.params.id]);
    const { rows } = await pool.query(
      `UPDATE orders SET client_id=$1,equipment_id=$2,technician_id=$3,status=$4,description=$5,
       budget=$6,technician_notes=$7,paid=$8,paid_at=$9,updated_at=CURRENT_DATE WHERE id=$10 RETURNING *`,
      [client_id||null, equipment_id||null, technician_id||null, status||'orcamento',
       description||'', budget||0, technician_notes||'', paid||false,
       paid_at||null, req.params.id]
    );
    // registra mudança de status no histórico
    if (prev.rows[0]?.status !== status) {
      await pool.query(
        `INSERT INTO order_history (order_id,action_date,username,action,detail) VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, new Date().toLocaleDateString('pt-BR'), req.user.username,
         'Alteração', `Status: ${prev.rows[0]?.status} → ${status}`]
      );
    }
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// Histórico da OS
app.post('/api/orders/:id/history', authMiddleware, async (req, res) => {
  const { action, detail } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO order_history (order_id,action_date,username,action,detail) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, new Date().toLocaleDateString('pt-BR'), req.user.username, action, detail||'']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Fotos da OS
app.get('/api/orders/:id/photos', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM os_photos WHERE order_id=$1 ORDER BY created_at', [req.params.id]);
  res.json(rows);
});

app.post('/api/orders/:id/photos', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    let data, mime_type, name;
    if (req.file) {
      data = req.file.buffer.toString('base64');
      mime_type = req.file.mimetype;
      name = req.file.originalname;
    } else {
      ({ data, mime_type, name } = req.body);
    }
    const tipo = req.body.tipo || 'antes';
    const id = Date.now();
    const { rows } = await pool.query(
      'INSERT INTO os_photos (id,order_id,name,tipo,data,mime_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,tipo,mime_type,created_at',
      [id, req.params.id, name||'foto', tipo, data, mime_type||'image/jpeg']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/:id/photos/:photoId', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM os_photos WHERE id=$1 AND order_id=$2', [req.params.photoId, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Foto não encontrada' });
  res.json(rows[0]);
});

app.delete('/api/orders/:id/photos/:photoId', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM os_photos WHERE id=$1 AND order_id=$2', [req.params.photoId, req.params.id]);
  res.json({ ok: true });
});

// ─── Vault de Credenciais ─────────────────────────────────────────────────────
app.get('/api/vault', authMiddleware, async (req, res) => {
  const { client_id, search, category } = req.query;
  let q = `SELECT vc.*, c.name as client_name FROM vault_credentials vc
           LEFT JOIN clients c ON vc.client_id=c.id`;
  const where = []; const params = [];
  if (client_id) { where.push(`vc.client_id=$${params.length+1}`); params.push(client_id); }
  if (category)  { where.push(`vc.category=$${params.length+1}`);  params.push(category); }
  if (search) {
    where.push(`(vc.title ILIKE $${params.length+1} OR vc.url ILIKE $${params.length+1} OR c.name ILIKE $${params.length+1})`);
    params.push(`%${search}%`);
  }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY c.name, vc.title';
  const { rows } = await pool.query(q, params);
  // descriptografar para retorno
  const result = rows.map(r => ({
    ...r,
    username: vaultDecrypt(r.username),
    password: vaultDecrypt(r.password),
    notes:    vaultDecrypt(r.notes),
  }));
  await auditLog(req.user.id, req.user.username, 'VIEW', 'vault', client_id||'all', { search }, req.ip);
  res.json(result);
});

app.post('/api/vault', authMiddleware, async (req, res) => {
  const { client_id, title, username, password, url, notes, category } = req.body;
  try {
    const id = Date.now();
    const { rows } = await pool.query(
      `INSERT INTO vault_credentials (id,client_id,title,username,password,url,notes,category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, client_id, title, vaultEncrypt(username||''), vaultEncrypt(password||''),
       url||'', vaultEncrypt(notes||''), category||'geral']
    );
    await auditLog(req.user.id, req.user.username, 'CREATE', 'vault', id, { title, client_id }, req.ip);
    res.json({ ...rows[0], username: username||'', password: password||'', notes: notes||'' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/vault/:id', authMiddleware, async (req, res) => {
  const { title, username, password, url, notes, category } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE vault_credentials SET title=$1,username=$2,password=$3,url=$4,notes=$5,category=$6
       WHERE id=$7 RETURNING *`,
      [title, vaultEncrypt(username||''), vaultEncrypt(password||''),
       url||'', vaultEncrypt(notes||''), category||'geral', req.params.id]
    );
    await auditLog(req.user.id, req.user.username, 'UPDATE', 'vault', req.params.id, { title }, req.ip);
    res.json({ ...rows[0], username: username||'', password: password||'', notes: notes||'' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/vault/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM vault_credentials WHERE id=$1', [req.params.id]);
  await auditLog(req.user.id, req.user.username, 'DELETE', 'vault', req.params.id, {}, req.ip);
  res.json({ ok: true });
});

// Arquivos do Vault
app.get('/api/vault/:credId/files', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id,name,file_type,mime_type,created_at FROM vault_files WHERE credential_id=$1',
    [req.params.credId]
  );
  res.json(rows);
});

app.get('/api/vault/files/:id', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM vault_files WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Arquivo não encontrado' });
  const f = rows[0];
  // descriptografar data
  res.json({ ...f, data: vaultDecrypt(f.data) });
});

app.post('/api/vault/:credId/files', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    let data, mime_type, name, file_type;
    if (req.file) {
      data = req.file.buffer.toString('base64');
      mime_type = req.file.mimetype;
      name = req.file.originalname;
      file_type = mime_type.startsWith('image') ? 'image' : 'document';
    } else {
      ({ data, mime_type, name, file_type } = req.body);
    }
    const credRow = await pool.query('SELECT client_id FROM vault_credentials WHERE id=$1', [req.params.credId]);
    if (!credRow.rows.length) return res.status(404).json({ error: 'Credencial não encontrada' });
    const id = Date.now();
    const { rows } = await pool.query(
      `INSERT INTO vault_files (id,client_id,credential_id,name,file_type,data,mime_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,file_type,mime_type,created_at`,
      [id, credRow.rows[0].client_id, req.params.credId, name, file_type||'image', vaultEncrypt(data), mime_type||'image/png']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/vault/files/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM vault_files WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── Serviços (catálogo) ──────────────────────────────────────────────────────
app.get('/api/services', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM services WHERE active=true ORDER BY category,name');
  res.json(rows);
});

app.post('/api/services', authMiddleware, async (req, res) => {
  const { name, description, default_price, category } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO services (name,description,default_price,category) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, description||'', default_price||0, category||'Outros']
  );
  res.json(rows[0]);
});

app.put('/api/services/:id', authMiddleware, async (req, res) => {
  const { name, description, default_price, category, active } = req.body;
  const { rows } = await pool.query(
    'UPDATE services SET name=$1,description=$2,default_price=$3,category=$4,active=$5 WHERE id=$6 RETURNING *',
    [name, description||'', default_price||0, category||'Outros', active!==false, req.params.id]
  );
  res.json(rows[0]);
});

app.delete('/api/services/:id', authMiddleware, async (req, res) => {
  await pool.query('UPDATE services SET active=false WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── Financeiro — Despesas ────────────────────────────────────────────────────
app.get('/api/expenses', authMiddleware, async (req, res) => {
  const { status, category, month } = req.query;
  let q = 'SELECT * FROM expenses';
  const where = []; const params = [];
  if (status)   { where.push(`status=$${params.length+1}`);   params.push(status); }
  if (category) { where.push(`category=$${params.length+1}`); params.push(category); }
  if (month)    {
    where.push(`to_char(due_date,'YYYY-MM')=$${params.length+1}`);
    params.push(month);
  }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY due_date';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

app.post('/api/expenses', authMiddleware, async (req, res) => {
  const { description, category, amount, due_date, status, recurring, frequency, notes, payment_method } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO expenses (description,category,amount,due_date,status,recurring,frequency,notes,payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [description, category||'Outros', amount||0, due_date, status||'pendente',
       recurring||false, frequency||'mensal', notes||'', payment_method||'']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/expenses/:id', authMiddleware, async (req, res) => {
  const { description, category, amount, due_date, status, paid_at, recurring, frequency, notes, payment_method } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE expenses SET description=$1,category=$2,amount=$3,due_date=$4,status=$5,
       paid_at=$6,recurring=$7,frequency=$8,notes=$9,payment_method=$10 WHERE id=$11 RETURNING *`,
      [description, category||'Outros', amount||0, due_date, status||'pendente',
       paid_at||null, recurring||false, frequency||'mensal', notes||'', payment_method||'', req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/expenses/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// Resumo financeiro
app.get('/api/financeiro/resumo', authMiddleware, async (req, res) => {
  const { month } = req.query; // YYYY-MM
  const m = month || new Date().toISOString().slice(0, 7);
  try {
    const receitas = await pool.query(
      `SELECT COALESCE(SUM(budget),0) as total FROM orders WHERE status='concluido' AND to_char(updated_at,'YYYY-MM')=$1 AND paid=true`,
      [m]
    );
    const billing = await pool.query(
      `SELECT COALESCE(SUM(amount),0) as total FROM billings WHERE month=$1 AND status='pago'`, [m]
    );
    const despesas = await pool.query(
      `SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE to_char(due_date,'YYYY-MM')=$1 AND status='pago'`, [m]
    );
    const pendentes = await pool.query(
      `SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE to_char(due_date,'YYYY-MM')=$1 AND status='pendente'`, [m]
    );
    res.json({
      mes: m,
      receitas_os:      parseFloat(receitas.rows[0].total),
      receitas_billing: parseFloat(billing.rows[0].total),
      despesas_pagas:   parseFloat(despesas.rows[0].total),
      despesas_pendentes: parseFloat(pendentes.rows[0].total),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Billing mensal ───────────────────────────────────────────────────────────
app.get('/api/billing', authMiddleware, async (req, res) => {
  const { month, client_id, status } = req.query;
  let q = `SELECT b.*, c.name as client_name, c.phone as client_phone, c.monthly_value
           FROM billings b LEFT JOIN clients c ON b.client_id=c.id`;
  const where = []; const params = [];
  if (month)     { where.push(`b.month=$${params.length+1}`);     params.push(month); }
  if (client_id) { where.push(`b.client_id=$${params.length+1}`); params.push(client_id); }
  if (status)    { where.push(`b.status=$${params.length+1}`);    params.push(status); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY c.name';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

app.post('/api/billing/gerar', authMiddleware, async (req, res) => {
  // Gera cobranças mensais para todos clientes mensalistas do mês informado
  const { month } = req.body; // YYYY-MM
  try {
    const { rows: clients } = await pool.query(
      `SELECT * FROM clients WHERE client_type='mensalista' AND monthly_value > 0`
    );
    const created = [];
    for (const c of clients) {
      // evita duplicata
      const exists = await pool.query('SELECT id FROM billings WHERE client_id=$1 AND month=$2', [c.id, month]);
      if (exists.rows.length) continue;
      const id = Date.now() + Math.floor(Math.random()*1000);
      await pool.query(
        `INSERT INTO billings (id,client_id,month,amount,status) VALUES ($1,$2,$3,$4,'pendente')`,
        [id, c.id, month, c.monthly_value]
      );
      created.push({ id, client_id: c.id, client_name: c.name, amount: c.monthly_value });
    }
    res.json({ geradas: created.length, items: created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/billing/:id', authMiddleware, async (req, res) => {
  const { status, notes, paid_at, send_method, amount } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE billings SET status=$1,notes=$2,paid_at=$3,send_method=$4,amount=$5 WHERE id=$6 RETURNING *`,
      [status, notes||'', paid_at||null, send_method||'whatsapp', amount, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/billing/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM billings WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// Enviar cobrança via WhatsApp
app.post('/api/billing/:id/enviar', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, c.name as client_name, c.phone as client_phone
       FROM billings b LEFT JOIN clients c ON b.client_id=c.id WHERE b.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cobrança não encontrada' });
    const b = rows[0];
    const pix = gerarPixPayload(PIX_KEY, PIX_NAME, PIX_CITY, b.amount, `TECHOS-${b.id}`);
    const msg = `*ALMS Tecnologia*\n\nOlá, ${b.client_name}!\n\nCobrança referente ao mês *${b.month}*:\n\nValor: *R$ ${parseFloat(b.amount).toFixed(2)}*\n\nPIX Copia e Cola:\n\`${pix}\`\n\nDúvidas? Responda esta mensagem.`;
    const phone = (b.client_phone || '').replace(/\D/g, '');
    if (!phone) return res.status(400).json({ error: 'Cliente sem telefone cadastrado' });
    await evolutionSend(phone, msg);
    await pool.query(`UPDATE billings SET sent_at=now(),send_method='whatsapp' WHERE id=$1`, [b.id]);
    res.json({ ok: true, phone });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Chamados ─────────────────────────────────────────────────────────────────
app.get('/api/chamados', authMiddleware, async (req, res) => {
  const { status, client_id, technician_id } = req.query;
  let q = `SELECT ch.*, u.name as technician_name FROM chamados ch
           LEFT JOIN users u ON ch.technician_id=u.id`;
  const where = []; const params = [];
  if (status)       { where.push(`ch.status=$${params.length+1}`);       params.push(status); }
  if (client_id)    { where.push(`ch.client_id=$${params.length+1}`);    params.push(client_id); }
  if (technician_id){ where.push(`ch.technician_id=$${params.length+1}`);params.push(technician_id); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY ch.created_at DESC';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

app.get('/api/chamados/:id', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ch.*, u.name as technician_name FROM chamados ch
     LEFT JOIN users u ON ch.technician_id=u.id WHERE ch.id=$1`, [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Chamado não encontrado' });
  res.json(rows[0]);
});

app.post('/api/chamados', authMiddleware, async (req, res) => {
  const { client_id, client_name, client_phone, client_email, title, description, priority, source, technician_id } = req.body;
  try {
    const id = Date.now();
    const { rows } = await pool.query(
      `INSERT INTO chamados (id,client_id,client_name,client_phone,client_email,title,description,priority,source,technician_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, client_id||null, client_name||'', client_phone||'', client_email||'',
       title, description||'', priority||'normal', source||'manual', technician_id||null]
    );
    // notifica Telegram
    await telegramSend(`🔔 *Novo Chamado #${id}*\n👤 ${client_name||'Desconhecido'}\n📋 ${title}\n⚡ Prioridade: ${priority||'normal'}`);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/chamados/:id', authMiddleware, async (req, res) => {
  const { client_id, title, description, priority, status, technician_id, os_id, client_name, client_phone, client_email } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE chamados SET client_id=$1,title=$2,description=$3,priority=$4,status=$5,
       technician_id=$6,os_id=$7,client_name=$8,client_phone=$9,client_email=$10,updated_at=now()
       WHERE id=$11 RETURNING *`,
      [client_id||null, title, description||'', priority||'normal', status||'aberto',
       technician_id||null, os_id||null, client_name||'', client_phone||'', client_email||'', req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/chamados/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM chamados WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── Licenças ─────────────────────────────────────────────────────────────────
app.get('/api/licenses', authMiddleware, async (req, res) => {
  const { client_id, status } = req.query;
  let q = `SELECT l.*, c.name as client_name, e.brand, e.model FROM licenses l
           LEFT JOIN clients c ON l.client_id=c.id
           LEFT JOIN equipment e ON l.equipment_id=e.id`;
  const where = []; const params = [];
  if (client_id) { where.push(`l.client_id=$${params.length+1}`); params.push(client_id); }
  if (status)    { where.push(`l.status=$${params.length+1}`);    params.push(status); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY l.expires_at NULLS LAST';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

app.post('/api/licenses', authMiddleware, async (req, res) => {
  const { client_id, equipment_id, name, type, key, seats, expires_at, alert_days, status, notes } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO licenses (client_id,equipment_id,name,type,key,seats,expires_at,alert_days,status,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [client_id, equipment_id||null, name, type||'software', key||'', seats||1,
     expires_at||null, alert_days||30, status||'ativa', notes||'']
  );
  res.json(rows[0]);
});

app.put('/api/licenses/:id', authMiddleware, async (req, res) => {
  const { client_id, equipment_id, name, type, key, seats, expires_at, alert_days, status, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE licenses SET client_id=$1,equipment_id=$2,name=$3,type=$4,key=$5,seats=$6,
     expires_at=$7,alert_days=$8,status=$9,notes=$10,updated_at=now() WHERE id=$11 RETURNING *`,
    [client_id, equipment_id||null, name, type||'software', key||'', seats||1,
     expires_at||null, alert_days||30, status||'ativa', notes||'', req.params.id]
  );
  res.json(rows[0]);
});

app.delete('/api/licenses/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM licenses WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── Configurações ────────────────────────────────────────────────────────────
app.get('/api/config', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM config');
  const cfg = {};
  rows.forEach(r => { cfg[r.key] = r.value; });
  res.json(cfg);
});

app.post('/api/config', authMiddleware, adminOnly, async (req, res) => {
  const entries = req.body; // { key: value, ... }
  try {
    for (const [key, value] of Object.entries(entries)) {
      await pool.query(
        'INSERT INTO config (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2',
        [key, value]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────
app.get('/api/audit', authMiddleware, adminOnly, async (req, res) => {
  const { entity, action, limit } = req.query;
  let q = 'SELECT * FROM audit_logs';
  const where = []; const params = [];
  if (entity) { where.push(`entity=$${params.length+1}`); params.push(entity); }
  if (action) { where.push(`action=$${params.length+1}`); params.push(action); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ` ORDER BY created_at DESC LIMIT $${params.length+1}`;
  params.push(parseInt(limit)||200);
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

// ─── Agente v2 ────────────────────────────────────────────────────────────────

// Registro do agente
app.post('/api/agent/register', async (req, res) => {
  const { secret, hostname, equipment_id } = req.body;
  if (secret !== REGISTER_SECRET) return res.status(403).json({ error: 'Secret inválido' });
  try {
    const token = crypto.randomBytes(24).toString('hex');
    await pool.query(
      `INSERT INTO agent_tokens (token,equipment_id,hostname,version)
       VALUES ($1,$2,$3,'2.2')
       ON CONFLICT (token) DO NOTHING`,
      [token, equipment_id||null, hostname||'']
    );
    await pool.query(
      `INSERT INTO agent_config (token) VALUES ($1) ON CONFLICT (token) DO NOTHING`, [token]
    );
    res.json({ token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Middleware de autenticação do agente
function agentAuth(req, res, next) {
  const token = req.headers['x-agent-token'] || req.body?.token;
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  pool.query('SELECT * FROM agent_tokens WHERE token=$1 AND active=true', [token])
    .then(({ rows }) => {
      if (!rows.length) return res.status(401).json({ error: 'Token inválido' });
      req.agentToken = rows[0];
      next();
    })
    .catch(() => res.status(500).json({ error: 'Erro de autenticação' }));
}

// Checkin / heartbeat
app.post('/api/agent/checkin', agentAuth, async (req, res) => {
  const { hostname, version, auto_info } = req.body;
  const tok = req.agentToken;
  try {
    await pool.query(
      `UPDATE agent_tokens SET last_checkin=now(), hostname=COALESCE($1,hostname),
       version=COALESCE($2,version), auto_info=COALESCE($3,auto_info)
       WHERE token=$4`,
      [hostname||null, version||null, auto_info ? JSON.stringify(auto_info) : null, tok.token]
    );
    // config do agente
    const cfg = await pool.query('SELECT * FROM agent_config WHERE token=$1', [tok.token]);
    res.json({ ok: true, config: cfg.rows[0] || {} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Envio de inventário
app.post('/api/agent/inventory', agentAuth, async (req, res) => {
  const tok = req.agentToken;
  const data = req.body;
  try {
    const id = Date.now();
    await pool.query(
      `INSERT INTO inventory_snapshots (id,equipment_id,token,data) VALUES ($1,$2,$3,$4)`,
      [id, tok.equipment_id, tok.token, JSON.stringify(data)]
    );
    // atualiza campos básicos no equipment
    if (tok.equipment_id && data.hardware) {
      const hw = data.hardware;
      await pool.query(
        `UPDATE equipment SET ram=$1, processor=$2, storage=$3, os_version=$4 WHERE id=$5`,
        [hw.ram||'', hw.processor||'', hw.storage||'', hw.os_version||'', tok.equipment_id]
      ).catch(() => {});
    }
    res.json({ ok: true, snapshot_id: id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Alertas do agente
app.post('/api/agent/alert', agentAuth, async (req, res) => {
  const tok = req.agentToken;
  const { alert_type, message, data } = req.body;
  try {
    const id = Date.now();
    await pool.query(
      `INSERT INTO agent_alerts (id,token,equipment_id,alert_type,message,data) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, tok.token, tok.equipment_id, alert_type, message, JSON.stringify(data||{})]
    );
    // Notificar via Telegram
    const equip = tok.equipment_id
      ? (await pool.query('SELECT e.*, c.name as cn FROM equipment e LEFT JOIN clients c ON e.client_id=c.id WHERE e.id=$1', [tok.equipment_id])).rows[0]
      : null;
    const equipInfo = equip ? `🖥️ ${equip.device_name||equip.model} (${equip.cn})` : `Token: ${tok.token.slice(0,8)}...`;
    await telegramSend(`⚠️ *Alerta do Agente*\n${equipInfo}\n🔔 ${alert_type}\n${message}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Uso de sessão
app.post('/api/agent/usage', agentAuth, async (req, res) => {
  const tok = req.agentToken;
  const { event_type, username, session_start, session_end, idle_seconds, active_seconds, processes } = req.body;
  try {
    const id = Date.now();
    await pool.query(
      `INSERT INTO agent_usage (id,equipment_id,token,event_type,username,session_start,session_end,idle_seconds,active_seconds,processes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, tok.equipment_id, tok.token, event_type||'session', username||'',
       session_start||null, session_end||null, idle_seconds||0, active_seconds||0, JSON.stringify(processes||[])]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Listagem de tokens de agente (painel)
app.get('/api/agent/tokens', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT at.*, e.brand, e.model, e.device_name, c.name as client_name
     FROM agent_tokens at
     LEFT JOIN equipment e ON at.equipment_id=e.id
     LEFT JOIN clients c ON e.client_id=c.id
     ORDER BY at.last_checkin DESC NULLS LAST`
  );
  res.json(rows);
});

app.put('/api/agent/tokens/:token/config', authMiddleware, async (req, res) => {
  const { collect_interval_hours, collect_hardware, collect_software,
          collect_network, collect_usage, alert_disk_pct, alert_services } = req.body;
  try {
    await pool.query(
      `INSERT INTO agent_config (token,collect_interval_hours,collect_hardware,collect_software,
       collect_network,collect_usage,alert_disk_pct,alert_services,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT (token) DO UPDATE SET
         collect_interval_hours=$2, collect_hardware=$3, collect_software=$4,
         collect_network=$5, collect_usage=$6, alert_disk_pct=$7,
         alert_services=$8, updated_at=now()`,
      [req.params.token, collect_interval_hours||24, collect_hardware!==false,
       collect_software!==false, collect_network!==false, collect_usage||false,
       alert_disk_pct||10, alert_services||['WinDefend','MpsSvc','EventLog']]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/agent/tokens/:token', authMiddleware, async (req, res) => {
  await pool.query('UPDATE agent_tokens SET active=false WHERE token=$1', [req.params.token]);
  res.json({ ok: true });
});

// Snapshots de inventário
app.get('/api/agent/snapshots/:equipmentId', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, collected_at FROM inventory_snapshots WHERE equipment_id=$1 ORDER BY collected_at DESC LIMIT 30`,
    [req.params.equipmentId]
  );
  res.json(rows);
});

app.get('/api/agent/snapshots/:equipmentId/latest', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM inventory_snapshots WHERE equipment_id=$1 ORDER BY collected_at DESC LIMIT 1`,
    [req.params.equipmentId]
  );
  res.json(rows[0] || null);
});

// ─── UniFi / Monitor WAN ──────────────────────────────────────────────────────
app.get('/api/unifi', authMiddleware, async (req, res) => {
  const { client_id } = req.query;
  let q = `SELECT uc.*, c.name as client_name FROM unifi_connections uc
           LEFT JOIN clients c ON uc.client_id=c.id`;
  const params = [];
  if (client_id) { q += ' WHERE uc.client_id=$1'; params.push(client_id); }
  q += ' ORDER BY c.name';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

app.get('/api/unifi/:id', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM unifi_connections WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Conexão não encontrada' });
  res.json(rows[0]);
});

app.post('/api/unifi', authMiddleware, async (req, res) => {
  const { client_id, name, conn_type, api_key, controller_url, username, password, site_name, host_id } = req.body;
  try {
    const id = Date.now();
    const { rows } = await pool.query(
      `INSERT INTO unifi_connections (id,client_id,name,conn_type,api_key,controller_url,username,password,site_name,host_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, client_id||null, name, conn_type||'cloud', api_key||'', controller_url||'',
       username||'', password||'', site_name||'default', host_id||'']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/unifi/:id', authMiddleware, async (req, res) => {
  const { client_id, name, conn_type, api_key, controller_url, username, password, site_name, host_id, active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE unifi_connections SET client_id=$1,name=$2,conn_type=$3,api_key=$4,controller_url=$5,
       username=$6,password=$7,site_name=$8,host_id=$9,active=$10 WHERE id=$11 RETURNING *`,
      [client_id||null, name, conn_type||'cloud', api_key||'', controller_url||'',
       username||'', password||'', site_name||'default', host_id||'', active!==false, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/unifi/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM unifi_connections WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/unifi/:id/devices', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM unifi_devices WHERE connection_id=$1 ORDER BY name', [req.params.id]
  );
  res.json(rows);
});

// Sincronizar dispositivos UniFi (Cloud Key / Site Manager)
app.post('/api/unifi/:id/sync', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM unifi_connections WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Conexão não encontrada' });
    const conn = rows[0];
    const devices = await unifiGetDevices(conn);
    let synced = 0;
    for (const dev of devices) {
      const devId = Date.now() + synced;
      await pool.query(
        `INSERT INTO unifi_devices (id,connection_id,device_id,mac,name,model,ip,status,version,firmware_status,is_console,clients_wifi,clients_wired,startup_time,last_seen,data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),$15)
         ON CONFLICT (device_id) DO UPDATE SET
           name=$5,ip=$7,status=$8,version=$9,firmware_status=$10,clients_wifi=$12,clients_wired=$13,last_seen=now(),data=$15`,
        [devId, conn.id, dev.id||dev._id, dev.mac||'', dev.name||dev.hostname||'',
         dev.model||'', dev.ip||dev.ip_address||'', dev.state===1?'online':'offline',
         dev.version||'', dev.firmware_upgrade_state||'', dev.type==='uckg'||dev.type==='uckp',
         dev.num_sta||0, dev.num_wired_sta||0, dev.start_time ? new Date(dev.start_time*1000) : null,
         JSON.stringify(dev)]
      );
      synced++;
    }
    // atualizar wan_data
    const wan = await unifiGetWan(conn);
    await pool.query('UPDATE unifi_connections SET last_sync=now(), wan_data=$1 WHERE id=$2', [JSON.stringify(wan), conn.id]);
    res.json({ ok: true, synced, wan });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// WAN status de todas as conexões ativas
app.get('/api/wan/status', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT uc.*, c.name as client_name FROM unifi_connections uc
     LEFT JOIN clients c ON uc.client_id=c.id WHERE uc.active=true ORDER BY c.name`
  );
  res.json(rows.map(r => ({
    id: r.id,
    client_name: r.client_name,
    name: r.name,
    last_sync: r.last_sync,
    wan: r.wan_data,
  })));
});

// ─── Dashboard / Stats ────────────────────────────────────────────────────────
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const [orders, clients, equipment, agentsOffline, openChamados, pendingBilling] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as count FROM orders GROUP BY status`),
      pool.query(`SELECT COUNT(*) as count FROM clients`),
      pool.query(`SELECT COUNT(*) as count FROM equipment`),
      pool.query(`SELECT COUNT(*) as count FROM agent_tokens WHERE active=true AND (last_checkin < now()-interval '2 hours' OR last_checkin IS NULL)`),
      pool.query(`SELECT COUNT(*) as count FROM chamados WHERE status NOT IN ('fechado','cancelado')`),
      pool.query(`SELECT COALESCE(SUM(amount),0) as total FROM billings WHERE status='pendente'`),
    ]);
    const orderMap = {};
    orders.rows.forEach(r => { orderMap[r.status] = parseInt(r.count); });
    res.json({
      orders: orderMap,
      total_clients: parseInt(clients.rows[0].count),
      total_equipment: parseInt(equipment.rows[0].count),
      agents_offline: parseInt(agentsOffline.rows[0].count),
      open_chamados: parseInt(openChamados.rows[0].count),
      pending_billing: parseFloat(pendingBilling.rows[0].total),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Bot Telegram ─────────────────────────────────────────────────────────────

// Webhook do Telegram
app.post('/api/telegram/webhook', async (req, res) => {
  res.sendStatus(200); // responde imediatamente
  try {
    const update = req.body;
    await handleTelegramUpdate(update);
  } catch (e) { console.error('[Telegram]', e.message); }
});

app.post('/api/telegram/send', authMiddleware, async (req, res) => {
  const { message } = req.body;
  try {
    await telegramSend(message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Utilitários de integração ────────────────────────────────────────────────

// Telegram
async function telegramSend(text, chatId) {
  if (!TG_TOKEN) return;
  const chat = chatId || TG_CHAT_ID;
  if (!chat) return;
  try {
    await httpPost(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      chat_id: chat,
      text,
      parse_mode: 'Markdown',
    });
  } catch (e) { console.error('[Telegram send]', e.message); }
}

async function handleTelegramUpdate(update) {
  const msg = update.message || update.callback_query?.message;
  if (!msg) return;
  const chatId = String(msg.chat.id);
  const text   = (msg.text || '').trim();
  const userId = msg.from?.id;

  // carregar/salvar estado da conversa
  const stateRow = await pool.query('SELECT * FROM telegram_state WHERE chat_id=$1', [chatId]);
  let state = stateRow.rows[0] || { chat_id: chatId, conversa_memoria: [], assistente_config: { nome: 'ALMS', humor: true } };

  const memoria = Array.isArray(state.conversa_memoria) ? state.conversa_memoria : [];

  // Comandos básicos
  if (text === '/start' || text === '/ajuda') {
    await telegramSend(
      `*TechOS Bot — ALMS Tecnologia*\n\nComandos:\n` +
      `/status — Resumo do sistema\n` +
      `/chamados — Chamados abertos\n` +
      `/os — Ordens de serviço recentes\n` +
      `/agentes — Status dos agentes\n` +
      `/billing — Cobranças pendentes\n` +
      `/silencio N — Silenciar por N minutos\n\n` +
      `Ou simplesmente me conte o problema do seu cliente!`,
      chatId
    );
    return;
  }

  if (text === '/status') {
    const [ord, ch, ag] = await Promise.all([
      pool.query(`SELECT COUNT(*) c FROM orders WHERE status NOT IN ('concluido','cancelado')`),
      pool.query(`SELECT COUNT(*) c FROM chamados WHERE status='aberto'`),
      pool.query(`SELECT COUNT(*) c FROM agent_tokens WHERE active=true AND last_checkin > now()-interval '2 hours'`),
    ]);
    await telegramSend(
      `📊 *Status TechOS*\n\n` +
      `📋 OS em aberto: *${ord.rows[0].c}*\n` +
      `🔔 Chamados: *${ch.rows[0].c}*\n` +
      `🤖 Agentes online: *${ag.rows[0].c}*`,
      chatId
    );
    return;
  }

  if (text === '/chamados') {
    const { rows } = await pool.query(
      `SELECT ch.id, ch.title, ch.priority, ch.client_name FROM chamados ch WHERE ch.status='aberto' ORDER BY ch.created_at DESC LIMIT 10`
    );
    if (!rows.length) { await telegramSend('✅ Nenhum chamado aberto.', chatId); return; }
    const list = rows.map(r => `#${r.id} [${r.priority}] ${r.client_name||'?'} — ${r.title}`).join('\n');
    await telegramSend(`🔔 *Chamados Abertos*\n\n${list}`, chatId);
    return;
  }

  if (text === '/os') {
    const { rows } = await pool.query(
      `SELECT o.id, o.status, c.name FROM orders o LEFT JOIN clients c ON o.client_id=c.id
       WHERE o.status NOT IN ('concluido','cancelado') ORDER BY o.created_at DESC LIMIT 10`
    );
    if (!rows.length) { await telegramSend('✅ Nenhuma OS em aberto.', chatId); return; }
    const list = rows.map(r => `OS #${r.id} [${r.status}] ${r.name||'?'}`).join('\n');
    await telegramSend(`📋 *Ordens de Serviço*\n\n${list}`, chatId);
    return;
  }

  if (text === '/agentes') {
    const { rows } = await pool.query(
      `SELECT at.hostname, at.version, at.last_checkin, at.status,
              e.device_name, e.brand, e.model, c.name as cn
       FROM agent_tokens at
       LEFT JOIN equipment e ON at.equipment_id=e.id
       LEFT JOIN clients c ON e.client_id=c.id
       WHERE at.active=true ORDER BY at.last_checkin DESC LIMIT 15`
    );
    const list = rows.map(r => {
      const online = r.last_checkin && new Date(r.last_checkin) > new Date(Date.now()-2*3600*1000);
      return `${online ? '🟢' : '🔴'} ${r.hostname||r.device_name||'?'} (${r.cn||'?'})`;
    }).join('\n');
    await telegramSend(`🤖 *Agentes*\n\n${list}`, chatId);
    return;
  }

  if (text === '/billing') {
    const { rows } = await pool.query(
      `SELECT b.*, c.name FROM billings b LEFT JOIN clients c ON b.client_id=c.id
       WHERE b.status='pendente' ORDER BY b.month`
    );
    if (!rows.length) { await telegramSend('✅ Nenhuma cobrança pendente.', chatId); return; }
    let total = 0;
    const list = rows.map(r => { total += parseFloat(r.amount); return `${r.name} — R$ ${parseFloat(r.amount).toFixed(2)} (${r.month})`; }).join('\n');
    await telegramSend(`💰 *Cobranças Pendentes*\n\n${list}\n\n*Total: R$ ${total.toFixed(2)}*`, chatId);
    return;
  }

  if (text.startsWith('/silencio')) {
    const mins = parseInt(text.split(' ')[1]) || 60;
    const until = Date.now() + mins * 60 * 1000;
    await pool.query(
      'INSERT INTO telegram_state (chat_id,modo_silencioso) VALUES ($1,$2) ON CONFLICT (chat_id) DO UPDATE SET modo_silencioso=$2',
      [chatId, until]
    );
    await telegramSend(`🔇 Modo silencioso por ${mins} minutos.`, chatId);
    return;
  }

  // Assistente IA com Groq (se configurado)
  if (process.env.GROQ_API_KEY && text) {
    // verificar modo silencioso
    if (state.modo_silencioso && Date.now() < parseInt(state.modo_silencioso)) return;

    memoria.push({ role: 'user', content: text });
    if (memoria.length > 20) memoria.splice(0, memoria.length - 20);

    try {
      const groqRes = await httpPost('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: `Você é o assistente do TechOS da ALMS Tecnologia. Responda em português, de forma concisa. Ajude com suporte técnico, gerenciamento de chamados e informações sobre clientes.` },
          ...memoria
        ],
        max_tokens: 500,
      }, { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' });

      const reply = groqRes?.choices?.[0]?.message?.content || 'Não consegui processar.';
      memoria.push({ role: 'assistant', content: reply });

      await pool.query(
        'INSERT INTO telegram_state (chat_id,conversa_memoria) VALUES ($1,$2) ON CONFLICT (chat_id) DO UPDATE SET conversa_memoria=$2,updated_at=now()',
        [chatId, JSON.stringify(memoria)]
      );
      await telegramSend(reply, chatId);
    } catch (e) {
      console.error('[Groq]', e.message);
    }
  }
}

// Evolution / WhatsApp
async function evolutionSend(phone, message) {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) return;
  const number = phone.replace(/\D/g, '');
  await httpPost(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
    number: `${number}@s.whatsapp.net`,
    text: message,
  }, {
    apikey: EVO_KEY,
    'Content-Type': 'application/json',
  });
}

// UniFi helpers
async function unifiGetDevices(conn) {
  if (conn.conn_type === 'cloud') {
    // UniFi Site Manager API
    const data = await httpGet(`https://api.ui.com/v1/hosts/${conn.host_id}/devices`, {
      'X-API-KEY': conn.api_key,
    });
    return data?.data || [];
  } else {
    // Self-hosted controller
    const data = await httpGet(`${conn.controller_url}/proxy/network/api/s/${conn.site_name}/stat/device`, {
      'X-API-KEY': conn.api_key,
    });
    return data?.data || [];
  }
}

async function unifiGetWan(conn) {
  try {
    if (conn.conn_type === 'cloud') {
      const data = await httpGet(`https://api.ui.com/v1/hosts/${conn.host_id}/wan`, {
        'X-API-KEY': conn.api_key,
      });
      return data?.data || {};
    }
    return {};
  } catch { return {}; }
}

// HTTP helpers
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, port: u.port||443, path: u.pathname+u.search, method: 'GET', headers };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(body); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const isHttps = u.protocol === 'https:';
    const mod = isHttps ? https : http;
    const opts = {
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    };
    const req = mod.request(opts, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── PIX Payload (EMV) ────────────────────────────────────────────────────────
function gerarPixPayload(pixKey, name, city, amount, txId = '') {
  const pad = (id, v) => { const s = String(v); return `${id}${String(s.length).padStart(2,'0')}${s}`; };
  const merchantAccount = pad('00', 'BR.GOV.BCB.PIX') + pad('01', pixKey);
  const amountStr = parseFloat(amount).toFixed(2);
  const addData = pad('05', txId.slice(0,25) || '***');

  let payload =
    pad('00', '01') +
    pad('26', merchantAccount) +
    pad('52', '0000') +
    pad('53', '986') +
    pad('54', amountStr) +
    pad('58', 'BR') +
    pad('59', name.slice(0,25)) +
    pad('60', city.slice(0,15)) +
    pad('62', addData) +
    '6304';

  // CRC16-CCITT
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return payload + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// ─── Monitor WAN (cron a cada 5 min) ─────────────────────────────────────────
async function monitorWan() {
  try {
    const { rows } = await pool.query('SELECT * FROM unifi_connections WHERE active=true');
    for (const conn of rows) {
      try {
        const wan = await unifiGetWan(conn);
        if (wan && Object.keys(wan).length) {
          await pool.query('UPDATE unifi_connections SET wan_data=$1 WHERE id=$2', [JSON.stringify(wan), conn.id]);
        }
      } catch {}
    }
  } catch (e) { console.error('[WAN Monitor]', e.message); }
}

// ─── Cron: verificar agentes offline (a cada hora) ────────────────────────────
async function checkAgentsOffline() {
  try {
    const { rows } = await pool.query(
      `SELECT at.*, e.device_name, e.brand, e.model, c.name as cn
       FROM agent_tokens at
       LEFT JOIN equipment e ON at.equipment_id=e.id
       LEFT JOIN clients c ON e.client_id=c.id
       WHERE at.active=true
         AND at.last_checkin IS NOT NULL
         AND at.last_checkin < now() - interval '2 hours'
         AND at.status = 'active'`
    );
    for (const ag of rows) {
      const label = ag.device_name || ag.hostname || ag.model || 'Desconhecido';
      const client = ag.cn || '?';
      await telegramSend(`🔴 *Agente Offline*\n🖥️ ${label} (${client})\n⏱️ Último checkin: ${ag.last_checkin ? new Date(ag.last_checkin).toLocaleString('pt-BR') : 'nunca'}`);
      // marcar como offline para não notificar repetidamente
      await pool.query(`UPDATE agent_tokens SET status='offline' WHERE token=$1`, [ag.token]);
    }
    // restaurar status de agentes que voltaram
    await pool.query(
      `UPDATE agent_tokens SET status='active' WHERE active=true AND status='offline' AND last_checkin > now() - interval '2 hours'`
    );
  } catch (e) { console.error('[AgentMonitor]', e.message); }
}

// ─── Cron: alertas de licenças expirando ─────────────────────────────────────
async function checkLicenseExpiry() {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, c.name as cn FROM licenses l
       LEFT JOIN clients c ON l.client_id=c.id
       WHERE l.status='ativa'
         AND l.expires_at IS NOT NULL
         AND l.expires_at <= CURRENT_DATE + (l.alert_days || ' days')::interval
         AND l.expires_at >= CURRENT_DATE`
    );
    for (const lic of rows) {
      const dias = Math.ceil((new Date(lic.expires_at) - new Date()) / 86400000);
      await telegramSend(`📅 *Licença expirando*\n🔑 ${lic.name} (${lic.cn})\n📆 Vence em ${dias} dia(s): ${new Date(lic.expires_at).toLocaleDateString('pt-BR')}`);
    }
  } catch (e) { console.error('[LicenseCheck]', e.message); }
}

// ─── Aliases de rotas (compatibilidade com frontend original) ─────────────────

// /api/os/:id → /api/orders/:id
app.delete('/api/os/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// /api/agents → /api/agent/tokens
app.get('/api/agents', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT at.*, e.brand, e.model, e.device_name, c.name as client_name
     FROM agent_tokens at
     LEFT JOIN equipment e ON at.equipment_id=e.id
     LEFT JOIN clients c ON e.client_id=c.id
     WHERE at.active=true
     ORDER BY at.last_checkin DESC NULLS LAST`
  );
  res.json(rows);
});

// /api/billings → /api/billing
app.get('/api/billings', authMiddleware, async (req, res) => {
  const { month, client_id, status } = req.query;
  let q = `SELECT b.*, c.name as client_name, c.phone, c.email, c.monthly_value
           FROM billings b LEFT JOIN clients c ON b.client_id=c.id`;
  const where = []; const params = [];
  if (month)     { where.push(`b.month=$${params.length+1}`);     params.push(month); }
  if (client_id) { where.push(`b.client_id=$${params.length+1}`); params.push(client_id); }
  if (status)    { where.push(`b.status=$${params.length+1}`);    params.push(status); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY c.name';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

app.post('/api/billings/generate', authMiddleware, async (req, res) => {
  const { month } = req.body;
  try {
    const { rows: clients } = await pool.query(
      `SELECT * FROM clients WHERE client_type IN ('contrato','mensalista') AND monthly_value > 0`
    );
    let created = 0, skipped = 0;
    for (const c of clients) {
      const exists = await pool.query('SELECT id FROM billings WHERE client_id=$1 AND month=$2', [c.id, month]);
      if (exists.rows.length) { skipped++; continue; }
      const id = Date.now() + Math.floor(Math.random()*1000);
      await pool.query(
        `INSERT INTO billings (id,client_id,month,amount,status) VALUES ($1,$2,$3,$4,'pendente')`,
        [id, c.id, month, c.monthly_value]
      );
      created++;
    }
    res.json({ created, skipped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/billings/:id', authMiddleware, async (req, res) => {
  const { status, notes, paid_at, send_method, amount, sendMethod } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE billings SET status=$1,notes=$2,paid_at=$3,send_method=$4,amount=$5 WHERE id=$6 RETURNING *`,
      [status, notes||'', paid_at||null, send_method||sendMethod||'whatsapp', amount, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/billings/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM billings WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/billings/:id/send', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, c.name as client_name, c.phone, c.email
       FROM billings b LEFT JOIN clients c ON b.client_id=c.id WHERE b.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cobrança não encontrada' });
    const b = rows[0];
    const method = req.body.method || 'whatsapp';
    if (method === 'whatsapp') {
      const phone = (b.phone || '').replace(/\D/g, '');
      if (!phone) return res.status(400).json({ error: 'Cliente sem telefone cadastrado' });
      const pix = gerarPixPayload(PIX_KEY, PIX_NAME, PIX_CITY, b.amount, `TECHOS-${b.id}`);
      const msg = `Olá ${b.client_name}! 👋\n\nSua mensalidade referente ao mês *${b.month}* está disponível.\n\n💰 Valor: R$ ${parseFloat(b.amount).toFixed(2)}\n\nPIX Copia e Cola:\n\`${pix}\`\n\nQualquer dúvida, entre em contato!\n\n*ALMS Tecnologia*`;
      await evolutionSend(phone, msg);
    }
    await pool.query(`UPDATE billings SET sent_at=now(),send_method=$1 WHERE id=$2`, [method, b.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// /api/billings/summary → MRR dos clientes contrato
app.get('/api/billings/summary', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(monthly_value),0) as mrr FROM clients WHERE client_type IN ('contrato','mensalista') AND monthly_value > 0`
    );
    res.json({ mrr: parseFloat(rows[0].mrr) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// /api/expenses/summary
app.get('/api/expenses/summary', authMiddleware, async (req, res) => {
  const { month } = req.query;
  const m = month || new Date().toISOString().slice(0, 7);
  try {
    const { rows } = await pool.query(
      `SELECT
        COALESCE(SUM(amount),0) as total,
        COALESCE(SUM(CASE WHEN status='pago' THEN amount ELSE 0 END),0) as paid,
        COALESCE(SUM(CASE WHEN status='pendente' AND due_date >= CURRENT_DATE THEN amount ELSE 0 END),0) as pending,
        COALESCE(SUM(CASE WHEN status='pendente' AND due_date < CURRENT_DATE THEN amount ELSE 0 END),0) as overdue
       FROM expenses WHERE to_char(due_date,'YYYY-MM')=$1`, [m]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// /api/financial/summary → dashboard financeiro completo
app.get('/api/financial/summary', authMiddleware, async (req, res) => {
  try {
    const [monthly, byClient, byTech, mrrRow, pendingRow] = await Promise.all([
      pool.query(
        `SELECT to_char(updated_at,'YYYY-MM') as month, COALESCE(SUM(budget),0) as total, COUNT(*) as count
         FROM orders WHERE status='concluido' AND paid=true
         AND updated_at >= now() - interval '12 months'
         GROUP BY 1 ORDER BY 1`
      ),
      pool.query(
        `SELECT c.name, COALESCE(SUM(o.budget),0) as total
         FROM orders o LEFT JOIN clients c ON o.client_id=c.id
         WHERE o.status='concluido' AND o.paid=true
         GROUP BY c.name ORDER BY total DESC LIMIT 8`
      ),
      pool.query(
        `SELECT u.name, COALESCE(SUM(o.budget),0) as total
         FROM orders o LEFT JOIN users u ON o.technician_id=u.id
         WHERE o.status='concluido' AND o.paid=true
         GROUP BY u.name ORDER BY total DESC`
      ),
      pool.query(`SELECT COALESCE(SUM(monthly_value),0) as mrr FROM clients WHERE client_type IN ('contrato','mensalista') AND monthly_value > 0`),
      pool.query(`SELECT COALESCE(SUM(budget),0) as total FROM orders WHERE status NOT IN ('concluido','cancelado')`),
    ]);
    res.json({
      monthly:       monthly.rows,
      byClient:      byClient.rows,
      byTech:        byTech.rows,
      mrr:           parseFloat(mrrRow.rows[0].mrr),
      pendingAmount: parseFloat(pendingRow.rows[0].total),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// /api/settings/config → /api/config
app.get('/api/settings/config', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM config');
  const cfg = {};
  rows.forEach(r => { cfg[r.key] = r.value; });
  res.json(cfg);
});

app.post('/api/settings/config', authMiddleware, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await pool.query(
        'INSERT INTO config (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2',
        [key, value]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// /api/vault/:clientId → lista credenciais de um cliente
app.get('/api/vault/:clientId', authMiddleware, async (req, res) => {
  // se for um número, é client_id; se não, cai no próximo handler
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(404).json({ error: 'Not found' });
  try {
    const { rows } = await pool.query(
      `SELECT vc.*, c.name as client_name FROM vault_credentials vc
       LEFT JOIN clients c ON vc.client_id=c.id
       WHERE vc.client_id=$1 ORDER BY vc.title`, [clientId]
    );
    const result = rows.map(r => ({
      ...r,
      username: vaultDecrypt(r.username),
      password: vaultDecrypt(r.password),
      notes:    vaultDecrypt(r.notes),
    }));
    await auditLog(req.user.id, req.user.username, 'VIEW', 'vault', clientId, {}, req.ip);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// /api/vault/credential → criar credencial
app.post('/api/vault/credential', authMiddleware, async (req, res) => {
  const { client_id, title, username, password, url, notes, category } = req.body;
  try {
    const id = Date.now();
    const { rows } = await pool.query(
      `INSERT INTO vault_credentials (id,client_id,title,username,password,url,notes,category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, client_id, title, vaultEncrypt(username||''), vaultEncrypt(password||''),
       url||'', vaultEncrypt(notes||''), category||'geral']
    );
    await auditLog(req.user.id, req.user.username, 'CREATE', 'vault', id, { title, client_id }, req.ip);
    res.json({ ...rows[0], username: username||'', password: password||'', notes: notes||'' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/vault/credential/:id', authMiddleware, async (req, res) => {
  const { title, username, password, url, notes, category } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE vault_credentials SET title=$1,username=$2,password=$3,url=$4,notes=$5,category=$6
       WHERE id=$7 RETURNING *`,
      [title, vaultEncrypt(username||''), vaultEncrypt(password||''),
       url||'', vaultEncrypt(notes||''), category||'geral', req.params.id]
    );
    res.json({ ...rows[0], username: username||'', password: password||'', notes: notes||'' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/vault/credential/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM vault_credentials WHERE id=$1', [req.params.id]);
  await auditLog(req.user.id, req.user.username, 'DELETE', 'vault', req.params.id, {}, req.ip);
  res.json({ ok: true });
});

// /api/vault/file → arquivos do vault
app.post('/api/vault/file', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    let data, mime_type, name, file_type, credential_id, client_id;
    if (req.file) {
      data = req.file.buffer.toString('base64');
      mime_type = req.file.mimetype;
      name = req.file.originalname;
      file_type = mime_type.startsWith('image') ? 'image' : 'document';
    } else {
      ({ data, mime_type, name, file_type, credential_id, client_id } = req.body);
    }
    if (!client_id && credential_id) {
      const cr = await pool.query('SELECT client_id FROM vault_credentials WHERE id=$1', [credential_id]);
      if (cr.rows.length) client_id = cr.rows[0].client_id;
    }
    const id = Date.now();
    const { rows } = await pool.query(
      `INSERT INTO vault_files (id,client_id,credential_id,name,file_type,data,mime_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,file_type,mime_type,created_at`,
      [id, client_id, credential_id||null, name, file_type||'image', vaultEncrypt(data), mime_type||'image/png']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/vault/file/:id', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM vault_files WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Arquivo não encontrado' });
  res.json({ ...rows[0], data: vaultDecrypt(rows[0].data) });
});

app.delete('/api/vault/file/:id', authMiddleware, async (req, res) => {
  await pool.query('DELETE FROM vault_files WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// PATCH /api/clients/:id/type
app.patch('/api/clients/:id/type', authMiddleware, async (req, res) => {
  const { client_type } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE clients SET client_type=$1 WHERE id=$2 RETURNING *',
      [client_type, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/chamados/:id/convert → converte chamado em OS
app.post('/api/chamados/:id/convert', authMiddleware, async (req, res) => {
  try {
    const { rows: ch } = await pool.query('SELECT * FROM chamados WHERE id=$1', [req.params.id]);
    if (!ch.length) return res.status(404).json({ error: 'Chamado não encontrado' });
    const c = ch[0];
    const osId = Date.now();
    const { rows: os } = await pool.query(
      `INSERT INTO orders (id,client_id,description,status,technician_id)
       VALUES ($1,$2,$3,'orcamento',$4) RETURNING *`,
      [osId, c.client_id, c.description||c.title, c.technician_id||null]
    );
    await pool.query('UPDATE chamados SET os_id=$1,status=\'em_atendimento\' WHERE id=$2', [osId, req.params.id]);
    res.json({ ok: true, os: os[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Servir frontend React ────────────────────────────────────────────────────
const DIST = path.join(__dirname, 'dist');
app.use(express.static(DIST));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(DIST, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  await pool.connect(); // testa conexão
  await initSchema();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TechOS] Rodando na porta ${PORT}`);
  });

  // Crons
  setInterval(monitorWan,        5 * 60 * 1000);   // a cada 5 min
  setInterval(checkAgentsOffline, 60 * 60 * 1000);  // a cada hora
  setInterval(checkLicenseExpiry, 24 * 60 * 60 * 1000); // diário

  // Primeira execução dos monitors
  setTimeout(monitorWan, 10000);
  setTimeout(checkAgentsOffline, 15000);
  setTimeout(checkLicenseExpiry, 20000);

  console.log('[TechOS] Módulos: Auth, Clientes, Equipamentos, OS, Vault, Financeiro, Billing, Chamados, Licenças, Agente v2.2, Telegram, WAN Monitor');
}

start().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});
