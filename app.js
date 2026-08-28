const state = {
  archive: { artifacts: [], count: 0 },
  network: { nodes: [], edges: [] },
  activeId: null,
  activeLens: null,
  lastTrigger: null,
  busy: false,
  trial: { artifact: null, counts: null, busy: false, message: '' }
};

const TRIAL_VERDICTS = [
  { id: 'FAILED', label: 'IT FAILED', mark: '×' },
  { id: 'TOO_EARLY', label: 'IT WAS TOO EARLY', mark: '◷' },
  { id: 'ARRIVED_QUIETLY', label: 'IT ARRIVED QUIETLY', mark: '○' }
];
const TRIAL_STORAGE_KEY = 'portal-trial-verdicts-v1';

const el = id => document.getElementById(id);
const evidenceClass = level => level === 'HISTORICALLY-VERIFIED' ? 'verified' : level === 'CONCEPTUAL-INFERENCE' ? 'inference' : 'ai';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const safeHttpsUrl = value => {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
};

function emitPortalMotion(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(`portal:${name}`, { detail }));
}

const PORTAL_SOUND_PREFERENCE = 'portal-sound-v1';
let portalSoundAllowed = true;
try { portalSoundAllowed = localStorage.getItem(PORTAL_SOUND_PREFERENCE) !== 'off'; } catch {}

function rememberPortalSound(value) {
  try { localStorage.setItem(PORTAL_SOUND_PREFERENCE, value); } catch {}
}

function updatePortalSoundControl(label) {
  const audio = el('portalTheme');
  const button = el('portalSound');
  const playing = !audio.paused && !audio.ended;
  button.classList.toggle('is-playing', playing);
  button.setAttribute('aria-pressed', String(playing));
  el('portalSoundLabel').textContent = label || (playing ? 'SOUND ACTIVE' : portalSoundAllowed ? 'SOUND READY' : 'SOUND OFF');
}

async function playPortalTheme({ restart = false } = {}) {
  if (!portalSoundAllowed) return;
  const audio = el('portalTheme');
  if (restart || audio.ended) audio.currentTime = 0;
  audio.volume = 0.62;
  try {
    await audio.play();
    updatePortalSoundControl('SOUND ACTIVE');
  } catch {
    updatePortalSoundControl('PLAY THEME');
  }
}

function togglePortalSound() {
  const audio = el('portalTheme');
  if (!audio.paused && !audio.ended) {
    audio.pause();
    portalSoundAllowed = false;
    rememberPortalSound('off');
    updatePortalSoundControl('SOUND OFF');
    return;
  }
  portalSoundAllowed = true;
  rememberPortalSound('on');
  playPortalTheme({ restart: audio.ended });
}

function readCabinet() {
  try {
    const saved = JSON.parse(localStorage.getItem('portal-cabinet-v4') || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && item.id).slice(0, 24) : [];
  } catch {
    return [];
  }
}

function writeCabinet(artifact) {
  try {
    const next = [artifact, ...readCabinet().filter(item => item.id !== artifact.id)].slice(0, 24);
    localStorage.setItem('portal-cabinet-v4', JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

function readTrialVotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(TRIAL_STORAGE_KEY) || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function rememberTrialVote(id, verdict) {
  try {
    localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ ...readTrialVotes(), [id]: verdict }));
  } catch {}
}

function utcDayNumber() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
}

function selectTrialArtifact(preferredId) {
  const artifacts = state.archive.artifacts || [];
  if (!artifacts.length) return null;
  const requested = preferredId || new URLSearchParams(location.search).get('trial');
  return artifacts.find(artifact => artifact.id === requested) || artifacts[utcDayNumber() % artifacts.length];
}

function normalizeTrialCounts(payload = {}) {
  const source = payload.counts || payload;
  return Object.fromEntries(TRIAL_VERDICTS.map(({ id }) => [id, Math.max(0, Number(source[id]) || 0)]));
}

function trialEvidenceText(artifact) {
  const sources = (artifact.sources || []).filter(source => safeHttpsUrl(source.url));
  if (artifact.evidence_level === 'HISTORICALLY-VERIFIED' && sources.length) return `Historically verified · ${sources.length} visible source${sources.length === 1 ? '' : 's'}.`;
  if (sources.length) return `${escapeHtml(artifact.evidence_level || 'AI-CURATED')} · ${sources.length} source lead${sources.length === 1 ? '' : 's'} attached for independent review.`;
  return `${escapeHtml(artifact.evidence_level || 'AI-CURATED')} · No independent source trail is attached. Judge this as a discovery prompt, not historical authority.`;
}

function trialResultMarkup(counts, selected) {
  const total = TRIAL_VERDICTS.reduce((sum, verdict) => sum + counts[verdict.id], 0);
  const populated = TRIAL_VERDICTS.filter(verdict => counts[verdict.id] > 0).sort((a, b) => counts[b.id] - counts[a.id]);
  const leading = populated[0];
  const minority = populated.length > 1 ? populated[populated.length - 1] : null;
  const reading = total === 0
    ? 'You opened the public record. The room has not formed a view yet.'
    : minority
      ? `<b>The room leans “${escapeHtml(leading.label.toLowerCase())}.”</b> The minority reading—“${escapeHtml(minority.label.toLowerCase())}”—keeps the case unresolved.`
      : `<b>The first public reading is “${escapeHtml(leading.label.toLowerCase())}.”</b> Dissent has not formed yet.`;
  return `<div class="trial-results">
    <h3>The room has answered</h3>
    ${TRIAL_VERDICTS.map(verdict => {
      const percent = total ? Math.round((counts[verdict.id] / total) * 100) : 0;
      return `<div class="verdict-result"><header><span>${escapeHtml(verdict.label)}${selected === verdict.id ? ' · YOUR VERDICT' : ''}</span><b>${percent}%</b></header><div class="verdict-track" aria-label="${escapeHtml(verdict.label)}: ${percent} percent"><i style="width:${percent}%"></i></div></div>`;
    }).join('')}
    <p class="trial-reading">${reading}</p>
    <div class="trial-actions">
      <button class="text-button" id="shareTrial" type="button">SHARE THIS VERDICT</button>
      <button class="text-button" id="nextTrial" type="button">OPEN A CONNECTED CASE</button>
    </div>
    <p class="trial-state" id="trialState" role="status">${escapeHtml(state.trial.message || `${total} anonymous public verdict${total === 1 ? '' : 's'} recorded.`)}</p>
  </div>`;
}

function trialBallotMarkup(artifact) {
  const selected = readTrialVotes()[artifact.id];
  return `<div class="trial-ballot"><h3>What happened to this future?</h3><p>Choose once. The public distribution is revealed after your verdict.</p><div class="verdicts" role="group" aria-label="Choose a verdict">
    ${TRIAL_VERDICTS.map(verdict => `<button class="verdict-button" type="button" data-verdict="${verdict.id}" aria-pressed="${selected === verdict.id}"${state.trial.busy || selected ? ' disabled' : ''}><span aria-hidden="true">${verdict.mark}</span>${verdict.label}</button>`).join('')}
  </div><p class="trial-state" id="trialState" role="status">${escapeHtml(state.trial.message || 'No sign-in. No public profile. One private browser record.')}</p></div>`;
}

function renderTrial() {
  const stage = el('trialStage');
  const artifact = state.trial.artifact;
  if (!artifact) {
    stage.innerHTML = '<p class="empty">The public trial will open when the shared archive is available.</p>';
    return;
  }
  const selected = readTrialVotes()[artifact.id];
  const ballot = selected && state.trial.counts
    ? `<div class="trial-ballot">${trialResultMarkup(state.trial.counts, selected)}</div>`
    : trialBallotMarkup(artifact);
  stage.innerHTML = `<article class="trial-record">
      <div class="trial-kicker">${evidenceBadge(artifact)}<span>${escapeHtml(artifact.id)} · ${escapeHtml(artifact.year)} · ${escapeHtml(artifact.current_phase?.replace('_', ' ') || artifact.status || 'UNRESOLVED')}</span></div>
      <h3>${escapeHtml(artifact.title)}</h3>
      <p class="trial-description">${escapeHtml(artifact.imagined_future || artifact.description)}</p>
      <p class="trial-question">${escapeHtml(artifact.unresolved_question || artifact.question || 'Did this future fail—or did we stop looking for it?')}</p>
      <div class="trial-actions"><button class="text-button" id="inspectTrial" type="button">INSPECT THE EVIDENCE</button></div>
      <p class="trial-evidence">${trialEvidenceText(artifact)}</p>
    </article>${ballot}`;
  stage.querySelectorAll('[data-verdict]').forEach(button => button.addEventListener('click', () => castTrialVerdict(button.dataset.verdict)));
  el('inspectTrial')?.addEventListener('click', event => showArtifact(artifact.id, event.currentTarget));
  el('shareTrial')?.addEventListener('click', shareTrialVerdict);
  el('nextTrial')?.addEventListener('click', openConnectedTrial);
}

async function loadTrialVerdicts(preferredId) {
  const artifact = selectTrialArtifact(preferredId);
  state.trial = { artifact, counts: null, busy: false, message: '' };
  renderTrial();
  if (!artifact) return;
  try {
    const response = await fetch(`/api/trial?id=${encodeURIComponent(artifact.id)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    state.trial.counts = normalizeTrialCounts(await response.json());
    renderTrial();
  } catch {
    state.trial.message = 'Public verdicts are temporarily unavailable. The evidence remains open for inspection.';
    renderTrial();
  }
}

async function castTrialVerdict(verdict) {
  const artifact = state.trial.artifact;
  if (!artifact || state.trial.busy || !TRIAL_VERDICTS.some(item => item.id === verdict)) return;
  if (readTrialVotes()[artifact.id]) return;
  state.trial.busy = true;
  state.trial.message = 'RECORDING YOUR ANONYMOUS VERDICT…';
  renderTrial();
  try {
    const response = await fetch('/api/trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifact_id: artifact.id, verdict })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The public record could not accept this verdict.');
    rememberTrialVote(artifact.id, verdict);
    state.trial.counts = normalizeTrialCounts(payload);
    state.trial.message = 'Verdict recorded. You are seeing the anonymous public distribution.';
    emitPortalMotion('trial-verdict', { id: artifact.id, verdict });
  } catch (error) {
    state.trial.message = error.message;
  } finally {
    state.trial.busy = false;
    renderTrial();
  }
}

async function shareTrialVerdict() {
  const artifact = state.trial.artifact;
  if (!artifact) return;
  const selectedId = readTrialVotes()[artifact.id];
  const selected = TRIAL_VERDICTS.find(verdict => verdict.id === selectedId);
  const url = new URL(location.href);
  url.searchParams.set('trial', artifact.id);
  url.hash = 'futureOnTrial';
  const text = selected
    ? `I put “${artifact.title}” on trial. My verdict: ${selected.label.toLowerCase()}. What is yours?`
    : `Was “${artifact.title}” a failed future—or simply too early? Put it on trial.`;
  try {
    if (navigator.share) await navigator.share({ title: 'The Future on Trial · The Portal', text, url: url.href });
    else {
      await navigator.clipboard.writeText(`${text} ${url.href}`);
      state.trial.message = 'Share text and doorway copied.';
      renderTrial();
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      state.trial.message = 'Sharing is unavailable in this browser.';
      renderTrial();
    }
  }
}

function openConnectedTrial() {
  const current = state.trial.artifact;
  if (!current) return;
  const connectedIds = (state.network.edges || []).flatMap(edge => edge.from === current.id ? [edge.to] : edge.to === current.id ? [edge.from] : []);
  const candidates = (state.archive.artifacts || []).filter(artifact => artifact.id !== current.id);
  const next = candidates.find(artifact => connectedIds.includes(artifact.id)) || candidates[0];
  if (!next) {
    state.trial.message = 'No connected public case is available yet.';
    renderTrial();
    return;
  }
  const url = new URL(location.href);
  url.searchParams.set('trial', next.id);
  url.hash = 'futureOnTrial';
  history.replaceState({}, '', url);
  loadTrialVerdicts(next.id);
}

function allArtifacts() {
  const merged = new Map();
  for (const artifact of [...readCabinet(), ...(state.archive.artifacts || [])]) {
    if (artifact?.id) merged.set(artifact.id, artifact);
  }
  return [...merged.values()];
}

function artifactById(id) {
  return allArtifacts().find(artifact => artifact.id === id);
}

function evidenceBadge(artifact) {
  const level = artifact.evidence_level || 'AI-CURATED';
  return `<span class="badge ${evidenceClass(level)}">${escapeHtml(level)}</span>`;
}

function artifactCard(artifact) {
  return `<button class="card" type="button" data-id="${escapeHtml(artifact.id)}">
    ${evidenceBadge(artifact)}
    <b>${escapeHtml(artifact.title)}</b>
    <small>${escapeHtml(artifact.year)} · ${escapeHtml(artifact.status || 'EXPLORING')}<br>${escapeHtml((artifact.concepts || []).slice(0, 3).join(' · '))}</small>
  </button>`;
}

function bindArtifactButtons(root = document) {
  root.querySelectorAll('[data-id]').forEach(button => {
    button.addEventListener('click', () => showArtifact(button.dataset.id, button));
  });
}

function renderArtifacts() {
  const artifacts = state.archive.artifacts || [];
  const visible = state.activeLens
    ? artifacts.filter(artifact => (artifact.concepts || []).includes(state.activeLens))
    : artifacts;
  el('artifactSummary').textContent = state.activeLens
    ? `${visible.length} artifacts connected through “${state.activeLens}”.`
    : `${state.archive.count || artifacts.length} objects in the shared archive. No engagement ranking.`;
  el('grid').innerHTML = visible.length ? visible.slice(0, 30).map(artifactCard).join('') : '<p class="empty">No shared artifacts are available for this view.</p>';
  el('clearFilter').hidden = !state.activeLens;
  bindArtifactButtons(el('grid'));
}

function renderCabinet() {
  const cabinet = readCabinet();
  el('cabinetGrid').innerHTML = cabinet.length ? cabinet.map(artifactCard).join('') : '<p class="empty">Your private cabinet is empty. Create an encounter to place the first artifact here.</p>';
  bindArtifactButtons(el('cabinetGrid'));
}

function renderLenses() {
  const counts = {};
  for (const artifact of state.archive.artifacts || []) {
    for (const concept of artifact.concepts || []) counts[concept] = (counts[concept] || 0) + 1;
  }
  const lenses = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  el('lenses').innerHTML = lenses.length ? lenses.map(([concept, count]) => `<button class="lens" type="button" data-lens="${escapeHtml(concept)}" aria-pressed="${state.activeLens === concept}">
    <small>CONSTELLATION</small><b>${escapeHtml(concept)}</b><small>${count} connected artifact${count === 1 ? '' : 's'}</small>
  </button>`).join('') : '<p class="empty">Constellations appear when the archive contains connected concepts.</p>';
  el('lenses').querySelectorAll('[data-lens]').forEach(button => {
    button.addEventListener('click', () => {
      state.activeLens = state.activeLens === button.dataset.lens ? null : button.dataset.lens;
      renderLenses();
      renderArtifacts();
      drawGraph();
    });
  });
}

function readResults() { try { return JSON.parse(localStorage.getItem('portal-experiment-results-v5') || '{}') || {}; } catch { return {}; } }
function recordResult(id, outcome) {
  try { localStorage.setItem('portal-experiment-results-v5', JSON.stringify({ ...readResults(), [id]: outcome })); renderExperiments(); if (state.activeId === id) el('detail').innerHTML = detailMarkup(artifactById(id)); drawGraph(); } catch {}
}
function experimentMarkup(item) {
  const x = item.experiment || {}, outcome = readResults()[item.id];
  return `<article class="experiment-card"><small>${escapeHtml(item.title)}</small><h3>${escapeHtml(x.hypothesis)}</h3><p>${escapeHtml(x.method)}</p><p><b>Success:</b> ${escapeHtml(x.success_signal)}</p><p><b>Failure:</b> ${escapeHtml(x.failure_signal)}</p><div class="outcomes" data-experiment="${escapeHtml(item.id)}"><button type="button" data-outcome="SUPPORTED">SUPPORTED</button><button type="button" data-outcome="CHALLENGED">CHALLENGED</button><button type="button" data-outcome="INCONCLUSIVE">INCONCLUSIVE</button></div><small class="private-result">${outcome ? `PRIVATE RESULT · ${escapeHtml(outcome)}` : 'PRIVATE · NOT YET TESTED'}</small></article>`;
}
function bindOutcomes(root = document) { root.querySelectorAll('[data-experiment] [data-outcome]').forEach(button => button.addEventListener('click', () => recordResult(button.parentElement.dataset.experiment, button.dataset.outcome))); }
function renderExperiments() {
  const items = state.archive.evolution?.open_experiments || (state.archive.artifacts || []).filter(a => a.experiment?.hypothesis).slice(0, 8).map(a => ({ id: a.id, title: a.title, experiment: a.experiment }));
  el('experiments').innerHTML = items.length ? items.map(experimentMarkup).join('') : '<p class="empty">The next generated encounter will open the first experiment.</p>'; bindOutcomes(el('experiments'));
}
function renderEvolution() {
  const events = state.archive.evolution?.events || [];
  el('evolution').innerHTML = events.length ? events.map(event => `<button type="button" class="evolution-event" data-id="${escapeHtml(event.id)}"><b>${escapeHtml(event.title)}</b><span>${event.new_concepts.length ? `Introduced ${escapeHtml(event.new_concepts.join(', '))}` : 'Extended existing knowledge'}${event.strengthened_concepts.length ? ` · Strengthened ${escapeHtml(event.strengthened_concepts.join(', '))}` : ''}${event.connections_created ? ` · ${event.connections_created} typed connection${event.connections_created === 1 ? '' : 's'}` : ''}</span></button>`).join('') : '<p class="empty">Evolution events begin with Version 5 encounters.</p>'; bindArtifactButtons(el('evolution'));
}

function renderContinuousModel() {
  const model = state.archive.continuous_model || {};
  const phases = ['EMERGED', 'DISAPPEARED', 'RETURNED', 'FAILED', 'PARTIALLY_REALIZED', 'REALIZED'];
  const liveCounts = Object.fromEntries(phases.map(phase => [phase, 0]));
  for (const artifact of state.archive.artifacts || []) for (const event of artifact.lifecycle || []) if (event.phase in liveCounts) liveCounts[event.phase] += 1;
  el('phaseStrip').innerHTML = phases.map(phase => `<div class="phase"><b>${escapeHtml(liveCounts[phase] || model.phases?.[phase] || 0)}</b><span>${escapeHtml(phase.replace('_', ' '))}</span></div>`).join('');

  const transitions = model.transitions || [];
  el('transitions').innerHTML = transitions.length ? transitions.slice(0, 10).map(event => `<button type="button" class="transition" data-id="${escapeHtml(event.artifact_id)}">
    <time>${escapeHtml(event.year)}</time><span><b>${escapeHtml(event.from ? `${event.from.replace('_', ' ')} → ${event.to.replace('_', ' ')}` : event.to.replace('_', ' '))}</b>${escapeHtml(event.title)}</span><small>${escapeHtml(event.evidence_basis)}</small>
  </button>`).join('') : '<p class="empty">Lifecycle transitions appear as Version 6 artifacts enter the archive.</p>';
  bindArtifactButtons(el('transitions'));

  const watchlist = model.realization_watchlist || [];
  el('watchlist').innerHTML = watchlist.length ? watchlist.slice(0, 8).map(item => `<button type="button" class="watch" data-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.current_phase?.replace('_', ' ') || 'EMERGED')}</span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.signal)}</small></button>`).join('') : '<p class="empty">Unrealized futures with observable realization signals will appear here.</p>';
  bindArtifactButtons(el('watchlist'));
}

function deriveNetwork(artifacts) {
  const nodes = artifacts.map(artifact => ({ id: artifact.id, title: artifact.title, year: artifact.year, concepts: artifact.concepts || [] }));
  const edges = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const shared = nodes[i].concepts.filter(concept => nodes[j].concepts.includes(concept));
      if (shared.length) edges.push({ from: nodes[i].id, to: nodes[j].id, concepts: shared });
    }
  }
  const ids = new Set(nodes.map(node => node.id));
  for (const artifact of artifacts) for (const connection of artifact.connections || []) if (ids.has(connection.target_id)) edges.push({ from: artifact.id, to: connection.target_id, type: connection.type, concepts: connection.concept ? [connection.concept] : [], strength: connection.confidence });
  return { nodes, edges: edges.slice(0, 100) };
}

function graphSubset() {
  const originalNodes = state.network.nodes || [];
  const originalEdges = state.network.edges || [];
  let nodes = originalNodes;
  if (state.activeLens) {
    const ids = new Set((state.archive.artifacts || []).filter(artifact => (artifact.concepts || []).includes(state.activeLens)).map(artifact => artifact.id));
    nodes = originalNodes.filter(node => ids.has(node.id));
  } else if (state.activeId) {
    const ids = new Set([state.activeId]);
    originalEdges.filter(edge => edge.from === state.activeId || edge.to === state.activeId).slice(0, 10).forEach(edge => {
      ids.add(edge.from);
      ids.add(edge.to);
    });
    nodes = originalNodes.filter(node => ids.has(node.id));
  }
  nodes = nodes.slice(0, 12);
  const ids = new Set(nodes.map(node => node.id));
  return { nodes, edges: originalEdges.filter(edge => ids.has(edge.from) && ids.has(edge.to)) };
}

function drawGraph() {
  const box = el('graph');
  const { nodes, edges } = graphSubset();
  if (!nodes.length) {
    box.innerHTML = '<p class="graph-empty">The shared graph is unavailable. Your private cabinet still works.</p>';
    return;
  }
  const width = box.clientWidth;
  const height = box.clientHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(80, Math.min(width, height) * (width < 520 ? .3 : .34));
  const positions = {};
  nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index / nodes.length) - Math.PI / 2;
    const ring = index % 3 === 0 ? .62 : 1;
    positions[node.id] = { x: centerX + Math.cos(angle) * radius * ring, y: centerY + Math.sin(angle) * radius * ring };
  });
  const lines = edges.map(edge => {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (!from || !to) return '';
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const outcome = readResults()[edge.from];
    return `<i class="edge ${edge.type !== 'CONCEPTUAL_ECHO' ? 'typed' : ''} ${outcome ? `result-${outcome.toLowerCase()}` : ''}" title="${escapeHtml(edge.type || 'CONCEPTUAL_ECHO')}" style="left:${from.x}px;top:${from.y}px;width:${Math.hypot(deltaX, deltaY)}px;transform:rotate(${Math.atan2(deltaY, deltaX)}rad)"></i>`;
  }).join('');
  const buttons = nodes.map(node => {
    const position = positions[node.id];
    const title = String(node.title || 'Untitled artifact');
    return `<button class="node${node.id === state.activeId ? ' active' : ''}" type="button" data-node="${escapeHtml(node.id)}" aria-label="Open ${escapeHtml(title)}" style="left:${position.x - 9}px;top:${position.y - 9}px"><span>${escapeHtml(title.length > 28 ? `${title.slice(0, 26)}…` : title)}</span></button>`;
  }).join('');
  box.innerHTML = lines + buttons;
  box.querySelectorAll('[data-node]').forEach(button => button.addEventListener('click', () => showArtifact(button.dataset.node, button)));
}

function detailMarkup(artifact) {
  const level = artifact.evidence_level || 'AI-CURATED';
  const sources = (artifact.sources || []).map(source => ({ ...source, safeUrl: safeHttpsUrl(source.url) })).filter(source => source.safeUrl);
  const sourceMarkup = sources.length
    ? `<h3>Source trail</h3>${sources.map(source => `<a href="${escapeHtml(source.safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || source.safeUrl)}</a>`).join('')}`
    : '<p class="evidence-notice"><b>Evidence boundary:</b> no independent source trail is attached. Treat this as a discovery prompt, not historical authority.</p>';
  const relationships = (artifact.relationships || []).map(relationship => `<span class="relationship">${escapeHtml(relationship.type)} · ${escapeHtml(relationship.label)}</span>`).join('');
  const connections = (artifact.connections || []).map(connection => `<span class="relationship">${escapeHtml(connection.type)} → ${escapeHtml(connection.target_id)} · ${escapeHtml(connection.reason)}</span>`).join('');
  const experiment = artifact.experiment?.hypothesis ? `<h3>Test this idea</h3>${experimentMarkup({ id: artifact.id, title: artifact.title, experiment: artifact.experiment })}` : '';
  const lifecycle = (artifact.lifecycle || []).map(event => `<li><time>${escapeHtml(event.year)}</time><span><b>${escapeHtml(event.phase.replace('_', ' '))}</b>${escapeHtml(event.description)}<small>${escapeHtml(event.evidence_basis || 'AI-GENERATED-HYPOTHESIS')}</small></span></li>`).join('');
  return `${evidenceBadge(artifact)}
    <h2 id="drawerTitle">${escapeHtml(artifact.title)}</h2>
    <p class="meta">${escapeHtml(artifact.id)} · ${escapeHtml(artifact.year)} · ${escapeHtml(artifact.status || 'EXPLORING')} · ${escapeHtml(artifact.persistence || 'ARCHIVE')}</p>
    <p>${escapeHtml(artifact.description)}</p>
    <h3>Provenance</h3><p>${escapeHtml(artifact.provenance || 'Not supplied.')}</p>
    <h3>Encounter / imagined future</h3><p>${escapeHtml(artifact.imagined_future)}</p>
    <h3>Problem addressed</h3><p>${escapeHtml(artifact.problem)}</p>
    <h3>Outcome / modern descendant</h3><p>${escapeHtml(artifact.modern_descendant)}</p>
    ${lifecycle ? `<h3>Future lifecycle</h3><ol class="lifecycle">${lifecycle}</ol><h3>What could make it return</h3><div>${(artifact.recurrence_conditions || []).map(condition => `<span class="tag">${escapeHtml(condition)}</span>`).join('')}</div><h3>Observable realization signal</h3><p>${escapeHtml(artifact.realization_signal)}</p>` : ''}
    <h3>Concepts</h3><div>${(artifact.concepts || []).map(concept => `<span class="tag">${escapeHtml(concept)}</span>`).join('')}</div>
    ${relationships ? `<h3>Conceptual relationships</h3><div>${relationships}</div>` : ''}
    ${connections ? `<h3>Typed graph connections</h3><div>${connections}</div>` : ''}
    ${experiment}
    <h3>Unresolved question</h3><p>${escapeHtml(artifact.unresolved_question || artifact.question || 'What becomes visible when this connects to another domain?')}</p>
    ${level === 'HISTORICALLY-VERIFIED' && !sources.length ? '<p class="evidence-notice">This record is labelled verified but has no visible source trail. Treat verification as incomplete.</p>' : sourceMarkup}`;
}

function showArtifact(id, trigger) {
  const artifact = artifactById(id);
  if (!artifact) return;
  state.activeId = id;
  state.lastTrigger = trigger || document.activeElement;
  el('detail').innerHTML = detailMarkup(artifact);
  bindOutcomes(el('detail'));
  const drawer = el('drawer');
  drawer.removeAttribute('inert');
  drawer.setAttribute('aria-hidden', 'false');
  drawer.classList.add('open');
  el('backdrop').hidden = false;
  document.querySelectorAll('body > :not(.drawer):not(.backdrop)').forEach(element => {
    if (element instanceof HTMLElement) element.setAttribute('inert', '');
  });
  document.body.style.overflow = 'hidden';
  el('closeDrawer').focus();
  drawGraph();
}

function closeDrawer() {
  const drawer = el('drawer');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.setAttribute('inert', '');
  el('backdrop').hidden = true;
  document.querySelectorAll('body > :not(.drawer):not(.backdrop)').forEach(element => {
    if (element instanceof HTMLElement) element.removeAttribute('inert');
  });
  document.body.style.overflow = '';
  if (state.lastTrigger instanceof HTMLElement) state.lastTrigger.focus();
}

function trapDrawerFocus(event) {
  if (event.key !== 'Tab' || !el('drawer').classList.contains('open')) return;
  const focusable = [...el('drawer').querySelectorAll('button:not([disabled]), a[href], select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.hidden);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function loadPortal() {
  const [archiveResult, graphResult, healthResult] = await Promise.allSettled([
    fetch('/api/archive?limit=60', { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error('archive');
      return response.json();
    }),
    fetch('/api/graph', { cache: 'no-store' }).then(response => response.ok ? response.json() : Promise.reject(new Error('graph'))),
    fetch('/api/health', { cache: 'no-store' }).then(response => response.json())
  ]);
  if (archiveResult.status === 'fulfilled') state.archive = archiveResult.value;
  if ((state.archive.temporal_graph?.nodes || []).length) state.network = state.archive.temporal_graph;
  else if (graphResult.status === 'fulfilled') state.network = graphResult.value;
  if (!(state.network.nodes || []).length) state.network = deriveNetwork(allArtifacts());
  const health = healthResult.status === 'fulfilled' ? healthResult.value : null;
  el('systemState').textContent = health?.ok ? `ARCHIVE ONLINE · ${health.product_version || '5.1.0'}` : 'PRIVATE CABINET MODE';
  el('systemState').className = `system-state ${health?.ok ? 'operational' : 'degraded'}`;
  el('status').textContent = state.archive.artifacts.length
    ? `${state.archive.count || state.archive.artifacts.length} NODES · ${(state.network.edges || []).length} CONCEPTUAL CONNECTIONS`
    : 'PRIVATE CABINET READY · SHARED GRAPH UNAVAILABLE';
  renderLenses();
  renderExperiments();
  renderEvolution();
  renderContinuousModel();
  renderArtifacts();
  renderCabinet();
  drawGraph();
  await loadTrialVerdicts();
}

async function generateEncounter(event) {
  event.preventDefault();
  if (state.busy) return;
  state.busy = true;
  const button = el('generate');
  const message = el('curatorState');
  button.disabled = true;
  button.textContent = 'CURATING…';
  el('curatorForm').setAttribute('aria-busy', 'true');
  emitPortalMotion('encounter-start');
  message.textContent = 'Searching for a distant, structured encounter. This can take up to 45 seconds…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50000);
  try {
    const response = await fetch('/api/artifact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: el('mode').value }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The curator could not complete this encounter.');
    const cabinetSaved = writeCabinet(payload);
    state.archive.artifacts = [payload, ...(state.archive.artifacts || []).filter(artifact => artifact.id !== payload.id)];
    state.archive.count = Math.max(state.archive.count || 0, state.archive.artifacts.length);
    state.network = deriveNetwork(state.archive.artifacts);
    state.archive.evolution = state.archive.evolution || { events: [], open_experiments: [] };
    state.archive.evolution.open_experiments = [{ id: payload.id, title: payload.title, experiment: payload.experiment }, ...(state.archive.evolution.open_experiments || []).filter(item => item.id !== payload.id)].filter(item => item.experiment?.hypothesis).slice(0, 8);
    state.archive.evolution.events = [{ id: payload.id, title: payload.title, new_concepts: payload.concepts || [], strengthened_concepts: [], connections_created: (payload.connections || []).length, experiment: payload.experiment }, ...(state.archive.evolution.events || []).filter(item => item.id !== payload.id)].slice(0, 20);
    state.archive.continuous_model = state.archive.continuous_model || { phases: {}, transitions: [], realization_watchlist: [] };
    state.archive.continuous_model.transitions = [...(payload.lifecycle || []).map((event, index, lifecycle) => ({ artifact_id: payload.id, title: payload.title, from: index ? lifecycle[index - 1].phase : null, to: event.phase, year: event.year, evidence_basis: event.evidence_basis })), ...(state.archive.continuous_model.transitions || []).filter(item => item.artifact_id !== payload.id)].sort((a, b) => b.year - a.year).slice(0, 60);
    if (payload.realization_signal && payload.current_phase !== 'REALIZED') state.archive.continuous_model.realization_watchlist = [{ id: payload.id, title: payload.title, current_phase: payload.current_phase, signal: payload.realization_signal }, ...(state.archive.continuous_model.realization_watchlist || []).filter(item => item.id !== payload.id)].slice(0, 12);
    state.activeLens = null;
    renderLenses();
    renderExperiments();
    renderEvolution();
    renderContinuousModel();
    renderArtifacts();
    renderCabinet();
    message.textContent = payload.persistence === 'shared'
      ? 'Encounter created and connected to the shared graph.'
      : cabinetSaved
        ? 'Encounter created and preserved in your private cabinet.'
        : 'Encounter created for this session; private browser storage is unavailable.';
    emitPortalMotion('encounter-created', { id: payload.id, title: payload.title });
    showArtifact(payload.id, button);
  } catch (error) {
    message.textContent = error.name === 'AbortError' ? 'The curator timed out safely. No incomplete artifact was saved.' : error.message;
    emitPortalMotion('encounter-failed');
  } finally {
    clearTimeout(timer);
    state.busy = false;
    button.disabled = false;
    button.textContent = 'GENERATE ONE ENCOUNTER';
    el('curatorForm').removeAttribute('aria-busy');
    emitPortalMotion('encounter-end');
  }
}

async function maximizeSerendipity(event) {
  const button = event.currentTarget;
  button.disabled = true;
  emitPortalMotion('serendipity-start');
  try {
    const path = `/api/serendipity${state.activeId ? `?from=${encodeURIComponent(state.activeId)}` : ''}`;
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const artifact = await response.json();
    showArtifact(artifact.id, button);
  } catch {
    const candidates = allArtifacts().filter(artifact => artifact.id !== state.activeId);
    if (candidates.length) showArtifact(candidates[Math.floor(Math.random() * candidates.length)].id, button);
    else el('status').textContent = 'CREATE AN ENCOUNTER TO BEGIN SERENDIPITY.';
  } finally {
    button.disabled = false;
    emitPortalMotion('serendipity-end');
  }
}

el('curatorForm').addEventListener('submit', generateEncounter);
el('portalSound').addEventListener('click', togglePortalSound);
el('portalTheme').addEventListener('ended', () => updatePortalSoundControl('REPLAY THEME'));
el('portalTheme').addEventListener('error', () => {
  portalSoundAllowed = false;
  updatePortalSoundControl('SOUND UNAVAILABLE');
  el('portalSound').disabled = true;
});
el('openTrial').addEventListener('click', () => {
  playPortalTheme({ restart: true });
  el('futureOnTrial').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  setTimeout(() => el('trialStage').querySelector('button')?.focus({ preventScroll: true }), 450);
});
el('enterGraph').addEventListener('click', () => {
  playPortalTheme({ restart: true });
  el('graphSection').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
el('openCurator').addEventListener('click', () => {
  el('curator').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  el('mode').focus({ preventScroll: true });
});
el('serendipity').addEventListener('click', maximizeSerendipity);
el('resetGraph').addEventListener('click', () => {
  state.activeId = null;
  state.activeLens = null;
  renderLenses();
  renderExperiments();
  renderEvolution();
  renderArtifacts();
  drawGraph();
});
el('clearFilter').addEventListener('click', () => {
  state.activeLens = null;
  renderLenses();
  renderArtifacts();
  drawGraph();
});
el('closeDrawer').addEventListener('click', closeDrawer);
el('backdrop').addEventListener('click', closeDrawer);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && el('drawer').classList.contains('open')) closeDrawer();
  trapDrawerFocus(event);
});
let resizeFrame;
addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(drawGraph);
});

updatePortalSoundControl();

loadPortal().catch(() => {
  el('systemState').textContent = 'PRIVATE CABINET MODE';
  el('systemState').className = 'system-state degraded';
  el('status').textContent = 'PRIVATE CABINET READY · SHARED GRAPH UNAVAILABLE';
  state.archive.artifacts = readCabinet();
  state.archive.count = state.archive.artifacts.length;
  state.network = deriveNetwork(state.archive.artifacts);
  renderLenses();
  renderArtifacts();
  renderCabinet();
  drawGraph();
  loadTrialVerdicts();
});
