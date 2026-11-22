import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKnowledgeGraph } from '../lib/knowledge.js';
import { hybridSearch } from '../src/lib/semantic-world-model.js';

test('archive-to-search projection preserves safe source trails and useful context', () => {
  const artifact = { id:'PTL-2026-AAAAAAAAAA', year:2026, title:'Biological prediction', problem:'Interpreting gene regulation', evidence_level:'AI-CURATED', concepts:['Life'], sources:[
    { title:'Research paper', url:'https://example.org/paper#abstract' },
    { title:'Duplicate section', url:'https://example.org/paper#results' },
    { title:'Unsafe', url:'javascript:alert(1)' },
    { title:'Credential URL', url:'https://name:secret@example.org/private' },
    null,
  ] };
  const before = structuredClone(artifact);
  const graph = buildKnowledgeGraph([artifact]);
  assert.deepEqual(graph.nodes[0].sources, [{title:'Research paper',url:'https://example.org/paper'}]);
  assert.equal(graph.nodes[0].summary, 'Interpreting gene regulation');
  assert.equal(graph.nodes[0].evidence_level, 'AI-CURATED', 'attached links do not promote evidence status');
  const nodes = graph.nodes.map(node => ({...node,type:'asset',provenance:node.sources}));
  const [match] = hybridSearch('gene regulation', nodes);
  assert.equal(match.node.id, artifact.id);
  assert.equal(match.provenance, 1/3);
  assert.deepEqual(artifact, before);
});

test('provenance alone never turns an unrelated record into a search result', () => {
  const nodes = [{id:'a',type:'asset',title:'Medieval pottery',provenance:['source1','source2','source3']}];
  assert.deepEqual(hybridSearch('protein structure', nodes), []);
  assert.equal(hybridSearch('protein structure', nodes, {semanticScorer:()=>.8})[0].node.id, 'a');
});

test('invalid and unbounded semantic scores cannot dominate search ranking', () => {
  const nodes = [{id:'a',type:'asset',title:'Unrelated',provenance:['source']}];
  for (const score of [NaN, Infinity, -1]) assert.deepEqual(hybridSearch('genome',nodes,{semanticScorer:()=>score}),[]);
  assert.equal(hybridSearch('genome',nodes,{semanticScorer:()=>9})[0].semantic,1);
});
