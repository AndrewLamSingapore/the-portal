import { randomUUID } from 'node:crypto';
import { ARTIFACT_GENERATION_LIMITS } from './artifact-generation.js';
import { db } from './db.js';
import { ADMISSION_POLICY, ADMISSION_SCHEMA_STATEMENTS } from './generation-admission-schema.js';
export { ADMISSION_POLICY };

const bootstraps = new WeakMap();
export class GenerationAdmissionError extends Error {
  constructor() { super('Shared generation controls unavailable'); this.name = 'GenerationAdmissionError'; }
}
export async function ensureGenerationAdmission(sql = db()) {
  if (!sql) throw new GenerationAdmissionError();
  let ready = bootstraps.get(sql);
  if (!ready) {
    ready = sql.transaction(ADMISSION_SCHEMA_STATEMENTS.map(statement => sql.query(statement)),
      { fetchOptions: { signal: AbortSignal.timeout(8000) } });
    bootstraps.set(sql, ready);
    try { await ready; }
    catch { bootstraps.delete(sql); throw new GenerationAdmissionError(); }
  } else await ready;
  return sql;
}
export async function admitGeneration(clientHash) {
  try {
    if (Object.entries(ARTIFACT_GENERATION_LIMITS).some(([key, value]) => ADMISSION_POLICY[key] !== value)) throw new GenerationAdmissionError();
    const sql = await ensureGenerationAdmission();
    const requestId = randomUUID(); // Never accept a ticket ID from public input.
    const results = await sql.transaction([
      sql.query("SET LOCAL statement_timeout = '5000ms'"),
      sql.query('SELECT * FROM portal_generation_admission.admit($1::uuid, $2)', [requestId, clientHash])
    ], { fetchOptions: { signal: AbortSignal.timeout(8000) } });
    const admission = results[1]?.[0];
    if (typeof admission?.accepted !== 'boolean' || admission.request_id !== requestId
        || !['admitted', 'credit_exhausted', 'client_rate_limited', 'global_rate_limited',
          'concurrency_limited', 'duplicate_request', 'invalid_identity'].includes(admission.reason)
        || (admission.accepted !== (admission.reason === 'admitted'))) throw new GenerationAdmissionError();
    const allowance = Number(admission.allowance_micro_usd), reserved = Number(admission.reserved_micro_usd), remaining = Number(admission.remaining_micro_usd);
    if (![allowance, reserved, remaining].every(Number.isSafeInteger) || allowance !== ADMISSION_POLICY.allowanceMicroUsd
        || reserved < 0 || reserved > allowance || remaining !== allowance - reserved
        || reserved % ADMISSION_POLICY.reservationMicroUsd !== 0 || (admission.accepted && reserved === 0)) throw new GenerationAdmissionError();
    return { ...admission, allowance_micro_usd: allowance, reserved_micro_usd: reserved, remaining_micro_usd: remaining };
  } catch { throw new GenerationAdmissionError(); }
}
export async function finishGeneration(requestId) {
  const sql = db();
  if (!sql) return;
  await sql.transaction([
    sql.query("SET LOCAL statement_timeout = '2000ms'"),
    sql.query('SELECT portal_generation_admission.finish($1::uuid)', [requestId])
  ], { fetchOptions: { signal: AbortSignal.timeout(3000) } });
}
