# ── Estágio 1: Build React ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# ── Estágio 2: Servidor Express ──────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copia apenas o necessário para produção
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY server.js .

# Volume para persistência dos dados
VOLUME ["/app/data"]

EXPOSE 3001
CMD ["node", "server.js"]
