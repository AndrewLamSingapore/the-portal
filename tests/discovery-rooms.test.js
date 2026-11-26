import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, postMessage, facilitateRoom, hideMessage } from '../lib/discovery-rooms.js';

function fakeSql() {
  const rooms = new Map();
  const messages = new Map();
  const sql = async (strings, ...values) => {
    const text = strings.join('?');
    if (text.includes('create table') || text.includes('create index')) return [];
    if (text.includes('insert into discovery_rooms')) {
      const [id, topic, question] = values;
      const room = { id, topic, question, created_at: 'now' };
      rooms.set(id, room);
      return [room];
    }
    if (text.includes('select id,topic,question,created_at from discovery_rooms where id=')) return rooms.has(values[0]) ? [rooms.get(values[0])] : [];
    if (text.includes('select id,topic,question,created_at from discovery_rooms order by')) return [...rooms.values()];
    if (text.includes('insert into discovery_room_messages')) {
      const [id, roomId, parentId, kind, role, body, consent, hash] = values;
      if ([...messages.values()].some(message => message.content_hash === hash)) return [];
      const message = { id, room_id: roomId, parent_id: parentId, author_kind: kind, role, text: body, consent, content_hash: hash };
      messages.set(id, message);
      return [message];
    }
    if (text.includes('select id,parent_id,author_kind,role,text,created_at from discovery_room_messages')) {
      return [...messages.values()].filter(message => message.room_id === values[0] && message.status !== 'HIDDEN');
    }
    if (text.includes("set status='HIDDEN'")) {
      const row = messages.get(values[0]);
      if (row) { row.status = 'HIDDEN'; return [row]; }
      return [];
    }
    return [];
  };
  return { sql, rooms, messages };
}

test('rooms require explicit consent and are created anonymously', async () => {
  const { sql } = fakeSql();
  assert.equal((await createRoom(sql, { topic: 'Machine ethics', consent: false })).ok, false);
  const created = await createRoom(sql, { topic: 'Machine ethics', question: 'Should machines have rights?', consent: true });
  assert.equal(created.ok, true);
  assert.equal(created.room.topic, 'Machine ethics');
});

test('messages require consent and are content-hash deduplicated', async () => {
  const { sql } = fakeSql();
  await createRoom(sql, { topic: 'Energy commons', consent: true });
  assert.equal((await postMessage(sql, { roomId: 'r', text: 'A contribution', consent: false })).ok, false);
  const first = await postMessage(sql, { roomId: 'r', text: 'A contribution', consent: true });
  const duplicate = await postMessage(sql, { roomId: 'r', text: 'A contribution', consent: true });
  assert.equal(first.ok, true);
  assert.equal(duplicate.duplicate, true);
});

test('the facilitator is deterministic and never treats popularity as truth', () => {
  const facilitation = facilitateRoom(
    { topic: 'Energy commons' },
    [
      { author_kind: 'human', text: 'Shared ownership of energy could reduce waste, but it may also reduce investment.' },
      { author_kind: 'human', text: 'What evidence would settle this?' }
    ]
  );
  assert.equal(facilitation.generation, 'DETERMINISTIC_FACILITATOR');
  assert.equal(facilitation.model_calls, 0);
  assert.equal(facilitation.participant_count, 2);
  assert.equal(facilitation.disagreement_signals, 1);
  assert.equal(facilitation.open_questions.length, 1);
  assert.match(facilitation.disclosure, /never treated as truth/i);
});

test('moderation hides a message', async () => {
  const { sql } = fakeSql();
  const posted = await postMessage(sql, { roomId: 'r', text: 'A message', consent: true });
  const hidden = await hideMessage(sql, { id: posted.message.id });
  assert.equal(hidden.ok, true);
  const outcome = await hideMessage(sql, { id: 'missing' });
  assert.equal(outcome.ok, false);
});
