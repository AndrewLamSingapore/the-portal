import crypto from 'node:crypto';
import {
  canonicalExperimentResult,
  validatePrimeExperimentResult
} from '../lib/experiment-result.js';
import {
  getExperimentResult,
  hasDatabase,
  saveExperimentResult
} from '../lib/db.js';

function headers(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

function authorized(req) {
  const expected = process.env.PORTAL_RESULT_TOKEN || '';
  if (!expected) return { configured: false, accepted: false };
  const header = String(req.headers?.authorization || '');
  const supplied = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : '';
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return {
    configured: true,
    accepted: left.length === right.length && crypto.timingSafeEqual(left, right)
  };
}

export default async function handler(req, res) {
  headers(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const auth = authorized(req);
  if (!auth.configured) return res.status(503).json({ error: 'PRIME result authentication is not configured' });
  if (!auth.accepted) return res.status(401).json({ error: 'Invalid integration token' });
  if (!hasDatabase()) return res.status(503).json({ error: 'Archive unavailable' });

  let result;
  try {
    result = validatePrimeExperimentResult(req.body?.result);
  } catch (error) {
    return res.status(422).json({ error: String(error?.message || error).slice(0, 300) });
  }
  const existing = await getExperimentResult(result.experiment_id);
  if (existing) {
    if (result.result_version < existing.result_version) {
      return res.status(409).json({ error: 'Stale experiment result version' });
    }
    if (result.result_version === existing.result_version) {
      if (canonicalExperimentResult(existing.result_json) !== canonicalExperimentResult(result)) {
        return res.status(409).json({ error: 'Result version replay contains conflicting data' });
      }
      return res.status(200).json({ accepted: true, result_id: result.result_id, idempotent: true, graph_updated: true });
    }
  }
  const saved = await saveExperimentResult(result);
  if (Number(saved?.result_version) !== result.result_version || saved?.result_id !== result.result_id) {
    return res.status(409).json({ error: 'A newer concurrent result already controls this experiment' });
  }
  return res.status(200).json({ accepted: true, result_id: result.result_id, idempotent: false, graph_updated: true });
}
