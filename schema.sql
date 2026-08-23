create table if not exists artifacts (
  id text primary key,
  schema_version integer not null default 3,
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
  created_at timestamptz not null default now()
);
create index if not exists artifacts_year_idx on artifacts(year);
create index if not exists artifacts_status_idx on artifacts(status);
create index if not exists artifacts_concepts_gin on artifacts using gin(concepts);
