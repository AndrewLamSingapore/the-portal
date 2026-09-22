/** Temporary: prove the recovery fragment is consumed, cleared and rendered. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((candidate) => existsSync(candidate));
const BASE = process.env.PRIME_BASE || 'https://the-portal-ten.vercel.app';
const fake = '#access_token=fake-token-not-real&refresh_token=fake-refresh&expires_in=3600&token_type=bearer&type=recovery';
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
const requests = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text().slice(0, 120)); });
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('request', (request) => { if (/access_token|refresh_token|bearer /i.test(request.url())) requests.push(request.url().slice(0, 80)); });

await page.goto(`${BASE}/prime${fake}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const visible = await page.evaluate(() => {
  const states = [...document.querySelectorAll('[data-state]')].filter((node) => !node.hidden).map((node) => node.dataset.state);
  return { states, hash: location.hash, hasSetPassword: Boolean(document.getElementById('setPasswordForm')?.offsetParent) };
});
console.log(JSON.stringify({ ...visible, urlLeakedToken: visible.hash.length > 0, requestsWithToken: requests.length, consoleErrors: errors.length }, null, 2));

await page.goto(`${BASE}/prime`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const normal = await page.evaluate(() => ({ states: [...document.querySelectorAll('[data-state]')].filter((node) => !node.hidden).map((node) => node.dataset.state), hasSignIn: Boolean(document.getElementById('signInForm')?.offsetParent) }));
console.log(JSON.stringify({ normalVisit: normal }, null, 2));

await browser.close();
