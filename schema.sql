create table if not exists artifacts (
  id text primary key,
  schema_version integer not null default 5,
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
  created_at timestamptz not null default now()
);
alter table artifacts add column if not exists evidence_level text not null default 'AI-CURATED';
alter table artifacts add column if not exists sources jsonb not null default '[]'::jsonb;
alter table artifacts add column if not exists relationships jsonb not null default '[]'::jsonb;
alter table artifacts add column if not exists experiment jsonb not null default '{}'::jsonb;
alter table artifacts add column if not exists connections jsonb not null default '[]'::jsonb;
create index if not exists artifacts_year_idx on artifacts(year);
create index if not exists artifacts_status_idx on artifacts(status);
create index if not exists artifacts_concepts_gin on artifacts using gin(concepts);
create index if not exists artifacts_evidence_level_idx on artifacts(evidence_level);
