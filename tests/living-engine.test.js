import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isEngineEnabled,
  executeDeterministicCycle,
  runOneCycle,
  engineKilled,
  setEngineKilled,
  enqueueJob,
  claimNextJob,
  completeJob,
  appendAudit,
  listPublicRuns
} from '../lib/living-engine.js';

function fakeSql() {
  const jobs = new Map();
  const audit = [];
  let killed = false;
  const sql = async (strings, ...values) => {
    const text = strings.join('?');
    if (text.includes('create table') || text.includes('create index')) return [];
    if (text.includes('insert into living_engine_state') && text.includes('do nothing')) return [];
    if (text.includes('insert into living_engine_state') && text.includes('do update')) {
      killed = values[0] === true;
      return [];
    }
    if (text.includes('select killed from living_engine_state')) return [{ killed }];
    if (text.includes('insert into living_jobs')) {
      const [id, kind, key, payloadJson] = values;
      if ([...jobs.values()].some(job => job.idempotency_key === key)) return [];
      const job = { id, kind, status: 'QUEUED', attempt: 0, lease_owner: null, lease_expires_at: null, idempotency_key: key, payload: JSON.parse(payloadJson), checkpoint: {}, result: {}, error: null, created_at: 'created', started_at: null, finished_at: null };
      jobs.set(id, job);
      return [job];
    }
    if (text.includes("status='RUNNING'")) {
      const job = [...jobs.values()].find(item => item.status === 'QUEUED');
      if (!job) return [];
      job.status = 'RUNNING';
      job.attempt += 1;
      job.lease_owner = values[0];
      job.lease_expires_at = 'future';
      return [job];
    }
    if (text.includes('set checkpoint=')) {
      const id = values[1];
      const job = jobs.get(id);
      if (job) job.checkpoint = { ...job.checkpoint, ...JSON.parse(values[0]) };
      return [];
    }
    if (text.includes('finished_at=now()')) {
      const id = values[3];
      const job = jobs.get(id);
      if (job) {
        job.status = values[0];
        job.result = JSON.parse(values[1]);
        job.error = values[2];
        job.lease_owner = null;
      }
      return [];
    }
    if (text.includes('insert into living_audit')) {
      audit.push({ event: values[0], job_id: values[1], detail: JSON.parse(values[2]) });
      return [];
    }
    if (text.includes('from living_jobs order by created_at desc')) {
      return [...jobs.values()].map(job => ({ ...job }));
    }
    return [];
  };
  return { sql, jobs, audit, get killed() { return killed; } };
}

test('engine is disabled unless the explicit flag is set', () => {
  const previous = process.env.PORTAL_LIVING_ENGINE_ENABLED;
  delete process.env.PORTAL_LIVING_ENGINE_ENABLED;
  assert.equal(isEngineEnabled(), false);
  process.env.PORTAL_LIVING_ENGINE_ENABLED = '1';
  assert.equal(isEngineEnabled(), true);
  if (previous === undefined) delete process.env.PORTAL_LIVING_ENGINE_ENABLED; else process.env.PORTAL_LIVING_ENGINE_ENABLED = previous;
});

test('the deterministic cycle is honest about being deterministic and contained', () => {
  const result = executeDeterministicCycle();
  assert.equal(result.deterministic, true);
  assert.equal(result.generation_mode, 'DETERMINISTIC_FALLBACK');
  assert.equal(result.model_calls, 0);
  assert.ok(Array.isArray(result.population) && result.population.length > 0);
  assert.ok(result.population.every(item => item.id && item.statement && item.epistemic_class));
  assert.ok(Array.isArray(result.fossils));
  assert.equal(result.safety.actuation_allowed, false);
  assert.equal(result.safety.production_source_mutation_allowed, false);
  assert.equal(result.safety.deployment_mutation_allowed, false);
  assert.ok(result.verdict);
  assert.ok(Number.isInteger(result.generation_count));
});

test('the engine fails closed without a database', async () => {
  const previous = process.env.PORTAL_LIVING_ENGINE_ENABLED;
  process.env.PORTAL_LIVING_ENGINE_ENABLED = '1';
  const outcome = await runOneCycle({ sql: null });
  assert.equal(outcome.status, 'BLOCKED');
  if (previous === undefined) delete process.env.PORTAL_LIVING_ENGINE_ENABLED; else process.env.PORTAL_LIVING_ENGINE_ENABLED = previous;
});

test('jobs are enqueued idempotently and claimed under a lease', async () => {
  const { sql } = fakeSql();
  const first = await enqueueJob(sql, { idempotencyKey: 'LIVING_CYCLE:2026-11-26T00', payload: { owner: 'test' } });
  const duplicate = await enqueueJob(sql, { idempotencyKey: 'LIVING_CYCLE:2026-11-26T00', payload: { owner: 'test' } });
  assert.ok(first?.id);
  assert.equal(duplicate, null);

  const claimed = await claimNextJob(sql, { owner: 'worker-a' });
  assert.equal(claimed.id, first.id);
  assert.equal(claimed.status, 'RUNNING');
  assert.equal(claimed.attempt, 1);
});

test('the kill switch stops new work and is durable state', async () => {
  const { sql } = fakeSql();
  assert.equal(await engineKilled(sql), false);
  await setEngineKilled(sql, true);
  assert.equal(await engineKilled(sql), true);
  await setEngineKilled(sql, false);
  assert.equal(await engineKilled(sql), false);
});

test('a full cycle completes with an audit trail and a sanitised public feed', async () => {
  const previous = process.env.PORTAL_LIVING_ENGINE_ENABLED;
  process.env.PORTAL_LIVING_ENGINE_ENABLED = '1';
  const { sql, audit } = fakeSql();
  const outcome = await runOneCycle({ sql, owner: 'test' });
  assert.equal(outcome.status, 'COMPLETED');
  assert.equal(outcome.result.deterministic, true);
  assert.ok(audit.some(entry => entry.event === 'job.claimed'));
  assert.ok(audit.some(entry => entry.event === 'job.completed'));

  const runs = await listPublicRuns(sql);
  assert.equal(runs.length, 1);
  const run = runs[0];
  assert.equal(run.status, 'COMPLETED');
  assert.equal(run.generation_mode, 'DETERMINISTIC_FALLBACK');
  assert.equal('lease_owner' in run, false, 'public feed must not expose lease owners');
  assert.equal('payload' in run, false, 'public feed must not expose job payloads');
  assert.equal(run.safety.production_database_writes_allowed, false);

  const second = await runOneCycle({ sql, owner: 'test' });
  assert.equal(second.status, 'SKIPPED', 'the same window must be idempotent');

  await setEngineKilled(sql, true);
  const killed = await runOneCycle({ sql, owner: 'test' });
  assert.equal(killed.status, 'KILLED');

  if (previous === undefined) delete process.env.PORTAL_LIVING_ENGINE_ENABLED; else process.env.PORTAL_LIVING_ENGINE_ENABLED = previous;
});

test('failed jobs record an error without leaking internal detail', async () => {
  const { sql, audit } = fakeSql();
  const job = await enqueueJob(sql, { idempotencyKey: 'LIVING_CYCLE:fail', payload: {} });
  await completeJob(sql, job.id, { status: 'FAILED', error: 'cycle exploded' });
  assert.ok(audit.length === 0 || audit.every(entry => entry.job_id !== job.id));
  const runs = await listPublicRuns(sql);
  assert.equal(runs[0].status, 'FAILED');
  assert.equal(runs[0].error, 'cycle exploded');
});
