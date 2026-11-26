/**
 * Public collective discovery — anonymous, consent-based, moderated
 * contributions. Nothing is published or retained without the visitor's
 * explicit consent, and submissions enter a moderation queue before they can
 * appear publicly. No identity, IP address or behavioural profile is stored.
 */

import { createHash, randomUUID } from 'node:crypto';

const KINDS = new Set(['hypothesis', 'challenge', 'experiment']);
const MAX_TEXT = 1000;

export function contributionHash(kind, text) {
  return createHash('sha256').update(`${kind}|${String(text)}`).digest('hex');
}

export async function ensureContributionSchema(sql) {
  if (!sql) return false;
  await sql`create table if not exists public_contributions(
    id text primary key,
    kind text not null check (kind in ('hypothesis','challenge','experiment')),
    text text not null,
    target_id text,
    consent boolean not null default false,
    status text not null default 'PENDING' check (status in ('PENDING','PUBLISHED','REJECTED')),
    moderation_reason text,
    content_hash text not null unique,
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists public_contributions_status_idx on public_contributions(status, created_at desc)`;
  return true;
}

export async function submitContribution(sql, { kind, text, targetId = null, consent = false }) {
  if (!sql) return { ok: false, reason: 'db_unavailable' };
  if (!KINDS.has(kind)) return { ok: false, reason: 'invalid_kind' };
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > MAX_TEXT) return { ok: false, reason: 'invalid_text' };
  if (consent !== true) return { ok: false, reason: 'consent_required' };
  await ensureContributionSchema(sql);
  const id = randomUUID();
  const hash = contributionHash(kind, clean);
  const rows = await sql`insert into public_contributions(id,kind,text,target_id,consent,content_hash)
    values(${id},${kind},${clean},${targetId || null},true,${hash})
    on conflict(content_hash) do nothing returning id,status`;
  if (!rows[0]) return { ok: true, duplicate: true, status: 'PENDING' };
  return { ok: true, duplicate: false, id: rows[0].id, status: rows[0].status };
}

export async function listPublishedContributions(sql, { limit = 20 } = {}) {
  if (!sql) return [];
  await ensureContributionSchema(sql);
  const n = Math.max(1, Math.min(50, Number(limit) || 20));
  return sql`select id,kind,text,target_id,created_at from public_contributions
    where status='PUBLISHED' order by created_at desc limit ${n}`;
}

export async function moderateContribution(sql, { id, decision, reason = null }) {
  if (!sql || !id) return { ok: false, reason: 'invalid_id' };
  if (decision !== 'publish' && decision !== 'reject') return { ok: false, reason: 'invalid_decision' };
  await ensureContributionSchema(sql);
  const status = decision === 'publish' ? 'PUBLISHED' : 'REJECTED';
  const rows = await sql`update public_contributions set status=${status}, moderation_reason=${reason || null}
    where id=${id} returning id,kind,status`;
  return { ok: Boolean(rows[0]), ...(rows[0] || {}) };
}
