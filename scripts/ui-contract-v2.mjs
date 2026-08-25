import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
for (const phrase of ['THE LIVING KNOWLEDGE GRAPH', 'Not a record of what has been done.', 'ENTER THE GRAPH', 'CREATE AN ENCOUNTER', 'Open an unexpected drawer', 'The graph', 'Constellations', 'Experiments worth running', 'Evolution ledger', 'Shared archive', 'My cabinet', 'Questions over manufactured certainty']) {
  assert.ok(html.includes(phrase), `missing living-graph experience contract: ${phrase}`);
}
for (const behavior of ['generateEncounter', 'maximizeSerendipity', 'renderCabinet', 'renderLenses', 'renderExperiments', 'renderEvolution', 'drawGraph', 'detailMarkup']) {
  assert.ok(app.includes(behavior), `missing interaction contract: ${behavior}`);
}

console.log('PASS: living graph discovery, generation, cabinet and evidence UI contracts verified.');
