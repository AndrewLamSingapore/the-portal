-- Private PRIME report ingestion.
--
-- The private surface could read reports but had no path that could ever write
-- one, so `prime_reports` was permanently empty and `/reports` could only ever
-- say "No reports are visible to this identity yet". This migration adds the
-- producer side of the same domain, without weakening the read side:
--
--   * a machine producer (PRIME/ABEX, or an owner-authorised acceptance runner)
--     holds a credential and pushes a report outward over HTTPS;
--   * only the SHA-256 of that credential is stored, so the credential itself
--     never reaches the database, the repository or a browser;
--   * the write happens inside one SECURITY DEFINER function that checks the
--     credential, validates the payload and inserts at most once per report id;
--   * no client role gains any table write privilege, so a mistaken future
--     policy cannot turn a browser session into a report author.
--
-- Reports remain immutable: a second publish of the same id is a no-op that
-- reports `inserted: false` rather than an update.

create table if not exists public.prime_publishers (
  publisher_key text primary key check (publisher_key ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  label text not null default '',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);

comment on table public.prime_publishers is
  'Machine producers allowed to publish private PRIME reports. Only a SHA-256 digest is stored. No client access.';

alter table public.prime_publishers enable row level security;
alter table public.prime_publishers force row level security;

-- No policies exist for this table, so no client role can read or write it.
-- Revoking the default grants makes that explicit rather than implicit.
revoke all on table public.prime_publishers from anon, authenticated;

-- The private tables previously relied only on RLS for write refusal. RLS is
-- correct and stays the enforcement point for reads; these revokes remove the
-- unused default write grants so the refusal is defence in depth.
revoke insert, update, delete, truncate, references, trigger on table public.prime_identities from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.prime_reports from anon, authenticated;
grant select on table public.prime_identities to authenticated;
grant select on table public.prime_reports to authenticated;

create or replace function public.prime_report_payload_error(p_report jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
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

  -- jsonb_typeof() is NULL both for a missing key and for a JSON null, so the
  -- guard must treat those as invalid rather than letting them reach a NOT NULL
  -- column and surface as a server error.
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
end;
$$;

comment on function public.prime_report_payload_error(jsonb) is
  'Returns null when a report payload is acceptable, otherwise a stable error code.';

revoke all on function public.prime_report_payload_error(jsonb) from public, anon, authenticated;

create or replace function public.prime_publish_report(p_token_sha256 text, p_report jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publisher public.prime_publishers%rowtype;
  v_error text;
  v_id text;
  v_inserted boolean := false;
  v_created_at timestamptz;
begin
  if p_token_sha256 is null or p_token_sha256 !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_credential');
  end if;

  select * into v_publisher
    from public.prime_publishers p
   where p.token_sha256 = p_token_sha256
     and p.revoked_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_credential');
  end if;

  v_error := public.prime_report_payload_error(p_report);
  if v_error is not null then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload', 'detail', v_error);
  end if;

  v_id := p_report ->> 'id';

  insert into public.prime_reports (
    id, schema_version, mission_id, task_id, parent_task_id,
    objective, summary, status, visibility, agents, artifacts, claims
  ) values (
    v_id,
    coalesce(p_report ->> 'schema_version', '1.0.0'),
    nullif(p_report ->> 'mission_id', ''),
    nullif(p_report ->> 'task_id', ''),
    nullif(p_report ->> 'parent_task_id', ''),
    btrim(p_report ->> 'objective'),
    coalesce(p_report ->> 'summary', ''),
    p_report ->> 'status',
    coalesce(p_report ->> 'visibility', 'OWNER'),
    coalesce(p_report -> 'agents', '[]'::jsonb),
    coalesce(p_report -> 'artifacts', '[]'::jsonb),
    coalesce(p_report -> 'claims', '[]'::jsonb)
  )
  on conflict (id) do nothing;

  v_inserted := found;

  select r.created_at into v_created_at from public.prime_reports r where r.id = v_id;

  update public.prime_publishers
     set last_used_at = now()
   where publisher_key = v_publisher.publisher_key;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'inserted', v_inserted,
    'publisher', v_publisher.publisher_key,
    'created_at', v_created_at
  );
end;
$$;

comment on function public.prime_publish_report(text, jsonb) is
  'Ingests one immutable private PRIME report from an authorised machine producer.';

revoke all on function public.prime_publish_report(text, jsonb) from public;
grant execute on function public.prime_publish_report(text, jsonb) to anon, authenticated;
