-- ============================================================================
-- OmniFlow baseline schema
-- PostgreSQL 15+ (Supabase compatible)
-- Conventions: UUID PKs, organization_id on every tenant-owned row,
-- timestamptz, text enum columns with CHECK constraints, JSONB for flexible data.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- Plans / billing reference
-- ---------------------------------------------------------------------------
create table plans (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null unique,
  name                     text not null,
  description              text,
  price_monthly_cents      integer not null default 0 check (price_monthly_cents >= 0),
  currency                 char(3) not null default 'USD',
  included_emails          integer not null default 0,
  included_whatsapp        integer not null default 0,
  included_sms             integer not null default 0,
  overage_email_micros     bigint  not null default 0,
  overage_whatsapp_micros  bigint  not null default 0,
  overage_sms_micros       bigint  not null default 0,
  features                 jsonb   not null default '{}'::jsonb,
  is_public                boolean not null default true,
  sort_order               integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Organizations (hierarchical: agency -> client workspaces)
-- ---------------------------------------------------------------------------
create table organizations (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  slug                     text not null unique,
  type                     text not null default 'BUSINESS'
                             check (type in ('BUSINESS','AGENCY','ENTERPRISE')),
  status                   text not null default 'ACTIVE'
                             check (status in ('ACTIVE','SUSPENDED','TRIAL','CLOSED')),
  parent_organization_id   uuid references organizations(id) on delete set null,
  plan_id                  uuid references plans(id) on delete set null,
  timezone                 text not null default 'UTC',
  settings                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz
);
create index idx_organizations_parent on organizations(parent_organization_id);

-- ---------------------------------------------------------------------------
-- Users & identity
-- ---------------------------------------------------------------------------
create table users (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  password_hash     text not null,
  full_name         text,
  status            text not null default 'ACTIVE'
                      check (status in ('ACTIVE','INVITED','SUSPENDED','DELETED')),
  email_verified_at timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create unique index uq_users_email on users (lower(email)) where deleted_at is null;

create table roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  is_system   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  role_id         uuid not null references roles(id),
  status          text not null default 'ACTIVE'
                    check (status in ('ACTIVE','INVITED','SUSPENDED')),
  invited_by      uuid references users(id) on delete set null,
  invited_at      timestamptz,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index idx_memberships_user on memberships(user_id);
create index idx_memberships_org on memberships(organization_id);

create table refresh_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_refresh_tokens_user on refresh_tokens(user_id);

-- ---------------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------------
create table contact_attributes (
  id         uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  key        text not null,
  label      text,
  data_type  text not null default 'STRING'
               check (data_type in ('STRING','NUMBER','BOOLEAN','DATE','URL')),
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  color           text not null default '#64748b',
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create table contacts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  external_id       text,
  email             text,
  phone             text,
  first_name        text,
  last_name         text,
  status            text not null default 'ACTIVE'
                      check (status in ('ACTIVE','UNSUBSCRIBED','BOUNCED','DELETED')),
  source            text not null default 'MANUAL',
  attributes        jsonb not null default '{}'::jsonb,
  last_engagement_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint contacts_have_identity check (email is not null or phone is not null)
);
create index idx_contacts_org_created on contacts(organization_id, created_at desc);
create index idx_contacts_org_status on contacts(organization_id, status) where deleted_at is null;
create unique index uq_contacts_org_email on contacts(organization_id, lower(email))
  where email is not null and deleted_at is null;
create unique index uq_contacts_org_phone on contacts(organization_id, phone)
  where phone is not null and deleted_at is null;
create index idx_contacts_attributes on contacts using gin (attributes);

create table contact_tags (
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id     uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);
create index idx_contact_tags_tag on contact_tags(tag_id);

create table contact_activities (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  type            text not null,
  channel         text check (channel in ('EMAIL','WHATSAPP','SMS')),
  payload         jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index idx_contact_activities_contact on contact_activities(contact_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Segmentation
-- ---------------------------------------------------------------------------
create table segments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  type            text not null default 'DYNAMIC' check (type in ('STATIC','DYNAMIC')),
  match_type      text not null default 'ALL' check (match_type in ('ALL','ANY')),
  rules           jsonb not null default '[]'::jsonb,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index idx_segments_org on segments(organization_id) where deleted_at is null;

create table segment_rules (
  id           uuid primary key default gen_random_uuid(),
  segment_id   uuid not null references segments(id) on delete cascade,
  field        text not null,
  operator     text not null,
  value        jsonb,
  logic_group  text not null default 'AND',
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create table segment_members (
  segment_id uuid not null references segments(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (segment_id, contact_id)
);

-- ---------------------------------------------------------------------------
-- Consent & suppression (channel-specific)
-- ---------------------------------------------------------------------------
create table consent_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  channel         text not null check (channel in ('EMAIL','WHATSAPP','SMS')),
  purpose         text not null default 'MARKETING'
                    check (purpose in ('MARKETING','TRANSACTIONAL')),
  status          text not null check (status in ('GRANTED','DENIED','WITHDRAWN')),
  source          text not null,
  ip_address      text,
  evidence        jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index idx_consent_lookup
  on consent_records(organization_id, contact_id, channel, purpose, occurred_at desc);

create table suppression_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel         text check (channel in ('EMAIL','WHATSAPP','SMS')),
  email           text,
  phone           text,
  reason          text not null
                    check (reason in ('UNSUBSCRIBE','HARD_BOUNCE','COMPLAINT','MANUAL','INVALID')),
  note            text,
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  constraint suppression_has_target check (email is not null or phone is not null)
);
create unique index uq_suppression_target
  on suppression_records(
    organization_id,
    coalesce(channel, 'ALL'),
    coalesce(lower(email), ''),
    coalesce(phone, '')
  );

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
create table templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  channel         text not null check (channel in ('EMAIL','WHATSAPP','SMS')),
  subject         text,
  body            text not null default '',
  html_body       text,
  variables       jsonb not null default '[]'::jsonb,
  status          text not null default 'DRAFT'
                    check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  current_version integer not null default 1,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index idx_templates_org_channel on templates(organization_id, channel) where deleted_at is null;

create table template_versions (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  version     integer not null,
  subject     text,
  body        text not null,
  html_body   text,
  variables   jsonb not null default '[]'::jsonb,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (template_id, version)
);

-- ---------------------------------------------------------------------------
-- Provider accounts
-- ---------------------------------------------------------------------------
create table provider_accounts (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  channel                text not null check (channel in ('EMAIL','WHATSAPP','SMS')),
  provider               text not null,
  name                   text not null,
  status                 text not null default 'ACTIVE'
                           check (status in ('ACTIVE','DISABLED','ERROR')),
  encrypted_credentials  text,
  config                 jsonb not null default '{}'::jsonb,
  from_address           text,
  from_name              text,
  webhook_secret         text,
  is_default             boolean not null default false,
  last_verified_at       timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (organization_id, channel, name)
);
create unique index uq_provider_default
  on provider_accounts(organization_id, channel) where is_default;

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
create table campaigns (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  channel         text not null check (channel in ('EMAIL','WHATSAPP','SMS')),
  type            text not null default 'BROADCAST' check (type in ('BROADCAST','AUTOMATION')),
  template_id     uuid references templates(id) on delete set null,
  segment_id      uuid references segments(id) on delete set null,
  status          text not null default 'DRAFT'
                    check (status in ('DRAFT','SCHEDULED','QUEUED','RUNNING','PAUSED',
                                      'COMPLETED','CANCELLED','FAILED')),
  subject         text,
  content         jsonb not null default '{}'::jsonb,
  sender_name     text,
  sender_address  text,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index idx_campaigns_org_status on campaigns(organization_id, status) where deleted_at is null;
create index idx_campaigns_scheduled on campaigns(scheduled_at) where status = 'SCHEDULED';
create index idx_campaigns_org_created on campaigns(organization_id, created_at desc);

create table campaign_audiences (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  segment_id  uuid not null references segments(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (campaign_id, segment_id)
);

create table campaign_recipients (
  id          uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  contact_id  uuid not null references contacts(id) on delete cascade,
  status      text not null default 'PENDING'
                check (status in ('PENDING','QUEUED','SENT','DELIVERED','FAILED','SKIPPED')),
  skip_reason text,
  message_id  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (campaign_id, contact_id)
);
create index idx_campaign_recipients_status on campaign_recipients(campaign_id, status);
create index idx_campaign_recipients_org on campaign_recipients(organization_id);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------
create table messages (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  campaign_id         uuid references campaigns(id) on delete set null,
  contact_id          uuid references contacts(id) on delete set null,
  channel             text not null check (channel in ('EMAIL','WHATSAPP','SMS')),
  provider_account_id uuid references provider_accounts(id) on delete set null,
  direction           text not null default 'OUTBOUND' check (direction in ('OUTBOUND','INBOUND')),
  provider            text,
  provider_message_id text,
  idempotency_key     text not null,
  status              text not null default 'QUEUED'
                        check (status in ('CREATED','QUEUED','SENDING','SENT','DELIVERED','READ',
                                          'FAILED','BOUNCED','REJECTED','UNDELIVERABLE','CANCELLED')),
  subject             text,
  body                text,
  html_body           text,
  to_address          text,
  from_address        text,
  error_code          text,
  error_message       text,
  scheduled_at        timestamptz,
  queued_at           timestamptz,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  read_at             timestamptz,
  failed_at           timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (idempotency_key)
);
create index idx_messages_org_created on messages(organization_id, created_at desc);
create index idx_messages_campaign on messages(campaign_id);
create index idx_messages_status on messages(status);
create index idx_messages_contact on messages(contact_id, created_at desc);
create index idx_messages_provider_id on messages(provider, provider_message_id)
  where provider_message_id is not null;

create table message_attempts (
  id               uuid primary key default gen_random_uuid(),
  message_id       uuid not null references messages(id) on delete cascade,
  organization_id  uuid not null references organizations(id) on delete cascade,
  attempt_no       integer not null default 1,
  provider         text,
  status           text not null,
  request_payload  jsonb,
  response_payload jsonb,
  error_code       text,
  error_message    text,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (message_id, attempt_no)
);

create table message_events (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  message_id        uuid references messages(id) on delete set null,
  provider          text not null,
  provider_event_id text,
  event_type        text not null,
  event_time        timestamptz not null default now(),
  payload           jsonb not null default '{}'::jsonb,
  processed_at      timestamptz,
  created_at        timestamptz not null default now()
);
create unique index uq_message_events_provider_event
  on message_events(provider, provider_event_id) where provider_event_id is not null;
create index idx_message_events_message on message_events(message_id, event_time desc);

create table webhook_events (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null,
  event_id        text not null,
  payload         jsonb not null default '{}'::jsonb,
  signature_valid boolean not null default false,
  status          text not null default 'RECEIVED'
                    check (status in ('RECEIVED','PROCESSED','IGNORED','FAILED')),
  error           text,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz,
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- Automation
-- ---------------------------------------------------------------------------
create table workflows (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  status          text not null default 'DRAFT'
                    check (status in ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
  trigger_type    text not null default 'CONTACT_CREATED'
                    check (trigger_type in ('CONTACT_CREATED','CONTACT_TAG_ADDED','SEGMENT_JOINED',
                                            'MESSAGE_OPENED','MESSAGE_CLICKED','WEBHOOK','MANUAL')),
  trigger_config  jsonb not null default '{}'::jsonb,
  current_version integer not null default 0,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index idx_workflows_org on workflows(organization_id) where deleted_at is null;

create table workflow_versions (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid not null references workflows(id) on delete cascade,
  version      integer not null,
  graph        jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  published_at timestamptz,
  unique (workflow_id, version)
);

create table workflow_nodes (
  id                  uuid primary key default gen_random_uuid(),
  workflow_version_id uuid not null references workflow_versions(id) on delete cascade,
  node_key            text not null,
  type                text not null,
  config              jsonb not null default '{}'::jsonb,
  position_x          numeric(10,2) not null default 0,
  position_y          numeric(10,2) not null default 0,
  created_at          timestamptz not null default now(),
  unique (workflow_version_id, node_key)
);

create table workflow_executions (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  workflow_id         uuid not null references workflows(id) on delete cascade,
  workflow_version_id uuid not null references workflow_versions(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete cascade,
  status              text not null default 'RUNNING'
                        check (status in ('RUNNING','WAITING','COMPLETED','FAILED','CANCELLED')),
  current_node_key    text,
  next_run_at         timestamptz,
  context             jsonb not null default '{}'::jsonb,
  error_message       text,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_workflow_executions_due on workflow_executions(status, next_run_at);
create index idx_workflow_executions_workflow on workflow_executions(workflow_id, created_at desc);

create table workflow_execution_steps (
  id           uuid primary key default gen_random_uuid(),
  execution_id uuid not null references workflow_executions(id) on delete cascade,
  node_key     text not null,
  node_type    text not null,
  status       text not null default 'RUNNING'
                 check (status in ('RUNNING','COMPLETED','FAILED','SKIPPED')),
  input        jsonb,
  output       jsonb,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index idx_workflow_steps_execution on workflow_execution_steps(execution_id);

-- ---------------------------------------------------------------------------
-- Inbox
-- ---------------------------------------------------------------------------
create table conversations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete cascade,
  channel             text not null check (channel in ('EMAIL','WHATSAPP','SMS')),
  provider_account_id uuid references provider_accounts(id) on delete set null,
  status              text not null default 'OPEN'
                        check (status in ('OPEN','PENDING','RESOLVED','SNOOZED')),
  subject             text,
  assignee_user_id    uuid references users(id) on delete set null,
  last_message_at     timestamptz not null default now(),
  unread_count        integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, contact_id, channel)
);
create index idx_conversations_org_status on conversations(organization_id, status, last_message_at desc);

create table conversation_messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references conversations(id) on delete cascade,
  organization_id     uuid not null references organizations(id) on delete cascade,
  direction           text not null check (direction in ('INBOUND','OUTBOUND')),
  sender_type         text not null default 'CONTACT'
                        check (sender_type in ('CONTACT','AGENT','SYSTEM','BOT')),
  sender_user_id      uuid references users(id) on delete set null,
  body                text not null,
  attachments         jsonb not null default '[]'::jsonb,
  provider_message_id text,
  status              text not null default 'SENT',
  created_at          timestamptz not null default now()
);
create index idx_conversation_messages_conversation
  on conversation_messages(conversation_id, created_at);

create table conversation_assignments (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  assigned_by     uuid references users(id) on delete set null,
  assigned_at     timestamptz not null default now(),
  unassigned_at   timestamptz
);

-- ---------------------------------------------------------------------------
-- Billing / usage
-- ---------------------------------------------------------------------------
create table subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null unique references organizations(id) on delete cascade,
  plan_id                  uuid not null references plans(id),
  status                   text not null default 'TRIALING'
                             check (status in ('TRIALING','ACTIVE','PAST_DUE','CANCELED','PAUSED')),
  current_period_start     timestamptz not null default now(),
  current_period_end       timestamptz not null default now() + interval '30 days',
  trial_ends_at            timestamptz,
  canceled_at              timestamptz,
  provider_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table usage_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  metric          text not null check (metric in ('EMAIL_SENT','WHATSAPP_SENT','SMS_SENT',
                                                  'CONTACT_STORED','API_CALL','AUTOMATION_RUN')),
  quantity        integer not null default 1 check (quantity > 0),
  unit_cost_micros bigint not null default 0,
  period_start    date not null,
  period_end      date not null,
  campaign_id     uuid references campaigns(id) on delete set null,
  message_id      uuid references messages(id) on delete set null,
  recorded_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index idx_usage_org_period on usage_records(organization_id, period_start);
create unique index uq_usage_message_metric on usage_records(message_id, metric)
  where message_id is not null;

create table invoices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  number          text not null unique,
  status          text not null default 'DRAFT'
                    check (status in ('DRAFT','OPEN','PAID','VOID','OVERDUE')),
  subtotal_cents  bigint not null default 0,
  tax_cents       bigint not null default 0,
  total_cents     bigint not null default 0,
  currency        char(3) not null default 'USD',
  period_start    date not null,
  period_end      date not null,
  due_at          timestamptz,
  paid_at         timestamptz,
  line_items      jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit & outbox
-- ---------------------------------------------------------------------------
create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  actor_user_id uuid references users(id) on delete set null,
  action        text not null,
  entity_type   text not null,
  entity_id     text,
  before_state  jsonb,
  after_state   jsonb,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index idx_audit_org_created on audit_logs(organization_id, created_at desc);
create index idx_audit_entity on audit_logs(entity_type, entity_id);

create table outbox_events (
  id              uuid primary key default gen_random_uuid(),
  aggregate_type  text not null,
  aggregate_id    uuid,
  event_type      text not null,
  organization_id uuid references organizations(id) on delete set null,
  payload         jsonb not null default '{}'::jsonb,
  status          text not null default 'PENDING'
                    check (status in ('PENDING','PUBLISHED','FAILED')),
  attempts        integer not null default 0,
  available_at    timestamptz not null default now(),
  published_at    timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);
create index idx_outbox_pending on outbox_events(status, available_at)
  where status = 'PENDING';

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'plans','organizations','users','memberships','contacts','segments','templates',
    'provider_accounts','campaigns','campaign_recipients','messages','workflows',
    'workflow_executions','conversations','subscriptions','invoices'
  ]
  loop
    execute format('create trigger trg_%s_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;
