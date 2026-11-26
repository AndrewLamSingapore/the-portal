/**
 * Comparative Intelligence Benchmark — deterministic, reproducible, internal
 * evaluation. It compares the Portal's hybrid retrieval (lexical + provenance,
 * plus semantic embeddings when supplied) against a lexical-only baseline on a
 * held-out dataset, and scores discovery quality with explicit rubrics over
 * actual recorded outputs.
 *
 * This is internal benchmarking, not independent scientific validation. Any
 * semantic component that requires paid embedding calls is measured only when
 * explicitly enabled and its cost is reported.
 */

import { hybridSearch } from '../src/lib/semantic-world-model.js';

export const BENCHMARK_VERSION = '1.0.0';
export const VALIDATION_STATUS = 'PENDING_INDEPENDENT_VALIDATION';

const TOKEN_RE = /[a-z0-9][a-z0-9_-]{2,}/g;
const tokens = value => new Set(String(value || '').toLowerCase().match(TOKEN_RE) || []);
const jaccard = (left, right) => {
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / union.size;
};

export function lexicalOnlyRank(query, nodes = [], limit = 5) {
  const q = tokens(query);
  return (nodes || [])
    .map(node => {
      const text = [node.label, node.title, node.name, node.summary, node.description, node.type].filter(Boolean).join(' ');
      return { node, score: jaccard(q, tokens(text)) };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function precisionAt(rankedIds, relevantIds, k = 3) {
  const top = rankedIds.slice(0, k);
  const rel = new Set(relevantIds);
  if (!top.length) return 0;
  return top.filter(id => rel.has(id)).length / top.length;
}

export function recallAt(rankedIds, relevantIds, k = 3) {
  const rel = new Set(relevantIds);
  if (!rel.size) return 0;
  const top = rankedIds.slice(0, k);
  return top.filter(id => rel.has(id)).length / rel.size;
}

export function ndcgAt(rankedIds, relevantIds, k = 5) {
  const rel = new Set(relevantIds);
  const gains = rankedIds.slice(0, k).map((id, index) => (rel.has(id) ? 1 / Math.log2(index + 2) : 0));
  const idealCount = Math.min(rel.size, k);
  const ideal = Array.from({ length: idealCount }, (_, index) => 1 / Math.log2(index + 2));
  const idealDcg = ideal.reduce((sum, value) => sum + value, 0);
  const dcg = gains.reduce((sum, value) => sum + value, 0);
  return idealDcg ? dcg / idealDcg : 0;
}

function evaluateQuery(query, nodes, { semanticScoresByQuery = null, k = 5 } = {}) {
  const lexical = lexicalOnlyRank(query.query, nodes, k).map(item => item.node.id);
  const queryScores = semanticScoresByQuery?.get?.(query.id);
  const semanticScorer = queryScores ? (_query, node) => queryScores.get(node.id) || 0 : null;
  const hybrid = hybridSearch(query.query, nodes.map(node => ({ ...node, type: 'asset', provenance: node.provenance || [] })), {
    limit: k,
    semanticScorer
  }).map(item => item.node.id);
  const relevant = query.relevant || [];
  return {
    query_id: query.id,
    query: query.query,
    relevant,
    lexical: {
      ranked: lexical,
      precision: Number(precisionAt(lexical, relevant, 3).toFixed(3)),
      recall: Number(recallAt(lexical, relevant, 5).toFixed(3)),
      ndcg: Number(ndcgAt(lexical, relevant, 5).toFixed(3))
    },
    hybrid: {
      ranked: hybrid,
      precision: Number(precisionAt(hybrid, relevant, 3).toFixed(3)),
      recall: Number(recallAt(hybrid, relevant, 5).toFixed(3)),
      ndcg: Number(ndcgAt(hybrid, relevant, 5).toFixed(3))
    }
  };
}

export function runRetrievalBenchmark({ nodes = [], queries = [], semanticScoresByQuery = null } = {}) {
  const started = Date.now();
  const results = queries.map(query => evaluateQuery(query, nodes, { semanticScoresByQuery }));
  const average = pick => Number((results.reduce((sum, row) => sum + pick(row), 0) / (results.length || 1)).toFixed(3));
  const semanticActive = Boolean(semanticScoresByQuery?.size);
  return {
    version: BENCHMARK_VERSION,
    mode: semanticActive ? 'hybrid_with_semantic' : 'hybrid_without_semantic',
    semantic_scorer_supplied: semanticActive,
    latency_ms: Date.now() - started,
    model_calls: 0,
    query_count: results.length,
    aggregate: {
      lexical: {
        precision_at_3: average(row => row.lexical.precision),
        recall_at_5: average(row => row.lexical.recall),
        ndcg_at_5: average(row => row.lexical.ndcg)
      },
      hybrid: {
        precision_at_3: average(row => row.hybrid.precision),
        recall_at_5: average(row => row.hybrid.recall),
        ndcg_at_5: average(row => row.hybrid.ndcg)
      }
    },
    per_query: results
  };
}

function fraction(items, predicate) {
  if (!items || !items.length) return 0;
  return items.filter(predicate).length / items.length;
}

export function scoreDiscoveryQuality({ population = [], fossils = [], run = {} } = {}) {
  const uniqueStatements = new Set(population.map(item => String(item.statement || '').toLowerCase()));
  const novelty = population.length ? uniqueStatements.size / population.length : 0;
  const falsifiability = fraction(population, item => (item.falsifiers || []).length > 0 && (item.hard_kill_conditions || []).length > 0);
  const evidenceQuality = fraction(population, item => Boolean(item.epistemic_class) && Boolean(item.ancestry));
  const selfCorrection = typeof run.self_correction === 'boolean'
    ? (run.self_correction ? 1 : 0)
    : (fossils.some(item => item.superseded_by) || fossils.length > 0 ? 1 : 0);
  const evolution = typeof run.evolutionary_improvement === 'boolean'
    ? (run.evolutionary_improvement ? 1 : 0)
    : (population.some(item => item.ancestry?.operators?.includes('MUTATION')) || fossils.some(item => item.superseded_by) ? 1 : 0);
  return {
    novelty: Number(novelty.toFixed(3)),
    falsifiability: Number(falsifiability.toFixed(3)),
    evidence_quality: Number(evidenceQuality.toFixed(3)),
    self_correction: Number(selfCorrection.toFixed(3)),
    evolutionary_improvement: Number(evolution.toFixed(3)),
    generation_number: run.generation_number ?? null,
    revisions: run.revisions ?? null,
    rubric: 'Structural checks over actual recorded outputs; see benchmark/RUBRIC.md. Not proof of originality or scientific accuracy.',
    source_run: run.id || null,
    generation_mode: run.generation_mode || null
  };
}

export function buildLongitudinal({ runs = [] } = {}) {
  const modelRuns = (runs || []).filter(run => (run.generation_mode || run.result?.generation_mode) === 'MODEL_ORIGINATED');
  const latest = modelRuns[0];
  const previous = modelRuns[1];
  const population = Array.isArray(latest?.result?.population) ? latest.result.population : [];
  const falsifiable = population.filter(item => (item.falsifiers || []).length > 0 && (item.hard_kill_conditions || []).length > 0).length;
  const confidences = population.map(item => Number(item.confidence)).filter(Number.isFinite);
  return {
    generations_recorded: modelRuns.length,
    latest_generation: latest?.result?.generation_number ?? latest?.generation_number ?? null,
    previous_generation: previous?.result?.generation_number ?? previous?.generation_number ?? null,
    dormant_count: latest?.result?.dormant_count ?? null,
    revisions: latest?.result?.revisions ?? null,
    fossil_count: Array.isArray(latest?.result?.fossils) ? latest.result.fossils.length : null,
    falsifiability_coverage: population.length ? Number((falsifiable / population.length).toFixed(3)) : null,
    confidence_range: confidences.length ? [Math.min(...confidences), Math.max(...confidences)] : null,
    note: 'Longitudinal structural measures over recorded generations; they do not prove scientific accuracy or usefulness without independent evaluation.'
  };
}

export function buildBenchmarkReport({ retrieval, discovery, longitudinal = null, productVersion = '' }) {
  return {
    product: 'The Portal',
    product_version: productVersion,
    mode: 'INTELLIGENCE_BENCHMARK',
    generated_at: new Date().toISOString(),
    benchmark_version: BENCHMARK_VERSION,
    validation_status: VALIDATION_STATUS,
    disclosure: 'Internal, deterministic benchmark. It is not independent scientific validation and does not establish superiority.',
    retrieval,
    discovery,
    ...(longitudinal ? { longitudinal } : {}),
    limitations: [
      'The semantic component is measured only when embeddings are enabled; without them the hybrid is lexical plus provenance.',
      'Discovery-quality scores are deterministic proxies, not human expert review.',
      'No independent reviewers have evaluated these results yet.'
    ]
  };
}
