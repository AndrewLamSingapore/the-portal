import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPopulation, nextGenerationNumber, buildPriorMemory, computeFossils, runModelCycleOnce } from '../lib/living-model-run.js';

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

test('generation increments and prior hypotheses become memory for the next cycle', () => {
  const latest = { result: { generation_number: 2 } };
  assert.equal(nextGenerationNumber(latest), 3);
  assert.equal(nextGenerationNumber(null), 1);
  const memory = buildPriorMemory([{ id: 'HYP-G1-01', statement: 'A survives', state: 'EMERGING' }]);
  assert.equal(memory[0].id, 'HYP-G1-01');
  assert.equal(memory[0].layer, 'EPISTEMIC');
});

test('extinct prior hypotheses are preserved as fossils with lineage', () => {
  const outcome = computeFossils({
    priorPopulation: [
      { id: 'HYP-G1-01', statement: 'kept', confidence: 0.5, ancestry: { parent_ids: ['OBS'] } },
      { id: 'HYP-G1-02', statement: 'dropped', confidence: 0.3, ancestry: { parent_ids: ['OBS'] } }
    ],
    priorFossils: [],
    newCandidates: [{ id: 'HYP-G2-01', ancestry: { parent_ids: ['HYP-G1-01'] } }]
  });
  assert.equal(outcome.extinct.length, 1);
  assert.equal(outcome.extinct[0].id, 'HYP-G1-02');
  assert.equal(outcome.fossils.length, 1);
  assert.equal(outcome.fossils[0].superseded_by, 'HYP-G2-01');
  assert.equal(outcome.self_correction, true);
});
