import crypto from 'node:crypto';

import { findArtifacts, hasDatabase, saveArtifact } from '../lib/db.js';

const SYSTEM = `You curate The Portal, an archive of futures. Generate one original catalogue artifact with historically plausible texture. You are creating an AI-curated discovery object, not asserting verified history. Clearly separate observed/plausible description from conceptual inference. Never fabricate a URL or citation. sources must therefore be an empty array unless genuine source URLs were supplied in the prompt. relationships describe conceptual relationships, not proven causation. Return only structured data.`;

const TYPES = ['PRINTED EPHEMERA', 'FORGOTTEN TECHNOLOGY', 'IMAGINED WORLD', 'LOST INVENTION', 'DOMESTIC OBJECT', 'INDUSTRIAL PROTOTYPE', 'SPECIMEN — UNCLASSIFIED', 'EXHIBIT FROM THE STACKS'];
const STATUSES = ['ARRIVED', 'PARTIALLY ARRIVED', 'FAILED', 'ABANDONED', 'TOO EARLY', 'STILL WAITING'];
const MODES = {
  wander: 'Maximize surprise and conceptual distance from ordinary technology history.',
  arrived: 'Underlying future later ARRIVED or PARTIALLY ARRIVED.',
  failed: 'Ambitious future FAILED or was ABANDONED.',
  early: 'Idea was TOO EARLY for its infrastructure, economics, materials, or culture.',
  waiting: 'Compelling future is STILL WAITING.',
  distant: '1750–1939 and uncannily relevant now.'
};

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

const buckets = globalThis.__portalBuckets || (globalThis.__portalBuckets = new Map());
const WINDOW_MS = 3_600_000;
const MAX_PER_WINDOW = 12;

function ip(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
}

function allowed(key) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  if (bucket.count >= MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function canonical(artifact, mode) {
  const fingerprint = crypto.createHash('sha256')
    .update([artifact.year, normalize(artifact.title).toLowerCase(), normalize(artifact.description).toLowerCase()].join('|'))
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();
  return {
    ...artifact,
    id: `PTL-${artifact.year}-${fingerprint}`,
    mode,
    schema_version: 4,
    created_at: new Date().toISOString(),
    concepts: [...new Set((artifact.concepts || []).map(normalize).filter(Boolean))],
    // Public generation accepts no source input, so generated objects can never
    // acquire an unverified URL merely because it appeared in model output.
    sources: []
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Archive not configured' });
  if (!allowed(ip(req))) return res.status(429).json({ error: 'The archive needs time to settle. Try again later.' });

  const mode = MODES[req.body?.mode] ? req.body.mode : 'wander';
  let context = '';
  if (hasDatabase()) {
    try {
      const recent = await findArtifacts({ limit: 8 });
      context = `\nRECENT TITLES TO AVOID RESEMBLING: ${recent.map(item => `${item.year} ${item.title} [${(item.concepts || []).join(', ')}]`).join(' | ')}`;
    } catch {
      context = '';
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        instructions: SYSTEM,
        input: `CURATOR MODE: ${mode.toUpperCase()}\n${MODES[mode]}${context}`,
        max_output_tokens: 1500,
        text: { format: { type: 'json_schema', name: 'portal_artifact_v4', strict: true, schema: SCHEMA } }
      })
    });
    if (!upstream.ok) {
      console.error('artifact upstream', upstream.status);
      return res.status(502).json({ error: 'Archive upstream unavailable' });
    }
    const data = await upstream.json();
    const output = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text || '')
      .join('')
      .trim();
    if (!output) throw new Error('No artifact');
    const artifact = canonical(JSON.parse(output), mode);
    if (hasDatabase()) {
      try {
        await saveArtifact(artifact);
        artifact.persistence = 'shared';
      } catch (error) {
        console.error('persistence', error?.message || error);
        artifact.persistence = 'local-fallback';
      }
    } else {
      artifact.persistence = 'local';
    }
    return res.status(200).json(artifact);
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    console.error('artifact error', timedOut ? 'timeout' : error?.message || error);
    return res.status(timedOut ? 504 : 500).json({ error: timedOut ? 'Archive timed out' : 'Archive failure' });
  } finally {
    clearTimeout(timer);
  }
}
