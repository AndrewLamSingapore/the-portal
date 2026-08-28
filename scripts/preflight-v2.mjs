import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['api/artifact.js', 'api/archive.js', 'api/serendipity.js', 'api/graph.js', 'api/relationship.js', 'api/exhibition.js', 'api/exhibitions.js', 'api/health.js', 'api/meta.js', 'api/trial.js', 'api/living.js', 'index.html', 'living.html', 'living.js', 'app.js', 'styles.css']) {
  assert.ok(fs.existsSync(file), `missing ${file}`);
}

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
for (const token of ['id="status"', 'id="graph"', 'id="lenses"', 'id="curatorForm"', 'id="futureOnTrial"', 'ENCOUNTER', 'CONNECT', 'EXPERIMENT', 'EVOLVE', 'PUT A FUTURE ON TRIAL', 'WANDER THE GRAPH', 'CREATE AN ENCOUNTER', 'ENTER THE LIVING OBSERVATORY']) {
  assert.ok(html.includes(token), `missing living-graph preflight token: ${token}`);
}
for (const token of ['/api/archive?limit=60', '/api/graph', '/api/artifact', '/api/serendipity', '/api/trial', 'portal-cabinet-v4']) {
  assert.ok(app.includes(token), `missing browser flow: ${token}`);
}

console.log('PASS: complete living knowledge graph release preflight.');
