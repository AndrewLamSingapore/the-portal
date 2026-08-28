import assert from 'node:assert/strict';
import {
  validateExperimentCandidate,
  validatePrimeRelayResponse
} from '../lib/experiment-candidate.js';

const candidate = validateExperimentCandidate({
  schema_version: '1.0',
  candidate_id: 'PTL-EXP-RELAY-001',
  source: 'the-portal',
  title: 'Bounded observation relay',
  question: 'Can the authenticated protocol carry a candidate?',
  hypothesis: 'A server-side relay can preserve identity.',
  node_ids: ['PTL-A'],
  concepts: ['protocol'],
  provenance: ['contract:test'],
  evidence_boundary: 'Synthetic protocol proof only; no physical or scientific claim.',
  status: 'proposed',
  created_at: '2026-08-28T04:00:00Z'
});

const response = {
  candidate,
  experiment_spec: {
    schema_version: '1.0',
    experiment_id: 'PRM-EXP-RELAY-001',
    candidate_id: candidate.candidate_id,
    source: 'prime',
    target_system: 'velyqua',
    approval_state: 'verified'
  },
  idempotent: false
};

assert.equal(
  validatePrimeRelayResponse(response, candidate).experiment_spec.experiment_id,
  'PRM-EXP-RELAY-001'
);
assert.throws(
  () => validateExperimentCandidate({ ...candidate, status: 'rejected' }),
  /proposed or accepted/
);
assert.throws(
  () => validateExperimentCandidate({ ...candidate, unexpected: true }),
  /unsupported fields/
);
assert.throws(
  () => validatePrimeRelayResponse({
    ...response,
    experiment_spec: { ...response.experiment_spec, approval_state: 'approved' }
  }, candidate),
  /must not infer owner approval/
);
assert.throws(
  () => validatePrimeRelayResponse({
    ...response,
    experiment_spec: { ...response.experiment_spec, candidate_id: 'PTL-EXP-OTHER' }
  }, candidate),
  /identity mismatch/
);

console.log('PASS: Portal relays only bounded candidates and never infers owner approval.');
