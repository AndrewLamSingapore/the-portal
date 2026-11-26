/**
 * Living evidence — authorized external evidence with source provenance,
 * content-hash deduplication, relevance assessment, contradiction tracking and
 * controlled rebirth. Evidence is ingested through an authenticated route and
 * fed into the next model cycle as observations.
 */

import { createHash } from 'node:crypto';

const RELATIONS = new Set(['supports', 'contradicts', 'neutral']);

export function evidenceHash(source, summary) {
  return createHash('sha256').update(`${String(source)}|${String(summary)}`).digest('hex');
}

export async function ensureEvidenceSchema(sql) {
  if (!sql) return false;
  await sql`create table if not exists living_evidence(
    id text primary key,
    source text not null,
    summary text not null,
    relation text not null default 'neutral' check (relation in ('supports','contradicts','neutral')),
    target_id text,
    relevance numeric not null default 0,
    consumed boolean not null default false,
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists living_evidence_consumed_idx on living_evidence(consumed, created_at)`;
  return true;
}

export function assessRelevance(summary, concepts = []) {
  const terms = new Set(String(summary || '').toLowerCase().split(/\W+/).filter(term => term.length > 3));
  if (!terms.size || !(concepts || []).length) return 0;
  let hits = 0;
  for (const concept of concepts) {
    for (const token of String(concept).toLowerCase().split(/\W+/)) {
      if (terms.has(token)) hits += 1;
    }
  }
  return Number(Math.min(1, hits / terms.size).toFixed(3));
}

export async function ingestEvidence(sql, { source, summary, relation = 'neutral', targetId = null, concepts = [] }) {
  if (!sql) return { ok: false, reason: 'db_unavailable' };
  const cleanSummary = String(summary || '').trim().replace(/\s+/g, ' ');
  const cleanSource = String(source || '').trim();
  if (!cleanSummary || !cleanSource) return { ok: false, reason: 'invalid_evidence' };
  if (cleanSummary.length > 1000) return { ok: false, reason: 'evidence_too_large' };
  const normalizedRelation = RELATIONS.has(relation) ? relation : 'neutral';
  await ensureEvidenceSchema(sql);
  const id = evidenceHash(cleanSource, cleanSummary);
  const existing = await sql`select id from living_evidence where id=${id} limit 1`;
  if (existing[0]) return { ok: true, duplicate: true, id };
  const relevance = assessRelevance(cleanSummary, concepts);
  await sql`insert into living_evidence(id,source,summary,relation,target_id,relevance)
    values(${id},${cleanSource},${cleanSummary},${normalizedRelation},${targetId || null},${relevance})`;
  return { ok: true, duplicate: false, id, relevance };
}

export async function listPendingEvidence(sql, limit = 12) {
  if (!sql) return [];
  await ensureEvidenceSchema(sql);
  const n = Math.max(1, Math.min(20, Number(limit) || 12));
  return sql`select id,source,summary,relation,target_id,relevance,created_at
    from living_evidence where consumed=false order by created_at asc limit ${n}`;
}

export async function markEvidenceConsumed(sql, ids = []) {
  if (!sql || !ids.length) return;
  await sql`update living_evidence set consumed=true where id=any(${ids}::text[])`;
}

export function applyEvidenceToPopulation({ population = [], fossils = [], evidence = [] }) {
  const byId = new Map(population.map(hypothesis => [hypothesis.id, hypothesis]));
  const fossilById = new Map(fossils.map(fossil => [fossil.id, fossil]));
  const contradictions = [];
  const rebirths = [];
  for (const item of evidence) {
    if (item.relation === 'contradicts' && item.target_id && byId.has(item.target_id)) {
      const target = byId.get(item.target_id);
      target.state = 'CONTESTED';
      target.contradicted_by = item.id;
      contradictions.push({ hypothesis_id: item.target_id, evidence_id: item.id, summary: item.summary });
    } else if (item.relation === 'supports' && item.target_id && fossilById.has(item.target_id)) {
      const fossil = fossilById.get(item.target_id);
      population.push({
        id: fossil.id,
        statement: fossil.statement,
        epistemic_class: fossil.epistemic_class || 'INFERRED',
        state: 'REBORN',
        confidence: fossil.final_confidence ?? 0.3,
        predictions: [],
        falsifiers: [],
        hard_kill_conditions: [],
        ancestry: { parent_ids: [...(fossil.ancestry?.parent_ids || []), item.id], operators: ['REBIRTH'] }
      });
      rebirths.push({ id: fossil.id, evidence_id: item.id });
    }
  }
  return { population, contradictions, rebirths };
}
