import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync('schema.sql', 'utf8');
for (const token of ['schema_version integer not null default 6', 'alter column schema_version set default 6', 'evidence_level', 'sources jsonb', 'relationships jsonb', 'experiment jsonb', 'connections jsonb', 'lifecycle jsonb', 'current_phase text', 'recurrence_conditions jsonb', 'realization_signal text', 'artifacts_current_phase_idx']) {
  assert.ok(schema.includes(token));
}
console.log('PASS: Portal schema 6 continuous futures contract present.');
