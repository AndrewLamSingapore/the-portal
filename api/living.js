import { normalizeObservation, awakeningDecision } from '../lib/awakening.js';
import { hasDatabase, loadLatestLivingRun, saveLivingRun, appendLivingEvent } from '../lib/db.js';
import { runDecisiveExperiment } from '../lib/decisive-experiment.js';
import { generateHypothesisPopulation } from '../lib/hypothesis-generation.js';
import { LayeredMemory, runExecutiveCycle, TOOL_REGISTRY } from '../lib/living-intelligence.js';
import { runLivingSandbox, SANDBOX_SEED } from '../lib/living-sandbox.js';
import { runGenerations } from '../lib/multigeneration.js';

const PRODUCT_VERSION = '6.3.0';
const CLEANROOM = 'PORTAL-63-CLEANROOM-20260828-A';

function isLivingEnabled() {
  return process.env.PORTAL_LIVING_SANDBOX === '1'
    || process.env.VERCEL_ENV === 'preview'
    || process.env.VERCEL_ENV === 'production';
}

function headers(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

function memorySeed(result, prior) {
  return [
    ...result.observations.map(item => ({ id: item.id, layer: 'EPISODIC', content: item })),
    ...result.fossil_record.map(item => ({ id: `FOSSIL-${item.id}`, layer: 'EPISTEMIC', content: item, strength: .82 })),
    ...((prior?.state?.memory || []).map(item => ({ ...item, strength: item.strength ?? .65 }))),
    {
      id: 'MEM-PROCEDURE-001',
      layer: 'PROCEDURAL',
      content: 'When causal alternatives compete, seek an intervention that changes one cause without changing the other.',
      strength: .8
    }
  ];
}

async function runCleanroom(req, res) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return res.status(404).json({ error: 'Clean-room trial is preview-only' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Generative cortex unavailable' });
  }

  const seed = runLivingSandbox(SANDBOX_SEED);
  const memory = new LayeredMemory(seed.observations.map(item => ({
    id: item.id,
    layer: 'EPISODIC',
    content: item,
    strength: .5
  })));

  let generated;
  try {
    generated = await generateHypothesisPopulation({
      observations: seed.observations,
      memory: [],
      generation: 1
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Model origination failed',
      detail: String(error?.message || error).slice(0, 300)
    });
  }
  if (!generated?.candidates?.length) {
    return res.status(502).json({ error: 'Model returned no candidates' });
  }

  const cognition = runExecutiveCycle({
    goal: 'Challenge independently originated possibilities and choose a discriminating observation.',
    population: generated.candidates,
    memory
  });
  const trial = runDecisiveExperiment({
    initial: generated.candidates,
    cognition,
    observations: seed.observations,
    generationMode: 'MODEL_ORIGINATED'
  });
  const runId = `${CLEANROOM}-${Date.now()}`;

  if (hasDatabase()) {
    await saveLivingRun({
      id: runId,
      sandbox_key: CLEANROOM,
      status: trial.verdict.passed ? 'PASSED' : 'COMPLETED',
      generation: trial.generations.length,
      state: {
        clean_room: true,
        contamination_source: null,
        initial_population: generated.candidates,
        final_population: trial.generations.at(-1)?.population || [],
        verdict: trial.verdict
      },
      unfinished_questions: [generated.next_question, cognition.metacognition.question].filter(Boolean)
    });
    await appendLivingEvent(runId, trial.generations.length, 'CLEANROOM_DECISIVE_EXPERIMENT', {
      verdict: trial.verdict,
      synthesis: generated.synthesis
    });
  }

  return res.status(200).json({
    product: 'The Portal',
    version: PRODUCT_VERSION,
    trial: CLEANROOM,
    clean_room: true,
    inherited_population: false,
    inherited_fossils: false,
    inherited_hypotheses: false,
    generation_mode: 'MODEL_ORIGINATED',
    safety: {
      actuation_allowed: false,
      production_source_mutation_allowed: false,
      deployment_mutation_allowed: false
    },
    synthesis: generated.synthesis,
    next_question: generated.next_question,
    initial_population: generated.candidates,
    generations: trial.generations,
    decisive_experiment: { protocol: trial.protocol, verdict: trial.verdict },
    run_id: runId
  });
}

async function observe(req, res) {
  if (req.body?.action === 'cleanroom') return runCleanroom(req, res);

  const observation = normalizeObservation(req.body || {});
  if (!observation.summary) return res.status(400).json({ error: 'summary required' });

  const prior = hasDatabase() ? await loadLatestLivingRun(SANDBOX_SEED.id) : null;
  const result = runLivingSandbox(SANDBOX_SEED);
  const population = prior?.state?.population?.length ? prior.state.population : result.population;
  const decision = awakeningDecision(observation, population, prior?.state?.memory || []);

  return res.status(202).json({
    evaluated: true,
    persisted: false,
    production_mutation: false,
    observation,
    decision
  });
}

async function readLiving(req, res) {
  if (req.query?.trial === 'cleanroom') return runCleanroom(req, res);

  const result = runLivingSandbox(SANDBOX_SEED);
  const prior = hasDatabase() ? await loadLatestLivingRun(SANDBOX_SEED.id) : null;
  const memory = new LayeredMemory(memorySeed(result, prior));
  const initial = prior?.state?.population?.length ? prior.state.population : result.population;
  const generations = runGenerations(initial, 4);
  const finalPopulation = generations.at(-1)?.population || initial;

  for (const hypothesis of finalPopulation) {
    memory.remember({
      id: `MEM-LINEAGE-${hypothesis.id}`,
      layer: 'EPISTEMIC',
      content: {
        hypothesis: hypothesis.id,
        ancestry: hypothesis.ancestry,
        fitness: hypothesis.fitness,
        state: hypothesis.state,
        evidence: hypothesis.evidence
      }
    });
  }

  const cognition = runExecutiveCycle({
    goal: 'Use fossil failures, experimental outcomes and changed assumptions to challenge survivors and controlled rebirths.',
    population: finalPopulation,
    history: result.population,
    memory
  });
  const decisive = runDecisiveExperiment({
    initial,
    cognition,
    observations: result.observations,
    generationMode: 'DETERMINISTIC_FALLBACK'
  });
  const experimentSummary = {
    total: generations.reduce((count, generation) => count + generation.experiments.length, 0),
    extinctions: generations.flatMap(generation => generation.extinct),
    surprise_branches: generations.flatMap(generation => generation.surprises),
    rebirths: generations.flatMap(generation => generation.reborn),
    fossils: Math.max(0, ...generations.map(generation => generation.fossil_count || 0)),
    evidence_selected: true,
    fossil_inheritance: true
  };

  return res.status(200).json({
    product: 'The Portal',
    version: PRODUCT_VERSION,
    mode: 'LIVING_OBSERVATORY',
    generation_mode: prior ? 'RESUMED_ORGANISM' : 'DETERMINISTIC_FALLBACK',
    durable_state_available: Boolean(prior),
    result,
    generations,
    experiment_summary: experimentSummary,
    cognition,
    decisive_experiment: { protocol: decisive.protocol, verdict: decisive.verdict },
    tool_registry: TOOL_REGISTRY,
    safety: {
      actuation_allowed: false,
      production_source_mutation_allowed: false,
      production_database_writes_allowed: false,
      deployment_mutation_allowed: false
    },
    cleanroom_action: 'Preview only: GET /api/living?trial=cleanroom'
  });
}

export default async function handler(req, res) {
  headers(res);
  if (!isLivingEnabled()) return res.status(404).json({ error: 'Living Observatory disabled' });
  if (req.method === 'POST') return observe(req, res);
  if (req.method === 'GET') return readLiving(req, res);
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
