(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  let liveTimer = null;
  let replyParentId = null;

  function messageMarkup(message) {
    const kind = message.author_kind === 'ai' ? 'ai' : message.author_kind === 'system' ? 'system' : 'human';
    const label = kind === 'ai' ? 'AI facilitator' : kind === 'system' ? 'system' : 'participant';
    const reply = kind === 'human'
      ? `<button class="tg-reply-button" type="button" data-parent="${escapeHtml(message.id)}">Reply</button>`
      : '';
    return `<li class="tg-message tg-${kind}${message.parent_id ? ' tg-reply' : ''}">
      <span class="tg-meta">${escapeHtml(label)}</span>
      <p>${escapeHtml(message.text)}</p>${reply}
    </li>`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function status(node, message) {
    node.textContent = message;
  }

  async function loadRooms() {
    try {
      const response = await fetch('/api/rooms', { headers: { 'cache-control': 'no-cache' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load rooms.');
      $('tgStatus').textContent = payload.rooms.length ? 'Rooms ready.' : 'No rooms yet. Start the first one below.';
      $('tgRooms').innerHTML = (payload.rooms || []).map(room => `
        <button class="tg-room" type="button" data-room="${escapeHtml(room.id)}">
          <strong>${escapeHtml(room.topic)}</strong>
          ${room.question ? `<span>${escapeHtml(room.question)}</span>` : ''}
        </button>`).join('');
      $('tgRooms').querySelectorAll('[data-room]').forEach(button => {
        button.addEventListener('click', () => openRoom(button.getAttribute('data-room')));
      });
    } catch (error) {
      $('tgStatus').textContent = error.message;
    }
  }

  async function openRoom(id) {
    try {
      const response = await fetch(`/api/rooms?id=${encodeURIComponent(id)}`, { headers: { 'cache-control': 'no-cache' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Room unavailable.');
      const room = payload.room;
      const messages = payload.messages || [];
      const facilitation = payload.facilitation || {};
      const messagesHtml = messages.map(messageMarkup).join('');
      $('roomView').innerHTML = `
        <header class="tg-panel-head"><p class="index">ROOM</p><h2 id="roomViewTitle">${escapeHtml(room.topic)}</h2></header>
        ${room.question ? `<p class="tg-note">${escapeHtml(room.question)}</p>` : ''}
        <section class="tg-facilitator" id="tgFacilitator">
          <h3>Facilitator summary</h3>
          <p>${escapeHtml(facilitation.summary || '')}</p>
          ${facilitation.shared_concepts?.length ? `<p class="tg-note">Concepts: ${facilitation.shared_concepts.map(c => escapeHtml(c.name)).join(' · ')}</p>` : ''}
          ${facilitation.open_questions?.length ? `<p class="tg-note">Open questions: ${facilitation.open_questions.map(escapeHtml).join(' · ')}</p>` : ''}
          <p class="tg-disclosure">${escapeHtml(facilitation.disclosure || '')}</p>
        </section>
        <button class="tg-ai-button" id="aiFacilitate" type="button">AI FACILITATOR</button>
        <p class="tg-status" id="facilitateStatus" role="status" aria-live="polite"></p>
        <p class="tg-note" id="tgLive">Live updates every 15 seconds.</p>
        <ul class="tg-messages" id="tgMessagesList">${messagesHtml || '<li class="tg-empty">No messages yet.</li>'}</ul>
        <form id="replyForm" class="tg-form">
          <label for="replyText">Contribute a thought, question, evidence or challenge</label>
          <textarea id="replyText" maxlength="2000" rows="3" required></textarea>
          <label class="tg-consent"><input type="checkbox" id="replyConsent" required> I consent to publishing this anonymously.</label>
          <button type="submit">POST</button>
          <p class="tg-status" id="replyStatus" role="status" aria-live="polite"></p>
        </form>`;
      $('roomView').hidden = false;
      clearInterval(liveTimer);
      liveTimer = setInterval(() => refreshLive(id), 15000);
      $('tgMessagesList').querySelectorAll('[data-parent]').forEach(button => {
        button.addEventListener('click', () => {
          replyParentId = button.getAttribute('data-parent');
          $('replyText').focus();
          status($('replyStatus'), 'Replying to a message.');
        });
      });
      $('aiFacilitate').addEventListener('click', async () => {
        status($('facilitateStatus'), 'Synthesising discussion…');
        const result = await fetch('/api/rooms/facilitate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_id: id })
        });
        const payload = await result.json().catch(() => ({}));
        if (!result.ok) { status($('facilitateStatus'), payload.error || 'Facilitator unavailable.'); return; }
        status($('facilitateStatus'), payload.generation === 'MODEL_ORIGINATED' ? 'AI synthesis ready.' : 'Deterministic synthesis ready (model unavailable or over budget).');
        openRoom(id);
      });
      $('replyForm').addEventListener('submit', async event => {
        event.preventDefault();
        const text = $('replyText').value.trim();
        if (text.length < 2) { status($('replyStatus'), 'Enter your contribution first.'); return; }
        if (!$('replyConsent').checked) { status($('replyStatus'), 'Consent is required before anything is retained.'); return; }
        const result = await fetch('/api/rooms/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_id: id, text, consent: true, parent_id: replyParentId })
        });
        const reply = await result.json().catch(() => ({}));
        if (!result.ok) { status($('replyStatus'), reply.error || 'Could not post.'); return; }
        status($('replyStatus'), reply.duplicate ? 'Already posted.' : 'Posted. Refreshing…');
        replyParentId = null;
        openRoom(id);
      });
      $('roomView').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      status($('tgStatus'), error.message);
    }
  }

  async function refreshLive(id) {
    try {
      const response = await fetch(`/api/rooms?id=${encodeURIComponent(id)}`, { headers: { 'cache-control': 'no-cache' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const list = $('tgMessagesList');
      const facilitator = $('tgFacilitator');
      if (!list || !facilitator) { clearInterval(liveTimer); return; }
      const messages = payload.messages || [];
      const facilitation = payload.facilitation || {};
      list.innerHTML = messages.length ? messages.map(messageMarkup).join('') : '<li class="tg-empty">No messages yet.</li>';
      facilitator.innerHTML = `<h3>Facilitator summary</h3>
        <p>${escapeHtml(facilitation.summary || '')}</p>
        ${facilitation.shared_concepts?.length ? `<p class="tg-note">Concepts: ${facilitation.shared_concepts.map(c => escapeHtml(c.name)).join(' · ')}</p>` : ''}
        ${facilitation.open_questions?.length ? `<p class="tg-note">Open questions: ${facilitation.open_questions.map(escapeHtml).join(' · ')}</p>` : ''}
        <p class="tg-disclosure">${escapeHtml(facilitation.disclosure || '')}</p>`;
    } catch {
      // transient network errors are ignored; the next poll retries
    }
  }

  $('createRoomForm').addEventListener('submit', async event => {
    event.preventDefault();
    const topic = $('roomTopic').value.trim();
    if (topic.length < 3) { status($('createStatus'), 'Enter a topic first.'); return; }
    if (!$('roomConsent').checked) { status($('createStatus'), 'Consent is required.'); return; }
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, question: $('roomQuestion').value.trim() || null, consent: true })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { status($('createStatus'), payload.error || 'Could not create room.'); return; }
    status($('createStatus'), 'Room created.');
    $('createRoomForm').reset();
    loadRooms();
  });

  const requestedRoom = new URLSearchParams(window.location.search).get('room');

  loadRooms();
  if (requestedRoom) openRoom(requestedRoom);
})();
