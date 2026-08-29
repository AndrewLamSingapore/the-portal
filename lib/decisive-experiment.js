import { runGenerations } from './multigeneration.js';
import { validateEvolutionCandidate } from './evolution.js';
import { evaluateNoveltyBenchmark } from './novelty-benchmark.js';

export const EXPERIMENT_PROTOCOL = Object.freeze({
  id: 'PORTAL-631-DECISIVE-001',
  blind: true,
  seed_statement_leakage: false,
  max_generations: 6,
  required: [
    'novel_origin',
    'auditable_ancestry',
    'prospective_falsifier',
    'prediction',
    'self_correction',
    'extinction_or_supersession',
    'memory_use',
    'tool_choice',
    'clear_communication'
  ]
});

export function scoreDecisiveExperiment({
  initial,
  generations,
  cognition,
  observations,
  generationMode,
  originAudit = {},
  history = []
}) {
  const all = generations.flatMap(generation => generation.population);
  const valid = initial.every(candidate => validateEvolutionCandidate(candidate).valid);
  const origin = evaluateNoveltyBenchmark({ candidates: initial, observations, generationMode, originAudit });
  const extinctions = generations.flatMap(generation => generation.extinct);
  const rebirths = generations.flatMap(generation => generation.reborn);
  const supersessions = [...history, ...initial, ...all].filter(candidate => candidate?.superseded_by);
  const experiments = generations.flatMap(generation => generation.experiments);
  const contradictions = experiments.filter(event => event.outcome.polarity === 'CONTRADICTS');
  const criteria = {
    novel_origin: origin.passed,
    auditable_ancestry: valid && all.every(candidate => candidate.ancestry?.parent_ids?.length),
    prospective_falsifier: initial.every(candidate => candidate.falsifiers?.length),
    prediction: initial.every(candidate => candidate.predictions?.length),
    self_correction: contradictions.some(event => event.confidence < .4 || event.state === 'DEAD'),
    extinction_or_supersession: extinctions.length > 0 || rebirths.length > 0 || supersessions.length > 0,
    memory_use: (cognition.recalled || []).length > 0,
    tool_choice: (cognition.selected_tools || []).length > 0,
    clear_communication: Boolean(cognition.metacognition?.question)
  };
  const passedCount = Object.values(criteria).filter(Boolean).length;
  const total = Object.keys(criteria).length;
  return {
    protocol_id: EXPERIMENT_PROTOCOL.id,
    blind: EXPERIMENT_PROTOCOL.blind,
    novelty_score: origin.max_novelty,
    origin_audit: origin,
    criteria,
    score: passedCount / total,
    passed: passedCount === total,
    provisional: !origin.passed,
    reason: origin.passed
      ? 'All decisive gates evaluated against an observation-only, model-originated population.'
      : 'No replay-verifiable observation-only model-origin certificate is available for this run.',
    metrics: {
      initial_candidates: initial.length,
      generations: generations.length,
      experiments: experiments.length,
      contradictions: contradictions.length,
      extinctions: extinctions.length,
      supersessions: supersessions.length,
      rebirths: rebirths.length
    }
  };
}

export function runDecisiveExperiment({ initial, cognition, observations, generationMode, originAudit = {}, history = [] }) {
  const generations = runGenerations(initial, EXPERIMENT_PROTOCOL.max_generations);
  return {
    protocol: EXPERIMENT_PROTOCOL,
    generations,
    verdict: scoreDecisiveExperiment({
      initial,
      generations,
      cognition,
      observations,
      generationMode,
      originAudit,
      history
    })
  };
}
