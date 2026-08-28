const MODEL = 'gpt-5.6-luna';

const SYSTEM = `You are the generative cortex inside The Portal 6.3 evolutionary sandbox. Generate competing possibilities from supplied observations without pretending speculation is fact. Seek non-obvious but defensible explanations. Every candidate must expose ancestry, assumptions, prospective predictions and concrete falsifiers. Include at least one serious alternative explanation. Explorer candidates may be highly speculative, including counterfactual or unknown-law possibilities, but must label that epistemic class accurately. Scientist candidates prioritize evidence and discriminating tests. Skeptic candidates attack attractive explanations and search for confounders. Never fabricate sources. Return only structured data.`;

const FITNESS = { type: 'object', additionalProperties: false, properties: {
  accuracy: { type: 'number', minimum: 0, maximum: 1 }, evidence: { type: 'number', minimum: 0, maximum: 1 }, novelty: { type: 'number', minimum: 0, maximum: 1 }, utility: { type: 'number', minimum: 0, maximum: 1 }, robustness: { type: 'number', minimum: 0, maximum: 1 }, efficiency: { type: 'number', minimum: 0, maximum: 1 }, calibration: { type: 'number', minimum: 0, maximum: 1 }, constraint_compliance: { type: 'number', minimum: 0, maximum: 1 }
}, required: ['accuracy','evidence','novelty','utility','robustness','efficiency','calibration','constraint_compliance'] };

const CANDIDATE = { type: 'object', additionalProperties: false, properties: {
  statement: { type: 'string' }, niche: { type: 'string', enum: ['EXPLORER','SCIENTIST','SKEPTIC'] },
  epistemic_class: { type: 'string', enum: ['INFERRED','EXTRAPOLATED','SPECULATIVE','COUNTERFACTUAL','UNKNOWN_LAW','CONSTRUCTED'] },
  parent_ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
  assumptions: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
  predictions: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
  falsifiers: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
  discriminating_test: { type: 'string' }, confidence: { type: 'number', minimum: 0.05, maximum: 0.8 }, fitness: FITNESS
}, required: ['statement','niche','epistemic_class','parent_ids','assumptions','predictions','falsifiers','discriminating_test','confidence','fitness'] };

const SCHEMA = { type: 'object', additionalProperties: false, properties: {
  candidates: { type: 'array', items: CANDIDATE, minItems: 3, maxItems: 6 },
  synthesis: { type: 'string' }, next_question: { type: 'string' }
}, required: ['candidates','synthesis','next_question'] };

function outputText(data) { return (data?.output || []).flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text || '').join('').trim(); }

export async function generateHypothesisPopulation({ observations, memory = [], generation = 1, fetchImpl = fetch }) {
  if (!process.env.OPENAI_API_KEY) return null;
  const upstream = await fetchImpl('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({
    model: MODEL, instructions: SYSTEM, max_output_tokens: 5000,
    input: `GENERATION ${generation}\nOBSERVATIONS:\n${JSON.stringify(observations)}\nRELEVANT MEMORY:\n${JSON.stringify(memory)}\nGenerate a diverse population. Do not assume known physics is the full search boundary, but do not label unknown-law speculation as evidence. parent_ids must use exact observation or memory IDs supplied above.`,
    text: { format: { type: 'json_schema', name: 'portal_living_population_v1', strict: true, schema: SCHEMA } }
  }) });
  if (!upstream.ok) throw new Error(`Hypothesis generation upstream HTTP ${upstream.status}`);
  const data = await upstream.json();
  if (data.status !== 'completed') throw new Error(`Hypothesis generation status ${data.status || 'missing'}`);
  const text = outputText(data); if (!text) throw new Error('Empty hypothesis generation output');
  const parsed = JSON.parse(text);
  return { ...parsed, candidates: parsed.candidates.map((candidate, index) => ({
    id: `HYP-G${generation}-${String(index + 1).padStart(2,'0')}`, generation, statement: candidate.statement, niche: candidate.niche,
    epistemic_class: candidate.epistemic_class, state: 'EMERGING', confidence: candidate.confidence,
    ancestry: { parent_ids: candidate.parent_ids, operators: [generation === 1 ? 'ORIGIN' : 'MUTATION'] }, evidence: [], assumptions: candidate.assumptions,
    predictions: candidate.predictions, falsifiers: candidate.falsifiers, hard_kill_conditions: [], discriminating_test: candidate.discriminating_test, fitness: candidate.fitness, history: []
  })) };
}
