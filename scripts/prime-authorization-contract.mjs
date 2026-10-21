/**
 * Portal private-domain contract.
 *
 * Authentication must complete against Neon Auth before identity resolution,
 * and identity resolution must complete before report data is read. The tests
 * use synthetic sessions and an in-memory implementation of the same store
 * contract as the production Neon adapter. No credential or private report
 * leaves the process.
 */
import assert from 'node:assert/strict';

import { createPrimeAuthService, PRIVATE_HEADERS, sendJson } from '../lib/prime-auth.js';
import { publisherTokenDigest } from '../lib/prime-reports.js';

const BASE = 'https://auth.example.test/neondb/auth';
const COOKIES = {
  owner: 'portal-session=owner-synthetic',
  member: 'portal-session=member-synthetic',
  unmapped: 'portal-session=unmapped-synthetic',
  invalid: 'portal-session=invalid-synthetic',
};
const USERS = {
  [COOKIES.owner]: { id: 'user-owner-synthetic', email: 'owner@example.invalid', name: 'Synthetic Owner' },
  [COOKIES.member]: { id: 'user-member-synthetic', email: 'member@example.invalid', name: 'Synthetic Member' },
  [COOKIES.unmapped]: { id: 'user-unmapped-synthetic', email: 'unmapped@example.invalid', name: 'Synthetic Unmapped' },
};
const IDENTITIES = new Map([
  ['user-owner-synthetic', { role: 'OWNER', person_key: 'owner-synthetic', display_name: 'Synthetic Owner' }],
  ['user-member-synthetic', { role: 'MEMBER', person_key: 'member-synthetic', display_name: 'Synthetic Member' }],
]);
const REPORTS = [
  { id: 'report-owner-only', objective: 'Owner only', status: 'VERIFIED', visibility: 'OWNER', created_at: '2026-10-21T00:00:00Z' },
  { id: 'report-member-visible', objective: 'Member visible', status: 'PARTIAL', visibility: 'MEMBER', created_at: '2026-10-21T00:00:00Z' },
];
const calls = [];

const fetchImpl = async (url, options = {}) => {
  const parsed = new URL(String(url));
  calls.push({ path: parsed.pathname, method: options.method || 'GET', cookie: options.headers?.Cookie || null });
  if (parsed.pathname !== '/neondb/auth/get-session') {
    return new Response(JSON.stringify({ error: 'unexpected_path' }), { status: 500 });
  }
  const user = USERS[options.headers?.Cookie];
  if (!user) return new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ session: { id: `session-${user.id}` }, user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const store = {
  async getIdentity(user) {
    calls.push({ path: '/store/identity', userId: user.id });
    return IDENTITIES.get(user.id) || null;
  },
  async readReports(userId, { id = null } = {}) {
    calls.push({ path: '/store/reports', userId, id });
    const identity = IDENTITIES.get(userId);
    if (!identity) return [];
    let rows = REPORTS.filter((row) => identity.role === 'OWNER' || row.visibility === 'MEMBER');
    if (id) rows = rows.filter((row) => row.id === id);
    return rows;
  },
  async boundaryStatus() {
    return { database: true, auth_configured: true, schema: true, forced_rls: true, runtime_role: true };
  },
};

const service = createPrimeAuthService({ fetchImpl, store, baseUrl: BASE });
const results = [];

async function check(name, fn) {
  calls.length = 0;
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`ok   ${name}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error?.message });
    console.log(`FAIL ${name}: ${error?.message}`);
  }
}

await check('anonymous access is rejected before an auth or data call', async () => {
  const auth = await service.authenticate({});
  assert.equal(auth.status, 401);
  assert.equal(auth.error, 'authentication_required');
  assert.deepEqual(calls, []);
});

await check('an invalid session is rejected by Neon Auth before identity data', async () => {
  const auth = await service.authenticate({ cookie: COOKIES.invalid });
  assert.equal(auth.status, 401);
  assert.equal(auth.error, 'invalid_session');
  assert.deepEqual(calls.map((entry) => entry.path), ['/neondb/auth/get-session']);
});

await check('an authenticated but unmapped user is refused before reports', async () => {
  const auth = await service.authenticate({ cookie: COOKIES.unmapped });
  assert.equal(auth.error, undefined);
  const mapped = await service.resolveIdentity(auth.user);
  assert.equal(mapped.status, 403);
  assert.equal(mapped.error, 'not_mapped');
  assert.deepEqual(calls.map((entry) => entry.path), ['/neondb/auth/get-session', '/store/identity']);
});

await check('a mapped OWNER sees all reports', async () => {
  const auth = await service.authenticate({ cookie: COOKIES.owner });
  const mapped = await service.resolveIdentity(auth.user);
  const reports = await service.readReports(auth.user.id);
  assert.equal(mapped.identity.role, 'OWNER');
  assert.deepEqual(reports.rows.map((row) => row.id).sort(), REPORTS.map((row) => row.id).sort());
});

await check('a mapped MEMBER sees only member-visible reports', async () => {
  const auth = await service.authenticate({ cookie: COOKIES.member });
  const mapped = await service.resolveIdentity(auth.user);
  const reports = await service.readReports(auth.user.id);
  assert.equal(mapped.identity.role, 'MEMBER');
  assert.deepEqual(reports.rows.map((row) => row.id), ['report-member-visible']);
});

await check('an IDOR-filtered owner-only report returns no row', async () => {
  const auth = await service.authenticate({ cookie: COOKIES.member });
  const mapped = await service.resolveIdentity(auth.user);
  assert.equal(mapped.identity.role, 'MEMBER');
  const reports = await service.readReports(auth.user.id, { id: 'report-owner-only' });
  assert.deepEqual(reports.rows, []);
});

await check('session cookies are forwarded only to the configured Neon Auth origin', async () => {
  await service.authenticate({ cookie: COOKIES.owner });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/neondb/auth/get-session');
  assert.equal(calls[0].cookie, COOKIES.owner);
});

await check('private headers are no-store, cookie-varying and noindex', async () => {
  const state = { status: 0, headers: {}, body: null };
  const response = {
    setHeader(key, value) { state.headers[key.toLowerCase()] = value; },
    status(code) { state.status = code; return this; },
    json(body) { state.body = body; return this; },
  };
  sendJson(response, 200, { ok: true });
  assert.deepEqual(state.headers, Object.fromEntries(Object.entries(PRIVATE_HEADERS).map(([key, value]) => [key.toLowerCase(), value])));
});

await check('publisher credentials are accepted only as SHA-256 digests', async () => {
  const raw = 'synthetic-publisher-secret';
  const received = [];
  const publishStore = {
    async publishReport(digest, report) {
      received.push({ digest, report });
      return { id: report.id, inserted: true, publisher: 'synthetic', created_at: '2026-10-21T00:00:00Z' };
    },
  };
  const publisherService = createPrimeAuthService({ fetchImpl, store: publishStore, baseUrl: BASE });
  const outcome = await publisherService.publishReport(raw, {
    id: 'PTL-TEST-001',
    objective: 'Synthetic publish',
    status: 'PARTIAL',
    visibility: 'MEMBER',
  });
  assert.equal(outcome.published.id, 'PTL-TEST-001');
  assert.equal(received[0].digest, publisherTokenDigest(raw));
  assert.ok(!JSON.stringify(received).includes(raw));
});

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\nFAIL: ${failed.length} of ${results.length} Portal private-domain checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nPASS: ${results.length} Portal private-domain checks hold.`);
}
