import { runLivingSandbox, SANDBOX_SEED } from '../lib/living-sandbox.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const enabled = process.env.PORTAL_LIVING_SANDBOX === '1' || process.env.VERCEL_ENV === 'preview';
  if (!enabled) return res.status(404).json({ error: 'Living sandbox disabled' });

  const result = runLivingSandbox(SANDBOX_SEED);
  return res.status(200).json({
    product: 'The Portal',
    version: '6.3.0-preview.2',
    mode: 'SANDBOX',
    production_mutation: false,
    result
  });
}
