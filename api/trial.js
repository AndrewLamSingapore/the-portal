import { castArtifactVerdict, getArtifact, getArtifactVerdicts, hasDatabase } from '../lib/db.js';

const VERDICTS = new Set(['FAILED', 'TOO_EARLY', 'ARRIVED_QUIETLY']);
const attempts = new Map();

function clean(value) {
  return String(value || '').trim();
}

function aggregate(rows = []) {
  const counts = { FAILED: 0, TOO_EARLY: 0, ARRIVED_QUIETLY: 0 };
  for (const row of rows) if (VERDICTS.has(row.verdict)) counts[row.verdict] = Number(row.vote_count) || 0;
  return counts;
}

function allowVote(req) {
  const key = clean(req.headers?.['x-forwarded-for']).split(',')[0] || 'unknown';
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter(timestamp => now - timestamp < 60000);
  if (recent.length >= 12) return false;
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 500) attempts.delete(attempts.keys().next().value);
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!hasDatabase()) return res.status(503).json({ error: 'Public verdicts unavailable' });

  const artifactId = clean(req.method === 'GET' ? req.query?.id : req.body?.artifact_id);
  if (!/^PTL-\d{4}-[A-Z0-9]{10}$/.test(artifactId)) return res.status(400).json({ error: 'Invalid artifact' });

  try {
    const artifact = await getArtifact(artifactId);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' });
    if (req.method === 'GET') {
      const rows = await getArtifactVerdicts(artifactId);
      return res.status(200).json({ artifact_id: artifactId, counts: aggregate(rows) });
    }

    const verdict = clean(req.body?.verdict);
    if (!VERDICTS.has(verdict)) return res.status(400).json({ error: 'Invalid verdict' });
    if (!allowVote(req)) return res.status(429).json({ error: 'The public record is receiving too many verdicts. Try again shortly.' });
    const rows = await castArtifactVerdict(artifactId, verdict);
    return res.status(200).json({ artifact_id: artifactId, counts: aggregate(rows) });
  } catch (error) {
    console.error('trial error', error?.message || error);
    return res.status(500).json({ error: 'The public record could not accept this verdict' });
  }
}
