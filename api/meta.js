import fs from 'node:fs';
import path from 'node:path';

import { db, findArtifacts, getArtifact, hasDatabase } from '../lib/db.js';

const PRODUCT_VERSION = '6.1.0';
const SCHEMA_VERSION = 6;
const EXPERIENCE = 'Continuous Futures Model';
const META_ROUTES = new Set(['capabilities', 'evidence', 'manifest', 'metrics', 'readiness', 'status', 'verify', 'version', 'v2']);

function jsonHeaders(res, cache = 'no-store') {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
}

function allow(req, res, method) {
  if (req.method === method) return true;
  res.setHeader('Allow', method);
  res.status(405).json({ error: 'Method not allowed' });
  return false;
}

function isHttps(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

async function evidenceSchemaReady() {
  if (!hasDatabase()) return false;
  const sql = db();
  const rows = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='artifacts'`;
  const columns = new Set(rows.map(row => row.column_name));
  return ['evidence_level', 'sources', 'relationships', 'experiment', 'connections', 'lifecycle', 'current_phase', 'recurrence_conditions', 'realization_signal'].every(column => columns.has(column));
}

async function handleEvidence(req, res) {
  if (!allow(req, res, 'GET')) return;
  if (!hasDatabase()) return res.status(503).json({ error: 'Archive unavailable' });
  const artifact = await getArtifact(String(req.query?.id || ''));
  if (!artifact) return res.status(404).json({ error: 'Artifact not found' });
  return res.status(200).json({
    id: artifact.id,
    evidence_level: artifact.evidence_level || 'AI-CURATED',
    sources: artifact.sources || [],
    notice: artifact.evidence_level === 'HISTORICALLY-VERIFIED'
      ? 'Curator-reviewed source trail.'
      : 'Discovery object: not independently verified historical authority.'
  });
}

async function handleMetrics(req, res) {
  if (!allow(req, res, 'GET')) return;
  if (!hasDatabase()) return res.status(503).json({ ok: false });
  const artifacts = await findArtifacts({ limit: 60 });
  return res.status(200).json({
    ok: true,
    objects: artifacts.length,
    verified: artifacts.filter(item => item.evidence_level === 'HISTORICALLY-VERIFIED').length,
    sourced: artifacts.filter(item => (item.sources || []).length).length,
    schema_versions: [...new Set(artifacts.map(item => item.schema_version))].sort(),
    oldest: artifacts.length ? Math.min(...artifacts.map(item => item.year)) : null,
    newest: artifacts.length ? Math.max(...artifacts.map(item => item.year)) : null
  });
}

async function handleReadiness(req, res) {
  if (!allow(req, res, 'GET')) return;
  try {
    const database = hasDatabase();
    const artifacts = database ? await findArtifacts({ limit: 60 }) : [];
    const checks = {
      database,
      generation: Boolean(process.env.OPENAI_API_KEY),
      archive: artifacts.length > 0,
      evidence_schema: database ? await evidenceSchemaReady() : false
    };
    const ok = Object.values(checks).every(Boolean);
    return res.status(ok ? 200 : 503).json({ ok, product_version: PRODUCT_VERSION, schema_version: SCHEMA_VERSION, checks });
  } catch {
    return res.status(503).json({ ok: false, product_version: PRODUCT_VERSION, schema_version: SCHEMA_VERSION });
  }
}

async function handleStatus(req, res) {
  if (!allow(req, res, 'GET')) return;
  try {
    const database = hasDatabase();
    const artifacts = database ? await findArtifacts({ limit: 1 }) : [];
    const operational = database && artifacts.length > 0 && await evidenceSchemaReady();
    return res.status(operational ? 200 : 503).json({
      status: operational ? 'OPERATIONAL' : 'DEGRADED',
      archive: database && artifacts.length > 0,
      generation: Boolean(process.env.OPENAI_API_KEY),
      product_version: PRODUCT_VERSION,
      schema_version: operational ? SCHEMA_VERSION : null,
      revision: process.env.VERCEL_GIT_COMMIT_SHA || null,
      checked_at: new Date().toISOString()
    });
  } catch {
    return res.status(503).json({ status: 'DEGRADED', product_version: PRODUCT_VERSION, checked_at: new Date().toISOString() });
  }
}

async function handleVerify(req, res) {
  if (!allow(req, res, 'POST')) return;
  if (!process.env.CURATOR_TOKEN) return res.status(503).json({ error: 'Curator verification not configured' });
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (auth !== process.env.CURATOR_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  if (!hasDatabase()) return res.status(503).json({ error: 'Archive unavailable' });
  const id = String(req.body?.id || '');
  const sources = Array.isArray(req.body?.sources) ? req.body.sources : [];
  if (!id || sources.length < 1 || sources.length > 8 || sources.some(source => !source?.title || !isHttps(source?.url))) {
    return res.status(400).json({ error: 'A valid artifact id and 1–8 HTTPS sources are required' });
  }
  const artifact = await getArtifact(id);
  if (!artifact) return res.status(404).json({ error: 'Artifact not found' });
  const sql = db();
  await sql`update artifacts set evidence_level='HISTORICALLY-VERIFIED',sources=${JSON.stringify(sources)}::jsonb where id=${id}`;
  return res.status(200).json({ ok: true, id, evidence_level: 'HISTORICALLY-VERIFIED', source_count: sources.length });
}

export default async function handler(req, res) {
  const routeValue = Array.isArray(req.query?.route) ? req.query.route[0] : req.query?.route;
  const route = String(routeValue || '');
  if (!META_ROUTES.has(route)) {
    jsonHeaders(res);
    return res.status(404).json({ error: 'Route not found' });
  }

  if (route === 'v2') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).send('Method not allowed');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    return res.send(fs.readFileSync(path.join(process.cwd(), 'v2.html'), 'utf8'));
  }

  jsonHeaders(res, ['capabilities', 'manifest', 'version'].includes(route) ? 'public, s-maxage=3600' : 'no-store');

  if (route === 'capabilities') {
    if (!allow(req, res, 'GET')) return;
    return res.status(200).json({
      complete: true,
      product_version: PRODUCT_VERSION,
      schema_version: SCHEMA_VERSION,
      experience: EXPERIENCE,
      features: {
        evidence_layer: true,
        source_trails: true,
        temporal_graph: true,
        artifact_relationships: true,
        testable_experiments: true,
        typed_connections: true,
        evolution_ledger: true,
        continuous_futures_model: true,
        lifecycle_transitions: true,
        realization_watchlist: true,
        serendipity_engine: true,
        curated_exhibitions: true,
        ai_curator: true,
        private_cabinet: true,
        accessible_dialog: true,
        production_monitoring: true,
        domain_ready: true
      },
      external_commitments: { custom_domain_purchase: false }
    });
  }
  if (route === 'evidence') return handleEvidence(req, res);
  if (route === 'manifest') {
    if (!allow(req, res, 'GET')) return;
    return res.status(200).json({
      product_version: PRODUCT_VERSION,
      schema_version: SCHEMA_VERSION,
      experience: EXPERIENCE,
      capabilities: ['evidence-layer', 'source-trails', 'temporal-graph', 'artifact-relationships', 'testable-experiments', 'typed-connections', 'evolution-ledger', 'continuous-futures-model', 'lifecycle-transitions', 'realization-watchlist', 'serendipity-engine', 'curated-exhibitions', 'ai-curator', 'private-cabinet', 'accessibility-baseline', 'production-monitoring', 'domain-ready'],
      evidence_states: ['AI-CURATED', 'CONCEPTUAL-INFERENCE', 'HISTORICALLY-VERIFIED']
    });
  }
  if (route === 'metrics') return handleMetrics(req, res);
  if (route === 'readiness') return handleReadiness(req, res);
  if (route === 'status') return handleStatus(req, res);
  if (route === 'verify') return handleVerify(req, res);
  if (route === 'version') {
    if (!allow(req, res, 'GET')) return;
    return res.status(200).json({
      product: 'The Portal',
      version: PRODUCT_VERSION,
      schema_version: SCHEMA_VERSION,
      experience: EXPERIENCE,
      revision: process.env.VERCEL_GIT_COMMIT_SHA || null
    });
  }
}
