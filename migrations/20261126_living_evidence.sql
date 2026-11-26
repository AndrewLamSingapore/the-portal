-- Living evidence v1. Authorized external evidence with provenance, content-hash
-- deduplication, relevance, contradiction tracking and controlled rebirth.

create table if not exists living_evidence (
  id text primary key,
  source text not null,
  summary text not null,
  relation text not null default 'neutral' check (relation in ('supports','contradicts','neutral')),
  target_id text,
  relevance numeric not null default 0,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists living_evidence_consumed_idx on living_evidence(consumed, created_at);
