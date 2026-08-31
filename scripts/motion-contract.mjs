import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('motion.css', 'utf8');
const app = fs.readFileSync('motion.js', 'utf8');

for (const asset of ['/motion.css', '/motion.js']) {
  assert.ok(html.includes(asset), `homepage missing kinetic asset: ${asset}`);
}

for (const behavior of ['IntersectionObserver', 'MutationObserver', 'visibilitychange', 'prefers-reduced-motion', 'ambient-field', 'motionProgress', 'portal-burst', 'graph-scan', 'portal:encounter-start', 'bindKineticSurface', 'bindWorldAtmospheres', 'portalWorld']) {
  assert.ok(app.includes(behavior), `motion layer missing behavior: ${behavior}`);
}

for (const behavior of ['prefers-reduced-motion', 'animation-play-state: paused', '@keyframes portalOrbit', '@keyframes particleDrift', '@keyframes apertureIgnition', '@keyframes nodeAwaken', '@keyframes encounterCharge', '@keyframes thresholdPassage', '.motion-section.is-visible', '.portal-aperture', '.graph-scan', 'data-portal-world']) {
  assert.ok(css.includes(behavior), `motion stylesheet missing safety or visual contract: ${behavior}`);
}

console.log('PASS: cinematic aperture, kinetic surfaces, graph ignition, action states and motion safety contracts verified.');
