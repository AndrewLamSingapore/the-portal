import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync('schema.sql', 'utf8');
for (const token of ['schema_version integer not null default 5', 'evidence_level', 'sources jsonb', 'relationships jsonb', 'experiment jsonb', 'connections jsonb', 'artifacts_evidence_level_idx']) {
  assert.ok(schema.includes(token));
}
console.log('PASS: Portal schema 5 contract present.');
