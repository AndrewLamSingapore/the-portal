import { db, findArtifacts, hasDatabase } from '../lib/db.js';

const PRODUCT_VERSION = '6.3.1';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const database = hasDatabase();
  const generation = Boolean(process.env.OPENAI_API_KEY);
  const revision = process.env.VERCEL_GIT_COMMIT_SHA || null;
  if (!database) {
    return res.status(503).json({ ok: false, database: false, archive: false, generation_configured: generation, schema_version: null, product_version: PRODUCT_VERSION, revision });
  }
  try {
    const sql = db();
    const [artifacts, columns, participation] = await Promise.all([
      findArtifacts({ limit: 1 }),
      sql`select column_name from information_schema.columns where table_schema='public' and table_name='artifacts'`,
      sql`select to_regclass('public.artifact_verdicts') as verdicts`
    ]);
    const availableColumns = new Set(columns.map(row => row.column_name));
    const evidenceSchema = ['evidence_level', 'sources', 'relationships', 'experiment', 'connections', 'lifecycle', 'current_phase', 'recurrence_conditions', 'realization_signal'].every(column => availableColumns.has(column));
    const publicParticipation = Boolean(participation[0]?.verdicts);
    const archive = artifacts.length > 0;
    const ok = archive && generation && evidenceSchema && publicParticipation;
    return res.status(ok ? 200 : 503).json({
      ok,
      database: true,
      archive,
      generation_configured: generation,
      evidence_schema: evidenceSchema,
      public_participation: publicParticipation,
      living_observatory: true,
      schema_version: evidenceSchema ? 6 : 5,
      product_version: PRODUCT_VERSION,
      experience: 'Continuous Futures Model',
      revision
    });
  } catch (error) {
    console.error('health error', error?.message || error);
    return res.status(500).json({ ok: false, database: true, archive: false, generation_configured: generation, schema_version: null, product_version: PRODUCT_VERSION, revision });
  }
}
