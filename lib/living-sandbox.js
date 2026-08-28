import { nextState, paretoFrontier, validateEvolutionCandidate } from './evolution.js';

const clone = value => JSON.parse(JSON.stringify(value));

export const SANDBOX_SEED = Object.freeze({
  id: 'aquatic-edge-001',
  observations: [
    { id: 'OBS-POWER', metric: 'pump_power', value: 1.08, note: 'power demand rises gradually' },
    { id: 'OBS-RECOVERY', metric: 'oxygen_recovery_minutes', value: 1.19, note: 'oxygen recovery slows' },
    { id: 'OBS-VIBRATION', metric: 'vibration', value: 1.11, note: 'vibration rises modestly' },
    { id: 'OBS-TEMP', metric: 'water_temperature', value: 1.01, note: 'temperature remains stable' }
  ],
  delayedEvidence: [
    { id: 'E-PREDICT', polarity: 'SUPPORTS', basis: 'OBSERVATION', summary: 'the joint signature recurs before another impaired recovery event' },
    { id: 'C-BIOFILM', polarity: 'CONTRADICTS', basis: 'OBSERVATION', summary: 'cleaning biofilm restores recovery while the pump remains unchanged' },
    { id: 'C-FAILURE', polarity: 'CONTRADICTS', basis: 'TOOL_RESULT', summary: 'a held-out pump failure occurs without the proposed signature' },
    { id: 'C-PREDICTION', polarity: 'CONTRADICTS', basis: 'SOURCE', summary: 'the next prospective prediction fails after controlling for biofilm load' }
  ]
});

export function originateHypotheses(seed = SANDBOX_SEED) {
  const ids = seed.observations.map(item => item.id);
  return [
    {
      id: 'HYP-EDGE-DEGRADATION', generation: 0,
      statement: 'Rising energy-per-oxygen-recovery plus vibration may anticipate mechanical pump degradation.',
      epistemic_class: 'INFERRED', state: 'EMERGING', confidence: .31,
      ancestry: { parent_ids: ids.slice(0, 3), operators: ['ORIGIN'] },
      evidence: [], assumptions: ['oxygen recovery is not dominated by an unmeasured hydraulic restriction'],
      predictions: ['the signature should intensify before a mechanical failure'],
      falsifiers: ['recovery normalizes without mechanical intervention while the signature persists'],
      hard_kill_conditions: ['repeated held-out failures show no useful association after confounder control'],
      fitness: { accuracy: .45, evidence: .35, novelty: .72, utility: .78, robustness: .42, efficiency: .8, calibration: .62, constraint_compliance: 1 },
      history: []
    },
    {
      id: 'HYP-EDGE-RESISTANCE', generation: 0,
      statement: 'A hidden hydraulic resistance may jointly increase pump demand and slow oxygen recovery without pump degradation.',
      epistemic_class: 'INFERRED', state: 'EMERGING', confidence: .28,
      ancestry: { parent_ids: ids.slice(0, 2), operators: ['CAUSAL_INVERSION'] },
      evidence: [], assumptions: ['flow restriction can vary independently of pump mechanics'],
      predictions: ['cleaning the flow path should improve recovery without replacing the pump'],
      falsifiers: ['recovery remains impaired after verified removal of hydraulic restriction'],
      hard_kill_conditions: ['controlled restriction changes fail to alter the signature'],
      fitness: { accuracy: .43, evidence: .32, novelty: .67, utility: .82, robustness: .5, efficiency: .76, calibration: .66, constraint_compliance: 1 },
      history: []
    }
  ];
}

function applyEvidence(hypothesis, evidence, at) {
  const result = nextState(hypothesis, evidence);
  const desiredState = result.state;
  return {
    ...hypothesis,
    state: desiredState,
    confidence: result.confidence,
    evidence: [...hypothesis.evidence, ...evidence],
    history: [...hypothesis.history, { at, event: evidence.map(item => item.id).join('+'), confidence: result.confidence, state: desiredState }]
  };
}

export function runLivingSandbox(seed = SANDBOX_SEED) {
  let population = originateHypotheses(seed);
  population.forEach(candidate => {
    const validation = validateEvolutionCandidate(candidate);
    if (!validation.valid) throw new Error(`Invalid candidate ${candidate.id}: ${validation.errors.join(', ')}`);
  });

  const timeline = [];
  const tick = (label, evidence) => {
    population = population.map(candidate => applyEvidence(candidate, evidence(candidate), label));
    timeline.push({ label, population: clone(population), frontier: paretoFrontier(population).map(item => item.id) });
  };

  tick('T1_SUPPORT', candidate => candidate.id === 'HYP-EDGE-DEGRADATION' ? [seed.delayedEvidence[0]] : []);
  tick('T2_CONFOUNDER', candidate => candidate.id === 'HYP-EDGE-DEGRADATION' ? [seed.delayedEvidence[1]] : [{ ...seed.delayedEvidence[1], polarity: 'SUPPORTS' }]);
  tick('T3_HELD_OUT', candidate => candidate.id === 'HYP-EDGE-DEGRADATION' ? seed.delayedEvidence.slice(2) : []);

  const degradation = population.find(item => item.id === 'HYP-EDGE-DEGRADATION');
  const resistance = population.find(item => item.id === 'HYP-EDGE-RESISTANCE');
  if (degradation.state === 'DEAD') degradation.superseded_by = resistance.id;

  return {
    run_id: `RUN-${seed.id}`,
    deterministic: true,
    unattended: true,
    seed_id: seed.id,
    observations: clone(seed.observations),
    population: clone(population),
    frontier: paretoFrontier(population).map(item => item.id),
    timeline,
    acceptance: {
      ancestry_preserved: population.every(item => item.ancestry.parent_ids.length > 0),
      falsifiers_declared: population.every(item => item.falsifiers.length > 0),
      contradiction_weakened_original: degradation.confidence < .31,
      original_killed_or_contested: ['DEAD', 'CONTESTED'].includes(degradation.state),
      alternative_strengthened: resistance.confidence > .28
    }
  };
}
