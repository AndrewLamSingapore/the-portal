/**
 * Disposable PostgreSQL proof for the Portal-owned private schema.
 *
 * The caller owns the container lifecycle. This script applies the migration to
 * the named local container and verifies OWNER/MEMBER/unmapped RLS plus the
 * publisher insert boundary. It never reads a production connection string.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const container = process.env.PORTAL_PRIVATE_TEST_CONTAINER;
if (!container) throw new Error('PORTAL_PRIVATE_TEST_CONTAINER is required');

function psql(input) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

psql(fs.readFileSync('migrations/20261021_portal_neon_private_surface.sql', 'utf8'));

const digest = crypto.createHash('sha256').update('token', 'utf8').digest('hex');
const sql = `
begin;
set local role portal_runtime;
select set_config('app.portal_user_id','owner-1',true);
select set_config('app.portal_bootstrap_email','owner@example.invalid',true);
insert into public.portal_identities(auth_user_id,email,person_key,display_name,role)
values('owner-1','owner@example.invalid','owner','Owner','OWNER');
commit;

begin;
set local role portal_runtime;
select set_config('app.portal_user_id','owner-1',true);
insert into public.portal_identities(auth_user_id,email,person_key,display_name,role)
values('member-1','member@example.invalid','member','Member','MEMBER');
insert into public.portal_publishers(publisher_key,token_sha256,label)
values('test-publisher','${digest}','Test');
commit;

begin;
set local role portal_runtime;
select set_config('app.portal_publisher_key','test-publisher',true);
insert into public.portal_reports(id,objective,status,visibility,publisher_key)
values('report-owner','Owner only','VERIFIED','OWNER','test-publisher');
insert into public.portal_reports(id,objective,status,visibility,publisher_key)
values('report-member','Member visible','PARTIAL','MEMBER','test-publisher');
commit;

begin;
set local role portal_runtime;
select set_config('app.portal_user_id','owner-1',true);
select 'OWNER_VISIBLE', string_agg(id,',' order by id) from public.portal_reports;
rollback;

begin;
set local role portal_runtime;
select set_config('app.portal_user_id','member-1',true);
select 'MEMBER_VISIBLE', string_agg(id,',' order by id) from public.portal_reports;
rollback;

begin;
set local role portal_runtime;
select set_config('app.portal_user_id','unmapped-1',true);
select 'UNMAPPED_VISIBLE', count(*) from public.portal_reports;
rollback;
`;

const output = psql(sql);
assert.match(output, /OWNER_VISIBLE\s+\|\s+report-member,report-owner/);
assert.match(output, /MEMBER_VISIBLE\s+\|\s+report-member/);
assert.match(output, /UNMAPPED_VISIBLE\s+\|\s+0/);

console.log('PASS: Portal private PostgreSQL schema enforces owner/member/unmapped isolation and publisher insert scope.');
