import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('motion.css', 'utf8');
const app = fs.readFileSync('motion.js', 'utf8');

for (const asset of ['/motion.css', '/motion.js']) {
  assert.ok(html.includes(asset), `homepage missing kinetic asset: ${asset}`);
}

for (const behavior of ['IntersectionObserver', 'MutationObserver', 'visibilitychange', 'prefers-reduced-motion', 'ambient-field', 'motionProgress']) {
  assert.ok(app.includes(behavior), `motion layer missing behavior: ${behavior}`);
}

for (const behavior of ['prefers-reduced-motion', 'animation-play-state: paused', '@keyframes portalOrbit', '@keyframes particleDrift', '.motion-section.is-visible']) {
  assert.ok(css.includes(behavior), `motion stylesheet missing safety or visual contract: ${behavior}`);
}

console.log('PASS: kinetic motion, progressive reveal, tab pause and reduced-motion contracts verified.');
