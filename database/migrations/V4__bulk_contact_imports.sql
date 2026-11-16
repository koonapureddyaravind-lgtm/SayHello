-- ============================================================================
-- comGpt bulk contact import
--
-- Large CSV files are uploaded in chunks, then processed asynchronously by the
-- worker. The job row is the durable source of truth for progress and resume
-- state, so a worker restart never loses already committed work.
-- ============================================================================

create table contact_imports (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  created_by             uuid references users(id) on delete set null,
  original_filename      text not null,
  status                 text not null default 'UPLOADING'
                           check (status in ('UPLOADING','QUEUED','RUNNING',
                                             'COMPLETED','PARTIAL','FAILED','CANCELLED')),
  file_size_bytes        bigint not null default 0 check (file_size_bytes >= 0),
  uploaded_bytes         bigint not null default 0 check (uploaded_bytes >= 0),
  uploaded_chunks        integer not null default 0 check (uploaded_chunks >= 0),
  total_chunks           integer not null default 0 check (total_chunks >= 0),
  delimiter              text not null default ',',
  header_columns         jsonb not null default '[]'::jsonb,
  column_mapping         jsonb not null default '{}'::jsonb,
  attribute_mapping      jsonb not null default '{}'::jsonb,
  tag_names              jsonb not null default '[]'::jsonb,
  source_label           text,
  trigger_automations    boolean not null default false,
  record_activities      boolean not null default false,
  estimated_total_rows   bigint not null default 0,
  total_rows             bigint not null default 0,
  processed_rows         bigint not null default 0,
  created_count          bigint not null default 0,
  updated_count          bigint not null default 0,
  skipped_count          bigint not null default 0,
  failed_count           bigint not null default 0,
  error_count            bigint not null default 0,
  resume_char_offset     bigint not null default 0,
  batch_size             integer not null default 5000,
  attempts               integer not null default 0,
  last_error             text,
  lock_token             uuid,
  locked_until           timestamptz,
  started_at             timestamptz,
  completed_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_contact_imports_org_created
  on contact_imports(organization_id, created_at desc);
create index idx_contact_imports_active
  on contact_imports(status, locked_until)
  where status in ('QUEUED','RUNNING');
create index idx_contact_imports_cleanup
  on contact_imports(completed_at)
  where status in ('COMPLETED','PARTIAL','FAILED','CANCELLED');

create table contact_import_errors (
  id              bigserial primary key,
  import_id       uuid not null references contact_imports(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  row_number      bigint,
  message         text not null,
  created_at      timestamptz not null default now()
);

create index idx_contact_import_errors_import
  on contact_import_errors(import_id, id);

create trigger trg_contact_imports_updated
  before update on contact_imports
  for each row execute function set_updated_at();
