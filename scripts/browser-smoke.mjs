import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = (process.env.PORTAL_URL || 'https://the-portal-ten.vercel.app').replace(/\/$/, '');
const timeout = Number(process.env.SMOKE_TIMEOUT_MS || 15_000);
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({
  headless: true,
  ...(proxyUrl ? { proxy: { server: proxyUrl } } : {})
});

try {
  const page = await browser.newPage({ ignoreHTTPSErrors: Boolean(proxyUrl) });
  const pageErrors = [];
  const generationRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/artifact') {
      generationRequests.push(request.url());
    }
  });

  if (process.env.VERCEL_SHARE_URL) {
    await page.goto(process.env.VERCEL_SHARE_URL, { waitUntil: 'domcontentloaded', timeout });
  }

  const response = await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout });
  assert.equal(response?.status(), 200, 'browser navigation did not return HTTP 200');
  await page.waitForFunction(() => {
    const system = document.querySelector('#systemState')?.textContent || '';
    const status = document.querySelector('#status')?.textContent || '';
    return system !== 'CHECKING ARCHIVE' && !/^CONNECTING TO THE (?:STACKS|GRAPH)/.test(status);
  }, null, { timeout });

  const initialized = await page.locator('body').evaluate(() => ({
    system: document.querySelector('#systemState')?.textContent?.trim(),
    status: document.querySelector('#status')?.textContent?.trim(),
    cards: document.querySelectorAll('#grid .card').length,
    graphNodes: document.querySelectorAll('#graph .node').length
  }));
  assert.match(initialized.system || '', /^(ARCHIVE ONLINE|PRIVATE CABINET MODE)/);
  assert.doesNotMatch(initialized.status || '', /^CONNECTING TO THE (?:STACKS|GRAPH)/);
  assert.ok(initialized.cards > 0, 'browser initialized without archive cards');
  assert.ok(initialized.graphNodes > 0, 'browser initialized without graph nodes');
  assert.deepEqual(generationRequests, [], 'page initialization called POST /api/artifact');
  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`);

  console.log(`PASS: browser initialized (${initialized.cards} cards, ${initialized.graphNodes} graph nodes, ${initialized.system}).`);
} finally {
  await browser.close();
}
