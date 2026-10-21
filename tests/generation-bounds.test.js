import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { neonConfig } from '@neondatabase/serverless';
import handler from '../api/artifact.js';
import { generateArtifact } from '../lib/artifact-generation.js';

const REQUEST_BYTES = 64 * 1024;
const ACTIVE_CLIENTS = 4096;
const HOUR = 3_600_000;
const normal = JSON.parse(fs.readFileSync(new URL('./fixtures/artifact-request-normal.json', import.meta.url), 'utf8'));
const artifact = {
  era: 'Synthetic public test', year: 1927, type: 'FORGOTTEN TECHNOLOGY',
  title: 'A Shared Signal', description: 'A synthetic discovery prompt, not a historical claim.',
  provenance: 'AI-curated fixture with no supplied source.', condition: 3,
  imagined_future: 'Groups inspect a shared signal.', problem: 'Signals arrive late.',
  status: 'TOO EARLY', modern_descendant: 'Shared status displays.',
  concepts: ['coordination', 'uncertainty'], question: 'Would the signal change a decision?',
  evidence_level: 'AI-CURATED', sources: [], relationships: [],
  experiment: { hypothesis: 'A shared signal helps.', method: 'Compare two paper task instructions.',
    success_signal: 'Fewer unclear steps.', failure_signal: 'No observable change.' },
  connections: [], lifecycle: [{ phase: 'EMERGED', year: 1927,
    description: 'A hypothetical beginning.', evidence_basis: 'AI-GENERATED-HYPOTHESIS' }],
  current_phase: 'EMERGED', recurrence_conditions: ['A repeated coordination problem.'],
  realization_signal: 'The group uses the shared signal.',
};
const completed = () => ({ status: 'completed',
  output: [{ content: [{ type: 'output_text', text: JSON.stringify(artifact) }] }] });
function rows(values) {
  const names = Object.keys(values[0] || {});
  return { ok: true, json: async () => ({
    fields: names.map(name => ({ name, dataTypeID: name === 'concepts' ? 3802 : name === 'year' ? 23 : 25 })),
    rows: values.map(value => names.map(name => value[name] == null ? null
      : name === 'concepts' ? JSON.stringify(value[name]) : String(value[name]))),
  }) };
}
async function fixture(run, { recent, status = 200 } = {}) {
  const previous = { key: process.env.OPENAI_API_KEY, database: process.env.DATABASE_URL,
    fetch: globalThis.fetch, databaseFetch: neonConfig.fetchFunction, now: Date.now,
    error: console.error, warn: console.warn };
  const state = { calls: [], queries: [], warnings: [], now: 1_000_000 };
  globalThis.__portalBuckets.clear();
  process.env.OPENAI_API_KEY = 'synthetic-provider-fixture-not-real';
  if (recent) process.env.DATABASE_URL = ['postgresql:', '//fixture:fixture@fixture.invalid/portal'].join('');
  else delete process.env.DATABASE_URL;
  Date.now = () => state.now;
  console.error = () => {};
  console.warn = (...values) => state.warnings.push(values);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses', 'only the local provider stub may be reached');
    state.calls.push({ body: options.body, signal: options.signal });
    return { ok: status === 200, status, json: async () => completed() };
  };
  neonConfig.fetchFunction = async (_url, options) => {
    const request = JSON.parse(options.body);
    state.queries.push(request.query);
    if (/select \* from artifacts/i.test(request.query)) return rows(recent || []);
    if (/^insert into artifacts/i.test(request.query)) return rows([]);
    throw new Error('Unexpected fixture query; external database access is forbidden');
  };
  try { await run(state); }
  finally {
    globalThis.__portalBuckets.clear();
    globalThis.fetch = previous.fetch;
    neonConfig.fetchFunction = previous.databaseFetch;
    Date.now = previous.now;
    console.error = previous.error; console.warn = previous.warn;
    for (const [name, value] of [['OPENAI_API_KEY', previous.key], ['DATABASE_URL', previous.database]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}
async function request(address = '2001:db8::1', method = 'POST', mode = 'wander') {
  const response = { statusCode: 200, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  await handler({ method, headers: { 'x-forwarded-for': address }, body: { mode } }, response);
  return response;
}
async function capture(context) {
  let body;
  await generateArtifact({ mode: 'wander', context, fetchImpl: async (_url, options) => {
    body = options.body;
    return { ok: true, status: 200, json: async () => completed() };
  } });
  return body;
}
async function rejectedBeforeProvider(context, code = 'input_budget_exceeded') {
  await fixture(async state => {
    await assert.rejects(generateArtifact({ mode: 'wander', context }),
      error => error.code === code && error.retryable === false && error.upstream !== true);
    assert.equal(state.calls.length, 0, 'rejected input must never reach provider transport');
    assert.equal(state.warnings.length, 0, 'rejected input must never trigger a paid retry');
  });
}

test('normal 6739-byte request is preserved byte-for-byte with the same model and output budget', async () => {
  const body = await capture(normal.context), parsed = JSON.parse(body);
  assert.equal(Buffer.byteLength(body, 'utf8'), normal.request_utf8_bytes);
  assert.equal(createHash('sha256').update(body).digest('hex'), normal.request_sha256);
  assert.equal(parsed.model, 'gpt-5.6-luna');
  assert.equal(parsed.max_output_tokens, 6000);
});

test('complete serialized request accepts exact byte boundary and rejects one byte over', async () => {
  const overhead = Buffer.byteLength(await capture(''), 'utf8');
  const body = await capture('x'.repeat(REQUEST_BYTES - overhead));
  assert.equal(Buffer.byteLength(body, 'utf8'), REQUEST_BYTES);
  await rejectedBeforeProvider('x'.repeat(REQUEST_BYTES - overhead + 1));
});

test('UTF8 multibyte content is bounded by bytes rather than JavaScript character count', async () => {
  await rejectedBeforeProvider('界'.repeat(22_000));
  await rejectedBeforeProvider('😀'.repeat(16_000));
});

test('JSON escaping expansion is included in the provider request budget', async () => {
  await rejectedBeforeProvider(String.fromCharCode(0).repeat(12_000));
  await rejectedBeforeProvider(String.fromCharCode(34, 92).repeat(16_000));
});

test('very large public context is rejected before provider or retry', async () => {
  await rejectedBeforeProvider('x'.repeat(2_000_000));
});

test('valid astral and combining Unicode are preserved without truncation or replacement', async () => {
  const context = '\nRECENT ARTIFACTS: 雪 😀 e\u0301 ' + '😀'.repeat(1000);
  const body = await capture(context);
  const input = JSON.parse(body).input;
  assert.ok(input.endsWith(context));
  assert.ok(input.isWellFormed());
  assert.equal(input.includes('\uFFFD'), false);
  assert.ok(Buffer.byteLength(body, 'utf8') <= REQUEST_BYTES);
});

test('unpaired Unicode surrogates are predictably rejected before provider', async () => {
  await rejectedBeforeProvider('before' + String.fromCharCode(0xd800) + 'after', 'input_invalid_unicode');
  await rejectedBeforeProvider(String.fromCharCode(0xdc00), 'input_invalid_unicode');
});

test('normal handler generation still succeeds and preserves public evidence controls', async () => fixture(async state => {
  const response = await request();
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.persistence, 'local');
  assert.equal(response.body.evidence_level, 'AI-CURATED');
  assert.deepEqual(response.body.sources, []);
  assert.equal(state.calls.length, 1);
  assert.ok(state.calls[0].signal instanceof AbortSignal);
  assert.match(response.headers['Cache-Control'], /no-store/);
}));

test('oversized stored context returns a safe 503 without provider calls or persistence', async () => fixture(async state => {
  const response = await request();
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'Archive context exceeds generation limits. Please try again later.' });
  assert.equal(state.calls.length, 0);
  assert.ok(state.queries.every(query => /^select\b/i.test(query)));
  assert.doesNotMatch(JSON.stringify(response.body), /private-fixture-marker/);
}, { recent: [{ id: 'fixture', year: 1927, title: 'private-fixture-marker' + 'x'.repeat(70_000), concepts: [] }] }));

test('malformed Unicode in stored public context also fails safely without provider calls', async () => fixture(async state => {
  const response = await request();
  assert.equal(response.statusCode, 503);
  assert.equal(state.calls.length, 0);
}, { recent: [{ id: 'fixture', year: 1927, title: 'before' + String.fromCharCode(0xd800) + 'after', concepts: [] }] }));

test('fixed-window client budget still permits twelve calls and resets only after an hour', async () => fixture(async state => {
  for (let i = 0; i < 12; i++) assert.equal((await request()).statusCode, 200);
  assert.equal((await request()).statusCode, 429);
  state.now += HOUR - 1;
  assert.equal((await request()).statusCode, 429);
  state.now += 1;
  assert.equal((await request()).statusCode, 200);
  assert.equal(state.calls.length, 13);
}));

test('expired inactive client buckets are reclaimed on the next request', async () => fixture(async state => {
  for (let i = 1; i <= 3; i++) assert.equal((await request('2001:db8::' + i)).statusCode, 200);
  state.now += HOUR;
  assert.equal((await request('2001:db8::4')).statusCode, 200);
  assert.equal(globalThis.__portalBuckets.size, 1);
}));

test('client keys have fixed memory size and do not retain the raw address header', async () => fixture(async () => {
  await request('2001:db8::1, a-second-forwarded-address');
  const keys = [...globalThis.__portalBuckets.keys()];
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^[a-f0-9]{64}$/);
}));

test('capacity rejects new addresses without evicting existing client budgets', async () => fixture(async state => {
  for (let i = 1; i <= ACTIVE_CLIENTS; i++)
    assert.equal((await request('2001:db8::' + i.toString(16))).statusCode, 200);
  assert.equal((await request('2001:db8::ffff')).statusCode, 429);
  assert.equal(globalThis.__portalBuckets.size, ACTIVE_CLIENTS);
  assert.equal(state.calls.length, ACTIVE_CLIENTS);
  for (let i = 1; i < 12; i++) assert.equal((await request('2001:db8::1')).statusCode, 200);
  assert.equal((await request('2001:db8::1')).statusCode, 429);
  state.now += HOUR;
  assert.equal((await request('2001:db8::ffff')).statusCode, 200);
  assert.equal(globalThis.__portalBuckets.size, 1);
}));

test('invalid methods and absent provider configuration consume no buckets or calls', async () => fixture(async state => {
  assert.equal((await request('fixture', 'GET')).statusCode, 405);
  delete process.env.OPENAI_API_KEY;
  assert.equal((await request()).statusCode, 503);
  assert.equal(globalThis.__portalBuckets.size, 0);
  assert.equal(state.calls.length, 0);
}));

test('valid input preserves at most two upstream attempts and identical retry bodies', async () => fixture(async state => {
  const bodies = [];
  const result = await generateArtifact({ mode: 'wander', context: normal.context, fetchImpl: async (_url, options) => {
    bodies.push(options.body);
    return { ok: true, status: 200, json: async () => bodies.length === 1
      ? { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } : completed() };
  } });
  assert.deepEqual(result, artifact);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(Buffer.byteLength(bodies[0], 'utf8'), 6739);
  assert.equal(state.warnings.length, 1);
}));

test('mode validation accepts documented values and falls back for inherited or non-string properties', async () => fixture(async state => {
  let sequence = 1;
  for (const mode of ['wander', 'arrived', 'failed', 'early', 'waiting', 'distant']) {
    const response = await request('mode-fixture-' + sequence++, 'POST', mode);
    assert.equal(response.statusCode, 200);
    assert.ok(JSON.parse(state.calls.at(-1).body).input.startsWith('CURATOR MODE: ' + mode.toUpperCase() + '\n'));
  }
  for (const mode of ['constructor', 'toString', '__proto__', 'unknown-mode', ['wander'], { mode: 'wander' }]) {
    const response = await request('mode-fixture-' + sequence++, 'POST', mode);
    assert.equal(response.statusCode, 200);
    assert.ok(JSON.parse(state.calls.at(-1).body).input.startsWith('CURATOR MODE: WANDER\n'));
  }
}));

test('persistent upstream failure still stops after exactly two attempts', async () => fixture(async state => {
  await assert.rejects(generateArtifact({ mode: 'wander', fetchImpl: async () => {
    state.calls.push({});
    return { ok: false, status: 500 };
  } }), error => error.code === 'upstream_500');
  assert.equal(state.calls.length, 2);
  assert.equal(state.warnings.length, 1);
}));
