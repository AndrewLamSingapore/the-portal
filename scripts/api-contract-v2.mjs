import assert from 'node:assert/strict';
import fs from 'node:fs';

const directRoutes = new Set(fs.readdirSync('api').filter(file => file.endsWith('.js')).map(file => file.replace(/\.js$/, '')));
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const rewrittenRoutes = new Set((config.rewrites || []).map(rewrite => rewrite.source.replace(/^\/api\//, '')));
const publicRoutes = ['artifact', 'artifact-v1', 'archive', 'capabilities', 'evidence', 'exhibition', 'exhibitions', 'graph', 'health', 'manifest', 'metrics', 'readiness', 'relationship', 'serendipity', 'status', 'v2', 'verify', 'version'];

for (const route of publicRoutes) {
  assert.ok(directRoutes.has(route) || rewrittenRoutes.has(route), `missing public route /api/${route}`);
}

console.log('PASS: complete public API surface preserved through direct functions and rewrites.');
