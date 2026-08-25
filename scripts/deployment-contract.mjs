import assert from 'node:assert/strict';
import fs from 'node:fs';

const functions = fs.readdirSync('api').filter(file => file.endsWith('.js'));
assert.ok(functions.length <= 12, `Hobby deployment limit exceeded: ${functions.length} functions`);
assert.ok(functions.includes('meta.js'), 'consolidated metadata function missing');

const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const expectedRewrites = ['/api/capabilities', '/api/evidence', '/api/manifest', '/api/metrics', '/api/readiness', '/api/status', '/api/v2', '/api/verify', '/api/version'];
const rewrites = new Map((config.rewrites || []).map(rewrite => [rewrite.source, rewrite.destination]));
for (const route of expectedRewrites) {
  assert.match(rewrites.get(route) || '', /^\/api\/meta\?route=/, `missing consolidated rewrite for ${route}`);
}
assert.equal(config.functions?.['api/artifact.js']?.maxDuration, 60);

console.log(`PASS: deployment contract verified (${functions.length}/12 Vercel Functions).`);
