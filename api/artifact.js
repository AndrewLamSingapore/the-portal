import crypto from 'node:crypto';

import { MODES, generateArtifact } from '../lib/artifact-generation.js';
import { findArtifacts, hasDatabase, saveArtifact } from '../lib/db.js';

const GENERATION_TIMEOUT_MS = 52_000;

const buckets = globalThis.__portalBuckets || (globalThis.__portalBuckets = new Map());
const WINDOW_MS = 3_600_000;
const MAX_PER_WINDOW = 12;

function ip(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
}

function allowed(key) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
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
    schema_version: 5,
    created_at: new Date().toISOString(),
    concepts: [...new Set((artifact.concepts || []).map(normalize).filter(Boolean))],
    // Public generation accepts no source input, so generated objects can never
    // acquire an unverified URL merely because it appeared in model output.
    sources: [],
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
  if (!allowed(ip(req))) return res.status(429).json({ error: 'The archive needs time to settle. Try again later.' });

  const mode = MODES[req.body?.mode] ? req.body.mode : 'wander';
  let context = '', recent = [];
  if (hasDatabase()) {
    try {
      recent = await findArtifacts({ limit: 12 });
      context = `\nRECENT ARTIFACTS: ${recent.map(item => `${item.id}: ${item.year} ${item.title} [${(item.concepts || []).join(', ')}]`).join(' | ')}`;
    } catch {
      context = '';
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  try {
    const artifact = canonical(await generateArtifact({ mode, context, signal: controller.signal }), mode, new Set(recent.map(item => item.id)));
    if (hasDatabase()) {
      try {
        await saveArtifact(artifact);
        artifact.persistence = 'shared';
      } catch (error) {
        console.error('persistence', error?.message || error);
        artifact.persistence = 'local-fallback';
      }
    } else {
      artifact.persistence = 'local';
    }
    return res.status(200).json(artifact);
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    const upstreamFailure = error?.upstream === true || error instanceof TypeError;
    console.error('artifact error', timedOut ? 'timeout' : error?.code || error?.message || error);
    return res.status(timedOut ? 504 : upstreamFailure ? 502 : 500).json({
      error: timedOut ? 'Archive timed out' : upstreamFailure ? 'Archive generation was incomplete. Please try again.' : 'Archive failure'
    });
  } finally {
    clearTimeout(timer);
  }
}
