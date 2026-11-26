import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lexicalOnlyRank,
  precisionAt,
  recallAt,
  ndcgAt,
  runRetrievalBenchmark,
  scoreDiscoveryQuality,
  buildBenchmarkReport
} from '../lib/intelligence-benchmark.js';

const nodes = [
  { id: 'A', title: 'Machine ethics', type: 'asset', concepts: ['intelligence', 'ethics'], provenance: ['src'] },
  { id: 'B', title: 'Energy commons', type: 'asset', concepts: ['energy', 'commons'], provenance: ['src'] },
  { id: 'C', title: 'Protein folding', type: 'asset', concepts: ['life', 'biology'], provenance: ['src'] }
];

test('lexical-only retrieval ranks a relevant record above unrelated records', () => {
  const ranked = lexicalOnlyRank('machine ethics and rights', nodes, 3);
  assert.equal(ranked[0].node.id, 'A');
});

test('retrieval metrics behave on known ranked lists', () => {
  assert.equal(precisionAt(['A', 'B', 'C'], ['A'], 3), 1 / 3);
  assert.equal(recallAt(['A', 'B', 'C'], ['A', 'D'], 5), 0.5);
  assert.ok(ndcgAt(['A', 'B', 'C'], ['A'], 5) > 0);
});

test('the retrieval benchmark reports both baselines without claiming superiority', () => {
  const result = runRetrievalBenchmark({
    nodes,
    queries: [
      { id: 'Q1', query: 'machine ethics', relevant: ['A'] },
      { id: 'Q2', query: 'unrelated baking bread', relevant: [] }
    ],
    semanticScoresByQuery: null
  });
  assert.equal(result.semantic_scorer_supplied, false);
  assert.equal(result.mode, 'hybrid_without_semantic');
  assert.equal(result.model_calls, 0);
  assert.ok('precision_at_3' in result.aggregate.lexical);
  assert.ok('precision_at_3' in result.aggregate.hybrid);
});

test('supplied semantic scores rerank paraphrases and are reported as active', () => {
  const scoresByQuery = new Map([['Q1', new Map([['A', 0.9], ['B', 0.2], ['C', 0.1]])]]);
  const result = runRetrievalBenchmark({
    nodes,
    queries: [{ id: 'Q1', query: 'machine ethics', relevant: ['A'] }],
    semanticScoresByQuery: scoresByQuery
  });
  assert.equal(result.mode, 'hybrid_with_semantic');
  assert.equal(result.semantic_scorer_supplied, true);
  assert.equal(result.per_query[0].hybrid.ranked[0], 'A');
});

test('discovery quality scores are deterministic rubrics over real outputs', () => {
  const scores = scoreDiscoveryQuality({
    population: [
      { statement: 'A survives', epistemic_class: 'INFERRED', ancestry: { parent_ids: ['OBS'], operators: ['MUTATION'] }, falsifiers: ['f'], hard_kill_conditions: ['k'] },
      { statement: 'A survives', epistemic_class: 'INFERRED', ancestry: {}, falsifiers: [], hard_kill_conditions: [] }
    ],
    fossils: [{ id: 'DEAD', superseded_by: 'A' }],
    run: { id: 'j1', generation_mode: 'DETERMINISTIC_FALLBACK' }
  });
  assert.equal(scores.novelty, 0.5);
  assert.equal(scores.falsifiability, 0.5);
  assert.equal(scores.self_correction, 1);
  assert.equal(scores.evolutionary_improvement, 1);
});

test('the benchmark report marks independent validation as pending', () => {
  const report = buildBenchmarkReport({
    productVersion: '6.10.0',
    retrieval: { aggregate: { lexical: {}, hybrid: {} }, mode: 'hybrid_without_semantic' },
    discovery: scoreDiscoveryQuality({})
  });
  assert.equal(report.validation_status, 'PENDING_INDEPENDENT_VALIDATION');
  assert.ok(report.limitations.length > 0);
});
