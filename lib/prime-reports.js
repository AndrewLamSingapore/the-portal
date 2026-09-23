/**
 * Canonical private PRIME report contract.
 *
 * This is the same shape the database enforces in
 * `public.prime_report_payload_error` (migration
 * 20260923120000_prime_report_ingestion.sql). It exists here so a producer can
 * fail loudly before it sends anything, so the API route can answer a malformed
 * body with a 400 instead of a 500, and so the contract is covered by tests that
 * do not need a database.
 *
 * Validation here is convenience and clarity; the database remains the
 * enforcement point. Neither layer grants a client write privilege.
 */
import crypto from 'node:crypto';

export const REPORT_STATUSES = ['VERIFIED', 'PARTIAL', 'FAILED'];
export const REPORT_VISIBILITIES = ['OWNER', 'MEMBER'];
export const REPORT_TEXT_FIELDS = ['mission_id', 'task_id', 'parent_task_id'];
export const REPORT_ARRAY_FIELDS = ['agents', 'artifacts', 'claims'];
export const REPORT_FIELDS = [
  'id',
  'schema_version',
  'mission_id',
  'task_id',
  'parent_task_id',
  'objective',
  'summary',
  'status',
  'visibility',
  ...REPORT_ARRAY_FIELDS,
];

export const REPORT_LIMITS = {
  objective: 500,
  summary: 20_000,
  reference: 200,
  arrayLength: 200,
  arrayBytes: 20_000,
  bodyBytes: 65_536,
};

export const REPORT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;
const SCHEMA_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;

/** Returns { ok: true } or { ok: false, error } with a stable error code. */
export function validateReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return { ok: false, error: 'report_not_an_object' };

  for (const key of Object.keys(report)) {
    if (!REPORT_FIELDS.includes(key)) return { ok: false, error: `unknown_field:${key}` };
  }

  if (typeof report.id !== 'string' || !REPORT_ID_PATTERN.test(report.id)) return { ok: false, error: 'invalid_id' };

  if (typeof report.objective !== 'string' || report.objective.trim().length === 0) {
    return { ok: false, error: 'objective_required' };
  }
  if (report.objective.length > REPORT_LIMITS.objective) return { ok: false, error: 'objective_too_long' };

  if (report.summary !== undefined && typeof report.summary !== 'string') return { ok: false, error: 'invalid_summary' };
  if ((report.summary ?? '').length > REPORT_LIMITS.summary) return { ok: false, error: 'summary_too_long' };

  if (report.schema_version !== undefined && !SCHEMA_VERSION_PATTERN.test(String(report.schema_version))) {
    return { ok: false, error: 'invalid_schema_version' };
  }

  if (!REPORT_STATUSES.includes(report.status)) return { ok: false, error: 'invalid_status' };
  if (report.visibility !== undefined && !REPORT_VISIBILITIES.includes(report.visibility)) {
    return { ok: false, error: 'invalid_visibility' };
  }

  for (const field of REPORT_TEXT_FIELDS) {
    const value = report[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > REPORT_LIMITS.reference) return { ok: false, error: `invalid_${field}` };
  }

  for (const field of REPORT_ARRAY_FIELDS) {
    const value = report[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) return { ok: false, error: `invalid_${field}` };
    if (value.length > REPORT_LIMITS.arrayLength) return { ok: false, error: `too_many_${field}` };
    if (JSON.stringify(value).length > REPORT_LIMITS.arrayBytes) return { ok: false, error: `oversized_${field}` };
  }

  return { ok: true };
}

/** Applies the stored defaults exactly as the database does. */
export function canonicalReport(report) {
  return {
    schema_version: report.schema_version ?? '1.0.0',
    mission_id: report.mission_id || null,
    task_id: report.task_id || null,
    parent_task_id: report.parent_task_id || null,
    objective: String(report.objective).trim(),
    summary: report.summary ?? '',
    status: report.status,
    visibility: report.visibility ?? 'OWNER',
    agents: report.agents ?? [],
    artifacts: report.artifacts ?? [],
    claims: report.claims ?? [],
    id: report.id,
  };
}

/** Stable digest of the canonical report, for evidence records and audit trails. */
export function reportDigest(report) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalReport(report)), 'utf8').digest('hex');
}

/** The digest actually sent to the database; the credential itself never leaves the caller. */
export function publisherTokenDigest(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}
