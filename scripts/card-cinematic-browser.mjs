/**
 * Fresh card links must be usable before any first-visit opening animation.
 * Real client/assets + deployment headers, local deterministic API fixtures.
 * Fresh browser contexts have no seeded storage; all writes/external requests
 * are blocked. No generation, account, message, or production calls occur.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.PORTAL_CARD_INTRO_REPORT_DIR || path.join(tmpdir(), 'portal-card-intro');
const artifact = {
  id: 'cinematic-regression-card',
  title: 'A Shared Signal',
  year: '1974',
  status: 'EXPLORING',
  persistence: 'ARCHIVE',
  evidence_level: 'AI-CURATED',
  description: 'A synthetic card used only to verify public navigation.',
  imagined_future: 'A shared signal arrives before a decision.',
  problem: 'Signals arrive late.',
  modern_descendant: 'Shared status displays.',
  concepts: ['coordination'],
  unresolved_question: 'Would an earlier signal change a decision?',
  sources: [], relationships: [], connections: [], lifecycle: [], recurrence_conditions: [],
};
const graph = { nodes: [artifact], edges: [] };
const config = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const securityHeaders = Object.fromEntries(
  config.headers.find(rule => rule.source === '/(.*)').headers.map(({ key, value }) => [key, value]),
);
assert.ok(securityHeaders['Content-Security-Policy'], 'test must send the deployment CSP');
const contentTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
};
const requests = [];
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  requests.push({ method: request.method, pathname: url.pathname });
  const json = (body, status = 200) => {
    response.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
  };
  if (request.method !== 'GET') return json({ error: 'writes prohibited in navigation fixture' }, 405);
  if (url.pathname === '/api/archive') return json({ artifacts: [artifact], count: 1, temporal_graph: graph });
  if (url.pathname === '/api/graph') return json(graph);
  if (url.pathname === '/api/health') return json({ ok: true, product_version: '6.5.0' });
  if (url.pathname === '/api/trial') return json({ counts: { FAILED: 0, TOO_EARLY: 0, ARRIVED_QUIETLY: 0 } });
  if (url.pathname.startsWith('/api/')) return json({ error: 'unexpected fixture endpoint' }, 404);
  const relative = url.pathname === '/' || url.pathname.startsWith('/card/') ? 'index.html' : url.pathname.slice(1);
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) return json({ error: 'invalid path' }, 400);
  try {
    if (!statSync(target).isFile()) throw new Error('not a file');
    response.writeHead(200, {
      ...securityHeaders, 'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(readFileSync(target));
  } catch {
    json({ error: 'not found' }, 404);
  }
});

mkdirSync(output, { recursive: true });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const edge = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const results = [], observedStates = [], blockedRequests = [], runtimeErrors = [];
const check = async (name, body) => {
  try {
    await body();
    results.push({ name, status: 'PASS' });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, status: 'FAIL', error: String(error.message).split('\n').slice(0, 6).join('\n') });
    console.log('FAIL ' + name + ': ' + String(error.message).split('\n')[0]);
  }
};
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(edge ? { executablePath: edge } : {}) });
  async function freshPage(viewport) {
    const context = await browser.newContext({ viewport, reducedMotion: 'no-preference', serviceWorkers: 'block' });
    assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
    await context.route('**/*', route => {
      const request = route.request();
      if (request.method() !== 'GET' || new URL(request.url()).origin !== base) {
        blockedRequests.push({ method: request.method(), url: request.url() });
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => runtimeErrors.push(error.message));
    return { context, page };
  }
  for (const [device, viewport] of Object.entries({
    desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 },
  })) {
    for (const [form, route] of [
      ['path', '/card/' + artifact.id], ['query', '/?card=' + artifact.id],
    ]) {
      const label = device + ' ' + form + ' fresh card link';
      const { context, page } = await freshPage(viewport);
      try {
        await page.goto(base + route, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.getElementById('drawer').classList.contains('open'), null, { timeout: 6000 });
        const state = await page.evaluate(() => ({
          introHidden: document.getElementById('portalCinematic').hidden,
          introActive: document.getElementById('portalCinematic').classList.contains('is-active'),
          bodyLocked: document.body.classList.contains('cinematic-locked'),
          seen: sessionStorage.getItem('portal-cinematic-seen'),
          title: document.getElementById('drawerTitle').textContent.trim(),
        }));
        observedStates.push({ label, ...state });
        await check(label + ' opens the intended card', () => assert.equal(state.title, artifact.title));
        await check(label + ' bypasses automatic intro without seeding storage', () => {
          assert.equal(state.introHidden, true);
          assert.equal(state.introActive, false);
          assert.equal(state.bodyLocked, false);
          assert.equal(state.seen, null);
        });
        await page.screenshot({ path: path.join(output, device + '-' + form + '.png') });
        await check(label + ' supports immediate pointer copy and close', async () => {
          await page.locator('#copyCardLink').click({ timeout: 1500 });
          await page.waitForFunction(() => /Link copied|Copy this link/.test(document.getElementById('copyCardState').textContent), null, { timeout: 1500 });
          await page.locator('#closeDrawer').click({ timeout: 1500 });
          assert.equal(await page.locator('#drawer').evaluate(node => node.classList.contains('open')), false);
          assert.equal(page.url(), base + '/');
        });
      } finally {
        await context.close();
      }
    }
    const { context, page } = await freshPage(viewport);
    try {
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#grid .card', { timeout: 6000 });
      await check(device + ' fresh homepage preserves opening and pointer skip', async () => {
        assert.equal(await page.locator('#portalCinematic').evaluate(node => node.hidden), false);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('portal-cinematic-seen')), null);
        await page.locator('#cinematicSkip').click({ timeout: 1500 });
        await page.waitForFunction(() => document.getElementById('portalCinematic').hidden, null, { timeout: 1800 });
        assert.equal(await page.evaluate(() => sessionStorage.getItem('portal-cinematic-seen')), '1');
      });
      await check(device + ' homepage session still suppresses repeat intro and supports replay', async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#grid .card');
        assert.equal(await page.locator('#portalCinematic').evaluate(node => node.hidden), true);
        await page.locator('#cinematicReplay').click({ timeout: 1500 });
        await page.waitForSelector('#portalCinematic.is-active');
        await page.locator('#cinematicSkip').click({ timeout: 1500 });
        await page.waitForFunction(() => document.getElementById('portalCinematic').hidden, null, { timeout: 1800 });
      });
    } finally {
      await context.close();
    }
  }
  await check('navigation makes only local GET requests', () => {
    assert.deepEqual(blockedRequests, []);
    assert.ok(requests.some(request => request.pathname === '/api/archive'));
    assert.ok(requests.every(request => request.method === 'GET'));
  });
  await check('no client runtime errors', () => assert.deepEqual(runtimeErrors, []));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  const report = {
    status: results.length && results.every(result => result.status === 'PASS') ? 'PASS' : 'FAIL',
    fixtureOnly: true, seededStorage: false, productionCalls: 0, results, observedStates,
    blockedRequests, runtimeErrors, requests,
  };
  writeFileSync(path.join(output, 'card-cinematic-report.json'), JSON.stringify(report, null, 2));
}
process.exitCode = results.length && results.every(result => result.status === 'PASS') ? 0 : 1;
