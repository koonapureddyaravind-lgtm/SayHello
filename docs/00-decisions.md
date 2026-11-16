# comGpt - Engineering Contracts (source of truth)

This document is binding for all code in this repository. If code and this document disagree, fix the code or update this document in the same change.

## 1. Repository layout

```
backend/                 Maven multi-module Spring Boot (Java 21, Boot 3.5.16)
frontend/                Next.js App Router + TypeScript + Tailwind
database/migrations/     Canonical Flyway SQL (V1__, V2__, ... only; never edit applied files)
database/seeds/          Optional demo/seed scripts
docs/                    Architecture, contracts, ADRs
infrastructure/          Docker, monitoring, nginx
scripts/                 Dev + build helpers
```

## 2. Build & run

Java toolchain is **not installed on the host**. All Java builds run in Docker:

```powershell
docker run --rm -v "${PWD}/backend:/workspace" -v "${HOME}/.m2:/root/.m2" -w /workspace `
  maven:3.9-eclipse-temurin-21 mvn -B -ntp -DskipTests package
```

Frontend uses `npm.cmd` on the host (PowerShell script execution is disabled) or the Docker image.

Full stack: `docker compose up --build`.

## 3. Backend module ownership

Each database table has exactly **one owning module** with its JPA entity/repository. Other modules access it only through a port (interface) declared in `omniflow-common`.

| Module | Owns tables | Notes |
|---|---|---|
| common | outbox_events | Shared API/error/security/outbox/ports. Never depends on a domain module. |
| identity | users, refresh_tokens | Auth, JWT. Implements `UserDirectory`. |
| organization | organizations, roles, memberships | Implements `OrganizationProvisioner`. |
| crm | contacts, contact_attributes, tags, contact_tags, contact_activities | Implements `ContactDirectory`. Emits `contact.created`. |
| segmentation | segments, segment_rules, segment_members | Implements `AudienceResolver`. |
| consent | consent_records, suppression_records | Implements `ConsentChecker`, `SuppressionChecker`. |
| template | templates, template_versions | Implements `TemplatePort`. |
| campaign | campaigns, campaign_audiences, campaign_recipients | Launch processor + scheduler. |
| messaging | messages, message_attempts, message_events, webhook_events | Implements `MessageIntakePort`; provider registry; status state machine. |
| integration | provider_accounts | Implements `ProviderAccountResolver`; AES-GCM credential storage. |
| email | — | `MessageProvider` for SMTP/SES. |
| whatsapp | — | `MessageProvider` for Meta Cloud API + webhook controller. |
| sms | — | `MessageProvider` for Twilio + generic DLT HTTP + webhook controller. |
| automation | workflows, workflow_versions, workflow_nodes, workflow_executions, workflow_execution_steps | Visual workflow engine. |
| inbox | conversations, conversation_messages, conversation_assignments | Implements `InboxPort`. |
| analytics | — (read-only native SQL) | Overview, timeseries, campaign/channel breakdowns. |
| billing | plans, subscriptions, usage_records, invoices | Implements `BillingPort`. |
| audit | audit_logs | Implements `AuditPort`. |
| app | — | Single `@SpringBootApplication`. REST API. Depends on all modules. |
| worker | — | Single `@SpringBootApplication`. RabbitMQ listeners, schedulers. |

Rules:
- **Only** `omniflow-app` and `omniflow-worker` contain `@SpringBootApplication`.
- Modules are component-scanned from `com.omniflow`; do not add component scans elsewhere.
- No module may depend on `omniflow-app` or `omniflow-worker`.
- No cyclic Maven dependencies. Cross-module reads go through `com.omniflow.common.port`.
- Constructor injection only. No field `@Autowired`.
- DTOs are Java records; entities are classes with Lombok `@Getter/@Setter` (no `@Data`).
- Every org-owned query filters by `organization_id` and the caller must pass `TenantGuard`.

## 4. Tenant & security model

- JWT bearer token (HS256). Claims: `sub` (user UUID), `email`, `name`, `typ` (`access`|`refresh`).
- Every non-public request must send `X-Organization-Id` (active workspace). `TenantContextFilter` (identity module) validates the user is a member, then sets `TenantContext`.
- `TenantGuard.currentOrganizationId()` returns the validated org id; controllers/services must use it.
- Public routes: `/api/v1/auth/**`, `/api/v1/webhooks/**`, `/actuator/health`, `/actuator/info`, Swagger.
- Roles are stored in `roles.code`. Role codes: `OWNER`, `ADMIN`, `MARKETING_MANAGER`, `CAMPAIGN_MANAGER`, `AGENT`, `VIEWER`, `AGENCY_OWNER`, `PLATFORM_ADMIN`.
- Agency access is never implicit: client workspaces are separate `organizations` rows with `parent_organization_id`; access requires a `memberships` row in the child org.

## 5. Shared common API (do not redefine)

Package `com.omniflow.common`:

- `api.ApiResponse<T>` — `{ success, data, error, timestamp }`.
- `api.PageResponse<T>` — `{ items, page, size, totalItems, totalPages }`.
- `api.ApiError` — `{ code, message, details }`.
- `exception.ApiException` + `NotFound`, `BadRequest`, `Conflict`, `Forbidden`, `Unauthorized` subclasses.
- `web.GlobalExceptionHandler` — the only `@RestControllerAdvice`.
- `domain.BaseEntity` — UUID id, createdAt, updatedAt.
- `domain.enums.*` — `Channel`, `Direction`, `MessageStatus`, `CampaignStatus`, `CampaignType`, `RecipientStatus`, `ConsentStatus`, `ConsentPurpose`, `TemplateStatus`, `WorkflowStatus`, `ExecutionStatus`, `ConversationStatus`, `UserStatus`, `OrganizationStatus`, `OrganizationType`, `ProviderType`, `UsageMetric`.
- `security.SecurityUtils.currentUserId()`, `currentUserIdOrNull()`.
- `tenant.TenantContext`, `tenant.TenantGuard`.
- `outbox.OutboxEvent`, `OutboxEventRepository`, `OutboxWriter`.
- `crypto.CredentialCipher`.
- `port.*` — the cross-module interfaces listed above.
- `util.PageMapper` — converts Spring `Page<T>` + mapper to `PageResponse<T>`.

## 6. HTTP conventions

- Base path: `/api/v1`.
- All responses: `ApiResponse` envelope (HTTP status still meaningful).
- List endpoints: `page` (0-based), `size` (default 20, max 100), `q`, plus module filters. Return `PageResponse`.
- Errors: `{ success:false, error:{code,message,details}, timestamp }`.
- Dates: ISO-8601 UTC strings.
- IDs: UUID strings.
- Money: integer minor units + ISO currency.
- Validation: Jakarta Bean Validation on request records; violations map to `VALIDATION_ERROR`.

### Endpoint map

**Auth** (`/auth`)
- `POST /register` `{email,password,fullName,organizationName,organizationType?}` → `{accessToken,refreshToken,user,organizations[]}`
- `POST /login` `{email,password}` → same
- `POST /refresh` `{refreshToken}` → `{accessToken,refreshToken}`
- `POST /logout` `{refreshToken}` → `204`
- `GET /me` → `{user, organizations:[{id,name,slug,role,type}]}`

**Organizations** (`/organizations`)
- `GET /` → list memberships of current user
- `POST /` `{name,slug?,type?}` → org
- `GET /{id}`, `PATCH /{id}`
- `GET /{id}/members` → `[{membershipId,userId,email,fullName,role,status,joinedAt}]`
- `POST /{id}/members` `{email,role}` → invite/add
- `PATCH /{id}/members/{membershipId}` `{role?,status?}`
- `DELETE /{id}/members/{membershipId}`
- `GET /{id}/workspaces`, `POST /{id}/workspaces` `{name,slug?,type?}`

**Contacts** (`/contacts`)
- `GET /?page&size&q&tagId&status`
- `POST /` `{email,phone,firstName,lastName,attributes,status?,source?}`
- `GET /{id}`, `PATCH /{id}`, `DELETE /{id}` (soft delete)
- `POST /import` — multipart `file` (CSV: email,phone,first_name,last_name,tags) or JSON `{contacts:[...]}`
- `GET /export` — CSV download
- `POST /{id}/tags/{tagId}`, `DELETE /{id}/tags/{tagId}`
- `GET /{id}/activities`
- `GET /tags`, `POST /tags` `{name,color?}`, `PATCH /tags/{id}`, `DELETE /tags/{id}`

**Segments** (`/segments`)
- CRUD `/`
- `POST /preview` `{rules:[{field,operator,value,logicGroup?}]}` → `{count,sample:[contact]}`
- `GET /{id}/members?page&size`

**Consent** (`/consent`)
- `GET /?contactId&channel`
- `POST /` `{contactId,channel,purpose,status,source,evidence?}`
- `GET /suppressions`, `POST /suppressions` `{email?,phone?,channel?,reason}`, `DELETE /suppressions/{id}`

**Templates** (`/templates`)
- CRUD `/`; `POST /{id}/publish`; `GET /{id}/versions`; `POST /{id}/preview` `{variables}` → `{subject,body,htmlBody}`

**Campaigns** (`/campaigns`)
- `GET /?page&size&status&channel&q`, `POST /`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}`
- `POST /{id}/launch`, `POST /{id}/schedule` `{scheduledAt}`, `POST /{id}/pause`, `POST /{id}/cancel`
- `GET /{id}/stats`, `GET /{id}/recipients?page&size&status`

**Messages** (`/messages`)
- `GET /?page&size&channel&status&campaignId&contactId`
- `GET /{id}`, `GET /{id}/events`, `POST /{id}/retry`

**Webhooks** (public)
- `GET|POST /webhooks/whatsapp` (GET = Meta verification)
- `POST /webhooks/email/ses`, `POST /webhooks/sms/{provider}`

**Automation** (`/workflows`)
- CRUD `/`; `POST /{id}/publish` `{graph}`; `POST /{id}/activate`; `POST /{id}/pause`
- `GET /{id}/executions?page&size`, `POST /{id}/test` `{contactId}`

**Inbox** (`/conversations`)
- `GET /?page&size&status&channel&assignee`
- `GET /{id}`, `GET /{id}/messages?page&size`
- `POST /{id}/messages` `{body}`
- `POST /{id}/assign` `{userId}`, `POST /{id}/status` `{status}`

**Analytics** (`/analytics`)
- `GET /overview?from&to` → totals + deltas
- `GET /timeseries?metric=sent|delivered|opened&from&to`
- `GET /campaigns?from&to`, `GET /channels?from&to`

**Billing** (`/billing`)
- `GET /plans`, `GET /subscription`, `POST /subscription` `{planCode}`
- `GET /usage?period=YYYY-MM`, `GET /invoices`

**Integrations** (`/integrations`)
- `GET /`, `POST /` `{channel,provider,name,credentials,config,fromAddress,isDefault}`
- `PATCH /{id}`, `DELETE /{id}`, `POST /{id}/test`

**Audit** (`/audit-logs?page&size&action&entityType`)

## 7. RabbitMQ topology

Exchange: `omniflow.events` (topic, durable). Dead-letter exchange: `omniflow.dlx`.

| Queue | Routing key | Consumer |
|---|---|---|
| `q.campaign.launch` | `campaign.launch` | worker `CampaignLaunchListener` |
| `q.message.send` | `message.send` | worker `MessageSendListener` |
| `q.automation.trigger` | `automation.trigger` | worker `AutomationTriggerListener` |
| `q.webhook.process` | `webhook.process` | worker `WebhookProcessListener` (async enrichment, optional) |

All queues bind to `omniflow.dlx` via `x-dead-letter-exchange` and retry with `x-message-ttl`. Producers never publish directly from request threads for business events; they write `outbox_events` in the same transaction. `OutboxWriter` is the only sanctioned way to emit events.

Event envelope:
```json
{ "eventId": "uuid", "eventType": "campaign.launch", "occurredAt": "...", "organizationId": "...", "payload": { ... } }
```

## 8. Message lifecycle

```
QUEUED -> SENDING -> SENT -> DELIVERED -> READ
   |         |          |          |
   +---------+----------+----------+--> FAILED / BOUNCED / REJECTED / UNDELIVERABLE
QUEUED/SENDING -> CANCELLED
```

- `SENT` is not `DELIVERED`. Only provider webhooks may set `DELIVERED`/`READ`.
- Transitions are validated in `MessageStatusMachine`; illegal transitions are ignored and logged.
- `message.idempotency_key` is unique. Webhook events are unique on `(provider, provider_event_id)`.
- Every outbound message gets a stable idempotency key: `campaign:{campaignId}:contact:{contactId}` or `automation:{executionId}:{nodeKey}`.

## 9. Frontend conventions

- Next.js App Router, TypeScript strict, client components under `components/`.
- All backend calls go through same-origin `/api/backend/[...path]` proxy, which injects the bearer token and `X-Organization-Id` from httpOnly cookies.
- Auth routes: `/api/auth/login`, `/register`, `/logout`, `/api/org/switch` set cookies.
- Active workspace is stored in the `of_org` cookie and mirrored in a client `WorkspaceProvider`.
- Server state: `@tanstack/react-query`. Toasts: `sonner`. Icons: `lucide-react`. Charts: `recharts`. Workflow canvas: `@xyflow/react`.
- UI primitives live in `components/ui` (shadcn-style, hand-rolled; do not add the shadcn CLI).
- Every page must handle loading, empty and error states. No placeholder "Lorem ipsum" text.
- Money formatting and dates use `Intl` via `lib/format.ts`.

## 10. Definition of done for a module

1. Compiles in the Docker Maven build.
2. Repository methods are org-scoped.
3. Request validation + envelope responses.
4. Unit tests for non-trivial logic (state machine, segment compiler, workflow engine).
5. Flyway schema matches the JPA mapping (column names explicit).
6. No secrets in code; configurable via env.
