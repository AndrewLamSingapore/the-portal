import { db, hasDatabase } from './db.js';
import { canonicalReport } from './prime-reports.js';

const SCHEMA_STATEMENTS = [
  `do $portal$
   begin
     if not exists (select 1 from pg_roles where rolname = 'portal_runtime') then
       create role portal_runtime nologin;
     end if;
   end
   $portal$`,
  `do $portal$
   begin
     execute format('grant portal_runtime to %I', current_user);
   exception
     when duplicate_object then null;
   end
   $portal$`,
  `create table if not exists public.portal_identities (
     auth_user_id text primary key,
     email text not null,
     person_key text not null unique,
     display_name text not null,
     role text not null check (role in ('OWNER', 'MEMBER')),
     authority jsonb not null default '{}'::jsonb check (jsonb_typeof(authority) = 'object'),
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create table if not exists public.portal_reports (
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
   )`,
  `create table if not exists public.portal_publishers (
     publisher_key text primary key check (publisher_key ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
     token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
     label text not null default '',
     created_at timestamptz not null default now(),
     revoked_at timestamptz,
     last_used_at timestamptz
   )`,
  `alter table public.portal_identities enable row level security`,
  `alter table public.portal_identities force row level security`,
  `alter table public.portal_reports enable row level security`,
  `alter table public.portal_reports force row level security`,
  `alter table public.portal_publishers enable row level security`,
  `alter table public.portal_publishers force row level security`,
  `create or replace function public.portal_current_identity()
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
   $portal$`,
  `create or replace function public.portal_publisher_authorize(p_token_sha256 text)
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
   $portal$`,
  `create or replace function public.portal_report_publish_metadata(p_id text)
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
   $portal$`,
  `create or replace function public.portal_report_payload_error(p_report jsonb)
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

     if p_report ? 'schema_version' and coalesce(p_report ->> 'schema_version', '') !~ '^[0-9]+\\.[0-9]+\\.[0-9]+$' then
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
   $portal$`,
  `drop policy if exists portal_identities_self_read on public.portal_identities`,
  `create policy portal_identities_self_read
   on public.portal_identities
   for select
   to portal_runtime
   using (auth_user_id = nullif(current_setting('app.portal_user_id', true), ''))`,
  `drop policy if exists portal_identities_owner_insert on public.portal_identities`,
  `create policy portal_identities_owner_insert
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
   )`,
  `drop policy if exists portal_identities_owner_update on public.portal_identities`,
  `create policy portal_identities_owner_update
   on public.portal_identities
   for update
   to portal_runtime
   using ((select role from public.portal_current_identity()) = 'OWNER')
   with check ((select role from public.portal_current_identity()) = 'OWNER')`,
  `drop policy if exists portal_reports_read on public.portal_reports`,
  `create policy portal_reports_read
   on public.portal_reports
   for select
   to portal_runtime
   using (
     (select role from public.portal_current_identity()) = 'OWNER'
     or (
       visibility = 'MEMBER'
       and (select role from public.portal_current_identity()) = 'MEMBER'
     )
   )`,
  `drop policy if exists portal_reports_publisher_insert on public.portal_reports`,
  `create policy portal_reports_publisher_insert
   on public.portal_reports
   for insert
   to portal_runtime
   with check (publisher_key = nullif(current_setting('app.portal_publisher_key', true), ''))`,
  `drop policy if exists portal_publishers_owner_select on public.portal_publishers`,
  `create policy portal_publishers_owner_select
   on public.portal_publishers
   for select
   to portal_runtime
   using ((select role from public.portal_current_identity()) = 'OWNER')`,
  `drop policy if exists portal_publishers_owner_insert on public.portal_publishers`,
  `create policy portal_publishers_owner_insert
   on public.portal_publishers
   for insert
   to portal_runtime
   with check ((select role from public.portal_current_identity()) = 'OWNER')`,
  `drop policy if exists portal_publishers_owner_update on public.portal_publishers`,
  `create policy portal_publishers_owner_update
   on public.portal_publishers
   for update
   to portal_runtime
   using ((select role from public.portal_current_identity()) = 'OWNER')
   with check ((select role from public.portal_current_identity()) = 'OWNER')`,
  `drop policy if exists portal_publishers_touch on public.portal_publishers`,
  `create policy portal_publishers_touch
   on public.portal_publishers
   for update
   to portal_runtime
   using (publisher_key = nullif(current_setting('app.portal_publisher_key', true), ''))
   with check (publisher_key = nullif(current_setting('app.portal_publisher_key', true), ''))`,
  `revoke all on table public.portal_identities, public.portal_reports, public.portal_publishers from public`,
  `grant usage on schema public to portal_runtime`,
  `grant select, insert, update on table public.portal_identities to portal_runtime`,
  `grant select, insert on table public.portal_reports to portal_runtime`,
  `grant select, insert, update on table public.portal_publishers to portal_runtime`,
  `revoke all on function public.portal_current_identity() from public`,
  `revoke all on function public.portal_publisher_authorize(text) from public`,
  `revoke all on function public.portal_report_publish_metadata(text) from public`,
  `revoke all on function public.portal_report_payload_error(jsonb) from public`,
  `grant execute on function public.portal_current_identity() to portal_runtime`,
  `grant execute on function public.portal_publisher_authorize(text) to portal_runtime`,
  `grant execute on function public.portal_report_publish_metadata(text) to portal_runtime`,
  `grant execute on function public.portal_report_payload_error(jsonb) to portal_runtime`,
];

let schemaPromise = null;

function database() {
  if (!hasDatabase()) throw new Error('DATABASE_URL is not configured');
  return db();
}

async function initializeSchema() {
  const sql = database();
  for (const statement of SCHEMA_STATEMENTS) await sql.unsafe(statement);
}

export async function ensurePortalPrivateSchema() {
  if (!schemaPromise) {
    schemaPromise = initializeSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function withPrincipal(userId, statements, { bootstrapEmail = null, publisherKey = null } = {}) {
  const sql = database();
  const results = await sql.transaction((tx) => [
    tx`set local role portal_runtime`,
    tx`select set_config('app.portal_user_id', ${userId || ''}, true)`,
    tx`select set_config('app.portal_bootstrap_email', ${bootstrapEmail || ''}, true)`,
    tx`select set_config('app.portal_publisher_key', ${publisherKey || ''}, true)`,
    ...statements(tx),
  ]);
  return results.slice(4);
}

export class PortalIdentityStore {
  async ready() {
    await ensurePortalPrivateSchema();
    return true;
  }

  async getIdentity(user) {
    await ensurePortalPrivateSchema();
    const [rows] = await withPrincipal(user.id, (tx) => [
      tx`select role, person_key, display_name from public.portal_identities where auth_user_id = ${user.id} limit 1`,
    ]);
    if (rows[0]) return rows[0];

    const ownerEmail = String(process.env.PORTAL_OWNER_EMAIL || '').trim().toLowerCase();
    const email = String(user.email || '').trim().toLowerCase();
    if (!ownerEmail || email !== ownerEmail) return null;

    await withPrincipal(
      user.id,
      (tx) => [
        tx`insert into public.portal_identities(auth_user_id, email, person_key, display_name, role)
           values(${user.id}, ${email}, 'lam', ${user.name || 'Andrew Lam'}, 'OWNER')
           on conflict (auth_user_id) do nothing`,
      ],
      { bootstrapEmail: email },
    );
    const [created] = await withPrincipal(user.id, (tx) => [
      tx`select role, person_key, display_name from public.portal_identities where auth_user_id = ${user.id} limit 1`,
    ]);
    return created[0] || null;
  }

  async readReports(userId, { id = null, limit = 50 } = {}) {
    await ensurePortalPrivateSchema();
    const n = Math.max(1, Math.min(100, Number(limit) || 50));
    const [rows] = await withPrincipal(userId, (tx) => [
      id
        ? tx`select id, schema_version, mission_id, task_id, parent_task_id, objective, summary, status, visibility, agents, artifacts, claims, created_at
             from public.portal_reports
             where id = ${id}
             limit 1`
        : tx`select id, mission_id, objective, summary, status, visibility, created_at
             from public.portal_reports
             order by created_at desc
             limit ${n}`,
    ]);
    return rows;
  }

  async provisionIdentity(ownerId, identity) {
    await ensurePortalPrivateSchema();
    const [rows] = await withPrincipal(ownerId, (tx) => [
      tx`insert into public.portal_identities(auth_user_id, email, person_key, display_name, role, authority, updated_at)
         values(${identity.auth_user_id}, ${identity.email.toLowerCase()}, ${identity.person_key}, ${identity.display_name}, ${identity.role}, ${JSON.stringify(identity.authority || {})}::jsonb, now())
         on conflict (auth_user_id) do update set
           email = excluded.email,
           person_key = excluded.person_key,
           display_name = excluded.display_name,
           role = excluded.role,
           authority = excluded.authority,
           updated_at = now()
         returning auth_user_id, email, person_key, display_name, role`,
    ]);
    return rows[0] || null;
  }

  async registerPublisher(ownerId, publisher) {
    await ensurePortalPrivateSchema();
    const [rows] = await withPrincipal(ownerId, (tx) => [
      tx`insert into public.portal_publishers(publisher_key, token_sha256, label, revoked_at)
         values(${publisher.publisher_key}, ${publisher.token_sha256}, ${publisher.label || ''}, null)
         on conflict (publisher_key) do update set
           token_sha256 = excluded.token_sha256,
           label = excluded.label,
           revoked_at = null
         returning publisher_key, label, created_at, last_used_at`,
    ]);
    return rows[0] || null;
  }

  async revokePublisher(ownerId, publisherKey) {
    await ensurePortalPrivateSchema();
    const [rows] = await withPrincipal(ownerId, (tx) => [
      tx`update public.portal_publishers
         set revoked_at = now()
         where publisher_key = ${publisherKey}
         returning publisher_key, revoked_at`,
    ]);
    return rows[0] || null;
  }

  async publishReport(tokenSha256, report) {
    await ensurePortalPrivateSchema();
    const [publisherRows] = await withPrincipal('', (tx) => [
      tx`select public.portal_publisher_authorize(${tokenSha256}) as publisher_key`,
    ]);
    const publisherKey = publisherRows[0]?.publisher_key;
    if (!publisherKey) return { error: 'invalid_credential' };

    const payloadError = await this.#validateReportPayload(report);
    if (payloadError) return { error: 'invalid_payload', detail: payloadError };

    const normalized = canonicalReport(report);
    const [rows] = await withPrincipal(
      '',
      (tx) => [
        tx`insert into public.portal_reports(
             id, schema_version, mission_id, task_id, parent_task_id,
             objective, summary, status, visibility, agents, artifacts, claims, publisher_key
           ) values(
             ${normalized.id}, ${normalized.schema_version}, ${normalized.mission_id}, ${normalized.task_id},
             ${normalized.parent_task_id}, ${normalized.objective}, ${normalized.summary}, ${normalized.status},
             ${normalized.visibility}, ${JSON.stringify(normalized.agents)}::jsonb,
             ${JSON.stringify(normalized.artifacts)}::jsonb, ${JSON.stringify(normalized.claims)}::jsonb,
             ${publisherKey}
           )
           on conflict (id) do nothing
           returning id, created_at`,
      ],
      { publisherKey },
    );

    await withPrincipal(
      '',
      (tx) => [tx`update public.portal_publishers set last_used_at = now() where publisher_key = ${publisherKey}`],
      { publisherKey },
    );

    if (!rows[0]) {
      const [existing] = await withPrincipal(
        '',
        (tx) => [tx`select created_at from public.portal_report_publish_metadata(${normalized.id})`],
        { publisherKey },
      );
      if (!existing[0]) throw new Error('report insert did not return a durable row');
      return { id: existing[0].id, inserted: false, publisher: publisherKey, created_at: existing[0].created_at };
    }
    return { id: rows[0].id, inserted: true, publisher: publisherKey, created_at: rows[0].created_at };
  }

  async #validateReportPayload(report) {
    const sql = database();
    const rows = await sql`select public.portal_report_payload_error(${JSON.stringify(report)}::jsonb) as error`;
    return rows[0]?.error || null;
  }

  async boundaryStatus() {
    const databaseAvailable = hasDatabase();
    if (!databaseAvailable) {
      return {
        database: false,
        auth_configured: Boolean(process.env.NEON_AUTH_BASE_URL),
        schema: false,
        forced_rls: false,
        counts: null,
      };
    }
    const sql = database();
    const [tables, roles, counts] = await Promise.all([
      sql`select relname, relrowsecurity, relforcerowsecurity
          from pg_class
          where oid in ('public.portal_identities'::regclass, 'public.portal_reports'::regclass, 'public.portal_publishers'::regclass)`,
      sql`select rolname from pg_roles where rolname = 'portal_runtime'`,
      sql`select
           (select count(*)::int from public.portal_identities) as identities,
           (select count(*)::int from public.portal_reports) as reports,
           (select count(*)::int from public.portal_publishers where revoked_at is null) as active_publishers`,
    ]).catch(() => [[], [], []]);
    return {
      database: true,
      auth_configured: Boolean(process.env.NEON_AUTH_BASE_URL),
      schema: tables.length === 3,
      forced_rls: tables.length === 3 && tables.every((table) => table.relrowsecurity && table.relforcerowsecurity),
      runtime_role: roles.length === 1,
      counts: counts[0] || null,
    };
  }
}

export const portalIdentityStore = new PortalIdentityStore();
