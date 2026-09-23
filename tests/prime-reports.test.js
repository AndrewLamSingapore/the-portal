import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  REPORT_LIMITS,
  canonicalReport,
  publisherTokenDigest,
  reportDigest,
  validateReport,
} from '../lib/prime-reports.js';

const minimal = { id: 'PTL-RPT-EXAMPLE-1', objective: 'Prove the producer contract', status: 'PARTIAL' };

test('a minimal report is acceptable and canonicalises to the stored defaults', () => {
  assert.deepEqual(validateReport(minimal), { ok: true });
  assert.deepEqual(canonicalReport(minimal), {
    schema_version: '1.0.0',
    mission_id: null,
    task_id: null,
    parent_task_id: null,
    objective: 'Prove the producer contract',
    summary: '',
    status: 'PARTIAL',
    visibility: 'OWNER',
    agents: [],
    artifacts: [],
    claims: [],
    id: 'PTL-RPT-EXAMPLE-1',
  });
});

test('a complete report round-trips every field', () => {
  const report = {
    id: 'PTL-RPT-EXAMPLE-2',
    schema_version: '1.2.0',
    mission_id: 'MSN-1',
    task_id: 'TSK-1',
    parent_task_id: 'TSK-0',
    objective: 'Publish a real report',
    summary: 'Summary text.',
    status: 'VERIFIED',
    visibility: 'MEMBER',
    agents: ['a17', 'a18'],
    artifacts: ['sha256:abc'],
    claims: ['claim one'],
  };
  assert.deepEqual(validateReport(report), { ok: true });
  assert.equal(canonicalReport(report).visibility, 'MEMBER');
  assert.deepEqual(canonicalReport(report).agents, ['a17', 'a18']);
});

test('unknown fields are refused rather than silently dropped', () => {
  assert.deepEqual(validateReport({ ...minimal, extra: 1 }), { ok: false, error: 'unknown_field:extra' });
});

test('identity, objective, status and visibility are validated', () => {
  assert.equal(validateReport({ ...minimal, id: 'bad id' }).error, 'invalid_id');
  assert.equal(validateReport({ ...minimal, id: 'ab' }).error, 'invalid_id');
  assert.equal(validateReport({ id: 'PTL-RPT-X', status: 'PARTIAL' }).error, 'objective_required');
  assert.equal(validateReport({ ...minimal, objective: '   ' }).error, 'objective_required');
  assert.equal(validateReport({ ...minimal, status: 'OK' }).error, 'invalid_status');
  assert.equal(validateReport({ ...minimal, visibility: 'PUBLIC' }).error, 'invalid_visibility');
  assert.equal(validateReport({ ...minimal, schema_version: '1' }).error, 'invalid_schema_version');
});

test('text fields and arrays are type- and size-checked', () => {
  assert.equal(validateReport({ ...minimal, mission_id: 7 }).error, 'invalid_mission_id');
  assert.equal(validateReport({ ...minimal, summary: null }).error, 'invalid_summary');
  assert.equal(validateReport({ ...minimal, agents: 'a17' }).error, 'invalid_agents');
  assert.equal(validateReport({ ...minimal, agents: null }).error, 'invalid_agents');
  assert.equal(validateReport({ ...minimal, objective: 'x'.repeat(REPORT_LIMITS.objective + 1) }).error, 'objective_too_long');
  assert.equal(validateReport({ ...minimal, claims: new Array(REPORT_LIMITS.arrayLength + 1).fill('x') }).error, 'too_many_claims');
  assert.equal(validateReport({ ...minimal, artifacts: ['x'.repeat(REPORT_LIMITS.arrayBytes + 1)] }).error, 'oversized_artifacts');
});

test('non-objects are refused', () => {
  assert.equal(validateReport(null).error, 'report_not_an_object');
  assert.equal(validateReport([]).error, 'report_not_an_object');
  assert.equal(validateReport('report').error, 'report_not_an_object');
});

test('the report digest is stable, order-independent and content-sensitive', () => {
  const first = { ...minimal, agents: ['a17'], summary: 'same' };
  const reordered = { status: 'PARTIAL', objective: 'Prove the producer contract', id: 'PTL-RPT-EXAMPLE-1', summary: 'same', agents: ['a17'] };
  assert.equal(reportDigest(first), reportDigest(reordered));
  assert.notEqual(reportDigest(first), reportDigest({ ...first, summary: 'different' }));
  assert.match(reportDigest(first), /^[0-9a-f]{64}$/);
});

test('the credential digest matches the published SHA-256 vector', () => {
  assert.equal(publisherTokenDigest('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
