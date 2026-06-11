# TechOS – Deploy no VPS com Docker + Caddy

## 1. Copiar os arquivos para o VPS

No seu computador local, rode:
```bash
scp -r ./techOS ubuntu@SEU_IP_VPS:/opt/stack/techOS
```

Ou clone/crie a pasta direto no VPS:
```bash
mkdir -p /opt/stack/techOS
# e coloque os arquivos lá
```

---

## 2. Build e iniciar o container

```bash
cd /opt/stack/techOS
docker compose up -d --build
```

Isso vai:
- Fazer o build da aplicação React com Node.js
- Criar um container Nginx leve servindo os arquivos
- Subir o container em background

---

## 3. Conectar ao Caddy (proxy reverso)

Seu servidor usa Caddy como proxy reverso. Você precisa que o
container `techOS` esteja na mesma rede Docker que o Caddy.

### Descobrir a rede do Caddy:
```bash
docker inspect caddy | grep -A 10 '"Networks"'
```

### Conectar o techOS a essa rede:
```bash
# Exemplo: se a rede for "caddy_bridge" ou "bridge"
docker network connect bridge techOS
```

Ou edite o `docker-compose.yml` e coloque o nome correto da rede
do Caddy no campo `name:` da seção `networks`.

---

## 4. Configurar o Caddyfile

Edite o Caddyfile do seu servidor (geralmente em `/home/ubuntu/caddy/`):

```bash
nano /home/ubuntu/caddy/Caddyfile
```

Adicione este bloco (substitua pelo seu domínio):

```
os.seudominio.com.br {
    reverse_proxy techOS:80
}
```

Depois recarregue o Caddy:
```bash
cd /home/ubuntu/caddy
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Ou reinicie:
```bash
docker compose restart caddy
```

---

## 5. Verificar

Acesse no navegador: `https://os.seudominio.com.br`

O Caddy vai emitir o certificado SSL automaticamente.

---

## Credenciais padrão

| Usuário  | Senha     | Perfil |
|----------|-----------|--------|
| admin    | admin123  | Admin  |
| tecnico  | tech123   | Técnico|

**⚠️ Troque as senhas pelo menu Usuários após o primeiro acesso!**

---

## Comandos úteis

```bash
# Ver logs
docker logs techOS -f

# Parar
docker compose down

# Rebuild após atualização
docker compose up -d --build

# Ver se está rodando
docker ps | grep techOS
```

---

## Estrutura de arquivos

```
techOS/
├── src/
│   ├── main.jsx       # Entrada React
│   └── App.jsx        # Aplicação completa
├── index.html
├── vite.config.js
├── package.json
├── Dockerfile         # Build multi-estágio
├── nginx.conf         # Config Nginx interno
├── docker-compose.yml # Orquestração
└── README.md
```
