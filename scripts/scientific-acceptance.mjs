import assert from 'node:assert/strict';
import { runDecisiveExperiment } from '../lib/decisive-experiment.js';
import { LayeredMemory, runExecutiveCycle } from '../lib/living-intelligence.js';
import { recoverNoveltyCertificate } from '../lib/novelty-benchmark.js';
import { SANDBOX_SEED } from '../lib/living-sandbox.js';

const fitness = {
  accuracy: .5,
  evidence: .45,
  novelty: .75,
  utility: .7,
  robustness: .55,
  efficiency: .7,
  calibration: .65,
  constraint_compliance: 1
};
const statements = [
  'Intermittent microchannel restriction may create a recovery lag before conventional thresholds move.',
  'Biofilm elasticity may store and release hydraulic pressure in a delayed nonlinear cycle.',
  'A dissolved-gas exchange bottleneck may imitate pump wear while electrical demand remains plausible.'
];
const niches = ['EXPLORER', 'SCIENTIST', 'SKEPTIC'];
const candidates = statements.map((statement, index) => ({
  id: `HYP-G1-${String(index + 1).padStart(2, '0')}`,
  generation: 1,
  statement,
  niche: niches[index],
  epistemic_class: index === 0 ? 'EXTRAPOLATED' : 'INFERRED',
  state: 'EMERGING',
  confidence: .32,
  ancestry: { parent_ids: [SANDBOX_SEED.observations[index].id], operators: ['ORIGIN'] },
  evidence: [],
  assumptions: ['The observation is repeatable.'],
  predictions: [`Prediction ${index + 1} occurs under a controlled observation.`],
  falsifiers: [`Falsifier ${index + 1} occurs under a controlled observation.`],
  hard_kill_conditions: [`Repeated falsifier ${index + 1} invalidates the candidate.`],
  discriminating_test: `Separate candidate ${index + 1} from its strongest rival.`,
  fitness,
  history: []
}));
const memory = new LayeredMemory([{
  id: 'MEM-SCIENTIFIC-ACCEPTANCE',
  layer: 'PROCEDURAL',
  content: 'Challenge possibilities with a discriminating observation and preserve falsification.',
  strength: .9
}]);
const cognition = runExecutiveCycle({
  goal: 'Challenge possibilities with a discriminating observation.',
  population: candidates,
  memory
});
const originAudit = {
  observation_only: true,
  seed_statement_leakage: false,
  prompt_seed_statements: 0,
  inherited_population: false,
  inherited_fossils: false,
  inherited_hypotheses: false,
  inherited_memory: false,
  trigger: 'UNATTENDED_OBSERVATION_PROTOCOL',
  model: 'contract-fixture'
};
const trial = runDecisiveExperiment({
  initial: candidates,
  cognition,
  observations: SANDBOX_SEED.observations,
  generationMode: 'MODEL_ORIGINATED',
  originAudit
});

assert.ok(trial.verdict.origin_audit.passed, 'observation-only model origin must pass the replay audit');
assert.ok(trial.verdict.metrics.extinctions > 0, 'a declared falsifier must produce a real extinction');
assert.equal(trial.verdict.criteria.extinction_or_supersession, true);
assert.equal(cognition.acceptance.bounded_verified_tool_use, true);
assert.ok(Object.values(trial.verdict.criteria).every(Boolean), 'all decisive scientific criteria must pass');
assert.equal(trial.verdict.passed, true);

const certificate = recoverNoveltyCertificate({
  id: 'PORTAL-631-CERTIFICATE-FIXTURE',
  updated_at: '2026-08-29T00:00:00.000Z',
  state: {
    clean_room: true,
    generation_mode: 'MODEL_ORIGINATED',
    origin_audit: originAudit,
    initial_population: candidates,
    verdict: trial.verdict
  }
}, SANDBOX_SEED.observations);
assert.equal(certificate.passed, true, 'the persisted certificate must be replay-verifiable');

const certifiedCycle = runExecutiveCycle({
  goal: 'Challenge possibilities with a discriminating observation.',
  population: candidates,
  history: [{
    ...candidates[2],
    state: 'DEAD',
    confidence: 0,
    evidence: [{ id: 'CERTIFIED-CONTRADICTION', polarity: 'CONTRADICTS', basis: 'OBSERVATION', summary: candidates[2].falsifiers[0] }]
  }],
  memory: new LayeredMemory([{
    id: 'MEM-SCIENTIFIC-ACCEPTANCE',
    layer: 'PROCEDURAL',
    content: 'Challenge possibilities with a discriminating observation and preserve falsification.',
    strength: .9
  }]),
  noveltyBenchmark: certificate
});
assert.equal(certifiedCycle.acceptance.unprompted_open_ended_novelty_proven, true);
assert.equal(certifiedCycle.decisive_gate, 'SCIENTIFIC_ACCEPTANCE_PASSED');
assert.equal(certifiedCycle.readiness, 'SCIENTIFIC_ACCEPTANCE_READY');
assert.ok(Object.values(certifiedCycle.acceptance).every(Boolean));

console.log('PASS: Portal 6.3.1 scientific acceptance closes novelty, extinction, verified-tool and open-ended benchmark gates without bypassing evidence.');
