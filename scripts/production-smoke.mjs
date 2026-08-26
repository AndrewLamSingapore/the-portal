import assert from 'node:assert/strict';

const base = (process.env.PORTAL_URL || 'https://the-portal-ten.vercel.app').replace(/\/$/, '');
const timeout = Number(process.env.SMOKE_TIMEOUT_MS || 15_000);
const deployTimeout = Number(process.env.DEPLOY_TIMEOUT_MS || 240_000);

async function get(path) {
  const response = await fetch(base + path, {
    headers: { 'user-agent': 'portal-smoke/5.1', 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(timeout)
  });
  return { response, text: await response.text() };
}

function json(result, path) {
  try {
    return JSON.parse(result.text);
  } catch {
    assert.fail(`${path} did not return JSON`);
  }
}

async function waitForDeployment() {
  const deadline = Date.now() + deployTimeout;
  let lastState = 'not reachable';
  while (Date.now() < deadline) {
    try {
      const result = await get('/api/health');
      const health = json(result, '/api/health');
      lastState = `HTTP ${result.response.status}, revision ${health.revision || 'unknown'}`;
      const revisionReady = !process.env.EXPECTED_REVISION || health.revision === process.env.EXPECTED_REVISION;
      if (result.response.status === 200 && health.ok === true && revisionReady) return;
    } catch (error) {
      lastState = error?.message || String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 10_000));
  }
  assert.fail(`deployment did not become ready within ${deployTimeout}ms (${lastState})`);
}

await waitForDeployment();

const home = await get('/');
assert.equal(home.response.status, 200);
for (const token of ['<title>THE PORTAL · Living Knowledge System</title>', 'id="curatorForm"', 'id="graph"', 'id="lenses"', 'id="experiments"', 'id="evolution"', 'id="cabinetGrid"', '/motion.css', '/motion.js']) {
  assert.ok(home.text.includes(token), `homepage missing ${token}`);
}
assert.equal(home.response.headers.get('x-frame-options'), 'DENY');
assert.match(home.response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);

const [appResult, styleResult, motionStyleResult, motionResult, versionResult, healthResult, statusResult, readinessResult, manifestResult] = await Promise.all([
  get('/app.js'),
  get('/styles.css'),
  get('/motion.css'),
  get('/motion.js'),
  get('/api/version'),
  get('/api/health'),
  get('/api/status'),
  get('/api/readiness'),
  get('/api/manifest')
]);
assert.equal(appResult.response.status, 200);
assert.match(appResult.text, /POST/);
assert.match(appResult.text, /portal-cabinet-v4/);
assert.equal(styleResult.response.status, 200);
assert.match(styleResult.text, /prefers-reduced-motion/);
assert.equal(motionStyleResult.response.status, 200);
assert.match(motionStyleResult.text, /portalOrbit/);
assert.equal(motionResult.response.status, 200);
assert.match(motionResult.text, /IntersectionObserver/);

const version = json(versionResult, '/api/version');
assert.equal(versionResult.response.status, 200);
assert.equal(version.product, 'The Portal');
assert.equal(version.version, '5.1.0');
assert.equal(version.schema_version, 5);
assert.equal(version.experience, 'Living Knowledge System');

const health = json(healthResult, '/api/health');
assert.equal(healthResult.response.status, 200);
assert.equal(health.ok, true);
assert.equal(health.database, true);
assert.equal(health.archive, true);
assert.equal(health.generation_configured, true);
assert.equal(health.evidence_schema, true);
assert.equal(health.schema_version, 5);
assert.equal(health.product_version, '5.1.0');
if (process.env.EXPECTED_REVISION) assert.equal(health.revision, process.env.EXPECTED_REVISION);

const status = json(statusResult, '/api/status');
assert.equal(statusResult.response.status, 200);
assert.equal(status.status, 'OPERATIONAL');
assert.equal(status.product_version, '5.1.0');
const readiness = json(readinessResult, '/api/readiness');
assert.equal(readinessResult.response.status, 200);
assert.equal(readiness.ok, true);
const manifest = json(manifestResult, '/api/manifest');
assert.equal(manifestResult.response.status, 200);
assert.equal(manifest.experience, 'Living Knowledge System');

const archiveResult = await get('/api/archive?limit=5');
const archive = json(archiveResult, '/api/archive');
assert.equal(archiveResult.response.status, 200);
assert.ok(archive.artifacts.length > 0);
assert.ok(Array.isArray(archive.temporal_graph?.nodes));
assert.ok(Array.isArray(archive.exhibitions));
const first = archive.artifacts[0];
assert.match(first.id, /^PTL-\d{4}-[A-F0-9]{10}$/);

const [artifactResult, graphResult, serendipityResult, historicalResult] = await Promise.all([
  get('/api/archive?id=' + encodeURIComponent(first.id)),
  get('/api/graph'),
  get('/api/serendipity?from=' + encodeURIComponent(first.id)),
  get('/api/v2')
]);
const artifact = json(artifactResult, '/api/archive?id');
assert.equal(artifactResult.response.status, 200);
assert.equal(artifact.id, first.id);
const graph = json(graphResult, '/api/graph');
assert.equal(graphResult.response.status, 200);
assert.ok(Array.isArray(graph.nodes));
assert.ok(Array.isArray(graph.edges));
const serendipity = json(serendipityResult, '/api/serendipity');
assert.equal(serendipityResult.response.status, 200);
assert.ok(serendipity.id && serendipity.id !== first.id);
assert.equal(historicalResult.response.status, 200);
assert.match(historicalResult.text, /Evidence &amp; Ancestry|Evidence & Ancestry/);

assert.ok(archive.evolution && Array.isArray(archive.evolution.events));
console.log(`PASS: Portal 5.1 production verified end to end (${archive.count} objects, revision ${health.revision || 'unknown'}).`);
