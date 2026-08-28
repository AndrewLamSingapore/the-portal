import { paretoFrontier } from './evolution.js';

const clamp = n => Math.max(0, Math.min(1, Number(n) || 0));

export function proposeExperiment(candidate, alternatives = []) {
  const rival = alternatives.find(x => x.id !== candidate.id);
  return {
    id: `EXP-${candidate.id}`,
    target_id: candidate.id,
    rival_id: rival?.id || null,
    question: candidate.discriminating_test || `What observation would separate ${candidate.id} from its strongest alternative?`,
    predicted_support: candidate.predictions?.[0] || 'The target-specific predicted observation occurs.',
    predicted_failure: candidate.falsifiers?.[0] || 'The target-specific falsifying observation occurs.',
    execution: 'SANDBOX_SIMULATION', risk: 'GREEN'
  };
}

export function deterministicExperimentOutcome(experiment, candidate, generation) {
  const signature = [...candidate.id].reduce((n,c) => n + c.charCodeAt(0), generation * 31);
  const bucket = signature % 7;
  if (bucket <= 1) return { polarity:'CONTRADICTS', magnitude:.22, observation:experiment.predicted_failure, surprise:bucket === 0 };
  if (bucket <= 4) return { polarity:'SUPPORTS', magnitude:.14, observation:experiment.predicted_support, surprise:false };
  return { polarity:'NEUTRAL', magnitude:.04, observation:'The experiment is non-discriminating at current resolution.', surprise:bucket === 6 };
}

export function applyExperimentalSelection(candidate, outcome, generation) {
  const direction = outcome.polarity === 'SUPPORTS' ? 1 : outcome.polarity === 'CONTRADICTS' ? -1 : 0;
  const confidence = clamp(candidate.confidence + direction * outcome.magnitude);
  const fitness = { ...candidate.fitness };
  fitness.evidence = clamp(fitness.evidence + direction * outcome.magnitude);
  fitness.accuracy = clamp(fitness.accuracy + direction * outcome.magnitude * .7);
  fitness.calibration = clamp(fitness.calibration + (outcome.polarity === 'NEUTRAL' ? .02 : .04));
  fitness.robustness = clamp(fitness.robustness + (outcome.polarity === 'SUPPORTS' ? .04 : outcome.polarity === 'CONTRADICTS' ? -.06 : 0));
  const state = confidence <= .12 ? 'DEAD' : outcome.polarity === 'CONTRADICTS' && confidence < .4 ? 'CONTESTED' : confidence >= .55 ? 'LIVING' : candidate.state;
  return { ...candidate, confidence, fitness, state, evidence:[...(candidate.evidence||[]), { id:`E-G${generation}-${candidate.id}`, polarity:outcome.polarity, basis:'SIMULATION', summary:outcome.observation }], history:[...(candidate.history||[]), { at:`GENERATION_${generation}_EXPERIMENT`, event:outcome.polarity, confidence, state }] };
}

export function evidenceSelectionRound(population = [], generation = 1) {
  const experiments = population.map(h => proposeExperiment(h, population));
  const evaluated = population.map((h,i) => { const outcome = deterministicExperimentOutcome(experiments[i], h, generation); return { candidate:applyExperimentalSelection(h,outcome,generation), experiment:experiments[i], outcome }; });
  const survivors = evaluated.map(x=>x.candidate).filter(x=>x.state!=='DEAD');
  const frontier = paretoFrontier(survivors);
  const surprises = evaluated.filter(x=>x.outcome.surprise).map(x=>({ parent_id:x.candidate.id, observation:x.outcome.observation, polarity:x.outcome.polarity }));
  return { evaluated, survivors, frontier, surprises };
}

export function spawnSurpriseBranches(surprises = [], generation = 1) {
  return surprises.map((s,i)=>({ id:`HYP-G${generation}-SURPRISE-${i+1}`, generation, statement:`Unexpected experimental result suggests a new explanatory branch: ${s.observation}`, niche:'EXPLORER', epistemic_class:'SPECULATIVE', state:'EMERGING', confidence:.2, ancestry:{ parent_ids:[s.parent_id], operators:['ADVERSARIAL'] }, evidence:[{ id:`SURPRISE-${generation}-${i+1}`, polarity:'NEUTRAL', basis:'SIMULATION', summary:s.observation }], assumptions:['The unexpected result is reproducible rather than noise.'], predictions:['A repeat experiment should reproduce the anomalous observation under similar conditions.'], falsifiers:['The anomaly disappears under controlled repetition.'], hard_kill_conditions:[], discriminating_test:'Repeat the anomaly under controlled conditions and vary one suspected latent factor.', fitness:{ accuracy:.25,evidence:.2,novelty:.9,utility:.5,robustness:.25,efficiency:.55,calibration:.55,constraint_compliance:1 }, history:[] }));
}
