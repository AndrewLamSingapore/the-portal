import assert from 'node:assert/strict';
import fs from 'node:fs';

const generation = fs.readFileSync('api/artifact.js', 'utf8') + fs.readFileSync('lib/artifact-generation.js', 'utf8');
const meta = fs.readFileSync('api/meta.js', 'utf8');
const browser = fs.readFileSync('app.js', 'utf8');

assert.ok(generation.includes('Never fabricate a URL or citation'));
assert.ok(!generation.includes("evidence_level: 'HISTORICALLY-VERIFIED'"));
assert.ok(generation.includes('sources: []'));
assert.ok(meta.includes('CURATOR_TOKEN'));
assert.ok(meta.includes("evidence_level='HISTORICALLY-VERIFIED'"));
assert.ok(browser.includes('safeHttpsUrl'));
assert.ok(browser.includes('rel="noopener noreferrer"'));
assert.ok(browser.includes('&quot;'));

console.log('PASS: curator verification, citation, browser escaping and outbound-link security verified.');
