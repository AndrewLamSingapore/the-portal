import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const config = fs.readFileSync('vercel.json', 'utf8');
const asset = 'assets/the-portal-theme-v1.mp3';

assert.ok(fs.existsSync(asset), 'missing Portal theme audio asset');
assert.ok(fs.statSync(asset).size > 100_000, 'Portal theme audio asset is unexpectedly small');
assert.ok(html.includes('id="portalTheme"') && html.includes('preload="metadata"'), 'missing non-autoplay theme element');
assert.ok(html.includes('id="soundToggle"') && html.includes('aria-pressed="false"'), 'missing accessible sound control');
assert.ok(app.includes('portal-sound-enabled-v1'), 'missing local sound preference');
assert.ok(app.includes('playPortalTheme') && app.includes('stopSound'), 'missing controlled audio lifecycle');
assert.ok(app.includes("document.addEventListener('visibilitychange'"), 'missing hidden-tab audio pause');
assert.ok(css.includes('.sound-toggle.active') && css.includes('.sr-only'), 'missing sound control states');
assert.ok(config.includes("media-src 'self'"), 'media content policy must remain same-origin');

console.log('PASS: consent, accessibility, persistence, lifecycle and audio asset contracts verified.');
