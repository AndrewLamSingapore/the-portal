import assert from 'node:assert/strict';
import { buildContinuousModel, buildEvolution, buildKnowledgeGraph } from '../lib/knowledge.js';

const items = [
  { id: 'A', year: 1900, title: 'A', concepts: ['trust'], created_at: '2026-01-01', experiment: { hypothesis: 'Test A' }, connections: [], lifecycle: [{ phase: 'EMERGED', year: 1900, description: 'First form', evidence_basis: 'AI-GENERATED-HYPOTHESIS' }], current_phase: 'EMERGED', recurrence_conditions: ['cheap coordination'], realization_signal: 'Routine adoption' },
  { id: 'B', year: 1950, title: 'B', concepts: ['trust', 'exchange'], created_at: '2026-01-02', experiment: { hypothesis: 'Test B' }, connections: [{ target_id: 'A', type: 'EXTENDS', concept: 'trust', reason: 'Adds a mechanism', confidence: .8 }], lifecycle: [{ phase: 'EMERGED', year: 1950, description: 'Proposed', evidence_basis: 'AI-GENERATED-HYPOTHESIS' }, { phase: 'RETURNED', year: 2000, description: 'Reappeared', evidence_basis: 'AI-GENERATED-HYPOTHESIS' }], current_phase: 'RETURNED', recurrence_conditions: ['cheap coordination'], realization_signal: 'Public infrastructure' }
];
const graph = buildKnowledgeGraph(items);
assert.ok(graph.edges.some(edge => edge.type === 'CONCEPTUAL_ECHO'));
assert.ok(graph.edges.some(edge => edge.type === 'EXTENDS' && edge.to === 'A'));
const evolution = buildEvolution(items);
assert.deepEqual(evolution.events[0].strengthened_concepts, ['trust']);
assert.equal(evolution.open_experiments[0].id, 'B');
const continuous = buildContinuousModel(items);
assert.equal(continuous.phases.EMERGED, 2);
assert.equal(continuous.phases.RETURNED, 1);
assert.equal(continuous.transitions[0].from, 'EMERGED');
assert.deepEqual(continuous.recurrence_conditions[0], { condition: 'cheap coordination', count: 2 });
assert.equal(continuous.realization_watchlist.length, 2);
console.log('PASS: typed connections, evolution events and continuous futures transitions are derived deterministically.');
