import assert from 'node:assert/strict';

const base=(process.env.PORTAL_URL||'https://the-portal-ten.vercel.app').replace(/\/$/,'');
const timeoutMs=Number(process.env.SMOKE_TIMEOUT_MS||15000);
async function get(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetch(base+path,{headers:{'user-agent':'the-portal-production-smoke/1.0','cache-control':'no-cache'},signal:controller.signal});return{response,text:await response.text()}}finally{clearTimeout(timer)}}
function json(text,label){try{return JSON.parse(text)}catch{throw new Error(`${label} did not return valid JSON`)}}

console.log(`Production smoke: ${base}`);
const home=await get('/');
assert.equal(home.response.status,200,'homepage must return 200');
assert.match(home.text,/<title>THE PORTAL/i,'homepage must contain Portal title');
assert.match(home.text,/id="archiveCount"/,'homepage must contain archive status surface');
assert.match(home.text,/loadArchive\s*\(/,'client must contain archive initialization logic');
assert.match(home.text,/privateMode\s*\(/,'client must contain bounded private fallback');

const healthResponse=await get('/api/health');
assert.equal(healthResponse.response.status,200,'health endpoint must return 200');
const health=json(healthResponse.text,'health endpoint');
assert.equal(health.ok,true,'health.ok must be true');
assert.equal(health.database,true,'database must be available');
assert.equal(health.archive,true,'archive must be available');
assert.equal(health.generation_configured,true,'AI generation must be configured');
assert.equal(health.has_artifacts,true,'shared archive must contain artifacts');
assert.equal(health.schema_version,3,'schema version must be 3');

const archiveResponse=await get('/api/archive?limit=5');
assert.equal(archiveResponse.response.status,200,'archive endpoint must return 200');
const archive=json(archiveResponse.text,'archive endpoint');
assert.ok(Array.isArray(archive.artifacts),'archive.artifacts must be an array');
assert.ok(archive.artifacts.length>0,'archive must contain at least one artifact');
assert.ok(Number(archive.count)>0,'archive count must be positive');
const first=archive.artifacts[0];
assert.ok(first?.id,'archive artifact must have a canonical id');
assert.match(first.id,/^PTL-\d{4}-[A-F0-9]{10}$/,'canonical artifact id format is invalid');

const artifactResponse=await get(`/api/archive?id=${encodeURIComponent(first.id)}`);
assert.equal(artifactResponse.response.status,200,'known artifact retrieval must return 200');
const artifact=json(artifactResponse.text,'artifact retrieval');
assert.equal(artifact.id,first.id,'retrieved artifact id must match requested id');
assert.ok(artifact.title,'retrieved artifact must have a title');
assert.ok(Array.isArray(artifact.concepts),'retrieved artifact must have concepts');

console.log(`PASS: homepage/init contract, health, generation readiness, archive and artifact retrieval verified (${archive.count} objects visible).`);
