'use strict';
const express  = require('express');
const { Pool } = require('pg');
const path     = require('path');
const crypto   = require('crypto');
const bcrypt      = require('bcryptjs');
const nodemailer  = require('nodemailer');
const PDFDocument = require('pdfkit');
const cron        = require('node-cron');
const jwt      = require('jsonwebtoken');

const app = express();
app.use(express.json({ limit: '10mb' }));

const JWT_SECRET  = process.env.JWT_SECRET || 'techos_jwt_secret_troque_em_producao';
const JWT_EXPIRES = '10h';
const SALT_ROUNDS = 10;
const VAULT_KEY = crypto.scryptSync(process.env.VAULT_KEY||JWT_SECRET,'techos-vault-salt-v1',32);
function vaultEncrypt(t){if(!t)return'';const iv=crypto.randomBytes(16);const c=crypto.createCipheriv('aes-256-cbc',VAULT_KEY,iv);let e=c.update(t,'utf8','hex');e+=c.final('hex');return iv.toString('hex')+':'+e;}
function vaultDecrypt(t){if(!t)return'';if(!t.includes(':'))return t;try{const[h,e]=t.split(':');const iv=Buffer.from(h,'hex');const d=crypto.createDecipheriv('aes-256-cbc',VAULT_KEY,iv);let r=d.update(e,'hex','utf8');r+=d.final('utf8');return r;}catch{return '';}}

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://techos:techos123@techos-db:5432/techos' });
pool.on('error', err => console.error('[DB] pool error', err));

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, name VARCHAR(255) NOT NULL, username VARCHAR(100) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(50) NOT NULL DEFAULT 'tecnico');
    CREATE TABLE IF NOT EXISTS clients (id BIGINT PRIMARY KEY, name VARCHAR(255) NOT NULL, phone VARCHAR(100) DEFAULT '', email VARCHAR(255) DEFAULT '', cpf VARCHAR(100) DEFAULT '', address TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS equipment (id BIGINT PRIMARY KEY, client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL, type VARCHAR(100) DEFAULT '', brand VARCHAR(100) DEFAULT '', model VARCHAR(100) DEFAULT '', serial VARCHAR(100) DEFAULT '', problem TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS orders (id BIGINT PRIMARY KEY, client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL, equipment_id BIGINT REFERENCES equipment(id) ON DELETE SET NULL, technician_id BIGINT REFERENCES users(id) ON DELETE SET NULL, status VARCHAR(50) NOT NULL DEFAULT 'orcamento', description TEXT DEFAULT '', budget NUMERIC(12,2) DEFAULT 0, technician_notes TEXT DEFAULT '', created_at DATE DEFAULT CURRENT_DATE, updated_at DATE DEFAULT CURRENT_DATE);
    CREATE TABLE IF NOT EXISTS order_history (id SERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, action_date VARCHAR(100), username VARCHAR(100), action VARCHAR(255), detail TEXT);
    CREATE TABLE IF NOT EXISTS config (key VARCHAR(100) PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS os_photos (
      id BIGINT PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      name VARCHAR(255),
      tipo VARCHAR(20) DEFAULT 'antes',
      data TEXT,
      mime_type VARCHAR(100) DEFAULT 'image/jpeg',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      default_price NUMERIC(10,2) DEFAULT 0,
      category TEXT DEFAULT 'Outros',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS chamados (
      id            BIGINT        PRIMARY KEY,
      client_id     BIGINT        REFERENCES clients(id) ON DELETE SET NULL,
      client_name   VARCHAR(255)  DEFAULT '',
      client_phone  VARCHAR(100)  DEFAULT '',
      client_email  VARCHAR(255)  DEFAULT '',
      title         VARCHAR(255)  NOT NULL,
      description   TEXT          DEFAULT '',
      priority      VARCHAR(20)   DEFAULT 'normal',
      status        VARCHAR(20)   DEFAULT 'aberto',
      source        VARCHAR(50)   DEFAULT 'manual',
      technician_id BIGINT        REFERENCES users(id) ON DELETE SET NULL,
      os_id         BIGINT        REFERENCES orders(id) ON DELETE SET NULL,
      created_at    TIMESTAMP     DEFAULT NOW(),
      updated_at    TIMESTAMP     DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vault_credentials (
      id BIGINT PRIMARY KEY,
      client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      username TEXT DEFAULT '',
      password TEXT DEFAULT '',
      url VARCHAR(500) DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vault_files (
      id BIGINT PRIMARY KEY,
      client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      credential_id BIGINT REFERENCES vault_credentials(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      file_type VARCHAR(50) DEFAULT 'image',
      data TEXT NOT NULL,
      mime_type VARCHAR(100) DEFAULT 'image/png',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Migration: billing fields on clients
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_value NUMERIC(10,2) DEFAULT 0");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_day   INTEGER DEFAULT 1");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES clients(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE billings ADD COLUMN IF NOT EXISTS os_id BIGINT REFERENCES orders(id) ON DELETE SET NULL");
  await pool.query(`CREATE TABLE IF NOT EXISTS expenses (
    id BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'Outros',
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente',
    paid_at DATE,
    payment_method VARCHAR(50) DEFAULT '',
    recurring BOOLEAN DEFAULT false,
    frequency VARCHAR(20) DEFAULT 'mensal',
    parent_recurring_id BIGINT,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  // Migration: billings table
  await pool.query(
    "CREATE TABLE IF NOT EXISTS billings (" +
    "id BIGINT PRIMARY KEY," +
    "client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE," +
    "month VARCHAR(7) NOT NULL," +
    "amount NUMERIC(10,2) DEFAULT 0," +
    "status VARCHAR(20) DEFAULT 'pendente'," +
    "send_method VARCHAR(20) DEFAULT 'whatsapp'," +
    "sent_at TIMESTAMP," +
    "paid_at TIMESTAMP," +
    "notes TEXT DEFAULT ''," +
    "created_at TIMESTAMP DEFAULT NOW())"
  );

  // Migration: equipment inventory fields
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS remote_user VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS remote_id VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS remote_pass VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS os_version VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS office VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS ram VARCHAR(100) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS processor VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS storage VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS collaborator VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS remote_id   VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS remote_pass VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS os_version  VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS office      VARCHAR(100) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS ram         VARCHAR(100) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS processor   VARCHAR(255) DEFAULT ''");
  await pool.query("ALTER TABLE equipment ADD COLUMN IF NOT EXISTS storage     VARCHAR(255) DEFAULT ''");
  // Migration: add client_type if not exists
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type VARCHAR(20) DEFAULT 'avulso'");
  console.log('[DB] schema ok');
}

const DEFAULT_USERS = [
  { id:1, name:'Administrador', username:'admin',   password:'admin123', role:'admin'   },
  { id:2, name:'Técnico',       username:'tecnico', password:'tech123',  role:'tecnico' },
];
const DEFAULT_CLIENTS = [
  {id:1,name:'ATB Advocacia',phone:'',email:'',cpf:'',address:'Rua Leonardo da Vinci, 391 – Aeroporto – Londrina, PR'},
  {id:2,name:'Angellog Transporte',phone:'(43) 99935-2793',email:'angelica.financeiro@angellog.com.br',cpf:'',address:'Av. Ayrton Senna da Silva, 200, Sala 102 – Londrina, PR'},
  {id:3,name:'Avulso',phone:'',email:'',cpf:'',address:''},
  {id:4,name:'Carga Pesada Pneus (Agnaldo)',phone:'',email:'',cpf:'',address:'Londrina'},
  {id:5,name:'Carla Galvan',phone:'(43) 9912-4406',email:'',cpf:'',address:''},
  {id:6,name:'Carraro Cidadania Ltda',phone:'',email:'',cpf:'55.893.430/0001-71',address:'Av. Ayrton Senna da Silva, 550, Sala 504 – Londrina, PR'},
  {id:7,name:'Carraro e Abujamra',phone:'',email:'',cpf:'',address:'Torre Montello – Av. Ayrton Senna da Silva, 550, Sala 501 – Londrina, PR'},
  {id:8,name:'Clair (Igreja)',phone:'(43) 99185-1030',email:'',cpf:'',address:'Rua Rebouças, 182, AP 02 – Londrina'},
  {id:9,name:'Colormidia',phone:'(43) 99161-7181',email:'',cpf:'',address:'Londrina'},
  {id:10,name:'Construtora Zacaria',phone:'',email:'',cpf:'',address:'Av. Gil de Abreu e Souza, 367 – Londrina'},
  {id:11,name:'Daniele Fioravante Tristão',phone:'(43) 99937-9780',email:'',cpf:'',address:'R. Gastão Madeira, 61 – Londrina'},
  {id:12,name:'Diogo Spina',phone:'(43) 9921-9236',email:'',cpf:'',address:''},
  {id:13,name:'Divina Seila de Oliveira',phone:'(43) 99101-4343',email:'',cpf:'',address:'R. Senador Souza Naves, SL 93, 441'},
  {id:14,name:'Efraim Group Corporation Ltda',phone:'',email:'',cpf:'57.656.108/0001-54',address:'Av. Madre Leonia Milito, 1377, Sala 1808 – Londrina, PR'},
  {id:15,name:'Estefany',phone:'(43) 99625-9319',email:'',cpf:'',address:''},
  {id:16,name:'Evandro (Pastel da Quintino)',phone:'(43) 99113-0903',email:'',cpf:'',address:''},
  {id:17,name:'Girotto Carraro Agenciamentos',phone:'',email:'',cpf:'',address:'Av. Ayrton Senna da Silva, 550, Sala 503 – Londrina'},
  {id:18,name:'Ibrapsi Ltda (Lilian)',phone:'(43) 99865-7206',email:'',cpf:'42.033.706/0001-08',address:'Londrina, PR'},
  {id:19,name:'Instituto Médico Rezende',phone:'',email:'',cpf:'',address:'Av. Ayrton Senna da Silva, 830, Sala 202 – Londrina, PR'},
  {id:20,name:'Isaias Junior Tristão Barbosa',phone:'(43) 99113-1128',email:'',cpf:'',address:''},
  {id:21,name:'JB Londrina',phone:'(43) 99111-0900',email:'',cpf:'',address:''},
  {id:22,name:'Jonathan Santos',phone:'(11) 99227-4275',email:'',cpf:'',address:''},
  {id:23,name:'Jordana Teixeira Fragoso da Costa',phone:'',email:'jordanatfragoso@hotmail.com',cpf:'080.016.159-95',address:'Sena Martins, 123 – Londrina'},
  {id:24,name:'Luciana Costa',phone:'',email:'',cpf:'',address:''},
  {id:25,name:'Ludimila Nakamura',phone:'',email:'',cpf:'',address:'R. Ildefonso dos Santos, 240 – Londrina'},
  {id:26,name:'Lunardelli & Hipolito LTDA',phone:'',email:'malunardellihipolito@gmail.com',cpf:'52.448.821/0001-99',address:'Av. Garibaldi Deliberador, 885 – Londrina, PR'},
  {id:27,name:'Makor Saude e Performance Ltda',phone:'(43) 99167-5993',email:'',cpf:'23.254.099/0001-53',address:'Rua Capitão Almir Moreira, 1630 – Londrina, PR'},
  {id:28,name:'Mr. Cheff - Aurora',phone:'',email:'',cpf:'',address:'Londrina'},
  {id:29,name:'Pollyana T Gnaspini',phone:'',email:'',cpf:'',address:''},
  {id:30,name:'Pronto Laudo',phone:'',email:'',cpf:'',address:''},
  {id:31,name:'Prosperesec',phone:'(43) 99673-2133',email:'',cpf:'',address:'R. Nevada, 187 – Londrina, PR'},
  {id:32,name:'Rodrigo Katayose',phone:'(43) 99682-3443',email:'',cpf:'',address:'Rua Nevada, 187 – Londrina'},
  {id:33,name:'Rodrigo Zacaria',phone:'',email:'',cpf:'',address:'Londrina'},
  {id:34,name:'Rádio Norte FM',phone:'(43) 3367-4003',email:'',cpf:'75.551.622/0001-07',address:'Rua Pernambuco, 269, 10º andar – Londrina, PR'},
  {id:35,name:'Thiago Tristão',phone:'(43) 99937-9788',email:'',cpf:'',address:'Av. Robert Koch, 1570 – Londrina'},
  {id:36,name:'Vera Lúcia Evangelista',phone:'(43) 99197-1802',email:'mecanicahidraquipe@bol.com',cpf:'',address:'Rua Perobal, 242 – Jardim Leonor'},
];

async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n > 0) return;
  console.log('[DB] seeding…');
  for (const u of DEFAULT_USERS) {
    const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
    await pool.query('INSERT INTO users(id,name,username,password,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [u.id, u.name, u.username, hash, u.role]);
  }
  for (const c of DEFAULT_CLIENTS) {
    await pool.query('INSERT INTO clients(id,name,phone,email,cpf,address) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [c.id, c.name, c.phone, c.email, c.cpf, c.address]);
  }
  console.log('[DB] seed done');
}

async function ensureToken() {
  const { rows } = await pool.query("SELECT value FROM config WHERE key='webhook_token'");
  if (!rows.length) await pool.query("INSERT INTO config(key,value) VALUES('webhook_token',$1)", [crypto.randomBytes(24).toString('hex')]);
}

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autorizado' });
  try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido ou expirado' }); }
}

async function loadAll() {
  const [uR,cR,eR,oR,hR] = await Promise.all([
    pool.query('SELECT id,name,username,role FROM users ORDER BY id'),
    pool.query('SELECT id,name,phone,email,cpf,address,client_type,monthly_value::float,billing_day,billing_email,parent_id FROM clients ORDER BY id'),
    pool.query('SELECT id, client_id AS "clientId", type, brand, model, serial, problem, remote_user AS "remoteUser", remote_id AS "remoteId", remote_pass AS "remotePass", os_version AS "osVersion", office, ram, processor, storage, collaborator, ip_address AS "ipAddress", extra_info AS "extraInfo" FROM equipment ORDER BY id'),
    pool.query(`SELECT id, client_id AS "clientId", equipment_id AS "equipmentId", technician_id AS "technicianId", status, description, budget::float AS budget, technician_notes AS "technicianNotes", to_char(created_at,'YYYY-MM-DD') AS "createdAt", to_char(updated_at,'YYYY-MM-DD') AS "updatedAt" FROM orders ORDER BY id`),
    pool.query('SELECT order_id, action_date AS date, username AS "user", action, detail FROM order_history ORDER BY id'),
  ]);
  const hist = {};
  for (const h of hR.rows) (hist[h.order_id] = hist[h.order_id] || []).push({ date:h.date, user:h.user, action:h.action, detail:h.detail });
  return { users:uR.rows, clients:cR.rows, equipment:eR.rows, os:oR.rows.map(o=>({...o,history:hist[o.id]||[]})) };
}

async function saveAll(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userIds = (data.users||[]).map(u=>u.id);
    for (const u of data.users||[]) {
      let pwd = u.password||'';
      if (pwd && !pwd.startsWith('$2')) pwd = await bcrypt.hash(pwd, SALT_ROUNDS);
      else if (!pwd) { const {rows} = await client.query('SELECT password FROM users WHERE id=$1',[u.id]); pwd = rows[0]?.password || await bcrypt.hash('changeMe!',SALT_ROUNDS); }
      await client.query('INSERT INTO users(id,name,username,password,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=$2,username=$3,password=$4,role=$5', [u.id,u.name,u.username,pwd,u.role]);
    }
    if (userIds.length) await client.query('DELETE FROM users WHERE id <> ALL($1)',[userIds]);
    const clientIds = (data.clients||[]).map(c=>c.id);
    for (const c of data.clients||[]) await client.query('INSERT INTO clients(id,name,phone,email,cpf,address,client_type,monthly_value,billing_day,billing_email,parent_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET name=$2,phone=$3,email=$4,cpf=$5,address=$6,client_type=$7,monthly_value=$8,billing_day=$9,billing_email=$10,parent_id=$11',[c.id,c.name,c.phone||'',c.email||'',c.cpf||'',c.address||'',c.client_type||'avulso',c.monthly_value||0,c.billing_day||1,c.billing_email||'',c.parent_id||null]);
    if (clientIds.length) await client.query('DELETE FROM clients WHERE id <> ALL($1)',[clientIds]);
    const equipIds = (data.equipment||[]).map(e=>e.id);
    for (const e of data.equipment||[]) await client.query('INSERT INTO equipment(id,client_id,type,brand,model,serial,problem,remote_user,remote_id,remote_pass,os_version,office,ram,processor,storage,collaborator,ip_address,extra_info) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT(id) DO UPDATE SET client_id=$2,type=$3,brand=$4,model=$5,serial=$6,problem=$7,remote_user=$8,remote_id=$9,remote_pass=$10,os_version=$11,office=$12,ram=$13,processor=$14,storage=$15,collaborator=$16,ip_address=$17,extra_info=$18',[e.id,e.clientId||null,e.type||'',e.brand||'',e.model||'',e.serial||'',e.problem||'',e.remoteUser||'',e.remoteId||'',e.remotePass||'',e.osVersion||'',e.office||'',e.ram||'',e.processor||'',e.storage||'',e.collaborator||'',e.ipAddress||'',JSON.stringify(e.extraInfo||{})]);
    if (equipIds.length) await client.query('DELETE FROM equipment WHERE id <> ALL($1)',[equipIds]);
    const osIds = (data.os||[]).map(o=>o.id);
    for (const o of data.os||[]) {
      await client.query(`INSERT INTO orders(id,client_id,equipment_id,technician_id,status,description,budget,technician_notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET client_id=$2,equipment_id=$3,technician_id=$4,status=$5,description=$6,budget=$7,technician_notes=$8,updated_at=$10`,[o.id,o.clientId||null,o.equipmentId||null,o.technicianId||null,o.status||'orcamento',o.description||'',o.budget||0,o.technicianNotes||'',o.createdAt||new Date().toISOString().slice(0,10),o.updatedAt||new Date().toISOString().slice(0,10)]);
      await client.query('DELETE FROM order_history WHERE order_id=$1',[o.id]);
      for (const h of o.history||[]) await client.query('INSERT INTO order_history(order_id,action_date,username,action,detail) VALUES($1,$2,$3,$4,$5)',[o.id,h.date||'',h.user||'',h.action||'',h.detail||'']);
    }
    if (osIds.length) await client.query('DELETE FROM orders WHERE id <> ALL($1)',[osIds]);
    await client.query('COMMIT');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function getWebhookToken() { const {rows} = await pool.query("SELECT value FROM config WHERE key='webhook_token'"); return rows[0]?.value||''; }
async function rotateWebhookToken() { const t=crypto.randomBytes(24).toString('hex'); await pool.query("INSERT INTO config(key,value) VALUES('webhook_token',$1) ON CONFLICT(key) DO UPDATE SET value=$1",[t]); return t; }

app.use(express.static(path.join(__dirname,'dist')));

app.post('/api/auth/login', async (req,res) => {
  try {
    const {username,password} = req.body;
    if (!username||!password) return res.status(400).json({error:'Preencha usuário e senha'});
    const {rows} = await pool.query('SELECT * FROM users WHERE username=$1',[username.trim()]);
    if (!rows.length) return res.status(401).json({error:'Usuário ou senha incorretos'});
    const user = rows[0];
    if (!await bcrypt.compare(password, user.password)) return res.status(401).json({error:'Usuário ou senha incorretos'});
    const token = jwt.sign({id:user.id,username:user.username,name:user.name,role:user.role}, JWT_SECRET, {expiresIn:JWT_EXPIRES});
    res.json({token, user:{id:user.id,name:user.name,username:user.username,role:user.role}});
  } catch(e) { console.error('[login]',e); res.status(500).json({error:e.message}); }
});

app.get('/api/auth/me', auth, (req,res) => res.json({user:req.user}));
app.get('/api/data',    auth, async (_,res) => { try { res.json(await loadAll()); } catch(e) { res.status(500).json({error:e.message}); } });
app.post('/api/data',   auth, async (req,res) => { try { await saveAll(req.body); res.json({ok:true}); } catch(e) { res.status(500).json({error:e.message}); } });
app.get('/api/config',  auth, async (_,res) => { try { res.json({webhookToken:await getWebhookToken()}); } catch(e) { res.status(500).json({error:e.message}); } });
app.post('/api/config/rotate-token', auth, async (_,res) => { try { res.json({webhookToken:await rotateWebhookToken()}); } catch(e) { res.status(500).json({error:e.message}); } });

app.post('/api/webhook/os', async (req,res) => {
  try {
    const token = req.headers['x-webhook-token']||req.query.token;
    if (token !== await getWebhookToken()) return res.status(401).json({error:'Token inválido'});
    const b=req.body; const now=new Date(); const ds=now.toISOString().slice(0,10); const ns=now.toLocaleString('pt-BR');
    let clientId=null;
    if (b.client_phone||b.client_name) {
      const {rows}=await pool.query('SELECT id FROM clients WHERE phone=$1 OR name=$2 LIMIT 1',[b.client_phone||'',b.client_name||'']);
      if (rows.length) clientId=rows[0].id;
      else if (b.client_name) { const id=Date.now(); await pool.query('INSERT INTO clients(id,name,phone,email,cpf,address) VALUES($1,$2,$3,$4,$5,$6)',[id,b.client_name,b.client_phone||'',b.client_email||'','',b.client_address||'']); clientId=id; }
    }
    let equipId=null;
    if (b.equipment_type||b.equipment_brand) { equipId=Date.now()+1; await pool.query('INSERT INTO equipment(id,client_id,type,brand,model,serial,problem) VALUES($1,$2,$3,$4,$5,$6,$7)',[equipId,clientId,b.equipment_type||'',b.equipment_brand||'',b.equipment_model||'',b.equipment_serial||'',b.description||'']); }
    const osId=Date.now()+2;
    await pool.query(`INSERT INTO orders(id,client_id,equipment_id,status,description,budget,technician_notes,created_at,updated_at) VALUES($1,$2,$3,'orcamento',$4,0,$5,$6,$6)`,[osId,clientId,equipId,b.description||b.message||'Chamado via webhook',`Origem: ${b.source||'webhook'}`,ds]);
    await pool.query('INSERT INTO order_history(order_id,action_date,username,action,detail) VALUES($1,$2,$3,$4,$5)',[osId,ns,'webhook','OS criada via webhook',`Origem: ${b.source||'sistema externo'}`]);
    res.json({ok:true,os_id:osId,client_id:clientId});
  } catch(e) { console.error('[webhook]',e); res.status(500).json({error:e.message}); }
});

app.get('/api/health', async (_,res) => { try { await pool.query('SELECT 1'); res.json({status:'ok',db:'connected'}); } catch(e) { res.status(500).json({status:'error',db:e.message}); } });
// ── Delete endpoints (immediate, sem depender do auto-save) ───────────────
app.delete('/api/os/:id', auth, async (req,res) => {
  try { await pool.query('DELETE FROM orders WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/clients/:id', auth, async (req,res) => {
  try { await pool.query('DELETE FROM clients WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/equipment/:id', auth, async (req,res) => {
  try { await pool.query('DELETE FROM equipment WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

// ── Client type toggle ────────────────────────────────────────────────────────
app.patch('/api/clients/:id/type', auth, async (req,res) => {
  try {
    const {client_type} = req.body;
    await pool.query('UPDATE clients SET client_type=$1 WHERE id=$2',[client_type,req.params.id]);
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ── Chamados routes ────────────────────────────────────────────────────────
app.get('/api/chamados', auth, async (_,res) => {
  try {
    const {rows} = await pool.query(`
      SELECT c.*, cl.name AS client_name_db, u.name AS technician_name
      FROM chamados c
      LEFT JOIN clients cl ON cl.id = c.client_id
      LEFT JOIN users u ON u.id = c.technician_id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/chamados', auth, async (req,res) => {
  try {
    const {clientId,clientName,clientPhone,clientEmail,title,description,priority,status,source,technicianId,createdAt,updatedAt} = req.body;
    const id = Date.now();
    const ca = createdAt || new Date().toISOString();
    const ua = updatedAt || ca;
    await pool.query(
      `INSERT INTO chamados(id,client_id,client_name,client_phone,client_email,title,description,priority,status,source,technician_id,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id,clientId||null,clientName||'',clientPhone||'',clientEmail||'',title,description||'',priority||'normal',status||'aberto',source||'manual',technicianId||null,ca,ua]
    );
    res.json({ok:true,id});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.put('/api/chamados/:id', auth, async (req,res) => {
  try {
    const {clientId,clientName,clientPhone,clientEmail,title,description,priority,status,technicianId,osId,createdAt,updatedAt} = req.body;
    const ua = updatedAt || new Date().toISOString();
    if (createdAt) {
      await pool.query(
        `UPDATE chamados SET client_id=$1,client_name=$2,client_phone=$3,client_email=$4,title=$5,description=$6,priority=$7,status=$8,technician_id=$9,os_id=$10,created_at=$11,updated_at=$12 WHERE id=$13`,
        [clientId||null,clientName||'',clientPhone||'',clientEmail||'',title,description||'',priority||'normal',status||'aberto',technicianId||null,osId||null,createdAt,ua,req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE chamados SET client_id=$1,client_name=$2,client_phone=$3,client_email=$4,title=$5,description=$6,priority=$7,status=$8,technician_id=$9,os_id=$10,updated_at=$11 WHERE id=$12`,
        [clientId||null,clientName||'',clientPhone||'',clientEmail||'',title,description||'',priority||'normal',status||'aberto',technicianId||null,osId||null,ua,req.params.id]
      );
    }
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/chamados/:id', auth, async (req,res) => {
  try { await pool.query('DELETE FROM chamados WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

// Convert chamado → OS
app.post('/api/chamados/:id/convert', auth, async (req,res) => {
  try {
    const {rows} = await pool.query('SELECT * FROM chamados WHERE id=$1',[req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Chamado não encontrado'});
    const ch = rows[0];
    const now = new Date(); const ds = now.toISOString().slice(0,10); const ns = now.toLocaleString('pt-BR');
    const osId = Date.now();
    await pool.query(
      `INSERT INTO orders(id,client_id,equipment_id,technician_id,status,description,budget,technician_notes,created_at,updated_at)
       VALUES($1,$2,NULL,$3,'orcamento',$4,0,$5,$6,$6)`,
      [osId,ch.client_id,req.body.technicianId||null,ch.description||ch.title,`Convertido do chamado #${ch.id}`,ds]
    );
    await pool.query('INSERT INTO order_history(order_id,action_date,username,action,detail) VALUES($1,$2,$3,$4,$5)',
      [osId,ns,req.body.username||'sistema','OS criada','Convertida do chamado #'+ch.id]);
    await pool.query('UPDATE chamados SET status=$1,os_id=$2,updated_at=NOW() WHERE id=$3',['resolvido',osId,ch.id]);
    res.json({ok:true,os_id:osId});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Webhook chamado
app.post('/api/webhook/chamado', async (req,res) => {
  try {
    const token = req.headers['x-webhook-token']||req.query.token;
    if(token !== await getWebhookToken()) return res.status(401).json({error:'Token inválido'});
    const b=req.body; const now=new Date();
    let clientId=null;
    if(b.client_phone||b.client_name){
      const {rows}=await pool.query('SELECT id FROM clients WHERE phone=$1 OR name=$2 LIMIT 1',[b.client_phone||'',b.client_name||'']);
      if(rows.length) clientId=rows[0].id;
    }
    const id=Date.now();
    await pool.query(
      `INSERT INTO chamados(id,client_id,client_name,client_phone,client_email,title,description,priority,status,source)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'aberto',$9)`,
      [id,clientId,b.client_name||'',b.client_phone||'',b.client_email||'',b.title||b.subject||'Novo chamado',b.description||b.message||'',b.priority||'normal',b.source||'webhook']
    );
    console.log(`[webhook] Chamado #${id} criado — ${b.client_name||'sem nome'}`);
    res.json({ok:true,chamado_id:id,client_id:clientId});
  } catch(e){ console.error('[webhook/chamado]',e); res.status(500).json({error:e.message}); }
});

// ── Config helpers ─────────────────────────────────────────────────────────
async function getConfig(key) {
  const {rows} = await pool.query("SELECT value FROM config WHERE key=$1",[key]);
  return rows[0]?.value||'';
}
async function setConfig(key, value) {
  await pool.query("INSERT INTO config(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2",[key,value]);
}

// ── Generate OS PDF as base64 ───────────────────────────────────────────────
async function generateOSPDF(os, client, company) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size:'A4', margin:50, info:{ Title:`OS #${os.id}`, Author:company } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    doc.on('error', reject);

    const [y,m] = os.month ? os.month.split('-') : [new Date().getFullYear(), String(new Date().getMonth()+2).padStart(2,'0')];
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    // ── Header ──────────────────────────────────────────────────────────────
    doc.rect(0,0,doc.page.width,90).fill('#1a2240');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
       .text(company || 'ALMS Tecnologia', 50, 28);
    doc.fontSize(11).font('Helvetica').fillColor('#aac4f0')
       .text('Assistência Técnica em TI', 50, 56);
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
       .text(`OS #${os.id}`, doc.page.width-170, 35, {width:120, align:'right'});
    doc.fontSize(9).font('Helvetica').fillColor('#aac4f0')
       .text(os.created_at || new Date().toISOString().slice(0,10), doc.page.width-170, 58, {width:120, align:'right'});

    // ── Status badge ─────────────────────────────────────────────────────────
    const statusMap = { aprovado:'APROVADO', concluido:'CONCLUÍDO', orcamento:'ORÇAMENTO', em_andamento:'EM ANDAMENTO', cancelado:'CANCELADO' };
    const statusColors = { aprovado:[79,142,247], concluido:[62,207,142], orcamento:[245,197,66], em_andamento:[155,114,247], cancelado:[229,91,91] };
    const sc = statusColors[os.status] || [123,132,154];
    doc.y = 110;
    doc.roundedRect(50,105,120,24,4).fill(`rgb(${sc[0]},${sc[1]},${sc[2]})`);
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
       .text(statusMap[os.status]||os.status||'APROVADO', 56, 111, {width:108, align:'center'});

    // ── Sections ─────────────────────────────────────────────────────────────
    function section(title, y) {
      doc.rect(50, y, doc.page.width-100, 22).fill('#f0f4ff');
      doc.fillColor('#1a2240').fontSize(10).font('Helvetica-Bold').text(title, 58, y+6);
      return y + 30;
    }
    function row(label, value, y) {
      doc.fillColor('#666666').fontSize(9).font('Helvetica').text(label, 58, y);
      doc.fillColor('#111111').fontSize(9).font('Helvetica-Bold').text(value||'—', 180, y);
      return y + 18;
    }

    let cy = 140;
    cy = section('CLIENTE', cy);
    cy = row('Nome:', client?.name||'—', cy);
    cy = row('Telefone:', client?.phone||'—', cy);
    cy = row('E-mail:', client?.email||'—', cy);
    cy = row('Endereço:', client?.address||'—', cy);
    cy += 10;

    cy = section('SERVIÇO', cy);
    cy = row('Descrição:', os.description||'—', cy);
    if (os.technician_notes) cy = row('Observações:', os.technician_notes, cy);
    cy = row('Data de Abertura:', os.created_at||'—', cy);
    cy = row('Última Atualização:', os.updated_at||'—', cy);
    cy += 10;

    // ── Value box ─────────────────────────────────────────────────────────────
    doc.rect(50, cy, doc.page.width-100, 50).fill('#f0fff8');
    doc.rect(50, cy, 4, 50).fill('#3ecf8e');
    doc.fillColor('#666666').fontSize(10).font('Helvetica').text('VALOR TOTAL', 65, cy+10);
    doc.fillColor('#1a8a5c').fontSize(22).font('Helvetica-Bold')
       .text(`R$ ${Number(os.budget||0).toFixed(2)}`, 65, cy+24);
    cy += 68;

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.rect(0, doc.page.height-50, doc.page.width, 50).fill('#f8f9fa');
    doc.fillColor('#999999').fontSize(8).font('Helvetica')
       .text(`${company} | Documento gerado em ${new Date().toLocaleString('pt-BR')}`, 50, doc.page.height-32, {align:'center', width:doc.page.width-100});

    doc.end();
  });
}

// ── WhatsApp via Evolution API ──────────────────────────────────────────────
async function getEvolutionConfig() {
  const url      = await getConfig('evolution_url');
  const apiKey   = await getConfig('evolution_key');
  const instance = await getConfig('evolution_instance');
  if (!url||!apiKey||!instance) throw new Error('Evolution API não configurada');
  return {url, apiKey, instance};
}

async function sendWhatsApp(phone, message) {
  const {url,apiKey,instance} = await getEvolutionConfig();
  const num = '55' + phone.replace(/\D/g,'');
  const r = await fetch(`${url}/message/sendText/${instance}`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':apiKey},
    body: JSON.stringify({number:num, text:message}),
  });
  if (!r.ok) throw new Error(`Evolution: ${r.status}`);
  return r.json();
}

async function sendWhatsAppDocument(phone, base64pdf, fileName, caption) {
  const {url,apiKey,instance} = await getEvolutionConfig();
  const num = '55' + phone.replace(/\D/g,'');
  const r = await fetch(`${url}/message/sendMedia/${instance}`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':apiKey},
    body: JSON.stringify({
      number:num,
      mediatype:'document',
      mimetype:'application/pdf',
      media:base64pdf,
      fileName:fileName,
      caption:caption||''
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Evolution documento: ${r.status} - ${t}`);
  }
  return r.json();
}

// ── E-mail via SMTP ─────────────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  const host = await getConfig('smtp_host');
  const port = await getConfig('smtp_port');
  const user = await getConfig('smtp_user');
  const pass = await getConfig('smtp_pass');
  const from = await getConfig('smtp_from');
  if (!host||!user||!pass) throw new Error('SMTP não configurado');
  const t = nodemailer.createTransport({host,port:parseInt(port)||587,secure:parseInt(port)===465,auth:{user,pass}});
  return t.sendMail({from,to,subject,html});
}

// ── Build billing message ───────────────────────────────────────────────────
async function buildBillingMsg(client, billing) {
  const [y,m] = billing.month.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const refDate = new Date(parseInt(y), parseInt(m)-2, 1);
  const refMonth = months[refDate.getMonth()] + '/' + refDate.getFullYear();
  const pixKey  = await getConfig('pix_key');
  const company = await getConfig('company_name') || 'ALMS Tecnologia';
  const osLine  = billing.os_id ? `\n\n📋 *OS #${billing.os_id}* — referência do serviço` : '';
  const pixLine = pixKey ? `\n\n🏦 *Chave PIX:* ${pixKey}` : '';
  return `Olá ${client.name}! 👋\n\nSua mensalidade referente a *${refMonth}* está disponível.\n\n💰 *Valor: R$ ${Number(billing.amount).toFixed(2)}*${osLine}${pixLine}\n\nQualquer dúvida, entre em contato!\n\n*${company}*`;
}

// ── Financial API ───────────────────────────────────────────────────────────
app.get('/api/financial/summary', auth, async (_,res) => {
  try {
    const [monthly, byClient, byTech, mrr, pending] = await Promise.all([
      pool.query(`SELECT to_char(updated_at,'YYYY-MM') AS month, SUM(budget)::float AS total, COUNT(*)::int AS count FROM orders WHERE status='concluido' AND updated_at >= NOW()-INTERVAL '12 months' GROUP BY month ORDER BY month`),
      pool.query(`SELECT cl.name, SUM(o.budget)::float AS total FROM orders o JOIN clients cl ON cl.id=o.client_id WHERE o.status='concluido' GROUP BY cl.name ORDER BY total DESC LIMIT 8`),
      pool.query(`SELECT u.name, SUM(o.budget)::float AS total FROM orders o JOIN users u ON u.id=o.technician_id WHERE o.status='concluido' GROUP BY u.name ORDER BY total DESC`),
      pool.query(`SELECT COALESCE(SUM(monthly_value),0)::float AS mrr FROM clients WHERE client_type='contrato' AND monthly_value>0`),
      pool.query(`SELECT COALESCE(SUM(budget),0)::float AS total FROM orders WHERE status IN ('orcamento','aprovado','em_andamento')`),
    ]);
    res.json({ monthly:monthly.rows, byClient:byClient.rows, byTech:byTech.rows, mrr:mrr.rows[0]?.mrr||0, pendingAmount:pending.rows[0]?.total||0 });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ── Billings API ────────────────────────────────────────────────────────────
app.get('/api/billings', auth, async (req,res) => {
  try {
    const month = req.query.month||'';
    const q = month
      ? `SELECT b.*,c.name AS client_name,c.phone AS phone,c.billing_email AS email FROM billings b JOIN clients c ON c.id=b.client_id WHERE b.month=$1 ORDER BY b.created_at DESC`
      : `SELECT b.*,c.name AS client_name,c.phone AS phone,c.billing_email AS email FROM billings b JOIN clients c ON c.id=b.client_id ORDER BY b.month DESC,b.created_at DESC`;
    const {rows} = await pool.query(q, month?[month]:[]);
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Generate billings + OS for a month
app.post('/api/billings/generate', auth, async (req,res) => {
  try {
    const {month} = req.body; // YYYY-MM
    const {rows:clients} = await pool.query("SELECT * FROM clients WHERE client_type='contrato' AND monthly_value>0");
    let created=0, skipped=0;
    const [y,m] = month.split('-');
    const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const refDate = new Date(parseInt(y), parseInt(m)-2, 1);
    const refMonth = months[refDate.getMonth()]+'/'+refDate.getFullYear();
    const ds = new Date().toISOString().slice(0,10);
    const ns = new Date().toLocaleString('pt-BR');

    for (const c of clients) {
      const {rows:exist} = await pool.query('SELECT id FROM billings WHERE client_id=$1 AND month=$2',[c.id,month]);
      if (exist.length){ skipped++; continue; }

      // Create OS for the billing
      const osId = Date.now() + (Math.random()*999|0);
      await pool.query(
        `INSERT INTO orders(id,client_id,equipment_id,technician_id,status,description,budget,technician_notes,created_at,updated_at)
         VALUES($1,$2,NULL,NULL,'aprovado',$3,$4,$5,$6,$6)`,
        [osId, c.id,
         `Mensalidade de Serviços de TI — ${refMonth}`,
         c.monthly_value,
         `Contrato mensal de suporte e manutenção em TI referente a ${refMonth}. Gerada automaticamente.`,
         ds]
      );
      await pool.query(
        'INSERT INTO order_history(order_id,action_date,username,action,detail) VALUES($1,$2,$3,$4,$5)',
        [osId, ns, 'sistema', 'OS criada automaticamente', `Mensalidade ${refMonth} — R$ ${c.monthly_value}`]
      );

      // Create billing linked to OS
      const billingId = osId + 1;
      await pool.query(
        'INSERT INTO billings(id,client_id,month,amount,status,os_id) VALUES($1,$2,$3,$4,$5,$6)',
        [billingId, c.id, month, c.monthly_value, 'pendente', osId]
      );
      created++;
    }
    res.json({ok:true,created,skipped,refMonth});
  } catch(e){ console.error('[generate]',e); res.status(500).json({error:e.message}); }
});

app.put('/api/billings/:id', auth, async (req,res) => {
  try {
    const {status,amount,notes,sendMethod} = req.body;
    const paidAt = status==='pago' ? new Date() : null;
    await pool.query('UPDATE billings SET status=$1,amount=$2,notes=$3,send_method=$4,paid_at=$5 WHERE id=$6',[status,amount,notes||'',sendMethod||'whatsapp',paidAt,req.params.id]);
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/billings/:id', auth, async (req,res) => {
  try { await pool.query('DELETE FROM billings WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

// Send billing notification
app.post('/api/billings/:id/send', auth, async (req,res) => {
  try {
    const {rows} = await pool.query(`SELECT b.*,c.name,c.phone AS phone,c.billing_email AS email FROM billings b JOIN clients c ON c.id=b.client_id WHERE b.id=$1`,[req.params.id]);
    if (!rows.length) return res.status(404).json({error:'Não encontrado'});
    const b = rows[0];
    const msg = await buildBillingMsg({name:b.name}, b);
    const method = req.body.method||b.send_method||'whatsapp';

    if (method==='whatsapp') {
      if (!b.phone) return res.status(400).json({error:'Cliente sem telefone cadastrado'});
      // Send text message first
      await sendWhatsApp(b.phone, msg);
      // Send OS PDF if linked
      if (b.os_id) {
        try {
          const {rows:osRows} = await pool.query('SELECT * FROM orders WHERE id=$1',[b.os_id]);
          const {rows:clRows} = await pool.query('SELECT * FROM clients WHERE id=$1',[b.client_id]);
          if (osRows.length) {
            const osData = {...osRows[0], month: b.month};
            const pdfBase64 = await generateOSPDF(osData, clRows[0]||{name:b.name}, company);
            const [oy,om] = b.month.split('-');
            const omonths=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
            const orefDate = new Date(parseInt(oy),parseInt(om)-2,1);
            const orefMonth = omonths[orefDate.getMonth()]+'/'+orefDate.getFullYear();
            await sendWhatsAppDocument(b.phone, pdfBase64, `OS_${b.os_id}_${orefMonth.replace('/','_')}.pdf`, `📋 Ordem de Serviço #${b.os_id}`);
          }
        } catch(pdfErr) {
          console.error('[billing/pdf]', pdfErr.message);
          // Don't fail the whole send if PDF fails
        }
      }
    } else {
      const emailTo = b.email||b.billing_email;
      if (!emailTo) return res.status(400).json({error:'Cliente sem e-mail cadastrado'});
      const [y,m] = b.month.split('-');
      const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      await sendEmail(emailTo, `Cobrança de Mensalidade — ${months[parseInt(m)-1]}/${y}`,
buildEmailHtml(b, pixKey, company)
      );
    }
    await pool.query('UPDATE billings SET sent_at=NOW(),status=CASE WHEN status=$1 THEN $2 ELSE status END WHERE id=$3',['pendente','enviado',b.id]);
    res.json({ok:true});
  } catch(e){ console.error('[billing/send]',e); res.status(500).json({error:e.message}); }
});

// Config CRUD
app.get('/api/settings/config', auth, async (_,res) => {
  try {
    const keys=['evolution_url','evolution_key','evolution_instance','smtp_host','smtp_port','smtp_user','smtp_from','pix_key','company_name','company_phone'];
    const result={};
    for (const k of keys) result[k]=await getConfig(k);
    res.json(result);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/settings/config', auth, async (req,res) => {
  try {
    for (const [k,v] of Object.entries(req.body)) await setConfig(k,v);
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ── Auto-send cron (8h todo dia) ────────────────────────────────────────────
cron.schedule('0 8 * * *', async () => {
  try {
    const today = new Date();
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const yyyy = today.getFullYear();
    const month = `${yyyy}-${mm}`;
    const day = today.getDate();
    const {rows} = await pool.query(
      `SELECT b.*,c.name,c.client_phone AS phone,c.billing_email AS email,c.billing_day
       FROM billings b JOIN clients c ON c.id=b.client_id
       WHERE b.month=$1 AND b.status='pendente' AND b.sent_at IS NULL AND c.billing_day=$2`,
      [month, day]
    );
    for (const b of rows) {
      try {
        const msg = await buildBillingMsg({name:b.name}, b);
        if (b.send_method==='email' && b.email) await sendEmail(b.email,`Mensalidade ${month}`,`<p>${msg.replace(/\n/g,'<br>')}</p>`);
        else if (b.phone) await sendWhatsApp(b.phone, msg);
        await pool.query('UPDATE billings SET sent_at=NOW(),status=$1 WHERE id=$2',['enviado',b.id]);
        console.log(`[cron] Cobrança enviada: ${b.name} - ${month}`);
      } catch(e){ console.error(`[cron] Erro ao enviar ${b.name}:`,e.message); }
    }
  } catch(e){ console.error('[cron] Erro geral:',e); }
});

// ── Vault routes ────────────────────────────────────────────────────────────
app.get('/api/vault/:clientId', auth, async (req,res) => {
  try {
    const cid = req.params.clientId;
    const [cr,fr] = await Promise.all([
      pool.query('SELECT * FROM vault_credentials WHERE client_id=$1 ORDER BY created_at',[cid]),
      pool.query('SELECT id,client_id,credential_id,name,file_type,mime_type,created_at FROM vault_files WHERE client_id=$1 ORDER BY created_at',[cid]),
    ]);
    res.json({ credentials: cr.rows.map(c=>({...c,username:vaultDecrypt(c.username),password:vaultDecrypt(c.password)})), files: fr.rows });
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/vault/credential', auth, async (req,res) => {
  try {
    const {clientId,title,username,password,url,notes} = req.body;
    const id = Date.now();
    await pool.query('INSERT INTO vault_credentials(id,client_id,title,username,password,url,notes) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,clientId,title,vaultEncrypt(username||''),vaultEncrypt(password||''),url||'',notes||'']);
    res.json({ok:true,id});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.put('/api/vault/credential/:id', auth, async (req,res) => {
  try {
    const {title,username,password,url,notes} = req.body;
    await pool.query('UPDATE vault_credentials SET title=$1,username=$2,password=$3,url=$4,notes=$5 WHERE id=$6',[title,vaultEncrypt(username||''),vaultEncrypt(password||''),url||'',notes||'',req.params.id]);
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/vault/credential/:id', auth, async (req,res) => {
  try { await pool.query('DELETE FROM vault_credentials WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/vault/file', auth, async (req,res) => {
  try {
    const {clientId,credentialId,name,fileType,data,mimeType} = req.body;
    const id = Date.now();
    await pool.query('INSERT INTO vault_files(id,client_id,credential_id,name,file_type,data,mime_type) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,clientId,credentialId||null,name,fileType||'image',data,mimeType||'image/png']);
    res.json({ok:true,id});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/api/vault/file/:id', auth, async (req,res) => {
  try {
    const {rows} = await pool.query('SELECT * FROM vault_files WHERE id=$1',[req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Not found'});
    res.json(rows[0]);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/vault/file/:id', auth, async (req,res) => {
  try { await pool.query('DELETE FROM vault_files WHERE id=$1',[req.params.id]); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});


// ── Serviços ───────────────────────────────────────────────────────────────
app.get('/api/services', auth, async (_,res) => {
  try {
    const r = await pool.query('SELECT * FROM services ORDER BY category, name');
    res.json(r.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/services', auth, async (req,res) => {
  try {
    const {name,description,default_price,category,active} = req.body;
    const r = await pool.query(
      'INSERT INTO services (name,description,default_price,category,active,created_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *',
      [name, description||'', default_price||0, category||'Outros', active!==false]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/services/:id', auth, async (req,res) => {
  try {
    const {name,description,default_price,category,active} = req.body;
    const r = await pool.query(
      'UPDATE services SET name=$1,description=$2,default_price=$3,category=$4,active=$5 WHERE id=$6 RETURNING *',
      [name, description||'', default_price||0, category||'Outros', active!==false, req.params.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/services/:id', auth, async (req,res) => {
  try {
    await pool.query('DELETE FROM services WHERE id=$1', [req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});


// ── Fotos de OS ────────────────────────────────────────────────────────────
app.get('/api/os/:id/photos', auth, async (req,res) => {
  try {
    const r = await pool.query('SELECT id,name,tipo,mime_type,created_at FROM os_photos WHERE order_id=$1 ORDER BY created_at', [req.params.id]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/os/photos/:id/data', auth, async (req,res) => {
  try {
    const r = await pool.query('SELECT data,mime_type FROM os_photos WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({error:'not found'});
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/os/:id/photos', auth, async (req,res) => {
  try {
    const {name,tipo,data,mimeType} = req.body;
    const id = Date.now();
    const r = await pool.query(
      'INSERT INTO os_photos(id,order_id,name,tipo,data,mime_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,tipo,mime_type,created_at',
      [id, req.params.id, name||'foto', tipo||'antes', data, mimeType||'image/jpeg']
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/os/photos/:id', auth, async (req,res) => {
  try {
    await pool.query('DELETE FROM os_photos WHERE id=$1', [req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});


// ── Despesas (Expenses) ────────────────────────────────────────────────────
app.get('/api/expenses', auth, async (req,res) => {
  try {
    const month = req.query.month;
    let q, params = [];
    if (month) {
      q = `SELECT id, description, category, amount::float, to_char(due_date,'YYYY-MM-DD') AS due_date,
                  CASE WHEN status='pendente' AND due_date < CURRENT_DATE THEN 'atrasado' ELSE status END AS status,
                  to_char(paid_at,'YYYY-MM-DD') AS paid_at, payment_method, recurring, frequency, parent_recurring_id, notes
           FROM expenses WHERE to_char(due_date,'YYYY-MM')=$1 ORDER BY due_date`;
      params = [month];
    } else {
      q = `SELECT id, description, category, amount::float, to_char(due_date,'YYYY-MM-DD') AS due_date,
                  CASE WHEN status='pendente' AND due_date < CURRENT_DATE THEN 'atrasado' ELSE status END AS status,
                  to_char(paid_at,'YYYY-MM-DD') AS paid_at, payment_method, recurring, frequency, parent_recurring_id, notes
           FROM expenses ORDER BY due_date DESC`;
    }
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/expenses/summary', auth, async (req,res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0,7);
    const r = await pool.query(`
      SELECT
        COALESCE(SUM(amount),0)::float AS total,
        COALESCE(SUM(CASE WHEN status='pago' THEN amount ELSE 0 END),0)::float AS paid,
        COALESCE(SUM(CASE WHEN status='pendente' AND due_date >= CURRENT_DATE THEN amount ELSE 0 END),0)::float AS pending,
        COALESCE(SUM(CASE WHEN status='pendente' AND due_date < CURRENT_DATE THEN amount ELSE 0 END),0)::float AS overdue,
        COUNT(*) FILTER (WHERE status='pendente' AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')::int AS due_soon_count
      FROM expenses WHERE to_char(due_date,'YYYY-MM')=$1
    `, [month]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/expenses/alerts', auth, async (_,res) => {
  try {
    const r = await pool.query(`
      SELECT id, description, category, amount::float, to_char(due_date,'YYYY-MM-DD') AS due_date,
             (due_date - CURRENT_DATE) AS days_until
      FROM expenses
      WHERE status='pendente' AND due_date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY due_date
    `);
    res.json(r.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/expenses', auth, async (req,res) => {
  try {
    const {description,category,amount,dueDate,status,recurring,frequency,notes,paymentMethod} = req.body;
    const id = Date.now();
    const r = await pool.query(
      `INSERT INTO expenses (id, description, category, amount, due_date, status, recurring, frequency, notes, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, description, category||'Outros', amount||0, dueDate, status||'pendente', !!recurring, frequency||'mensal', notes||'', paymentMethod||'']
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/expenses/:id', auth, async (req,res) => {
  try {
    const {description,category,amount,dueDate,status,recurring,frequency,notes,paymentMethod,paidAt} = req.body;
    const pa = status === 'pago' ? (paidAt || new Date().toISOString().slice(0,10)) : null;
    await pool.query(
      `UPDATE expenses SET description=$1, category=$2, amount=$3, due_date=$4, status=$5,
             recurring=$6, frequency=$7, notes=$8, payment_method=$9, paid_at=$10
       WHERE id=$11`,
      [description, category||'Outros', amount||0, dueDate, status||'pendente',
       !!recurring, frequency||'mensal', notes||'', paymentMethod||'', pa, req.params.id]
    );

    // Se foi marcada como paga e é recorrente, gerar próxima
    if (status === 'pago' && recurring) {
      const {rows} = await pool.query('SELECT * FROM expenses WHERE id=$1', [req.params.id]);
      const e = rows[0];
      // Verifica se já existe próxima ocorrência
      const next = new Date(e.due_date);
      if (e.frequency === 'mensal') next.setMonth(next.getMonth()+1);
      else if (e.frequency === 'anual') next.setFullYear(next.getFullYear()+1);
      else if (e.frequency === 'semanal') next.setDate(next.getDate()+7);
      else if (e.frequency === 'trimestral') next.setMonth(next.getMonth()+3);
      const nextDate = next.toISOString().slice(0,10);

      const {rows:exists} = await pool.query(
        `SELECT id FROM expenses WHERE description=$1 AND due_date=$2 AND parent_recurring_id=$3`,
        [e.description, nextDate, e.parent_recurring_id || e.id]
      );
      if (!exists.length) {
        const newId = Date.now() + Math.floor(Math.random()*1000);
        await pool.query(
          `INSERT INTO expenses (id, description, category, amount, due_date, status, recurring, frequency, notes, parent_recurring_id)
           VALUES ($1,$2,$3,$4,$5,'pendente',true,$6,$7,$8)`,
          [newId, e.description, e.category, e.amount, nextDate, e.frequency, e.notes, e.parent_recurring_id || e.id]
        );
      }
    }

    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/expenses/:id', auth, async (req,res) => {
  try {
    await pool.query('DELETE FROM expenses WHERE id=$1', [req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});


// ── Agent: Inventário Automático ──────────────────────────────────────────
// Endpoint público para o agente fazer checkin (autenticação por token)
app.post('/api/agent/checkin', async (req, res) => {
  try {
    const token = req.headers['x-agent-token'];
    if (!token) return res.status(401).json({error:'token ausente'});
    const {rows} = await pool.query('SELECT equipment_id, status FROM agent_tokens WHERE token=$1', [token]);
    if (!rows.length) return res.status(401).json({error:'token inválido'});
    if (rows[0].status === 'pending') return res.status(403).json({error:'pending', message:'Aguardando aprovação'});
    if (rows[0].status === 'revoked') return res.status(403).json({error:'revoked'});
    if (!rows[0].equipment_id) return res.status(403).json({error:'no_equipment'});
    const equipId = rows[0].equipment_id;
    const data = req.body || {};
    // Atualiza last_checkin e hostname
    await pool.query('UPDATE agent_tokens SET last_checkin=NOW(), hostname=$1 WHERE token=$2', [data.hostname||'', token]);
    // Insere snapshot
    await pool.query('INSERT INTO inventory_snapshots(equipment_id, token, data) VALUES($1,$2,$3)', [equipId, token, JSON.stringify(data)]);
    // Limita histórico: mantém últimos 30 snapshots por equipamento
    await pool.query(`DELETE FROM inventory_snapshots WHERE equipment_id=$1 AND id NOT IN (SELECT id FROM inventory_snapshots WHERE equipment_id=$1 ORDER BY collected_at DESC LIMIT 30)`, [equipId]);
    res.json({ok:true, message:'inventário registrado'});
  } catch(e){ console.error('[agent checkin]',e); res.status(500).json({error:e.message}); }
});

// Gerar token para um equipamento
app.post('/api/equipment/:id/agent-token', auth, async (req, res) => {
  try {
    const equipId = req.params.id;
    const token = require('crypto').randomBytes(24).toString('hex');
    await pool.query('INSERT INTO agent_tokens(token, equipment_id) VALUES($1, $2)', [token, equipId]);
    res.json({ok:true, token});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Listar tokens de um equipamento
app.get('/api/equipment/:id/agent-tokens', auth, async (req, res) => {
  try {
    const {rows} = await pool.query('SELECT token, hostname, last_checkin, active, created_at FROM agent_tokens WHERE equipment_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Revogar token
app.delete('/api/agent-tokens/:token', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM agent_tokens WHERE token=$1', [req.params.token]);
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Buscar último snapshot e histórico de um equipamento
app.get('/api/equipment/:id/inventory', auth, async (req, res) => {
  try {
    const {rows} = await pool.query('SELECT id, data, collected_at FROM inventory_snapshots WHERE equipment_id=$1 ORDER BY collected_at DESC LIMIT 30', [req.params.id]);
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});


// ── Agent: Auto-registro ──────────────────────────────────────────────────
// Endpoint público: agente se registra sozinho ao instalar
app.post('/api/agent/register', async (req, res) => {
  try {
    // Valida token secreto de registro
    const regSecret = req.headers['x-register-secret'] || req.body?.registerSecret;
    const expectedSecret = process.env.REGISTER_SECRET;
    if (!expectedSecret || regSecret !== expectedSecret) {
      return res.status(403).json({error:'token de registro inválido'});
    }
    const info = req.body || {};
    if (!info.hostname) return res.status(400).json({error:'hostname obrigatório'});
    // Gera token único
    const token = require('crypto').randomBytes(24).toString('hex');
    await pool.query(
      'INSERT INTO agent_tokens(token, hostname, status, auto_info) VALUES($1,$2,$3,$4)',
      [token, info.hostname, 'pending', JSON.stringify(info)]
    );
    res.json({ok:true, token, status:'pending', message:'Aguardando aprovação no TechOS'});
  } catch(e){ console.error('[register]',e); res.status(500).json({error:e.message}); }
});

// Listar agentes pendentes
app.get('/api/agents/pending', auth, async (_, res) => {
  try {
    const {rows} = await pool.query(`
      SELECT token, hostname, auto_info, created_at
      FROM agent_tokens WHERE status='pending' ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Listar todos os agentes (active + pending)
app.get('/api/agents', auth, async (_, res) => {
  try {
    const {rows} = await pool.query(`
      SELECT t.token, t.hostname, t.status, t.equipment_id, t.last_checkin, t.created_at, t.auto_info,
             e.type AS equip_type, e.brand, e.model, e.serial,
             c.id AS client_id, c.name AS client_name
      FROM agent_tokens t
      LEFT JOIN equipment e ON e.id = t.equipment_id
      LEFT JOIN clients c ON c.id = e.client_id
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Aprovar agente: vincular a equipamento existente
app.post('/api/agent/approve/:token', auth, async (req, res) => {
  try {
    const {equipmentId} = req.body;
    if (!equipmentId) return res.status(400).json({error:'equipmentId obrigatório'});
    await pool.query(
      `UPDATE agent_tokens SET status='active', equipment_id=$1 WHERE token=$2`,
      [equipmentId, req.params.token]
    );
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Aprovar agente criando novo equipamento
app.post('/api/agent/approve-new/:token', auth, async (req, res) => {
  try {
    const {clientId, collaborator} = req.body;
    if (!clientId) return res.status(400).json({error:'clientId obrigatório'});
    const {rows} = await pool.query('SELECT auto_info, hostname FROM agent_tokens WHERE token=$1', [req.params.token]);
    if (!rows.length) return res.status(404).json({error:'token não encontrado'});
    const info = rows[0].auto_info || {};
    const equipId = Date.now();
    await pool.query(
      `INSERT INTO equipment (id, client_id, type, brand, model, serial, collaborator, processor, ram, storage, os_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [equipId, clientId,
       info.deviceType || 'Computador',
       info.manufacturer || '',
       info.productName || rows[0].hostname,
       info.serialNumber || '',
       collaborator || info.user || '',
       info.cpu || '',
       info.ramGB ? `${info.ramGB} GB` : '',
       info.storageGB ? `${info.storageGB} GB` : '',
       info.osName || '']
    );
    await pool.query(
      `UPDATE agent_tokens SET status='active', equipment_id=$1 WHERE token=$2`,
      [equipId, req.params.token]
    );
    res.json({ok:true, equipmentId:equipId});
  } catch(e){ console.error('[approve-new]',e); res.status(500).json({error:e.message}); }
});

// Endpoint para o agente verificar se já foi aprovado
app.get('/api/agent/status/:token', async (req, res) => {
  try {
    const {rows} = await pool.query('SELECT status FROM agent_tokens WHERE token=$1', [req.params.token]);
    if (!rows.length) return res.status(404).json({error:'token não encontrado'});
    res.json({status: rows[0].status});
  } catch(e){ res.status(500).json({error:e.message}); }
});


app.get('/api/billings/summary', auth, async (req, res) => {
  try {
    const r = await pool.query(`SELECT COALESCE(SUM(monthly_value),0)::float AS mrr FROM clients WHERE client_type='contrato' AND monthly_value>0`);
    res.json({ mrr: r.rows[0].mrr });
  } catch(e){ res.status(500).json({error:e.message}); }
});


// ── Agent Alerts ──────────────────────────────────────────────────────────
app.post('/api/agent/alert', async (req, res) => {
  try {
    const token = req.headers['x-agent-token'];
    if (!token) return res.status(401).json({error:'token ausente'});

    const {rows} = await pool.query('SELECT equipment_id, status FROM agent_tokens WHERE token=$1', [token]);
    if (!rows.length || rows[0].status !== 'active') return res.status(401).json({error:'token inválido'});
    const equipId = rows[0].equipment_id;

    const { alertType, message, data } = req.body;
    if (!alertType || !message) return res.status(400).json({error:'alertType e message obrigatórios'});

    // Verifica se já enviou esse alerta nas últimas 24h (evita spam)
    const {rows:recent} = await pool.query(
      `SELECT id FROM agent_alerts WHERE token=$1 AND alert_type=$2 AND sent_at > NOW() - INTERVAL '24 hours'`,
      [token, alertType]
    );
    if (recent.length) return res.json({ok:true, skipped:true, message:'alerta já enviado nas últimas 24h'});

    // Salva o alerta
    await pool.query(
      'INSERT INTO agent_alerts(token, equipment_id, alert_type, message, data) VALUES($1,$2,$3,$4,$5)',
      [token, equipId, alertType, message, JSON.stringify(data||{})]
    );

    // Busca hostname e cliente para montar mensagem
    const {rows:info} = await pool.query(`
      SELECT t.hostname, c.name AS client_name, c.phone AS client_phone,
             e.type AS equip_type, e.brand, e.model
      FROM agent_tokens t
      LEFT JOIN equipment e ON e.id = t.equipment_id
      LEFT JOIN clients c ON c.id = e.client_id
      WHERE t.token=$1
    `, [token]);

    const ag = info[0] || {};
    const waMSG = `🚨 *ALERTA TechOS*\n\n` +
      `📍 *Equipamento:* ${ag.hostname || 'Desconhecido'}\n` +
      `👤 *Cliente:* ${ag.client_name || '—'}\n` +
      `💻 *Dispositivo:* ${ag.equip_type||''} ${ag.brand||''} ${ag.model||''}\n\n` +
      `⚠️ *Alerta:* ${message}`;

    // Envia WhatsApp para André (número fixo do admin)
    try {
      await fetch('http://evolution_api:8080/message/sendText/Suporte_ALMS', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'apikey':'ALMS_SUPPORT_KEY_2026' },
        body: JSON.stringify({ number:'5543996454331', text: waMSG })
      });
      await pool.query('UPDATE agent_alerts SET whatsapp_sent=true WHERE token=$1 AND alert_type=$2 AND sent_at > NOW() - INTERVAL \'1 minute\'', [token, alertType]);
    } catch(e) { console.error('[alert whatsapp]', e.message); }

    res.json({ok:true, sent:true});
  } catch(e){ console.error('[agent alert]',e); res.status(500).json({error:e.message}); }
});

// Listar alertas de um equipamento
app.get('/api/equipment/:id/alerts', auth, async (req, res) => {
  try {
    const {rows} = await pool.query(
      'SELECT id, alert_type, message, data, sent_at, whatsapp_sent FROM agent_alerts WHERE equipment_id=$1 ORDER BY sent_at DESC LIMIT 50',
      [req.params.id]
    );
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});


// ── Agent Config & Usage ──────────────────────────────────────────────────

// Buscar config do agente (chamado pelo agente a cada execução)
app.get('/api/agent/config/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const {rows} = await pool.query('SELECT status FROM agent_tokens WHERE token=$1', [token]);
    if (!rows.length || rows[0].status !== 'active') return res.status(401).json({error:'token inválido'});

    // Busca config ou retorna padrão
    const {rows:cfg} = await pool.query('SELECT * FROM agent_config WHERE token=$1', [token]);
    if (cfg.length) {
      res.json(cfg[0]);
    } else {
      // Cria config padrão
      await pool.query(
        'INSERT INTO agent_config(token) VALUES($1) ON CONFLICT DO NOTHING', [token]
      );
      res.json({
        token, collect_interval_hours:24,
        collect_hardware:true, collect_software:true,
        collect_network:true, collect_usage:false,
        alert_disk_pct:10,
        alert_services:['WinDefend','MpsSvc','EventLog']
      });
    }
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Salvar config do agente (chamado pelo TechOS)
app.put('/api/agent/config/:token', auth, async (req, res) => {
  try {
    const { collect_interval_hours, collect_hardware, collect_software,
            collect_network, collect_usage, alert_disk_pct, alert_services } = req.body;
    await pool.query(`
      INSERT INTO agent_config(token, collect_interval_hours, collect_hardware, collect_software,
        collect_network, collect_usage, alert_disk_pct, alert_services, updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      ON CONFLICT(token) DO UPDATE SET
        collect_interval_hours=$2, collect_hardware=$3, collect_software=$4,
        collect_network=$5, collect_usage=$6, alert_disk_pct=$7,
        alert_services=$8, updated_at=NOW()
    `, [req.params.token, collect_interval_hours||24, collect_hardware!==false,
        collect_software!==false, collect_network!==false, !!collect_usage,
        alert_disk_pct||10, alert_services||['WinDefend','MpsSvc','EventLog']]);
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Receber dados de uso (home office)
app.post('/api/agent/usage', async (req, res) => {
  try {
    const token = req.headers['x-agent-token'];
    if (!token) return res.status(401).json({error:'token ausente'});
    const {rows} = await pool.query('SELECT equipment_id, status FROM agent_tokens WHERE token=$1', [token]);
    if (!rows.length || rows[0].status !== 'active') return res.status(401).json({error:'token inválido'});
    if (!rows[0].equipment_id) return res.status(403).json({error:'no_equipment'});

    const { eventType, username, sessionStart, sessionEnd,
            idleSeconds, activeSeconds, processes } = req.body;

    await pool.query(`
      INSERT INTO agent_usage(equipment_id, token, event_type, username, session_start,
        session_end, idle_seconds, active_seconds, processes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [rows[0].equipment_id, token, eventType||'session',
        username||'', sessionStart||null, sessionEnd||null,
        idleSeconds||0, activeSeconds||0, JSON.stringify(processes||[])]);

    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Buscar dados de uso de um equipamento
app.get('/api/equipment/:id/usage', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const {rows} = await pool.query(`
      SELECT id, event_type, username, session_start, session_end,
             idle_seconds, active_seconds, processes, collected_at
      FROM agent_usage
      WHERE equipment_id=$1 AND collected_at > NOW() - ($2 || ' days')::INTERVAL
      ORDER BY collected_at DESC
      LIMIT 200
    `, [req.params.id, days]);
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Resumo de uso por equipamento (para relatório)
app.get('/api/equipment/:id/usage/summary', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const {rows} = await pool.query(`
      SELECT
        DATE(collected_at) AS day,
        SUM(active_seconds) AS total_active,
        SUM(idle_seconds) AS total_idle,
        COUNT(*) AS sessions,
        MAX(username) AS last_user
      FROM agent_usage
      WHERE equipment_id=$1 AND collected_at > NOW() - ($2 || ' days')::INTERVAL
      GROUP BY DATE(collected_at)
      ORDER BY day DESC
    `, [req.params.id, days]);
    res.json(rows);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.get('*', (_,res) => res.sendFile(path.join(__dirname,'dist','index.html')));

async function boot() {
  console.log('[DB] conectando…');
  for (let i=0;i<20;i++) { try { await pool.query('SELECT 1'); break; } catch { await new Promise(r=>setTimeout(r,2000)); } }
  await initSchema(); await seedIfEmpty(); await ensureToken();
  const PORT = process.env.PORT||3001;
  app.listen(PORT, () => console.log(`[APP] TechOS na porta ${PORT}`));
}
boot().catch(e=>{ console.error('[FATAL]',e); process.exit(1); });
