create table if not exists artifacts (
  id text primary key, schema_version integer not null default 6, year integer not null, era text not null, type text not null, title text not null, description text not null, provenance text not null, condition integer not null check (condition between 1 and 5), imagined_future text not null, problem text not null, status text not null, modern_descendant text not null, question text not null, mode text not null, concepts jsonb not null default '[]'::jsonb, evidence_level text not null default 'AI-CURATED', sources jsonb not null default '[]'::jsonb, relationships jsonb not null default '[]'::jsonb, experiment jsonb not null default '{}'::jsonb, connections jsonb not null default '[]'::jsonb, lifecycle jsonb not null default '[]'::jsonb, current_phase text not null default 'EMERGED', recurrence_conditions jsonb not null default '[]'::jsonb, realization_signal text not null default '', created_at timestamptz not null default now());
alter table artifacts add column if not exists evidence_level text not null default 'AI-CURATED';alter table artifacts add column if not exists sources jsonb not null default '[]'::jsonb;alter table artifacts add column if not exists relationships jsonb not null default '[]'::jsonb;alter table artifacts add column if not exists experiment jsonb not null default '{}'::jsonb;alter table artifacts add column if not exists connections jsonb not null default '[]'::jsonb;alter table artifacts add column if not exists lifecycle jsonb not null default '[]'::jsonb;alter table artifacts add column if not exists current_phase text not null default 'EMERGED';alter table artifacts add column if not exists recurrence_conditions jsonb not null default '[]'::jsonb;alter table artifacts add column if not exists realization_signal text not null default '';alter table artifacts alter column schema_version set default 6;create index if not exists artifacts_year_idx on artifacts(year);create index if not exists artifacts_status_idx on artifacts(status);create index if not exists artifacts_concepts_gin on artifacts using gin(concepts);create index if not exists artifacts_evidence_level_idx on artifacts(evidence_level);create index if not exists artifacts_current_phase_idx on artifacts(current_phase);
create table if not exists artifact_verdicts (
  artifact_id text not null references artifacts(id) on delete cascade,
  verdict text not null check (verdict in ('FAILED', 'TOO_EARLY', 'ARRIVED_QUIETLY')),
  vote_count bigint not null default 0 check (vote_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (artifact_id, verdict)
);
create index if not exists artifact_verdicts_updated_at_idx on artifact_verdicts(updated_at desc);

-- Authenticated, versioned PRIME evidence returned to the Portal graph.
create table if not exists experiment_results (
  experiment_id text primary key,
  result_id text not null unique,
  candidate_id text not null,
  result_version integer not null check (result_version > 0),
  status text not null,
  conclusion text not null,
  result_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists experiment_results_updated_at_idx on experiment_results(updated_at desc);

-- Portal 6.3 sandbox-only durable organism state. Additive and isolated from v6.2 artifacts.
create table if not exists living_runs (id text primary key, sandbox_key text not null, status text not null default 'ACTIVE', generation integer not null default 0, state jsonb not null default '{}'::jsonb, unfinished_questions jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists living_runs_sandbox_updated_idx on living_runs(sandbox_key,updated_at desc);
create table if not exists living_events (id bigserial primary key, run_id text not null references living_runs(id) on delete cascade, generation integer not null, event_type text not null, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create index if not exists living_events_run_generation_idx on living_events(run_id,generation,id);
create table if not exists living_fossils (id text primary key, run_id text not null references living_runs(id) on delete cascade, hypothesis_id text not null, generation integer not null, payload jsonb not null, created_at timestamptz not null default now());
create index if not exists living_fossils_run_idx on living_fossils(run_id,generation);

-- Stable Spine v1. Personal JARVIS is a single implicit tenant, but tenant_id remains explicit for SDL conformance.
create table if not exists spine_trust_registry (
  tenant_id text not null,
  action_type text not null,
  policy_state text not null check (policy_state in ('AUTO','BOUNDED_AUTO','GATED','PROHIBITED')),
  trust_score numeric not null default 0 check (trust_score between 0 and 1),
  clean_successes bigint not null default 0 check (clean_successes >= 0),
  failures bigint not null default 0 check (failures >= 0),
  platform_locked boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, action_type)
);
create table if not exists spine_events (
  id text primary key,
  tenant_id text not null,
  correlation_id text not null,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists spine_events_tenant_created_idx on spine_events(tenant_id,created_at desc);
create index if not exists spine_events_correlation_idx on spine_events(tenant_id,correlation_id);
create table if not exists spine_audit_log (
  id bigserial primary key,
  tenant_id text not null,
  correlation_id text not null,
  idempotency_key text not null,
  action_type text not null,
  actor_type text not null,
  actor_id text not null,
  policy_state text not null,
  policy_reason text not null,
  execution_status text not null default 'NOT_EXECUTED',
  verification_status text not null default 'PENDING',
  outcome_status text not null default 'PENDING',
  envelope jsonb not null,
  decision_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(tenant_id,idempotency_key)
);
create index if not exists spine_audit_tenant_created_idx on spine_audit_log(tenant_id,created_at desc);
create index if not exists spine_audit_correlation_idx on spine_audit_log(tenant_id,correlation_id);
create table if not exists ecosystem_events (
  id bigserial primary key,
  event_name text not null check(event_name in ('ecosystem_link_clicked','ecosystem_referral_received')),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ecosystem_events_name_created_idx on ecosystem_events(event_name,created_at desc);
create table if not exists portfolio_event_outbox (
  event_id text primary key,
  event_json jsonb not null,
  status text not null default 'PENDING' check(status in ('PENDING','RETRY','DELIVERED','DEAD')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portfolio_event_outbox_delivery_idx on portfolio_event_outbox(status,next_attempt_at);
create table if not exists semantic_embeddings (
  entity_id text not null,
  model text not null,
  content_hash text not null,
  vector_json jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(entity_id,model)
);
create index if not exists semantic_embeddings_updated_idx on semantic_embeddings(model,updated_at desc);
