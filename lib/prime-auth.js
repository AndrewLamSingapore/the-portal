/**
 * Server-side Portal identity and private-report adapter.
 *
 * Authentication is provided by the Portal-owned Neon Auth endpoint. Browser
 * requests carry only the HttpOnly session cookie; the server validates that
 * cookie with Neon Auth before reading the Portal's private Neon tables.
 *
 * The file and route names retain `prime` as a compatibility identifier. They
 * do not denote a separate PRIME product or authority.
 */
import { publisherTokenDigest, validateReport } from './prime-reports.js';
import { portalIdentityStore } from './portal-private-db.js';

export const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Cookie, Authorization',
  'X-Robots-Tag': 'noindex, nofollow',
};

const TIMEOUT_MS = 10_000;
const AUTH_PATHS = {
  login: '/sign-in/email',
  signup: '/sign-up/email',
  logout: '/sign-out',
  requestPasswordReset: '/request-password-reset',
  resetPassword: '/reset-password',
};

function authBaseUrl(explicit) {
  const value = String(explicit || process.env.NEON_AUTH_BASE_URL || '').trim().replace(/\/$/, '');
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

function cookieHeader(headers = {}) {
  return String(headers.cookie || headers.Cookie || '').trim();
}

function setCookiesFrom(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const combined = headers.get('set-cookie');
  return combined ? [combined] : [];
}

export function requestOrigin(req) {
  const forwardedHost = String(req.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers?.host || '').trim();
  const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto === 'http' ? 'http' : 'https';
  return host ? `${protocol}://${host}` : 'https://the-portal-ten.vercel.app';
}

function publicUser(user) {
  if (!user?.id) return null;
  return {
    id: String(user.id),
    email: typeof user.email === 'string' ? user.email : null,
    name: typeof user.name === 'string' ? user.name : null,
  };
}

function sanitizeAuthBody(action, payload) {
  const text = (value, max = 320) => (typeof value === 'string' ? value.slice(0, max) : undefined);
  if (action === 'login') return { email: text(payload?.email), password: text(payload?.password, 1024) };
  if (action === 'signup') return {
    email: text(payload?.email),
    password: text(payload?.password, 1024),
    name: text(payload?.name, 120),
  };
  if (action === 'requestPasswordReset') return {
    email: text(payload?.email),
    redirectTo: text(payload?.redirectTo, 1000),
  };
  if (action === 'resetPassword') return {
    token: text(payload?.token, 2048),
    newPassword: text(payload?.newPassword, 1024),
  };
  return {};
}

export function createPrimeAuthService({
  fetchImpl = fetch,
  store = portalIdentityStore,
  baseUrl = process.env.NEON_AUTH_BASE_URL,
} = {}) {
  const getBaseUrl = () => authBaseUrl(baseUrl);

  async function authRequest(path, { method = 'POST', body, cookie, origin } = {}) {
    const base = getBaseUrl();
    if (!base) return { error: 'auth_unavailable', status: 503 };
    const headers = { Accept: 'application/json', Origin: origin };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await response.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }
      return { response, payload, setCookies: setCookiesFrom(response.headers) };
    } catch {
      return { error: 'auth_unavailable', status: 503 };
    }
  }

  async function authenticate(headers = {}, { origin = 'https://the-portal-ten.vercel.app' } = {}) {
    const cookie = cookieHeader(headers);
    if (!cookie) return { error: 'authentication_required', status: 401 };
    const result = await authRequest('/get-session', { method: 'GET', cookie, origin });
    if (result.error) return result;
    if (!result.response.ok) {
      return result.response.status >= 500
        ? { error: 'authentication_unavailable', status: 503 }
        : { error: 'invalid_session', status: 401 };
    }
    const user = publicUser(result.payload?.user || result.payload?.session?.user);
    if (!user) return { error: 'invalid_session', status: 401 };
    return { user, cookie, setCookies: result.setCookies };
  }

  async function proxyAuth(action, { body, cookie, origin } = {}) {
    if (!Object.hasOwn(AUTH_PATHS, action)) return { error: 'invalid_auth_action', status: 400 };
    const safeBody = sanitizeAuthBody(action, body);
    if (['login', 'signup', 'requestPasswordReset'].includes(action) && !safeBody.email) {
      return { error: 'email_required', status: 400 };
    }
    if (['login', 'signup'].includes(action) && !safeBody.password) {
      return { error: 'password_required', status: 400 };
    }
    if (action === 'resetPassword' && (!safeBody.token || !safeBody.newPassword)) {
      return { error: 'reset_material_required', status: 400 };
    }
    const requestBody = action === 'logout' ? undefined : safeBody;
    const result = await authRequest(AUTH_PATHS[action], {
      method: 'POST',
      body: requestBody,
      cookie,
      origin,
    });
    if (result.error) return result;
    if (!result.response.ok) {
      return {
        error: result.response.status >= 500 ? 'auth_unavailable' : 'auth_rejected',
        status: result.response.status === 422 ? 422 : result.response.status,
      };
    }
    const user = publicUser(result.payload?.user);
    return {
      status: action === 'signup' ? 201 : 200,
      body: {
        ok: true,
        ...(user ? { user } : {}),
        ...(action === 'requestPasswordReset' ? { accepted: true } : {}),
      },
      setCookies: result.setCookies,
    };
  }

  async function resolveIdentity(user) {
    try {
      const identity = await store.getIdentity(user);
      if (!identity?.role || !identity?.person_key) return { error: 'not_mapped', status: 403 };
      return { identity };
    } catch {
      return { error: 'identity_lookup_failed', status: 503 };
    }
  }

  async function readReports(userId, options = {}) {
    try {
      return { rows: await store.readReports(userId, options) };
    } catch {
      return { error: 'report_lookup_failed', status: 503 };
    }
  }

  async function publishReport(publisherToken, report) {
    let response;
    try {
      response = await store.publishReport(publisherTokenDigest(publisherToken), report);
    } catch {
      return { error: 'publish_unavailable', status: 503 };
    }
    if (!response || response.error === 'invalid_credential') {
      return { error: 'publisher_not_authorized', status: 401 };
    }
    if (response.error === 'invalid_payload') {
      return { error: 'invalid_report', status: 400, detail: String(response.detail || 'invalid_payload') };
    }
    if (response.error) return { error: 'publish_rejected', status: 503 };
    return { published: response };
  }

  async function provisionIdentity(ownerId, identity) {
    try {
      const row = await store.provisionIdentity(ownerId, identity);
      return row ? { identity: row } : { error: 'identity_not_created', status: 400 };
    } catch (error) {
      const denied = /row-level security|permission denied/i.test(String(error?.message || error));
      return { error: denied ? 'owner_required' : 'identity_update_failed', status: denied ? 403 : 503 };
    }
  }

  async function registerPublisher(ownerId, publisher) {
    try {
      const row = await store.registerPublisher(ownerId, publisher);
      return row ? { publisher: row } : { error: 'publisher_not_created', status: 400 };
    } catch {
      return { error: 'publisher_update_failed', status: 503 };
    }
  }

  async function revokePublisher(ownerId, publisherKey) {
    try {
      const row = await store.revokePublisher(ownerId, publisherKey);
      return row ? { publisher: row } : { error: 'publisher_not_found', status: 404 };
    } catch {
      return { error: 'publisher_update_failed', status: 503 };
    }
  }

  return {
    authenticate,
    proxyAuth,
    resolveIdentity,
    readReports,
    publishReport,
    provisionIdentity,
    registerPublisher,
    revokePublisher,
    boundaryStatus: () => store.boundaryStatus(),
  };
}

const defaultService = createPrimeAuthService();

export const authenticate = defaultService.authenticate;
export const proxyAuth = defaultService.proxyAuth;
export const resolvePrimeIdentity = defaultService.resolveIdentity;
export const readReports = defaultService.readReports;
export const publishReport = defaultService.publishReport;
export const provisionIdentity = defaultService.provisionIdentity;
export const registerPublisher = defaultService.registerPublisher;
export const revokePublisher = defaultService.revokePublisher;
export const privateBoundaryStatus = defaultService.boundaryStatus;
export { validateReport };

export function sendJson(response, status, payload, extraHeaders = {}) {
  for (const [key, value] of Object.entries({ ...PRIVATE_HEADERS, ...extraHeaders })) response.setHeader(key, value);
  response.status(status).json(payload);
}
