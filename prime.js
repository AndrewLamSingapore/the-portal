/**
 * Private PRIME client.
 *
 * Uses Supabase Auth over plain fetch (the deployment's CSP forbids third-party
 * scripts), keeps the session in this browser only, and never renders private
 * content until /api/prime has answered. The server re-checks everything; this
 * script is presentation, not authority.
 *
 * Every action that talks to the network must end in a visible outcome - either
 * the page advances, or the visitor is told in plain language what failed and
 * what to do next. A blocked, offline or rejected request may never leave the
 * page looking inert: that is exactly how the password-recovery submit failed
 * on the owner's iPhone, where the deployment policy silently refused the
 * identity request and the rejected promise had nowhere to report itself.
 */
const SUPABASE_URL = 'https://vtrfgckzpjgtmqsnumur.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_zsgA314WZue1tlu_Kt-SDQ_UopdKMNs';
const SESSION_KEY = 'portal-prime-session-v1';
const MODE = document.body.dataset.primeMode || 'summary';

const UNREACHABLE = 'PRIME could not reach its identity service, so nothing was saved. Check your connection, then reload and try again.';
const UNEXPECTED = 'PRIME hit an unexpected problem and nothing was saved. Reload the page and try again.';
const LINK_EXPIRED = 'That recovery link is no longer valid. Request a new one and try again.';
const WEAK_PASSWORD = 'That password is too weak, or it was used before. Choose a stronger password you have not used here yet.';

const el = (id) => document.getElementById(id);

/** Writes a message where the visitor is already looking, and never throws. */
function say(id, message) {
  const node = el(id);
  if (node) node.textContent = message;
  return Boolean(node);
}

/** The state panel currently on screen ('loading' before the first render). */
function visibleState() {
  const panel = [...document.querySelectorAll('[data-state]')].find((node) => !node.hidden);
  return panel?.dataset.state || 'loading';
}

/**
 * Every Supabase Auth request goes through here. A transport failure - offline,
 * DNS, or the deployment's Content Security Policy refusing the origin - becomes
 * a result the caller can render, so it can never become a silent no-op.
 */
async function authRequest(path, options) {
  try {
    return await fetch(`${SUPABASE_URL}${path}`, options);
  } catch {
    return { ok: false, status: 0, transport: true };
  }
}

/** Reads Supabase's implicit-flow material out of the URL fragment. */
function recoveryMaterial() {
  const hash = String(location.hash || '').replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access = params.get('access_token');
  const error = params.get('error_description') || params.get('error');
  if (!access && !error) return null;
  return {
    access,
    refresh: params.get('refresh_token'),
    expiresIn: Number(params.get('expires_in') || 3600),
    type: params.get('type') || '',
    error,
  };
}

/**
 * Removes authentication material from the visible URL immediately: tokens in
 * the address bar leak through screenshots, history, referrers and shared links.
 */
function clearAuthFromUrl() {
  if (!location.hash) return;
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}

const session = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
};
const remember = (value) => {
  if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else localStorage.removeItem(SESSION_KEY);
};

/**
 * Supabase can also deliver recovery material in the query string (`?code=`,
 * or `?error_description=` when a link was rejected) when a project uses PKCE.
 * PRIME consumes the implicit-flow fragment, so say so plainly and take the
 * material out of the address bar instead of rendering an unexplained sign-in
 * form. `?id=` on the reports page is not touched here.
 */
function unusableLinkMaterial() {
  const params = new URLSearchParams(location.search);
  if (params.get('error_description') || params.get('error')) {
    return 'That recovery link was rejected before it reached PRIME. Request a new one.';
  }
  if (params.get('code')) {
    return 'That recovery link cannot be completed in this browser. Request a new one.';
  }
  return '';
}

/** Removes query-string authentication material from the visible URL. */
function clearLinkFromUrl() {
  const params = new URLSearchParams(location.search);
  for (const key of ['code', 'error', 'error_code', 'error_description']) params.delete(key);
  const rest = params.toString();
  history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}`);
}

async function token() {
  const current = session();
  if (!current?.access_token) return null;
  if (current.expires_at && current.expires_at - 30 > Date.now() / 1000) return current.access_token;
  if (!current.refresh_token) return null;
  const response = await authRequest('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  });
  if (!response.ok) { remember(null); return null; }
  const next = await response.json().catch(() => null);
  if (!next?.access_token) { remember(null); return null; }
  remember({ access_token: next.access_token, refresh_token: next.refresh_token, expires_at: next.expires_at });
  return next.access_token;
}

function show(state) {
  for (const panel of document.querySelectorAll('[data-state]')) {
    panel.hidden = panel.dataset.state !== state;
  }
}

function renderReports(reports) {
  const list = el('reportList');
  if (!list) return;
  if (!reports.length) {
    list.innerHTML = '<li class="muted">No reports are visible to this identity yet.</li>';
    return;
  }
  list.innerHTML = reports.map((report) => `<li><a href="/reports?id=${encodeURIComponent(report.id)}">
    <strong>${String(report.objective).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</strong>
    <span class="muted">${report.status} \u00b7 ${report.visibility} \u00b7 ${new Date(report.created_at).toISOString().slice(0, 10)}</span></a></li>`).join('');
}

/** Updates the password with the recovery session. Always reports its outcome. */
async function setNewPassword(password) {
  const current = session();
  const access = current?.access_token || await token();
  if (!access) {
    say('recoveryStatus', '');
    say('recoveryError', LINK_EXPIRED);
    return { ok: false };
  }
  const response = await authRequest('/auth/v1/user', {
    method: 'PUT',
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (response.transport) {
    say('recoveryStatus', '');
    say('recoveryError', UNREACHABLE);
    return { ok: false };
  }
  if (response.status === 401 || response.status === 403) {
    remember(null);
    say('recoveryStatus', '');
    say('recoveryError', LINK_EXPIRED);
    return { ok: false };
  }
  if (response.status === 422) {
    say('recoveryStatus', '');
    say('recoveryError', WEAK_PASSWORD);
    return { ok: false };
  }
  if (!response.ok) {
    say('recoveryStatus', '');
    say('recoveryError', `The password was not changed (the identity service answered ${response.status}). Request a new recovery link and try again.`);
    return { ok: false };
  }
  say('recoveryError', '');
  say('recoveryStatus', 'Password updated. Continuing to private operations...');
  const established = session();
  if (established) remember({ ...established, recovery: false });
  await load();
  return { ok: true };
}

/** A recovery link points at /prime; other pages hand the session over to it. */
function showRecovery() {
  if (!el('setPasswordForm')) {
    location.replace('/prime');
    return false;
  }
  show('recovery');
  return true;
}

async function load() {
  show('loading');
  const recovery = recoveryMaterial();
  if (recovery) {
    // Consume the fragment before anything else can read, log or render it.
    if (recovery.access) {
      remember({
        access_token: recovery.access,
        refresh_token: recovery.refresh || null,
        expires_at: Math.floor(Date.now() / 1000) + recovery.expiresIn,
        recovery: true,
      });
    }
    clearAuthFromUrl();
    if (recovery.error || !recovery.access) {
      say('recoveryError', 'That recovery link is no longer valid. Request a new one.');
    }
    return showRecovery();
  }
  const unusable = unusableLinkMaterial();
  if (unusable && !session()?.access_token) {
    clearLinkFromUrl();
    say('recoveryError', unusable);
    return showRecovery();
  }
  // A recovery session that has not set a password yet keeps offering the step,
  // including after a hand-over from a page that has no recovery panel.
  if (session()?.recovery === true && el('setPasswordForm')) return show('recovery');
  const access = await token();
  if (!access) return show('anonymous');
  let response;
  try {
    response = await fetch('/api/prime', { headers: { Authorization: `Bearer ${access}` } });
  } catch {
    return show('unavailable');
  }
  if (response.status === 401) { remember(null); return show('anonymous'); }
  if (response.status === 403) return show('unmapped');
  if (!response.ok) return show('unavailable');
  const payload = await response.json().catch(() => null);
  if (!payload?.identity) return show('unavailable');
  if (el('identity')) {
    el('identity').textContent = `${payload.identity.display_name} \u00b7 ${payload.identity.role} \u00b7 ${payload.identity.person_key}`;
  }
  renderReports(payload.reports || []);
  show('ready');
  if (MODE === 'reports') await loadDetail(access);
}

async function loadDetail(access) {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return;
  const detail = el('reportDetail');
  if (!detail) return;
  let response;
  try {
    response = await fetch(`/api/prime/report?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${access}` } });
  } catch {
    detail.textContent = 'The report could not be loaded. Try again shortly.';
    return;
  }
  if (response.status === 404) { detail.textContent = 'That report is not available to this identity.'; return; }
  if (!response.ok) { detail.textContent = 'The report could not be loaded. Try again shortly.'; return; }
  const { report } = (await response.json().catch(() => ({}))) || {};
  if (!report) { detail.textContent = 'The report could not be loaded. Try again shortly.'; return; }
  detail.textContent = '';
  const heading = document.createElement('h3');
  heading.textContent = report.objective;
  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = `${report.status} \u00b7 ${report.visibility} \u00b7 ${report.id}`;
  const summary = document.createElement('p');
  summary.textContent = report.summary || '';
  detail.append(heading, meta, summary);
}

const value = (id) => el(id)?.value ?? '';

el('signInForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = el('signInForm')?.querySelector('button[type="submit"]');
  try {
    say('signInError', '');
    const email = value('email').trim();
    const password = value('password');
    if (button) button.disabled = true;
    const response = await authRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (response.transport) { say('signInError', UNREACHABLE); return; }
    if (!response.ok) {
      say('signInError', response.status === 400 ? 'Those credentials were not accepted.' : 'Sign-in is temporarily unavailable. Try again shortly.');
      return;
    }
    const next = await response.json().catch(() => null);
    if (!next?.access_token) { say('signInError', 'Sign-in is temporarily unavailable. Try again shortly.'); return; }
    remember({ access_token: next.access_token, refresh_token: next.refresh_token, expires_at: next.expires_at });
    if (el('password')) el('password').value = '';
    await load();
  } catch {
    say('signInError', UNEXPECTED);
  } finally {
    if (button) button.disabled = false;
  }
});

// Every state renders its own Sign out button, so bind each one by attribute
// rather than by a duplicated id (duplicate ids made the ready-state button dead).
for (const button of document.querySelectorAll('[data-signout]')) {
  button.addEventListener('click', async () => {
    try {
      const current = session();
      if (current?.access_token) {
        await authRequest('/auth/v1/logout', {
          method: 'POST',
          headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${current.access_token}` },
        });
      }
    } catch {
      // Revoking the remote session is best effort; the local guarantee below stands.
    } finally {
      remember(null);
      if (el('reportDetail')) el('reportDetail').textContent = '';
      if (el('reportList')) el('reportList').innerHTML = '';
      if (el('identity')) el('identity').textContent = '';
      show('anonymous');
    }
  });
}

el('setPasswordForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = el('setPasswordForm')?.querySelector('button[type="submit"]');
  try {
    say('recoveryError', '');
    say('recoveryStatus', '');
    const chosen = value('newPassword');
    if (chosen.length < 8) { say('recoveryError', 'Use at least 8 characters.'); return; }
    if (chosen !== value('confirmPassword')) { say('recoveryError', 'The two passwords do not match.'); return; }
    if (button) button.disabled = true;
    say('recoveryStatus', 'Saving your new password...');
    const outcome = await setNewPassword(chosen);
    if (!outcome.ok) return;
    if (el('newPassword')) el('newPassword').value = '';
    if (el('confirmPassword')) el('confirmPassword').value = '';
  } catch {
    say('recoveryStatus', '');
    say('recoveryError', UNEXPECTED);
  } finally {
    if (button) button.disabled = false;
  }
});

window.addEventListener('pageshow', (event) => { if (event.persisted) load(); });
window.addEventListener('hashchange', () => { if (recoveryMaterial()) load(); });

/**
 * Last line of defence: whatever else goes wrong, the set-password step must
 * still say something instead of appearing to ignore the visitor.
 */
function announceUnexpected() {
  const state = visibleState();
  if (state === 'recovery') {
    if (String(el('recoveryError')?.textContent || '').trim()) return;
    say('recoveryStatus', '');
    say('recoveryError', UNEXPECTED);
    return;
  }
  if (state === 'anonymous' && !String(el('signInError')?.textContent || '').trim()) {
    say('signInError', UNEXPECTED);
    return;
  }
  if (state === 'loading') show('unavailable');
}
window.addEventListener('unhandledrejection', announceUnexpected);
window.addEventListener('error', announceUnexpected);

try {
  await load();
} catch {
  announceUnexpected();
}
