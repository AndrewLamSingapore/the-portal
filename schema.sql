create table if not exists artifacts (
  id text primary key,
  schema_version integer not null default 6,
  year integer not null,
  era text not null,
  type text not null,
  title text not null,
  description text not null,
  provenance text not null,
  condition integer not null check (condition between 1 and 5),
  imagined_future text not null,
  problem text not null,
  status text not null,
  modern_descendant text not null,
  question text not null,
  mode text not null,
  concepts jsonb not null default '[]'::jsonb,
  evidence_level text not null default 'AI-CURATED',
  sources jsonb not null default '[]'::jsonb,
  relationships jsonb not null default '[]'::jsonb,
  experiment jsonb not null default '{}'::jsonb,
  connections jsonb not null default '[]'::jsonb,
  lifecycle jsonb not null default '[]'::jsonb,
  current_phase text not null default 'EMERGED',
  recurrence_conditions jsonb not null default '[]'::jsonb,
  realization_signal text not null default '',
  created_at timestamptz not null default now()
);
alter table artifacts add column if not exists evidence_level text not null default 'AI-CURATED';
alter table artifacts add column if not exists sources jsonb not null default '[]'::jsonb;
alter table artifacts add column if not exists relationships jsonb not null default '[]'::jsonb;
alter table artifacts add column if not exists experiment jsonb not null default '{}'::jsonb;
alter table artifacts add column if not exists connections jsonb not null default '[]'::jsonb;
alter table artifacts add column if not exists lifecycle jsonb not null default '[]'::jsonb;
alter table artifacts add column if not exists current_phase text not null default 'EMERGED';
alter table artifacts add column if not exists recurrence_conditions jsonb not null default '[]'::jsonb;
alter table artifacts add column if not exists realization_signal text not null default '';
alter table artifacts alter column schema_version set default 6;
create index if not exists artifacts_year_idx on artifacts(year);
create index if not exists artifacts_status_idx on artifacts(status);
create index if not exists artifacts_concepts_gin on artifacts using gin(concepts);
create index if not exists artifacts_evidence_level_idx on artifacts(evidence_level);
create index if not exists artifacts_current_phase_idx on artifacts(current_phase);

create table if not exists artifact_verdicts (
  artifact_id text not null references artifacts(id) on delete cascade,
  verdict text not null check (verdict in ('FAILED', 'TOO_EARLY', 'ARRIVED_QUIETLY')),
  vote_count bigint not null default 0 check (vote_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (artifact_id, verdict)
);
create index if not exists artifact_verdicts_updated_at_idx on artifact_verdicts(updated_at desc);
