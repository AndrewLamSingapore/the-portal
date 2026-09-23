/**
 * Producer-side contract for the private PRIME report ingestion.
 *
 * Drives the real `api/meta.js` handler and the real `lib/prime-auth.js` client
 * against an emulator that enforces the migration's semantics: a publisher is a
 * row carrying a SHA-256 digest, an unknown or revoked digest is refused, a
 * malformed payload is refused before any insert, and the same report id is
 * inserted at most once. It also proves the round trip - a published report is
 * then readable by the mapped OWNER and hidden from a MEMBER when it is
 * owner-only - so producer and reader cannot drift apart.
 *
 * It is contract coverage, not runtime proof: the deployed behaviour is probed
 * against production separately.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { publisherTokenDigest } from '../lib/prime-reports.js';

const PUBLISHABLE_KEY = 'sb_publishable_zsgA314WZue1tlu_Kt-SDQ_UopdKMNs';
const PUBLISHER_TOKEN = 'publisher-credential-live';
const REVOKED_TOKEN = 'publisher-credential-revoked';
const GARBAGE_TOKEN = 'not-a-publisher-credential';
const READER_TOKENS = {
  owner: 'token-owner-synthetic',
  member: 'token-member-synthetic',
};
const READERS = {
  [READER_TOKENS.owner]: { id: 'user-owner-synthetic' },
  [READER_TOKENS.member]: { id: 'user-member-synthetic' },
};
const IDENTITIES = [
  { auth_user_id: READERS[READER_TOKENS.owner].id, role: 'OWNER', person_key: 'owner-synthetic', display_name: 'Synthetic Owner' },
  { auth_user_id: READERS[READER_TOKENS.member].id, role: 'MEMBER', person_key: 'member-synthetic', display_name: 'Synthetic Member' },
];

const DIGESTS = new Map([
  [publisherTokenDigest(PUBLISHER_TOKEN), 'live-publisher'],
  [publisherTokenDigest(REVOKED_TOKEN), null],
]);

/** Reports that the emulated private table currently holds. */
const storedReports = [];
const calls = [];

function digestError(json) {
  const report = json?.p_report;
  if (!json || typeof json.p_token_sha256 !== 'string') return 'invalid_credential';
  if (!DIGESTS.has(json.p_token_sha256) || DIGESTS.get(json.p_token_sha256) === null) return 'invalid_credential';
  if (!report || typeof report !== 'object' || Array.isArray(report)) return 'report_not_an_object';
  for (const key of Object.keys(report)) {
    if (!['id', 'schema_version', 'mission_id', 'task_id', 'parent_task_id', 'objective', 'summary', 'status', 'visibility', 'agents', 'artifacts', 'claims'].includes(key)) {
      return `unknown_field:${key}`;
    }
  }
  if (typeof report.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(report.id)) return 'invalid_id';
  if (typeof report.objective !== 'string' || report.objective.trim().length === 0) return 'objective_required';
  if (!['VERIFIED', 'PARTIAL', 'FAILED'].includes(report.status)) return 'invalid_status';
  if (report.visibility !== undefined && !['OWNER', 'MEMBER'].includes(report.visibility)) return 'invalid_visibility';
  return null;
}

function supabaseEmulator(url, options = {}) {
  const parsed = new URL(String(url));
  const headers = options.headers || {};
  const bearer = String(headers.Authorization || '').replace(/^Bearer /, '');
  let body = null;
  try {
    body = options.body ? JSON.parse(options.body) : null;
  } catch {
    body = null;
  }
  calls.push({ path: parsed.pathname, method: options.method || 'GET', apikey: headers.apikey, bearer, body, raw: options.body });

  // No privileged credential may ever appear on any path.
  if (headers.apikey !== PUBLISHABLE_KEY) {
    return Promise.resolve(new Response(JSON.stringify({ error: 'privileged_credential_used' }), { status: 500 }));
  }

  if (parsed.pathname === '/rest/v1/rpc/prime_publish_report') {
    if (bearer !== PUBLISHABLE_KEY) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'privileged_credential_used' }), { status: 500 }));
    }
    const error = digestError(body);
    if (error) {
      return Promise.resolve(new Response(JSON.stringify({ ok: false, error: error === 'invalid_credential' ? 'invalid_credential' : 'invalid_payload', detail: error }), { status: 200 }));
    }
    const existing = storedReports.find((row) => row.id === body.p_report.id);
    if (existing) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, id: existing.id, inserted: false, publisher: 'synthetic-publisher', created_at: existing.created_at }), { status: 200 }));
    }
    const created = {
      id: body.p_report.id,
      objective: body.p_report.objective,
      summary: body.p_report.summary ?? '',
      status: body.p_report.status,
      visibility: body.p_report.visibility ?? 'OWNER',
      created_at: '2026-09-23T00:00:00Z',
    };
    storedReports.push(created);
    return Promise.resolve(new Response(JSON.stringify({ ok: true, id: created.id, inserted: true, publisher: 'synthetic-publisher', created_at: created.created_at }), { status: 200 }));
  }

  if (parsed.pathname === '/auth/v1/user') {
    const reader = READERS[bearer];
    if (!reader) return Promise.resolve(new Response(JSON.stringify({ error: 'invalid' }), { status: 401 }));
    return Promise.resolve(new Response(JSON.stringify(reader), { status: 200 }));
  }

  if (parsed.pathname === '/rest/v1/prime_identities') {
    const row = IDENTITIES.find((identity) => identity.auth_user_id === READERS[bearer]?.id);
    return Promise.resolve(new Response(JSON.stringify(row ? [row] : []), { status: 200 }));
  }

  if (parsed.pathname === '/rest/v1/prime_reports') {
    const identity = IDENTITIES.find((row) => row.auth_user_id === READERS[bearer]?.id);
    if (!identity) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    const wanted = parsed.searchParams.get('id')?.replace(/^eq\./, '');
    let rows = storedReports.filter((row) => identity.role === 'OWNER' || row.visibility === 'MEMBER');
    if (wanted) rows = rows.filter((row) => row.id === wanted);
    return Promise.resolve(new Response(JSON.stringify(rows), { status: 200 }));
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

async function publish({ token, body, method = 'POST', contentLength } = {}) {
  calls.length = 0;
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (contentLength !== undefined) headers['content-length'] = String(contentLength);
  const req = { method, headers, query: { route: 'prime-publish' }, body };
  const res = fakeResponse();
  await handler(req, res);
  return { status: res.state.status, headers: res.state.headers, body: res.state.body, calls: [...calls] };
}

async function read(route, { token, id } = {}) {
  calls.length = 0;
  const req = { method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {}, query: id === undefined ? { route } : { route, id } };
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

const ownerReport = {
  id: 'PTL-RPT-OWNER-ONLY',
  objective: 'Owner-only operational summary',
  summary: 'Owner-only detail.',
  status: 'VERIFIED',
  visibility: 'OWNER',
  agents: ['a17'],
  claims: ['Delivered through the real ingestion route'],
};
const memberReport = {
  id: 'PTL-RPT-MEMBER-VISIBLE',
  objective: 'Member-visible project note',
  status: 'PARTIAL',
  visibility: 'MEMBER',
};

await check('an anonymous publish is refused before anything is sent', async () => {
  const result = await publish({ body: ownerReport });
  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'publisher_credential_required');
  assert.deepEqual(result.calls, [], 'no outbound call may be made without a credential');
});

await check('a garbage credential is refused with no privileged transport', async () => {
  const result = await publish({ token: GARBAGE_TOKEN, body: ownerReport });
  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'publisher_not_authorized');
  assert.equal(result.calls.length, 1, 'exactly one credential check is made');
  assert.equal(result.calls[0].apikey, PUBLISHABLE_KEY);
  assert.equal(result.calls[0].bearer, PUBLISHABLE_KEY, 'the publishable key is the only transport credential');
});

await check('a revoked credential is refused', async () => {
  const result = await publish({ token: REVOKED_TOKEN, body: ownerReport });
  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'publisher_not_authorized');
});

await check('the credential is decided before the method', async () => {
  const anonymous = await publish({ method: 'GET', body: ownerReport });
  assert.equal(anonymous.status, 401, 'a wrong verb must not be distinguishable without a credential');
  const authenticated = await publish({ token: PUBLISHER_TOKEN, method: 'GET', body: ownerReport });
  assert.equal(authenticated.status, 405);
  assert.equal(authenticated.headers.allow, 'POST');
});

await check('a malformed payload is a 400 and inserts nothing', async () => {
  const result = await publish({ token: PUBLISHER_TOKEN, body: { ...ownerReport, status: 'OK' } });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'invalid_report');
  assert.equal(result.body.detail, 'invalid_status');
  assert.equal(storedReports.length, 0, 'nothing may be stored for a rejected payload');
});

await check('a non-object body is refused before any call', async () => {
  const result = await publish({ token: PUBLISHER_TOKEN, body: 'not json' });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'invalid_report');
  assert.deepEqual(result.calls, [], 'a body that cannot be a report must not reach the database');
});

await check('an oversized body is refused before any call', async () => {
  const result = await publish({ token: PUBLISHER_TOKEN, body: ownerReport, contentLength: 200_000 });
  assert.equal(result.status, 413);
  assert.equal(result.body.error, 'report_too_large');
  assert.deepEqual(result.calls, []);
});

await check('an authorised publisher inserts exactly once', async () => {
  const first = await publish({ token: PUBLISHER_TOKEN, body: ownerReport });
  assert.equal(first.status, 201);
  assert.equal(first.body.published.id, ownerReport.id);
  assert.equal(first.body.published.inserted, true);
  const second = await publish({ token: PUBLISHER_TOKEN, body: { ...ownerReport, summary: 'changed' } });
  assert.equal(second.status, 200);
  assert.equal(second.body.published.inserted, false, 'a repeated id must never rewrite the stored report');
  assert.equal(storedReports.length, 1);
  assert.equal(storedReports[0].summary, 'Owner-only detail.');
});

await check('the raw credential never leaves the process and never comes back', async () => {
  const result = await publish({ token: PUBLISHER_TOKEN, body: memberReport });
  for (const entry of result.calls) {
    assert.ok(!String(entry.raw).includes(PUBLISHER_TOKEN), 'the credential itself must never be forwarded');
    assert.match(String(entry.body.p_token_sha256), /^[0-9a-f]{64}$/, 'only a digest may be forwarded');
    assert.equal(entry.body.p_token_sha256, publisherTokenDigest(PUBLISHER_TOKEN));
  }
  assert.ok(!JSON.stringify(result.body).includes(PUBLISHER_TOKEN), 'the credential must never be echoed');
});

await check('the published report round-trips to the mapped owner only', async () => {
  const owner = await read('prime', { token: READER_TOKENS.owner });
  assert.equal(owner.status, 200);
  assert.deepEqual(owner.body.reports.map((row) => row.id).sort(), [memberReport.id, ownerReport.id].sort());
  const member = await read('prime', { token: READER_TOKENS.member });
  assert.equal(member.status, 200);
  assert.deepEqual(member.body.reports.map((row) => row.id), [memberReport.id], 'a member must not receive owner-only rows');
  const idor = await read('prime-report', { token: READER_TOKENS.member, id: ownerReport.id });
  assert.equal(idor.status, 404);
  assert.ok(!JSON.stringify(idor.body).includes('Owner-only'), 'no owner-only content may be echoed');
});

await check('every publish response is uncacheable, varies on Authorization and is noindex', async () => {
  for (const scenario of [
    await publish({ body: ownerReport }),
    await publish({ token: GARBAGE_TOKEN, body: ownerReport }),
    await publish({ token: PUBLISHER_TOKEN, body: ownerReport }),
    await publish({ token: PUBLISHER_TOKEN, body: { ...ownerReport, status: 'OK' } }),
  ]) {
    assert.equal(scenario.headers['cache-control'], 'private, no-store, max-age=0');
    assert.equal(scenario.headers.vary, 'Authorization');
    assert.equal(scenario.headers['x-robots-tag'], 'noindex, nofollow');
  }
});

await check('the digest helper matches the published SHA-256 of the credential', async () => {
  assert.equal(
    publisherTokenDigest('abc'),
    crypto.createHash('sha256').update('abc', 'utf8').digest('hex'),
  );
  assert.equal(publisherTokenDigest('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

globalThis.fetch = realFetch;

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\nFAIL: ${failed.length} of ${results.length} PRIME publish contract checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nPASS: ${results.length} PRIME publish contract checks hold (credential before method, credential before payload, digest only, insert once, owner-only stays owner-only).`);
}
