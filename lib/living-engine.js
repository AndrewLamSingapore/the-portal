/**
 * Living Engine — durable, governed execution for the deterministic discovery
 * cycle. This is a scheduler-and-queue foundation, not model intelligence:
 *
 *   - jobs are persisted with an idempotency key;
 *   - a worker claims a job under a time-bounded lease (crashed leases are
 *     reclaimable);
 *   - progress is checkpointed;
 *   - an append-only audit trail records what happened;
 *   - a database-backed kill switch stops new work even if a process restarts.
 *
 * The cycle itself is the existing deterministic fallback (no language model
 * calls, no external actuation, no production mutation). Every result is
 * labelled DETERMINISTIC_FALLBACK.
 */

import { db } from './db.js';
import { SANDBOX_SEED, runLivingSandbox } from './living-sandbox.js';
import { runGenerations } from './multigeneration.js';
import { LayeredMemory, runExecutiveCycle } from './living-intelligence.js';
import { runDecisiveExperiment } from './decisive-experiment.js';

export const ENGINE_KIND = 'LIVING_CYCLE';
const JOB_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'];
const DEFAULT_LEASE_SECONDS = 60;

export function isEngineEnabled() {
  return process.env.PORTAL_LIVING_ENGINE_ENABLED === '1';
}

export async function ensureEngineSchema(sql) {
  if (!sql) return false;
  await sql`create table if not exists living_jobs(
    id text primary key,
    kind text not null,
    status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','COMPLETED','FAILED','SKIPPED')),
    idempotency_key text not null unique,
    attempt integer not null default 0,
    lease_owner text,
    lease_expires_at timestamptz,
    payload jsonb not null default '{}'::jsonb,
    checkpoint jsonb not null default '{}'::jsonb,
    result jsonb not null default '{}'::jsonb,
    error text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz
  )`;
  await sql`create index if not exists living_jobs_claim_idx on living_jobs(status, created_at)`;
  await sql`create table if not exists living_audit(
    id bigserial primary key,
    event text not null,
    job_id text,
    detail jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists living_audit_created_idx on living_audit(created_at desc)`;
  await sql`create table if not exists living_engine_state(
    id integer primary key default 1,
    killed boolean not null default false,
    updated_at timestamptz not null default now()
  )`;
  await sql`insert into living_engine_state(id,killed) values (1,false) on conflict(id) do nothing`;
  return true;
}

export async function engineKilled(sql) {
  if (!sql) return true;
  await ensureEngineSchema(sql);
  const rows = await sql`select killed from living_engine_state where id=1 limit 1`;
  return Boolean(rows[0]?.killed);
}

export async function setEngineKilled(sql, killed) {
  if (!sql) return false;
  await ensureEngineSchema(sql);
  await sql`insert into living_engine_state(id,killed,updated_at) values (1,${killed === true},now())
    on conflict(id) do update set killed=excluded.killed,updated_at=now()`;
  return killed === true;
}

export async function enqueueJob(sql, { kind = ENGINE_KIND, idempotencyKey, payload = {} }) {
  if (!sql) return null;
  await ensureEngineSchema(sql);
  const id = crypto.randomUUID();
  const rows = await sql`insert into living_jobs(id,kind,idempotency_key,payload)
    values(${id},${kind},${idempotencyKey},${JSON.stringify(payload)}::jsonb)
    on conflict(idempotency_key) do nothing returning id,kind,status,created_at`;
  return rows[0] || null;
}

export async function claimNextJob(sql, { owner, leaseSeconds = DEFAULT_LEASE_SECONDS }) {
  if (!sql) return null;
  await ensureEngineSchema(sql);
  const seconds = Math.max(5, Math.min(300, Number(leaseSeconds) || DEFAULT_LEASE_SECONDS));
  const rows = await sql`
    update living_jobs
    set status='RUNNING',
        lease_owner=${owner},
        lease_expires_at=now() + make_interval(secs => ${seconds}),
        attempt=attempt+1,
        started_at=coalesce(started_at, now())
    where id = (
      select id from living_jobs
      where (status='QUEUED') or (status='RUNNING' and lease_expires_at is not null and lease_expires_at < now())
      order by created_at asc
      for update skip locked
      limit 1
    )
    returning id,kind,status,attempt,created_at`;
  return rows[0] || null;
}

export async function checkpointJob(sql, id, checkpoint = {}) {
  if (!sql || !id) return false;
  await sql`update living_jobs set checkpoint=coalesce(checkpoint,'{}'::jsonb) || ${JSON.stringify(checkpoint)}::jsonb where id=${id}`;
  return true;
}

export async function completeJob(sql, id, { status = 'COMPLETED', result = {}, error = null }) {
  if (!sql || !id) return false;
  if (!JOB_STATUSES.includes(status)) throw new Error(`unsupported job status: ${status}`);
  await sql`update living_jobs
    set status=${status},
        result=${JSON.stringify(result)}::jsonb,
        error=${error ? String(error).slice(0, 1000) : null},
        lease_owner=null,
        lease_expires_at=null,
        finished_at=now()
    where id=${id}`;
  return true;
}

export async function appendAudit(sql, { event, jobId = null, detail = {} }) {
  if (!sql) return false;
  await ensureEngineSchema(sql);
  await sql`insert into living_audit(event,job_id,detail) values(${event},${jobId},${JSON.stringify(detail)}::jsonb)`;
  return true;
}

export function executeDeterministicCycle() {
  const result = runLivingSandbox(SANDBOX_SEED);
  const initial = result.population;
  const generations = runGenerations(initial, 4);
  const finalPopulation = generations.at(-1)?.population || initial;
  const memory = new LayeredMemory();
  for (const hypothesis of finalPopulation) {
    memory.remember({
      id: `MEM-LINEAGE-${hypothesis.id}`,
      layer: 'EPISTEMIC',
      content: { hypothesis: hypothesis.id, ancestry: hypothesis.ancestry, state: hypothesis.state }
    });
  }
  const cognition = runExecutiveCycle({
    goal: 'Challenge survivors and record falsification memory.',
    population: finalPopulation,
    history: result.population,
    memory
  });
  const decisive = runDecisiveExperiment({
    initial,
    cognition,
    observations: result.observations,
    generationMode: 'DETERMINISTIC_FALLBACK',
    history: result.population
  });
  return {
    generated_at: new Date().toISOString(),
    generation_mode: 'DETERMINISTIC_FALLBACK',
    deterministic: true,
    model_calls: 0,
    run_id: result.run_id,
    seed_id: result.seed_id,
    generation_count: generations.length,
    frontier: result.frontier,
    fossil_count: result.fossil_record.length,
    acceptance: result.acceptance,
    verdict: decisive.verdict,
    uncertainty: cognition.metacognition?.uncertainty ?? null,
    population: finalPopulation.map(hypothesis => ({
      id: hypothesis.id,
      statement: hypothesis.statement,
      epistemic_class: hypothesis.epistemic_class,
      state: hypothesis.state,
      confidence: hypothesis.confidence,
      predictions: hypothesis.predictions || [],
      falsifiers: hypothesis.falsifiers || [],
      hard_kill_conditions: hypothesis.hard_kill_conditions || [],
      ancestry: hypothesis.ancestry || null
    })),
    fossils: result.fossil_record.map(fossil => ({
      id: fossil.id,
      statement: fossil.statement,
      final_confidence: fossil.final_confidence,
      superseded_by: fossil.superseded_by || null,
      ancestry: fossil.ancestry || null
    })),
    safety: {
      actuation_allowed: false,
      production_source_mutation_allowed: false,
      production_database_writes_allowed: false,
      deployment_mutation_allowed: false
    }
  };
}

export async function runOneCycle({ sql = db(), owner = 'scheduler', idempotencyKey = null } = {}) {
  if (!isEngineEnabled()) return { status: 'DISABLED', reason: 'PORTAL_LIVING_ENGINE_ENABLED is not 1' };
  if (!sql) return { status: 'BLOCKED', reason: 'DATABASE_URL is required for durable engine runs' };
  await ensureEngineSchema(sql);
  if (await engineKilled(sql)) return { status: 'KILLED', reason: 'Engine kill switch is engaged' };

  // At most one job per hour per invocation source. A duplicate returns without
  // side effects, which keeps concurrent crons and manual triggers idempotent.
  const windowKey = idempotencyKey || `${ENGINE_KIND}:${new Date().toISOString().slice(0, 13)}`;
  const job = await enqueueJob(sql, { kind: ENGINE_KIND, idempotencyKey: windowKey, payload: { owner } });
  if (!job) return { status: 'SKIPPED', reason: 'A run is already recorded for this window' };

  const claimed = await claimNextJob(sql, { owner });
  if (!claimed) return { status: 'SKIPPED', reason: 'No claimable job available' };
  await appendAudit(sql, { event: 'job.claimed', jobId: claimed.id, detail: { owner, attempt: claimed.attempt } });

  try {
    await checkpointJob(sql, claimed.id, { phase: 'cycle_started', owner });
    const result = executeDeterministicCycle();
    await checkpointJob(sql, claimed.id, { phase: 'cycle_completed', generation_count: result.generation_count });
    await completeJob(sql, claimed.id, { status: 'COMPLETED', result });
    await appendAudit(sql, { event: 'job.completed', jobId: claimed.id, detail: { verdict: result.verdict, generation_count: result.generation_count } });
    return { status: 'COMPLETED', job: claimed.id, result };
  } catch (error) {
    const message = String(error?.message || error);
    await completeJob(sql, claimed.id, { status: 'FAILED', error: message });
    await appendAudit(sql, { event: 'job.failed', jobId: claimed.id, detail: { error: message } });
    return { status: 'FAILED', job: claimed.id, error: message };
  }
}

function publicRunSummary(row) {
  const result = row?.result || {};
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    attempt: row.attempt,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    error: row.error ? String(row.error).slice(0, 200) : null,
    generation_mode: result.generation_mode || null,
    model_calls: Number(result.model_calls) || 0,
    expenditure_micro_usd: Number.isFinite(Number(result.expenditure_micro_usd)) ? Number(result.expenditure_micro_usd) : null,
    input_tokens: Number.isFinite(Number(result.usage?.input_tokens)) ? Number(result.usage.input_tokens) : null,
    output_tokens: Number.isFinite(Number(result.usage?.output_tokens)) ? Number(result.usage.output_tokens) : null,
    generation_count: result.generation_count ?? null,
    fossil_count: result.fossil_count ?? null,
    verdict: result.verdict || null,
    safety: result.safety || null
  };
}

export async function listPublicRuns(sql, { limit = 20 } = {}) {
  if (!sql) return [];
  await ensureEngineSchema(sql);
  const n = Math.max(1, Math.min(100, Number(limit) || 20));
  const rows = await sql`select id,kind,status,attempt,created_at,started_at,finished_at,result,error
    from living_jobs order by created_at desc limit ${n}`;
  return rows.map(publicRunSummary);
}

export async function latestCompletedRun(sql) {
  if (!sql) return null;
  await ensureEngineSchema(sql);
  const rows = await sql`select id,kind,status,attempt,created_at,started_at,finished_at,result,error
    from living_jobs where status='COMPLETED'
    order by finished_at desc nulls last, created_at desc limit 1`;
  if (!rows[0]) return null;
  return { ...publicRunSummary(rows[0]), result: rows[0].result || {} };
}

export async function enginePublicStatus(sql) {
  if (!sql) return { enabled: isEngineEnabled(), killed: null, available: false, runs: 0, latest: null };
  await ensureEngineSchema(sql);
  const killed = await engineKilled(sql);
  const countRows = await sql`select count(*)::int as count from living_jobs`;
  const latest = (await listPublicRuns(sql, { limit: 1 }))[0] || null;
  return {
    enabled: isEngineEnabled(),
    killed,
    available: true,
    runs: Number(countRows[0]?.count) || 0,
    latest
  };
}
