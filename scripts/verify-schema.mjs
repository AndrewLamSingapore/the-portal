import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync('schema.sql', 'utf8');
for (const token of ['schema_version integer not null default 6', 'alter column schema_version set default 6', 'evidence_level', 'sources jsonb', 'relationships jsonb', 'experiment jsonb', 'connections jsonb', 'lifecycle jsonb', 'current_phase text', 'recurrence_conditions jsonb', 'realization_signal text', 'artifacts_current_phase_idx']) {
  assert.ok(schema.includes(token));
}

for (const token of ['create table if not exists experiment_results', 'result_version integer not null check (result_version > 0)', 'result_json jsonb not null', 'experiment_results_updated_at_idx']) {
  assert.ok(schema.includes(token), `experiment result schema missing ${token}`);
}
for (const token of ['living_runs', 'living_events', 'living_fossils']) assert.ok(schema.includes(token), `missing Portal 6.3 schema token: ${token}`);
console.log('PASS: Portal schema 6 continuous futures contract present.');
