const SYSTEM = `You are the curator of The Portal — a cabinet of strange, forgotten, and imagined objects that seem to have anticipated futures before they arrived.

Generate exactly one original catalogue artifact. It should feel discovered rather than invented: materially specific, historically plausible in texture, and evocative of speculative culture from roughly the 1950s–1990s. Never use a real named copyrighted work, character, franchise, author-created object, or direct imitation.

Prioritize surprise and diversity. Vary era, medium, cultural context, purpose, condition, and provenance. Include tactile physical evidence such as paper stock, ink, corrosion, handwriting, packaging, smell, scratches, fading, repairs, or manufacturing marks where appropriate. Avoid generic sci-fi language and repetitive tropes.

The final question must be genuinely unresolved and haunting rather than a discussion prompt. It must begin with What if, Why did, How did, Who, or Where.

Return only the requested structured artifact data.`;

const TYPES = [
  'PULP FICTION ARTEFACT',
  'FORGOTTEN TECHNOLOGY',
  'IMAGINED WORLD',
  'STRANGE CREATURE',
  'LOST INVENTION',
  'UNCATALOGUED OBJECT',
  'SPECIMEN — UNCLASSIFIED',
  'EXHIBIT FROM THE STACKS'
];

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    era: { type: 'string' },
    type: { type: 'string', enum: TYPES },
    title: { type: 'string' },
    description: { type: 'string' },
    question: { type: 'string' },
    provenance: { type: 'string' },
    condition: { type: 'integer', minimum: 1, maximum: 5 }
  },
  required: ['era', 'type', 'title', 'description', 'question', 'provenance', 'condition']
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Archive not configured' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        instructions: SYSTEM,
        input: 'Open an unexpected drawer in the archive and catalogue one artifact. Make this entry unlike an obvious science-fiction cliché.',
        max_output_tokens: 900,
        text: {
          format: {
            type: 'json_schema',
            name: 'portal_artifact',
            strict: true,
            schema: SCHEMA
          }
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('OpenAI status', response.status, body.slice(0, 500));
      return res.status(502).json({ error: 'Archive upstream unavailable' });
    }

    const data = await response.json();
    const text = (data.output || [])
      .filter(item => item.type === 'message')
      .flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text || '')
      .join('')
      .trim();

    if (!text) throw new Error('OpenAI returned no artifact text');

    const artifact = JSON.parse(text);
    return res.status(200).json(artifact);
  } catch (error) {
    console.error('artifact error', error?.message || error);
    return res.status(500).json({ error: 'Archive failure' });
  }
}
