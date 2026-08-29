import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
for (const phrase of ['THE CONTINUOUS FUTURES MODEL', 'continuously evolving model', 'How futures move', 'Latest transitions', 'Realization watchlist', 'PUT A FUTURE ON TRIAL', 'FOLLOW THE GRAPH', 'CREATE AN ENCOUNTER', 'ENTER THE LIVING OBSERVATORY', 'The Future on Trial', 'Open an unexpected drawer', 'The graph', 'Constellations', 'Experiments worth running', 'Evolution ledger', 'Shared archive', 'My cabinet', 'Questions over manufactured certainty']) {
  assert.ok(html.includes(phrase), `missing living-graph experience contract: ${phrase}`);
}
for (const behavior of ['generateEncounter', 'maximizeSerendipity', 'renderCabinet', 'renderLenses', 'renderExperiments', 'renderEvolution', 'renderContinuousModel', 'renderTrial', 'castTrialVerdict', 'shareTrialVerdict', 'openConnectedTrial', 'drawGraph', 'detailMarkup', 'playPortalTheme', 'togglePortalSound']) {
  assert.ok(app.includes(behavior), `missing interaction contract: ${behavior}`);
}
for (const soundContract of ['id="portalTheme"', 'src="/portal-theme.mp3"', 'id="portalSound"', 'THE PORTAL THEME AWAKENS ON ENTRY']) {
  assert.ok(html.includes(soundContract), `missing thematic sound contract: ${soundContract}`);
}

console.log('PASS: living graph discovery, generation, cabinet and evidence UI contracts verified.');
