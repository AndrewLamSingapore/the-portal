/**
 * Private PRIME client.
 *
 * Uses Supabase Auth over plain fetch (the deployment's CSP forbids third-party
 * scripts), keeps the session in this browser only, and never renders private
 * content until /api/prime has answered. The server re-checks everything; this
 * script is presentation, not authority.
 */
const SUPABASE_URL = 'https://vtrfgckzpjgtmqsnumur.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_zsgA314WZue1tlu_Kt-SDQ_UopdKMNs';
const SESSION_KEY = 'portal-prime-session-v1';
const MODE = document.body.dataset.primeMode || 'summary';

const el = (id) => document.getElementById(id);
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

async function token() {
  const current = session();
  if (!current?.access_token) return null;
  if (current.expires_at && current.expires_at - 30 > Date.now() / 1000) return current.access_token;
  if (!current.refresh_token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  });
  if (!response.ok) { remember(null); return null; }
  const next = await response.json();
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
  if (!reports.length) {
    list.innerHTML = '<li class="muted">No reports are visible to this identity yet.</li>';
    return;
  }
  list.innerHTML = reports.map((report) => `<li><a href="/reports?id=${encodeURIComponent(report.id)}">
    <strong>${report.objective.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</strong>
    <span class="muted">${report.status} · ${report.visibility} · ${new Date(report.created_at).toISOString().slice(0, 10)}</span></a></li>`).join('');
}

async function setNewPassword(password) {
  const current = session();
  const access = current?.access_token || await token();
  if (!access) {
    el('recoveryError').textContent = 'That recovery link has expired. Request a new one and try again.';
    return;
  }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    el('recoveryError').textContent = response.status === 422
      ? 'That password is too weak or was used before. Choose a stronger one.'
      : 'The password could not be updated. Request a new recovery link.';
    return;
  }
  el('recoveryError').textContent = '';
  el('recoveryStatus').textContent = 'Password updated. Continuing to private operations…';
  await load();
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
      });
    }
    clearAuthFromUrl();
    if (recovery.error || !recovery.access) {
      el('recoveryError').textContent = 'That recovery link is no longer valid. Request a new one.';
    }
    return show('recovery');
  }
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
  const payload = await response.json();
  el('identity').textContent = `${payload.identity.display_name} · ${payload.identity.role} · ${payload.identity.person_key}`;
  renderReports(payload.reports || []);
  show('ready');
  if (MODE === 'reports') await loadDetail(access);
}

async function loadDetail(access) {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return;
  const response = await fetch(`/api/prime/report?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${access}` } });
  if (response.status === 404) { el('reportDetail').textContent = 'That report is not available to this identity.'; return; }
  if (!response.ok) { el('reportDetail').textContent = 'The report could not be loaded.'; return; }
  const { report } = await response.json();
  el('reportDetail').textContent = '';
  const heading = document.createElement('h3');
  heading.textContent = report.objective;
  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = `${report.status} · ${report.visibility} · ${report.id}`;
  const summary = document.createElement('p');
  summary.textContent = report.summary || '';
  el('reportDetail').append(heading, meta, summary);
}

el('signInForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  el('signInError').textContent = '';
  const email = el('email').value.trim();
  const password = el('password').value;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    el('signInError').textContent = response.status === 400 ? 'Those credentials were not accepted.' : 'Sign-in is temporarily unavailable.';
    return;
  }
  const next = await response.json();
  remember({ access_token: next.access_token, refresh_token: next.refresh_token, expires_at: next.expires_at });
  el('password').value = '';
  await load();
});

el('signOut')?.addEventListener('click', async () => {
  const current = session();
  if (current?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${current.access_token}` },
    }).catch(() => {});
  }
  remember(null);
  el('reportDetail').textContent = '';
  show('anonymous');
});

el('setPasswordForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  el('recoveryError').textContent = '';
  const chosen = el('newPassword').value;
  if (chosen.length < 8) {
    el('recoveryError').textContent = 'Use at least 8 characters.';
    return;
  }
  if (chosen !== el('confirmPassword').value) {
    el('recoveryError').textContent = 'The two passwords do not match.';
    return;
  }
  el('newPassword').value = '';
  el('confirmPassword').value = '';
  await setNewPassword(chosen);
});

window.addEventListener('pageshow', (event) => { if (event.persisted) load(); });
window.addEventListener('hashchange', () => { if (recoveryMaterial()) load(); });
await load();
