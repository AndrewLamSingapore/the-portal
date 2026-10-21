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
  // Only executable script types are subject to script-src. Data blocks such
  // as application/ld+json (SEO structured data) and application/json are
  // inert: the browser never executes them, and CSP does not block them.
  const inlineScripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attributes, body]) => {
      if (body.trim().length === 0) return false;
      if (/\bsrc\s*=/.test(attributes)) return false;
      const type = (attributes.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1];
      if (!type) return true;
      const normalized = type.trim().toLowerCase();
      return normalized === 'module'
        || normalized.endsWith('javascript')
        || normalized === 'text/ecmascript'
        || normalized === 'application/ecmascript';
    });
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
  if (page === 'prime.html' || page === 'reports.html') {
    // These noindex ORQEVIA pages own their icon; the public Portal keeps its SVG.
    for (const size of [32, 48]) {
      const icon = `/assets/brands/orqevia/orqevia-official-v1-favicon-${size}.png`;
      assert.ok(html.includes(`<link rel="icon" type="image/png" sizes="${size}x${size}" href="${icon}">`), `${page} declares its approved private-page icon`);
      assert.ok(fs.existsSync(`.${icon}`), `${page} icon must resolve to a shipped file`);
    }
  } else {
    assert.ok(
      html.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg">'),
      `${page} must declare the icon, otherwise every visit logs a /favicon.ico 404`,
    );
  }
}

// The page that was broken must keep its behaviour in a same-origin file.
const v2 = fs.readFileSync('v2.html', 'utf8');
assert.ok(v2.includes('<script src="/v2.js"></script>'), 'v2.html loads its behaviour from a same-origin file');
const v2js = fs.readFileSync('v2.js', 'utf8');
assert.ok(v2js.includes('load()'), 'v2.js still performs the page load');
assert.ok(v2js.includes("$('grid')"), 'v2.js still renders the grid');

/*
 * The same policy decides which origins the shipped client scripts may reach.
 * Portal authentication is proxied through same-origin API routes, so browser
 * code must not depend on an absolute provider origin at all.
 */
const connectDirective = (policy.split(';').find((part) => part.trim().startsWith('connect-src')) || '').trim();
const connectSrc = connectDirective.split(/\s+/).slice(1);
assert.ok(connectSrc.includes("'self'"), 'connect-src still permits the deployment origin');
assert.deepEqual(connectSrc, ["'self'"], 'browser scripts may reach only the Portal origin');

const clientScripts = fs.readdirSync('.').filter((file) => file.endsWith('.js'));
const fetchedOrigins = new Map();
for (const script of clientScripts) {
  const source = fs.readFileSync(script, 'utf8');
  if (!/\bfetch\s*\(/.test(source)) continue;
  const constants = new Map(
    [...source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*['"](https:\/\/[^'"\s/]+)/g)]
      .map((match) => [match[1], match[2]]),
  );
  for (const call of source.matchAll(/\bfetch\s*\(([\s\S]{0,240}?)\)/g)) {
    const argument = call[1];
    for (const reference of argument.matchAll(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g)) {
      const origin = constants.get(reference[1]);
      // Only template segments that resolve to a declared absolute origin are
      // constraints here; the rest are paths, ids or parameters.
      if (!origin) continue;
      fetchedOrigins.set(origin, script);
    }
    for (const direct of argument.matchAll(/['"](https:\/\/[^'"\s/]+)/g)) {
      fetchedOrigins.set(direct[1], script);
    }
  }
}
assert.equal(
  fetchedOrigins.size,
  0,
  `browser scripts must use same-origin APIs, found: ${[...fetchedOrigins].map(([origin, script]) => `${script} -> ${origin}`).join(', ')}`,
);

console.log(
  `PASS: ${pages.length} pages satisfy the deployed Content Security Policy, and all client fetches are same-origin.`,
);
