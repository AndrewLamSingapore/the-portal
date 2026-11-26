/**
 * Room facilitator — optional model-backed discussion synthesis. Clearly
 * separates human contributions, AI suggestions and evidence, and never treats
 * popularity as truth. The deterministic facilitator in discovery-rooms.js is
 * the free fallback.
 */

const MODEL = process.env.PORTAL_LIVING_MODEL || 'gpt-5.6';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    disagreements: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    connections: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    hypotheses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          statement: { type: 'string' },
          epistemic_class: { type: 'string', enum: ['INFERRED', 'EXTRAPOLATED', 'SPECULATIVE', 'CONSTRUCTED'] },
          falsifier: { type: 'string' }
        },
        required: ['statement', 'epistemic_class', 'falsifier']
      },
      maxItems: 4
    },
    next_question: { type: 'string' }
  },
  required: ['summary', 'disagreements', 'connections', 'hypotheses', 'next_question']
};

function outputText(data) {
  return (data?.output || []).flatMap(part => part.content || []).filter(part => part.type === 'output_text').map(part => part.text || '').join('').trim();
}

export async function facilitateRoomWithModel({ topic, question = null, messages = [], fetchImpl = fetch }) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  const discussion = messages.map(message => `${message.author_kind === 'ai' ? 'AI' : 'participant'}: ${message.text}`).join('\n').slice(0, 16000);
  const upstream = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: 'high' },
      instructions: 'You are an intellectual collaborator in a public discovery room. Summarize the discussion, surface disagreements and cross-disciplinary connections, and propose competing falsifiable hypotheses. Never treat popularity or majority opinion as truth. Clearly separate human contributions, AI suggestions and evidence. Do not fabricate sources. Return only structured data.',
      max_output_tokens: 3000,
      input: `TOPIC: ${topic}\nQUESTION: ${question || 'not stated'}\nDISCUSSION:\n${discussion}`,
      text: { format: { type: 'json_schema', name: 'portal_room_facilitator_v1', strict: true, schema: SCHEMA } }
    })
  });
  if (!upstream.ok) throw new Error(`Facilitator upstream HTTP ${upstream.status}`);
  const data = await upstream.json();
  if (data.status !== 'completed') throw new Error(`Facilitator status ${data.status || 'missing'}`);
  const text = outputText(data);
  if (!text) throw new Error('Empty facilitator output');
  const parsed = JSON.parse(text);
  return {
    generation: 'MODEL_ORIGINATED',
    model: MODEL,
    model_calls: 1,
    usage: data.usage || null,
    ...parsed,
    disclosure: 'AI-generated facilitation; popularity is not truth and hypotheses remain unvalidated until evidence is attached.'
  };
}
