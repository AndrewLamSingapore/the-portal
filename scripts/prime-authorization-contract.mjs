/**
 * Server-side PRIME authorization contract.
 *
 * The private surface must decide authentication before authorization, before
 * parameters, and before any data is read; it must never use a privileged
 * credential; and it must never return another identity's material. Those
 * properties live in api/meta.js and lib/prime-auth.js, so this suite drives the
 * real handler with a Supabase emulator that enforces the migration's RLS
 * semantics (prime_identities self-read; prime_reports to a mapped OWNER, or to
 * a MEMBER when the report is member-visible).
 *
 * It is contract coverage, not runtime proof of the deployed policies: the real
 * RLS behaviour is additionally probed against production, and the authenticated
 * identities require the owner's own session.
 */
import assert from 'node:assert/strict';

const PUBLISHABLE_KEY = 'sb_publishable_zsgA314WZue1tlu_Kt-SDQ_UopdKMNs';
const TOKENS = {
  owner: 'token-owner-synthetic',
  member: 'token-member-synthetic',
  unmapped: 'token-unmapped-synthetic',
};
const USERS = {
  [TOKENS.owner]: { id: 'user-owner-synthetic', email: 'owner@example.invalid' },
  [TOKENS.member]: { id: 'user-member-synthetic', email: 'member@example.invalid' },
  [TOKENS.unmapped]: { id: 'user-unmapped-synthetic', email: 'unmapped@example.invalid' },
};
const IDENTITIES = [
  { auth_user_id: USERS[TOKENS.owner].id, role: 'OWNER', person_key: 'owner-synthetic', display_name: 'Synthetic Owner' },
  { auth_user_id: USERS[TOKENS.member].id, role: 'MEMBER', person_key: 'member-synthetic', display_name: 'Synthetic Member' },
];
const REPORTS = [
  { id: 'report-owner-only', objective: 'Owner only', status: 'VERIFIED', visibility: 'OWNER', created_at: '2026-09-22T00:00:00Z' },
  { id: 'report-member-visible', objective: 'Member visible', status: 'PARTIAL', visibility: 'MEMBER', created_at: '2026-09-22T00:00:00Z' },
];

/** Records every outbound call so the contract can assert exactly what was used. */
const calls = [];

function supabaseEmulator(url, options = {}) {
  const href = String(url);
  const headers = options.headers || {};
  const apikey = headers.apikey;
  const bearer = String(headers.Authorization || '').replace(/^Bearer /, '');
  const parsed = new URL(href);
  calls.push({ path: parsed.pathname, search: parsed.search, method: options.method || 'GET', apikey, bearer });

  // No privileged credential may ever appear in a browser-facing code path.
  if (apikey !== PUBLISHABLE_KEY) {
    return Promise.resolve(new Response(JSON.stringify({ error: 'privileged_credential_used' }), { status: 500 }));
  }
  const caller = USERS[bearer];

  if (parsed.pathname === '/auth/v1/user') {
    if (!caller) return Promise.resolve(new Response(JSON.stringify({ error: 'invalid' }), { status: 401 }));
    return Promise.resolve(new Response(JSON.stringify(caller), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }

  if (parsed.pathname === '/rest/v1/prime_identities') {
    // RLS: prime_identities_self_read (auth_user_id = auth.uid()).
    if (!caller) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    const wanted = parsed.searchParams.get('auth_user_id')?.replace(/^eq\./, '');
    const rows = IDENTITIES.filter((row) => row.auth_user_id === caller.id && row.auth_user_id === wanted);
    return Promise.resolve(new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }

  if (parsed.pathname === '/rest/v1/prime_reports') {
    // RLS: a mapped OWNER sees everything; a MEMBER sees member-visible rows only.
    const identity = IDENTITIES.find((row) => row.auth_user_id === caller?.id);
    if (!identity) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    const id = parsed.searchParams.get('id')?.replace(/^eq\./, '');
    let rows = REPORTS.filter((row) => identity.role === 'OWNER' || row.visibility === 'MEMBER');
    if (id) rows = rows.filter((row) => row.id === id);
    return Promise.resolve(new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }

  return Promise.resolve(new Response(JSON.stringify({ error: 'unexpected_path', path: parsed.pathname }), { status: 500 }));
}

const realFetch = globalThis.fetch;
globalThis.fetch = supabaseEmulator;

const { default: handler } = await import('../api/meta.js');

function fakeResponse() {
  const state = { status: 0, headers: {}, body: undefined };
  return {
    state,
    setHeader(key, value) { state.headers[key.toLowerCase()] = value; },
    status(code) { state.status = code; return this; },
    json(payload) { state.body = payload; return this; },
    send(payload) { state.body = payload; return this; },
  };
}

async function call(route, { method = 'GET', token, id } = {}) {
  calls.length = 0;
  const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, query: id === undefined ? { route } : { route, id } };
  const res = fakeResponse();
  await handler(req, res);
  return { status: res.state.status, headers: res.state.headers, body: res.state.body, calls: [...calls] };
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`ok   ${name}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error?.message });
    console.log(`FAIL ${name}: ${error?.message}`);
  }
}

function pathsUsed(result) {
  return result.calls.map((entry) => entry.path);
}

await check('an anonymous request is refused before anything is read', () => {
  return (async () => {
    const result = await call('prime');
    assert.equal(result.status, 401);
    assert.equal(result.body.error, 'authentication_required');
    assert.deepEqual(result.calls, [], 'no Supabase call may be made without a credential');
  })();
});

await check('a malformed token is refused after one validation call only', async () => {
  const result = await call('prime', { token: 'not-a-real-token' });
  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'invalid_session');
  assert.deepEqual(pathsUsed(result), ['/auth/v1/user'], 'identity and report tables must not be touched for an invalid session');
});

await check('an authenticated but unmapped user is refused before any report read', async () => {
  const result = await call('prime', { token: TOKENS.unmapped });
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'not_mapped');
  assert.deepEqual(pathsUsed(result), ['/auth/v1/user', '/rest/v1/prime_identities'], 'authorization must be decided before report data');
});

await check('a mapped OWNER receives its identity and every report', async () => {
  const result = await call('prime', { token: TOKENS.owner });
  assert.equal(result.status, 200);
  assert.equal(result.body.identity.role, 'OWNER');
  assert.equal(result.body.identity.person_key, 'owner-synthetic');
  assert.equal(result.body.reports.length, REPORTS.length, 'an owner sees owner-only and member-visible reports');
});

await check('a mapped MEMBER cannot see owner-only reports', async () => {
  const result = await call('prime', { token: TOKENS.member });
  assert.equal(result.status, 200);
  assert.equal(result.body.identity.role, 'MEMBER');
  assert.deepEqual(result.body.reports.map((report) => report.id), ['report-member-visible'], 'member escalation must not read owner-only rows');
});

await check('every outbound call carries the caller token and the publishable key only', async () => {
  const owner = await call('prime', { token: TOKENS.owner });
  for (const entry of owner.calls) {
    assert.equal(entry.apikey, PUBLISHABLE_KEY, 'only the publishable key may be used');
    assert.equal(entry.bearer, TOKENS.owner, 'the caller token must be forwarded, never substituted');
  }
  const member = await call('prime', { token: TOKENS.member });
  for (const entry of member.calls) assert.equal(entry.bearer, TOKENS.member);
});

await check('every private response is uncacheable, varies on Authorization and is noindex', async () => {
  for (const scenario of [
    await call('prime'),
    await call('prime', { token: 'not-a-real-token' }),
    await call('prime', { token: TOKENS.unmapped }),
    await call('prime', { token: TOKENS.owner }),
    await call('prime-report', { token: TOKENS.member, id: 'report-owner-only' }),
  ]) {
    assert.equal(scenario.headers['cache-control'], 'private, no-store, max-age=0');
    assert.equal(scenario.headers.vary, 'Authorization');
    assert.equal(scenario.headers['x-robots-tag'], 'noindex, nofollow');
  }
});

await check('an IDOR attempt on an owner-only report is a 404, not a leak', async () => {
  const result = await call('prime-report', { token: TOKENS.member, id: 'report-owner-only' });
  assert.equal(result.status, 404);
  assert.equal(result.body.error, 'report_not_found');
  assert.ok(!JSON.stringify(result.body).includes('Owner only'), 'no report content may be echoed');
});

await check('the owner can read a specific report through the same filter', async () => {
  const result = await call('prime-report', { token: TOKENS.owner, id: 'report-owner-only' });
  assert.equal(result.status, 200);
  assert.equal(result.body.report.id, 'report-owner-only');
  assert.equal(result.body.identity.role, 'OWNER');
});

await check('parameter validation never precedes authentication', async () => {
  const missingId = await call('prime-report', { token: TOKENS.owner });
  assert.equal(missingId.status, 400, 'a valid session with no id is a client error');
  const badIdWithGarbageToken = await call('prime-report', { token: 'not-a-real-token' });
  assert.equal(badIdWithGarbageToken.status, 401, 'an unauthenticated request is refused before its parameters are judged');
  const badIdAnonymous = await call('prime-report', {});
  assert.equal(badIdAnonymous.status, 401);
  const longId = await call('prime-report', { token: TOKENS.owner, id: 'x'.repeat(200) });
  assert.equal(longId.status, 400);
});

await check('no response body ever repeats the caller credential', async () => {
  for (const token of Object.values(TOKENS)) {
    const result = await call('prime', { token });
    assert.ok(!JSON.stringify(result.body).includes(token), 'credentials must never be echoed');
  }
});

await check('a write verb on a read-only private route is refused after authentication', async () => {
  const anonymous = await call('prime', { method: 'POST' });
  assert.equal(anonymous.status, 401, 'authentication is decided before the method');
  const authenticated = await call('prime', { method: 'POST', token: TOKENS.owner });
  assert.equal(authenticated.status, 405, 'a private read route must not silently serve a write verb');
});

globalThis.fetch = realFetch;

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\nFAIL: ${failed.length} of ${results.length} PRIME authorization contract checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nPASS: ${results.length} PRIME authorization contract checks hold (authentication before authorization, before parameters, before data; no privileged credential; no cross-identity leakage).`);
}
