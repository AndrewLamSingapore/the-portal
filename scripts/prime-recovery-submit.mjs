/**
 * PRIME password-recovery submit coverage.
 *
 * The owner's iPhone proved that a fresh recovery link reached production, that
 * PRIME rendered "Set a new password", and that tapping "Save password and
 * continue" then did nothing at all. The cause was not the link, the password or
 * the identity mapping: the deployment's Content Security Policy said
 * `connect-src 'self'`, the browser refused the Supabase Auth request, and the
 * rejected promise had nowhere to report itself.
 *
 * This suite serves the repository with the headers the deployment actually
 * sends (parsed straight out of vercel.json) and drives the real page in a real
 * browser. Supabase and /api/prime are intercepted, so no credential, token or
 * password ever leaves the machine. The one invariant every scenario checks is
 * the owner's requirement: a submit always ends in either a continuation or a
 * visible, actionable message - never silence.
 *
 * Run it against the working copy (default) or against a deployed base with
 * PRIME_BASE=https://the-portal-ten.vercel.app.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const SUPABASE_ORIGIN = 'https://vtrfgckzpjgtmqsnumur.supabase.co';

// Synthetic values only. Nothing here is, or resembles, a real credential.
const SYNTHETIC_TOKEN = 'synthetic-recovery-token-not-real';
const SYNTHETIC_PASSWORD = 'synthetic-passphrase-not-real';
const PRIVATE_MARKER = 'SYNTHETIC-PRIVATE-REPORT-MARKER';
const REDACT = (value) => String(value).split(SYNTHETIC_TOKEN).join('[redacted]');

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  'iphone-390x844': { width: 390, height: 844 },
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

/** Turns a vercel.json `source` into a matcher, keeping `(.*)` wildcards. */
function sourceMatcher(source) {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\(\\\.\\\*\\\)/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/** The deployed header rules, in the order vercel.json applies them. */
const headerRules = (config.headers || []).map((rule) => ({
  pattern: sourceMatcher(rule.source),
  headers: rule.headers,
}));
// A matcher that quietly stops matching would make every security assertion
// below vacuous, so prove the harness reaches the deployment's own policy.
assert.ok(
  headersFor('/prime')['Content-Security-Policy'],
  'the local harness must apply the deployment Content-Security-Policy to /prime',
);
assert.ok(
  headersFor('/')['Strict-Transport-Security'],
  'the local harness must apply the deployment headers to the public Portal',
);

function headersFor(pathname) {
  const merged = {};
  for (const rule of headerRules) {
    if (!rule.pattern.test(pathname)) continue;
    for (const header of rule.headers) merged[header.key] = header.value;
  }
  return merged;
}

/** Resolves a clean URL the way the deployment does. */
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
    const headers = { ...headersFor(pathname), 'Content-Type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream' };
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
const recoveryFragment = `#access_token=${SYNTHETIC_TOKEN}&refresh_token=${SYNTHETIC_TOKEN}&expires_in=3600&token_type=bearer&type=recovery`;

const browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });

/** Opens a page with the identity service and the PRIME API under test control. */
async function openPage(viewport, options = {}) {
  const context = await browser.newContext({
    viewport,
    ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}),
  });
  const page = await context.newPage();
  const seen = { consoleErrors: [], pageErrors: [], authRequests: [], primeRequests: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') seen.consoleErrors.push(REDACT(message.text()).slice(0, 200));
  });
  page.on('pageerror', (error) => seen.pageErrors.push(REDACT(error.message).slice(0, 200)));

  await context.route(new RegExp(`^${SUPABASE_ORIGIN.replace(/\./g, '\\.')}/`), async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    seen.authRequests.push(`${route.request().method()} ${pathname}`);
    if (pathname === '/auth/v1/token') {
      // Refresh behaviour is decided here so expiry can be exercised deterministically.
      if (options.refresh === 'reject') {
        return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_grant"}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'synthetic-refreshed-token', refresh_token: SYNTHETIC_TOKEN, expires_at: Math.floor(Date.now() / 1000) + 3600 }),
      });
    }
    if (options.identity === 'abort') return route.abort('failed');
    if (typeof options.identity === 'number') {
      return route.fulfill({ status: options.identity, contentType: 'application/json', body: '{"error":"synthetic"}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"synthetic-user"}' });
  });
  await context.route(/\/api\/prime(\/|\?|$)/, async (route) => {
    seen.primeRequests.push(new URL(route.request().url()).pathname);
    if (options.primeDelayMs) await new Promise((resolve) => setTimeout(resolve, options.primeDelayMs));
    if (options.prime === 'unavailable') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"synthetic"}' });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        identity: { display_name: 'Synthetic Owner', role: 'OWNER', person_key: 'synthetic' },
        reports: options.privateMarker
          ? [{ id: 'synthetic-report', objective: PRIVATE_MARKER, status: 'VERIFIED', visibility: 'OWNER', created_at: '2026-09-22T00:00:00Z' }]
          : [],
      }),
    });
  });
  return { context, page, seen };
}

const snapshot = (page) => page.evaluate(() => ({
  state: [...document.querySelectorAll('[data-state]')].find((node) => !node.hidden)?.dataset.state || null,
  error: (document.getElementById('recoveryError')?.textContent || '').trim(),
  status: (document.getElementById('recoveryStatus')?.textContent || '').trim(),
  hash: location.hash,
  newPassword: document.getElementById('newPassword')?.value ?? null,
  confirmPassword: document.getElementById('confirmPassword')?.value ?? null,
  session: localStorage.getItem('portal-prime-session-v1'),
  ids: [...document.querySelectorAll('[id]')].map((node) => node.id),
  text: document.body.innerText.slice(0, 4000),
}));

async function openRecovery(page, from = '/prime') {
  const response = await page.goto(`${base}${from}${recoveryFragment}`, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, `GET ${from} did not return HTTP 200`);
  return response;
}

function assertPolicyAllowsIdentity(response, label) {
  const policy = response?.headers()?.['content-security-policy'] || '';
  assert.ok(
    policy.includes(SUPABASE_ORIGIN),
    `${label}: the deployment policy must allow the identity origin, otherwise every submit is a silent no-op (connect-src: ${policy})`,
  );
}

/**
 * Waits for a terminal outcome and fails loudly if the page stays silent.
 * This is the assertion the owner's iPhone failed.
 */
async function settle(page, context = 'submit') {
  await page.waitForFunction(() => {
    const state = [...document.querySelectorAll('[data-state]')].find((node) => !node.hidden)?.dataset.state;
    const error = (document.getElementById('recoveryError')?.textContent || '').trim();
    if (state && !['loading', 'recovery'].includes(state)) return true;
    return state === 'recovery' && error.length > 0;
  }, null, { timeout: 10_000 }).catch(() => {
    throw new Error(`${context}: the page produced no visible outcome (silent no-op)`);
  });
  return snapshot(page);
}

async function submit(page, { password = SYNTHETIC_PASSWORD, confirm = SYNTHETIC_PASSWORD } = {}) {
  await page.fill('#newPassword', password);
  await page.fill('#confirmPassword', confirm);
  await page.click('#setPasswordForm button[type="submit"]');
  return settle(page);
}

function assertSessionKeptSecret(view, seen) {
  assert.ok(!view.hash.includes('access_token'), 'auth material must not stay in the address bar');
  const leaks = [...seen.consoleErrors, ...seen.pageErrors].filter((entry) => entry.includes(SYNTHETIC_TOKEN));
  assert.equal(leaks.length, 0, 'no console output may contain recovery material');
  assert.ok(!view.text.includes(SYNTHETIC_TOKEN), 'no recovery material may be rendered into the page');
}

const results = [];
async function scenario(name, viewportName, run, options = {}) {
  const viewport = VIEWPORTS[viewportName];
  const { context, page, seen } = await openPage(viewport, options);
  try {
    await run(page, seen, context);
    results.push({ name, viewportName, ok: true });
    console.log(`ok   ${name} [${viewportName}]`);
  } catch (error) {
    results.push({ name, viewportName, ok: false, detail: REDACT(error?.message || error) });
    console.log(`FAIL ${name} [${viewportName}]: ${REDACT(error?.message || error)}`);
  } finally {
    await context.close();
  }
}

/**
 * Seeds a browser-only session the way a real visit would have left one. The
 * guard lives in sessionStorage so a reload does not silently re-seed the
 * session a test explicitly signed out of.
 */
async function seedSession(context, session) {
  await context.addInitScript((value) => {
    if (window.sessionStorage.getItem('prime-session-seeded')) return;
    window.sessionStorage.setItem('prime-session-seeded', '1');
    window.localStorage.setItem('portal-prime-session-v1', JSON.stringify(value));
  }, session);
}

const liveSession = (overrides = {}) => ({
  access_token: SYNTHETIC_TOKEN,
  refresh_token: SYNTHETIC_TOKEN,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  ...overrides,
});

const bothViewports = Object.keys(VIEWPORTS);

for (const viewportName of bothViewports) {
  await scenario('a recovery link renders the set-password step and keeps it out of the URL', viewportName, async (page, seen) => {
    const response = await openRecovery(page);
    assertPolicyAllowsIdentity(response, 'recovery render');
    await page.waitForSelector('#setPasswordForm', { state: 'visible', timeout: 10_000 });
    const view = await snapshot(page);
    assert.equal(view.state, 'recovery', 'the set-password step must be the visible state');
    assert.equal(view.hash, '', 'the recovery fragment must be removed from the address bar');
    const stored = JSON.parse(view.session || 'null');
    assert.equal(stored?.recovery, true, 'the pending recovery session is stored for the set-password step');
    assert.equal(new Set(view.ids).size, view.ids.length, `duplicate element ids on /prime: ${view.ids.join(', ')}`);
    assert.equal(seen.pageErrors.length, 0, `page errors: ${seen.pageErrors.join('; ')}`);
    assertSessionKeptSecret(view, seen);
  });

  await scenario('mismatched passwords produce a visible message', viewportName, async (page, seen) => {
    await openRecovery(page);
    await page.waitForSelector('#setPasswordForm', { state: 'visible' });
    const view = await submit(page, { confirm: 'different-passphrase-not-real' });
    assert.match(view.error, /do not match/i, 'a mismatch must be reported in plain language');
    assert.equal(view.state, 'recovery', 'a mismatch must not advance');
    assert.deepEqual(seen.authRequests, [], 'a mismatch must not reach the identity service');
    assertSessionKeptSecret(view, seen);
  });

  await scenario('a short password produces a visible message', viewportName, async (page, seen) => {
    await openRecovery(page);
    await page.waitForSelector('#setPasswordForm', { state: 'visible' });
    const view = await submit(page, { password: 'short', confirm: 'short' });
    assert.match(view.error, /at least 8 characters/i);
    assert.deepEqual(seen.authRequests, [], 'a rejected password must not reach the identity service');
    assertSessionKeptSecret(view, seen);
  });

  await scenario('a successful submit updates the password and continues into private operations', viewportName, async (page, seen) => {
    await openRecovery(page);
    await page.waitForSelector('#setPasswordForm', { state: 'visible' });
    const view = await submit(page);
    assert.deepEqual(seen.authRequests, ['PUT /auth/v1/user'], 'the update must reach the identity service exactly once');
    assert.equal(view.state, 'ready', `a successful submit must continue, saw ${view.state} (${view.error})`);
    assert.match(view.status, /Password updated/i);
    assert.equal(view.newPassword, '', 'the password field is cleared after a successful update');
    assert.equal(view.confirmPassword, '', 'the confirmation field is cleared after a successful update');
    assert.equal(JSON.parse(view.session || 'null')?.recovery, false, 'the pending recovery marker is cleared');
    assert.equal(view.hash, '', 'no auth material in the address bar');
    assert.deepEqual(seen.pageErrors, [], `page errors: ${seen.pageErrors.join('; ')}`);
    assertSessionKeptSecret(view, seen);
  });

  await scenario('a rejected weak password produces a visible message', viewportName, async (page, seen) => {
    await openRecovery(page);
    await page.waitForSelector('#setPasswordForm', { state: 'visible' });
    const view = await submit(page);
    assert.match(view.error, /too weak|used before/i);
    assert.equal(view.state, 'recovery', 'a rejected password must stay on the set-password step');
    assertSessionKeptSecret(view, seen);
  }, { identity: 422 });

  await scenario('an expired recovery session produces a visible message', viewportName, async (page, seen) => {
    await openRecovery(page);
    await page.waitForSelector('#setPasswordForm', { state: 'visible' });
    const view = await submit(page);
    assert.match(view.error, /no longer valid/i);
    assert.equal(view.session, null, 'an expired recovery session must not be kept');
    assertSessionKeptSecret(view, seen);
  }, { identity: 401 });

  await scenario('an unreachable identity service produces a visible message', viewportName, async (page, seen) => {
    await openRecovery(page);
    await page.waitForSelector('#setPasswordForm', { state: 'visible' });
    const view = await submit(page);
    assert.match(view.error, /could not reach/i, 'a blocked request must still explain itself');
    assert.equal(view.state, 'recovery', 'a blocked request must not advance');
    assertSessionKeptSecret(view, seen);
  }, { identity: 'abort' });

  await scenario('an update that the private API then refuses still lands somewhere visible', viewportName, async (page, seen) => {
    await openRecovery(page);
    await page.waitForSelector('#setPasswordForm', { state: 'visible' });
    const view = await submit(page);
    assert.deepEqual(seen.authRequests, ['PUT /auth/v1/user']);
    assert.equal(view.state, 'unavailable', 'a failed private read must render its own state, not silence');
    assert.deepEqual(seen.pageErrors, [], `page errors: ${seen.pageErrors.join('; ')}`);
    assertSessionKeptSecret(view, seen);
  }, { prime: 'unavailable' });

  await scenario('the Sign out button in the ready state actually signs out', viewportName, async (page, seen) => {
    await openRecovery(page);
    await page.waitForSelector('#setPasswordForm', { state: 'visible' });
    const view = await submit(page);
    assert.equal(view.state, 'ready');
    await page.click('[data-state="ready"] [data-signout]');
    await page.waitForFunction(() => {
      const state = [...document.querySelectorAll('[data-state]')].find((node) => !node.hidden)?.dataset.state;
      return state === 'anonymous';
    }, null, { timeout: 10_000 }).catch(() => { throw new Error('sign out produced no visible outcome'); });
    const after = await snapshot(page);
    assert.equal(after.session, null, 'signing out must clear the stored session');
    assert.deepEqual(seen.pageErrors, [], `page errors: ${seen.pageErrors.join('; ')}`);
    assertSessionKeptSecret(after, seen);
  });

  await scenario('a recovery link opened on /reports hands the session to the set-password step', viewportName, async (page, seen) => {
    await openRecovery(page, '/reports');
    await page.waitForSelector('#setPasswordForm', { state: 'visible', timeout: 10_000 });
    assert.match(new URL(page.url()).pathname, /^\/prime$/, 'the session must be handed to /prime');
    const view = await snapshot(page);
    assert.equal(view.state, 'recovery');
    assert.equal(view.hash, '', 'the fragment is consumed before the hand-over');
    assertSessionKeptSecret(view, seen);
  });

  await scenario('recovery material PRIME cannot consume is explained, not ignored', viewportName, async (page, seen) => {
    const response = await page.goto(`${base}/prime?code=synthetic-code-not-real&error=access_denied`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await page.waitForSelector('#setPasswordForm', { state: 'visible', timeout: 10_000 });
    const view = await snapshot(page);
    assert.equal(view.state, 'recovery');
    assert.match(view.error, /request a new one/i, 'an unusable link must explain itself');
    assert.equal(new URL(page.url()).search, '', 'the unusable link material is removed from the address bar');
    assert.deepEqual(seen.pageErrors, [], `page errors: ${seen.pageErrors.join('; ')}`);
  });

  await scenario('the private pages load cleanly for an anonymous visitor', viewportName, async (page, seen) => {
    for (const privatePath of ['/prime', '/reports']) {
      const response = await page.goto(`${base}${privatePath}`, { waitUntil: 'domcontentloaded' });
      assert.equal(response?.status(), 200, `${privatePath} did not return HTTP 200`);
      await page.waitForFunction(() => Boolean(document.querySelector('[data-state]:not([hidden])')), null, { timeout: 10_000 });
    }
    assert.deepEqual(seen.consoleErrors, [], `console errors (a blocked script, stylesheet or request would appear here): ${seen.consoleErrors.join('; ')}`);
    assert.deepEqual(seen.pageErrors, [], `page errors: ${seen.pageErrors.join('; ')}`);
  });

  await scenario('the private pages are uncacheable and noindex', viewportName, async (page) => {
    for (const privatePath of ['/prime', '/reports']) {
      const response = await page.goto(`${base}${privatePath}`, { waitUntil: 'domcontentloaded' });
      assert.equal(response.headers()['cache-control'], 'private, no-store, max-age=0', `${privatePath} must be uncacheable`);
      assert.equal(response.headers()['x-robots-tag'], 'noindex, nofollow', `${privatePath} must forbid indexing`);
      assert.notEqual(
        response.headers()['access-control-allow-origin'],
        '*',
        `${privatePath} must not advertise wildcard CORS`,
      );
    }
  });

  await scenario('a stored session is restored and private data never flashes before the server answers', viewportName, async (page, seen, context) => {
    await seedSession(context, liveSession());
    await page.goto(`${base}/prime`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const state = [...document.querySelectorAll('[data-state]')].find((node) => !node.hidden)?.dataset.state;
      return state === 'loading' || state === 'ready';
    }, null, { timeout: 10_000 });
    const during = await snapshot(page);
    assert.equal(during.state, 'loading', 'nothing may be announced before the server has answered');
    assert.ok(!during.text.includes(PRIVATE_MARKER), 'no private payload may render before authorization completes');
    await page.waitForSelector('[data-state="ready"]:not([hidden])', { timeout: 10_000 });
    const after = await snapshot(page);
    assert.ok(after.text.includes(PRIVATE_MARKER), 'a stored session must restore into the private surface');
    assert.ok(seen.primeRequests.length >= 1, 'the restore must be authorised by the server, not by the client');
    assertSessionKeptSecret(after, seen);
  }, { primeDelayMs: 1200, privateMarker: true });

  await scenario('an unusable refresh token signs the visitor out instead of hanging', viewportName, async (page, seen, context) => {
    await seedSession(context, liveSession({ access_token: 'expired-token-synthetic', expires_at: 1 }));
    await page.goto(`${base}/prime`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-state="anonymous"]:not([hidden])', { timeout: 10_000 });
    const view = await snapshot(page);
    assert.equal(view.state, 'anonymous');
    assert.equal(view.session, null, 'a session that cannot be refreshed must not be kept');
    assert.ok(seen.authRequests.some((entry) => entry.startsWith('POST /auth/v1/token')), 'the refresh must actually have been attempted');
    assert.deepEqual(seen.primeRequests, [], 'an unusable session must never reach the private API');
  }, { refresh: 'reject' });

  await scenario('signing out revokes the session, survives reload and blocks the back button', viewportName, async (page, seen, context) => {
    await seedSession(context, liveSession());
    await page.goto(`${base}/prime`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-state="ready"]:not([hidden])', { timeout: 10_000 });
    await page.click('[data-state="ready"] [data-signout]');
    await page.waitForSelector('[data-state="anonymous"]:not([hidden])', { timeout: 10_000 });
    assert.ok(seen.authRequests.includes('POST /auth/v1/logout'), 'sign out must revoke the session with the identity service');
    const signedOut = await snapshot(page);
    assert.equal(signedOut.session, null);
    assert.ok(!signedOut.text.includes(PRIVATE_MARKER), 'private content must be gone once signed out');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-state="anonymous"]:not([hidden])', { timeout: 10_000 });
    assert.equal((await snapshot(page)).state, 'anonymous', 'post-logout denial must survive a reload');
    // Leave the private page and walk back into it: a restored history entry
    // must be re-authorised, not replayed from the back/forward cache.
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForSelector('[data-state="anonymous"]:not([hidden])', { timeout: 10_000 });
    const back = await snapshot(page);
    assert.equal(back.state, 'anonymous', 'the back button must not reveal private content after signing out');
    assert.ok(!back.text.includes(PRIVATE_MARKER), 'no private payload may return through history');
  }, { privateMarker: true });

  await scenario('a finished recovery does not reopen the set-password step', viewportName, async (page) => {
    await openRecovery(page);
    await page.waitForSelector('#setPasswordForm', { state: 'visible' });
    const view = await submit(page);
    assert.equal(view.state, 'ready');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-state="ready"]:not([hidden])', { timeout: 10_000 });
    const after = await snapshot(page);
    assert.equal(after.state, 'ready', 'a completed recovery must not demand the password again');
    assert.equal(await page.locator('[data-state="recovery"]:not([hidden])').count(), 0);
    assert.equal(after.hash, '', 'no recovery material may return with the reload');
  });

  await scenario('double-tapping submit performs exactly one password update', viewportName, async (page, seen) => {
    await openRecovery(page);
    await page.waitForSelector('#setPasswordForm', { state: 'visible' });
    await page.fill('#newPassword', SYNTHETIC_PASSWORD);
    await page.fill('#confirmPassword', SYNTHETIC_PASSWORD);
    await page.evaluate(() => {
      const button = document.querySelector('#setPasswordForm button[type="submit"]');
      button.click();
      button.click();
    });
    const view = await settle(page);
    assert.equal(view.state, 'ready', `a double tap must still continue, saw ${view.state} (${view.error})`);
    assert.deepEqual(seen.authRequests, ['PUT /auth/v1/user'], 'a double tap must not produce two updates');
  });

  await scenario('the private surface registers no service worker and persists no private payload', viewportName, async (page, seen, context) => {
    await seedSession(context, liveSession());
    await page.goto(`${base}/prime`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-state="ready"]:not([hidden])', { timeout: 10_000 });
    const audit = await page.evaluate(async () => ({
      registrations: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 'unsupported',
      keys: Object.keys(localStorage),
      dump: JSON.stringify(localStorage),
    }));
    if (typeof audit.registrations === 'number') {
      assert.equal(audit.registrations, 0, 'no service worker may cache private responses');
    }
    assert.deepEqual(audit.keys.filter((key) => key !== 'portal-prime-session-v1'), [], 'only the session may be persisted');
    assert.ok(!audit.dump.includes(PRIVATE_MARKER), 'private payloads must never be persisted in the browser');
  }, { privateMarker: true });
}

  await scenario('the private pages declare no duplicate element ids', 'desktop', async (page, seen) => {
  for (const privatePath of ['/prime', '/reports']) {
    const response = await page.goto(`${base}${privatePath}`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, `${privatePath} did not return HTTP 200`);
    await page.waitForFunction(() => Boolean(document.querySelector('[data-state]:not([hidden])')), null, { timeout: 10_000 });
    const view = await snapshot(page);
    assert.equal(new Set(view.ids).size, view.ids.length, `duplicate element ids on ${privatePath}: ${view.ids.join(', ')}`);
  }
  assert.deepEqual(seen.pageErrors, [], `page errors: ${seen.pageErrors.join('; ')}`);
  });

await scenario('the public Portal still loads unchanged', 'desktop', async (page, seen) => {
  const response = await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, 'the public Portal must answer 200');
  const title = await page.title();
  assert.match(title, /PORTAL/i, `the public Portal title changed: ${title}`);
  assert.deepEqual(seen.pageErrors, [], `page errors: ${seen.pageErrors.join('; ')}`);
  const view = await snapshot(page);
  assert.equal(view.state, null, 'the public Portal must not render a PRIME state panel');
});

await browser.close();
if (local) await new Promise((resolve) => local.server.close(resolve));

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\nFAIL: ${failed.length} of ${results.length} PRIME recovery checks failed (base ${base}).`);
  process.exitCode = 1;
} else {
  console.log(`\nPASS: ${results.length} PRIME recovery checks satisfied the two-outcome rule (base ${base}).`);
}
