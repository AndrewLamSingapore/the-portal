-- Living Engine v1: durable, leased, idempotent deterministic discovery cycle.
-- Tables are also created idempotently at runtime by lib/living-engine.js.

create table if not exists living_jobs (
  id text primary key,
  kind text not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','COMPLETED','FAILED','SKIPPED')),
  idempotency_key text not null unique,
  attempt integer not null default 0,
  lease_owner text,
  lease_expires_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  checkpoint jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists living_jobs_claim_idx on living_jobs(status, created_at);

create table if not exists living_audit (
  id bigserial primary key,
  event text not null,
  job_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists living_audit_created_idx on living_audit(created_at desc);

create table if not exists living_engine_state (
  id integer primary key default 1,
  killed boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into living_engine_state(id,killed) values (1,false) on conflict(id) do nothing;
