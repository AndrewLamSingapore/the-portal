/**
 * Open Intelligence Observatory — pure composition of publishable transparency
 * data from the recorded living engine, the knowledge graph and experiment
 * results. Nothing here is fabricated: empty sections are labelled pending.
 */

export function buildObservatory({ runs = [], latestRun = null, graph = { nodes: [], edges: [] }, experimentResults = [], productVersion = '' }) {
  const result = latestRun?.result || {};
  const arena = Array.isArray(result.population) ? result.population : [];
  const fossils = Array.isArray(result.fossils) ? result.fossils : [];

  const conceptCounts = new Map();
  for (const node of graph.nodes || []) {
    for (const concept of node.concepts || []) {
      conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
    }
  }
  const constellations = [...conceptCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }));

  const recorded = (experimentResults || [])
    .map(row => row?.result_json || row)
    .filter(Boolean)
    .slice(0, 20);

  return {
    product: 'The Portal',
    product_version: productVersion,
    mode: 'OPEN_INTELLIGENCE_OBSERVATORY',
    generated_at: new Date().toISOString(),
    transparency: {
      live_activity: {
        runs: (runs || []).slice(0, 20),
        latest: latestRun ? {
          id: latestRun.id,
          status: latestRun.status,
          created_at: latestRun.created_at,
          started_at: latestRun.started_at,
          finished_at: latestRun.finished_at,
          generation_mode: latestRun.generation_mode,
          model_calls: latestRun.model_calls,
          generation_count: latestRun.generation_count,
          fossil_count: latestRun.fossil_count,
          verdict: latestRun.verdict
        } : null
      },
      living_knowledge_graph: {
        node_count: (graph.nodes || []).length,
        edge_count: (graph.edges || []).length,
        constellations
      },
      hypothesis_arena: {
        generation_mode: result.generation_mode || null,
        source_run: latestRun?.id || null,
        candidates: arena
      },
      experiment_lab: {
        recorded_results: recorded,
        disclosure: 'Experiments performed are always distinguished from experiments proposed. Deterministic cycles propose discriminating observations; they do not run physical experiments.'
      },
      fossil_record: {
        source_run: latestRun?.id || null,
        fossils,
        evidence_boundary: 'Fossils are retained deterministic hypotheses that were killed or superseded; their falsifiers and lineage remain visible.'
      },
      evidence_audit: {
        evidence_states: ['AI-CURATED', 'CONCEPTUAL-INFERENCE', 'HISTORICALLY-VERIFIED'],
        notice: 'Evidence labels are provenance, not a guarantee of truth. Open each record to inspect its source trail.'
      },
      benchmark: {
        status: 'PENDING_INDEPENDENT_VALIDATION',
        notice: 'No comparative benchmark has been preregistered or independently reviewed yet. This section is intentionally empty.'
      },
      open_source: {
        repository: 'https://github.com/AndrewLamSingapore/the-portal',
        architecture: 'ARCHITECTURE.md',
        roadmap: 'https://github.com/AndrewLamSingapore/the-portal/issues/113'
      },
      participation: {
        consent_required: true,
        channels: ['GitHub Discussions', 'GitHub Issues']
      }
    },
    safety: {
      actuation_allowed: false,
      production_source_mutation_allowed: false,
      deployment_mutation_allowed: false
    }
  };
}
