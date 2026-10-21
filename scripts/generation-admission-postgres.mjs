import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { ADMISSION_SCHEMA_STATEMENTS, ADMISSION_POLICY } from '../lib/generation-admission-schema.js';

const container = process.env.PORTAL_ADMISSION_TEST_CONTAINER;
if (!/^abex-portal-admission-[a-z0-9-]+$/.test(container || '')) throw Error('An explicitly task-owned disposable container is required');
const checks = [];
async function command(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', v => { stdout += v; });
    child.stderr.on('data', v => { stderr += v; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(Error('Fixture command failed: ' + stderr.slice(-1500))));
    child.stdin.end(input);
  });
}
assert.equal(await command(['inspect', '--format', '{{index .Config.Labels "portal.admission-test"}}', container]), '1');
assert.equal(await command(['inspect', '--format', '{{.HostConfig.NetworkMode}}', container]), 'none');
async function sql(database, text, backend = true) {
  return command(['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database],
    (backend ? 'SET ROLE portal_backend;\n' : '') + text);
}
async function fresh(name) {
  const db = 'portal_admission_test_' + name;
  assert.match(db, /^portal_admission_test_[a-z]+$/);
  await command(['exec', container, 'createdb', '-U', 'postgres', '-O', 'portal_backend', db]);
  await sql(db, 'BEGIN;\n' + ADMISSION_SCHEMA_STATEMENTS.join(';\n') + ';\nCOMMIT;');
  return db;
}
async function check(name, fn) {
  await fn(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name);
}
const client = n => createHash('sha256').update('synthetic-client-' + n).digest('hex');
async function admit(db, key = client(1), id = randomUUID()) {
  return JSON.parse(await sql(db, "SELECT row_to_json(r) FROM portal_generation_admission.admit('" + id + "'::uuid,'" + key + "') r;"));
}
const finish = (db, id) => sql(db, "SELECT portal_generation_admission.finish('" + id + "'::uuid);");
const credit = db => sql(db, 'SELECT reserved_micro_usd FROM portal_generation_admission.credit;');
await sql('postgres', 'CREATE ROLE portal_backend NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE anonymous NOLOGIN;', false);

let db;
await check('concurrent bootstrap creates one unrefilled credit record', async () => {
  db = await fresh('concurrency');
  const bootstrap = 'BEGIN;\n' + ADMISSION_SCHEMA_STATEMENTS.join(';\n') + ';\nCOMMIT;';
  await Promise.all(Array.from({ length: 3 }, () => sql(db, bootstrap)));
  assert.equal(await sql(db, 'SELECT count(*) FROM portal_generation_admission.credit;'), '1');
  assert.equal(await credit(db), '0');
});
await check('twenty simultaneous clients receive exactly two live leases', async () => {
  const replies = await Promise.all(Array.from({ length: 20 }, (_, i) => admit(db, client(i))));
  assert.equal(replies.filter(r => r.accepted).length, 2);
  for (const reply of replies) {
    assert.equal(Number(reply.allowance_micro_usd), 10000000);
    assert.equal(Number(reply.remaining_micro_usd), 10000000 - Number(reply.reserved_micro_usd));
  }
  assert.deepEqual(replies.filter(r => r.accepted).map(r => Number(r.reserved_micro_usd)).sort((a,b)=>a-b), [1080000,2160000]);
  assert.ok(replies.filter(r => !r.accepted).every(r => r.reason === 'concurrency_limited'));
  assert.equal(await credit(db), '2160000');
});
await check('completion and replay never refund credit or repeat a ticket', async () => {
  const id = await sql(db, 'SELECT request_id FROM portal_generation_admission.requests ORDER BY request_id LIMIT 1;');
  await finish(db, id); await finish(db, id);
  assert.equal(await credit(db), '2160000');
  assert.equal((await admit(db, client(99), id)).reason, 'duplicate_request');
  assert.equal((await admit(db, client(99))).accepted, true);
  assert.equal(await credit(db), '3240000');
});
await check('expired unknown outcomes release leases but permanently retain reservations', async () => {
  await sql(db, "UPDATE portal_generation_admission.requests SET lease_until=clock_timestamp()-interval '1 second';");
  assert.equal((await admit(db, client(100))).accepted, true);
  assert.equal(await credit(db), '4320000');
});
await check('invalid identities admit no request and reserve no credit', async () => {
  const before = await credit(db);
  assert.equal((await admit(db, 'not-a-hash')).reason, 'invalid_identity');
  assert.equal(await credit(db), before);
});
await check('untrusted roles cannot access schema, tables or invoker functions', async () => {
  for (const role of ['anon', 'authenticated', 'anonymous']) {
    assert.equal(await sql(db, "SELECT has_schema_privilege('" + role + "','portal_generation_admission','USAGE');"), 'f');
    assert.equal(await sql(db, "SELECT has_table_privilege('" + role + "','portal_generation_admission.credit','SELECT,INSERT,UPDATE,DELETE');"), 'f');
    assert.equal(await sql(db, "SELECT has_function_privilege('" + role + "','portal_generation_admission.admit(uuid,text)','EXECUTE');"), 'f');
    await assert.rejects(sql(db, 'SET ROLE ' + role + "; SELECT * FROM portal_generation_admission.admit('" + randomUUID() + "'::uuid,'" + client(1) + "');", false));
  }
  assert.equal(await sql(db, "SELECT bool_and(NOT prosecdef) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='portal_generation_admission';"), 't');
});
await check('client and global UTC-hour limits evaluate exact production thresholds', async () => {
  const rateDb = await fresh('rates');
  // Administrative fixtures isolate rate branches otherwise dominated by the stricter nine-reservation credit limit.
  const seed = (count, same) => sql(rateDb, "INSERT INTO portal_generation_admission.requests SELECT md5('fixture-'||i)::uuid,'portal-artifact-generation-v1'," +
    (same ? "'" + client(7) + "'" : "md5(i::text)||md5(i::text)") +
    ",clock_timestamp(),date_trunc('hour',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',clock_timestamp(),clock_timestamp(),1080000 FROM generate_series(1," + count + ") i;");
  await seed(12, true);
  assert.equal((await admit(rateDb, client(7))).reason, 'client_rate_limited');
  await sql(rateDb, 'TRUNCATE portal_generation_admission.requests;');
  await seed(60, false);
  assert.equal((await admit(rateDb, client(999))).reason, 'global_rate_limited');
  await sql(rateDb, "UPDATE portal_generation_admission.requests SET hour_start=hour_start-interval '1 hour';");
  assert.equal((await admit(rateDb, client(999))).accepted, true);
});
await check('nine reservations exhaust lifetime credit despite completion and repeated bootstrap', async () => {
  db = await fresh('credit');
  for (let i = 0; i < 9; i++) { const r = await admit(db, client(i)); assert.equal(r.accepted, true); await finish(db, r.request_id); }
  assert.equal((await admit(db, client(10))).reason, 'credit_exhausted');
  await sql(db, 'BEGIN;\n' + ADMISSION_SCHEMA_STATEMENTS.join(';\n') + ';\nCOMMIT;');
  assert.equal(await credit(db), '9720000');
  assert.equal((await admit(db, client(11))).reason, 'credit_exhausted');
});
await check('actual PostgreSQL restart retains credit and refuses further provider admission', async () => {
  await command(['restart', container]);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { await sql('postgres', 'SELECT 1;', false); ready = true; break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  assert.equal(ready, true);
  assert.equal(await credit(db), '9720000');
  assert.equal((await admit(db, client(12))).reason, 'credit_exhausted');
});
await check('logical backup and isolated restore preserve exact ledger, credit and denial', async () => {
  const snapshot = d => sql(d, "SELECT jsonb_build_object('credit',(SELECT to_jsonb(c) FROM portal_generation_admission.credit c),'requests',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_id) FROM portal_generation_admission.requests r));");
  const before = JSON.parse(await snapshot(db));
  const dump = await command(['exec', container, 'pg_dump', '-U', 'postgres', '-d', db, '--schema=portal_generation_admission', '--no-owner']);
  const restoreDb = 'portal_admission_test_restore';
  await command(['exec', container, 'createdb', '-U', 'postgres', '-O', 'portal_backend', restoreDb]);
  await sql(restoreDb, dump);
  assert.deepEqual(JSON.parse(await snapshot(restoreDb)), before);
  assert.equal((await admit(restoreDb, client(13))).reason, 'credit_exhausted');
  assert.equal(await sql(restoreDb, "SELECT has_function_privilege('anon','portal_generation_admission.admit(uuid,text)','EXECUTE');"), 'f');
});
const report = { at: new Date().toISOString(), kind: 'isolated_postgresql_correctness_not_performance',
  policy: ADMISSION_POLICY, postgres: await sql('postgres', 'SHOW server_version;', false), container,
  network: 'none', providerCalls: 0, liveDatabaseCalls: 0, checks,
  limitations: ['Rate fixtures deliberately isolate rate branches from stricter lifetime credit.',
    'Logical restore is a disposable test, not managed Neon/PITR or protection against stale production backup rollback.',
    'Two logical leases do not guarantee timed-out provider computation has stopped.'] };
if (process.env.PORTAL_ADMISSION_TEST_REPORT) writeFileSync(process.env.PORTAL_ADMISSION_TEST_REPORT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ tests: checks.length, pass: checks.length, providerCalls: 0 }));
