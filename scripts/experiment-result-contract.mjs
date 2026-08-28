import assert from 'node:assert/strict';
import {
  attachExperimentResults,
  canonicalExperimentResult,
  validatePrimeExperimentResult
} from '../lib/experiment-result.js';

const result = {
  schema_version: '1.0',
  result_id: 'PRM-RES-ABC123',
  result_version: 5,
  source: 'prime',
  experiment_id: 'PRM-EXP-ABC123',
  candidate_id: 'PTL-EXP-ABC123',
  node_ids: ['PTL-A'],
  status: 'completed',
  conclusion: 'evidence_collected',
  evidence_summary: {
    observation_count: 1,
    evidence_levels: { derived: 0, raw: 1, reference: 0 },
    provenance_complete: true,
    first_observed_at: '2026-08-28T03:05:00Z',
    last_observed_at: '2026-08-28T03:05:00Z'
  },
  safety: {
    actuation_authorized: false,
    owner_approval_inferred: false,
    scientific_support_claimed: false
  },
  updated_at: '2026-08-28T03:10:00Z'
};

assert.equal(validatePrimeExperimentResult(result).result_id, result.result_id);
assert.equal(canonicalExperimentResult(result), canonicalExperimentResult({ ...result, node_ids: ['PTL-A'] }));
assert.throws(() => validatePrimeExperimentResult({
  ...result,
  safety: { ...result.safety, actuation_authorized: true }
}), /non-actuating/);
assert.throws(() => validatePrimeExperimentResult({
  ...result,
  evidence_summary: { ...result.evidence_summary, observation_count: 2 }
}), /equal observation_count/);

const graph = attachExperimentResults({
  nodes: [{ id: 'PTL-A', year: 2026, title: 'Candidate', concepts: [] }],
  edges: []
}, [result]);
assert.ok(graph.nodes.some(node => node.id === 'RESULT-PRM-EXP-ABC123'));
assert.ok(graph.edges.some(edge => edge.from === 'PTL-A' && edge.type === 'EXPERIMENT_EVIDENCE'));
assert.equal(graph.nodes.find(node => node.id.startsWith('RESULT-')).experiment_result.safety.actuation_authorized, false);

console.log('PASS: PRIME result is validated, evidence-bound, idempotent and attached to the Portal graph.');
