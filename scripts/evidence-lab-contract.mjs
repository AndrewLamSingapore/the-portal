import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const page = read('evidence-lab.html');
const client = read('evidence-lab.js');
const api = read('lib/evidence-lab-endpoint.js');
const verifier = read('lib/ethereum-evidence.js');
const home = read('index.html');

for (const phrase of ['No wallet.', 'No signing.', 'No transaction submission.', 'No contract deployment.', 'actual execution fee', 'Independently check a Portal export']) assert.ok(page.includes(phrase), `missing UI boundary: ${phrase}`);
for (const phrase of ['MATCH','MISMATCH','UNKNOWN','UNSUPPORTED','FINALIZED_UNDER_RPC_SOURCE','Compares the observed transaction with the supplied declaration. It does not establish that the declaration existed or was authorized before execution.']) assert.ok(verifier.includes(phrase), `missing verifier contract: ${phrase}`);
assert.ok(home.includes('/evidence-lab'));
assert.ok(home.includes('/evidence-export.js'));
assert.ok(client.includes("fetch('/api/evidence-lab'"));
assert.ok(api.includes('ALLOWED_RPC_HOSTS'));
assert.ok(api.includes('req.body'));
assert.ok(!api.includes('req.body.rpc'));
assert.ok(!api.includes('OPENAI'));
assert.ok(api.includes('AbortSignal.timeout(8_000)'));
assert.ok(api.includes('current.count > 10'));
console.log('PASS: Evidence Lab static boundaries and browser-to-API contract are intact.');
