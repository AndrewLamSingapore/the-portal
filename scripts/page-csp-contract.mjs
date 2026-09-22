/**
 * Page/CSP contract.
 *
 * The deployment ships `script-src 'self'` and `style-src 'self' 'unsafe-inline'`.
 * That means a page may not carry an inline script and may not import an
 * external stylesheet: both are silently blocked in production, which is how the
 * /v2 page shipped with its data loading, drawer and grid rendering dead.
 *
 * This check keeps any page from repeating that mistake.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const policy = config.headers
  .find((header) => header.source === '/(.*)')
  .headers.find((header) => header.key === 'Content-Security-Policy').value;

assert.match(policy, /script-src 'self'/, 'the deployment policy is the one this contract protects');
assert.ok(!/script-src [^;]*unsafe-inline/.test(policy), 'inline script is not broadly allowed');
assert.ok(!/style-src [^;]*https:\/\//.test(policy), 'external stylesheets are not broadly allowed');

const pages = fs.readdirSync('.').filter((file) => file.endsWith('.html'));
assert.ok(pages.length >= 5, `expected the full page set, found ${pages.length}`);

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .filter((match) => match[1].trim().length > 0);
  assert.equal(
    inlineScripts.length,
    0,
    `${page} contains ${inlineScripts.length} inline script(s) that script-src 'self' blocks`,
  );
  assert.ok(
    !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html),
    `${page} depends on a blocked external font origin`,
  );
  const externalStyles = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => /href=["']https?:\/\//.test(tag));
  assert.equal(externalStyles.length, 0, `${page} links an external stylesheet that style-src blocks`);
  assert.ok(
    html.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg">'),
    `${page} must declare the icon, otherwise every visit logs a /favicon.ico 404`,
  );
}

// The page that was broken must keep its behaviour in a same-origin file.
const v2 = fs.readFileSync('v2.html', 'utf8');
assert.ok(v2.includes('<script src="/v2.js"></script>'), 'v2.html loads its behaviour from a same-origin file');
const v2js = fs.readFileSync('v2.js', 'utf8');
assert.ok(v2js.includes('load()'), 'v2.js still performs the page load');
assert.ok(v2js.includes("$('grid')"), 'v2.js still renders the grid');

console.log(`PASS: ${pages.length} pages satisfy the deployed Content Security Policy.`);
