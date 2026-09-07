import assert from 'node:assert/strict';

const base=(process.env.PORTAL_URL||'https://the-portal-ten.vercel.app').replace(/\/$/,'');
const timeout=Number(process.env.SMOKE_TIMEOUT_MS||15000);
const get=async path=>{const response=await fetch(base+path,{headers:{'cache-control':'no-cache','user-agent':'portal-inhabitants-smoke'},signal:AbortSignal.timeout(timeout)});return{response,text:await response.text()}};

const [page,script,style,living]=await Promise.all([get('/inhabitants'),get('/inhabitants.js'),get('/inhabitants.css'),get('/api/living')]);
assert.equal(page.response.status,200);
assert.match(page.text,/MEET THE/);
assert.match(page.text,/INHABITANTS/);
assert.match(page.text,/FRIENDLY, NOT AUTHORITATIVE/);
assert.equal(script.response.status,200);
assert.match(script.text,/FEED KNOWLEDGE/);
assert.match(script.text,/REAL-WORLD AUTHORITY BLOCKED/);
assert.equal(style.response.status,200);
assert.match(style.text,/prefers-reduced-motion/);
assert.equal(living.response.status,200);
const data=JSON.parse(living.text);
assert.ok(Array.isArray(data.generations)&&data.generations.length>0);
assert.equal(data.safety.actuation_allowed,false);
assert.equal(data.safety.production_source_mutation_allowed,false);
assert.equal(data.safety.production_database_writes_allowed,false);
assert.equal(data.safety.deployment_mutation_allowed,false);
console.log(`PASS: Living Inhabitants public layer is deployed and evidence-bound (${data.version}).`);
