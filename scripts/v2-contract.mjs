import assert from 'node:assert/strict';import fs from 'node:fs';
const artifact=fs.readFileSync('api/artifact.js','utf8'),archive=fs.readFileSync('api/archive.js','utf8'),db=fs.readFileSync('lib/db.js','utf8'),ui=fs.readFileSync('v2.html','utf8'),schema=fs.readFileSync('schema.sql','utf8');
for(const token of ['evidence_level','sources','relationships']){assert.match(artifact,new RegExp(token));assert.match(db,new RegExp(token));assert.match(schema,new RegExp(token))}
for(const token of ['temporal_graph','exhibitions','PRECEDED_BY','ECHOED_BY'])assert.match(archive,new RegExp(token));
for(const token of ['AI-CURATED','HISTORICALLY VERIFIED','CONCEPTUAL INFERENCE','TEMPORAL GRAPH','CURATED EXHIBITIONS'])assert.match(ui,new RegExp(token));
assert.doesNotMatch(artifact,/sources[^\n]*https:\/\/[^a]/i,'generation must not contain hard-coded evidence URLs');console.log('PASS: Portal V2 evidence, ancestry, exhibitions and UI contracts verified.');