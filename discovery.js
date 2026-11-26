(function () {
  'use strict';

  const STORAGE_KEY = 'portal.discoveries.v1';
  const PROMPTS = [
    'What would a world look like if machines could evolve their own ethics?',
    'Why do promising technologies sometimes arrive too early?',
    'I noticed that old ideas keep returning under new conditions.',
    'Could a failure today become the foundation of tomorrow\u2019s breakthrough?',
    'Design a possible future where energy is treated as a commons.'
  ];

  const $ = id => document.getElementById(id);
  const form = $('discoveryForm');
  const input = $('discoveryQuery');
  const submit = $('discoverySubmit');
  const surprise = $('discoverySurprise');
  const status = $('discoveryStatus');
  const result = $('discoveryResult');
  const cabinet = $('discoveryCabinet');

  let session = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = 'discovery-status' + (kind ? ' is-' + kind : '');
    status.hidden = false;
  }

  function clearStatus() {
    status.textContent = '';
    status.hidden = true;
    status.className = 'discovery-status';
  }

  function badge(label, kind) {
    return `<span class="ds-badge ds-${kind}">${escapeHtml(label)}</span>`;
  }

  function readSaved() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeSaved(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 20)));
  }

  function renderCabinet() {
    const items = readSaved();
    cabinet.hidden = items.length === 0;
    if (!items.length) {
      cabinet.innerHTML = '';
      return;
    }
    cabinet.innerHTML = `
      <h3>My discoveries</h3>
      <p class="ds-disclosure">Saved privately in this browser. Nothing is published or sent to the server.</p>
      <ul class="ds-list">
        ${items.map((item, index) => `
          <li class="ds-match">
            <span class="ds-match-title">${escapeHtml(item.seed || 'Untitled')}</span>
            <span class="ds-match-meta">Saved ${escapeHtml(item.savedAt || '')} · ${escapeHtml(item.turn || 1)} turn(s)</span>
            <span class="ds-cabinet-actions">
              <button type="button" data-reopen="${index}">REOPEN</button>
              <button type="button" data-delete="${index}">DELETE</button>
            </span>
          </li>`).join('')}
      </ul>`;
    cabinet.querySelectorAll('[data-reopen]').forEach(button => {
      button.addEventListener('click', () => reopenSaved(Number(button.getAttribute('data-reopen'))));
    });
    cabinet.querySelectorAll('[data-delete]').forEach(button => {
      button.addEventListener('click', () => deleteSaved(Number(button.getAttribute('data-delete'))));
    });
  }

  function reopenSaved(index) {
    const items = readSaved();
    const item = items[index];
    if (!item?.briefing) return;
    session = item.session || null;
    renderBriefing(item.briefing);
    setStatus('Discovery reopened from your private cabinet.', 'ok');
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function deleteSaved(index) {
    const items = readSaved();
    items.splice(index, 1);
    writeSaved(items);
    renderCabinet();
    setStatus('Saved discovery removed from this browser.', null);
  }

  function saveCurrent() {
    const briefingNode = result.querySelector('[data-briefing]');
    const briefing = briefingNode ? JSON.parse(briefingNode.getAttribute('data-briefing')) : null;
    if (!briefing) {
      setStatus('Nothing to save yet.', 'error');
      return;
    }
    const hypotheses = currentHypotheses();
    const storedBriefing = JSON.parse(JSON.stringify(briefing));
    storedBriefing.stages.hypothesize.candidates.forEach(candidate => {
      const edited = hypotheses.find(item => item.id === candidate.id);
      if (edited) candidate.statement = edited.statement;
    });
    const items = readSaved();
    items.unshift({
      seed: session?.seed || briefing.seed?.text || '',
      turn: session?.turn || 1,
      savedAt: new Date().toISOString(),
      session,
      briefing: storedBriefing
    });
    writeSaved(items);
    renderCabinet();
    setStatus('Saved to your private cabinet in this browser.', 'ok');
  }

  function currentHypotheses() {
    return [...result.querySelectorAll('.ds-hypothesis')].map(card => {
      const id = card.querySelector('.ds-card-id')?.textContent?.trim() || '';
      const statement = card.querySelector('.ds-editable')?.value?.trim() || '';
      return { id, statement, epistemic_class: card.getAttribute('data-epistemic') || 'CONSTRUCTED' };
    }).filter(item => item.id && item.statement);
  }

  function renderMatch(item) {
    const evidence = escapeHtml(item.evidence_level || 'AI-CURATED');
    const neighbor = item.graph_neighbor ? ' <span class="ds-neighbor">graph neighbour</span>' : '';
    return `<li class="ds-match">
      <span class="ds-match-title">${escapeHtml(item.title || 'Untitled')}</span>
      <span class="ds-match-meta">${escapeHtml(item.year || '—')} · grounding ${escapeHtml(item.grounding_score)}%${neighbor}</span>
      <span class="ds-match-concepts">${(item.concepts || []).map(c => escapeHtml(c)).join(' · ')}</span>
      ${badge(evidence, evidence === 'HISTORICALLY-VERIFIED' ? 'verified' : 'ai')}
    </li>`;
  }

  function renderBriefing(data) {
    const stages = data.stages || {};
    const seed = data.seed || {};
    const grounding = data.grounding || {};
    const encounter = stages.encounter || {};
    const connect = stages.connect || {};
    const explore = stages.explore || {};
    const hypothesize = stages.hypothesize || {};
    const challenge = stages.challenge || {};
    const experiment = stages.experiment || {};
    const evolve = stages.evolve || {};
    const briefingSession = data.session || {};

    const degraded = grounding.degraded ? `
      <p class="ds-disclosure ds-degraded"><strong>Degraded mode.</strong> ${escapeHtml(connect.disclosure || '')}</p>` : `
      <p class="ds-disclosure">${escapeHtml(connect.disclosure || '')}</p>`;

    const matches = (connect.matches || []).map(renderMatch).join('');
    const neighbors = (explore.neighbors || []).map(renderMatch).join('');

    const candidates = (hypothesize.candidates || []).map(candidate => `
      <article class="ds-card ds-hypothesis" data-epistemic="${escapeHtml(candidate.epistemic_class)}">
        <header><span class="ds-card-id">${escapeHtml(candidate.id)}</span>${badge(candidate.epistemic_class, 'constructed')}</header>
        <textarea class="ds-editable" aria-label="Editable hypothesis ${escapeHtml(candidate.id)}" rows="3">${escapeHtml(candidate.statement)}</textarea>
        <dl class="ds-fields">
          <div><dt>Predictions</dt><dd>${escapeHtml((candidate.predictions || []).join(' '))}</dd></div>
          <div><dt>Falsifiers</dt><dd>${escapeHtml((candidate.falsifiers || []).join(' '))}</dd></div>
          <div><dt>Hard-kill conditions</dt><dd>${escapeHtml((candidate.hard_kill_conditions || []).join(' '))}</dd></div>
        </dl>
      </article>`).join('');

    const notes = (challenge.notes || []).map(note => `
      <li class="ds-note">
        <strong>${escapeHtml(note.candidate_id)}</strong>
        <span>${escapeHtml(note.challenge)}</span>
        <span>${escapeHtml(note.confounder)}</span>
      </li>`).join('');

    const proposals = (experiment.proposals || []).map(proposal => `
      <li class="ds-note">
        <strong>${escapeHtml(proposal.candidate_id)} · PROPOSED</strong>
        <span>${escapeHtml(proposal.method)}</span>
        <span>Success: ${escapeHtml(proposal.success_signal)}</span>
        <span>Failure: ${escapeHtml(proposal.failure_signal)}</span>
      </li>`).join('');

    const turnLabel = briefingSession.turn > 1 ? `Turn ${escapeHtml(briefingSession.turn)}` : 'First turn';

    result.innerHTML = `
      <div data-briefing='${escapeHtml(JSON.stringify(data))}'></div>
      <div class="ds-summary">
        <span class="ds-summary-intent">${escapeHtml(encounter.intent || seed.intent)}</span>
        <span class="ds-turn">${turnLabel}</span>
        <p>${escapeHtml(encounter.guidance || '')}</p>
        ${grounding.degraded ? badge('LEXICAL ONLY · DEGRADED', 'degraded') : badge('SEMANTIC RETRIEVAL ACTIVE', 'verified')}
      </div>
      <section class="ds-stage" aria-labelledby="dsConnect">
        <h3 id="dsConnect">Connect</h3>${degraded}
        ${matches ? `<ul class="ds-list">${matches}</ul>` : '<p class="ds-empty">No related records yet. The archive may still be warming up.</p>'}
      </section>
      <section class="ds-stage" aria-labelledby="dsExplore">
        <h3 id="dsExplore">Explore</h3>
        ${explore.shared_concepts.length ? `<p class="ds-concepts">Shared concepts: ${explore.shared_concepts.map(c => escapeHtml(c)).join(' · ')}</p>` : ''}
        ${neighbors ? `<h4>Nearby records</h4><ul class="ds-list">${neighbors}</ul>` : ''}
      </section>
      <section class="ds-stage" aria-labelledby="dsHypothesize">
        <h3 id="dsHypothesize">Hypothesize</h3>
        <p class="ds-disclosure">${escapeHtml(hypothesize.disclosure || '')}</p>
        <div class="ds-cards">${candidates}</div>
      </section>
      <section class="ds-stage" aria-labelledby="dsChallenge">
        <h3 id="dsChallenge">Challenge</h3>
        <ul class="ds-list">${notes}</ul>
      </section>
      <section class="ds-stage" aria-labelledby="dsExperiment">
        <h3 id="dsExperiment">Experiment</h3>
        <p class="ds-disclosure">${escapeHtml(experiment.disclosure || '')}</p>
        <ul class="ds-list">${proposals}</ul>
      </section>
      <section class="ds-stage" aria-labelledby="dsEvolve">
        <h3 id="dsEvolve">Evolve</h3>
        <p class="ds-disclosure">${escapeHtml(evolve.disclosure || '')}</p>
        <p class="ds-concepts">Next: ${(evolve.next_steps || []).map(s => escapeHtml(s)).join(' · ')}</p>
      </section>
      <form class="ds-followup" id="dsFollowup">
        <label class="visually-hidden" for="discoveryFollowupQuery">Follow up on this discovery</label>
        <input id="discoveryFollowupQuery" type="text" maxlength="400" autocomplete="off" placeholder="Follow up: refine, challenge or connect this idea">
        <button id="dsFollowupSubmit" type="submit">CONTINUE</button>
        <button id="dsSave" type="button">SAVE THIS DISCOVERY</button>
        <button id="dsNew" type="button">NEW DISCOVERY</button>
      </form>
      <p class="ds-disclaimer">${escapeHtml(data.disclaimer || '')}</p>`;

    session = {
      seed: briefingSession.seed || seed.text,
      turn: briefingSession.turn || 1,
      history: currentHypotheses()
    };

    const followup = $('dsFollowup');
    followup.addEventListener('submit', event => {
      event.preventDefault();
      const followupQuery = $('discoveryFollowupQuery').value.trim();
      if (followupQuery.length < 2) {
        setStatus('Enter a follow-up question or refinement.', 'error');
        $('discoveryFollowupQuery').focus();
        return;
      }
      session.history = currentHypotheses();
      runDiscovery(followupQuery);
    });
    $('dsSave').addEventListener('click', saveCurrent);
    $('dsNew').addEventListener('click', () => {
      session = null;
      result.hidden = true;
      input.value = '';
      clearStatus();
      input.focus({ preventScroll: true });
    });

    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function runDiscovery(query) {
    clearStatus();
    submit.disabled = true;
    surprise.disabled = true;
    setStatus('Following your idea through the Portal…', null);
    const body = { query };
    const aiToggle = $('discoveryAI');
    if (aiToggle?.checked) body.mode = 'ai';
    if (session) {
      body.followup = { seed: session.seed, turn: (session.turn || 1) + 1, history: session.history || [] };
    }
    try {
      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'The Portal could not complete this discovery.');
      }
      renderBriefing(payload);
      setStatus('Discovery briefing ready. Review each stage and its evidence labels.', 'ok');
    } catch (error) {
      setStatus(error.message || 'The Portal could not complete this discovery.', 'error');
    } finally {
      submit.disabled = false;
      surprise.disabled = false;
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const query = input.value.trim();
    if (query.length < 2) {
      setStatus('Enter a question, observation or idea to begin.', 'error');
      input.focus();
      return;
    }
    session = null;
    runDiscovery(query);
  });

  surprise.addEventListener('click', () => {
    session = null;
    runDiscovery(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  });

  document.querySelectorAll('.prompt-chip[data-prompt]').forEach(chip => {
    chip.addEventListener('click', () => {
      session = null;
      runDiscovery(chip.getAttribute('data-prompt'));
    });
  });

  renderCabinet();
})();
