import { evidenceSelectionRound, spawnSurpriseBranches } from './evidence-selection.js';
import { paretoFrontier } from './evolution.js';
import { FossilMemory, applyFossilPenalty } from './fossil-memory.js';

const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const fitnessKeys = ['accuracy', 'evidence', 'novelty', 'utility', 'robustness', 'efficiency', 'calibration', 'constraint_compliance'];

function meanFitness(left, right) {
  const fitness = {};
  for (const key of fitnessKeys) fitness[key] = clamp(((left?.[key] || 0) + (right?.[key] || 0)) / 2);
  return fitness;
}

function mutateFitness(fitness, niche, generation) {
  const next = { ...fitness };
  const delta = ((generation * 17 + niche.length * 11) % 9 - 4) / 100;
  if (niche === 'EXPLORER') next.novelty = clamp(next.novelty + .1 + delta);
  if (niche === 'SCIENTIST') {
    next.evidence = clamp(next.evidence + .08 + delta);
    next.calibration = clamp(next.calibration + .06);
  }
  if (niche === 'SKEPTIC') {
    next.robustness = clamp(next.robustness + .1);
    next.calibration = clamp(next.calibration + .05);
  }
  return next;
}

export function reproducePopulation(population = [], generation = 2) {
  const frontier = paretoFrontier(population.filter(candidate => candidate.state !== 'DEAD')).slice(0, 6);
  if (!frontier.length) return [];

  return frontier.map((left, index) => {
    const right = frontier[(index + 1) % frontier.length];
    const niche = ['EXPLORER', 'SCIENTIST', 'SKEPTIC'][index % 3];
    const crossover = frontier.length > 1 && left.id !== right.id;
    return {
      id: `HYP-G${generation}-${String(index + 1).padStart(2, '0')}`,
      generation,
      statement: crossover
        ? `Crossover possibility combining ${left.id} with ${right.id}: ${left.statement} Alternative structure from ${right.statement}`
        : `Mutation of ${left.id}: ${left.statement}`,
      niche,
      epistemic_class: niche === 'EXPLORER' && left.epistemic_class === 'INFERRED' ? 'EXTRAPOLATED' : left.epistemic_class,
      state: 'EMERGING',
      confidence: clamp((left.confidence + right.confidence) / 2 * .92),
      ancestry: {
        parent_ids: crossover ? [left.id, right.id] : [left.id],
        operators: [crossover ? 'CROSSOVER' : 'MUTATION']
      },
      evidence: [],
      assumptions: [...new Set([...(left.assumptions || []), ...(right.assumptions || [])])].slice(0, 5),
      predictions: [...new Set([...(left.predictions || []), ...(right.predictions || [])])].slice(0, 5),
      falsifiers: [...new Set([...(left.falsifiers || []), ...(right.falsifiers || [])])].slice(0, 5),
      hard_kill_conditions: [...new Set([...(left.hard_kill_conditions || []), ...(right.hard_kill_conditions || [])])].slice(0, 4),
      discriminating_test: left.discriminating_test || right.discriminating_test || 'Seek an intervention whose outcomes diverge between parent explanations.',
      fitness: mutateFitness(meanFitness(left.fitness, right.fitness), niche, generation),
      history: []
    };
  });
}

export function runGenerations(initial = [], maxGenerations = 4) {
  const generations = [];
  const fossils = new FossilMemory();
  let current = initial;

  for (let generation = 1; generation <= maxGenerations; generation += 1) {
    if (!current.length) break;
    current = applyFossilPenalty(current, fossils);
    const selection = evidenceSelectionRound(current, generation);
    const dead = selection.evaluated.filter(item => item.candidate.state === 'DEAD');
    for (const item of dead) fossils.bury(item.candidate, item.outcome.observation, generation);

    const surprises = spawnSurpriseBranches(selection.surprises, generation);
    const selected = [...selection.survivors, ...surprises];
    let reborn = [];
    if (generation === maxGenerations && fossils.fossils.length) {
      const fossil = fossils.fossils[0];
      const candidate = fossils.rebirth(
        fossil,
        [{ id: `REBIRTH-EVIDENCE-G${generation}`, polarity: 'NEUTRAL', basis: 'SIMULATION', summary: 'A changed control condition creates a genuinely new test context.' }],
        ['Previously unmeasured confounder is now explicitly controlled.'],
        generation
      );
      if (candidate) reborn = [candidate];
    }

    const population = [...selected, ...reborn];
    generations.push({
      generation,
      population,
      frontier: paretoFrontier(population).map(candidate => candidate.id),
      experiments: selection.evaluated.map(item => ({
        experiment: item.experiment,
        outcome: item.outcome,
        candidate_id: item.candidate.id,
        state: item.candidate.state,
        confidence: item.candidate.confidence,
        fossil_risk: item.candidate.fossil_risk || 0,
        fossil_matches: item.candidate.fossil_matches || []
      })),
      extinct: dead.map(item => item.candidate.id),
      surprises: surprises.map(candidate => candidate.id),
      reborn: reborn.map(candidate => candidate.id),
      fossil_count: fossils.fossils.length
    });
    if (generation < maxGenerations) current = reproducePopulation(selected, generation + 1);
  }

  return generations;
}
