# comGpt — The omnichannel growth operating system

comGpt is a multi-tenant marketing platform that unifies **email, WhatsApp and SMS**
campaigns, **visual automation**, a **shared inbox**, consent enforcement, billing and
revenue analytics in a single, colorful workspace.

```
Next.js 15 (App Router, React 19, TypeScript strict, Tailwind)
        │  same-origin proxy  (/api/backend/*)
        ▼
Spring Boot 3.5 (Java 21, modular monolith) ── RabbitMQ ── Worker
        │                │                        │
   PostgreSQL        Valkey/Redis            Provider adapters
   (Flyway)          (rate limits)        SMTP · Meta Cloud · Twilio
```

## Highlights

- **Multi-tenant by construction** — `organization_id` on every tenant-owned row, a
  `TenantContext` filter, and cross-module access only through ports.
- **Transactional outbox → RabbitMQ** — durable jobs and event-driven message statuses,
  never a Redis queue.
- **Channel-specific consent** — marketing vs. transactional consent and suppression are
  evaluated per channel before any send.
- **Idempotent delivery pipeline** — campaign recipients and messages carry stable
  idempotency keys; provider webhooks are deduplicated by `(provider, provider_event_id)`.
- **Provider SPI** — SMTP/SES email, WhatsApp Cloud API and pluggable HTTP SMS adapters
  behind one `MessageProvider` interface.
- **Planet-scale contact imports** — resumable 8 MB chunk uploads, worker-side streaming,
  transactional batch upserts and row-level error receipts for billion-row CSV files.
- **A UI built to be opened** — aurora mesh gradients, glass panels, gradient borders,
  Sora/Inter typography, light & dark themes, and a visual workflow studio on React Flow.

## Repository layout

| Path | Purpose |
| --- | --- |
| `backend/` | Maven multi-module Spring Boot app + worker |
| `frontend/` | Next.js App Router application |
| `database/migrations/` | Canonical Flyway SQL (source of truth for the schema) |
| `docs/00-decisions.md` | Binding engineering contracts |
| `infrastructure/` | Docker, monitoring, nginx |
| `scripts/` | Dev & build helpers |

## Modules

`common` · `identity` · `organization` · `crm` · `segmentation` · `consent` · `template` ·
`campaign` · `messaging` · `email` · `whatsapp` · `sms` · `automation` · `inbox` ·
`analytics` · `integration` · `billing` · `audit` · `app` (API) · `worker`.

Modules only talk to each other through interfaces in `omniflow-common` (`port/`).
`@RabbitListener` and `@Scheduled` beans are `@Profile("worker")`; the API includes every
module but runs no background consumers.

## Quick start (Docker)

Requires Docker Desktop and Node 20+ for the frontend toolchain.

```powershell
copy .env.example .env
docker compose up --build
```

| Service | URL |
| --- | --- |
| App | http://localhost:3000 |
| API | http://localhost:8080 |
| OpenAPI / Swagger UI | http://localhost:8080/swagger-ui.html |
| Health | http://localhost:8080/actuator/health |
| Mailpit (captured email) | http://localhost:8025 |
| RabbitMQ management | http://localhost:15672 |

Demo workspace (seeded on first start when `OMNIFLOW_DEMO_DATA=true`):

```
Email:    owner@omniflow.local
Password: OmniFlow123!
Workspace: Acme Retail
```

The demo seed adds contacts, tags, channel-specific consent records and suppressions, a
dynamic segment, published templates, campaigns with message history, conversations, a
published workflow, usage records and audit entries.

### Data persistence & backups

All business data lives in PostgreSQL on the named volume `omniflow_pgdata`. Restarts,
image rebuilds, `docker compose up --force-recreate` and redeploys **keep the data**;
only `docker compose down -v`, `scripts/db-reset.ps1`, or removing the volume deletes it.
Core services use `restart: unless-stopped`. Large CSV upload chunks are staged on the
shared `omniflow_importdata` volume so the API and worker can see the same file.

```powershell
# Backup (writes .\backups\omniflow-<timestamp>.dump, keeps the last 14)
.\scripts\backup-db.ps1

# Restore (stops API/worker/frontend, restores, restarts them)
.\scripts\restore-db.ps1 -BackupFile .\backups\omniflow-20261108-120000.dump
```

For a new host or environment, restore a backup or point `DATABASE_URL` at a managed
PostgreSQL instance. See `docs/02-data-persistence-and-flow.md` for the full persistence
matrix, the 41-table catalog, the bulk-import flow and the customer-facing end-to-end flow.

### Where can this be deployed?

comGpt does not use Supabase SDKs or proprietary services. It needs a standard
**PostgreSQL 16** database plus RabbitMQ, Redis/Valkey and a place to run the two Java
processes and the Next.js frontend:

- **Self-hosted / open source** — `docker compose up -d --build` on any Docker host.
  Data stays in the named volumes defined in `docker-compose.yml`.
- **Managed PostgreSQL** — point `DATABASE_URL`, `DATABASE_USERNAME` and
  `DATABASE_PASSWORD` at Supabase, Neon, RDS, Azure Database or any PostgreSQL provider.
  Flyway applies the schema automatically; the app is wire-compatible with Supabase's
  Postgres connection string (use the direct/5432 connection for migrations).
- **Kubernetes / PaaS** — deploy `backend-api`, `backend-worker` and `frontend` as separate
  services, mount a shared RWX volume at `IMPORT_STAGING_DIR` for both backend services,
  and provide PostgreSQL, RabbitMQ and Redis as managed services.

No code change is required for any of these options.

## Local development

The host does not need a JDK: all Java builds run in Docker.

```powershell
# Backend: compile + package (skip tests)
.\scripts\backend-build.ps1

# Backend: full verify (runs tests)
.\scripts\backend-build.ps1 verify
```

Direct equivalent:

```powershell
docker run --rm -v "${PWD}/backend:/workspace" -v "${HOME}/.m2:/root/.m2" -w /workspace `
  maven:3.9-eclipse-temurin-21 mvn -B -ntp -DskipTests package
```

Frontend (PowerShell blocks `npm.ps1`, so use `npm.cmd`):

```powershell
cd frontend
npm.cmd install
npm.cmd run dev        # http://localhost:3000
npm.cmd run typecheck
npm.cmd run build
```

Start only the infrastructure while running the API from an IDE:

```powershell
docker compose up postgres redis rabbitmq mailpit
```

Then run `com.omniflow.app.OmniFlowApplication`. To run the worker locally, use profile
`worker` and `-Dspring.profiles.active=docker,worker`.

## Environment

Everything is documented in `.env.example`. The important ones:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` / `DATABASE_USERNAME` / `DATABASE_PASSWORD` | PostgreSQL connection |
| `RABBITMQ_*` | Broker connection |
| `REDIS_HOST` / `REDIS_PORT` | Valkey/Redis |
| `OMNIFLOW_JWT_SECRET` | HS256 signing secret (≥ 32 bytes in production) |
| `OMNIFLOW_ENCRYPTION_KEY` | AES-256 key material for provider credentials |
| `OMNIFLOW_DEMO_DATA` | Seed the demo workspace |
| `SMTP_*` | SMTP / Mailpit / SES settings |
| `WHATSAPP_*` | Meta Cloud API token, phone number id, verify token, app secret |
| SMS gateway | No env needed — configure URL, API key and sender id per workspace under **Integrations** (encrypted at rest) |
| `OMNIFLOW_RATE_*_PER_MIN` | Per-organization, per-channel send limits |
| `IMPORT_*` | Shared CSV staging path, chunk/file limits, worker lock and retry settings |

Provider credentials stored in the database are encrypted with AES-GCM using a key derived
from `OMNIFLOW_ENCRYPTION_KEY` and are never returned by the API.

## API conventions

- Base path `/api/v1`.
- Every response is `{ "success": boolean, "data": T, "error": {...} | null, "timestamp": string }`.
- Tenant selection uses the `X-Organization-Id` header, validated against the caller's
  memberships by `TenantContextFilter`.
- Auth: `POST /api/v1/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`,
  `GET /api/v1/auth/me`.

The browser never holds a JWT. Next.js route handlers set `HttpOnly` cookies
(`of_access`, `of_refresh`, `of_org`) and the `/api/backend/[...path]` proxy injects the
bearer token and organization header, transparently refreshing an expired access token once.

## Webhooks

| Channel | Endpoint |
| --- | --- |
| Email (SES / SNS) | `POST /api/v1/webhooks/email/ses` |
| WhatsApp Cloud | `GET|POST /api/v1/webhooks/whatsapp` |
| SMS | `POST /api/v1/webhooks/sms/{provider}` (e.g. `twilio`, `generic`) |

Webhook handlers persist the raw payload first, then apply state transitions through
`MessageStatusMachine`; duplicate events are ignored.

## Testing

```powershell
.\scripts\backend-build.ps1 verify          # JUnit + integration tests
cd frontend; npm.cmd run typecheck; npm.cmd run lint; npm.cmd run build
```

With the stack running, the API smoke test exercises login, tenant scoping, contacts,
analytics, campaign launch, the outbox/worker pipeline and webhooks:

```powershell
.\scripts\smoke-test.ps1
```

## CI

`.github/workflows/ci.yml` builds the backend in a Maven container, type-checks and builds
the frontend, and validates the Compose configuration.

## Observability

An optional `observability` Compose profile starts OpenTelemetry Collector, Prometheus and
Grafana:

```powershell
docker compose --profile observability up
```

The API and worker expose `/actuator/health` and `/actuator/prometheus`.
