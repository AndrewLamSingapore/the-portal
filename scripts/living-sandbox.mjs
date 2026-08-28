import assert from 'node:assert/strict';
import { nextState, paretoFrontier, validateEvolutionCandidate } from '../lib/evolution.js';

const baseFitness = { accuracy: .5, evidence: .5, novelty: .7, utility: .6, robustness: .5, efficiency: .7, calibration: .6, constraint_compliance: 1 };
const candidate = {
  id: 'HYP-SEED-001', generation: 0,
  statement: 'Energy-per-recovery may anticipate degradation before direct failure.',
  epistemic_class: 'INFERRED', state: 'EMERGING', confidence: .31,
  ancestry: { parent_ids: ['OBS-POWER', 'OBS-RECOVERY'], operators: ['ORIGIN'] },
  falsifiers: ['Recovery normalizes while the proposed signature persists across repeated observations.'],
  fitness: baseFitness
};
assert.equal(validateEvolutionCandidate(candidate).valid, true);

const support = [
  { id: 'E1', polarity: 'SUPPORTS', basis: 'OBSERVATION', summary: 'signature recurs' },
  { id: 'E2', polarity: 'SUPPORTS', basis: 'TOOL_RESULT', summary: 'held-out prediction succeeds' }
];
const strengthened = nextState(candidate, support);
assert.ok(strengthened.confidence > candidate.confidence);

const living = { ...candidate, state: 'LIVING', confidence: strengthened.confidence };
const contradictionWave = [
  { id: 'C1', polarity: 'CONTRADICTS', basis: 'OBSERVATION', summary: 'alternative cause explains event' },
  { id: 'C2', polarity: 'CONTRADICTS', basis: 'SOURCE', summary: 'failure occurs without signature' },
  { id: 'C3', polarity: 'CONTRADICTS', basis: 'TOOL_RESULT', summary: 'prospective prediction fails' }
];
const weakened = nextState(living, contradictionWave);
assert.ok(weakened.confidence < living.confidence);
assert.ok(['CONTESTED', 'DEAD'].includes(weakened.state));

const population = [
  { id: 'A', fitness: baseFitness },
  { id: 'B', fitness: { ...baseFitness, novelty: .9, evidence: .4 } },
  { id: 'C', fitness: { ...baseFitness, accuracy: .2, evidence: .2, novelty: .2, utility: .2, robustness: .2, efficiency: .2, calibration: .2, constraint_compliance: .8 } }
];
const frontier = paretoFrontier(population).map(item => item.id);
assert.ok(frontier.includes('A') && frontier.includes('B'));
assert.ok(!frontier.includes('C'));

console.log('Portal 6.3 living sandbox probe: PASS');
