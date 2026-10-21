import { db, findArtifacts, hasDatabase } from '../lib/db.js';
import { handlePortalSpine } from '../lib/spine-endpoint.js';
import { handlePortfolioRelay } from '../src/lib/portfolio-relay-endpoint.js';
import { portfolioOutboxStatus } from '../src/lib/portfolio-events.js';
import { PRODUCT_VERSION } from '../lib/product-version.js';
import { trustRelayHandler, postgresTrustStore } from '../src/lib/trust-relay.js';
import { ADMISSION_POLICY } from '../lib/generation-admission.js';
import { privateBoundaryStatus } from '../lib/prime-auth.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const route = String(req.query?.route || 'health');
  if (route === 'trust-relay') return trustRelayHandler(postgresTrustStore(db()))(req,res);
  if (route === 'portfolio-relay') return handlePortfolioRelay(req, res);
  if (['spine', 'autonomy', 'autonomy-latest'].includes(route)) return handlePortalSpine(req, res, route);
  if (route === 'admission') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }
    if (!hasDatabase()) {
      return res.status(503).json({ ok: false, error: 'Admission ledger unavailable' });
    }
    try {
      const sql = db();
      const rows = await sql`
        select
          c.policy_id,
          c.allowance_micro_usd::text as allowance_micro_usd,
          c.reserved_micro_usd::text as reserved_micro_usd,
          (c.allowance_micro_usd - c.reserved_micro_usd)::text as remaining_micro_usd,
          (select count(*)::text from portal_generation_admission.requests) as admitted_request_rows,
          (select coalesce(sum(reserved_micro_usd), 0)::text from portal_generation_admission.requests) as request_reservation_sum_micro_usd,
          (select max(admitted_at)::text from portal_generation_admission.requests) as last_admitted_at
        from portal_generation_admission.credit c
        where c.policy_id = ${ADMISSION_POLICY.id}
        limit 1
      `;
      if (rows.length !== 1) throw new Error('Admission policy row missing');
      const row = rows[0];
      const allowance = Number(row.allowance_micro_usd);
      const reserved = Number(row.reserved_micro_usd);
      const remaining = Number(row.remaining_micro_usd);
      const admittedRows = Number(row.admitted_request_rows);
      const requestReservationSum = Number(row.request_reservation_sum_micro_usd);
      if (row.policy_id !== ADMISSION_POLICY.id
          || !Number.isSafeInteger(allowance)
          || !Number.isSafeInteger(reserved)
          || !Number.isSafeInteger(remaining)
          || !Number.isSafeInteger(admittedRows)
          || !Number.isSafeInteger(requestReservationSum)
          || allowance !== ADMISSION_POLICY.allowanceMicroUsd
          || reserved < 0
          || reserved > allowance
          || remaining !== allowance - reserved
          || reserved % ADMISSION_POLICY.reservationMicroUsd !== 0) {
        throw new Error('Admission policy state invalid');
      }
      return res.status(200).json({
        ok: true,
        scope: 'PORTAL_GENERATION_ADMISSION_READ_ONLY',
        policy_id: row.policy_id,
        allowance_micro_usd: allowance,
        reserved_micro_usd: reserved,
        remaining_micro_usd: remaining,
        reservation_micro_usd: ADMISSION_POLICY.reservationMicroUsd,
        admitted_request_rows: admittedRows,
        request_reservation_sum_micro_usd: requestReservationSum,
        reservation_matches_request_rows: reserved === requestReservationSum,
        last_admitted_at: row.last_admitted_at,
        revision: process.env.VERCEL_GIT_COMMIT_SHA || null,
      });
    } catch {
      console.error(JSON.stringify({ level: 'error', message: 'admission_status_failed', route: '/api/health?route=admission' }));
      return res.status(503).json({ ok: false, error: 'Admission ledger unavailable' });
    }
  }
  if (route === 'identity-boundary') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }
    const boundary = await privateBoundaryStatus();
    const ok = boundary.database && boundary.auth_configured && boundary.schema && boundary.forced_rls && boundary.runtime_role;
    return res.status(ok ? 200 : 503).json({
      ok,
      scope: 'PORTAL_PRIVATE_IDENTITY_BOUNDARY_READ_ONLY',
      ...boundary,
      revision: process.env.VERCEL_GIT_COMMIT_SHA || null,
    });
  }
  if (route !== 'health') return res.status(404).json({ ok: false, error: 'Route not found' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const database = hasDatabase();
  const generation = Boolean(process.env.OPENAI_API_KEY);
  const revision = process.env.VERCEL_GIT_COMMIT_SHA || null;
  const relayConfigured = Boolean(process.env.PORTFOLIO_RELAY_TOKEN);
  if (!database) return res.status(503).json({ ok: false, database: false, archive: false, generation_configured: generation, portfolio_relay: false, schema_version: null, product_version: PRODUCT_VERSION, revision });
  try {
    const sql = db();
    const [artifacts, columns, participation, resultSchema, outboxStatus, trustRelayStatus] = await Promise.all([
      findArtifacts({ limit: 1 }),
      sql`select column_name from information_schema.columns where table_schema='public' and table_name='artifacts'`,
      sql`select to_regclass('public.artifact_verdicts') as verdicts`,
      sql`select to_regclass('public.experiment_results') as results`,
      // Optional integration probes must not change public Portal readiness.
      portfolioOutboxStatus().catch(() => ({
        configured: true, available: false, schema: null,
        counts: null, ready: null, oldest_ready_age_seconds: null,
      })),
      sql`select to_regclass('public.prime_trust_relay') as relay`
        .then(rows => ({ available: true, schema: Boolean(rows[0]?.relay) }))
        .catch(() => ({ available: false, schema: null })),
    ]);
    const availableColumns = new Set(columns.map(row => row.column_name));
    const evidenceSchema = ['evidence_level', 'sources', 'relationships', 'experiment', 'connections', 'lifecycle', 'current_phase', 'recurrence_conditions', 'realization_signal'].every(column => availableColumns.has(column));
    const publicParticipation = Boolean(participation[0]?.verdicts);
    const experimentResultSchema = Boolean(resultSchema[0]?.results);
    const authenticatedResultWriting = Boolean(process.env.PORTAL_RESULT_TOKEN);
    const archive = artifacts.length > 0;
    const ok = archive && generation && evidenceSchema && publicParticipation && experimentResultSchema && authenticatedResultWriting;
    return res.status(ok ? 200 : 503).json({
      ok,
      health_scope: 'public_portal',
      integrations: {
        stable_spine: { configured: Boolean(process.env.PORTAL_SPINE_TOKEN), end_to_end_verified: false },
        autonomy: { enabled: process.env.PORTAL_AUTONOMY_ENABLED === '1', credential_configured: Boolean(process.env.CRON_SECRET) },
        portfolio_schedule: { credential_configured: Boolean(process.env.CRON_SECRET || process.env.PORTFOLIO_OUTBOX_TOKEN) },
        private_reports: { publisher_status: 'not_checked_by_public_health' },
        encrypted_relay: { configured: Boolean(process.env.PRIME_TRUST_ABEX_RELAY_TOKEN && process.env.PRIME_TRUST_VELYQUA_RELAY_TOKEN && process.env.PRIME_TRUST_ABEX_RELAY_TOKEN !== process.env.PRIME_TRUST_VELYQUA_RELAY_TOKEN), end_to_end_verified: false }
      },
      database: true,
      archive,
      generation_configured: generation,
      evidence_schema: evidenceSchema,
      public_participation: publicParticipation,
      experiment_result_schema: experimentResultSchema,
      authenticated_result_writing: authenticatedResultWriting,
      portfolio_relay: relayConfigured,
      prime_trust_relay: {
        role_credentials_configured: Boolean(process.env.PRIME_TRUST_ABEX_RELAY_TOKEN
          && process.env.PRIME_TRUST_VELYQUA_RELAY_TOKEN
          && process.env.PRIME_TRUST_ABEX_RELAY_TOKEN !== process.env.PRIME_TRUST_VELYQUA_RELAY_TOKEN),
        ...trustRelayStatus,
      },
      portfolio_outbox_schema: outboxStatus.schema,
      portfolio_outbox: outboxStatus,
      living_observatory: true,
      ethereum_evidence_lab: { network: 'ethereum-sepolia', chain_id: '11155111', mode: 'read-only' },
      schema_version: evidenceSchema ? 6 : 5,
      product_version: PRODUCT_VERSION,
      experience: 'Continuous Futures Model',
      revision,
    });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'health_failed', route: '/api/health', error: String(error?.message || error) }));
    return res.status(500).json({ ok: false, database: true, archive: false, generation_configured: generation, portfolio_relay: relayConfigured, schema_version: null, product_version: PRODUCT_VERSION, revision });
  }
}
