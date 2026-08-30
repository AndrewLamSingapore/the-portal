import assert from 'node:assert/strict';
import { buildContinuousModel, buildEvolution, buildKnowledgeGraph } from '../lib/knowledge.js';

const items = [
  { id: 'a', year: 2020, title: 'A', concepts: ['memory'], created_at: '2026-08-01', connections: [], experiment: {}, lifecycle: [], current_phase: 'EMERGED', recurrence_conditions: ['cheap inference'], realization_signal: 'repeat use' },
  { id: 'b', year: 2021, title: 'B', concepts: ['memory','trust'], created_at: '2026-08-02', connections: [], experiment: {}, lifecycle: [], current_phase: 'RETURNED', recurrence_conditions: ['cheap inference'], realization_signal: 'repeat use' }
];
const graph = buildKnowledgeGraph(items);
const evolution = buildEvolution(items);
const continuous = buildContinuousModel(items);
assert.equal(graph.nodes.length, 2);
assert.ok(graph.edges.some(edge => edge.type === 'CONCEPTUAL_ECHO'));
assert.ok(evolution.emerging_concepts.some(item => item.name === 'memory' && item.count === 2));
assert.ok(continuous.recurrence_conditions.some(item => item.condition === 'cheap inference' && item.count === 2));
console.log('Portal autonomy synthesis contract: OK');
