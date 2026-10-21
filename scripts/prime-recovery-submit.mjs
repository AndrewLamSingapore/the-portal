/**
 * Portal private-surface browser contract.
 *
 * The local harness serves the exact deployment headers from vercel.json.
 * Same-origin private API calls are intercepted, so no password, recovery token
 * or private report leaves the machine. Every submit must produce either a
 * continuation or a visible, actionable outcome.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const TOKEN = 'synthetic-recovery-token-not-real';
const PASSWORD = 'synthetic-passphrase-not-real';
const PRIVATE_MARKER = 'SYNTHETIC-PRIVATE-REPORT-MARKER';
const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  'iphone-390x844': { width: 390, height: 844, isMobile: true, hasTouch: true },
};
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sourceMatcher(source) {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\(\\\.\\\*\\\)/g, '.*');
  return new RegExp(`^${escaped}$`);
}

const headerRules = (config.headers || []).map((rule) => ({
  pattern: sourceMatcher(rule.source),
  headers: rule.headers,
}));

function headersFor(pathname) {
  const merged = {};
  for (const rule of headerRules) {
    if (!rule.pattern.test(pathname)) continue;
    for (const header of rule.headers) merged[header.key] = header.value;
  }
  return merged;
}

function resolveFile(pathname) {
  const clean = decodeURIComponent(String(pathname).split('?')[0]);
  if (clean === '/' || clean === '') return 'index.html';
  const candidate = path.join(root, clean);
  if (candidate.startsWith(root) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return clean.slice(1);
  if (fs.existsSync(`${candidate}.html`)) return `${clean.slice(1)}.html`;
  return null;
}

async function startLocalServer() {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const file = resolveFile(pathname);
    if (!file) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    const headers = {
      ...headersFor(pathname),
      'Content-Type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream',
    };
    response.writeHead(200, headers);
    fs.createReadStream(path.join(root, file)).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

function browserExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (process.platform !== 'win32') return undefined;
  return [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find((candidate) => fs.existsSync(candidate));
}

const local = process.env.PRIME_BASE ? null : await startLocalServer();
const base = (process.env.PRIME_BASE || local.origin).replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });

function privatePayload(options) {
  return {
    identity: { display_name: 'Synthetic Owner', role: 'OWNER', person_key: 'synthetic' },
    reports: options.privateMarker
      ? [{ id: 'synthetic-report', objective: PRIVATE_MARKER, status: 'VERIFIED', visibility: 'OWNER', created_at: '2026-10-21T00:00:00Z' }]
      : [],
  };
}

async function openPage(viewport, options = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const seen = { consoleErrors: [], pageErrors: [], apiRequests: [] };
  let signedIn = false;
  page.on('console', (message) => {
    if (message.type() === 'error') seen.consoleErrors.push(message.text().slice(0, 300));
  });
  page.on('pageerror', (error) => seen.pageErrors.push(error.message.slice(0, 300)));

  await page.route(/\/api\/prime(?:\/|\?|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    seen.apiRequests.push(`${request.method()} ${url.pathname}`);
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    if (options.abortAll) return route.abort('failed');

    if (url.pathname === '/api/prime/reset-password') {
      if (options.reset === 'reject') return route.fulfill({ status: 422, contentType: 'application/json', body: '{"error":"auth_rejected"}' });
      if (options.reset === 'expired') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"auth_rejected"}' });
      if (options.reset === 'unavailable') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"auth_unavailable"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    if (url.pathname === '/api/prime/login') {
      if (!options.loginRejected) signedIn = true;
      return route.fulfill({ status: options.loginRejected ? 401 : 200, contentType: 'application/json', body: options.loginRejected ? '{"error":"auth_rejected"}' : '{"ok":true}' });
    }
    if (url.pathname === '/api/prime/logout') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    if (url.pathname === '/api/prime/report') {
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"report_not_found"}' });
    }
    if (url.pathname === '/api/prime') {
      if (options.prime === 'unavailable') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"synthetic"}' });
      if (options.prime === 'ready') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(privatePayload(options)) });
      if (options.prime === 'ready-after-login' && signedIn) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(privatePayload(options)) });
      if (options.prime === 'unmapped') return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"not_mapped"}' });
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"authentication_required"}' });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' });
  });
  return { context, page, seen };
}

const snapshot = (page) => page.evaluate(() => ({
  state: [...document.querySelectorAll('[data-state]')].find((node) => !node.hidden)?.dataset.state || null,
  error: (document.getElementById('recoveryError')?.textContent || '').trim(),
  status: (document.getElementById('recoveryStatus')?.textContent || '').trim(),
  search: location.search,
  hash: location.hash,
  newPassword: document.getElementById('newPassword')?.value ?? null,
  confirmPassword: document.getElementById('confirmPassword')?.value ?? null,
  storage: JSON.stringify(localStorage),
  ids: [...document.querySelectorAll('[id]')].map((node) => node.id),
  text: document.body.innerText.slice(0, 4000),
}));

async function openRecovery(page, from = '/prime') {
  const response = await page.goto(`${base}${from}?token=${TOKEN}`, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, `GET ${from} did not return HTTP 200`);
  await page.waitForSelector('#setPasswordForm', { state: 'visible', timeout: 10_000 });
  return response;
}

async function settle(page, context = 'submit') {
  await page.waitForFunction(() => {
    const state = [...document.querySelectorAll('[data-state]')].find((node) => !node.hidden)?.dataset.state;
    const error = (document.getElementById('recoveryError')?.textContent || '').trim();
    if (state && !['loading', 'recovery'].includes(state)) return true;
    return state === 'recovery' && error.length > 0;
  }, null, { timeout: 10_000 }).catch(() => {
    throw new Error(`${context}: the page produced no visible outcome`);
  });
  return snapshot(page);
}

async function submit(page, { password = PASSWORD, confirm = PASSWORD } = {}) {
  await page.fill('#newPassword', password);
  await page.fill('#confirmPassword', confirm);
  await page.click('#setPasswordForm button[type="submit"]');
  return settle(page);
}

function assertNoPrivatePersistence(view) {
  assert.ok(!view.storage.includes(PRIVATE_MARKER), 'private payloads must not be stored in localStorage');
  assert.equal(view.storage, '{}', 'the private client must not persist authentication material');
  assert.ok(!view.search.includes(TOKEN), 'recovery tokens must be removed from the URL');
  assert.ok(!view.text.includes(TOKEN), 'recovery tokens must never render');
}

const results = [];
async function scenario(name, viewportName, run, options = {}) {
  const { context, page, seen } = await openPage(VIEWPORTS[viewportName], options);
  try {
    await run(page, seen);
    results.push({ name, viewportName, ok: true });
    console.log(`ok   ${name} [${viewportName}]`);
  } catch (error) {
    results.push({ name, viewportName, ok: false, detail: error?.message });
    console.log(`FAIL ${name} [${viewportName}]: ${error?.message}`);
  } finally {
    await context.close();
  }
}

const bothViewports = Object.keys(VIEWPORTS);
for (const viewportName of bothViewports) {
  await scenario('a recovery link renders the set-password step and strips the token', viewportName, async (page, seen) => {
    const response = await openRecovery(page);
    assert.ok((response.headers()['content-security-policy'] || '').includes("connect-src 'self'"));
    const view = await snapshot(page);
    assert.equal(view.state, 'recovery');
    assert.equal(new Set(view.ids).size, view.ids.length);
    assertNoPrivatePersistence(view);
    assert.deepEqual(seen.pageErrors, []);
  });

  await scenario('mismatched passwords produce a visible message without an API call', viewportName, async (page, seen) => {
    await openRecovery(page);
    const view = await submit(page, { confirm: 'different-passphrase-not-real' });
    assert.match(view.error, /do not match/i);
    assert.equal(view.state, 'recovery');
    assert.deepEqual(seen.apiRequests.filter((entry) => entry.startsWith('POST')), []);
  });

  await scenario('a short password produces a visible message without an API call', viewportName, async (page, seen) => {
    await openRecovery(page);
    const view = await submit(page, { password: 'short', confirm: 'short' });
    assert.match(view.error, /at least 8 characters/i);
    assert.deepEqual(seen.apiRequests.filter((entry) => entry.startsWith('POST')), []);
  });

  await scenario('a successful reset continues into private operations exactly once', viewportName, async (page, seen) => {
    await openRecovery(page);
    await page.fill('#newPassword', PASSWORD);
    await page.fill('#confirmPassword', PASSWORD);
    await page.evaluate(() => {
      const button = document.querySelector('#setPasswordForm button[type="submit"]');
      button.click();
      button.click();
    });
    const view = await settle(page);
    assert.equal(view.state, 'ready');
    assert.match(view.status, /Password updated/i);
    assert.equal(view.newPassword, '');
    assert.equal(view.confirmPassword, '');
    assert.equal(seen.apiRequests.filter((entry) => entry === 'POST /api/prime/reset-password').length, 1);
    assertNoPrivatePersistence(view);
  }, { prime: 'ready' });

  await scenario('a rejected reset stays visible', viewportName, async (page) => {
    await openRecovery(page);
    const view = await submit(page);
    assert.match(view.error, /not accepted|too weak/i);
    assert.equal(view.state, 'recovery');
  }, { reset: 'reject' });

  await scenario('an expired reset stays visible', viewportName, async (page) => {
    await openRecovery(page);
    const view = await submit(page);
    assert.match(view.error, /no longer valid/i);
    assert.equal(view.state, 'recovery');
  }, { reset: 'expired' });

  await scenario('an unreachable API produces a visible message', viewportName, async (page) => {
    await openRecovery(page);
    const view = await submit(page);
    assert.match(view.error, /could not reach|temporarily unavailable/i);
    assert.equal(view.state, 'recovery');
  }, { abortAll: true });

  await scenario('sign out revokes the cookie session and hides private content', viewportName, async (page, seen) => {
    await page.goto(`${base}/prime`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-state="ready"]:not([hidden])', { timeout: 10_000 });
    await page.click('[data-state="ready"] [data-signout]');
    await page.waitForSelector('[data-state="anonymous"]:not([hidden])', { timeout: 10_000 });
    assert.ok(seen.apiRequests.includes('POST /api/prime/logout'));
    const view = await snapshot(page);
    assert.ok(!view.text.includes(PRIVATE_MARKER));
    assertNoPrivatePersistence(view);
  }, { prime: 'ready', privateMarker: true });

  await scenario('sign in uses the same-origin login route and restores private content', viewportName, async (page, seen) => {
    await page.goto(`${base}/prime`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-state="anonymous"]:not([hidden])');
    await page.fill('#email', 'owner@example.invalid');
    await page.fill('#password', PASSWORD);
    await page.click('#signInForm button[type="submit"]');
    await page.waitForSelector('[data-state="ready"]:not([hidden])', { timeout: 10_000 });
    assert.ok(seen.apiRequests.includes('POST /api/prime/login'));
    assert.ok(!JSON.stringify(seen.apiRequests).includes(PASSWORD));
  }, { prime: 'ready-after-login' });

  await scenario('a failed login stays visible without persisting credentials', viewportName, async (page) => {
    await page.goto(`${base}/prime`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-state="anonymous"]:not([hidden])');
    await page.fill('#email', 'owner@example.invalid');
    await page.fill('#password', PASSWORD);
    await page.click('#signInForm button[type="submit"]');
    await page.waitForFunction(() => (document.getElementById('signInError')?.textContent || '').includes('not accepted'));
    const view = await snapshot(page);
    assert.equal(view.state, 'anonymous');
    assert.equal(view.storage, '{}');
  }, { loginRejected: true });

  await scenario('anonymous private pages render and do not cache', viewportName, async (page) => {
    for (const privatePath of ['/prime', '/reports']) {
      const response = await page.goto(`${base}${privatePath}`, { waitUntil: 'domcontentloaded' });
      assert.equal(response?.status(), 200);
      assert.equal(response.headers()['cache-control'], 'private, no-store, max-age=0');
      assert.equal(response.headers()['x-robots-tag'], 'noindex, nofollow');
      await page.waitForSelector('[data-state="anonymous"]:not([hidden])');
    }
  });
}

await scenario('the private pages declare no duplicate element ids', 'desktop', async (page) => {
  for (const privatePath of ['/prime', '/reports']) {
    await page.goto(`${base}${privatePath}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('[data-state]:not([hidden])')));
    const view = await snapshot(page);
    assert.equal(new Set(view.ids).size, view.ids.length);
  }
});

await scenario('the public Portal still loads unchanged', 'desktop', async (page, seen) => {
  const response = await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200);
  assert.match(await page.title(), /PORTAL/i);
  assert.deepEqual(seen.pageErrors, []);
  assert.equal((await snapshot(page)).state, null);
});

await browser.close();
if (local) await new Promise((resolve) => local.server.close(resolve));

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\nFAIL: ${failed.length} of ${results.length} Portal private-surface checks failed (base ${base}).`);
  process.exitCode = 1;
} else {
  console.log(`\nPASS: ${results.length} Portal private-surface checks satisfied the two-outcome rule (base ${base}).`);
}
