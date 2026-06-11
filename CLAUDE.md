# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Local dev (frontend only — API calls will fail without a backend)
npm run dev          # Vite dev server on :5173

# Production build
npm run build        # outputs to dist/

# Run the production server (Express + serves dist/)
npm start            # node server.js — requires DATABASE_URL

# Docker (full stack with Postgres — required for any backend work)
docker compose up -d --build   # build + start in background
docker logs techos -f          # follow logs
docker compose down            # stop
```

No test runner is configured.

## Architecture

**Single-process full-stack**: `server.js` (Express) serves the Vite-built React SPA from `dist/` at runtime. There is no separate API server — `npm start` does everything.

**Database**: PostgreSQL via `pg.Pool`. `initSchema()` at startup creates all tables and runs idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` migrations inline — there is no migration tool. IDs across all tables are `Date.now()` (bigint timestamps) except `services` and `order_history` which use `SERIAL`.

**Main data sync pattern**: Users, clients, equipment, and OS orders are loaded in one shot via `GET /api/data` into React state in `App.jsx`. Any state change triggers a debounced (800ms) `POST /api/data` that does a full upsert-and-delete-orphans in a transaction (`saveAll`). All other entities (chamados, billings, expenses, vault, services, photos, agents) have their own dedicated REST endpoints and are **not** part of this bulk sync.

**Delete vs. bulk-save for core entities**: Deleting an OS, client, or equipment must call the dedicated `DELETE /api/os/:id`, `/api/clients/:id`, or `/api/equipment/:id` endpoints (via `deleteOS`, `deleteClient`, `deleteEquipment` in `src/api.js`). Removing from local state alone is not enough — the next 800ms auto-save would re-insert the deleted row.

**Frontend routing**: No React Router. `App.jsx` holds a `page` string in state and renders from a `pages` map (`{ dashboard, os, clients, equipment, … }`). Navigation is done by calling `setPage(name)`.

**Auth**: JWT signed with `JWT_SECRET` env var, stored in `localStorage` as `techos_jwt`, expires in 10h. The `auth` middleware covers all `/api/*` routes except `/api/auth/login`, `/api/health`, `/api/webhook/*`, and `/api/agent/*` (register/checkin/status/config/alert/usage). On a 401 response, `src/api.js` automatically clears the token and reloads the page.

**UI component library**: `src/components/ui.jsx` exports reusable primitives — `Btn`, `Card`, `Modal`, `Field`, `G2`, `Empty`, `Tabs`, `Th`, `Td`, `Tr`, `Badge`, `RoleBadge`. Use these before writing new styled elements.

**Design system**: CSS variables and a global reset are defined in the `CSS` export of `src/constants.js` and injected via `<style>` in `src/main.jsx`. Key vars: `--bg`, `--surface`, `--surface2`, `--border`, `--accent`, `--red`, `--green`, `--yellow`, `--purple`, `--muted`, `--text`. All styling is inline using these vars. `src/constants.js` also exports the canonical `STATUS` map (labels + colors per OS status), and utilities `today()`, `nowStr()`, `fmtPhone()`, `waLink()`.

**Vault encryption**: Credentials are encrypted AES-256-CBC before storing. Key is derived from `VAULT_KEY` env var (falls back to `JWT_SECRET`) via `crypto.scryptSync`. Stored as `iv_hex:ciphertext_hex`.

**Billing automation**: A `node-cron` job runs daily at 08:00 and sends pending billings to clients whose `billing_day` matches today, via WhatsApp (Evolution API) or email (SMTP nodemailer). `POST /api/billings/generate` also creates a linked OS (`orders` row) for each contract client; the billing and OS are linked via `billings.os_id`. Sending a billing via WhatsApp also sends the linked OS as a PDF. Config (Evolution URL/key/instance, SMTP, PIX key, company name) is stored as key-value rows in the `config` table and managed via `GET/POST /api/settings/config`.

**Recurring expenses**: Marking an expense as `pago` when `recurring=true` automatically creates the next occurrence (monthly/annual/weekly/quarterly) if one doesn't already exist, linked via `parent_recurring_id`.

**Inventory agents**: Equipment agents self-register via `POST /api/agent/register` using a `REGISTER_SECRET` header. They land in `pending` status until approved in the UI. After approval they send periodic inventory snapshots to `POST /api/agent/checkin` using their token. Last 30 snapshots per equipment are kept. Agents can also send alerts (`POST /api/agent/alert`) — a 24h dedup window prevents spam — and usage/session data (`POST /api/agent/usage`). Agent-related tables: `agent_tokens`, `inventory_snapshots`, `agent_config`, `agent_alerts`, `agent_usage`.

**Webhooks**: `POST /api/webhook/os` and `POST /api/webhook/chamado` are public endpoints authenticated by a rotating token stored in the `config` table (`webhook_token`). They auto-create clients if a matching phone/name isn't found.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | No | JWT signing key (has default — change in prod) |
| `VAULT_KEY` | No | Vault encryption key (defaults to JWT_SECRET) |
| `REGISTER_SECRET` | Yes | Secret for agent auto-registration |
| `POSTGRES_PASSWORD` | Docker only | Postgres password for `techos-db` container |

See `.env.example` for the template. The app binds to `PORT` env var (default 3001 in docker-compose).

## Deploy

The app sits behind Caddy (reverse proxy). The container exposes `127.0.0.1:3001`. Caddy's Caddyfile should proxy the domain to `techos:3001`. The Docker network must be shared between the `techos` and `caddy` containers.

Default credentials after first seed: `admin / admin123` (role: admin), `tecnico / tech123` (role: técnico). Change immediately after first login.
