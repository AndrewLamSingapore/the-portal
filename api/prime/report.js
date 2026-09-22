/**
 * GET /api/prime/report?id=<report id> — one private report.
 *
 * Object-level authorization is delegated to RLS with the caller's own token,
 * so a MEMBER asking for an owner-only report (or any user asking for someone
 * else's report) gets 404, which does not disclose whether the object exists.
 */
import { authenticate, readReports, resolvePrimeIdentity, sendJson } from '../../lib/prime-auth.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'method_not_allowed' });
  }

  const id = String(request.query?.id || '').trim();
  if (!id || id.length > 128) return sendJson(response, 400, { error: 'report_id_required' });

  const auth = await authenticate(request.headers);
  if (auth.error) return sendJson(response, auth.status, { error: auth.error });

  const mapped = await resolvePrimeIdentity(auth.user, auth.token);
  if (mapped.error) return sendJson(response, mapped.status, { error: mapped.error });

  const reports = await readReports(auth.token, { id });
  if (reports.error) return sendJson(response, reports.status, { error: reports.error });
  if (!reports.rows.length) return sendJson(response, 404, { error: 'report_not_found' });

  return sendJson(response, 200, { identity: { role: mapped.identity.role }, report: reports.rows[0] });
}
