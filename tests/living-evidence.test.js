import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evidenceHash,
  assessRelevance,
  ingestEvidence,
  applyEvidenceToPopulation
} from '../lib/living-evidence.js';

function fakeSql() {
  const rows = new Set();
  const sql = async (strings, ...values) => {
    const text = strings.join('?');
    if (text.includes('create table') || text.includes('create index')) return [];
    if (text.includes('select id from living_evidence')) return rows.has(values[0]) ? [{ id: values[0] }] : [];
    if (text.includes('insert into living_evidence')) {
      rows.add(values[0]);
      return [];
    }
    return [];
  };
  return { sql, rows };
}

test('evidence is content-hash deduplicated', async () => {
  const { sql } = fakeSql();
  const first = await ingestEvidence(sql, { source: 'owner', summary: 'A new observation about energy commons.' });
  const second = await ingestEvidence(sql, { source: 'owner', summary: 'A new observation about energy commons.' });
  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.id, first.id);
});

test('evidence rejects empty input and overlong summaries', async () => {
  const { sql } = fakeSql();
  assert.equal((await ingestEvidence(sql, { source: '', summary: 'x' })).ok, false);
  assert.equal((await ingestEvidence(sql, { source: 'owner', summary: 'x'.repeat(1001) })).ok, false);
});

test('relevance is a bounded lexical similarity against known concepts', () => {
  const score = assessRelevance('shared ownership of energy resources', ['energy', 'commons']);
  assert.ok(score > 0);
  assert.ok(score <= 1);
  assert.equal(assessRelevance('unrelated baking', ['energy', 'commons']), 0);
});

test('contradicting evidence contests a hypothesis and supporting evidence revives a fossil', () => {
  const population = [
    { id: 'HYP-1', statement: 'Machines need shared ethics.', epistemic_class: 'INFERRED', state: 'EMERGING', confidence: 0.5, predictions: [], falsifiers: [], hard_kill_conditions: [], ancestry: {} }
  ];
  const fossils = [
    { id: 'FOS-1', statement: 'Energy should be private.', final_confidence: 0.2, superseded_by: 'HYP-1', ancestry: { parent_ids: ['OBS'] } }
  ];
  const evidence = [
    { id: 'EV-1', relation: 'contradicts', target_id: 'HYP-1', summary: 'Machines have no moral standing.' },
    { id: 'EV-2', relation: 'supports', target_id: 'FOS-1', summary: 'New data favours private energy.' }
  ];
  const outcome = applyEvidenceToPopulation({ population, fossils, evidence });
  assert.equal(outcome.population.find(item => item.id === 'HYP-1').state, 'CONTESTED');
  assert.ok(outcome.contradictions.some(item => item.hypothesis_id === 'HYP-1'));
  assert.ok(outcome.rebirths.some(item => item.id === 'FOS-1'));
  const reborn = outcome.population.find(item => item.id === 'FOS-1');
  assert.equal(reborn.state, 'REBORN');
  assert.ok(reborn.ancestry.operators.includes('REBIRTH'));
});
