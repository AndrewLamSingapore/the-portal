import assert from 'node:assert/strict';
import { filterKnowledgeGraph } from '../lib/grounding.js';

const graph = {
  nodes: [
    { id: '1', title: 'Aquarium thermal model', type: 'artifact' },
    { id: '2', title: 'Thermal anomaly evidence', type: 'artifact' },
    { id: '3', title: 'Unrelated history', type: 'artifact' }
  ],
  edges: [
    { source: '1', target: '2', type: 'related' },
    { source: '2', target: '3', type: 'related' }
  ]
};
const result = filterKnowledgeGraph(graph, 'thermal aquarium', 2);
assert.equal(result.nodes.length, 2);
assert.equal(result.nodes[0].id, '1');
assert.equal(result.edges.length, 1);
assert.equal(result.grounding.query, 'thermal aquarium');
assert.equal(result.grounding.limit, 2);
assert.deepEqual(filterKnowledgeGraph(graph, '', 2), graph);
console.log('Portal grounding query contract: OK');
