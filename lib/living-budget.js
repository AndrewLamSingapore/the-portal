/**
 * Living model budget — hard, persistent enforcement for paid model-originated
 * autonomous runs. This module is INACTIVE unless the owner enables it with
 * PORTAL_LIVING_MODEL_ENABLED=1 and configures a budget. It fails closed.
 *
 * Enforcement is a single atomic UPDATE with a spending guard, so concurrent
 * requests and retries can never exceed the configured caps. The defaults are
 * the owner's proposed limits: US$1/day and US$30/month.
 */

import { db } from './db.js';

const USD_TO_MICRO_USD = 1_000_000;

export function rollBudgetState(state, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const monthStart = today.slice(0, 8) + '01';
  const daily = state.daily_window === today ? Number(state.daily_spent_micro_usd) : 0;
  const monthly = state.monthly_window === monthStart ? Number(state.monthly_spent_micro_usd) : 0;
  return {
    daily_spent_micro_usd: daily,
    monthly_spent_micro_usd: monthly,
    daily_window: today,
    monthly_window: monthStart,
    suspended: daily >= Number(state.daily_limit_micro_usd) || monthly >= Number(state.monthly_limit_micro_usd)
  };
}

export const MODEL_BUDGET_DEFAULTS = Object.freeze({
  daily_limit_micro_usd: 1 * USD_TO_MICRO_USD,
  monthly_limit_micro_usd: 30 * USD_TO_MICRO_USD
});

export function isModelBudgetEnabled() {
  return process.env.PORTAL_LIVING_MODEL_ENABLED === '1';
}

export async function ensureModelBudgetSchema(sql) {
  if (!sql) return false;
  await sql`create table if not exists living_model_budget(
    id integer primary key default 1,
    daily_limit_micro_usd bigint not null,
    monthly_limit_micro_usd bigint not null,
    daily_spent_micro_usd bigint not null default 0,
    monthly_spent_micro_usd bigint not null default 0,
    daily_window date not null default current_date,
    monthly_window date not null default date_trunc('month', current_date)::date,
    suspended boolean not null default false,
    updated_at timestamptz not null default now()
  )`;
  await sql`create table if not exists living_model_ledger(
    id bigserial primary key,
    request_id text not null unique,
    model text,
    provider text,
    micro_usd bigint not null default 0,
    status text not null,
    created_at timestamptz not null default now()
  )`;
  await sql`alter table living_model_ledger add column if not exists input_tokens bigint`;
  await sql`alter table living_model_ledger add column if not exists output_tokens bigint`;
  await sql`insert into living_model_budget(id,daily_limit_micro_usd,monthly_limit_micro_usd)
    values(1,${MODEL_BUDGET_DEFAULTS.daily_limit_micro_usd},${MODEL_BUDGET_DEFAULTS.monthly_limit_micro_usd})
    on conflict(id) do nothing`;
  return true;
}

export async function configureModelBudget(sql, { dailyMicroUsd, monthlyMicroUsd } = {}) {
  if (!sql) return false;
  await ensureModelBudgetSchema(sql);
  const daily = Number.isSafeInteger(dailyMicroUsd) && dailyMicroUsd > 0 ? dailyMicroUsd : MODEL_BUDGET_DEFAULTS.daily_limit_micro_usd;
  const monthly = Number.isSafeInteger(monthlyMicroUsd) && monthlyMicroUsd > 0 ? monthlyMicroUsd : MODEL_BUDGET_DEFAULTS.monthly_limit_micro_usd;
  await sql`insert into living_model_budget(id,daily_limit_micro_usd,monthly_limit_micro_usd)
    values(1,${daily},${monthly})
    on conflict(id) do update set daily_limit_micro_usd=excluded.daily_limit_micro_usd, monthly_limit_micro_usd=excluded.monthly_limit_micro_usd, updated_at=now()`;
  return { daily_limit_micro_usd: daily, monthly_limit_micro_usd: monthly };
}

async function rollWindows(sql) {
  await sql`update living_model_budget set
    daily_spent_micro_usd=case when daily_window=current_date then daily_spent_micro_usd else 0 end,
    daily_window=current_date,
    monthly_spent_micro_usd=case when monthly_window=date_trunc('month',current_date)::date then monthly_spent_micro_usd else 0 end,
    monthly_window=date_trunc('month',current_date)::date,
    updated_at=now() where id=1`;
  // Budget-induced suspension clears automatically when a window rolls and
  // capacity is available again. Intentional admin shutdown lives in the
  // separate living_engine_state kill switch and is never touched here.
  await sql`update living_model_budget set
    suspended=(daily_spent_micro_usd>=daily_limit_micro_usd or monthly_spent_micro_usd>=monthly_limit_micro_usd),
    updated_at=now() where id=1`;
}

export async function admitModelRequest(sql, { requestId, estimatedMicroUsd = 0 } = {}) {
  if (!sql || !requestId) return { allowed: false, reason: 'budget_unavailable' };
  await ensureModelBudgetSchema(sql);
  await rollWindows(sql);
  const estimate = Math.max(0, Number(estimatedMicroUsd) || 0);
  // Single atomic guard: spending can never exceed the cap under concurrency.
  const rows = await sql`update living_model_budget set
    daily_spent_micro_usd=daily_spent_micro_usd+${estimate},
    monthly_spent_micro_usd=monthly_spent_micro_usd+${estimate},
    updated_at=now()
    where id=1
      and suspended=false
      and daily_spent_micro_usd+${estimate} <= daily_limit_micro_usd
      and monthly_spent_micro_usd+${estimate} <= monthly_limit_micro_usd
    returning daily_spent_micro_usd,monthly_spent_micro_usd,daily_limit_micro_usd,monthly_limit_micro_usd,suspended`;
  if (!rows[0]) {
    const state = await modelBudgetState(sql);
    return { allowed: false, reason: state.suspended ? 'budget_suspended' : 'budget_exhausted', ...state };
  }
  return { allowed: true, ...rows[0] };
}

export async function settleModelReservation(sql, { requestId, microUsd = 0, success = true, usage = null, release = true } = {}) {
  if (!sql || !requestId) return false;
  await ensureModelBudgetSchema(sql);
  const amount = Math.max(0, Number(microUsd) || 0);
  await sql`insert into living_model_ledger(request_id,model,provider,micro_usd,status,input_tokens,output_tokens)
    values(${requestId},'gpt-5.6','openai',${amount},${success ? 'SUCCEEDED' : 'FAILED'},${usage?.input_tokens ?? null},${usage?.output_tokens ?? null})
    on conflict(request_id) do nothing`;
  if (!success && amount > 0 && release) {
    // Release a failed reservation so retries do not double-spend.
    await sql`update living_model_budget set
      daily_spent_micro_usd=greatest(0,daily_spent_micro_usd-${amount}),
      monthly_spent_micro_usd=greatest(0,monthly_spent_micro_usd-${amount}),
      updated_at=now() where id=1`;
  }
  await sql`update living_model_budget set
    suspended=case when daily_spent_micro_usd>=daily_limit_micro_usd or monthly_spent_micro_usd>=monthly_limit_micro_usd then true else suspended end,
    updated_at=now() where id=1`;
  return true;
}

async function modelBudgetState(sql) {
  const rows = await sql`select * from living_model_budget where id=1 limit 1`;
  const row = rows[0] || null;
  if (!row) return { available: false };
  const remainingDaily = Math.max(0, Number(row.daily_limit_micro_usd) - Number(row.daily_spent_micro_usd));
  const remainingMonthly = Math.max(0, Number(row.monthly_limit_micro_usd) - Number(row.monthly_spent_micro_usd));
  return {
    available: true,
    daily_limit_micro_usd: Number(row.daily_limit_micro_usd),
    monthly_limit_micro_usd: Number(row.monthly_limit_micro_usd),
    daily_spent_micro_usd: Number(row.daily_spent_micro_usd),
    monthly_spent_micro_usd: Number(row.monthly_spent_micro_usd),
    daily_remaining_micro_usd: remainingDaily,
    monthly_remaining_micro_usd: remainingMonthly,
    suspended: Boolean(row.suspended),
    daily_window: row.daily_window,
    monthly_window: row.monthly_window
  };
}

export async function modelBudgetStatus(sql) {
  if (!sql) return { enabled: isModelBudgetEnabled(), available: false };
  await ensureModelBudgetSchema(sql);
  const state = await modelBudgetState(sql);
  return { enabled: isModelBudgetEnabled(), ...state };
}
