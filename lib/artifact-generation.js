const SYSTEM = `You curate The Portal, an archive of futures. Generate one original catalogue artifact with historically plausible texture. You are creating an AI-curated discovery object, not asserting verified history. Clearly separate observed/plausible description from conceptual inference. Never fabricate a URL or citation. sources must therefore be an empty array unless genuine source URLs were supplied in the prompt. relationships describe conceptual relationships, not proven causation. Return only structured data.`;

const TYPES = ['PRINTED EPHEMERA', 'FORGOTTEN TECHNOLOGY', 'IMAGINED WORLD', 'LOST INVENTION', 'DOMESTIC OBJECT', 'INDUSTRIAL PROTOTYPE', 'SPECIMEN — UNCLASSIFIED', 'EXHIBIT FROM THE STACKS'];
const STATUSES = ['ARRIVED', 'PARTIALLY ARRIVED', 'FAILED', 'ABANDONED', 'TOO EARLY', 'STILL WAITING'];
export const MODES = {
  wander: 'Maximize surprise and conceptual distance from ordinary technology history.',
  arrived: 'Underlying future later ARRIVED or PARTIALLY ARRIVED.',
  failed: 'Ambitious future FAILED or was ABANDONED.',
  early: 'Idea was TOO EARLY for its infrastructure, economics, materials, or culture.',
  waiting: 'Compelling future is STILL WAITING.',
  distant: '1750–1939 and uncannily relevant now.'
};

const MODEL = 'gpt-5.6-luna';
const MAX_OUTPUT_TOKENS = 6000;
const MAX_GENERATION_ATTEMPTS = 2;

const relationship = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['PRECEDED_BY', 'ECHOED_BY', 'FAILED_BECAUSE', 'BECAME_POSSIBLE_WHEN'] },
    label: { type: 'string' }
  },
  required: ['type', 'label']
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    era: { type: 'string' },
    year: { type: 'integer', minimum: 1750, maximum: 2005 },
    type: { type: 'string', enum: TYPES },
    title: { type: 'string' },
    description: { type: 'string' },
    provenance: { type: 'string' },
    condition: { type: 'integer', minimum: 1, maximum: 5 },
    imagined_future: { type: 'string' },
    problem: { type: 'string' },
    status: { type: 'string', enum: STATUSES },
    modern_descendant: { type: 'string' },
    concepts: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
    question: { type: 'string' },
    evidence_level: { type: 'string', enum: ['AI-CURATED', 'CONCEPTUAL-INFERENCE'] },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, url: { type: 'string' } },
        required: ['title', 'url']
      },
      maxItems: 4
    },
    relationships: { type: 'array', items: relationship, maxItems: 4 }
  },
  required: ['era', 'year', 'type', 'title', 'description', 'provenance', 'condition', 'imagined_future', 'problem', 'status', 'modern_descendant', 'concepts', 'question', 'evidence_level', 'sources', 'relationships']
};

class ArtifactResponseError extends Error {
  constructor(message, code, retryable = true) {
    super(message);
    this.name = 'ArtifactResponseError';
    this.code = code;
    this.retryable = retryable;
    this.upstream = true;
  }
}

function outputContent(data) {
  return (data?.output || []).flatMap(item => item.content || []);
}

function validateArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) return false;

  const stringFields = ['era', 'title', 'description', 'provenance', 'imagined_future', 'problem', 'modern_descendant', 'question'];
  if (!stringFields.every(field => typeof artifact[field] === 'string' && artifact[field].trim())) return false;
  if (!Number.isInteger(artifact.year) || artifact.year < 1750 || artifact.year > 2005) return false;
  if (!Number.isInteger(artifact.condition) || artifact.condition < 1 || artifact.condition > 5) return false;
  if (!TYPES.includes(artifact.type) || !STATUSES.includes(artifact.status)) return false;
  if (!['AI-CURATED', 'CONCEPTUAL-INFERENCE'].includes(artifact.evidence_level)) return false;

  if (!Array.isArray(artifact.concepts) || artifact.concepts.length < 2 || artifact.concepts.length > 5) return false;
  if (!artifact.concepts.every(value => typeof value === 'string' && value.trim())) return false;

  if (!Array.isArray(artifact.sources) || artifact.sources.length > 4) return false;
  if (!artifact.sources.every(source => source && typeof source === 'object' && typeof source.title === 'string' && typeof source.url === 'string')) return false;

  if (!Array.isArray(artifact.relationships) || artifact.relationships.length > 4) return false;
  if (!artifact.relationships.every(item => item && typeof item === 'object' && relationship.properties.type.enum.includes(item.type) && typeof item.label === 'string' && item.label.trim())) return false;

  return true;
}

export function parseArtifactResponse(data) {
  if (data?.status === 'incomplete') {
    const reason = data.incomplete_details?.reason || 'unknown';
    throw new ArtifactResponseError(`Incomplete model response: ${reason}`, `incomplete_${reason}`);
  }
  if (data?.status !== 'completed') {
    const status = data?.status || 'missing';
    throw new ArtifactResponseError(`Unexpected model response status: ${status}`, `status_${status}`);
  }

  const content = outputContent(data);
  if (content.some(item => item.type === 'refusal')) {
    throw new ArtifactResponseError('Model refused artifact generation', 'refusal', false);
  }

  const output = content
    .filter(item => item.type === 'output_text')
    .map(item => item.text || '')
    .join('')
    .trim();
  if (!output) throw new ArtifactResponseError('No artifact output', 'empty_output');

  let artifact;
  try {
    artifact = JSON.parse(output);
  } catch {
    throw new ArtifactResponseError('Malformed structured artifact output', 'malformed_json');
  }
  if (!validateArtifact(artifact)) throw new ArtifactResponseError('Artifact failed schema validation', 'invalid_schema');
  return artifact;
}

async function requestArtifact({ mode, context, signal, fetchImpl }) {
  const upstream = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      instructions: SYSTEM,
      input: `CURATOR MODE: ${mode.toUpperCase()}\n${MODES[mode]}${context}`,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      text: { format: { type: 'json_schema', name: 'portal_artifact_v4', strict: true, schema: SCHEMA } }
    })
  });

  if (!upstream.ok) {
    const retryable = upstream.status === 408 || upstream.status === 429 || upstream.status >= 500;
    throw new ArtifactResponseError(`Upstream HTTP ${upstream.status}`, `upstream_${upstream.status}`, retryable);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    throw new ArtifactResponseError('Invalid upstream JSON response', 'invalid_upstream_json');
  }
  return parseArtifactResponse(data);
}

export async function generateArtifact({ mode, context = '', signal, fetchImpl = fetch }) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      return await requestArtifact({ mode, context, signal, fetchImpl });
    } catch (error) {
      lastError = error;
      if (signal?.aborted || error?.name === 'AbortError') throw error;
      const retryable = error?.retryable === true || error instanceof TypeError;
      if (!retryable || attempt === MAX_GENERATION_ATTEMPTS) throw error;
      console.warn('artifact retry', { attempt, reason: error?.code || error?.name || 'unknown' });
    }
  }
  throw lastError;
}
