/**
 * Server-side Supabase Auth validation and PRIME identity resolution.
 *
 * The publishable key is the project's public client key: it is designed to be
 * shipped and it grants nothing by itself, because every read below is performed
 * with the caller's own access token so Postgres RLS decides what they may see.
 * No service-role credential exists anywhere in this repository or in any
 * browser bundle.
 */
import { publisherTokenDigest } from './prime-reports.js';

export const SUPABASE_URL = 'https://vtrfgckzpjgtmqsnumur.supabase.co';
export const PUBLISHABLE_KEY = 'sb_publishable_zsgA314WZue1tlu_Kt-SDQ_UopdKMNs';

export const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
  'X-Robots-Tag': 'noindex, nofollow',
};

const TIMEOUT_MS = 10_000;

/** Validates the bearer token with Supabase Auth. Returns {user, token} or {error}. */
export async function authenticate(headers = {}) {
  const raw = String(headers.authorization || headers.Authorization || '');
  if (!raw.toLowerCase().startsWith('bearer ')) return { error: 'authentication_required', status: 401 };
  const token = raw.slice(7).trim();
  if (!token) return { error: 'authentication_required', status: 401 };
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { error: 'invalid_session', status: 401 };
    const user = await response.json();
    if (!user?.id) return { error: 'invalid_session', status: 401 };
    return { user, token };
  } catch {
    return { error: 'authentication_unavailable', status: 503 };
  }
}

/**
 * Resolves the caller's PRIME identity through their own token, so the
 * `prime_identities_self_read` policy decides the result. An authenticated user
 * with no mapping row is NOT authorized — authentication and authorization are
 * deliberately separate.
 */
export async function resolvePrimeIdentity(user, token) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/prime_identities?select=role,person_key,display_name&auth_user_id=eq.${encodeURIComponent(user.id)}`,
    { headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  if (!response.ok) return { error: 'identity_lookup_failed', status: 503 };
  const rows = await response.json().catch(() => []);
  const identity = Array.isArray(rows) ? rows[0] : null;
  if (!identity?.role || !identity?.person_key) return { error: 'not_mapped', status: 403 };
  return { identity };
}

/** Reads reports with the caller's token: RLS grants OWNER all, MEMBER member-visible only. */
export async function readReports(token, { id = null, limit = 50 } = {}) {
  const filter = id ? `&id=eq.${encodeURIComponent(id)}` : '';
  const select = id
    ? 'select=id,schema_version,mission_id,task_id,parent_task_id,objective,summary,status,visibility,agents,artifacts,claims,created_at'
    : 'select=id,mission_id,objective,summary,status,visibility,created_at';
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/prime_reports?${select}&order=created_at.desc&limit=${Math.min(Math.max(Number(limit) || 50, 1), 100)}${filter}`,
    { headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  // A rejected query is a client error, not an outage: PostgREST answers 400 for
  // a filter it cannot parse. Reporting 503 there would hide a malformed id such
  // as one carrying filter syntax behind a fake availability failure.
  if (!response.ok) {
    return response.status === 400
      ? { error: 'report_query_invalid', status: 400 }
      : { error: 'report_lookup_failed', status: 503 };
  }
  const rows = await response.json().catch(() => []);
  return { rows: Array.isArray(rows) ? rows : [] };
}

/**
 * Ingests one report from a machine producer.
 *
 * The producer's credential is forwarded only as a SHA-256 digest, and the
 * database decides whether that digest belongs to a live publisher. The caller
 * still uses nothing but the publishable key, so this path cannot write anything
 * a browser session could not be refused: authorisation lives in the function,
 * not in the transport.
 */
export async function publishReport(publisherToken, report) {
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/prime_publish_report`, {
      method: 'POST',
      headers: {
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token_sha256: publisherTokenDigest(publisherToken), p_report: report }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { error: 'publish_unavailable', status: 503 };
  }
  if (!response.ok) return { error: 'publish_unavailable', status: 503 };

  const result = await response.json().catch(() => null);
  if (!result || result.ok !== true) {
    const code = String(result?.error || 'publish_rejected');
    if (code === 'invalid_credential') return { error: 'publisher_not_authorized', status: 401 };
    if (code === 'invalid_payload') {
      return { error: 'invalid_report', status: 400, detail: String(result?.detail || 'invalid_payload') };
    }
    return { error: 'publish_rejected', status: 503 };
  }

  return {
    published: {
      id: result.id,
      publisher: result.publisher,
      inserted: result.inserted === true,
      created_at: result.created_at,
    },
  };
}

export function sendJson(response, status, payload, extraHeaders = {}) {
  for (const [key, value] of Object.entries({ ...PRIVATE_HEADERS, ...extraHeaders })) response.setHeader(key, value);
  response.status(status).json(payload);
}
