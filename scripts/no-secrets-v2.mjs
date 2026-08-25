import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html', 'app.js', 'styles.css', 'v2.html', 'V2.md', 'CHANGELOG.md', 'api/meta.js']) {
  const source = fs.readFileSync(file, 'utf8');
  assert.ok(!/sk-[A-Za-z0-9_-]{20,}/.test(source), `${file} contains key-like material`);
  assert.ok(!/postgres(?:ql)?:\/\/[^\s]+:[^\s]+@/i.test(source), `${file} contains database credential-like material`);
}

console.log('PASS: no secret-like material in public or consolidated runtime assets.');
