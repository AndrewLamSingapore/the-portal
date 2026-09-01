import { assertContract } from './generated/portfolio-contracts.js';

async function database(){const {db}=await import('../../lib/db.js');return db();}

export function portalEvent(eventType,payload,{eventId,occurredAt=new Date().toISOString(),correlationId=null,subjectId=null,evidenceLevel='E0',provenance=[]}={}) {
  if(!eventId) throw new Error('eventId is required for idempotency');
  const evidenceProvenance=provenance.length?[...provenance]:[`the-portal:${eventId}`];
  const event={schema_version:'1.0.0',event_id:eventId,event_type:eventType,source:'the-portal',occurred_at:occurredAt,correlation_id:correlationId||eventId,subject_id:subjectId,evidence_level:evidenceLevel,provenance:evidenceProvenance,payload:{...payload}};
  return assertContract('portfolio-event-v1',event);
}

export async function ensurePortfolioOutbox(){
  const sql=await database();if(!sql)return false;
  await sql`create table if not exists portfolio_event_outbox(
    event_id text primary key,event_json jsonb not null,status text not null default 'PENDING',
    attempts integer not null default 0,next_attempt_at timestamptz not null default now(),
    last_error text,delivered_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
    check(status in ('PENDING','RETRY','DELIVERED','DEAD')))`;
  await sql`create index if not exists portfolio_event_outbox_delivery_idx on portfolio_event_outbox(status,next_attempt_at)`;
  return true;
}

export async function enqueuePortfolioEvent(event){
  assertContract('portfolio-event-v1',event);const sql=await database();if(!sql)return {queued:false,reason:'DATABASE_URL not configured',event_id:event.event_id};
  await ensurePortfolioOutbox();
  await sql`insert into portfolio_event_outbox(event_id,event_json) values(${event.event_id},${JSON.stringify(event)}::jsonb) on conflict(event_id) do nothing`;
  return {queued:true,event_id:event.event_id};
}

export async function emitToPrime(event,{baseUrl=process.env.PRIME_BASE_URL,token=process.env.PRIME_SPINE_TOKEN,fetchImpl=fetch}={}) {
  assertContract('portfolio-event-v1',event);
  if(!baseUrl)return {delivered:false,reason:'PRIME_BASE_URL not configured',event};
  if(!token)return {delivered:false,reason:'PRIME_SPINE_TOKEN not configured',event};
  const response=await fetchImpl(`${baseUrl.replace(/\/$/,'')}/api/cognitive/events`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`},body:JSON.stringify(event)});
  if(!response.ok)throw new Error(`PRIME event delivery failed: ${response.status}`);
  return {delivered:true,response:await response.json()};
}

export async function deliverPortfolioOutbox({limit=20,fetchImpl=fetch}={}){
  const sql=await database();if(!sql)return {processed:0,delivered:0,dead:0,reason:'DATABASE_URL not configured'};
  await ensurePortfolioOutbox();const capped=Math.max(1,Math.min(Number(limit)||20,100));
  const rows=await sql`select event_id,event_json,attempts from portfolio_event_outbox where status in ('PENDING','RETRY') and next_attempt_at<=now() order by created_at limit ${capped}`;
  let delivered=0,dead=0;
  for(const row of rows){
    try{
      const result=await emitToPrime(row.event_json,{fetchImpl});
      if(!result.delivered)throw new Error(result.reason);
      await sql`update portfolio_event_outbox set status='DELIVERED',attempts=attempts+1,delivered_at=now(),last_error=null,updated_at=now() where event_id=${row.event_id}`;delivered++;
    }catch(error){
      const attempts=Number(row.attempts||0)+1;const status=attempts>=8?'DEAD':'RETRY';const delay=Math.min(3600,15*(2**Math.min(attempts,8)));const next=new Date(Date.now()+delay*1000).toISOString();const message=String(error?.message||error).slice(0,500);
      await sql`update portfolio_event_outbox set status=${status},attempts=${attempts},next_attempt_at=${next},last_error=${message},updated_at=now() where event_id=${row.event_id}`;if(status==='DEAD')dead++;
    }
  }
  return {processed:rows.length,delivered,dead};
}

export async function publishPortalEvents(events,{fetchImpl=fetch}={}){
  const queued=[];for(const event of events)queued.push(await enqueuePortfolioEvent(event));
  const delivery=await deliverPortfolioOutbox({limit:events.length,fetchImpl});return {queued,delivery};
}
