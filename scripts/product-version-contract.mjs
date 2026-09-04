import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRODUCT_VERSION } from '../lib/product-version.js';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(PRODUCT_VERSION, packageJson.version);

const consumers = [
  '../api/health.js',
  '../api/living.js',
  '../api/meta.js',
  '../lib/hypothesis-generation.js',
  './production-smoke.mjs',
  './scientific-acceptance.mjs',
];
const semanticVersionLiteral = /\b\d+\.\d+\.\d+\b/g;

for (const relative of consumers) {
  const source = await readFile(new URL(relative, import.meta.url), 'utf8');
  assert.match(source, /PRODUCT_VERSION/, `${relative} must consume PRODUCT_VERSION`);
  assert.deepEqual(
    source.match(semanticVersionLiteral) || [],
    [],
    `${relative} must not hard-code a semantic product version`,
  );
}

console.log(`PASS: Portal product version is derived from package.json (${PRODUCT_VERSION}).`);
