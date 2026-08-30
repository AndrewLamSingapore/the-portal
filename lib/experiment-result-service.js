import crypto from 'node:crypto';

import { canonicalExperimentResult, validatePrimeExperimentResult } from './experiment-result.js';

function bearerMatches(authorization, expected) {
  const header = String(authorization || '');
  const supplied = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : '';
  const left = Buffer.from(String(expected || ''));
  const right = Buffer.from(supplied);
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function acceptExperimentResult({ authorization, expectedToken, payload, store }) {
  if (!expectedToken) return { status: 503, body: { error: 'PRIME result authentication is not configured' } };
  if (!bearerMatches(authorization, expectedToken)) return { status: 401, body: { error: 'Invalid integration token' } };

  let result;
  try {
    result = validatePrimeExperimentResult(payload?.result);
  } catch (error) {
    return { status: 422, body: { error: String(error?.message || error).slice(0, 300) } };
  }

  const existing = await store.get(result.experiment_id);
  if (existing) {
    if (result.result_version < existing.result_version) {
      return { status: 409, body: { error: 'Stale experiment result version' } };
    }
    if (result.result_version === existing.result_version) {
      if (canonicalExperimentResult(existing.result_json) !== canonicalExperimentResult(result)) {
        return { status: 409, body: { error: 'Result version replay contains conflicting data' } };
      }
      return { status: 200, body: { accepted: true, result_id: result.result_id, idempotent: true, graph_updated: true } };
    }
  }

  const saved = await store.save(result);
  if (Number(saved?.result_version) !== result.result_version || saved?.result_id !== result.result_id) {
    return { status: 409, body: { error: 'A newer concurrent result already controls this experiment' } };
  }
  return { status: 200, body: { accepted: true, result_id: result.result_id, idempotent: false, graph_updated: true } };
}
