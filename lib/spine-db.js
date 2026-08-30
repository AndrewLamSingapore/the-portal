import crypto from 'node:crypto';
import { db } from './db.js';

export async function ensureSpineSchema(){
  const sql=db(); if(!sql) return false;
  await sql`create table if not exists spine_trust_registry(tenant_id text not null,action_type text not null,policy_state text not null,trust_score numeric not null default 0,clean_successes bigint not null default 0,failures bigint not null default 0,platform_locked boolean not null default false,metadata jsonb not null default '{}'::jsonb,updated_at timestamptz not null default now(),primary key(tenant_id,action_type))`;
  await sql`create table if not exists spine_events(id text primary key,tenant_id text not null,correlation_id text not null,event_type text not null,aggregate_type text not null,aggregate_id text not null,payload jsonb not null default '{}'::jsonb,created_at timestamptz not null default now())`;
  await sql`create table if not exists spine_audit_log(id bigserial primary key,tenant_id text not null,correlation_id text not null,idempotency_key text not null,action_type text not null,actor_type text not null,actor_id text not null,policy_state text not null,policy_reason text not null,execution_status text not null default 'NOT_EXECUTED',verification_status text not null default 'PENDING',outcome_status text not null default 'PENDING',envelope jsonb not null,decision_record jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),unique(tenant_id,idempotency_key))`;
  return true;
}

export async function getSpineTrust(tenantId,actionType){
  const sql=db(); if(!sql) return null; await ensureSpineSchema();
  const rows=await sql`select * from spine_trust_registry where tenant_id=${tenantId} and action_type=${actionType} limit 1`;
  return rows[0]||null;
}

export async function appendSpineEvent({tenantId,correlationId,eventType,aggregateId,payload={}}){
  const sql=db(); if(!sql) return false; await ensureSpineSchema();
  await sql`insert into spine_events(id,tenant_id,correlation_id,event_type,aggregate_type,aggregate_id,payload) values(${crypto.randomUUID()},${tenantId},${correlationId},${eventType},'action',${aggregateId},${JSON.stringify(payload)}::jsonb)`;
  return true;
}

export async function writeSpineAudit({envelope,decision,executionStatus,verification,decisionRecord={}}){
  const sql=db(); if(!sql) return null; await ensureSpineSchema();
  const rows=await sql`insert into spine_audit_log(tenant_id,correlation_id,idempotency_key,action_type,actor_type,actor_id,policy_state,policy_reason,execution_status,verification_status,outcome_status,envelope,decision_record) values(${envelope.tenant_id},${envelope.correlation_id},${envelope.idempotency_key},${envelope.action},${envelope.actor_type},${envelope.actor_id},${decision.state},${decision.reason},${executionStatus},${verification.execution},${verification.outcome},${JSON.stringify(envelope)}::jsonb,${JSON.stringify(decisionRecord)}::jsonb) on conflict(tenant_id,idempotency_key) do nothing returning *`;
  if(rows[0]) return rows[0];
  const existing=await sql`select * from spine_audit_log where tenant_id=${envelope.tenant_id} and idempotency_key=${envelope.idempotency_key} limit 1`;
  return existing[0]||null;
}
