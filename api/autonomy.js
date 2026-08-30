import { latestAutonomyDigest, runAutonomyCycle } from '../lib/autonomy.js';

function json(res, status, value) {
  res.status(status).json(value);
}

function cronAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) return false;
  return String(req.headers.authorization || '') === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' && req.query?.mode === 'latest') {
    const token = String(process.env.PORTAL_SPINE_TOKEN || '').trim();
    if (!token || String(req.headers.authorization || '') !== `Bearer ${token}`) {
      return json(res, 401, { error: 'Unauthorized.' });
    }
    const latest = await latestAutonomyDigest();
    return json(res, 200, { latest });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed.' });
  }
  if (!cronAuthorized(req)) return json(res, 401, { error: 'Cron authorization required.' });
  try {
    const result = await runAutonomyCycle();
    const status = result.status === 'BLOCKED' ? 503 : 200;
    return json(res, status, result);
  } catch (error) {
    return json(res, 500, { error: 'Autonomy cycle failed.', detail: String(error?.message || error).slice(0, 200) });
  }
}
