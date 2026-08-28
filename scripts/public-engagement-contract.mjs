import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const api = fs.readFileSync('api/trial.js', 'utf8');
const schema = fs.readFileSync('schema.sql', 'utf8');

for (const verdict of ['FAILED', 'TOO_EARLY', 'ARRIVED_QUIETLY']) {
  assert.ok(app.includes(verdict), `browser verdict missing: ${verdict}`);
  assert.ok(api.includes(verdict), `API verdict missing: ${verdict}`);
  assert.ok(schema.includes(verdict), `database verdict missing: ${verdict}`);
}

assert.ok(html.includes('Public verdicts are anonymous aggregates'), 'privacy boundary missing from public trial');
assert.ok(app.includes('The public distribution is revealed after your verdict.'), 'blind-vote interaction missing');
assert.ok(app.includes("navigator.share"), 'native share path missing');
assert.ok(app.includes("navigator.clipboard.writeText"), 'share fallback missing');
assert.ok(schema.includes('primary key (artifact_id, verdict)'), 'aggregate-only verdict persistence missing');
assert.ok(!schema.includes('visitor_id'), 'public trial must not persist visitor identity');
assert.ok(!schema.includes('ip_address'), 'public trial must not persist IP addresses');

console.log('PASS: anonymous Future on Trial participation, reveal and sharing contracts verified.');
