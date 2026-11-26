/**
 * Discovery Studio — deterministic guided-discovery composition.
 *
 * This module assembles the seven-stage public discovery journey from pieces the
 * Portal already owns. It never calls a language model and never fabricates a
 * discovery:
 *
 *   - Encounter derives intent from the visitor's own words.
 *   - Connect / Explore reuse the live hybrid semantic graph search (real
 *     embeddings with an explicit lexical-only degraded mode).
 *   - Hypothesize / Challenge / Experiment / Evolve produce clearly labelled
 *     heuristic scaffolds (epistemic_class CONSTRUCTED, generation mode
 *     DETERMINISTIC_HEURISTIC) that the visitor is invited to edit and challenge.
 *
 * Everything uncertain is labelled. Nothing here is presented as model
 * intelligence or as an independently validated discovery.
 */

export const DISCOVERY_LIMITS = Object.freeze({
  minLength: 2,
  maxLength: 400,
  maxBytes: 4096
});

export class DiscoveryInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DiscoveryInputError';
  }
}

const WORDS = /[a-z0-9][a-z0-9_-]{2,}/g;

export function normalizeSeed(text) {
  const seed = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (seed.length < DISCOVERY_LIMITS.minLength) {
    throw new DiscoveryInputError('Enter a question, observation or idea to begin.');
  }
  if (seed.length > DISCOVERY_LIMITS.maxLength || Buffer.byteLength(seed, 'utf8') > DISCOVERY_LIMITS.maxBytes) {
    throw new DiscoveryInputError(`Keep your entry under ${DISCOVERY_LIMITS.maxLength} characters.`);
  }
  return seed;
}

export function classifyIntent(seed) {
  const text = String(seed || '').toLowerCase();
  if (/^(what|why|how|when|where|who|which|can|could|should|would|will|does|do|is|are|has|have)\b/.test(text)) return 'QUESTION';
  if (/^(i saw|i noticed|i observed|i found|i measured|i recorded|we observed)/.test(text)) return 'OBSERVATION';
  if (/\b(challenge|refute|debunk|reconsider|doubt|contradict)\b/.test(text)) return 'CHALLENGE';
  if (/\b(imagine|invent|design|create|what if|future|possible world|speculative)\b/.test(text)) return 'IMAGINATION';
  return 'IDEA';
}

export function seedTokens(seed) {
  const seen = new Set();
  return (String(seed || '').toLowerCase().match(WORDS) || [])
    .filter(token => token.length > 3)
    .filter(token => (seen.has(token) ? false : (seen.add(token), true)))
    .slice(0, 8);
}

export function matchConcepts(matches = [], seed = '') {
  const seen = new Set();
  const concepts = [];
  for (const match of matches) {
    for (const concept of (match.node?.concepts || match.concepts || [])) {
      const normalized = String(concept).trim().toLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      concepts.push(normalized);
    }
  }
  if (concepts.length < 2) {
    for (const token of seedTokens(seed)) {
      if (!seen.has(token)) {
        seen.add(token);
        concepts.push(token);
      }
      if (concepts.length >= 3) break;
    }
  }
  return concepts.slice(0, 3);
}

function slug(seed, length = 72) {
  const clean = String(seed || '').replace(/\s+/g, ' ').trim();
  return clean.length > length ? clean.slice(0, length).trimEnd() + '…' : clean;
}

export function buildHypothesisScaffolds({ seed, concepts = [] }) {
  const subject = `"${slug(seed)}"`;
  const conceptA = concepts[0] || 'an unexamined mechanism';
  const conceptB = concepts[1] || 'a competing explanation';
  const conceptC = concepts[2] || 'its apparent opposite';

  return [
    {
      id: 'DS-HYP-1',
      statement: `${subject} may be shaped by ${conceptA} more than its most obvious cause.`,
      epistemic_class: 'CONSTRUCTED',
      generation: 'DETERMINISTIC_HEURISTIC',
      assumptions: [`${conceptA} is relevant to ${subject}`, 'no single confounder dominates the comparison'],
      predictions: [`If ${conceptA} matters, supporting evidence should strengthen once alternative causes are held constant.`],
      falsifiers: [`Changing ${conceptA} while holding everything else steady does not change the outcome.`],
      hard_kill_conditions: ['Repeated checks show no association after confounder control.'],
      confidence: 0.2,
      provenance: 'DETERMINISTIC_HEURISTIC_SCAFFOLD'
    },
    {
      id: 'DS-HYP-2',
      statement: `${subject} and ${conceptB} may share a common cause that neither fully explains.`,
      epistemic_class: 'CONSTRUCTED',
      generation: 'DETERMINISTIC_HEURISTIC',
      assumptions: ['a shared upstream cause exists', `${conceptB} and ${subject} are not independent observations`],
      predictions: ['The shared cause should also predict a third, as-yet-unexamined outcome.'],
      falsifiers: [`${conceptB} changes without any change in ${subject}, and vice versa.`],
      hard_kill_conditions: ['A controlled comparison finds no shared upstream signal.'],
      confidence: 0.2,
      provenance: 'DETERMINISTIC_HEURISTIC_SCAFFOLD'
    },
    {
      id: 'DS-HYP-3',
      statement: `${conceptC} might still produce ${subject} under conditions the obvious story excludes.`,
      epistemic_class: 'SPECULATIVE',
      generation: 'DETERMINISTIC_HEURISTIC',
      assumptions: ['the excluded condition can be varied in principle', 'the obvious story is not already complete'],
      predictions: ['A counterfactual where the obvious cause is absent should still show the signature.'],
      falsifiers: [`Removing the obvious cause removes the outcome for ${subject}.`],
      hard_kill_conditions: ['The counterfactual is untestable in any observable setting.'],
      confidence: 0.15,
      provenance: 'DETERMINISTIC_HEURISTIC_SCAFFOLD'
    }
  ];
}

export function buildExperimentProposals(candidates = []) {
  return candidates.map(candidate => ({
    candidate_id: candidate.id,
    status: 'PROPOSED',
    method: `Design a small intervention or observation that separates ${candidate.assumptions?.[0] || 'the proposed cause'} from its strongest alternative.`,
    success_signal: candidate.predictions?.[0] || 'The proposed signature appears under the predicted condition.',
    failure_signal: candidate.falsifiers?.[0] || 'The proposed signature is absent or persists when the proposed cause is removed.',
    performed: false,
    reproducibility: 'Unpublished proposal. A real run must record its method, data and outcome before it is treated as evidence.'
  }));
}

export function buildChallengeNotes(candidates = []) {
  return candidates.map(candidate => ({
    candidate_id: candidate.id,
    challenge: `What evidence would most efficiently separate ${candidate.id} from its strongest alternative?`,
    confounder: `A third factor could explain both the claim and its apparent support.`,
    uncertainty: 'Confidence is a fixed, low placeholder until evidence is attached.'
  }));
}

function summarizeMatch(item) {
  return {
    id: item.node.id,
    title: item.node.title,
    year: item.node.year,
    evidence_level: item.node.evidence_level,
    concepts: item.node.concepts || [],
    grounding_score: item.score ? Math.round(item.score * 100) : 0,
    semantic_score: Number(item.semantic || 0),
    lexical_score: Number(item.lexical || 0),
    graph_neighbor: item.graph_neighbor === true
  };
}

export function buildBriefing({ query, graph = { nodes: [], edges: [] }, semanticStatus = {}, ranked = [], expanded = [] }) {
  const matches = ranked.map(item => summarizeMatch(item));
  const rankedIds = new Set(ranked.map(item => item.node.id));
  const neighbors = expanded
    .filter(item => !rankedIds.has(item.node.id))
    .map(item => summarizeMatch({ ...item, semantic: 0, lexical: 0 }));
  const expandedIds = new Set(expanded.map(item => item.node.id));
  const relationships = (graph.edges || [])
    .filter(edge => expandedIds.has(edge.from) && expandedIds.has(edge.to))
    .slice(0, 24)
    .map(edge => ({ from: edge.from, to: edge.to, type: edge.type, concepts: edge.concepts || [], strength: edge.strength }));

  const intent = classifyIntent(query);
  const concepts = matchConcepts(ranked, query);
  const candidates = buildHypothesisScaffolds({ seed: query, concepts });
  const degraded = semanticStatus.degraded !== false;
  const semanticMode = semanticStatus.mode || (degraded ? 'lexical_fallback' : 'persistent_embedding_rerank');

  const guidance = {
    QUESTION: 'Clarify what you already believe and what you would accept as evidence either way.',
    OBSERVATION: 'Name the pattern you noticed and what would have to be true for it to mean something.',
    IMAGINATION: 'Describe the possible world clearly enough that its assumptions can be challenged.',
    CHALLENGE: 'State the claim you doubt and the strongest evidence that would change your mind.',
    IDEA: 'Turn the idea into a claim that could, in principle, be shown wrong.'
  }[intent];

  return {
    seed: { text: query, intent, char_count: query.length, concept_tokens: seedTokens(query) },
    grounding: {
      mode: semanticMode,
      degraded,
      reason: semanticStatus.reason || null,
      model: semanticStatus.model || null,
      matched_nodes: ranked.length,
      expanded_nodes: expanded.length
    },
    stages: {
      encounter: { intent, guidance },
      connect: {
        matches,
        disclosure: degraded
          ? 'Semantic retrieval is temporarily unavailable; results use lexical matching only and are clearly not a substitute for semantic intelligence.'
          : 'Results combine persistent vector similarity with lexical and provenance ranking.'
      },
      explore: { neighbors, shared_concepts: concepts, relationships },
      hypothesize: {
        generation: 'DETERMINISTIC_HEURISTIC',
        model: null,
        candidates,
        disclosure: 'These are editable heuristic scaffolds generated without a language model. They are not discoveries and carry no evidence yet.'
      },
      challenge: { notes: buildChallengeNotes(candidates), stored_contradictions: [], uncertainty: 0.8 },
      experiment: {
        status: 'PROPOSED',
        proposals: buildExperimentProposals(candidates),
        disclosure: 'Experiments are proposals only. Performed versus proposed is always distinguished.'
      },
      evolve: {
        lineage: candidates.map(candidate => candidate.id),
        next_steps: [
          'Edit a hypothesis so it matches your intent.',
          'Attach evidence for and against it.',
          'Return later to revise it when new evidence appears.'
        ],
        disclosure: 'Nothing is retained unless you explicitly choose to save it.'
      }
    },
    safety: {
      actuation_allowed: false,
      production_mutation_allowed: false,
      model_calls: 0
    },
    disclaimer: 'The Portal helps you structure a discovery. It does not manufacture certainty, history or scientific authority.'
  };
}
