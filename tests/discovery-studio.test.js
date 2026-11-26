import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyIntent,
  normalizeSeed,
  validateFollowup,
  DiscoveryInputError,
  buildHypothesisScaffolds,
  buildBriefing
} from '../lib/discovery-studio.js';

test('discovery seed bounds reject empty, oversized and ambiguous input', () => {
  for (const seed of ['', ' ', 'x', 'x'.repeat(401)]) {
    assert.throws(() => normalizeSeed(seed), DiscoveryInputError);
  }
  assert.equal(normalizeSeed('  Why   do ideas   return? '), 'Why do ideas return?');
});

test('intent classification is a deterministic heuristic, not a model', () => {
  assert.equal(classifyIntent('What if machines evolved ethics?'), 'QUESTION');
  assert.equal(classifyIntent('I noticed old ideas return.'), 'OBSERVATION');
  assert.equal(classifyIntent('Challenge the claim that solar always wins.'), 'CHALLENGE');
  assert.equal(classifyIntent('Design a future where energy is a commons.'), 'IMAGINATION');
  assert.equal(classifyIntent('A museum of imagined futures.'), 'IDEA');
});

test('hypothesis scaffolds are explicitly constructed, not discovered', () => {
  const candidates = buildHypothesisScaffolds({ seed: 'Could failures become breakthroughs?', concepts: ['failure', 'evolution'] });
  assert.equal(candidates.length, 3);
  for (const candidate of candidates) {
    assert.equal(candidate.generation, 'DETERMINISTIC_HEURISTIC');
    assert.ok(['CONSTRUCTED', 'SPECULATIVE'].includes(candidate.epistemic_class));
    assert.ok(candidate.falsifiers.length > 0);
    assert.ok(candidate.hard_kill_conditions.length > 0);
  }
});

test('briefing discloses degraded lexical-only operation when semantics are unavailable', () => {
  const graph = { nodes: [], edges: [] };
  const briefing = buildBriefing({
    query: 'Why do old ideas return?',
    graph,
    semanticStatus: { mode: 'lexical_fallback', degraded: true, reason: 'DATABASE_URL not configured', model: null },
    ranked: [],
    expanded: []
  });
  assert.equal(briefing.seed.intent, 'QUESTION');
  assert.equal(briefing.grounding.degraded, true);
  assert.equal(briefing.grounding.mode, 'lexical_fallback');
  assert.match(briefing.stages.connect.disclosure, /lexical matching only/i);
  assert.equal(briefing.stages.hypothesize.model, null);
  assert.equal(briefing.stages.experiment.status, 'PROPOSED');
  assert.equal(briefing.safety.model_calls, 0);
});

test('briefing keeps semantic retrieval active when embeddings succeed', () => {
  const briefing = buildBriefing({
    query: 'Machines that evolve ethics',
    graph: { nodes: [], edges: [] },
    semanticStatus: { mode: 'persistent_embedding_rerank', degraded: false, reason: null, model: 'text-embedding-3-small' },
    ranked: [],
    expanded: []
  });
  assert.equal(briefing.grounding.degraded, false);
  assert.equal(briefing.grounding.mode, 'persistent_embedding_rerank');
  assert.doesNotMatch(briefing.stages.connect.disclosure, /lexical matching only/i);
});

test('follow-up context is bounded and normalised', () => {
  assert.equal(validateFollowup(undefined), null);
  assert.throws(() => validateFollowup({ seed: 'x', history: [] }), DiscoveryInputError);
  assert.throws(() => validateFollowup({ seed: 'a valid seed', history: Array(7).fill({ id: 'a', statement: 'b' }) }), DiscoveryInputError);
  const followup = validateFollowup({ seed: '  Refine this idea  ', turn: 3, history: [{ id: 'DS-HYP-1', statement: 'An earlier idea' }] });
  assert.equal(followup.seed, 'Refine this idea');
  assert.equal(followup.turn, 3);
  assert.equal(followup.history.length, 1);
});

test('follow-up briefing carries lineage and marks the new turn', () => {
  const briefing = buildBriefing({
    query: 'What could that mean for trust?',
    graph: { nodes: [], edges: [] },
    semanticStatus: { mode: 'persistent_embedding_rerank', degraded: false },
    ranked: [],
    expanded: [],
    followup: { seed: 'Machines that evolve ethics', turn: 2, history: [{ id: 'DS-HYP-1', statement: 'Machines may need shared ethics.' }] }
  });
  assert.equal(briefing.session.turn, 2);
  assert.equal(briefing.session.seed, 'Machines that evolve ethics');
  for (const lineage of briefing.session.lineage) {
    assert.deepEqual(lineage.ancestry.parent_ids, ['DS-HYP-1']);
    assert.deepEqual(lineage.ancestry.operators, ['MUTATION']);
  }
  assert.ok(briefing.stages.hypothesize.candidates.every(candidate => candidate.turn === 2));
});
