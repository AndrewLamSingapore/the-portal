/**
 * Portal V2 card permalink contract.
 *
 * Locks the plain-language front door and the stable /card/<id> links that the
 * redesign brief requires: a shareable URL per card, a copy-link control with an
 * accessible fallback, browser history that stays in sync, and a visible answer
 * when a link points at a card that does not exist.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

// --- Plain-language front door (WP1) ---------------------------------------
for (const phrase of [
  'A museum of imagined futures',
  'which ideas came true, which failed, and how they connect',
  'HOW TO READ A CARD',
  'OUTCOME OR STATUS',
  'EVIDENCE LABEL',
  'OPEN QUESTION',
]) {
  assert.ok(html.includes(phrase), `missing front-door contract: ${phrase}`);
}
assert.ok(
  html.includes('id="cardNotice" role="status" aria-live="polite"'),
  'a missing card must be announced through a live region',
);
assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg">'), 'the shell declares its icon');
assert.ok(fs.existsSync('favicon.svg'), 'favicon.svg is served from the site root');

// --- Stable card links (WP5) ----------------------------------------------
for (const behaviour of [
  'function requestedCardId()',
  'function cardPermalink(id)',
  'function syncCardUrl(',
  'function clearCardUrl()',
  'function updateCardMetadata(',
  'function announceCardNotice(',
  "window.addEventListener('popstate'",
  'const requested = requestedCardId();',
]) {
  assert.ok(app.includes(behaviour), `missing permalink behaviour: ${behaviour}`);
}
assert.ok(/\\\/card\\\/\(\[\^\/\]\+\)/.test(app) || app.includes('/\\/card\\/([^/]+)\\/?$/'), 'the client reads /card/<id>');
assert.ok(app.includes("new URLSearchParams(location.search).get('card')"), '?card=<id> stays supported');
assert.ok(app.includes("history[replace ? 'replaceState' : 'pushState']"), 'opening a card records a history entry');
const closeDrawerBody = app.slice(app.indexOf('function closeDrawer()'), app.indexOf('function trapDrawerFocus'));
assert.ok(closeDrawerBody.includes('clearCardUrl()'), 'closing a card returns to the exhibition URL');
assert.ok(closeDrawerBody.includes('updateCardMetadata(null)'), 'closing a card restores the exhibition metadata');
assert.ok(app.includes("setMetaContent('meta[property=\"og:url\"]'"), 'the open card updates its share metadata');
assert.ok(app.includes("document.title = title;") && app.includes('setCanonical('), 'the open card updates title and canonical');

// --- Copy link with fallback ----------------------------------------------
assert.ok(app.includes('id="copyCardLink"'), 'the drawer offers a copy-link control');
assert.ok(app.includes('navigator.clipboard?.writeText'), 'clipboard access is attempted');
assert.ok(app.includes('Copy this link:'), 'a readable fallback is offered when the clipboard is unavailable');
assert.ok(app.includes('id="copyCardState" role="status" aria-live="polite"'), 'copy feedback is announced');

// --- Routing ---------------------------------------------------------------
const rewrites = config.rewrites || [];
const cardRewrite = rewrites.find((rewrite) => rewrite.source === '/card/:id');
assert.ok(cardRewrite, 'vercel.json rewrites /card/:id');
assert.equal(cardRewrite.destination, '/index.html', 'the card route serves the exhibition shell');
assert.ok(
  rewrites.every((rewrite) => rewrite.source.startsWith('/api/') || rewrite.source === '/card/:id'),
  'no other public rewrite was changed',
);

console.log('PASS: plain-language front door and stable card permalinks verified.');
