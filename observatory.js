(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const status = $('obsStatus');
  const grid = $('obsGrid');

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function badge(label, kind) {
    return `<span class="obs-badge obs-${kind}">${escapeHtml(label)}</span>`;
  }

  function section(id, title, index, body) {
    return `<section class="obs-panel" aria-labelledby="${id}Title">
      <header class="obs-panel-head"><p class="obs-index">${escapeHtml(index)}</p><h2 id="${id}Title">${escapeHtml(title)}</h2></header>
      ${body}
    </section>`;
  }

  function empty(text) {
    return `<p class="obs-empty">${escapeHtml(text)}</p>`;
  }

  function renderActivity(live) {
    const runs = (live?.runs || []).map(run => `
      <li class="obs-run">
        <span class="obs-run-id">${escapeHtml(run.id || '')}</span>
        ${badge(run.status || 'UNKNOWN', run.status === 'COMPLETED' ? 'ok' : run.status === 'FAILED' ? 'err' : 'neutral')}
        <span class="obs-run-meta">${escapeHtml(run.generation_mode || '')} · ${escapeHtml(run.model_calls ?? 0)} model call(s) · ${escapeHtml(run.finished_at || run.created_at || '')}</span>
      </li>`).join('');
    const latest = live?.latest;
    const latestBlock = latest ? `<p class="obs-note">Latest completed run: ${escapeHtml(latest.id || '')} (${escapeHtml(latest.status || '')}) · ${escapeHtml(latest.generation_count ?? '')} generation(s) · ${escapeHtml(latest.fossil_count ?? '')} fossil(s).</p>` : '';
    return `${latestBlock}${runs ? `<ul class="obs-list">${runs}</ul>` : empty('No recorded runs yet.')}`;
  }

  function renderGraph(kg) {
    const chips = (kg?.constellations || []).map(item => `<span class="obs-chip">${escapeHtml(item.name)} · ${escapeHtml(item.count)}</span>`).join('');
    return `<p class="obs-note">${escapeHtml(kg?.node_count ?? 0)} node(s) · ${escapeHtml(kg?.edge_count ?? 0)} edge(s). Shared concepts are connective tissue, not proof of causation.</p>
      ${chips ? `<div class="obs-chips">${chips}</div>` : empty('No constellations recorded yet.')}`;
  }

  function renderArena(arena) {
    if (!arena?.candidates?.length) return empty(arena?.generation_mode ? 'The latest run recorded no hypothesis population.' : 'No recorded hypothesis population yet.');
    const cards = arena.candidates.map(candidate => `
      <article class="obs-card">
        <header>${badge(candidate.epistemic_class || 'CONSTRUCTED', 'constructed')}${badge(candidate.state || 'EMERGING', 'neutral')}</header>
        <p class="obs-statement">${escapeHtml(candidate.statement || '')}</p>
        <dl class="obs-fields">
          <div><dt>Predictions</dt><dd>${escapeHtml((candidate.predictions || []).join(' '))}</dd></div>
          <div><dt>Falsifiers</dt><dd>${escapeHtml((candidate.falsifiers || []).join(' '))}</dd></div>
        </dl>
      </article>`).join('');
    return `<p class="obs-note">Generation mode: ${escapeHtml(arena.generation_mode || '')}. These are hypotheses, not validated discoveries.</p><div class="obs-cards">${cards}</div>`;
  }

  function renderExperiments(lab) {
    const results = lab?.recorded_results || [];
    if (!results.length) return `${empty('No experiment results recorded yet.')}<p class="obs-note">${escapeHtml(lab?.disclosure || '')}</p>`;
    const items = results.map(item => `
      <li class="obs-run">
        <span class="obs-run-id">${escapeHtml(item.experiment_id || item.result_id || item.id || 'result')}</span>
        ${badge(item.status || 'RECORDED', item.status === 'completed' ? 'ok' : 'neutral')}
        <span class="obs-run-meta">${escapeHtml(item.conclusion || item.candidate_id || '')}</span>
      </li>`).join('');
    return `<ul class="obs-list">${items}</ul><p class="obs-note">${escapeHtml(lab?.disclosure || '')}</p>`;
  }

  function renderFossils(record) {
    if (!record?.fossils?.length) return empty(record?.source_run ? 'The latest run recorded no fossils.' : 'No fossil record yet.');
    const items = record.fossils.map(fossil => `
      <li class="obs-run">
        <span class="obs-run-id">${escapeHtml(fossil.id || '')}</span>
        <span class="obs-run-meta">${escapeHtml(fossil.statement || '')}${fossil.superseded_by ? ' · superseded by ' + escapeHtml(fossil.superseded_by) : ''}</span>
      </li>`).join('');
    return `<ul class="obs-list">${items}</ul><p class="obs-note">${escapeHtml(record?.evidence_boundary || '')}</p>`;
  }

  function renderAudit(audit) {
    const states = (audit?.evidence_states || []).map(state => badge(state, 'neutral')).join(' ');
    return `${states}<p class="obs-note">${escapeHtml(audit?.notice || '')}</p>`;
  }

  function renderBenchmark(b) {
    if (b?.retrieval) {
      const agg = b.retrieval.aggregate || {};
      const discovery = b.discovery || {};
      const rows = [
        `Retrieval · lexical P@3 ${agg.lexical?.precision_at_3} · R@5 ${agg.lexical?.recall_at_5} · NDCG@5 ${agg.lexical?.ndcg_at_5}`,
        `Retrieval · hybrid P@3 ${agg.hybrid?.precision_at_3} · R@5 ${agg.hybrid?.recall_at_5} · NDCG@5 ${agg.hybrid?.ndcg_at_5} (${b.retrieval.mode})`,
        `Discovery · novelty ${discovery.novelty} · falsifiability ${discovery.falsifiability} · evidence ${discovery.evidence_quality} · self-correction ${discovery.self_correction} · evolution ${discovery.evolutionary_improvement}`
      ];
      return `${badge(b.validation_status || 'PENDING', 'neutral')}
        <ul class="obs-list">${rows.map(row => `<li class="obs-run"><span class="obs-run-meta">${escapeHtml(row)}</span></li>`).join('')}</ul>
        <p class="obs-note">${escapeHtml(b.disclosure || '')}</p>
        <p class="obs-note">${(b.limitations || []).map(item => escapeHtml(item)).join(' ')}</p>`;
    }
    return `${badge(b?.status || 'PENDING', 'neutral')}<p class="obs-note">${escapeHtml(b?.notice || '')}</p>`;
  }

  function renderOpenSource(source) {
    return `<ul class="obs-list">
      <li><a href="${escapeHtml(source?.repository || '#')}" rel="noopener noreferrer" target="_blank">Repository ↗</a></li>
      <li><a href="https://github.com/AndrewLamSingapore/the-portal/blob/main/ARCHITECTURE.md" rel="noopener noreferrer" target="_blank">Architecture ↗</a></li>
      <li><a href="${escapeHtml(source?.roadmap || '#')}" rel="noopener noreferrer" target="_blank">Development roadmap ↗</a></li>
    </ul>`;
  }

  function renderParticipation(participation) {
    const channels = (participation?.channels || []).map(channel => escapeHtml(channel)).join(' · ');
    const items = (participation?.contributions || []).map(item => `
      <li class="obs-run">
        ${badge(item.kind || 'contribution', 'neutral')}
        <span class="obs-run-meta">${escapeHtml(item.text || '')}</span>
      </li>`).join('');
    return `<p class="obs-note">${channels} · explicit consent required · anonymous aggregation.</p>
      ${items ? `<ul class="obs-list">${items}</ul>` : empty('No published contributions yet.')}`;
  }

  function render(data) {
    const t = data?.transparency || {};
    const safety = data?.safety || {};
    const html = [
      section('obsLive', 'Live intelligence activity', '01', renderActivity(t.live_activity)),
      section('obsGraph', 'Living knowledge graph', '02', renderGraph(t.living_knowledge_graph)),
      section('obsArena', 'Hypothesis arena', '03', renderArena(t.hypothesis_arena)),
      section('obsLab', 'Open experiment laboratory', '04', renderExperiments(t.experiment_lab)),
      section('obsFossils', 'Intellectual fossil record', '05', renderFossils(t.fossil_record)),
      section('obsAudit', 'Evidence audit centre', '06', renderAudit(t.evidence_audit)),
      section('obsBenchmark', 'Public benchmark centre', '07', renderBenchmark(t.benchmark)),
      section('obsSource', 'Open source centre', '08', renderOpenSource(t.open_source)),
      section('obsParticipation', 'Public participation centre', '09', renderParticipation(t.participation))
    ].join('');
    grid.innerHTML = html + `<p class="obs-safety">Safety: actuation ${escapeHtml(safety.actuation_allowed ? 'allowed' : 'blocked')} · source mutation ${escapeHtml(safety.production_source_mutation_allowed ? 'allowed' : 'blocked')} · deployment mutation ${escapeHtml(safety.deployment_mutation_allowed ? 'allowed' : 'blocked')}.</p>`;
    grid.hidden = false;
    status.textContent = 'Observatory ready.';
    status.classList.add('is-ok');
  }

  async function load() {
    try {
      const response = await fetch('/api/observatory', { headers: { 'cache-control': 'no-cache' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The observatory is unavailable.');
      render(payload);
    } catch (error) {
      status.textContent = error.message || 'The observatory is unavailable.';
      status.classList.add('is-error');
    }
  }

  async function submitContribution(event) {
    event.preventDefault();
    const form = $('contributeForm');
    const status = $('contributeStatus');
    const text = $('contributeText').value.trim();
    const consent = $('contributeConsent').checked;
    if (text.length < 2) { status.textContent = 'Enter your contribution first.'; return; }
    if (!consent) { status.textContent = 'Consent is required before anything is retained.'; return; }
    try {
      const response = await fetch('/api/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: $('contributeKind').value, text, consent: true })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Submission failed.');
      status.textContent = payload.duplicate ? 'Already submitted.' : 'Submitted for moderation. Nothing is published until approved.';
      form.reset();
    } catch (error) {
      status.textContent = error.message || 'Submission failed.';
    }
  }

  load();
  $('contributeForm')?.addEventListener('submit', submitContribution);
})();
