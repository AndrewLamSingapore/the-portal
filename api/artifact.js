import crypto from 'node:crypto';

import { ArtifactInputError, MODES, artifactRequestBody, generateArtifact } from '../lib/artifact-generation.js';
import { ADMISSION_POLICY, GenerationAdmissionError, admitGeneration, finishGeneration } from '../lib/generation-admission.js';
import { findArtifacts, hasDatabase, saveArtifact } from '../lib/db.js';

const GENERATION_TIMEOUT_MS = 52_000;

const buckets = globalThis.__portalBuckets || (globalThis.__portalBuckets = new Map());
const WINDOW_MS = 3_600_000;
const MAX_PER_WINDOW = 12;
const MAX_BUCKETS = 4_096;

function ip(req) {
  // Vercel overwrites this ingress header. Generic forwarded headers are client-controlled.
  // Standalone hosting trusts only the socket; missing trusted identity shares one budget.
  const trusted = process.env.VERCEL ? req.headers?.['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
  const address = String(trusted || 'unknown').split(',')[0].trim();
  return crypto.createHash('sha256').update(address).digest('hex');
}

function allowed(key) {
  const now = Date.now();
  // Opportunistic expiry needs no background timer. At capacity, deny new
  // clients rather than evicting active budgets and enabling limit bypass.
  for (const [client, bucket] of buckets) {
    if (now - bucket.start >= WINDOW_MS) buckets.delete(client);
  }
  const bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) return false;
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  if (bucket.count >= MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function canonical(artifact, mode, allowedTargetIds = new Set()) {
  const fingerprint = crypto.createHash('sha256')
    .update([artifact.year, normalize(artifact.title).toLowerCase(), normalize(artifact.description).toLowerCase()].join('|'))
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();
  return {
    ...artifact,
    id: `PTL-${artifact.year}-${fingerprint}`,
    mode,
    schema_version: 6,
    created_at: new Date().toISOString(),
    concepts: [...new Set((artifact.concepts || []).map(normalize).filter(Boolean))],
    // Public generation accepts no source input, so generated objects can never
    // acquire an unverified URL merely because it appeared in model output.
    sources: [],
    lifecycle: (artifact.lifecycle || []).map(event => ({ ...event, evidence_basis: 'AI-GENERATED-HYPOTHESIS' })).sort((a, b) => a.year - b.year),
    connections: (artifact.connections || []).filter((item, index, all) => allowedTargetIds.has(item.target_id) && all.findIndex(other => other.target_id === item.target_id && other.type === item.type) === index)
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Archive not configured' });
  // Independent preview branches must not create additional public spend allowances.
  if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production')
    return res.status(503).json({ error: 'Public generation is unavailable in this environment.' });
  if (!hasDatabase()) return res.status(503).json({ error: 'Shared generation controls unavailable. Please try again later.' });
  const clientHash = ip(req);
  if (!allowed(clientHash)) return res.status(429).json({ error: 'The archive needs time to settle. Try again later.' });

  const mode = typeof req.body?.mode === 'string' && Object.hasOwn(MODES, req.body.mode) ? req.body.mode : 'wander';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  let admission;
  try {
    let context = '', recent = [];
    try {
      recent = await findArtifacts({ limit: 12 });
      context = '\nRECENT ARTIFACTS: ' + recent.map(item => item.id + ': ' + item.year + ' ' + item.title + ' [' + (item.concepts || []).join(', ') + ']').join(' | ');
    } catch { context = ''; }
    // Reject malformed/oversized input before a durable reservation or provider call.
    artifactRequestBody({ mode, context });
    admission = await admitGeneration(clientHash);
    // Acknowledged ledger metadata is response-only; never part of the saved artifact.
    res.setHeader('X-Portal-Generation-Policy', ADMISSION_POLICY.id);
    res.setHeader('X-Portal-Generation-Allowance-MicroUSD', String(admission.allowance_micro_usd));
    res.setHeader('X-Portal-Generation-Reserved-MicroUSD', String(admission.reserved_micro_usd));
    res.setHeader('X-Portal-Generation-Remaining-MicroUSD', String(admission.remaining_micro_usd));
    if (!admission.accepted) {
      if (admission.reason === 'credit_exhausted')
        return res.status(503).json({ error: 'Public generation credit is exhausted. The shared archive remains available.' });
      res.setHeader('Retry-After', String(Math.max(1, Math.min(3600, Number(admission.retry_after_seconds) || 1))));
      return res.status(429).json({ error: 'The archive needs time to settle. Try again later.' });
    }
    if (controller.signal.aborted) throw new DOMException('Archive timed out', 'AbortError');
    const artifact = canonical(await generateArtifact({ mode, context, signal: controller.signal }), mode, new Set(recent.map(item => item.id)));
    try {
      await saveArtifact(artifact);
      artifact.persistence = 'shared';
    } catch (error) {
      console.error('persistence', error?.message || error);
      artifact.persistence = 'local-fallback';
    }
    return res.status(200).json(artifact);
  } catch (error) {
    const controlsUnavailable = error instanceof GenerationAdmissionError;
    const inputRejected = error instanceof ArtifactInputError;
    const timedOut = error?.name === 'AbortError';
    const upstreamFailure = error?.upstream === true || error instanceof TypeError;
    console.error('artifact error', timedOut ? 'timeout' : error?.code || error?.message || error);
    return res.status(controlsUnavailable || inputRejected ? 503 : timedOut ? 504 : upstreamFailure ? 502 : 500).json({
      error: controlsUnavailable ? 'Shared generation controls unavailable. Please try again later.' : inputRejected ? 'Archive context exceeds generation limits. Please try again later.' : timedOut ? 'Archive timed out' : upstreamFailure ? 'Archive generation was incomplete. Please try again.' : 'Archive failure'
    });
  } finally {
    clearTimeout(timer);
    if (admission?.accepted) {
      try { await finishGeneration(admission.request_id); }
      catch { console.error('generation lease completion unavailable'); }
    }
  }
}
