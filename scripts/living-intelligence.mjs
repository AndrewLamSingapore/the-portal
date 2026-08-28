import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runLivingSandbox, SANDBOX_SEED } from '../lib/living-sandbox.js';
import { runGenerations } from '../lib/multigeneration.js';
import {
  DEFAULT_TOOL_BUDGET,
  LayeredMemory,
  TOOL_REGISTRY,
  executeToolPlan,
  runExecutiveCycle
} from '../lib/living-intelligence.js';

const sandbox = runLivingSandbox(SANDBOX_SEED);
const memorySeed = [
  ...sandbox.observations.map(item => ({ id: item.id, layer: 'EPISODIC', content: item })),
  { id: 'MEM-FOSSIL-001', layer: 'EPISTEMIC', content: 'Competing causal explanations failed when hydraulic restrictions were unmeasured.', strength: .72 },
  { id: 'MEM-PROCEDURE-001', layer: 'PROCEDURAL', content: 'When causal alternatives compete, seek an intervention that changes one cause without changing the other.', strength: .8 }
];
const goal = 'Find the strongest possibility, challenge the alternative, and identify what observation would separate competing explanations.';
const cycle = runExecutiveCycle({ goal, population: sandbox.population, memory: new LayeredMemory(memorySeed) });
const repeated = runExecutiveCycle({ goal, population: sandbox.population, memory: new LayeredMemory(memorySeed) });

assert.deepEqual(cycle, repeated, 'fixed inputs must produce a deterministic cognition cycle');
assert.equal(cycle.readiness, 'SANDBOX_FOUNDATION_READY');
assert.equal(cycle.decisive_gate, 'OPEN_ENDED_NOVELTY_BENCHMARK_PENDING');
assert.ok(cycle.recalled.some(record => record.id === 'MEM-PROCEDURE-001'));
assert.ok(cycle.tool_trace.events.length >= 3);
assert.ok(cycle.tool_trace.events.every(event => event.status === 'VERIFIED'));
assert.ok(cycle.tool_trace.events.every(event => event.risk === 'GREEN' && event.production_mutation === false));
assert.ok(cycle.tool_trace.budget.spent <= DEFAULT_TOOL_BUDGET);
assert.equal(cycle.replanning.triggered, true);
assert.equal(cycle.replanning.cause, 'CONTRADICTORY_EVIDENCE');
assert.notEqual(cycle.replanning.from_hypothesis, cycle.replanning.to_hypothesis);
assert.ok(cycle.prospective_prediction);
assert.ok(cycle.discriminating_observation);
assert.ok(cycle.communication.claim);
assert.ok(cycle.communication.ancestry.length > 0);
assert.ok(cycle.communication.falsifier);
assert.equal(cycle.metacognition.should_act, false);
assert.equal(cycle.acceptance.unprompted_open_ended_novelty_proven, false, 'the decisive novelty gate must not be overstated');
assert.ok(Object.entries(cycle.acceptance).filter(([key]) => key !== 'unprompted_open_ended_novelty_proven').every(([, value]) => value === true));

const overBudget = executeToolPlan({
  tools: TOOL_REGISTRY,
  goal,
  query: ['competing', 'alternatives'],
  population: sandbox.population,
  memory: new LayeredMemory(memorySeed),
  budget: .1
});
assert.ok(overBudget.events.some(event => event.status === 'BUDGET_BLOCKED'));
assert.ok(overBudget.budget.spent <= .1);

const initial = sandbox.population.map((candidate, index) => ({
  ...candidate,
  id: `HYP-G1-${String(index + 1).padStart(2, '0')}`,
  generation: 1,
  niche: index ? 'SKEPTIC' : 'SCIENTIST',
  discriminating_test: candidate.falsifiers[0]
}));
const generations = runGenerations(initial, 4);
assert.equal(generations.length, 4);
assert.ok(generations.every(generation => generation.experiments.length > 0));
assert.ok(generations.flatMap(generation => generation.experiments).every(event => event.experiment.risk === 'GREEN' && event.experiment.execution === 'SANDBOX_SIMULATION'));
assert.ok(generations.flatMap(generation => generation.population).every(candidate => candidate.ancestry?.parent_ids?.length && candidate.falsifiers?.length));

const observatory = fs.readFileSync('living.html', 'utf8');
const deployment = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const livingApi = fs.readFileSync('api/living.js', 'utf8');
assert.match(observatory, /<script src="\/living\.js" defer><\/script>/);
assert.doesNotMatch(observatory, /<script>(?:.|\n)*?<\/script>/, 'CSP blocks inline scripts');
assert.equal(deployment.functions?.['api/living.js']?.maxDuration, 60);
assert.ok(livingApi.includes("PORTAL_LIVING_MODEL_ENABLED==='1'"), 'model origination must be explicit opt-in');

console.log('Portal 6.3 living intelligence, memory, tool, replan, communication, CSP and multigeneration gates: PASS');
