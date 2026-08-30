import { buildContinuousModel, buildEvolution, buildKnowledgeGraph } from './knowledge.js';
import { db, findArtifacts } from './db.js';

const MAX_ITEMS = 60;

export async function ensureAutonomySchema() {
  const sql = db();
  if (!sql) return false;
  await sql`create table if not exists portal_autonomy_runs(
    run_id text primary key,
    run_key text not null unique,
    status text not null,
    item_count integer not null default 0,
    digest_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  )`;
  return true;
}

function dailyRunKey(now = new Date()) {
  return `portal-autonomy:${now.toISOString().slice(0, 10)}`;
}

export async function runAutonomyCycle({ now = new Date(), limit = MAX_ITEMS } = {}) {
  const enabled = process.env.PORTAL_AUTONOMY_ENABLED === '1';
  if (!enabled) return { status: 'DISABLED', reason: 'PORTAL_AUTONOMY_ENABLED is not 1' };
  if (!db()) return { status: 'BLOCKED', reason: 'DATABASE_URL is required for durable autonomous runs' };

  await ensureAutonomySchema();
  const sql = db();
  const runKey = dailyRunKey(now);
  const existing = await sql`select run_id,status,item_count,digest_json,created_at from portal_autonomy_runs where run_key=${runKey} limit 1`;
  if (existing[0]) return { status: 'IDEMPOTENT_REPLAY', run: existing[0] };

  const items = await findArtifacts({ limit: Math.min(MAX_ITEMS, Math.max(1, Number(limit) || MAX_ITEMS)) });
  const graph = buildKnowledgeGraph(items);
  const evolution = buildEvolution(items);
  const continuous = buildContinuousModel(items);
  const digest = {
    generated_at: now.toISOString(),
    item_count: items.length,
    graph: { node_count: graph.nodes.length, edge_count: graph.edges.length },
    emerging_concepts: evolution.emerging_concepts,
    recent_evolution: evolution.events.slice(0, 8),
    open_experiments: evolution.open_experiments.slice(0, 5),
    recurrence_conditions: continuous.recurrence_conditions,
    realization_watchlist: continuous.realization_watchlist,
    evidence_boundary: continuous.evidence_boundary
  };
  const runId = crypto.randomUUID();
  const rows = await sql`insert into portal_autonomy_runs(run_id,run_key,status,item_count,digest_json)
    values(${runId},${runKey},'COMPLETED',${items.length},${JSON.stringify(digest)}::jsonb)
    returning run_id,status,item_count,digest_json,created_at`;
  return { status: 'COMPLETED', run: rows[0] };
}

export async function latestAutonomyDigest() {
  const sql = db();
  if (!sql) return null;
  await ensureAutonomySchema();
  const rows = await sql`select run_id,status,item_count,digest_json,created_at from portal_autonomy_runs order by created_at desc limit 1`;
  return rows[0] || null;
}
