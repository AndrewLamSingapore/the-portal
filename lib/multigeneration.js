import { paretoFrontier } from './evolution.js';

const clamp = n => Math.max(0, Math.min(1, Number(n) || 0));
const keys = ['accuracy','evidence','novelty','utility','robustness','efficiency','calibration','constraint_compliance'];

function meanFitness(a, b) { const out = {}; for (const k of keys) out[k] = clamp(((a?.[k] || 0) + (b?.[k] || 0)) / 2); return out; }
function mutateFitness(f, niche, generation) {
  const out = { ...f }; const drift = ((generation * 17 + niche.length * 11) % 9 - 4) / 100;
  if (niche === 'EXPLORER') out.novelty = clamp(out.novelty + .1 + drift);
  if (niche === 'SCIENTIST') { out.evidence = clamp(out.evidence + .08 + drift); out.calibration = clamp(out.calibration + .06); }
  if (niche === 'SKEPTIC') { out.robustness = clamp(out.robustness + .1); out.calibration = clamp(out.calibration + .05); }
  return out;
}

export function reproducePopulation(population = [], generation = 2) {
  const living = population.filter(x => x.state !== 'DEAD');
  const frontier = paretoFrontier(living).slice(0, 6);
  if (!frontier.length) return [];
  const children = [];
  for (let i = 0; i < frontier.length; i += 1) {
    const a = frontier[i], b = frontier[(i + 1) % frontier.length];
    const niche = ['EXPLORER','SCIENTIST','SKEPTIC'][i % 3];
    const crossover = frontier.length > 1 && a.id !== b.id;
    children.push({
      id: `HYP-G${generation}-${String(i + 1).padStart(2,'0')}`, generation,
      statement: crossover ? `Crossover possibility combining ${a.id} with ${b.id}: ${a.statement} Alternative structure from ${b.statement}` : `Mutation of ${a.id}: ${a.statement}`,
      niche, epistemic_class: niche === 'EXPLORER' && a.epistemic_class === 'INFERRED' ? 'EXTRAPOLATED' : a.epistemic_class,
      state: 'EMERGING', confidence: clamp((a.confidence + b.confidence) / 2 * .92),
      ancestry: { parent_ids: crossover ? [a.id, b.id] : [a.id], operators: [crossover ? 'CROSSOVER' : 'MUTATION'] },
      evidence: [], assumptions: [...new Set([...(a.assumptions || []), ...(b.assumptions || [])])].slice(0,5),
      predictions: [...new Set([...(a.predictions || []), ...(b.predictions || [])])].slice(0,5),
      falsifiers: [...new Set([...(a.falsifiers || []), ...(b.falsifiers || [])])].slice(0,5), hard_kill_conditions: [],
      discriminating_test: a.discriminating_test || b.discriminating_test || 'Seek an intervention whose outcomes diverge between the parent explanations.',
      fitness: mutateFitness(meanFitness(a.fitness, b.fitness), niche, generation), history: []
    });
  }
  return children;
}

export function runGenerations(initial = [], maxGenerations = 4) {
  const generations = [{ generation: initial[0]?.generation || 1, population: initial, frontier: paretoFrontier(initial).map(x => x.id) }];
  let current = initial;
  for (let g = 2; g <= maxGenerations; g += 1) {
    current = reproducePopulation(current, g);
    if (!current.length) break;
    generations.push({ generation: g, population: current, frontier: paretoFrontier(current).map(x => x.id) });
  }
  return generations;
}
