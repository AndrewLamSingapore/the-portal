import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter(file => fs.existsSync(file))
  .filter(file => !/\.(?:mp3|png|jpe?g|gif|webp|ico|woff2?|pdf)$/i.test(file));
const openAiKey = new RegExp(['s', 'k', '-', '[A-Za-z0-9_-]{20,}'].join(''));
const databaseCredential = new RegExp(['postgres', '(?:ql)?', ':\\/\\/', '[^\\s]+', ':', '[^\\s]+', '@'].join(''), 'i');

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  assert.ok(!openAiKey.test(source), `${file} contains key-like material`);
  assert.ok(!databaseCredential.test(source), `${file} contains database credential-like material`);
}

const workflow = fs.readFileSync('.github/workflows/quality.yml', 'utf8');
assert.ok(workflow.includes('permissions:\n  contents: read'), 'quality workflow must retain read-only permissions');
assert.ok(!workflow.includes('${{ secrets.'), 'production smoke must not receive repository secrets');
assert.ok(!/^\s*(?:run:\s*)?(?:printenv|env)(?:\s|$)/m.test(workflow), 'workflow must not dump its environment');
assert.ok(!/set\s+-x/.test(workflow), 'workflow must not enable shell tracing');

console.log(`PASS: ${files.length} tracked text files and CI logging policy contain no secret-like material.`);
