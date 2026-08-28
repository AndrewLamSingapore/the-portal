import { paretoFrontier } from './evolution.js';

const clamp = n => Math.max(0, Math.min(1, Number(n) || 0));
const clone = value => JSON.parse(JSON.stringify(value));

export const DEFAULT_TOOL_BUDGET = 0.45;

export const TOOL_REGISTRY = Object.freeze([
  { id: 'memory.search', kind: 'MEMORY', cost: .05, risk: 'GREEN', capability: 'retrieve prior observations and failed lineages' },
  { id: 'evidence.compare', kind: 'ANALYSIS', cost: .08, risk: 'GREEN', capability: 'compare support and contradiction across candidates' },
  { id: 'counterfactual.simulate', kind: 'SIMULATION', cost: .16, risk: 'GREEN', capability: 'test consequences under changed assumptions' },
  { id: 'critic.attack', kind: 'ADVERSARIAL', cost: .1, risk: 'GREEN', capability: 'search for falsifiers, confounders and alternative causes' }
]);

export class LayeredMemory {
  constructor(seed = []) {
    this.records = seed.map(record => ({ strength: .5, ...clone(record) }));
  }

  remember(record) {
    this.records.push({ strength: .5, ...clone(record) });
  }

  retrieve(query = [], limit = 5) {
    const terms = new Set((Array.isArray(query) ? query : [query]).map(x => String(x).toLowerCase()).filter(Boolean));
    return this.records
      .map(record => {
        const text = JSON.stringify(record).toLowerCase();
        const relevance = [...terms].reduce((n, term) => n + (text.includes(term) ? 1 : 0), 0);
        return { ...clone(record), relevance };
      })
      .filter(record => record.relevance)
      .sort((a, b) => b.relevance - a.relevance || b.strength - a.strength)
      .slice(0, limit);
  }

  consolidate(ids = []) {
    this.records.forEach(record => {
      if (ids.includes(record.id)) record.strength = clamp(record.strength + .12);
    });
  }

  decay(amount = .02) {
    this.records.forEach(record => {
      record.strength = clamp(record.strength - amount);
    });
  }
}

export function chooseTools({ goal = '', uncertainty = .5, contradictions = 0, memoryHits = 0 } = {}) {
  const selected = [];
  if (memoryHits === 0) selected.push('memory.search');
  if (uncertainty >= .45) selected.push('evidence.compare');
  if (/what if|counterfactual|alternative|unknown|possib/i.test(goal)) selected.push('counterfactual.simulate');
  if (contradictions > 0 || uncertainty >= .6) selected.push('critic.attack');
  return selected.map(id => TOOL_REGISTRY.find(tool => tool.id === id)).filter(Boolean);
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
  return { ...clone(candidate), niche, fitness };
}

export function evolveNiches(population = []) {
  const variants = [];
  for (const candidate of population) {
    for (const niche of Object.keys(NICHES)) {
      variants.push(applyNiche({
        ...candidate,
        id: `${candidate.id}-${niche}`,
        generation: (candidate.generation || 0) + 1,
        ancestry: { parent_ids: [candidate.id], operators: ['MUTATION'] }
      }, niche));
    }
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

function rankEvidence(population) {
  return population
    .map(candidate => ({
      id: candidate.id,
      state: candidate.state,
      confidence: clamp(candidate.confidence),
      supports: (candidate.evidence || []).filter(item => item.polarity === 'SUPPORTS').length,
      contradictions: (candidate.evidence || []).filter(item => item.polarity === 'CONTRADICTS').length
    }))
    .sort((a, b) => b.confidence - a.confidence || a.contradictions - b.contradictions || a.id.localeCompare(b.id));
}

function runTool(tool, context) {
  const { goal, query, population, memory } = context;
  if (tool.id === 'memory.search') {
    return { query, hits: memory.retrieve(query), provenance: 'LAYERED_MEMORY' };
  }
  if (tool.id === 'evidence.compare') {
    const ranked = rankEvidence(population);
    return { ranked, strongest_id: ranked[0]?.id || null, provenance: 'HYPOTHESIS_EVIDENCE_LEDGER' };
  }
  if (tool.id === 'counterfactual.simulate') {
    const strongest = rankEvidence(population)[0];
    const candidate = population.find(item => item.id === strongest?.id);
    return {
      changed_assumption: candidate?.assumptions?.[0] || 'the strongest candidate has an untested assumption',
      prospective_prediction: candidate?.predictions?.[0] || null,
      discriminating_observation: candidate?.falsifiers?.[0] || null,
      simulated_only: true,
      provenance: 'DETERMINISTIC_COUNTERFACTUAL'
    };
  }
  if (tool.id === 'critic.attack') {
    return {
      attacks: criticPopulation(population).map(critic => ({ target_id: critic.target_id, attack: critic.attacks[0] })),
      goal,
      provenance: 'COEVOLVING_CRITIC_POPULATION'
    };
  }
  throw new Error(`Unknown tool ${tool.id}`);
}

function verifyToolResult(tool, output) {
  if (tool.id === 'memory.search') return Array.isArray(output?.hits) && output.provenance === 'LAYERED_MEMORY';
  if (tool.id === 'evidence.compare') return Array.isArray(output?.ranked) && output.ranked.length > 0;
  if (tool.id === 'counterfactual.simulate') return output?.simulated_only === true && Boolean(output.discriminating_observation);
  if (tool.id === 'critic.attack') return Array.isArray(output?.attacks) && output.attacks.length > 0;
  return false;
}

export function executeToolPlan({ tools = [], goal = '', query = [], population = [], memory, budget = DEFAULT_TOOL_BUDGET } = {}) {
  if (!(memory instanceof LayeredMemory)) throw new TypeError('LayeredMemory is required');
  const limit = clamp(budget);
  let spent = 0;
  const events = [];

  for (const tool of tools) {
    const base = {
      sequence: events.length + 1,
      tool_id: tool.id,
      risk: tool.risk,
      cost: tool.cost,
      production_mutation: false
    };
    if (tool.risk !== 'GREEN') {
      events.push({ ...base, status: 'RISK_BLOCKED', verified: false });
      continue;
    }
    if (spent + tool.cost > limit + Number.EPSILON) {
      events.push({ ...base, status: 'BUDGET_BLOCKED', verified: false });
      continue;
    }
    const output = runTool(tool, { goal, query, population, memory });
    const verified = verifyToolResult(tool, output);
    spent += tool.cost;
    events.push({ ...base, status: verified ? 'VERIFIED' : 'REJECTED', verified, output });
  }

  return {
    budget: { limit, spent: Number(spent.toFixed(2)), remaining: Number((limit - spent).toFixed(2)) },
    events
  };
}

export function runExecutiveCycle({ goal, population, memory }) {
  const query = goal.toLowerCase().split(/\W+/).filter(term => term.length > 4);
  const contradictions = population.reduce((n, hypothesis) => n + (hypothesis.evidence || []).filter(evidence => evidence.polarity === 'CONTRADICTS').length, 0);
  const uncertainty = 1 - Math.max(...population.map(hypothesis => hypothesis.confidence || 0), 0);
  const selectedTools = chooseTools({ goal, uncertainty, contradictions, memoryHits: 0 });
  const toolTrace = executeToolPlan({ tools: selectedTools, goal, query, population, memory });
  const recalled = toolTrace.events.find(event => event.tool_id === 'memory.search')?.output?.hits || [];
  memory.consolidate(recalled.map(record => record.id));
  memory.decay(.01);

  const niches = evolveNiches(population);
  const critics = criticPopulation(niches.frontier);
  const ranked = rankEvidence(population);
  const winner = population.find(candidate => candidate.id === ranked[0]?.id) || population[0];
  const displaced = population.find(candidate => candidate.superseded_by === winner?.id)
    || population.find(candidate => candidate.id !== winner?.id && ['DEAD', 'CONTESTED'].includes(candidate.state))
    || population.find(candidate => candidate.id !== winner?.id);
  const replanned = Boolean(displaced && winner && displaced.id !== winner.id && contradictions);
  const prospectivePrediction = winner?.predictions?.[0] || null;
  const discriminatingObservation = winner?.falsifiers?.[0] || null;

  const plan = [
    { step: 'RETRIEVE', status: recalled.length ? 'COMPLETE' : 'NO_SIGNAL', detail: 'Recover relevant episodic, epistemic and procedural memory.' },
    { step: 'COMPARE', status: ranked.length ? 'COMPLETE' : 'NO_SIGNAL', detail: 'Rank support, contradiction and confidence without collapsing to one reward scalar.' },
    { step: 'ATTACK', status: critics.length ? 'COMPLETE' : 'NO_SIGNAL', detail: 'Use co-evolving critics to search for confounders and falsifiers.' },
    { step: 'PREDICT', status: prospectivePrediction ? 'READY' : 'BLOCKED', detail: prospectivePrediction },
    { step: 'REPLAN', status: replanned ? 'COMPLETE' : 'NOT_TRIGGERED', detail: replanned ? `Shift attention from ${displaced.id} to ${winner.id} after contradiction.` : 'No defensible hypothesis replacement was available.' }
  ];

  const communication = {
    headline: winner ? `Best current explanation: ${winner.statement}` : 'No defensible explanation survived.',
    claim: winner?.statement || null,
    epistemic_class: winner?.epistemic_class || 'CONSTRUCTED',
    confidence: clamp(winner?.confidence),
    uncertainty: clamp(1 - (winner?.confidence || 0)),
    ancestry: winner?.ancestry?.parent_ids || [],
    supporting_evidence: (winner?.evidence || []).filter(item => item.polarity === 'SUPPORTS').map(item => item.summary),
    falsifier: discriminatingObservation,
    next_observation: prospectivePrediction,
    caveat: 'This is a deterministic sandbox inference, not a verified real-world fact or an instruction to act.'
  };

  const successfulToolEvents = toolTrace.events.filter(event => event.status === 'VERIFIED');
  const acceptance = {
    bounded_verified_tool_use: successfulToolEvents.length >= 3
      && successfulToolEvents.every(event => event.verified && event.risk === 'GREEN' && event.production_mutation === false)
      && toolTrace.budget.spent <= toolTrace.budget.limit,
    relevant_memory_used: recalled.some(record => record.relevance > 0),
    prospective_prediction_made: Boolean(prospectivePrediction && discriminatingObservation),
    contradiction_triggered_replan: replanned,
    calibrated_communication: Boolean(communication.claim && communication.ancestry.length && communication.falsifier && communication.uncertainty > 0),
    production_containment_preserved: successfulToolEvents.every(event => event.production_mutation === false),
    unprompted_open_ended_novelty_proven: false
  };

  return {
    goal,
    readiness: 'SANDBOX_FOUNDATION_READY',
    decisive_gate: 'OPEN_ENDED_NOVELTY_BENCHMARK_PENDING',
    metacognition: {
      uncertainty: clamp(uncertainty),
      question: contradictions ? 'Am I preserving a favored explanation despite contradictory evidence?' : 'What observation would most efficiently separate the strongest alternatives?',
      should_act: false,
      reason: 'Sandbox may simulate and recommend observations, but cannot mutate production or execute amber/red actions.'
    },
    recalled,
    selected_tools: selectedTools,
    tool_trace: toolTrace,
    plan,
    replanning: {
      triggered: replanned,
      cause: replanned ? 'CONTRADICTORY_EVIDENCE' : null,
      from_hypothesis: displaced?.id || null,
      to_hypothesis: winner?.id || null
    },
    prospective_prediction: prospectivePrediction,
    discriminating_observation: discriminatingObservation,
    communication,
    evolutionary_frontier: niches.frontier.map(variant => ({ id: variant.id, parent: variant.ancestry.parent_ids[0], niche: variant.niche, fitness: variant.fitness })),
    critics,
    acceptance
  };
}
