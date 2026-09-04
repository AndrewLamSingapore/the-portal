import { normalizeObservation, awakeningDecision } from '../lib/awakening.js';
import { hasDatabase, loadLatestLivingRun, saveLivingRun, appendLivingEvent } from '../lib/db.js';
import { runDecisiveExperiment } from '../lib/decisive-experiment.js';
import { generateHypothesisPopulation } from '../lib/hypothesis-generation.js';
import { LayeredMemory, runExecutiveCycle, TOOL_REGISTRY } from '../lib/living-intelligence.js';
import { runLivingSandbox, SANDBOX_SEED } from '../lib/living-sandbox.js';
import { runGenerations } from '../lib/multigeneration.js';
import { recoverNoveltyCertificate } from '../lib/novelty-benchmark.js';
import { deliverPortfolioOutbox, portalEvent, publishPortalEvents } from '../src/lib/portfolio-events.js';
import { PRODUCT_VERSION } from '../lib/product-version.js';
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
    kind: 'CLEANROOM_INPUT_OBSERVATION',
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
  const originAudit = {
    observation_only: true,
    seed_statement_leakage: false,
    prompt_seed_statements: 0,
    inherited_population: false,
    inherited_fossils: false,
    inherited_hypotheses: false,
    inherited_memory: false,
    trigger: 'UNATTENDED_OBSERVATION_PROTOCOL',
    model: generated.model
  };
  const trial = runDecisiveExperiment({
    initial: generated.candidates,
    cognition,
    observations: seed.observations,
    generationMode: 'MODEL_ORIGINATED',
    originAudit
  });
  const runId = `${CLEANROOM}-${Date.now()}`;
  let portfolioFabric={queued:[],delivery:{processed:0,delivered:0,dead:0}};

  if (hasDatabase()) {
    await saveLivingRun({
      id: runId,
      sandbox_key: CLEANROOM,
      status: trial.verdict.passed ? 'PASSED' : 'COMPLETED',
      generation: trial.generations.length,
      state: {
        clean_room: true,
        contamination_source: null,
        generation_mode: 'MODEL_ORIGINATED',
        origin_audit: originAudit,
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
    const events=generated.candidates.map(candidate=>portalEvent('portal.hypothesis.created',{statement:candidate.statement,niche:candidate.niche,epistemic_class:candidate.epistemic_class,confidence:candidate.confidence},{eventId:`portal-${runId}-${candidate.id}`,correlationId:runId,subjectId:candidate.id,evidenceLevel:'E1',provenance:candidate.ancestry?.parent_ids||[]}));
    events.push(portalEvent('portal.experiment.completed',{verdict:trial.verdict,generations:trial.generations.length,model:generated.model},{eventId:`portal-${runId}-experiment`,correlationId:runId,subjectId:runId,evidenceLevel:'E2',provenance:generated.candidates.map(candidate=>candidate.id)}));
    try{portfolioFabric=await publishPortalEvents(events);}catch(error){portfolioFabric={queued:[],delivery:{processed:0,delivered:0,dead:0},error:String(error?.message||error).slice(0,300)};}
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
    run_id: runId,
    portfolio_fabric: portfolioFabric
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
  const [prior, benchmarkRun] = hasDatabase()
    ? await Promise.all([loadLatestLivingRun(SANDBOX_SEED.id), loadLatestLivingRun(CLEANROOM)])
    : [null, null];
  const noveltyBenchmark = recoverNoveltyCertificate(benchmarkRun, result.observations);
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
    memory,
    noveltyBenchmark
  });
  const decisive = runDecisiveExperiment({
    initial,
    cognition,
    observations: result.observations,
    generationMode: 'DETERMINISTIC_FALLBACK',
    history: result.population
  });
  const certifiedVerdict = noveltyBenchmark?.passed && benchmarkRun?.state?.verdict?.passed
    ? benchmarkRun.state.verdict
    : decisive.verdict;
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
    decisive_experiment: {
      protocol: decisive.protocol,
      verdict: certifiedVerdict,
      acceptance_source: noveltyBenchmark?.passed ? 'REPLAY_VERIFIED_CLEANROOM_CERTIFICATE' : 'CURRENT_DETERMINISTIC_OBSERVATORY'
    },
    novelty_benchmark: noveltyBenchmark,
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
  if (req.method === 'GET' && req.query?.route === 'portfolio-events') {
    const expected=process.env.CRON_SECRET||process.env.PORTFOLIO_OUTBOX_TOKEN;
    if(!expected)return res.status(503).json({error:'outbox_authorization_not_configured'});
    if(req.headers?.authorization!==`Bearer ${expected}`)return res.status(401).json({error:'unauthorized'});
    const result=await deliverPortfolioOutbox({limit:50});
    return res.status(result.reason?503:200).json({ok:!result.reason,...result});
  }
  if (!isLivingEnabled()) return res.status(404).json({ error: 'Living Observatory disabled' });
  if (req.method === 'POST') return observe(req, res);
  if (req.method === 'GET') return readLiving(req, res);
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
