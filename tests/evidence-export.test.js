import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildArtifactSnapshot, verifyDocumentDigest } from '../lib/portal-export.js';

const artifact = {
  id: 'portal-test-001',
  title: 'A preserved uncertainty',
  evidence_level: 'CONCEPTUAL-INFERENCE',
  status: 'EXPLORING',
  provenance: 'Deterministic fixture.',
  concepts: ['verification'],
  lifecycle: [{ year: 2026, phase: 'EMERGING', evidence_basis: 'AI-GENERATED-HYPOTHESIS' }]
};

test('exports a reproducible exact artifact snapshot with a valid digest', () => {
  const first = buildArtifactSnapshot(artifact, '2026-09-17T00:00:00.000Z');
  const second = buildArtifactSnapshot(artifact, '2026-09-17T00:00:00.000Z');
  assert.deepEqual(first, second);
  assert.equal(first.artifact.title, artifact.title);
  assert.equal(first.qualification_status, 'CONCEPTUAL-INFERENCE');
  assert.equal(verifyDocumentDigest(first).valid, true);
});

test('detects a modified artifact after export', () => {
  const snapshot = buildArtifactSnapshot(artifact, '2026-09-17T00:00:00.000Z');
  snapshot.artifact.title = 'Tampered title';
  const verification = verifyDocumentDigest(snapshot);
  assert.equal(verification.valid, false);
  assert.notEqual(verification.calculated, verification.expected);
});

test('does not accept an unsealed JSON document', () => {
  assert.equal(verifyDocumentDigest({ artifact }).valid, false);
});

test('preserved live Sepolia evidence retains its recorded digest', () => {
  const report = JSON.parse(fs.readFileSync(new URL('../evidence/evidence-lab-live-sepolia-20260917.json', import.meta.url), 'utf8'));
  assert.equal(verifyDocumentDigest(report).valid, true);
});
