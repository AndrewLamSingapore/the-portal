const RESULT_ID = /^PRM-RES-[A-Z0-9-]+$/;
const EXPERIMENT_ID = /^PRM-EXP-[A-Z0-9-]+$/;
const STATUSES = new Set([
  'awaiting_owner_approval',
  'approved_for_observation',
  'collecting_evidence',
  'completed',
  'rejected'
]);
const CONCLUSIONS = new Set([
  'evaluation_pending',
  'evidence_collected',
  'completed_without_observations',
  'rejected_by_owner'
]);

function record(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value;
}

function text(value, field, max = 512) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${field} is too long`);
  return normalized;
}

function nullableTimestamp(value, field) {
  if (value === null) return null;
  const normalized = text(value, field, 64);
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${field} must be an RFC 3339 date-time`);
  return normalized;
}

export function validatePrimeExperimentResult(input) {
  const value = record(input, 'result');
  const allowed = new Set([
    'schema_version', 'result_id', 'result_version', 'source', 'experiment_id',
    'candidate_id', 'node_ids', 'status', 'conclusion', 'evidence_summary',
    'safety', 'updated_at'
  ]);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length || Object.keys(value).length !== allowed.size) throw new Error('result fields do not match the version 1.0 contract');
  if (value.schema_version !== '1.0' || value.source !== 'prime') throw new Error('unsupported result identity');
  const resultId = text(value.result_id, 'result_id');
  const experimentId = text(value.experiment_id, 'experiment_id');
  if (!RESULT_ID.test(resultId)) throw new Error('invalid result_id');
  if (!EXPERIMENT_ID.test(experimentId)) throw new Error('invalid experiment_id');
  if (!Number.isSafeInteger(value.result_version) || value.result_version < 1) throw new Error('result_version must be a positive integer');
  if (!Array.isArray(value.node_ids) || !value.node_ids.every(item => typeof item === 'string' && item.trim())) {
    throw new Error('node_ids must be an array of non-empty strings');
  }
  if (!STATUSES.has(value.status)) throw new Error('invalid result status');
  if (!CONCLUSIONS.has(value.conclusion)) throw new Error('invalid result conclusion');

  const evidence = record(value.evidence_summary, 'evidence_summary');
  if (Object.keys(evidence).sort().join(',') !== 'evidence_levels,first_observed_at,last_observed_at,observation_count,provenance_complete') {
    throw new Error('evidence_summary fields do not match the version 1.0 contract');
  }
  if (!Number.isSafeInteger(evidence.observation_count) || evidence.observation_count < 0) throw new Error('invalid observation_count');
  const levels = record(evidence.evidence_levels, 'evidence_levels');
  if (Object.keys(levels).sort().join(',') !== 'derived,raw,reference') throw new Error('invalid evidence level counts');
  const levelTotal = ['raw', 'reference', 'derived'].reduce((total, key) => {
    if (!Number.isSafeInteger(levels[key]) || levels[key] < 0) throw new Error(`invalid ${key} evidence count`);
    return total + levels[key];
  }, 0);
  if (levelTotal !== evidence.observation_count) throw new Error('evidence level counts must equal observation_count');
  if (typeof evidence.provenance_complete !== 'boolean') throw new Error('provenance_complete must be boolean');
  const first = nullableTimestamp(evidence.first_observed_at, 'first_observed_at');
  const last = nullableTimestamp(evidence.last_observed_at, 'last_observed_at');
  if (evidence.observation_count === 0 && (first || last)) throw new Error('empty evidence cannot have observation timestamps');
  if (evidence.observation_count > 0 && (!first || !last)) throw new Error('observations require first and last timestamps');

  const safety = record(value.safety, 'safety');
  if (Object.keys(safety).sort().join(',') !== 'actuation_authorized,owner_approval_inferred,scientific_support_claimed') {
    throw new Error('safety fields do not match the version 1.0 contract');
  }
  if (safety.actuation_authorized !== false || safety.owner_approval_inferred !== false || safety.scientific_support_claimed !== false) {
    throw new Error('Portal accepts only non-actuating, non-inferred, evidence-bound results');
  }

  return {
    ...value,
    result_id: resultId,
    experiment_id: experimentId,
    candidate_id: text(value.candidate_id, 'candidate_id'),
    node_ids: [...new Set(value.node_ids.map(item => item.trim()))],
    updated_at: nullableTimestamp(value.updated_at, 'updated_at')
  };
}

export function canonicalExperimentResult(value) {
  const result = validatePrimeExperimentResult(value);
  const sort = input => Array.isArray(input)
    ? input.map(sort)
    : input && typeof input === 'object'
      ? Object.fromEntries(Object.keys(input).sort().map(key => [key, sort(input[key])]))
      : input;
  return JSON.stringify(sort(result));
}

export function attachExperimentResults(graph, input = []) {
  const nodes = [...(graph?.nodes || [])];
  const edges = [...(graph?.edges || [])];
  const resultEdges = [];
  const ids = new Set(nodes.map(node => node.id));
  for (const raw of input) {
    const result = validatePrimeExperimentResult(raw.result_json || raw);
    const id = `RESULT-${result.experiment_id}`;
    const node = {
      id,
      year: new Date(result.updated_at).getUTCFullYear(),
      title: `Experiment evidence: ${result.conclusion.replaceAll('_', ' ')}`,
      evidence_level: 'OBSERVATION',
      concepts: ['experiment-result', result.status],
      experiment_result: result
    };
    const existing = nodes.findIndex(item => item.id === id);
    if (existing >= 0) nodes[existing] = node; else nodes.push(node);
    ids.add(id);
    for (const source of result.node_ids) if (ids.has(source)) resultEdges.push({
      from: source,
      to: id,
      type: 'EXPERIMENT_EVIDENCE',
      concepts: ['observation'],
      reason: result.conclusion,
      strength: result.evidence_summary.observation_count ? .8 : .4
    });
  }
  return { nodes, edges: [...resultEdges, ...edges].slice(0, 120) };
}
