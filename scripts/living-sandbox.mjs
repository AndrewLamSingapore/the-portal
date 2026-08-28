import assert from 'node:assert/strict';
import { nextState, paretoFrontier, validateEvolutionCandidate } from '../lib/evolution.js';
import { runLivingSandbox, SANDBOX_SEED } from '../lib/living-sandbox.js';
import { reproducePopulation } from '../lib/multigeneration.js';

const baseFitness = { accuracy:.5, evidence:.5, novelty:.7, utility:.6, robustness:.5, efficiency:.7, calibration:.6, constraint_compliance:1 };
const candidate = { id:'HYP-SEED-001', generation:0, statement:'Energy-per-recovery may anticipate degradation before direct failure.', epistemic_class:'INFERRED', state:'EMERGING', confidence:.31, ancestry:{ parent_ids:['OBS-POWER','OBS-RECOVERY'], operators:['ORIGIN'] }, evidence:[], assumptions:['baseline is comparable'], predictions:['signature precedes failure'], falsifiers:['Recovery normalizes while the proposed signature persists across repeated observations.'], hard_kill_conditions:['Repeated held-out failures show no association after confounder control.'], fitness:baseFitness, history:[] };
assert.equal(validateEvolutionCandidate(candidate).valid, true);

const support = [{ id:'E1', polarity:'SUPPORTS', basis:'OBSERVATION', summary:'signature recurs' }, { id:'E2', polarity:'SUPPORTS', basis:'TOOL_RESULT', summary:'held-out prediction succeeds' }];
const strengthened = nextState(candidate, support);
assert.ok(strengthened.confidence > candidate.confidence);

const living = { ...candidate, state:'LIVING', confidence:strengthened.confidence };
const contradictionWave = [{ id:'C1', polarity:'CONTRADICTS', basis:'OBSERVATION', summary:'alternative cause explains event' }, { id:'C2', polarity:'CONTRADICTS', basis:'SOURCE', summary:'failure occurs without signature' }, { id:'C3', polarity:'CONTRADICTS', basis:'TOOL_RESULT', summary:'prospective prediction fails' }];
const weakened = nextState(living, contradictionWave);
assert.ok(weakened.confidence < living.confidence);
assert.ok(['CONTESTED','DEAD'].includes(weakened.state));

const deadCandidate = { ...living, state:'DEAD', confidence:.08 };
assert.equal(nextState(deadCandidate, support).state, 'DEAD', 'DEAD may not silently return to LIVING');

const population = [{ id:'A', fitness:baseFitness }, { id:'B', fitness:{ ...baseFitness, novelty:.9, evidence:.4 } }, { id:'C', fitness:{ ...baseFitness, accuracy:.2, evidence:.2, novelty:.2, utility:.2, robustness:.2, efficiency:.2, calibration:.2, constraint_compliance:.8 } }];
const frontier = paretoFrontier(population).map(item => item.id);
assert.ok(frontier.includes('A') && frontier.includes('B'));
assert.ok(!frontier.includes('C'));

const firstRun = runLivingSandbox(SANDBOX_SEED);
const secondRun = runLivingSandbox(SANDBOX_SEED);
assert.deepEqual(firstRun, secondRun, 'Fixed-seed sandbox must be deterministic');
const degradation = firstRun.population.find(item => item.id === 'HYP-EDGE-DEGRADATION');
assert.equal(degradation?.state, 'DEAD', 'Contradictory delayed evidence must kill the original hypothesis');
assert.ok(firstRun.fossil_record.some(item => item.id === degradation.id), 'Dead hypothesis must remain in the fossil record');
assert.equal(degradation?.superseded_by, 'HYP-EDGE-RESISTANCE', 'Alternative hypothesis must explicitly supersede the killed lineage');
assert.ok(Object.values(firstRun.acceptance).every(Boolean), 'Every deterministic sandbox acceptance gate must pass');

const parent = { ...candidate, id:'HYP-G1-01', generation:1, niche:'SCIENTIST', state:'LIVING', confidence:.6, discriminating_test:'controlled flow-path cleaning' };
const child = reproducePopulation([parent], 2)[0];
assert.ok(child, 'Living parent must reproduce');
assert.deepEqual(child.hard_kill_conditions, parent.hard_kill_conditions, 'Hard-kill conditions must survive lineage mutation');
assert.deepEqual(child.falsifiers, parent.falsifiers, 'Falsifiers must survive lineage mutation');

console.log('Portal 6.3 living sandbox probe: PASS · deterministic death, fossil retention, lineage safety and no silent resurrection verified');
