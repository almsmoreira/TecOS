#!/bin/bash
DATE=$(date +%Y%m%d_%H%M)
HOST_DIR="/opt/stack/backups-techos"
HOST_FILE="$HOST_DIR/backup_$DATE.sql"
CONTAINER_FILE="/app/data/backup_$DATE.sql"

mkdir -p "$HOST_DIR"

# Gera dump dentro do container (em /app/data, que é volume persistente)
docker exec techos-db pg_dump -U techos techos > /tmp/backup_$DATE.sql
docker cp /tmp/backup_$DATE.sql techos:$CONTAINER_FILE
rm /tmp/backup_$DATE.sql

# Envia por email com anexo (path agora é válido DENTRO do container)
docker exec -e BACKUP_FILE="$CONTAINER_FILE" -e BACKUP_DATE="$DATE" techos node -e "
const {Pool}=require('pg');
const nodemailer=require('nodemailer');
const pool=new Pool({connectionString: process.env.DATABASE_URL});
pool.query('SELECT key,value FROM config').then(r=>{
  const cfg={};
  r.rows.forEach(x=>cfg[x.key]=x.value);
  const transporter=nodemailer.createTransport({
    host:cfg.smtp_host,
    port:parseInt(cfg.smtp_port)||587,
    secure:false,
    auth:{user:cfg.smtp_user,pass:cfg.smtp_pass}
  });
  transporter.sendMail({
    from: cfg.smtp_user,
    to: 'cobranca@almstecnologia.com.br',
    subject: 'Backup TechOS — ' + process.env.BACKUP_DATE,
    text: 'Backup automático do banco de dados TechOS.\nGerado em: ' + process.env.BACKUP_DATE,
    attachments:[{ filename:'backup_' + process.env.BACKUP_DATE + '.sql', path: process.env.BACKUP_FILE }]
  }).then(()=>{
    console.log('✅ Email enviado!');
    pool.end();
  }).catch(e=>{ console.error('❌ Erro email:', e.message); pool.end(); });
});
"

# Copia do container pro host (arquivo histórico)
docker cp techos:$CONTAINER_FILE $HOST_FILE

# Remove o backup interno do container (não precisa ficar lá)
docker exec techos rm -f $CONTAINER_FILE

# Retenção: 7 dias no host
find "$HOST_DIR" -name "backup_*.sql" -mtime +7 -delete

echo "✅ Backup concluído: $HOST_FILE"
