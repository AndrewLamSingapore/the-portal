-- Portal-owned private identity and report surface.
--
-- This migration is intentionally additive. It does not read, copy, modify or
-- drop the legacy public.prime_* tables in the Game Platform Supabase project.
-- Rollback is to stop routing the Portal to these tables and leave them intact.

do $portal$
begin
  if not exists (select 1 from pg_roles where rolname = 'portal_runtime') then
    create role portal_runtime nologin;
  end if;
end
$portal$;

do $portal$
begin
  execute format('grant portal_runtime to %I', current_user);
exception
  when duplicate_object then null;
end
$portal$;

create table if not exists public.portal_identities (
  auth_user_id text primary key,
  email text not null,
  person_key text not null unique,
  display_name text not null,
  role text not null check (role in ('OWNER', 'MEMBER')),
  authority jsonb not null default '{}'::jsonb check (jsonb_typeof(authority) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_reports (
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
  publisher_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_publishers (
  publisher_key text primary key check (publisher_key ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  label text not null default '',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);

alter table public.portal_identities enable row level security;
alter table public.portal_identities force row level security;
alter table public.portal_reports enable row level security;
alter table public.portal_reports force row level security;
alter table public.portal_publishers enable row level security;
alter table public.portal_publishers force row level security;

create or replace function public.portal_current_identity()
returns table (role text, person_key text, display_name text)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $portal$
  select i.role, i.person_key, i.display_name
  from public.portal_identities i
  where i.auth_user_id = nullif(current_setting('app.portal_user_id', true), '')
  limit 1
$portal$;

create or replace function public.portal_publisher_authorize(p_token_sha256 text)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $portal$
  select p.publisher_key
  from public.portal_publishers p
  where p.token_sha256 = p_token_sha256
    and p.revoked_at is null
  limit 1
$portal$;

create or replace function public.portal_report_publish_metadata(p_id text)
returns table (created_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $portal$
  select r.created_at
  from public.portal_reports r
  where r.id = p_id
  limit 1
$portal$;

create or replace function public.portal_report_payload_error(p_report jsonb)
returns text
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $portal$
declare
  v_key text;
  v_text text;
  v_array jsonb;
  v_text_fields text[] := array['mission_id', 'task_id', 'parent_task_id'];
  v_array_fields text[] := array['agents', 'artifacts', 'claims'];
begin
  if p_report is null or jsonb_typeof(p_report) <> 'object' then
    return 'report_not_an_object';
  end if;

  for v_key in select jsonb_object_keys(p_report) loop
    if v_key not in ('id', 'schema_version', 'mission_id', 'task_id', 'parent_task_id',
                     'objective', 'summary', 'status', 'visibility',
                     'agents', 'artifacts', 'claims') then
      return 'unknown_field:' || v_key;
    end if;
  end loop;

  v_text := p_report ->> 'id';
  if v_text is null or v_text !~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$' then
    return 'invalid_id';
  end if;

  if coalesce(jsonb_typeof(p_report -> 'objective'), 'missing') <> 'string' then
    return 'objective_required';
  end if;
  v_text := p_report ->> 'objective';
  if length(btrim(v_text)) = 0 then
    return 'objective_required';
  end if;
  if length(v_text) > 500 then
    return 'objective_too_long';
  end if;

  if p_report ? 'summary' and coalesce(jsonb_typeof(p_report -> 'summary'), 'missing') <> 'string' then
    return 'invalid_summary';
  end if;
  if length(coalesce(p_report ->> 'summary', '')) > 20000 then
    return 'summary_too_long';
  end if;

  if p_report ? 'schema_version' and coalesce(p_report ->> 'schema_version', '') !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then
    return 'invalid_schema_version';
  end if;

  if p_report ->> 'status' is null or p_report ->> 'status' not in ('VERIFIED', 'PARTIAL', 'FAILED') then
    return 'invalid_status';
  end if;

  if p_report ? 'visibility' and coalesce(p_report ->> 'visibility', '') not in ('OWNER', 'MEMBER') then
    return 'invalid_visibility';
  end if;

  foreach v_text in array v_text_fields loop
    if p_report ? v_text then
      if coalesce(jsonb_typeof(p_report -> v_text), 'missing') <> 'string' then
        return 'invalid_' || v_text;
      end if;
      if length(coalesce(p_report ->> v_text, '')) > 200 then
        return 'invalid_' || v_text;
      end if;
    end if;
  end loop;

  foreach v_text in array v_array_fields loop
    if p_report ? v_text then
      v_array := p_report -> v_text;
      if coalesce(jsonb_typeof(v_array), 'missing') <> 'array' then
        return 'invalid_' || v_text;
      end if;
      if jsonb_array_length(v_array) > 200 then
        return 'too_many_' || v_text;
      end if;
      if length(v_array::text) > 20000 then
        return 'oversized_' || v_text;
      end if;
    end if;
  end loop;

  return null;
end
$portal$;

drop policy if exists portal_identities_self_read on public.portal_identities;
create policy portal_identities_self_read
  on public.portal_identities
  for select
  to portal_runtime
  using (auth_user_id = nullif(current_setting('app.portal_user_id', true), ''));

drop policy if exists portal_identities_owner_insert on public.portal_identities;
create policy portal_identities_owner_insert
  on public.portal_identities
  for insert
  to portal_runtime
  with check (
    (
      (select role from public.portal_current_identity()) = 'OWNER'
      and role in ('OWNER', 'MEMBER')
    )
    or (
      role = 'OWNER'
      and email = nullif(current_setting('app.portal_bootstrap_email', true), '')
      and not exists (select 1 from public.portal_identities where role = 'OWNER')
    )
  );

drop policy if exists portal_identities_owner_update on public.portal_identities;
create policy portal_identities_owner_update
  on public.portal_identities
  for update
  to portal_runtime
  using ((select role from public.portal_current_identity()) = 'OWNER')
  with check ((select role from public.portal_current_identity()) = 'OWNER');

drop policy if exists portal_reports_read on public.portal_reports;
create policy portal_reports_read
  on public.portal_reports
  for select
  to portal_runtime
  using (
    (select role from public.portal_current_identity()) = 'OWNER'
    or (
      visibility = 'MEMBER'
      and (select role from public.portal_current_identity()) = 'MEMBER'
    )
  );

drop policy if exists portal_reports_publisher_insert on public.portal_reports;
create policy portal_reports_publisher_insert
  on public.portal_reports
  for insert
  to portal_runtime
  with check (publisher_key = nullif(current_setting('app.portal_publisher_key', true), ''));

drop policy if exists portal_publishers_owner_select on public.portal_publishers;
create policy portal_publishers_owner_select
  on public.portal_publishers
  for select
  to portal_runtime
  using ((select role from public.portal_current_identity()) = 'OWNER');

drop policy if exists portal_publishers_owner_insert on public.portal_publishers;
create policy portal_publishers_owner_insert
  on public.portal_publishers
  for insert
  to portal_runtime
  with check ((select role from public.portal_current_identity()) = 'OWNER');

drop policy if exists portal_publishers_owner_update on public.portal_publishers;
create policy portal_publishers_owner_update
  on public.portal_publishers
  for update
  to portal_runtime
  using ((select role from public.portal_current_identity()) = 'OWNER')
  with check ((select role from public.portal_current_identity()) = 'OWNER');

drop policy if exists portal_publishers_touch on public.portal_publishers;
create policy portal_publishers_touch
  on public.portal_publishers
  for update
  to portal_runtime
  using (publisher_key = nullif(current_setting('app.portal_publisher_key', true), ''))
  with check (publisher_key = nullif(current_setting('app.portal_publisher_key', true), ''));

revoke all on table public.portal_identities, public.portal_reports, public.portal_publishers from public;
grant usage on schema public to portal_runtime;
grant select, insert, update on table public.portal_identities to portal_runtime;
grant select, insert on table public.portal_reports to portal_runtime;
grant select, insert, update on table public.portal_publishers to portal_runtime;
revoke all on function public.portal_current_identity() from public;
revoke all on function public.portal_publisher_authorize(text) from public;
revoke all on function public.portal_report_publish_metadata(text) from public;
revoke all on function public.portal_report_payload_error(jsonb) from public;
grant execute on function public.portal_current_identity() to portal_runtime;
grant execute on function public.portal_publisher_authorize(text) to portal_runtime;
grant execute on function public.portal_report_publish_metadata(text) to portal_runtime;
grant execute on function public.portal_report_payload_error(jsonb) to portal_runtime;
