/**
 * Public discovery rooms — group discovery. Anonymous, consent-gated discussion
 * around questions and topics, with a deterministic facilitator that surfaces
 * shared concepts, unresolved questions and likely disagreements. Nothing is
 * retained without explicit consent and no identity or address is stored.
 */

import { createHash, randomUUID } from 'node:crypto';

const MAX_TOPIC = 200;
const MAX_TEXT = 2000;
const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'are', 'was', 'has', 'have', 'from', 'your', 'what', 'when', 'where', 'which', 'who', 'how', 'why', 'about', 'into', 'than', 'then', 'them', 'they', 'there', 'their', 'will', 'would', 'should', 'could', 'can', 'not', 'but', 'our', 'out', 'over', 'just', 'more', 'some', 'such']);

export function roomHash(topic, text) {
  return createHash('sha256').update(`${String(topic)}|${String(text)}`).digest('hex');
}

export async function ensureRoomsSchema(sql) {
  if (!sql) return false;
  await sql`create table if not exists discovery_rooms(
    id text primary key,
    topic text not null,
    question text,
    status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
    created_at timestamptz not null default now()
  )`;
  await sql`create table if not exists discovery_room_messages(
    id text primary key,
    room_id text not null references discovery_rooms(id) on delete cascade,
    parent_id text,
    author_kind text not null default 'human' check (author_kind in ('human','ai','system')),
    role text not null default 'participant' check (role in ('participant','facilitator')),
    text text not null,
    consent boolean not null default false,
    status text not null default 'PUBLISHED' check (status in ('PUBLISHED','HIDDEN')),
    content_hash text not null unique,
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists discovery_room_messages_room_idx on discovery_room_messages(room_id, created_at)`;
  return true;
}

export async function createRoom(sql, { topic, question = null, consent = false }) {
  if (!sql) return { ok: false, reason: 'db_unavailable' };
  const cleanTopic = String(topic || '').trim().replace(/\s+/g, ' ');
  if (!cleanTopic || cleanTopic.length > MAX_TOPIC) return { ok: false, reason: 'invalid_topic' };
  if (consent !== true) return { ok: false, reason: 'consent_required' };
  await ensureRoomsSchema(sql);
  const id = randomUUID();
  const rows = await sql`insert into discovery_rooms(id,topic,question)
    values(${id},${cleanTopic},${question ? String(question).trim().slice(0, MAX_TOPIC) : null})
    returning id,topic,question,created_at`;
  return { ok: true, room: rows[0] };
}

export async function listRooms(sql, { limit = 30 } = {}) {
  if (!sql) return [];
  await ensureRoomsSchema(sql);
  const n = Math.max(1, Math.min(50, Number(limit) || 30));
  return sql`select id,topic,question,created_at from discovery_rooms order by created_at desc limit ${n}`;
}

export async function postMessage(sql, { roomId, text, parentId = null, consent = false, authorKind = 'human', role = 'participant' }) {
  if (!sql) return { ok: false, reason: 'db_unavailable' };
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > MAX_TEXT) return { ok: false, reason: 'invalid_text' };
  if (consent !== true) return { ok: false, reason: 'consent_required' };
  await ensureRoomsSchema(sql);
  const id = randomUUID();
  const hash = roomHash(roomId, clean);
  const rows = await sql`insert into discovery_room_messages(id,room_id,parent_id,author_kind,role,text,consent,content_hash)
    values(${id},${roomId},${parentId || null},${authorKind},${role},${clean},true,${hash})
    on conflict(content_hash) do nothing returning id,room_id,parent_id,author_kind,role,text,created_at`;
  if (!rows[0]) return { ok: true, duplicate: true };
  return { ok: true, duplicate: false, message: rows[0] };
}

export async function getRoom(sql, id) {
  if (!sql || !id) return null;
  await ensureRoomsSchema(sql);
  const rooms = await sql`select id,topic,question,created_at from discovery_rooms where id=${id} limit 1`;
  if (!rooms[0]) return null;
  const messages = await sql`select id,parent_id,author_kind,role,text,created_at
    from discovery_room_messages where room_id=${id} and status='PUBLISHED' order by created_at asc`;
  return { room: rooms[0], messages, facilitation: facilitateRoom(rooms[0], messages) };
}

export async function hideMessage(sql, { id, reason = null }) {
  if (!sql || !id) return { ok: false, reason: 'invalid_id' };
  await ensureRoomsSchema(sql);
  const rows = await sql`update discovery_room_messages set status='HIDDEN' where id=${id} returning id`;
  return { ok: Boolean(rows[0]), id };
}

const words = text => String(text || '').toLowerCase().split(/\W+/).filter(token => token.length > 3 && !STOP.has(token));

export function facilitateRoom(room, messages = []) {
  const human = messages.filter(message => message.author_kind === 'human');
  const counts = new Map();
  for (const message of human) for (const token of words(message.text)) counts.set(token, (counts.get(token) || 0) + 1);
  const concepts = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
  const questions = human.filter(message => /\?\s*$/.test(String(message.text).trim())).map(message => message.text).slice(0, 6);
  const disagreements = human.filter(message => /\b(disagree|however|but|challenge|no\b|wrong|contrary)\b/i.test(message.text)).length;
  const unsupported = human.filter(message => /\b(must|always|never|everyone|nobody|definitively)\b/i.test(message.text)).length;
  return {
    generation: 'DETERMINISTIC_FACILITATOR',
    model_calls: 0,
    topic: room?.topic || null,
    participant_count: human.length,
    shared_concepts: concepts,
    open_questions: questions,
    disagreement_signals: disagreements,
    unsupported_claim_signals: unsupported,
    summary: human.length
      ? `This discussion has ${human.length} participant message(s), with shared concepts including ${concepts.slice(0, 5).map(item => item.name).join(', ') || 'no strong shared concepts yet'}. ${questions.length ? 'Open questions remain to be resolved.' : 'No explicit question has been raised yet.'}`
      : 'No participant messages yet. Invite a contribution or pose a question to begin.',
    next_steps: [
      'Pose a falsifiable question.',
      'Add evidence with its source.',
      'Challenge the strongest shared assumption.'
    ],
    disclosure: 'Deterministic facilitator summary; no language model was called. Popularity is never treated as truth.'
  };
}
