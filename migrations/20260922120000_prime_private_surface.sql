-- Private PRIME surface: identity mapping and reports.
--
-- Ownership: the Portal's private domain. The tables live in the Supabase
-- project that the estate already uses for authentication
-- (vtrfgckzpjgtmqsnumur / "Game Platform"), because that is the only Supabase
-- project available and creating a second identity universe is forbidden.
--
-- Model:
--   auth.users (Supabase Auth)  = WHO this is
--   prime_identities            = the immutable PRIME person/role mapping
--   prime_reports               = private operational reports
--
-- Authorization is enforced in the database: a report is visible to a mapped
-- OWNER, or to a mapped MEMBER only when the report is member-visible. Nothing
-- in this file grants access merely because authentication succeeded.

create table if not exists public.prime_identities (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  person_key text not null unique,
  display_name text not null,
  role text not null check (role in ('OWNER', 'MEMBER')),
  authority jsonb not null default '{}'::jsonb check (jsonb_typeof(authority) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prime_reports (
  id text primary key,
  schema_version text not null default '1.0.0',
  mission_id text,
  task_id text,
  parent_task_id text,
  objective text not null,
  summary text not null default '',
  status text not null check (status in ('VERIFIED', 'PARTIAL', 'FAILED')),
  visibility text not null default 'OWNER' check (visibility in ('OWNER', 'MEMBER')),
  agents jsonb not null default '[]'::jsonb,
  artifacts jsonb not null default '[]'::jsonb,
  claims jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prime_identities enable row level security;
alter table public.prime_identities force row level security;
alter table public.prime_reports enable row level security;
alter table public.prime_reports force row level security;

-- Resolve the caller's PRIME identity without recursive RLS evaluation.
create or replace function public.prime_identity()
returns table (role text, person_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.role, i.person_key
  from public.prime_identities i
  where i.auth_user_id = (select auth.uid())
$$;

revoke all on function public.prime_identity() from public, anon;
grant execute on function public.prime_identity() to authenticated;

drop policy if exists prime_identities_self_read on public.prime_identities;
create policy prime_identities_self_read
  on public.prime_identities
  for select
  to authenticated
  using (auth_user_id = (select auth.uid()));

-- Identity mapping is provisioned server-side only: no client insert/update/delete.

drop policy if exists prime_reports_read on public.prime_reports;
create policy prime_reports_read
  on public.prime_reports
  for select
  to authenticated
  using (
    exists (select 1 from public.prime_identity() me)
    and (
      (select me.role from public.prime_identity() me) = 'OWNER'
      or visibility = 'MEMBER'
    )
  );

-- Reports are written by the owner-side ingestion path only (server-side
-- credentials), never by a browser session.

comment on table public.prime_identities is
  'Maps a Supabase auth user to an immutable PRIME person and role. No client writes.';
comment on table public.prime_reports is
  'Private PRIME reports. OWNER sees all; MEMBER sees member-visible rows only.';
