/** Anonymous private-page branding smoke. Local source only; no Auth traffic. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.ORQEVIA_BRAND_TEST_OUTPUT;
if (output) fs.mkdirSync(output, { recursive: true });
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rules = config.headers.map(rule => ({ ...rule, match: new RegExp(`^${rule.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\(\\\.\\\*\\\)/g, '.*')}$`) }));
const headersFor = (pathname) => Object.fromEntries(rules.filter(rule => rule.match.test(pathname)).flatMap(rule => rule.headers.map(header => [header.key, header.value])));
assert.ok(headersFor('/prime')['Content-Security-Policy']);
assert.match(headersFor('/prime')['Cache-Control'], /no-store/);
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const name = pathname === '/prime' ? 'prime.html' : pathname === '/reports' ? 'reports.html' : pathname.slice(1);
  const filename = path.resolve(root, name);
  if (!filename.startsWith(`${root}${path.sep}`) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    response.writeHead(404); response.end(); return;
  }
  const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' }[path.extname(filename)] || 'application/octet-stream';
  response.writeHead(200, { ...headersFor(pathname), 'Content-Type': type });
  response.end(fs.readFileSync(filename));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (process.platform === 'win32' ? ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync) : undefined);
let browser;
const rows = [];
try {
  browser = await chromium.launch({ headless: true, executablePath });
  for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile-390x844', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    const prohibitedRequests = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith('/api/')) {
        prohibitedRequests.push({ origin: url.origin, pathname: url.pathname, method: route.request().method() });
        return route.abort();
      }
      return route.continue();
    });
    for (const pageName of ['prime', 'reports']) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(`${origin}/${pageName}`);
      assert.equal(response.status(), 200);
      await page.locator('[data-state="anonymous"]').waitFor({ state: 'visible' });
      await page.locator('img[alt="ORQEVIA · 奥启维亚"]').evaluate(image => image.decode());
      const observed = await page.evaluate(() => {
        const logo = document.querySelector('img[alt="ORQEVIA · 奥启维亚"]');
        const style = getComputedStyle(logo);
        return {
          title: document.title, robots: document.querySelector('meta[name="robots"]').content,
          visibleStates: [...document.querySelectorAll('[data-state]')].filter(node => !node.hidden).map(node => node.dataset.state),
          logo: { width: logo.naturalWidth, height: logo.naturalHeight, objectFit: style.objectFit, borderRadius: style.borderRadius, filter: style.filter },
          storageEntries: localStorage.length, overflow: document.documentElement.scrollWidth > window.innerWidth,
          bodyText: document.body.innerText, favicon: document.querySelector('link[rel="icon"]').getAttribute('href'),
        };
      });
      assert.match(observed.title, /ORQEVIA · 奥启维亚/);
      assert.equal(observed.robots, 'noindex, nofollow');
      assert.deepEqual(observed.visibleStates, ['anonymous']);
      assert.deepEqual(observed.logo, { width: 192, height: 192, objectFit: 'contain', borderRadius: '0px', filter: 'none' });
      assert.equal(observed.storageEntries, 0);
      assert.equal(observed.overflow, false);
      assert.doesNotMatch(observed.bodyText, /PRIME/);
      assert.match(observed.favicon, /orqevia-official-v1-favicon-32\.png$/);
      const iconStatus = await page.evaluate(async () => {
        const icons = [...document.querySelectorAll('link[rel="icon"]')];
        return Promise.all(icons.map(async icon => {
          const response = await fetch(icon.href);
          return { status: response.status, contentType: response.headers.get('content-type') };
        }));
      });
      assert.deepEqual(iconStatus, [{ status: 200, contentType: 'image/png' }, { status: 200, contentType: 'image/png' }]);
      assert.deepEqual(errors, []);
      if (output) await page.screenshot({ path: path.join(output, `${pageName}-${label}.png`), fullPage: true });
      rows.push({ page: pageName, viewport: label, status: 'PASS', observed, iconStatus, pageErrors: errors });
      await page.close();
    }
    assert.deepEqual(prohibitedRequests, [], 'anonymous page must not attempt Auth, APIs, or external requests');
    await context.close();
  }
  const receipt = { state: 'PASS', scope: 'local shipped source, anonymous headless Edge; no physical-device or deployment claim', node: process.version, authOrApiOrExternalRequests: 0, rows };
  if (output) fs.writeFileSync(path.join(output, 'anonymous-browser.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
