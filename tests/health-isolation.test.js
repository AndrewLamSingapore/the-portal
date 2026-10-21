import assert from 'node:assert/strict';
import test from 'node:test';
import { neonConfig } from '@neondatabase/serverless';
import handler from '../api/health.js';
import { portfolioOutboxStatus } from '../src/lib/portfolio-events.js';

const evidenceColumns = ['evidence_level', 'sources', 'relationships', 'experiment', 'connections', 'lifecycle', 'current_phase', 'recurrence_conditions', 'realization_signal'];
const environmentKeys = ['DATABASE_URL', 'OPENAI_API_KEY', 'PORTAL_RESULT_TOKEN', 'PORTAL_SPINE_TOKEN', 'PORTFOLIO_RELAY_TOKEN', 'PRIME_TRUST_ABEX_RELAY_TOKEN', 'PRIME_TRUST_VELYQUA_RELAY_TOKEN', 'CRON_SECRET', 'PORTFOLIO_OUTBOX_TOKEN', 'PORTAL_AUTONOMY_ENABLED'];

function result(rows) {
  const names = Object.keys(rows[0] || {});
  return { ok: true, json: async () => ({
    fields: names.map(name => ({ name, dataTypeID: typeof rows[0][name] === 'number' ? 23 : 25 })),
    rows: rows.map(row => names.map(name => row[name] == null ? null : String(row[name]))),
  }) };
}

async function fixture(run, options = {}) {
  const previous = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
  const fetchFunction = neonConfig.fetchFunction;
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const queries = [];
  const state = { ...options };
  for (const key of environmentKeys) delete process.env[key];
  process.env.DATABASE_URL = ['postgresql:', '//fixture:', 'fixture@fixture.invalid/portal'].join('');
  process.env.OPENAI_API_KEY = 'fixture-generation';
  process.env.PORTAL_RESULT_TOKEN = 'fixture-result';
  globalThis.fetch = async () => { throw new Error('External network is forbidden in health isolation tests'); };
  console.error = () => {};
  neonConfig.fetchFunction = async (_url, request) => {
    const { query } = JSON.parse(request.body);
    queries.push(query);
    // Selected failure fixtures permit legacy DDL so each coupling is isolated.
    if (state.allowDdl && /^\s*create\b/i.test(query)) return result([]);
    if (!/^\s*select\b/i.test(query)) throw new Error('Health must never create or mutate database objects');
    if (query.includes('select * from artifacts')) {
      if (state.failCore) throw new Error('Core archive fixture failure');
      return result([{ id: 'PTL-1927-1234567890' }]);
    }
    if (query.includes('information_schema.columns')) return result((state.missingColumn ? evidenceColumns.slice(1) : evidenceColumns).map(column_name => ({ column_name })));
    if (query.includes("to_regclass('public.artifact_verdicts')")) return result([{ verdicts: 'artifact_verdicts' }]);
    if (query.includes("to_regclass('public.experiment_results')")) return result([{ results: 'experiment_results' }]);
    if (query.includes("to_regclass('public.portfolio_event_outbox')")) {
      if (state.failOutbox) throw new Error('Optional outbox fixture failure');
      return result([{ outbox: state.missingOutbox ? null : 'portfolio_event_outbox' }]);
    }
    if (query.includes("to_regclass('public.prime_trust_relay')")) {
      if (state.failRelay) throw new Error('Optional relay fixture failure');
      return result([{ relay: null }]);
    }
    if (query.includes('from portal_generation_admission.credit')) {
      if (state.failAdmission) throw new Error('Admission fixture failure');
      return result([{
        policy_id: 'portal-artifact-generation-v1',
        allowance_micro_usd: '10000000',
        reserved_micro_usd: state.reservedMicroUsd ?? '2160000',
        remaining_micro_usd: state.remainingMicroUsd ?? '7840000',
        admitted_request_rows: state.admittedRequestRows ?? '2',
        request_reservation_sum_micro_usd: state.requestReservationSumMicroUsd ?? '2160000',
        last_admitted_at: '2026-10-21 05:17:52+00',
      }]);
    }
    if (query.includes('from portfolio_event_outbox')) {
      if (state.failOutbox) throw new Error('Optional outbox fixture failure');
      if (state.missingOutbox) throw new Error('Optional outbox table does not exist');
      if (query.includes('group by status')) return result([{ status: 'PENDING', count: 2 }]);
      return result([{ count: 2, oldest_age: 7 }]);
    }
    throw new Error('Unexpected health query');
  };
  try { await run({ queries, state }); }
  finally {
    // Drain sibling read promises before restoring the shared test transport.
    await new Promise(resolve => setImmediate(resolve));
    neonConfig.fetchFunction = fetchFunction;
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const key of environmentKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

async function request(method = 'GET', query = {}) {
  const res = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method, headers: {}, query }, res);
  return res;
}

test('admission status is a read-only aggregate ledger view', async () => fixture(async ({ queries }) => {
  const res = await request('GET', { route: 'admission' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.scope, 'PORTAL_GENERATION_ADMISSION_READ_ONLY');
  assert.equal(res.body.allowance_micro_usd, 10000000);
  assert.equal(res.body.reserved_micro_usd, 2160000);
  assert.equal(res.body.remaining_micro_usd, 7840000);
  assert.equal(res.body.admitted_request_rows, 2);
  assert.equal(res.body.reservation_matches_request_rows, true);
  assert.ok(queries.every(query => /^\s*select\b/i.test(query)));
  assert.match(res.headers['Cache-Control'], /no-store/);
}));

test('admission status fails closed without exposing database details', async () => fixture(async () => {
  const res = await request('GET', { route: 'admission' });
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { ok: false, error: 'Admission ledger unavailable' });
}, { failAdmission: true }));

test('public health is read-only and independent of unconfigured portfolio credentials', async () => fixture(async ({ queries }) => {
  const res = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.health_scope, 'public_portal');
  assert.equal(res.body.portfolio_relay, false);
  assert.equal(res.body.prime_trust_relay.role_credentials_configured, false);
  assert.equal(res.body.portfolio_outbox_schema, true);
  assert.equal(res.body.portfolio_outbox.available, true);
  assert.ok(queries.every(query => /^\s*select\b/i.test(query)));
  assert.match(res.headers['Cache-Control'], /no-store/);
}));

test('an absent optional outbox is reported without creating it', async () => fixture(async ({ queries }) => {
  const status = await portfolioOutboxStatus();
  assert.equal(status.schema, false);
  assert.equal(status.available, true);
  assert.deepEqual(status.counts, {});
  const res = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.portfolio_outbox_schema, false);
  assert.equal(queries.some(query => /\b(?:create|insert|update|delete)\b/i.test(query)), false);
}, { missingOutbox: true }));

test('an optional outbox failure does not fail public health or leak its error', async () => fixture(async () => {
  const res = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.portfolio_outbox.available, false);
  assert.equal(res.body.portfolio_outbox_schema, null);
  assert.doesNotMatch(JSON.stringify(res.body), /fixture failure/);
}, { failOutbox: true, allowDdl: true }));

test('an optional trust relay failure is explicit without failing public health', async () => fixture(async () => {
  const res = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.prime_trust_relay.available, false);
  assert.equal(res.body.prime_trust_relay.schema, null);
}, { failRelay: true, allowDdl: true }));

test('core schema and credential gates still fail closed', async () => fixture(async ({ state }) => {
  state.allowDdl = true;
  state.missingColumn = true;
  const schema = await request();
  assert.equal(schema.statusCode, 503);
  assert.equal(schema.body.evidence_schema, false);
  state.missingColumn = false;
  delete process.env.PORTAL_RESULT_TOKEN;
  const credential = await request();
  assert.equal(credential.statusCode, 503);
  assert.equal(credential.body.authenticated_result_writing, false);
}));

test('a core archive failure remains a failing health response', async () => fixture(async () => {
  const res = await request();
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.ok, false);
  assert.doesNotMatch(JSON.stringify(res.body), /fixture failure/);
}, { failCore: true }));

test('optional probes recover on the next request without process restart', async () => fixture(async ({ state }) => {
  state.allowDdl = true;
  state.failOutbox = true;
  state.failRelay = true;
  const unavailable = await request();
  assert.equal(unavailable.statusCode, 200);
  assert.equal(unavailable.body.portfolio_outbox.available, false);
  state.failOutbox = false;
  state.failRelay = false;
  const recovered = await request();
  assert.equal(recovered.statusCode, 200);
  assert.equal(recovered.body.portfolio_outbox.available, true);
  assert.equal(recovered.body.portfolio_outbox.ready, 2);
  assert.equal(recovered.body.portfolio_outbox.oldest_ready_age_seconds, 7);
  assert.equal(recovered.body.prime_trust_relay.available, true);
}));

test('invalid methods and an unconfigured database perform no database calls', async () => fixture(async ({ queries }) => {
  const method = await request('POST');
  assert.equal(method.statusCode, 405);
  assert.equal(method.headers.Allow, 'GET');
  delete process.env.DATABASE_URL;
  const missing = await request();
  assert.equal(missing.statusCode, 503);
  assert.equal(missing.body.database, false);
  assert.equal(queries.length, 0);
}));
