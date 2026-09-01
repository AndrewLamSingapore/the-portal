import { strict as assert } from 'node:assert';
import { hybridSearch, contradictions } from '../src/lib/semantic-world-model.js';
const nodes=[{id:'a',type:'claim',title:'sensor fusion predicts aquarium risk',provenance:['p1'],evidence_level:'E2'},{id:'b',type:'evidence',title:'sensor trial found no early warning',provenance:['p2'],evidence_level:'E2'}];
assert.equal(hybridSearch('aquarium sensor risk',nodes)[0].node.id,'a');
assert.equal(contradictions(nodes,[{source:'b',target:'a',type:'contradicts',provenance:['p2']}]).length,1);
