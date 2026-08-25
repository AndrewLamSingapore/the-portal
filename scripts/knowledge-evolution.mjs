import assert from 'node:assert/strict';
import { buildEvolution, buildKnowledgeGraph } from '../lib/knowledge.js';

const items = [
  { id: 'A', year: 1900, title: 'A', concepts: ['trust'], created_at: '2026-01-01', experiment: { hypothesis: 'Test A' }, connections: [] },
  { id: 'B', year: 1950, title: 'B', concepts: ['trust', 'exchange'], created_at: '2026-01-02', experiment: { hypothesis: 'Test B' }, connections: [{ target_id: 'A', type: 'EXTENDS', concept: 'trust', reason: 'Adds a mechanism', confidence: .8 }] }
];
const graph = buildKnowledgeGraph(items);
assert.ok(graph.edges.some(edge => edge.type === 'CONCEPTUAL_ECHO'));
assert.ok(graph.edges.some(edge => edge.type === 'EXTENDS' && edge.to === 'A'));
const evolution = buildEvolution(items);
assert.deepEqual(evolution.events[0].strengthened_concepts, ['trust']);
assert.equal(evolution.open_experiments[0].id, 'B');
console.log('PASS: typed connections and evolution events are derived deterministically.');
