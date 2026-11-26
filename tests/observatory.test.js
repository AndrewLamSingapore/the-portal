import test from 'node:test';
import assert from 'node:assert/strict';
import { buildObservatory } from '../lib/observatory.js';

test('observatory composes recorded runs, arena and fossils without fabrication', () => {
  const payload = buildObservatory({
    productVersion: '6.9.0',
    runs: [
      { id: 'j1', status: 'COMPLETED', generation_mode: 'DETERMINISTIC_FALLBACK', model_calls: 0, created_at: 't1', started_at: 't1', finished_at: 't2', generation_count: 4, fossil_count: 1, verdict: { passed: false } }
    ],
    latestRun: {
      id: 'j1',
      status: 'COMPLETED',
      result: {
        generation_mode: 'DETERMINISTIC_FALLBACK',
        population: [
          { id: 'HYP-A', statement: 'A survives', epistemic_class: 'INFERRED', state: 'EMERGING', confidence: .3, predictions: [], falsifiers: [], hard_kill_conditions: [], ancestry: { parent_ids: ['OBS'] } }
        ],
        fossils: [
          { id: 'HYP-DEAD', statement: 'A killed idea', final_confidence: .1, superseded_by: 'HYP-A', ancestry: {} }
        ]
      }
    },
    graph: {
      nodes: [{ id: 'n1', concepts: ['Life', 'Frontiers'] }, { id: 'n2', concepts: ['Life'] }],
      edges: [{ from: 'n1', to: 'n2' }]
    },
    experimentResults: [{ result_json: { experiment_id: 'E1', status: 'completed', conclusion: 'observed' } }],
  });

  assert.equal(payload.mode, 'OPEN_INTELLIGENCE_OBSERVATORY');
  assert.equal(payload.transparency.live_activity.runs.length, 1);
  assert.equal(payload.transparency.live_activity.latest.id, 'j1');
  assert.equal(payload.transparency.hypothesis_arena.candidates.length, 1);
  assert.equal(payload.transparency.hypothesis_arena.candidates[0].statement, 'A survives');
  assert.equal(payload.transparency.fossil_record.fossils.length, 1);
  assert.equal(payload.transparency.living_knowledge_graph.node_count, 2);
  assert.equal(payload.transparency.living_knowledge_graph.edge_count, 1);
  assert.equal(payload.transparency.experiment_lab.recorded_results.length, 1);
  assert.equal(payload.transparency.benchmark.status, 'PENDING_INDEPENDENT_VALIDATION');
  assert.equal(payload.safety.actuation_allowed, false);
});

test('observatory labels empty arena and benchmark honestly', () => {
  const payload = buildObservatory({ runs: [], graph: { nodes: [], edges: [] } });
  assert.equal(payload.transparency.live_activity.runs.length, 0);
  assert.equal(payload.transparency.live_activity.latest, null);
  assert.deepEqual(payload.transparency.hypothesis_arena.candidates, []);
  assert.deepEqual(payload.transparency.fossil_record.fossils, []);
  assert.equal(payload.transparency.benchmark.status, 'PENDING_INDEPENDENT_VALIDATION');
});
