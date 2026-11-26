import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { db, findArtifacts, getArtifact, getExperimentResult, hasDatabase, listExperimentResults, saveExperimentResult } from '../lib/db.js';
import { acceptExperimentResult } from '../lib/experiment-result-service.js';
import { attachExperimentResults } from '../lib/experiment-result.js';
import { validateExperimentCandidate, validatePrimeRelayResponse } from '../lib/experiment-candidate.js';
import { buildKnowledgeGraph } from '../lib/knowledge.js';
import { expandGraphNeighborhood, hybridSearch } from '../src/lib/semantic-world-model.js';
import { semanticScores } from '../lib/semantic-embeddings.js';
import { searchAdmission } from '../lib/search-controls.js';
import { buildBriefing, normalizeSeed, validateFollowup, DiscoveryInputError } from '../lib/discovery-studio.js';
import { listPublicRuns, latestCompletedRun, runOneCycle, setEngineKilled } from '../lib/living-engine.js';
import { buildObservatory } from '../lib/observatory.js';
import { handleEvidenceLab } from '../lib/evidence-lab-endpoint.js';
import { authenticate as primeAuthenticate, publishReport as primePublishReport, readReports as primeReadReports, resolvePrimeIdentity as primeResolveIdentity, sendJson as primeSendJson } from '../lib/prime-auth.js';
import { REPORT_ID_PATTERN, REPORT_LIMITS, validateReport } from '../lib/prime-reports.js';
import { PRODUCT_VERSION } from '../lib/product-version.js';
const SCHEMA_VERSION = 6;
const EXPERIENCE = 'Continuous Futures Model';
const META_ROUTES = new Set(['capabilities', 'discover', 'ecosystem-event', 'engine-kill', 'engine-run', 'engine-runs', 'engine-tick', 'evidence', 'evidence-lab', 'experiment-result', 'manifest', 'metrics', 'observatory', 'prime', 'prime-experiment', 'prime-publish', 'prime-report', 'readiness', 'status', 'verify', 'version', 'v2']);

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

async function publicParticipationReady() {
  if (!hasDatabase()) return false;
  const sql = db();
  const rows = await sql`select to_regclass('public.artifact_verdicts') as verdicts`;
  return Boolean(rows[0]?.verdicts);
}

async function experimentResultSchemaReady() {
  if (!hasDatabase()) return false;
  const sql = db();
  const rows = await sql`select to_regclass('public.experiment_results') as results`;
  return Boolean(rows[0]?.results);
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

async function handleEcosystemEvent(req, res) {
  if (!allow(req, res, 'POST')) return;
  if (!hasDatabase()) return res.status(202).json({ accepted: true, durable: false });
  const event = String(req.body?.event || '');
  if (!['ecosystem_link_clicked', 'ecosystem_referral_received'].includes(event)) return res.status(400).json({ error: 'Invalid event' });
  const raw = req.body?.properties && typeof req.body.properties === 'object' ? req.body.properties : {};
  const permitted = ['app', 'destination', 'placement', 'source', 'medium', 'campaign'];
  const properties = Object.fromEntries(permitted.filter(key => typeof raw[key] === 'string').map(key => [key, raw[key].slice(0, 100)]));
  const sql = db();
  await sql`create table if not exists ecosystem_events(id bigserial primary key,event_name text not null,properties jsonb not null default '{}'::jsonb,created_at timestamptz not null default now())`;
  await sql`insert into ecosystem_events(event_name,properties) values(${event},${JSON.stringify(properties)}::jsonb)`;
  return res.status(202).json({ accepted: true, durable: true });
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
      evidence_schema: database ? await evidenceSchemaReady() : false,
      public_participation: database ? await publicParticipationReady() : false,
      experiment_result_schema: database ? await experimentResultSchemaReady() : false,
      authenticated_result_writing: Boolean(process.env.PORTAL_RESULT_TOKEN)
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
    const operational = database && artifacts.length > 0 && await evidenceSchemaReady() && await publicParticipationReady()
      && await experimentResultSchemaReady() && Boolean(process.env.PORTAL_RESULT_TOKEN);
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

function bearerMatches(req, expected) {
  const header = String(req.headers?.authorization || '');
  const supplied = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : '';
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return Boolean(expected) && left.length === right.length && crypto.timingSafeEqual(left, right);
}

function engineAuthorized(req) {
  return bearerMatches(req, process.env.PORTAL_ENGINE_TOKEN || '');
}

function cronAuthorized(req) {
  return bearerMatches(req, process.env.CRON_SECRET || '');
}

async function handlePrimeExperiment(req, res) {
  if (!allow(req, res, 'POST')) return;
  const ownerToken = process.env.PORTAL_PRIME_TOKEN || '';
  if (!ownerToken) return res.status(503).json({ error: 'Portal PRIME relay authentication is not configured' });
  if (!bearerMatches(req, ownerToken)) return res.status(401).json({ error: 'Invalid relay token' });

  const baseUrl = String(process.env.PRIME_BASE_URL || '').trim().replace(/\/$/, '');
  const primeToken = process.env.PRIME_INTEGRATION_TOKEN || '';
  if (!isHttps(baseUrl) || !primeToken) {
    return res.status(503).json({ error: 'PRIME relay destination is not configured' });
  }

  let candidate;
  try {
    candidate = validateExperimentCandidate(req.body?.candidate);
  } catch (error) {
    return res.status(422).json({ error: String(error?.message || error).slice(0, 300) });
  }

  try {
    const upstream = await fetch(`${baseUrl}/api/integrations/portal/experiments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${primeToken}`
      },
      body: JSON.stringify({ candidate }),
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) {
      return res.status(502).json({
        error: 'PRIME rejected the candidate relay',
        upstream_status: upstream.status
      });
    }
    const response = validatePrimeRelayResponse(await upstream.json(), candidate);
    return res.status(200).json({
      accepted: true,
      candidate_id: candidate.candidate_id,
      experiment_spec: response.experiment_spec,
      idempotent: response.idempotent === true
    });
  } catch (error) {
    return res.status(502).json({
      error: 'PRIME relay failed',
      detail: String(error?.message || error).slice(0, 200)
    });
  }
}

async function handleExperimentResult(req, res) {
  if (!allow(req, res, 'POST')) return;
  const expected = process.env.PORTAL_RESULT_TOKEN || '';
  if (!expected) return res.status(503).json({ error: 'PRIME result authentication is not configured' });
  const header = String(req.headers?.authorization || '');
  const supplied = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : '';
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return res.status(401).json({ error: 'Invalid integration token' });
  }
  if (!hasDatabase()) return res.status(503).json({ error: 'Archive unavailable' });

  const outcome = await acceptExperimentResult({
    authorization: req.headers?.authorization,
    expectedToken: process.env.PORTAL_RESULT_TOKEN,
    payload: req.body,
    store: { get: getExperimentResult, save: saveExperimentResult }
  });
  return res.status(outcome.status).json(outcome.body);
}

async function handlePrime(req, res) {
  const auth = await primeAuthenticate(req.headers);
  if (auth.error) return primeSendJson(res, auth.status, { error: auth.error });
  // Authentication first, then the method: a read-only private route must not
  // silently serve a write verb, and an anonymous caller must never be able to
  // tell a wrong verb from a wrong credential.
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return primeSendJson(res, 405, { error: 'method_not_allowed' });
  }
  const mapped = await primeResolveIdentity(auth.user, auth.token);
  if (mapped.error) return primeSendJson(res, mapped.status, { error: mapped.error });
  const reports = await primeReadReports(auth.token);
  if (reports.error) return primeSendJson(res, reports.status, { error: reports.error });
  return primeSendJson(res, 200, {
    identity: { person_key: mapped.identity.person_key, display_name: mapped.identity.display_name, role: mapped.identity.role },
    reports: reports.rows
  });
}

async function handlePrimeReport(req, res) {
  const auth = await primeAuthenticate(req.headers);
  if (auth.error) return primeSendJson(res, auth.status, { error: auth.error });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return primeSendJson(res, 405, { error: 'method_not_allowed' });
  }
  const id = String(req.query?.id || '').trim();
  if (!id || id.length > 128) return primeSendJson(res, 400, { error: 'report_id_required' });
  // An id that cannot exist is a client error and must never reach the database:
  // a value carrying filter syntax would otherwise be answered as an outage.
  if (!REPORT_ID_PATTERN.test(id)) return primeSendJson(res, 400, { error: 'invalid_report_id' });
  const mapped = await primeResolveIdentity(auth.user, auth.token);
  if (mapped.error) return primeSendJson(res, mapped.status, { error: mapped.error });
  const reports = await primeReadReports(auth.token, { id });
  if (reports.error) return primeSendJson(res, reports.status, { error: reports.error });
  if (!reports.rows.length) return primeSendJson(res, 404, { error: 'report_not_found' });
  return primeSendJson(res, 200, { identity: { role: mapped.identity.role }, report: reports.rows[0] });
}

/** Accepts a Vercel-parsed JSON body, or a raw JSON string, but never a non-object. */
function reportBody(body) {
  if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  if (typeof body === 'string' && body.trim()) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * The producer side of the private domain: a machine publisher pushes a report
 * outward over HTTPS. The credential is required before the method or the body is
 * judged, so a wrong verb can never be told apart from a wrong credential, and
 * only the credential's digest is ever forwarded.
 */
async function handlePrimePublish(req, res) {
  const raw = String(req.headers?.authorization || req.headers?.Authorization || '');
  if (!raw.toLowerCase().startsWith('bearer ')) {
    return primeSendJson(res, 401, { error: 'publisher_credential_required' });
  }
  const publisherToken = raw.slice(7).trim();
  if (!publisherToken) return primeSendJson(res, 401, { error: 'publisher_credential_required' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return primeSendJson(res, 405, { error: 'method_not_allowed' });
  }

  const declaredLength = Number(req.headers?.['content-length'] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > REPORT_LIMITS.bodyBytes) {
    return primeSendJson(res, 413, { error: 'report_too_large' });
  }

  const report = reportBody(req.body);
  if (!report) return primeSendJson(res, 400, { error: 'invalid_report', detail: 'body_must_be_a_json_object' });

  const payload = validateReport(report);
  if (!payload.ok) return primeSendJson(res, 400, { error: 'invalid_report', detail: payload.error });

  const outcome = await primePublishReport(publisherToken, report);
  if (outcome.error) {
    const body = { error: outcome.error };
    if (outcome.detail) body.detail = outcome.detail;
    return primeSendJson(res, outcome.status, body);
  }
  return primeSendJson(res, outcome.published.inserted ? 201 : 200, { published: outcome.published });
}

/**
 * Discovery Studio entry. A visitor's free-text seed is run through the seven
 * public discovery stages using the Portal's existing hybrid semantic graph
 * search plus clearly labelled deterministic scaffolds. No language model is
 * called and nothing is persisted without the visitor's explicit consent.
 */
async function handleDiscover(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let query;
  let followup;
  try {
    query = normalizeSeed(req.body?.query);
    followup = validateFollowup(req.body?.followup);
  } catch (error) {
    return res.status(400).json({ error: error instanceof DiscoveryInputError ? error.message : 'Invalid discovery seed' });
  }

  const admission = await searchAdmission(req);
  if (!admission.allowed) {
    res.setHeader('Retry-After', '60');
    return res.status(admission.status).json({ error: admission.error });
  }
  if (!hasDatabase()) return res.status(503).json({ error: 'Archive unavailable' });

  const [artifacts, results] = await Promise.all([
    findArtifacts({ limit: 60 }),
    listExperimentResults(60)
  ]);
  const graph = attachExperimentResults(buildKnowledgeGraph(artifacts), results);
  const nodes = graph.nodes.map(node => ({ ...node, type: 'asset', provenance: Array.isArray(node.sources) ? node.sources : [] }));
  const semantic = await semanticScores(query, nodes);
  const ranked = hybridSearch(query, nodes, { limit: 12, semanticScorer: (_query, node) => semantic.scores.get(node.id) || 0 });
  const expanded = expandGraphNeighborhood(ranked, graph, { limit: 24 });
  const briefing = buildBriefing({ query, graph, semanticStatus: semantic.status, ranked, expanded, followup });

  return res.status(200).json({
    product: 'The Portal',
    product_version: PRODUCT_VERSION,
    mode: 'DISCOVERY_STUDIO',
    ...briefing
  });
}

async function handleEngineRuns(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!hasDatabase()) return res.status(503).json({ error: 'Archive unavailable' });
  const runs = await listPublicRuns(db());
  return res.status(200).json({ mode: 'LIVING_ENGINE_RUNS', runs });
}

async function handleEngineRun(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.PORTAL_ENGINE_TOKEN) return res.status(503).json({ error: 'Engine admin token is not configured' });
  if (!engineAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!hasDatabase()) return res.status(503).json({ error: 'Archive unavailable' });
  const outcome = await runOneCycle({ sql: db(), owner: 'admin' });
  const status = outcome.status === 'COMPLETED' ? 200 : outcome.status === 'KILLED' ? 409 : outcome.status === 'DISABLED' ? 503 : 200;
  return res.status(status).json({ mode: 'LIVING_ENGINE_RUN', ...outcome });
}

async function handleEngineKill(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.PORTAL_ENGINE_TOKEN) return res.status(503).json({ error: 'Engine admin token is not configured' });
  if (!engineAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!hasDatabase()) return res.status(503).json({ error: 'Archive unavailable' });
  const killed = req.body?.killed === true;
  await setEngineKilled(db(), killed);
  return res.status(200).json({ mode: 'LIVING_ENGINE_KILL', killed });
}

async function handleEngineTick(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!cronAuthorized(req) && !engineAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  const outcome = await runOneCycle({ sql: db(), owner: 'cron' });
  return res.status(200).json({ mode: 'LIVING_ENGINE_TICK', ...outcome });
}

async function handleObservatory(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!hasDatabase()) return res.status(503).json({ error: 'Archive unavailable' });
  const [artifacts, runs, latest, results] = await Promise.all([
    findArtifacts({ limit: 60 }),
    listPublicRuns(db()),
    latestCompletedRun(db()),
    listExperimentResults(20)
  ]);
  const graph = buildKnowledgeGraph(artifacts);
  const payload = buildObservatory({ runs, latestRun: latest, graph, experimentResults: results, productVersion: PRODUCT_VERSION });
  return res.status(200).json(payload);
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

  if (route === 'evidence-lab') return handleEvidenceLab(req, res);

  jsonHeaders(res, ['capabilities', 'manifest', 'version'].includes(route) ? 'public, s-maxage=3600' : 'no-store');

  if (route === 'discover') return handleDiscover(req, res);
  if (route === 'engine-runs') return handleEngineRuns(req, res);
  if (route === 'engine-run') return handleEngineRun(req, res);
  if (route === 'engine-kill') return handleEngineKill(req, res);
  if (route === 'engine-tick') return handleEngineTick(req, res);
  if (route === 'observatory') return handleObservatory(req, res);
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
        anonymous_public_trials: true,
        accessible_dialog: true,
        production_monitoring: true,
        living_observatory: true,
        evolutionary_hypotheses: true,
        falsification_memory: true,
        decisive_experiment: true,
        ethereum_transaction_evidence_lab: true,
        portable_artifact_snapshots: true,
        domain_ready: true
      },
      external_commitments: { custom_domain_purchase: false }
    });
  }
  if (route === 'ecosystem-event') return handleEcosystemEvent(req, res);
  if (route === 'evidence') return handleEvidence(req, res);
  if (route === 'experiment-result') return handleExperimentResult(req, res);
  if (route === 'prime-experiment') return handlePrimeExperiment(req, res);
  if (route === 'prime') return handlePrime(req, res);
  if (route === 'prime-publish') return handlePrimePublish(req, res);
  if (route === 'prime-report') return handlePrimeReport(req, res);
  if (route === 'manifest') {
    if (!allow(req, res, 'GET')) return;
    return res.status(200).json({
      product_version: PRODUCT_VERSION,
      schema_version: SCHEMA_VERSION,
      experience: EXPERIENCE,
      capabilities: ['evidence-layer', 'source-trails', 'temporal-graph', 'artifact-relationships', 'testable-experiments', 'typed-connections', 'evolution-ledger', 'continuous-futures-model', 'lifecycle-transitions', 'realization-watchlist', 'serendipity-engine', 'curated-exhibitions', 'ai-curator', 'private-cabinet', 'anonymous-public-trials', 'ethereum-transaction-evidence-lab', 'portable-artifact-snapshots', 'accessibility-baseline', 'production-monitoring', 'domain-ready'],
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
