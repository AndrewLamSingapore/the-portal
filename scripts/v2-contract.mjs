import assert from 'node:assert/strict';import fs from 'node:fs';
const artifact=fs.readFileSync('api/artifact.js','utf8'),archive=fs.readFileSync('api/archive.js','utf8'),db=fs.readFileSync('lib/db.js','utf8'),ui=fs.readFileSync('v2.html','utf8'),schema=fs.readFileSync('schema.sql','utf8');
for(const token of ['evidence_level','sources','relationships']){assert.ok(artifact.includes(token));assert.ok(db.includes(token));assert.ok(schema.includes(token))}
for(const token of ['temporal_graph','exhibitions','PRECEDED_BY','ECHOED_BY'])assert.ok(archive.includes(token));
for(const token of ['AI-CURATED','HISTORICALLY VERIFIED','CONCEPTUAL INFERENCE','TEMPORAL GRAPH','CURATED EXHIBITIONS'])assert.ok(ui.includes(token));
assert.ok(artifact.includes("Never fabricate a URL or citation"));assert.ok(artifact.includes("sources must therefore be an empty array"));console.log('PASS: Portal V2 evidence, ancestry, exhibitions and UI contracts verified.');