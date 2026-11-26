import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPopulation, runModelCycleOnce } from '../lib/living-model-run.js';

test('model candidates map to observatory population with ancestry preserved', () => {
  const population = mapPopulation([
    {
      id: 'HYP-G1-01',
      statement: 'A machine may need shared ethics',
      epistemic_class: 'INFERRED',
      state: 'EMERGING',
      confidence: 0.3,
      predictions: ['p'],
      falsifiers: ['f'],
      hard_kill_conditions: ['k'],
      ancestry: { parent_ids: ['OBS'], operators: ['ORIGIN'] }
    }
  ]);
  assert.equal(population[0].id, 'HYP-G1-01');
  assert.equal(population[0].statement, 'A machine may need shared ethics');
  assert.deepEqual(population[0].ancestry.parent_ids, ['OBS']);
});

test('model runs fail closed when disabled', async () => {
  const previous = process.env.PORTAL_LIVING_MODEL_ENABLED;
  delete process.env.PORTAL_LIVING_MODEL_ENABLED;
  const outcome = await runModelCycleOnce({ sql: null });
  assert.equal(outcome.status, 'DISABLED');
  if (previous === undefined) delete process.env.PORTAL_LIVING_MODEL_ENABLED; else process.env.PORTAL_LIVING_MODEL_ENABLED = previous;
});

test('model runs require a database even when enabled', async () => {
  const previous = process.env.PORTAL_LIVING_MODEL_ENABLED;
  process.env.PORTAL_LIVING_MODEL_ENABLED = '1';
  const outcome = await runModelCycleOnce({ sql: null });
  assert.equal(outcome.status, 'BLOCKED');
  if (previous === undefined) delete process.env.PORTAL_LIVING_MODEL_ENABLED; else process.env.PORTAL_LIVING_MODEL_ENABLED = previous;
});
