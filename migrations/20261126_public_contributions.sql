-- Public collective discovery v1. Anonymous, consent-based, moderated.

create table if not exists public_contributions (
  id text primary key,
  kind text not null check (kind in ('hypothesis','challenge','experiment')),
  text text not null,
  target_id text,
  consent boolean not null default false,
  status text not null default 'PENDING' check (status in ('PENDING','PUBLISHED','REJECTED')),
  moderation_reason text,
  content_hash text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists public_contributions_status_idx on public_contributions(status, created_at desc);
