const CANDIDATE_ID = /^PTL-EXP-[A-Z0-9-]+$/;
const SPEC_ID = /^PRM-EXP-[A-Z0-9-]+$/;
const STATUSES = new Set(['proposed', 'accepted', 'rejected', 'superseded']);

function record(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

function text(value, field, max = 2000) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${field} is too long`);
  return normalized;
}

function optionalText(value, field) {
  return value === undefined || value === null ? value : text(value, field);
}

function stringList(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${field} must contain only non-empty strings`);
  }
  const normalized = value.map(item => item.trim());
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${field} must not contain duplicates`);
  }
  return normalized;
}

export function validateExperimentCandidate(input) {
  const value = record(input, 'candidate');
  const allowed = new Set([
    'schema_version', 'candidate_id', 'source', 'title', 'question',
    'hypothesis', 'node_ids', 'concepts', 'provenance',
    'evidence_boundary', 'status', 'created_at'
  ]);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) throw new Error('candidate contains unsupported fields');
  if (value.schema_version !== '1.0' || value.source !== 'the-portal') {
    throw new Error('unsupported candidate identity');
  }

  const candidateId = text(value.candidate_id, 'candidate_id', 128);
  if (!CANDIDATE_ID.test(candidateId)) throw new Error('invalid candidate_id');
  if (!STATUSES.has(value.status)) throw new Error('invalid candidate status');
  if (!['proposed', 'accepted'].includes(value.status)) {
    throw new Error('only proposed or accepted candidates may be relayed');
  }

  let createdAt = value.created_at ?? null;
  if (createdAt !== null) {
    createdAt = text(createdAt, 'created_at', 64);
    if (Number.isNaN(Date.parse(createdAt))) {
      throw new Error('created_at must be an RFC 3339 date-time');
    }
  }

  return {
    schema_version: '1.0',
    candidate_id: candidateId,
    source: 'the-portal',
    title: text(value.title, 'title', 512),
    question: text(value.question, 'question'),
    hypothesis: optionalText(value.hypothesis, 'hypothesis') ?? null,
    node_ids: stringList(value.node_ids, 'node_ids'),
    concepts: stringList(value.concepts, 'concepts'),
    provenance: stringList(value.provenance, 'provenance'),
    evidence_boundary: text(value.evidence_boundary, 'evidence_boundary'),
    status: value.status,
    created_at: createdAt
  };
}

export function validatePrimeRelayResponse(input, candidate) {
  const value = record(input, 'PRIME response');
  const spec = record(value.experiment_spec, 'experiment_spec');
  if (spec.schema_version !== '1.0' || spec.source !== 'prime') {
    throw new Error('unsupported PRIME ExperimentSpec identity');
  }
  if (typeof spec.experiment_id !== 'string' || !SPEC_ID.test(spec.experiment_id)) {
    throw new Error('invalid PRIME experiment_id');
  }
  if (spec.candidate_id !== candidate.candidate_id) {
    throw new Error('PRIME response candidate identity mismatch');
  }
  if (spec.target_system !== 'velyqua') {
    throw new Error('PRIME response does not target VELYQUA');
  }
  if (spec.approval_state === 'approved') {
    throw new Error('PRIME must not infer owner approval');
  }
  return value;
}
