import { assertContract } from './generated/portfolio-contracts.js';

async function database() { const { db } = await import('../../lib/db.js'); return db(); }

export function portalEvent(eventType, payload, { eventId, occurredAt = new Date().toISOString(), correlationId = null, subjectId = null, evidenceLevel = 'E0', provenance = [] } = {}) {
  if (!eventId) throw new Error('eventId is required for idempotency');
  const evidenceProvenance = provenance.length ? [...provenance] : [`the-portal:${eventId}`];
  const event = { schema_version: '1.0.0', event_id: eventId, event_type: eventType, source: 'the-portal', occurred_at: occurredAt, correlation_id: correlationId || eventId, subject_id: subjectId, evidence_level: evidenceLevel, provenance: evidenceProvenance, payload: { ...payload } };
  return assertContract('portfolio-event-v1', event);
}

export async function ensurePortfolioOutbox() {
  const sql = await database();
  if (!sql) return false;
  await sql`create table if not exists portfolio_event_outbox(
    event_id text primary key,event_json jsonb not null,status text not null default 'PENDING',
    attempts integer not null default 0,next_attempt_at timestamptz not null default now(),
    last_error text,delivered_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
    check(status in ('PENDING','RETRY','DELIVERED','DEAD')))`;
  await sql`create index if not exists portfolio_event_outbox_delivery_idx on portfolio_event_outbox(status,next_attempt_at)`;
  return true;
}

export async function enqueuePortfolioEvent(event) {
  assertContract('portfolio-event-v1', event);
  const sql = await database();
  if (!sql) return { queued: false, reason: 'DATABASE_URL not configured', event_id: event.event_id };
  await ensurePortfolioOutbox();
  await sql`insert into portfolio_event_outbox(event_id,event_json) values(${event.event_id},${JSON.stringify(event)}::jsonb) on conflict(event_id) do nothing`;
  return { queued: true, event_id: event.event_id };
}

export async function claimPortfolioEvents({ limit = 20, visibilitySeconds = 120 } = {}) {
  const sql = await database();
  if (!sql) return { events: [], reason: 'DATABASE_URL not configured' };
  await ensurePortfolioOutbox();
  const capped = Math.max(1, Math.min(Number(limit) || 20, 100));
  const lease = Math.max(30, Math.min(Number(visibilitySeconds) || 120, 900));
  const nextAttempt = new Date(Date.now() + lease * 1000).toISOString();
  const rows = await sql`with candidates as (
    select event_id from portfolio_event_outbox
    where status in ('PENDING','RETRY') and next_attempt_at<=now()
    order by created_at for update skip locked limit ${capped}
  ) update portfolio_event_outbox as outbox
    set status='RETRY',attempts=outbox.attempts+1,next_attempt_at=${nextAttempt},updated_at=now()
    from candidates where outbox.event_id=candidates.event_id
    returning outbox.event_json,outbox.attempts`;
  return { events: rows.map(row => row.event_json), lease_seconds: lease };
}

export async function acknowledgePortfolioEvents(eventIds = []) {
  const sql = await database();
  if (!sql) return { acknowledged: 0, reason: 'DATABASE_URL not configured' };
  await ensurePortfolioOutbox();
  const ids = [...new Set(eventIds.map(String).filter(Boolean))].slice(0, 100);
  let acknowledged = 0;
  for (const eventId of ids) {
    const rows = await sql`update portfolio_event_outbox set status='DELIVERED',delivered_at=now(),last_error=null,updated_at=now() where event_id=${eventId} and status!='DELIVERED' returning event_id`;
    acknowledged += rows.length;
  }
  return { acknowledged };
}

export async function emitToPrime(event, { baseUrl = process.env.PRIME_BASE_URL, token = process.env.PRIME_SPINE_TOKEN, fetchImpl = fetch } = {}) {
  assertContract('portfolio-event-v1', event);
  if (!baseUrl) return { delivered: false, reason: 'PRIME_BASE_URL not configured', event };
  if (!token) return { delivered: false, reason: 'PRIME_SPINE_TOKEN not configured', event };
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/cognitive/events`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(event) });
  if (!response.ok) throw new Error(`PRIME event delivery failed: ${response.status}`);
  return { delivered: true, response: await response.json() };
}

export async function deliverPortfolioOutbox({ limit = 20, fetchImpl = fetch } = {}) {
  const sql = await database();
  if (!sql) return { processed: 0, delivered: 0, dead: 0, reason: 'DATABASE_URL not configured' };
  await ensurePortfolioOutbox();
  const capped = Math.max(1, Math.min(Number(limit) || 20, 100));
  const rows = await sql`select event_id,event_json,attempts from portfolio_event_outbox where status in ('PENDING','RETRY') and next_attempt_at<=now() order by created_at limit ${capped}`;
  let delivered = 0;
  let dead = 0;
  for (const row of rows) {
    try {
      const result = await emitToPrime(row.event_json, { fetchImpl });
      if (!result.delivered) throw new Error(result.reason);
      await sql`update portfolio_event_outbox set status='DELIVERED',attempts=attempts+1,delivered_at=now(),last_error=null,updated_at=now() where event_id=${row.event_id}`;
      delivered += 1;
    } catch (error) {
      const attempts = Number(row.attempts || 0) + 1;
      const status = attempts >= 8 ? 'DEAD' : 'RETRY';
      const delay = Math.min(3600, 15 * (2 ** Math.min(attempts, 8)));
      const next = new Date(Date.now() + delay * 1000).toISOString();
      const message = String(error?.message || error).slice(0, 500);
      await sql`update portfolio_event_outbox set status=${status},attempts=${attempts},next_attempt_at=${next},last_error=${message},updated_at=now() where event_id=${row.event_id}`;
      if (status === 'DEAD') dead += 1;
    }
  }
  return { processed: rows.length, delivered, dead };
}

export async function publishPortalEvents(events, { fetchImpl = fetch } = {}) {
  const queued = [];
  for (const event of events) queued.push(await enqueuePortfolioEvent(event));
  const delivery = await deliverPortfolioOutbox({ limit: events.length, fetchImpl });
  return { queued, delivery };
}

export async function portfolioOutboxStatus() {
  const sql = await database();
  if (!sql) return { configured: false, counts: {}, ready: 0, oldest_ready_age_seconds: null };
  await ensurePortfolioOutbox();
  const [counts, ready] = await Promise.all([
    sql`select status,count(*)::integer as count from portfolio_event_outbox group by status`,
    sql`select count(*)::integer as count,
      extract(epoch from (now()-min(created_at)))::integer as oldest_age
      from portfolio_event_outbox where status in ('PENDING','RETRY') and next_attempt_at<=now()`,
  ]);
  return {
    configured: true,
    counts: Object.fromEntries(counts.map(row => [row.status, Number(row.count || 0)])),
    ready: Number(ready[0]?.count || 0),
    oldest_ready_age_seconds: ready[0]?.oldest_age == null ? null : Number(ready[0].oldest_age),
  };
}

export async function redrivePortfolioEvents({ eventIds = [], limit = 20 } = {}) {
  const sql = await database();
  if (!sql) return { redriven: 0, reason: 'DATABASE_URL not configured' };
  await ensurePortfolioOutbox();
  const ids = [...new Set(eventIds.map(String).filter(Boolean))].slice(0, 100);
  const capped = Math.max(1, Math.min(Number(limit) || 20, 100));
  let rows;
  if (ids.length) {
    rows = await sql`update portfolio_event_outbox set status='RETRY',attempts=0,
      next_attempt_at=now(),last_error=null,delivered_at=null,updated_at=now()
      where status='DEAD' and event_id=any(${ids}::text[]) returning event_id`;
  } else {
    rows = await sql`with candidates as (
      select event_id from portfolio_event_outbox where status='DEAD'
      order by updated_at for update skip locked limit ${capped}
    ) update portfolio_event_outbox as outbox set status='RETRY',attempts=0,
      next_attempt_at=now(),last_error=null,delivered_at=null,updated_at=now()
      from candidates where outbox.event_id=candidates.event_id returning outbox.event_id`;
  }
  return { redriven: rows.length, event_ids: rows.map(row => row.event_id) };
}
