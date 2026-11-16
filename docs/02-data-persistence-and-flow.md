# comGpt — Data persistence, table catalog and end-to-end flow

This document is the customer- and operator-facing explanation of **where comGpt stores
data**, **what survives a restart or redeploy**, and **how a message travels through the
platform**. It complements the binding engineering contracts in `docs/00-decisions.md`.

---

## 1. Persistence model

comGpt keeps all durable business data in **PostgreSQL**, mounted on a Docker **named
volume**:

| Service | Storage | Data |
|---|---|---|
| `postgres` | named volume `omniflow_pgdata` | **All business data** (the only source of truth) |
| `rabbitmq` | named volume `omniflow_rabbitdata` | Broker definitions + in-flight messages |
| `redis` | **no volume** | Rate-limit counters only — safe to lose |
| `backend-api` | named volume `omniflow_importdata` | Staged CSV upload chunks (temporary) |
| `backend-worker` | named volume `omniflow_importdata` | Reads staged chunks, assembles CSV, streams rows |
| `frontend` | stateless | none |
| `mailpit` | in-memory (dev only) | captured dev email |

The volume name is stable because `docker-compose.yml` sets `name: omniflow` and declares
`pgdata:`. Compose therefore creates exactly `omniflow_pgdata`.

### What survives what

| Operation | Business data |
|---|---|
| `docker compose restart` | **kept** |
| `docker compose stop` / `start` | **kept** |
| `docker compose down` (no `-v`) | **kept** |
| `docker compose up -d --force-recreate` | **kept** |
| `docker compose up -d --build` (new images) | **kept** |
| Rolling a new application version on the same host | **kept** |
| Host reboot / Docker Desktop restart | **kept** |
| `docker compose down -v` | **DELETED** |
| `docker volume rm omniflow_pgdata` | **DELETED** |
| `docker system prune -a --volumes` | **DELETED** |
| `scripts/db-reset.ps1` | **DELETED** (intentional reset script) |
| Docker Desktop "Reset to factory defaults" | **DELETED** |

> Rule of thumb: **`down` keeps data, `down -v` destroys it.**

### "New deployment" scenarios

1. **New application version on the same host** — safe. Rebuild images and
   `docker compose up -d`; the named volume is reused.
2. **New host / new environment** — the volume does not travel automatically. Either:
   - point the app at a managed PostgreSQL instance (`DATABASE_URL`), or
   - restore a backup created with `scripts/backup-db.ps1`.
3. **Production recommendation** — use a managed PostgreSQL service with automated
   backups and PITR. The application only needs `DATABASE_URL`,
   `DATABASE_USERNAME`, `DATABASE_PASSWORD`; no code change is required.

### Migration safety

- Flyway runs the versioned SQL in `database/migrations` on startup.
- Flyway **never drops data**; it only applies missing versions.
- Applied migration files must never be edited (`V1`, `V2`, … are immutable).
- Before deploying a release that contains a migration, take a backup. Restoring an
  **older** dump is fine (Flyway moves it forward); restoring a dump **newer** than the
  deployed code will fail validation and must be paired with the matching release.

---

## 2. Backup and restore runbook

Scripts write and read the dump **inside** the postgres container, so no host
`pg_dump`/`psql` is required and PowerShell binary redirection cannot corrupt the file.

```powershell
# Backup (default folder .\backups, keeps the last 14 files)
.\scripts\backup-db.ps1

# Backup to another drive, keep 30
.\scripts\backup-db.ps1 -OutputDir D:\backups\omniflow -Keep 30

# Restore (stops API/worker/frontend, restores, restarts them)
.\scripts\restore-db.ps1 -BackupFile .\backups\omniflow-20261108-120000.dump
```

Recommended production policy:

- Nightly full backup + retained daily/weekly/monthly copies.
- Store backups **outside** the Docker host (object storage).
- Test a restore at least quarterly.
- Backup immediately before every deployment that includes a migration.
- Keep `backups/` out of Git (already ignored).

---

## 3. Table catalog (41 tables)

Conventions: UUID primary keys, `timestamptz` UTC, text enums with `CHECK`, JSONB for
flexible payloads, integer minor units for money, soft delete via `deleted_at`.

### Identity and organizations

| Table | What it stores |
|---|---|
| `users` | Accounts: email, BCrypt password hash, status, last login, soft delete |
| `refresh_tokens` | SHA-256 hashes of refresh tokens, expiry and revocation |
| `organizations` | Tenant root: name, slug, type, status, parent (agency), plan, timezone, settings |
| `roles` | Role codes (`OWNER`, `ADMIN`, `AGENT`, …) and permission JSON |
| `memberships` | User ↔ organization membership, role, invite/accept timestamps |

### CRM

| Table | What it stores |
|---|---|
| `contacts` | People: email, phone, names, status, source, JSONB attributes, last engagement |
| `contact_attributes` | Per-organization attribute definitions (key, label, data type) |
| `tags` | Colored labels |
| `contact_tags` | Contact ↔ tag join (composite primary key) |
| `contact_activities` | Append-only activity feed with JSONB payload |
| `contact_imports` | Durable bulk-import job: status, file metadata, chunk progress, mapping, counters, resume offset, worker lock |
| `contact_import_errors` | Sampled row-level import errors (capped at 500 per job), row number and message |

### Segmentation

| Table | What it stores |
|---|---|
| `segments` | Dynamic or static audience: match type, rules JSONB, status |
| `segment_rules` | Normalized rules (field, operator, value, logic group, order) |
| `segment_members` | Materialized static membership |

### Consent and suppression

| Table | What it stores |
|---|---|
| `consent_records` | Append-only permission ledger per channel/purpose with evidence, IP, source |
| `suppression_records` | Hard-stop list (email/phone per channel) with reason and optional expiry |

### Templates

| Table | What it stores |
|---|---|
| `templates` | Current content, channel, variables, status, current version |
| `template_versions` | Immutable snapshot per published version |

### Providers

| Table | What it stores |
|---|---|
| `provider_accounts` | Channel/provider accounts, AES-GCM encrypted credentials, JSON config, default flag |

### Campaigns

| Table | What it stores |
|---|---|
| `campaigns` | Name, channel, type, segment, status, content JSONB, sender, schedule timestamps |
| `campaign_audiences` | Campaign ↔ segment join |
| `campaign_recipients` | One row per contact: status, skip reason, linked message |

### Messaging

| Table | What it stores |
|---|---|
| `messages` | Every inbound/outbound message: addresses, content, provider ids, status, lifecycle timestamps, unique idempotency key |
| `message_attempts` | One row per send attempt: request/response payload, error, attempt number |
| `message_events` | Provider status events, deduplicated per provider event id |
| `webhook_events` | Raw inbound webhook payloads, signature validity, processing status |

### Automation

| Table | What it stores |
|---|---|
| `workflows` | Journey definition header: status, trigger type/config, current version |
| `workflow_versions` | Published graph JSON (nodes + edges) |
| `workflow_nodes` | Node rows with canvas positions and config |
| `workflow_executions` | One run per contact: status, current node, next run time, context |
| `workflow_execution_steps` | Per-node input/output/status (execution audit trail) |

### Shared inbox

| Table | What it stores |
|---|---|
| `conversations` | One thread per org + contact + channel: status, assignee, unread count |
| `conversation_messages` | Thread entries: direction, sender, body, attachments JSONB, provider id |
| `conversation_assignments` | Assignment history (assigned/unassigned timestamps) |

### Billing

| Table | What it stores |
|---|---|
| `plans` | Plan catalogue: included allowances, overage micros, features JSONB |
| `subscriptions` | One subscription per organization: plan, status, billing period, trial |
| `usage_records` | Metered usage per metric/period, linked message and campaign |
| `invoices` | Invoice totals in cents, line items JSONB, status, due/paid dates |

### Cross-cutting

| Table | What it stores |
|---|---|
| `audit_logs` | Who changed what: actor, action, entity, before/after JSONB, IP, user agent |
| `outbox_events` | Transactional event queue: type, aggregate, JSON payload, status, retry schedule |

### Growth and retention notes

- Append-heavy tables: `messages`, `message_attempts`, `message_events`,
  `usage_records`, `audit_logs`, `outbox_events`, `contact_activities`.
- Current build retains rows indefinitely. For production, add scheduled archival/
  retention jobs per policy (e.g. keep published outbox rows 30 days, raw webhook
  payloads 90 days).
- Consider monthly partitioning for `messages`, `message_events` and `usage_records`
  at high volume. No partitioning exists today.

### Bulk contact import flow (very large CSV files)

The synchronous `POST /contacts/import` endpoint is capped at small files. Files that may
contain millions or billions of rows use the chunked, resumable path:

1. **Open a session** — `POST /api/v1/contacts/imports` creates a `contact_imports` row in
   `UPLOADING` with the filename, size and deterministic chunk count.
2. **Upload 8 MB chunks** — `POST /contacts/imports/{id}/chunks/{index}` stages each part
   under the shared `omniflow_importdata` volume. Re-uploading an index is idempotent,
   and the UI can resume from `uploaded_chunks`.
3. **Map columns and enqueue** — `POST /contacts/imports/{id}/complete` stores the header
   mapping, attribute mapping, tags and options, then writes an outbox event. A worker
   claims the job with a pessimistic lock.
4. **Stream and upsert** — the worker assembles the parts, streams the CSV with a bounded
   buffer, validates each row, and writes contacts in set-based batches. Contacts, tags,
   errors and the resume offset commit in the same transaction.
5. **Progress and errors** — processed/created/updated/skipped/failed counters and a
   sampled error list (up to 500 rows) are available through the API and UI. The receipt
   can be downloaded as `errors.csv`.
6. **Recovery** — a crashed or restarted worker releases its lock; the maintenance
   scheduler re-queues stalled jobs and resumes from the last committed offset. Cancelled
   jobs never resurrect. Staged files are removed when the record is deleted.

No per-contact outbox or activity event is emitted by default, so a billion-row import does
not create a billion side effects. Both behaviour switches (`triggerAutomations`,
`recordActivities`) are opt-in.

---

## 4. Multi-tenancy and security in storage

- Every tenant-owned table has `organization_id` with a foreign key and indexed
  `(organization_id, …)` access paths.
- Queries are always scoped by the organization validated from the
  `X-Organization-Id` header (`TenantContextFilter` + `TenantGuard`).
- Uniqueness is tenant-scoped (email/phone unique per organization, not globally).
- Passwords are BCrypt hashes; refresh tokens are SHA-256 hashes.
- Provider credentials are AES-GCM ciphertext (`encrypted_credentials`); plaintext is
  never returned by the API.
- Agency/client workspaces are separate organization rows; access always requires an
  explicit membership row in the child organization.

---

## 5. End-to-end flow — customer explanation

Use this narrative with non-technical stakeholders.

### The journey of a message

1. **A contact joins.** They are imported, added manually, captured by a form, or they
   send the first inbound message. comGpt stores the profile, tags and attributes
   inside the customer's workspace only.
2. **Permission is recorded.** For each channel (email, WhatsApp, SMS) and purpose
   (marketing or transactional) comGpt stores the consent state, the source and the
   evidence. Opt-outs create a suppression that is checked before every send.
3. **An audience is built.** A dynamic segment evaluates rules live (for example
   "status is active and lifetime value ≥ 250"), or a static list is curated. The
   platform can preview the audience before anything is sent.
4. **A campaign is prepared.** The team chooses a channel, a template with variables,
   a sender and an audience, then launches or schedules it.
5. **Compliance gate.** Before any message is created, comGpt checks: is the contact
   active, do we have an address for this channel, is the contact suppressed, and is
   there marketing consent? If not, the recipient is stored as **skipped with a reason**
   — nothing is sent silently.
6. **Personalisation.** The template is rendered per contact (`firstName`, custom
   attributes). Every recipient becomes a queued message with a stable idempotency key,
   so retries can never duplicate a send.
7. **Delivery.** The worker picks the message, applies per-organization rate limits,
   selects the configured provider, sends it, and records the attempt and the resulting
   status. `SENT` is not treated as `DELIVERED`.
8. **Feedback loop.** Provider webhooks update the message to delivered, opened, read,
   bounced, rejected or failed. Duplicate webhooks are ignored, and every event is kept
   for audit.
9. **Conversations.** Replies and inbound messages appear in the shared inbox as a single
   thread per contact and channel, where agents can read history, assign an owner and
   reply through the same send pipeline.
10. **Automation.** Visual journeys react to events such as a new contact, apply waits and
    conditions, send messages, add tags or call webhooks. Every step is recorded, and
    waiting journeys resume automatically.
11. **Analytics and billing.** Sends, deliveries, opens, failures and campaign performance
    are computed from the same records. Usage is metered per channel for plan allowances
    and overages.
12. **Audit and control.** Administrative and business-critical actions are written to an
    immutable audit trail with before/after state, actor and IP.

### The promise to the customer

- **Your data is durable.** It lives in PostgreSQL on a persistent volume, survives
  restarts and redeploys, and can be backed up and restored.
- **Your data is isolated.** Every row is scoped to your workspace; no query crosses
  tenants.
- **Your data is auditable.** Consent decisions, message events and admin actions are
  recorded, not overwritten.
- **Your sends are safe.** Consent and suppression are enforced before every message;
  idempotency prevents duplicates even after failures or retries.

---

## 6. End-to-end flow — technical sequence

```
Import / form / API / inbound webhook
        │
        ▼
PostgreSQL: contacts + consent_records (+ suppression_records)
        │
        ▼
Segment (dynamic SQL or static members)  ── preview ──► UI
        │
        ▼
Campaign launch (API transaction)
        │  status → QUEUED
        │ outbox_events('campaign.launch')
        ▼
OutboxPublisher (worker, ~2s poll)
        │
        ▼
RabbitMQ omniflow.events ──► q.campaign.launch
        │
        ▼
CampaignLaunchProcessor
        │ status → RUNNING
        │ per contact: active? address? suppressed? consent? template?
        │ enqueue message (idempotency_key = campaign:{id}:contact:{id})
        │ outbox_events('message.send')  [same transaction]
        │ status → COMPLETED + campaign.dispatched
        ▼
RabbitMQ ──► q.message.send ──► MessageSendService
        │ rate limit (Redis)
        │ status → SENDING, message_attempts row
        │ resolve provider account (decrypted credentials)
        │ provider API call (outside DB transaction)
        │ success → SENT ; failure → FAILED
        │ usage_records increment
        ▼
Provider webhooks
        │ webhook_events (unique provider + event id)
        │ MessageStatusMachine validates transition
        │ DELIVERED / READ / BOUNCED / FAILED / UNDELIVERABLE
        │ message_events append-only
        ▼
Analytics · Billing · Inbox · Audit · UI (React Query)
```

### Why it is reliable

| Risk | Control |
|---|---|
| Lost event after commit | Transactional outbox; worker republishes `PENDING` rows |
| Duplicate send after retry | Unique `messages.idempotency_key` |
| Duplicate webhook | Unique `(provider, provider_event_id)` |
| Illegal status jump | `MessageStatusMachine` rejects invalid transitions |
| Provider outage | Attempts recorded; message can be retried; broker retries/DLX |
| Tenant data leak | `organization_id` scoping + membership validation |
| Losing data on redeploy | Named volume + backup/restore scripts |
| Slow provider holding locks | Provider call executed outside the database transaction |

---

## 7. Operational checklist

Before going live:

- [ ] Use a managed PostgreSQL instance or a pinned, backed-up volume.
- [ ] Set `OMNIFLOW_JWT_SECRET` and `OMNIFLOW_ENCRYPTION_KEY` to strong, unique values.
- [ ] Never run `docker compose down -v` against production.
- [ ] Schedule `scripts/backup-db.ps1` (or `pg_dump`) nightly and ship backups off-host.
- [ ] Rehearse `scripts/restore-db.ps1` in staging.
- [ ] Keep `OMNIFLOW_DEMO_DATA=false` in production.
- [ ] Monitor `/actuator/health`, queue depth, failed messages and outbox backlog.
- [ ] Define retention for `webhook_events`, `message_events`, `audit_logs`,
      `outbox_events` and `contact_activities`.
- [ ] Review the audit log after administrative changes.
