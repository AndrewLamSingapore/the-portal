import assert from 'node:assert/strict';

import { attachExperimentResults } from '../lib/experiment-result.js';
import { acceptExperimentResult } from '../lib/experiment-result-service.js';

const token = 'synthetic-owner-controlled-token';
const rows = new Map();
const store = {
  async get(id) { return rows.get(id) || null; },
  async save(result) {
    const current = rows.get(result.experiment_id);
    if (!current || current.result_version < result.result_version) rows.set(result.experiment_id, { ...result, result_json: result });
    return rows.get(result.experiment_id);
  }
};

const result = {
  schema_version: '1.0', result_id: 'PRM-RES-SYNTHETIC-001', result_version: 1, source: 'prime',
  experiment_id: 'PRM-EXP-610629D9A204', candidate_id: 'PTL-EXP-AQUA-001', node_ids: ['PTL-SYNTHETIC-NODE'],
  status: 'completed', conclusion: 'completed_without_observations',
  evidence_summary: { observation_count: 0, evidence_levels: { raw: 0, reference: 0, derived: 0 }, provenance_complete: true, first_observed_at: null, last_observed_at: null },
  safety: { actuation_authorized: false, owner_approval_inferred: false, scientific_support_claimed: false },
  updated_at: '2026-08-30T10:45:00Z'
};

const unauthorized = await acceptExperimentResult({ authorization: 'Bearer wrong-token', expectedToken: token, payload: { result }, store });
assert.equal(unauthorized.status, 401);
assert.equal(rows.size, 0);

const first = await acceptExperimentResult({ authorization: `Bearer ${token}`, expectedToken: token, payload: { result }, store });
assert.equal(first.status, 200);
assert.equal(first.body.idempotent, false);
assert.equal(rows.size, 1);

const replay = await acceptExperimentResult({ authorization: `Bearer ${token}`, expectedToken: token, payload: { result }, store });
assert.equal(replay.status, 200);
assert.equal(replay.body.idempotent, true);

const conflict = await acceptExperimentResult({ authorization: `Bearer ${token}`, expectedToken: token, payload: { result: { ...result, conclusion: 'rejected_by_owner' } }, store });
assert.equal(conflict.status, 409);

const graph = attachExperimentResults({ nodes: [{ id: 'PTL-SYNTHETIC-NODE', year: 2026, title: 'Synthetic candidate', concepts: [] }], edges: [] }, [...rows.values()]);
assert.ok(graph.nodes.some(node => node.id === 'RESULT-PRM-EXP-610629D9A204'));
assert.ok(graph.edges.some(edge => edge.from === 'PTL-SYNTHETIC-NODE' && edge.type === 'EXPERIMENT_EVIDENCE'));

console.log('PASS: authenticated synthetic result write, replay, conflict rejection, read-back and graph update completed without physical actuation.');
