/**
 * GET /api/prime — the Private PRIME summary.
 *
 * 401 without a valid Supabase session, 403 for an authenticated but unmapped
 * user, 200 with the caller's identity and the reports RLS permits them to see.
 * Behaviour does not depend on the UI: this endpoint authorizes on its own.
 */
import { authenticate, readReports, resolvePrimeIdentity, sendJson } from '../../lib/prime-auth.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'method_not_allowed' });
  }

  const auth = await authenticate(request.headers);
  if (auth.error) return sendJson(response, auth.status, { error: auth.error });

  const mapped = await resolvePrimeIdentity(auth.user, auth.token);
  if (mapped.error) return sendJson(response, mapped.status, { error: mapped.error });

  const reports = await readReports(auth.token);
  if (reports.error) return sendJson(response, reports.status, { error: reports.error });

  return sendJson(response, 200, {
    identity: {
      person_key: mapped.identity.person_key,
      display_name: mapped.identity.display_name,
      role: mapped.identity.role,
    },
    reports: reports.rows,
  });
}
