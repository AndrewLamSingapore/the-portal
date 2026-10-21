# Portal deployment configuration

The Portal owns its public archive, discovery graph and Evidence Lab. ORQEVIA is an optional integration; public use does not depend on it. Existing protocol identifiers containing `PRIME` remain compatibility identifiers, not current product names. Historical records remain intact.

## Search protections

Graph search accepts a single query of at most 256 characters and 1024 bytes, and an optional integer limit from 1 through 24. PostgreSQL atomically enforces 20 searches per client per minute and 100 globally per minute across function instances. Client addresses are hashed, never persisted raw. Admission failure returns 503 without invoking embeddings; exhausted budgets return 429 with Retry-After. Embedding requests abort after eight seconds and degrade to lexical search. Query embeddings are cached for an hour by model and hashed normalized query; node embeddings remain content-addressed. No raw queries are stored in the embedding cache.

## Optional pathways and schedules

The declared daily autonomy and portfolio outbox schedules are **inactive operational pathways** until their credentials and intended consumers are commissioned. They presently fail closed; their existence in vercel.json does not establish successful execution. Autonomy additionally requires PORTAL_AUTONOMY_ENABLED=1. Keep it disabled until an owner-authorized workflow and downstream delivery are tested. Set CRON_SECRET for authenticated Vercel Cron, or PORTFOLIO_OUTBOX_TOKEN for an independently scheduled outbox caller. Do not claim readiness from public health alone: its health_scope is public_portal and integrations describes optional configuration separately.

Stable Spine needs PORTAL_SPINE_TOKEN installed on both caller and Portal. The encrypted relay needs two distinct role credentials, one for ABEX consumption and one for VELYQUA production. VELYQUA remains parked. Missing credentials are not a reason to mint unconsumed keys. Both revoked private-report publishers must remain revoked. Commission a replacement only with the authorized producer runtime and verify an authenticated publication and authorized read; this cannot be completed from the Portal alone.

## Environment isolation

Production retains the existing Neon main database. Preview uses the separate portal-preview-isolated Neon branch, including database connection aliases. Shared production Neon Auth URLs are no longer exposed to Preview; Portal identity remains its existing Supabase integration. Existing deployments retain their deployment-time variables; redeploy previews before treating them as isolated. Never perform preview write tests against a deployment created before the isolation change.

The .env.example file lists application runtime variables. Values are server-only except the already-public Supabase URL and publishable key. Keep all secrets out of Git, logs and browser bundles.

## Account controls requiring administrative access

Require pull requests, one independent approval, successful verify/verify-v2/status checks, resolved conversations, and no force pushes or deletion on main. A policy document is not enforcement; verify the actual GitHub ruleset after applying it. The connected GitHub installation does not expose administration writes.

Enable Supabase leaked-password protection for password-based identity access using the owning Supabase project's Auth security settings, then verify the security advisor clears. Do not disable password access or unrelated project services to remove the warning. Public health does not inspect that Auth setting.

## Public health and optional integrations

GET /api/health observes existing schema; reading outbox status does not create
tables or indexes. Missing optional outbox or encrypted-relay schema is reported
without making the public Portal unavailable. An optional probe failure reports
available=false and schema=null (unknown); schema=false means the probe succeeded
and the table is absent. These fields do not claim integration delivery is verified.
Core archive, evidence schema, public participation, generation configuration and
authenticated result-writing gates continue to determine public health.
