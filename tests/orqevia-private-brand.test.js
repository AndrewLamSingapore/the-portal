import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { test } from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const brand = 'assets/brands/orqevia/';
const provenance = JSON.parse(read(`${brand}provenance.json`));

test('private pages distribute the approved full original and verified RGB derivatives', () => {
  assert.equal(provenance.original.commit, 'f03ce95d1752f316bca92257b0f7349a48863472');
  assert.equal(provenance.original.sha256, 'b3bdd53cc38b24c8be2896f1174b4d5f083be20f94f2042770224c72e2501844');
  for (const item of [provenance.original, ...provenance.derivatives]) {
    const bytes = read(item.path);
    assert.equal(hash(bytes), item.sha256);
    assert.equal(bytes.length, item.bytes);
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], item.size);
    assert.equal(bytes[24], 8, 'eight-bit original color depth');
    assert.equal(bytes[25], 2, 'RGB without added transparency');
  }
  assert.equal(provenance.derivation.method, 'FULL_IMAGE_RESIZE_LANCZOS');
  assert.equal(provenance.derivation.crop, false);
  assert.equal(provenance.derivation.recolor, false);
  assert.equal(provenance.derivation.redraw, false);
  assert.equal(provenance.derivation.maskable_claim, false);
});

test('both ORQEVIA private pages keep noindex and private entrypoint contracts', () => {
  for (const [name, mode] of [['prime.html', 'summary'], ['reports.html', 'reports']]) {
    const page = read(name).toString();
    assert.match(page, /<title>[^<]*ORQEVIA · 奥启维亚[^<]*<\/title>/);
    assert.match(page, /name="robots" content="noindex, nofollow"/);
    assert.ok(page.includes(`data-prime-mode="${mode}"`));
    assert.match(page, /id="signInForm"/);
    assert.match(page, /src="\/prime\.js"/);
    assert.match(page, /alt="ORQEVIA · 奥启维亚"/);
    assert.match(page, /object-fit:contain;border-radius:0;filter:none/);
    assert.match(page, /property="og:image" content="https:\/\/the-portal-ten\.vercel\.app\/assets\/brands\/orqevia\/generated-original\.png"/);
    for (const filename of ['orqevia-official-v1-192.png', 'orqevia-official-v1-favicon-32.png', 'orqevia-official-v1-favicon-48.png']) {
      assert.ok(page.includes(filename));
    }
    assert.doesNotMatch(page, /PRIME/);
  }
});

test('auth client is exactly the owning baseline after reverting only three display literals', () => {
  let source = read('prime.js').toString().replaceAll('\r\n', '\n');
  for (const [current, historical] of [
    ['ORQEVIA could not reach its identity service', 'PRIME could not reach its identity service'],
    ['ORQEVIA hit an unexpected problem', 'PRIME hit an unexpected problem'],
    ['before it reached ORQEVIA. Request a new one.', 'before it reached PRIME. Request a new one.'],
  ]) {
    assert.equal(source.split(current).length - 1, 1);
    source = source.replace(current, historical);
  }
  // Owning main bcc1eea5; includes SESSION_KEY, all fetches, recovery and authorization behavior.
  assert.equal(hash(source), '93c53d7d8653011d4c68a2c6f18aa64f87ac3c98b46815e5bebd418fc76ef3ff');
});
