import { strict as assert } from 'node:assert';
import { buildWorldModel, semanticSearch } from './semanticWorldModel.js';
const nodes=[{id:'a',type:'hypothesis',title:'sensor fusion early warning',provenance:['exp:1']},{id:'b',type:'evidence',title:'temperature observation',provenance:['sensor:1']}];
const edges=[{source:'a',target:'b',type:'contradicts'}];
const model=buildWorldModel({nodes,edges});
assert.equal(model.contradictions.length,1);
assert.equal(semanticSearch('early warning sensor',nodes)[0].id,'a');
console.log('semantic world model tests passed');
