const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const list = value => Array.isArray(value) ? value : [];

async function request(path, options) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function renderDecisiveExperiment(data) {
  const verdict = data.decisive_experiment?.verdict;
  if (!verdict) throw new Error('Decisive experiment result unavailable');
  const label = verdict.passed ? 'PASS' : verdict.provisional ? 'PROVISIONAL — NOT PROVEN' : 'FAIL';
  $('verdict').innerHTML = `<p class="tag">${esc(verdict.protocol_id)} · BLIND ${verdict.blind ? 'YES' : 'NO'}</p><h2>${label}</h2><p>Score ${Math.round((Number(verdict.score) || 0) * 100)}% · novelty ${Math.round((Number(verdict.novelty_score) || 0) * 100)}%</p><p>${esc(verdict.reason)}</p>`;
  $('criteria').innerHTML = `<p class="tag">DECISIVE GATES</p>${Object.entries(verdict.criteria || {}).map(([key, value]) => `<p class="${value ? 'pass' : 'blocked'}">${value ? 'PASS' : 'PENDING'} · ${esc(key.replaceAll('_', ' '))}</p>`).join('')}`;
  $('metrics').innerHTML = `<p class="tag">TRIAL METRICS</p>${Object.entries(verdict.metrics || {}).map(([key, value]) => `<p>${esc(key.replaceAll('_', ' '))}: ${esc(value)}</p>`).join('')}<p>Generation mode: ${esc(data.generation_mode)}</p>`;
}

function render(data) {
  if (!data.result || !data.cognition || !Array.isArray(data.generations)) {
    throw new Error('Incomplete living response');
  }
  renderDecisiveExperiment(data);

  const summary = data.experiment_summary || {};
  $('state').textContent = `${data.version} · ${data.generation_mode} · ${data.generations.length} GENERATIONS · ${data.cognition.readiness} · REAL-WORLD AUTHORITY BLOCKED`;
  $('summary').textContent = `${summary.total || 0} experiments · ${list(summary.extinctions).length} extinctions · ${summary.fossils || 0} fossils · ${list(summary.surprise_branches).length} surprise branches · ${list(summary.rebirths).length} controlled rebirths`;

  $('generations').innerHTML = data.generations.map(generation => `<section class="section gen"><h2>Generation ${generation.generation}</h2><p class="tag">PARETO ${list(generation.frontier).map(esc).join(' · ') || 'NONE'} · FOSSILS ${generation.fossil_count || 0} · EXTINCT ${list(generation.extinct).map(esc).join(' · ') || 'NONE'} · SURPRISE ${list(generation.surprises).map(esc).join(' · ') || 'NONE'} · REBORN ${list(generation.reborn).map(esc).join(' · ') || 'NONE'}</p><div class="grid">${list(generation.population).map(hypothesis => `<article class="card lineage ${String(hypothesis.id).includes('SURPRISE') ? 'surprise' : ''} ${hypothesis.state === 'REBORN' ? 'reborn' : ''} ${hypothesis.state === 'DEAD' ? 'dead' : ''}"><p class="tag">${esc(hypothesis.state)} · ${esc(hypothesis.niche || 'UNNICHED')} · ${esc(hypothesis.epistemic_class)}</p><h3>${esc(hypothesis.id)}</h3><p>${esc(hypothesis.statement)}</p><div class="meter"><i style="width:${Math.round((Number(hypothesis.confidence) || 0) * 100)}%"></i></div><p><b>Confidence</b> ${Math.round((Number(hypothesis.confidence) || 0) * 100)}%</p><p><b>Parents</b> ${list(hypothesis.ancestry?.parent_ids).map(esc).join(' + ') || 'none'}</p><p><b>Operator</b> ${list(hypothesis.ancestry?.operators).map(esc).join(' + ') || 'none'}</p><p><b>Prediction</b> ${esc(list(hypothesis.predictions)[0] || 'none declared')}</p><p><b>Falsifier</b> ${esc(list(hypothesis.falsifiers)[0] || 'none declared')}</p><p><b>Hard kill</b> ${esc(list(hypothesis.hard_kill_conditions)[0] || 'none declared')}</p>${hypothesis.discriminating_test ? `<p><b>Discriminating test</b> ${esc(hypothesis.discriminating_test)}</p>` : ''}</article>`).join('')}</div><h3>Selection pressure</h3>${list(generation.experiments).map(event => `<p class="outcome ${event.state === 'DEAD' ? 'extinct' : ''}">${esc(event.candidate_id)} → ${esc(event.outcome?.polarity || 'UNKNOWN')} · ${Math.round((Number(event.confidence) || 0) * 100)}%${event.fossil_risk ? ` · fossil risk ${Math.round(event.fossil_risk * 100)}% from ${list(event.fossil_matches).map(esc).join(', ')}` : ''}</p>`).join('') || '<p class="muted">No experiment records.</p>'}</section>`).join('');

  const cognition = data.cognition;
  $('meta').innerHTML = `<p class="tag">METACOGNITION</p><p>Uncertainty ${Math.round((Number(cognition.metacognition?.uncertainty) || 0) * 100)}%</p><p>${esc(cognition.metacognition?.question || 'No question generated.')}</p><p class="tag">REAL-WORLD ACTION ${cognition.metacognition?.should_act ? 'ALLOWED' : 'BLOCKED'}</p>`;
  const trace = cognition.tool_trace || { budget: { spent: 0, limit: 0 }, events: [] };
  $('tools').innerHTML = `<p class="tag">VERIFIED TOOL TRACE · BUDGET ${Number(trace.budget.spent || 0).toFixed(2)} / ${Number(trace.budget.limit || 0).toFixed(2)}</p>${list(trace.events).map(event => `<p><b>${esc(event.tool_id)}</b> · ${esc(event.status)} · COST ${esc(event.cost)}<br><span class="trace">${esc(event.output?.provenance || 'NO OUTPUT PROVENANCE')}</span></p>`).join('') || '<p>No tool executed.</p>'}`;
  $('critics').innerHTML = `<p class="tag">ACTIVE CRITICS</p>${list(cognition.critics).slice(0, 6).map(critic => `<p>${esc(list(critic.attacks)[0] || critic.objective || critic.id)}</p>`).join('') || '<p>No critic active.</p>'}`;
  $('communication').innerHTML = `<p class="tag">CALIBRATED COMMUNICATION</p><h3>${esc(cognition.communication?.headline || 'No defensible explanation survived.')}</h3><p>${Math.round((Number(cognition.communication?.confidence) || 0) * 100)}% confidence · ${Math.round((Number(cognition.communication?.uncertainty) || 0) * 100)}% uncertainty · ${esc(cognition.communication?.epistemic_class || 'CONSTRUCTED')}</p><p><b>Falsifier</b> ${esc(cognition.communication?.falsifier || 'none declared')}</p><p><b>Next observation</b> ${esc(cognition.communication?.next_observation || 'none declared')}</p><p class="muted">${esc(cognition.communication?.caveat || '')}</p>`;
  $('plan').innerHTML = `<p class="tag">PLAN / REPLAN</p>${list(cognition.plan).map(item => `<p><b>${esc(item.step)} · ${esc(item.status)}</b><br>${esc(item.detail)}</p>`).join('') || '<p>No plan trace.</p>'}<p class="tag">DECISIVE GATE · ${esc(cognition.decisive_gate || 'UNKNOWN')}</p>`;

  $('timeline').innerHTML = list(data.result.timeline).map(item => `<li><b>${esc(item.label)}</b> — ${list(item.population).map(hypothesis => `${esc(hypothesis.id)} ${Math.round((Number(hypothesis.confidence) || 0) * 100)}% ${esc(hypothesis.state)}`).join(' · ')}</li>`).join('') || '<li>No deterministic evidence events.</li>';
  $('fossils').innerHTML = list(data.result.fossil_record).map(fossil => `<article class="card fossil"><p class="tag">${esc(fossil.id)} · DEAD</p><h3>${esc(fossil.statement)}</h3><p>Final confidence ${Math.round((Number(fossil.final_confidence) || 0) * 100)}%</p><p><b>Superseded by</b> ${esc(fossil.superseded_by || 'none')}</p><p><b>Falsifier</b> ${esc(list(fossil.falsifiers)[0] || 'none')}</p><p class="trace">Evidence: ${list(fossil.evidence).map(evidence => esc(evidence.id)).join(' → ') || 'none'}</p></article>`).join('') || '<p>No deterministic fossils yet.</p>';
  $('acceptance').innerHTML = Object.entries({ ...data.result.acceptance, ...cognition.acceptance }).map(([key, value]) => `<p class="${value ? 'pass' : 'blocked'}">${value ? 'PASS' : 'PENDING'} · ${esc(key.replaceAll('_', ' '))}</p>`).join('');
  $('safety').innerHTML = Object.entries(data.safety || {}).map(([key, value]) => `<p class="${value ? '' : 'blocked'}">${value ? 'ALLOWED' : 'BLOCKED'} · ${esc(key.replaceAll('_', ' '))}</p>`).join('') || '<p class="blocked">Safety envelope unavailable.</p>';
}

async function load() {
  const data = await request('/api/living');
  render(data);
}

$('sendObservation').addEventListener('click', async () => {
  const summary = $('observation').value.trim();
  if (!summary) return;
  $('sendObservation').disabled = true;
  try {
    const data = await request('/api/living', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary, source: 'PRODUCTION_NON_PERSISTENT_PROBE' })
    });
    $('intake').textContent = `${data.decision?.wake ? 'WAKE' : 'STORE'} · novelty ${Math.round((Number(data.decision?.change?.novelty) || 0) * 100)}% · ${data.decision?.reason || 'No material change'} · NOT PERSISTED`;
  } catch (error) {
    $('intake').textContent = `EVIDENCE ERROR · ${error.message}`;
  } finally {
    $('sendObservation').disabled = false;
  }
});

load().catch(error => {
  $('state').textContent = `LIVING OBSERVATORY UNAVAILABLE · ${error.message}`;
  $('verdict').textContent = 'DECISIVE EXPERIMENT UNAVAILABLE';
});
