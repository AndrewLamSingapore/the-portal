import { paretoFrontier } from './evolution.js';

const clamp = n => Math.max(0, Math.min(1, Number(n) || 0));

export const TOOL_REGISTRY = Object.freeze([
  { id: 'memory.search', kind: 'MEMORY', cost: .05, risk: 'GREEN', capability: 'retrieve prior observations and failed lineages' },
  { id: 'evidence.compare', kind: 'ANALYSIS', cost: .08, risk: 'GREEN', capability: 'compare support and contradiction across candidates' },
  { id: 'counterfactual.simulate', kind: 'SIMULATION', cost: .16, risk: 'GREEN', capability: 'test consequences under changed assumptions' },
  { id: 'critic.attack', kind: 'ADVERSARIAL', cost: .1, risk: 'GREEN', capability: 'search for falsifiers, confounders and alternative causes' }
]);

export class LayeredMemory {
  constructor(seed = []) { this.records = seed.map(record => ({ strength: .5, ...record })); }
  remember(record) { this.records.push({ strength: .5, created_at: new Date().toISOString(), ...record }); }
  retrieve(query = [], limit = 5) {
    const terms = new Set(query.map(x => String(x).toLowerCase()));
    return this.records.map(record => {
      const text = JSON.stringify(record).toLowerCase();
      const relevance = [...terms].reduce((n, term) => n + (text.includes(term) ? 1 : 0), 0);
      return { ...record, relevance };
    }).filter(x => x.relevance).sort((a,b) => b.relevance - a.relevance || b.strength - a.strength).slice(0, limit);
  }
  consolidate(ids = []) { this.records.forEach(r => { if (ids.includes(r.id)) r.strength = clamp(r.strength + .12); }); }
  decay(amount = .02) { this.records.forEach(r => { r.strength = clamp(r.strength - amount); }); }
}

export function chooseTools({ goal = '', uncertainty = .5, contradictions = 0, memoryHits = 0 } = {}) {
  const selected = [];
  if (memoryHits === 0) selected.push('memory.search');
  if (uncertainty >= .45) selected.push('evidence.compare');
  if (/what if|counterfactual|alternative|unknown|possib/i.test(goal)) selected.push('counterfactual.simulate');
  if (contradictions > 0 || uncertainty >= .6) selected.push('critic.attack');
  return selected.map(id => TOOL_REGISTRY.find(tool => tool.id === id));
}

const NICHES = Object.freeze({
  EXPLORER: { novelty: .18, evidence: -.04, utility: .04 },
  SCIENTIST: { evidence: .16, calibration: .12, robustness: .08 },
  SKEPTIC: { robustness: .16, calibration: .12, novelty: .03 },
  ENGINEER: { utility: .16, efficiency: .12, robustness: .08 },
  STRATEGIST: { utility: .1, novelty: .08, robustness: .08 }
});

export function applyNiche(candidate, niche) {
  const delta = NICHES[niche] || {};
  const fitness = { ...candidate.fitness };
  for (const [key, value] of Object.entries(delta)) fitness[key] = clamp((fitness[key] || 0) + value);
  return { ...candidate, niche, fitness };
}

export function evolveNiches(population = []) {
  const variants = [];
  for (const candidate of population) for (const niche of Object.keys(NICHES)) {
    variants.push(applyNiche({ ...candidate, id: `${candidate.id}-${niche}`, generation: (candidate.generation || 0) + 1, ancestry: { parent_ids: [candidate.id], operators: ['MUTATION'] } }, niche));
  }
  return { variants, frontier: paretoFrontier(variants) };
}

export function criticPopulation(population = []) {
  return population.map(candidate => ({
    id: `CRITIC-${candidate.id}`,
    target_id: candidate.id,
    objective: 'Destroy or materially weaken the target using a discriminating falsifier or alternative explanation.',
    attacks: [
      `Identify a confounder that explains ${candidate.id} with fewer assumptions.`,
      `Find an observation that should occur if ${candidate.id} is true but not under its strongest alternative.`,
      `Search the fossil memory for prior failures resembling ${candidate.id}.`
    ]
  }));
}

export function runExecutiveCycle({ goal, population, memory }) {
  const query = goal.toLowerCase().split(/\W+/).filter(x => x.length > 4);
  const recalled = memory.retrieve(query);
  const contradictions = population.reduce((n, h) => n + (h.evidence || []).filter(e => e.polarity === 'CONTRADICTS').length, 0);
  const uncertainty = 1 - Math.max(...population.map(h => h.confidence || 0), 0);
  const tools = chooseTools({ goal, uncertainty, contradictions, memoryHits: recalled.length });
  const niches = evolveNiches(population);
  const critics = criticPopulation(niches.frontier);
  memory.consolidate(recalled.map(x => x.id));
  memory.decay(.01);
  return {
    goal,
    metacognition: {
      uncertainty: clamp(uncertainty),
      question: contradictions ? 'Am I preserving a favored explanation despite contradictory evidence?' : 'What observation would most efficiently separate the strongest alternatives?',
      should_act: false,
      reason: 'Sandbox may simulate and recommend observations, but cannot mutate production or execute amber/red actions.'
    },
    recalled,
    selected_tools: tools,
    evolutionary_frontier: niches.frontier.map(x => ({ id: x.id, parent: x.ancestry.parent_ids[0], niche: x.niche, fitness: x.fitness })),
    critics
  };
}
