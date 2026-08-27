import assert from 'node:assert/strict';

const base = (process.env.PORTAL_URL || 'https://the-portal-ten.vercel.app').replace(/\/$/, '');
async function get(path) {
  const response = await fetch(base + path, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15_000) });
  return { response, json: () => response.json(), text: () => response.text() };
}

const home = await get('/');
assert.equal(home.response.status, 200);
const html = await home.text();
for (const token of ['THE CONTINUOUS FUTURES MODEL', 'CREATE AN ENCOUNTER', 'MAXIMIZE SERENDIPITY', 'Questions over manufactured certainty']) {
  assert.ok(html.includes(token));
}
const archiveResponse = await get('/api/archive?limit=60');
assert.equal(archiveResponse.response.status, 200);
const archive = await archiveResponse.json();
assert.ok(Array.isArray(archive.temporal_graph?.nodes));
assert.ok(Array.isArray(archive.exhibitions));
assert.ok(archive.artifacts.length > 0);
const serendipityResponse = await get('/api/serendipity?from=' + encodeURIComponent(archive.artifacts[0].id));
assert.equal(serendipityResponse.response.status, 200);
const serendipity = await serendipityResponse.json();
assert.ok(serendipity.id && serendipity.id !== archive.artifacts[0].id);
console.log('PASS: Portal living knowledge graph production experience verified.');
