import assert from 'node:assert/strict';
import test from 'node:test';
import { neonConfig } from '@neondatabase/serverless';
import handler from '../api/artifact.js';
import { ADMISSION_POLICY, ensureGenerationAdmission } from '../lib/generation-admission.js';
import { ARTIFACT_GENERATION_LIMITS } from '../lib/artifact-generation.js';

function body(rows = []) {
  const names = Object.keys(rows[0] || {});
  return { fields: names.map(name => ({ name, dataTypeID: name === 'accepted' ? 16 : name === 'retry_after_seconds' ? 23 : 25 })),
    rows: rows.map(row => names.map(name => String(row[name]))) };
}
async function fixture(run, { database = true, available = true, reason = 'admitted',
  unknown = false, malformed = false, finishFailure = false, preview = false, ledger = {} } = {}) {
  const previous = { key: process.env.OPENAI_API_KEY, database: process.env.DATABASE_URL,
    vercel: process.env.VERCEL, vercelEnv: process.env.VERCEL_ENV, fetch: globalThis.fetch,
    databaseFetch: neonConfig.fetchFunction, error: console.error, warn: console.warn };
  const state = { providerCalls: 0, queries: [], admissions: 0, reservations: 0, finishes: 0 };
  process.env.OPENAI_API_KEY = 'synthetic-provider-fixture-not-real';
  if (database) process.env.DATABASE_URL = ['postgresql:', '//fixture:fixture@fixture.invalid/portal'].join('');
  else delete process.env.DATABASE_URL;
  if (preview) { process.env.VERCEL = '1'; process.env.VERCEL_ENV = 'preview'; }
  else { delete process.env.VERCEL; process.env.VERCEL_ENV = 'production'; }
  globalThis.__portalBuckets?.clear();
  console.error = () => {}; console.warn = () => {};
  globalThis.fetch = async url => { assert.equal(url, 'https://api.openai.com/v1/responses'); state.providerCalls++; return { ok: false, status: 500 }; };
  function execute(query) {
    state.queries.push(query);
    if (!available) throw Error('Synthetic SQL unavailable');
    if (/SELECT \* FROM portal_generation_admission\.admit/.test(query.query)) {
      state.admissions++;
      assert.match(query.params[1], /^[a-f0-9]{64}$/);
      if (reason === 'admitted') state.reservations++;
      if (unknown) throw Error('Synthetic acknowledged response lost after possible commit');
      return body([{ accepted: malformed ? 'invalid' : reason === 'admitted', reason,
        retry_after_seconds: 42, request_id: query.params[0],
        allowance_micro_usd: 10000000, reserved_micro_usd: 1080000, remaining_micro_usd: 8920000, ...ledger }]);
    }
    if (/SELECT portal_generation_admission\.finish/.test(query.query)) {
      state.finishes++;
      if (finishFailure) throw Error('Synthetic lease completion unavailable');
    }
    return body();
  }
  neonConfig.fetchFunction = async (_url, options) => {
    const request = JSON.parse(options.body);
    return { ok: true, json: async () => request.queries ? { results: request.queries.map(execute) } : execute(request) };
  };
  try { await run(state); }
  finally {
    globalThis.__portalBuckets?.clear();
    globalThis.fetch = previous.fetch; neonConfig.fetchFunction = previous.databaseFetch;
    console.error = previous.error; console.warn = previous.warn;
    for (const [name, value] of [['OPENAI_API_KEY', previous.key], ['DATABASE_URL', previous.database], ['VERCEL', previous.vercel], ['VERCEL_ENV', previous.vercelEnv]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}
async function request() {
  const response = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', headers: {}, socket: { remoteAddress: '2001:db8::1' }, body: { mode: 'wander' } }, response);
  return response;
}
test('missing durable admission database fails closed before any provider request', async () => fixture(async state => {
  assert.equal((await request()).statusCode, 503); assert.equal(state.providerCalls, 0);
}, { database: false }));
test('unavailable durable admission database fails closed before any provider request', async () => fixture(async state => {
  assert.equal((await request()).statusCode, 503); assert.equal(state.providerCalls, 0);
}, { available: false }));
test('unacknowledged possibly committed admission is never retried or sent to provider', async () => fixture(async state => {
  assert.equal((await request()).statusCode, 503);
  assert.equal(state.admissions, 1); assert.equal(state.reservations, 1);
  assert.equal(state.providerCalls, 0); assert.equal(state.finishes, 0);
}, { unknown: true }));
test('malformed admission acknowledgment fails closed', async () => fixture(async state => {
  assert.equal((await request()).statusCode, 503); assert.equal(state.providerCalls, 0);
}, { malformed: true }));
test('exhausted lifetime credit returns predictable unavailable response without provider work', async () => fixture(async state => {
  const response = await request();
  assert.equal(response.statusCode, 503); assert.match(response.body.error, /credit is exhausted/);
  assert.equal(state.providerCalls, 0); assert.equal(state.finishes, 0);
}, { reason: 'credit_exhausted' }));
for (const reason of ['client_rate_limited', 'global_rate_limited', 'concurrency_limited']) {
  test(reason + ' denies transport and provides a bounded retry delay', async () => fixture(async state => {
    const response = await request(); assert.equal(response.statusCode, 429);
    assert.equal(response.headers['Retry-After'], '42'); assert.equal(state.providerCalls, 0);
  }, { reason }));
}
test('one acknowledged reservation covers both upstream attempts and lease completion only', async () => fixture(async state => {
  const response = await request(); assert.equal(response.statusCode, 502);
  assert.equal(state.admissions, 1); assert.equal(state.reservations, 1); assert.equal(state.providerCalls, 2); assert.equal(state.finishes, 1);
  assert.equal(response.headers['X-Portal-Generation-Policy'], ADMISSION_POLICY.id);
  assert.equal(response.headers['X-Portal-Generation-Allowance-MicroUSD'], '10000000');
  assert.equal(response.headers['X-Portal-Generation-Reserved-MicroUSD'], '1080000');
  assert.equal(response.headers['X-Portal-Generation-Remaining-MicroUSD'], '8920000');
  assert.equal(Object.hasOwn(response.body, 'allowance_micro_usd'), false);
}));
test('failed lease completion preserves original response and uncertain reservation', async () => fixture(async state => {
  assert.equal((await request()).statusCode, 502);
  assert.equal(state.finishes, 1); assert.equal(state.reservations, 1); assert.equal(state.providerCalls, 2);
}, { finishFailure: true }));
test('preview cannot bootstrap an independent paid allowance', async () => fixture(async state => {
  assert.equal((await request()).statusCode, 503); assert.equal(state.providerCalls, 0); assert.equal(state.queries.length, 0);
}, { preview: true }));
test('bootstrap failure is retryable later but never silently falls back to local generation', async () => {
  let calls = 0;
  const fakeSql = { query: query => query, transaction: async () => { calls++; if (calls === 1) throw Error('fixture'); return []; } };
  await assert.rejects(ensureGenerationAdmission(fakeSql), /Shared generation controls unavailable/);
  assert.equal(await ensureGenerationAdmission(fakeSql), fakeSql);
  await ensureGenerationAdmission(fakeSql);
  assert.equal(calls, 2);
});
test('cost policy identity matches exact production provider transport limits', () => {
  for (const [key, value] of Object.entries(ARTIFACT_GENERATION_LIMITS)) assert.equal(ADMISSION_POLICY[key], value);
  assert.equal(ADMISSION_POLICY.allowanceMicroUsd, 10000000);
  assert.equal(ADMISSION_POLICY.reservationMicroUsd, 1080000);
});

test('inconsistent credit metadata fails closed before provider transport', async () => {
  for (const ledger of [{ remaining_micro_usd: 1 }, { allowance_micro_usd: 20000000 }, { reserved_micro_usd: 1, remaining_micro_usd: 9999999 }]) {
    await fixture(async state => { assert.equal((await request()).statusCode, 503); assert.equal(state.providerCalls, 0); }, { ledger });
  }
});
