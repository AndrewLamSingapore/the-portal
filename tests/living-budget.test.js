import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureModelBudgetSchema,
  configureModelBudget,
  admitModelRequest,
  settleModelReservation,
  modelBudgetStatus
} from '../lib/living-budget.js';

function fakeSql({ dailyLimit = 1_000_000, monthlyLimit = 30_000_000 } = {}) {
  const state = { daily_limit: dailyLimit, monthly_limit: monthlyLimit, daily_spent: 0, monthly_spent: 0, suspended: false };
  const sql = async (strings, ...values) => {
    const text = strings.join('?');
    if (text.includes('create table') || text.includes('create index')) return [];
    if (text.includes('insert into living_model_budget') && text.includes('do nothing')) return [];
    if (text.includes('insert into living_model_budget') && text.includes('do update')) {
      state.daily_limit = values[1];
      state.monthly_limit = values[2];
      return [];
    }
    if (text.includes('insert into living_model_ledger')) return [];
    if (text.includes('daily_window')) return [];
    if (text.includes('greatest(')) {
      const amount = values[0];
      state.daily_spent = Math.max(0, state.daily_spent - amount);
      state.monthly_spent = Math.max(0, state.monthly_spent - amount);
      return [];
    }
    if (text.includes('suspended=case')) {
      state.suspended = state.daily_spent >= state.daily_limit || state.monthly_spent >= state.monthly_limit;
      return [];
    }
    if (text.includes('returning daily_spent_micro_usd')) {
      const estimate = values[0];
      if (!state.suspended && state.daily_spent + estimate <= state.daily_limit && state.monthly_spent + estimate <= state.monthly_limit) {
        state.daily_spent += estimate;
        state.monthly_spent += estimate;
        return [{ daily_spent_micro_usd: state.daily_spent, monthly_spent_micro_usd: state.monthly_spent, daily_limit_micro_usd: state.daily_limit, monthly_limit_micro_usd: state.monthly_limit, suspended: false }];
      }
      return [];
    }
    if (text.includes('select * from living_model_budget')) {
      return [{ id: 1, daily_limit_micro_usd: state.daily_limit, monthly_limit_micro_usd: state.monthly_limit, daily_spent_micro_usd: state.daily_spent, monthly_spent_micro_usd: state.monthly_spent, daily_window: 'today', monthly_window: 'month', suspended: state.suspended }];
    }
    return [];
  };
  return { sql, get state() { return state; } };
}

test('the model budget enforces the cap before any model request', async () => {
  const { sql } = fakeSql({ dailyLimit: 100, monthlyLimit: 300 });
  const first = await admitModelRequest(sql, { requestId: 'r1', estimatedMicroUsd: 60 });
  const second = await admitModelRequest(sql, { requestId: 'r2', estimatedMicroUsd: 50 });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.equal(second.reason, 'budget_exhausted');
});

test('failed reservations are released so retries do not double-spend', async () => {
  const { sql } = fakeSql({ dailyLimit: 100, monthlyLimit: 300 });
  const first = await admitModelRequest(sql, { requestId: 'r1', estimatedMicroUsd: 80 });
  assert.equal(first.allowed, true);
  await settleModelReservation(sql, { requestId: 'r1', microUsd: 80, success: false });
  const retry = await admitModelRequest(sql, { requestId: 'r2', estimatedMicroUsd: 80 });
  assert.equal(retry.allowed, true, 'a released reservation must free the cap for a retry');
});

test('the budget suspends automatically when exhausted and reports public status', async () => {
  const { sql } = fakeSql({ dailyLimit: 100, monthlyLimit: 300 });
  await admitModelRequest(sql, { requestId: 'r1', estimatedMicroUsd: 100 });
  await settleModelReservation(sql, { requestId: 'r1', microUsd: 100, success: true });
  const status = await modelBudgetStatus(sql);
  assert.equal(status.suspended, true);
  assert.equal(status.daily_remaining_micro_usd, 0);
  const next = await admitModelRequest(sql, { requestId: 'r2', estimatedMicroUsd: 1 });
  assert.equal(next.allowed, false);
  assert.equal(next.reason, 'budget_suspended');
});
