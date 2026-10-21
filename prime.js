/**
 * Private Portal client.
 *
 * Authentication cookies are HttpOnly and belong to the same-origin Portal API.
 * This script never stores credentials or private response bodies in browser
 * storage. The server validates the cookie with Neon Auth and decides access to
 * the Portal-owned private tables before any report is returned.
 */
const MODE = document.body.dataset.primeMode || 'summary';
let recoveryToken = '';

const UNREACHABLE = 'ORQEVIA could not reach its identity service, so nothing was saved. Check your connection, then reload and try again.';
const UNEXPECTED = 'ORQEVIA hit an unexpected problem and nothing was saved. Reload the page and try again.';
const LINK_EXPIRED = 'That recovery link is no longer valid. Request a new one and try again.';
const WEAK_PASSWORD = 'That password was not accepted. Choose a stronger password you have not used here before.';

const el = (id) => document.getElementById(id);

function say(id, message) {
  const node = el(id);
  if (node) node.textContent = message;
  return Boolean(node);
}

function visibleState() {
  const panel = [...document.querySelectorAll('[data-state]')].find((node) => !node.hidden);
  return panel?.dataset.state || 'loading';
}

function show(state) {
  for (const panel of document.querySelectorAll('[data-state]')) {
    panel.hidden = panel.dataset.state !== state;
  }
}

async function api(path, options = {}) {
  try {
    return await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    return { ok: false, status: 0, transport: true };
  }
}

function clearLinkFromUrl() {
  const params = new URLSearchParams(location.search);
  recoveryToken = params.get('token') || '';
  const error = params.get('error_description') || params.get('error') || '';
  for (const key of ['token', 'code', 'error', 'error_code', 'error_description']) params.delete(key);
  const rest = params.toString();
  history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash ? '' : ''}`);
  return error;
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

async function loadDetail() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return;
  const detail = el('reportDetail');
  if (!detail) return;
  const response = await api(`/api/prime/report?id=${encodeURIComponent(id)}`);
  if (response.transport) {
    detail.textContent = 'The report could not be loaded. Try again shortly.';
    return;
  }
  if (response.status === 404) {
    detail.textContent = 'That report is not available to this identity.';
    return;
  }
  if (!response.ok) {
    detail.textContent = 'The report could not be loaded. Try again shortly.';
    return;
  }
  const { report } = (await response.json().catch(() => ({}))) || {};
  if (!report) {
    detail.textContent = 'The report could not be loaded. Try again shortly.';
    return;
  }
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

async function load() {
  show('loading');
  const linkError = clearLinkFromUrl();
  if (recoveryToken || linkError) {
    if (!el('setPasswordForm')) {
      location.replace('/prime');
      return;
    }
    if (linkError || !recoveryToken) say('recoveryError', 'That recovery link is no longer valid. Request a new one.');
    return show('recovery');
  }

  const response = await api('/api/prime');
  if (response.transport) return show('unavailable');
  if (response.status === 401) return show('anonymous');
  if (response.status === 403) return show('unmapped');
  if (!response.ok) return show('unavailable');
  const payload = await response.json().catch(() => null);
  if (!payload?.identity) return show('unavailable');
  if (el('identity')) {
    el('identity').textContent = `${payload.identity.display_name} \u00b7 ${payload.identity.role} \u00b7 ${payload.identity.person_key}`;
  }
  renderReports(payload.reports || []);
  show('ready');
  if (MODE === 'reports') await loadDetail();
}

const value = (id) => el(id)?.value ?? '';

el('signInForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = el('signInForm')?.querySelector('button[type="submit"]');
  try {
    say('signInError', '');
    const email = value('email').trim();
    const password = value('password');
    if (!email || !password) {
      say('signInError', 'Enter your email address and password.');
      return;
    }
    if (button) button.disabled = true;
    const response = await api('/api/prime/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.transport) {
      say('signInError', UNREACHABLE);
      return;
    }
    if (!response.ok) {
      say('signInError', response.status === 401 || response.status === 400
        ? 'Those credentials were not accepted.'
        : 'Sign-in is temporarily unavailable. Try again shortly.');
      return;
    }
    if (el('password')) el('password').value = '';
    await load();
  } catch {
    say('signInError', UNEXPECTED);
  } finally {
    if (button) button.disabled = false;
  }
});

for (const button of document.querySelectorAll('[data-signout]')) {
  button.addEventListener('click', async () => {
    try {
      await api('/api/prime/logout', { method: 'POST', body: '{}' });
    } finally {
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
    if (chosen.length < 8) {
      say('recoveryError', 'Use at least 8 characters.');
      return;
    }
    if (chosen !== value('confirmPassword')) {
      say('recoveryError', 'The two passwords do not match.');
      return;
    }
    if (!recoveryToken) {
      say('recoveryError', LINK_EXPIRED);
      return;
    }
    if (button) button.disabled = true;
    say('recoveryStatus', 'Saving your new password...');
    const response = await api('/api/prime/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: recoveryToken, newPassword: chosen }),
    });
    if (response.transport) {
      say('recoveryStatus', '');
      say('recoveryError', UNREACHABLE);
      return;
    }
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      recoveryToken = '';
      say('recoveryStatus', '');
      say('recoveryError', LINK_EXPIRED);
      return;
    }
    if (response.status === 422) {
      say('recoveryStatus', '');
      say('recoveryError', WEAK_PASSWORD);
      return;
    }
    if (!response.ok) {
      say('recoveryStatus', '');
      say('recoveryError', `The password was not changed (the identity service answered ${response.status}). Request a new recovery link and try again.`);
      return;
    }
    recoveryToken = '';
    if (el('newPassword')) el('newPassword').value = '';
    if (el('confirmPassword')) el('confirmPassword').value = '';
    say('recoveryStatus', 'Password updated. Continuing to private operations...');
    await load();
  } catch {
    say('recoveryStatus', '');
    say('recoveryError', UNEXPECTED);
  } finally {
    if (button) button.disabled = false;
  }
});

window.addEventListener('pageshow', (event) => { if (event.persisted) load(); });
window.addEventListener('unhandledrejection', () => {
  if (visibleState() === 'recovery') say('recoveryError', UNEXPECTED);
  else if (visibleState() === 'anonymous') say('signInError', UNEXPECTED);
  else show('unavailable');
});
window.addEventListener('error', () => {
  if (visibleState() === 'recovery') say('recoveryError', UNEXPECTED);
  else if (visibleState() === 'anonymous') say('signInError', UNEXPECTED);
  else show('unavailable');
});

try {
  await load();
} catch {
  show('unavailable');
}
