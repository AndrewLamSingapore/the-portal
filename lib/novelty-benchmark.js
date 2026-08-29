const MIN_NOVELTY = 0.45;

function words(value) {
  return new Set(String(value || '').toLowerCase().split(/\W+/).filter(token => token.length > 4));
}

function novelty(statement, observations) {
  const candidateWords = words(statement);
  const observationWords = words(observations.map(item => JSON.stringify(item)).join(' '));
  if (!candidateWords.size) return 0;
  let overlap = 0;
  for (const token of candidateWords) if (observationWords.has(token)) overlap += 1;
  return 1 - overlap / candidateWords.size;
}

export function evaluateNoveltyBenchmark({ candidates = [], observations = [], generationMode, originAudit = {} } = {}) {
  const observationIds = new Set(observations.map(item => item?.id).filter(Boolean));
  const statements = candidates.map(candidate => String(candidate?.statement || '').trim()).filter(Boolean);
  const noveltyScores = candidates.map(candidate => novelty(candidate?.statement, observations));
  const parentIds = candidates.flatMap(candidate => candidate?.ancestry?.parent_ids || []);
  const niches = new Set(candidates.map(candidate => candidate?.niche).filter(Boolean));
  const noInheritance = originAudit.inherited_population === false
    && originAudit.inherited_fossils === false
    && originAudit.inherited_hypotheses === false
    && originAudit.inherited_memory === false;
  const observationOnly = originAudit.observation_only === true
    && originAudit.seed_statement_leakage === false
    && originAudit.prompt_seed_statements === 0;
  const ancestryBounded = parentIds.length > 0 && parentIds.every(id => observationIds.has(id));
  const populationDiverse = candidates.length >= 3
    && new Set(statements).size === statements.length
    && niches.size >= 3;
  const noveltyThresholdMet = noveltyScores.length > 0 && Math.max(...noveltyScores) >= MIN_NOVELTY;
  const modelOriginated = generationMode === 'MODEL_ORIGINATED';
  const passed = modelOriginated
    && noInheritance
    && observationOnly
    && ancestryBounded
    && populationDiverse
    && noveltyThresholdMet;

  return {
    passed,
    protocol: 'OBSERVATION_ONLY_BLIND_ORIGIN_V1',
    model_originated: modelOriginated,
    no_inherited_hypotheses: noInheritance,
    observation_only_prompt: observationOnly,
    ancestry_bounded_to_observations: ancestryBounded,
    population_diverse: populationDiverse,
    novelty_threshold_met: noveltyThresholdMet,
    max_novelty: noveltyScores.length ? Math.max(...noveltyScores) : 0,
    candidate_count: candidates.length,
    niche_count: niches.size,
    source_observation_ids: [...observationIds]
  };
}

export function recoverNoveltyCertificate(run, observations = []) {
  const state = run?.state;
  if (!state?.clean_room || !Array.isArray(state.initial_population) || !state.origin_audit) return null;
  const benchmark = evaluateNoveltyBenchmark({
    candidates: state.initial_population,
    observations,
    generationMode: state.generation_mode,
    originAudit: state.origin_audit
  });
  const verdict = state.verdict;
  const decisivePass = verdict?.passed === true
    && verdict?.criteria?.novel_origin === true
    && verdict?.criteria?.extinction_or_supersession === true;
  return {
    ...benchmark,
    passed: benchmark.passed && decisivePass,
    run_id: run.id,
    verified_at: run.updated_at || run.created_at || null,
    decisive_protocol_id: verdict?.protocol_id || null
  };
}
