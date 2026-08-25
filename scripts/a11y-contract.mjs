import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');

for (const token of [
  '<html lang="en">',
  'class="skip-link"',
  '<main id="main">',
  'role="status" aria-live="polite"',
  'role="dialog"',
  'aria-modal="true"',
  'aria-hidden="true"',
  'inert',
  'aria-label="Interactive conceptual graph"'
]) assert.ok(html.includes(token), `missing accessibility contract: ${token}`);

for (const token of [':focus-visible', 'prefers-reduced-motion']) {
  assert.ok(css.includes(token), `missing CSS accessibility contract: ${token}`);
}
for (const token of ["event.key === 'Escape'", "event.key !== 'Tab'", 'trapDrawerFocus', 'state.lastTrigger', "setAttribute('aria-hidden'", "setAttribute('inert'", "removeAttribute('inert'"]) {
  assert.ok(app.includes(token), `missing dialog accessibility behavior: ${token}`);
}

console.log('PASS: keyboard, focus, live-region, dialog and reduced-motion contracts verified.');
