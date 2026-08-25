import { db, findArtifacts, hasDatabase } from '../lib/db.js';

const PRODUCT_VERSION = '5.2.0';

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
    const [artifacts, columns] = await Promise.all([
      findArtifacts({ limit: 1 }),
      sql`select column_name from information_schema.columns where table_schema='public' and table_name='artifacts'`
    ]);
    const availableColumns = new Set(columns.map(row => row.column_name));
    const evidenceSchema = ['evidence_level', 'sources', 'relationships', 'experiment', 'connections'].every(column => availableColumns.has(column));
    const archive = artifacts.length > 0;
    const ok = archive && generation && evidenceSchema;
    return res.status(ok ? 200 : 503).json({
      ok,
      database: true,
      archive,
      generation_configured: generation,
      evidence_schema: evidenceSchema,
      schema_version: evidenceSchema ? 5 : 4,
      product_version: PRODUCT_VERSION,
      experience: 'Living Knowledge System',
      revision
    });
  } catch (error) {
    console.error('health error', error?.message || error);
    return res.status(500).json({ ok: false, database: true, archive: false, generation_configured: generation, schema_version: null, product_version: PRODUCT_VERSION, revision });
  }
}
