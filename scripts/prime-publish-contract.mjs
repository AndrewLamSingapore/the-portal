/**
 * Producer-side contract for Portal-owned private report ingestion.
 *
 * The browser never writes a private report. A machine producer presents its
 * raw bearer credential to the Portal API; the service forwards only a SHA-256
 * digest to the database adapter, which enforces active-publisher, payload,
 * idempotency and RLS rules.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { createPrimeAuthService } from '../lib/prime-auth.js';
import { publisherTokenDigest, validateReport } from '../lib/prime-reports.js';

const BASE = 'https://auth.example.test/neondb/auth';
const LIVE_TOKEN = 'publisher-credential-live';
const REVOKED_TOKEN = 'publisher-credential-revoked';
const GARBAGE_TOKEN = 'not-a-publisher-credential';
const reports = [];
const calls = [];

class MemoryPublisherStore {
  constructor() {
    this.active = new Set([publisherTokenDigest(LIVE_TOKEN)]);
  }

  async publishReport(digest, report) {
    calls.push({ digest, report });
    if (!this.active.has(digest)) return { error: 'invalid_credential' };
    const checked = validateReport(report);
    if (!checked.ok) return { error: 'invalid_payload', detail: checked.error };
    const existing = reports.find((row) => row.id === report.id);
    if (existing) {
      return { id: existing.id, inserted: false, publisher: 'synthetic-publisher', created_at: existing.created_at };
    }
    const created = {
      ...report,
      visibility: report.visibility || 'OWNER',
      created_at: '2026-10-21T00:00:00Z',
    };
    reports.push(created);
    return { id: created.id, inserted: true, publisher: 'synthetic-publisher', created_at: created.created_at };
  }
}

const service = createPrimeAuthService({
  baseUrl: BASE,
  fetchImpl: async () => new Response(null, { status: 500 }),
  store: new MemoryPublisherStore(),
});

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

await check('a garbage credential is refused before a report is stored', async () => {
  const outcome = await service.publishReport(GARBAGE_TOKEN, ownerReport);
  assert.equal(outcome.status, 401);
  assert.equal(outcome.error, 'publisher_not_authorized');
  assert.equal(reports.length, 0);
});

await check('a revoked credential cannot publish', async () => {
  const outcome = await service.publishReport(REVOKED_TOKEN, ownerReport);
  assert.equal(outcome.status, 401);
  assert.equal(outcome.error, 'publisher_not_authorized');
});

await check('a malformed payload is rejected before insertion', async () => {
  const outcome = await service.publishReport(LIVE_TOKEN, { ...ownerReport, status: 'OK' });
  assert.equal(outcome.status, 400);
  assert.equal(outcome.error, 'invalid_report');
  assert.equal(outcome.detail, 'invalid_status');
  assert.equal(reports.length, 0);
});

await check('an authorised publisher inserts exactly once', async () => {
  const first = await service.publishReport(LIVE_TOKEN, ownerReport);
  assert.equal(first.published.inserted, true);
  assert.equal(first.published.id, ownerReport.id);
  const second = await service.publishReport(LIVE_TOKEN, { ...ownerReport, summary: 'changed' });
  assert.equal(second.published.inserted, false);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].summary, 'Owner-only detail.');
});

await check('the raw credential never leaves the service', async () => {
  const outcome = await service.publishReport(LIVE_TOKEN, memberReport);
  assert.equal(outcome.published.inserted, true);
  assert.ok(!JSON.stringify(outcome).includes(LIVE_TOKEN));
  for (const call of calls) {
    assert.match(call.digest, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(call).includes(LIVE_TOKEN));
  }
});

await check('the digest helper matches SHA-256', async () => {
  assert.equal(
    publisherTokenDigest('abc'),
    crypto.createHash('sha256').update('abc', 'utf8').digest('hex'),
  );
  assert.equal(publisherTokenDigest('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\nFAIL: ${failed.length} of ${results.length} Portal publish checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nPASS: ${results.length} Portal publish checks hold.`);
}
