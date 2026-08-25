import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const config = fs.readFileSync('vercel.json', 'utf8');
const asset = 'assets/the-portal-theme-v1.mp3';

assert.ok(fs.existsSync(asset), 'missing versioned Portal theme audio asset');
assert.ok(fs.statSync(asset).size > 100_000, 'Portal theme audio asset is unexpectedly small');
assert.ok(html.includes('id="portalTheme"') && html.includes('preload="metadata"'), 'missing non-autoplay theme element');
assert.ok(html.includes('src="/assets/the-portal-theme-v1.mp3"'), 'missing primary versioned theme source');
assert.ok(html.includes('id="portalSound"') && html.includes('aria-pressed="false"'), 'missing accessible sound control');
assert.ok(html.includes('id="portalSoundStatus"') && html.includes('aria-live="polite"'), 'missing accessible sound status');
assert.ok(app.includes('portal-sound-v1'), 'missing local sound preference');
assert.ok(app.includes('playPortalTheme') && app.includes('stopPortalTheme'), 'missing controlled audio lifecycle');
assert.ok(app.includes("document.addEventListener('visibilitychange'"), 'missing hidden-tab audio pause');
assert.ok(css.includes('.sound-toggle.is-playing') && css.includes('@keyframes soundSignal'), 'missing sound control feedback');
assert.ok(config.includes("media-src 'self'"), 'media content policy must remain same-origin');

console.log('PASS: consent, accessibility, persistence, lifecycle and audio asset contracts verified.');
