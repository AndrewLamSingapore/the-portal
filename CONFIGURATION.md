# Portal deployment configuration

The Portal owns its public archive, discovery graph and Evidence Lab. ORQEVIA is an optional integration; public use does not depend on it. Existing protocol identifiers containing `PRIME` remain compatibility identifiers, not current product names. Historical records remain intact.

## Living Engine

The Living Engine executes the deterministic discovery cycle through a durable,
leased, idempotent job queue with an append-only audit trail and a
database-backed kill switch. It is disabled by default and fails closed:

- `PORTAL_LIVING_ENGINE_ENABLED=1` enables it (requires `DATABASE_URL`).
- `POST /api/engine/run` and `POST /api/engine/kill` require the server-side
  `PORTAL_ENGINE_TOKEN`.
- `POST /api/engine/tick` is authorized by `CRON_SECRET` (daily Vercel Cron on
  the Hobby plan) or by the hourly GitHub Actions trigger using
  `PORTAL_ENGINE_TOKEN` as a repository secret.
- `GET /api/engine/runs` is public and sanitised; it never exposes lease owners,
  job payloads or operational detail.

Every run is `DETERMINISTIC_FALLBACK` with zero model calls, no external
actuation, no production source or deployment mutation, and no database writes
beyond the engine's own job and audit tables. Do not claim continuous autonomous
intelligence unless the cron is actually running and its recorded runs are
visible in the public feed.

`GET /api/observatory` is public and read-only. It surfaces recorded runs, the
hypothesis arena and the fossil record, and it marks the benchmark centre as
pending independent validation rather than inventing a score.

## Living model budget

Paid model-originated runs are disabled by default and fail closed.
`PORTAL_LIVING_MODEL_ENABLED=1` and an explicit owner spend approval are required
before they can run. When enabled, `living_model_budget` enforces owner-proposed
limits of US$1/day and US$30/month through a single atomic admission update:
concurrent requests and retries can never exceed the cap, failed reservations
are released, and the budget suspends automatically when exhausted with no
automatic increase. `POST /api/engine/model-run` reserves before any provider
call, and `GET /api/engine/budget` reports spend publicly.

As of 26 November 2026 the owner approved and activated these paid runs in
production with the defaults above. The hourly `/api/engine/tick` runs a
model-originated cycle when the budget allows, and suspends itself when the
limit is reached. Expenditure and hypotheses are published in the run feed and
the Observatory.

The model-originated cycle is cumulative: it reloads the previous run's
population and fossils, increments the generation, and preserves extinct
hypotheses in the fossil record. `PORTAL_BENCHMARK_SEMANTIC=1` enables real
embedding-based retrieval measurement in the benchmark (small, owner-approved
embedding cost).

Authorized evidence can be ingested through `POST /api/engine/evidence`
(`PORTAL_ENGINE_TOKEN`). Evidence is deduplicated by content hash, assessed for
relevance against the archive, and fed into the next model cycle; contradicting
evidence contests the target hypothesis and supporting evidence can revive a
fossil. The Discovery Studio accepts `mode: ai` when
`PORTAL_DISCOVERY_AI_ENABLED=1`, spending against the living model budget with a
deterministic fallback.

Hypothesis selection is evidence-grounded: omission from a new generation is not
falsification. Only explicitly contradicted hypotheses are fossilized with a
rejection reason; the rest remain dormant. A post-provider failure settles
conservatively (its reservation is retained), and AI discovery carries a
per-client usage limit.

Public collective discovery is anonymous and consent-gated: `POST /api/contribute`
retains nothing without explicit consent, stores no identity or address, and
queues every submission for moderation before it appears in the Observatory.
Public discovery rooms (`/discover-together`) add anonymous, consent-gated
discussion with a deterministic facilitator and authenticated moderation.
An optional AI facilitator is budget-gated behind `PORTAL_ROOM_AI_ENABLED=1`;
promoted room messages enter the shared evidence store for future cycles.
The retrieval benchmark now includes a BM25 baseline, contamination checks and
uncertainty, and discovery rooms refresh near-real-time. Full interface
localization remains a documented limitation; facilitators are multilingual.
Interface chrome (navigation, hero, discovery entry and forms) now ships a
language selector across the three primary pages; deep content stays English.

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

## Public artifact generation bounds

The complete serialized OpenAI Responses request is limited to 64 KiB in UTF-8, including instructions, public archive context, schema and settings. Accepted request bodies are unchanged. Oversized or malformed-Unicode context is rejected before any provider call or retry with a safe HTTP 503; the client displays that message. No truncation, model substitution or output-budget change occurs. The existing gpt-5.6-luna model, 6,000 output-token limit, maximum two attempts and shared 52-second deadline remain.

The local fixed-window guard still allows twelve admitted generation requests per client per hour. Address keys are fixed-length SHA-256 values; expired buckets are reclaimed on requests. Each function process holds at most 4,096 active buckets. A new address at capacity gets the existing HTTP 429 response; active client budgets are never evicted to admit new addresses. This guard is per-instance and resets on process restart. It is not a global distributed spend limit, authenticated identity, or guaranteed anonymity of low-entropy address hashes. The local map is an additional brake alongside the mandatory shared PostgreSQL credit/rate/lease guard described in [generation admission](docs/GENERATION_ADMISSION.md).


## Generation client identity and evidence display

The generation limiter uses the Vercel-overwritten x-vercel-forwarded-for ingress header on Vercel, and the socket remote address for standalone hosting. Generic x-forwarded-for/x-real-ip headers never select a client budget. Missing trusted identity shares a conservative fallback bucket. A separate reverse proxy must provide an explicitly reviewed trust boundary; spoofable forwarding headers are not an identity mechanism. The per-instance guard remains local, not a distributed spend budget.

Unsourced generated objects display a prominent speculative-reconstruction warning before their description, including older archived objects. The warning covers dates, object details and archival-sounding language without rewriting stored content. A record labelled historically verified with no valid HTTPS source trail displays UNVERIFIED RECORD and an incomplete-verification warning. Source links and labels remain evidence for review, not a guarantee of historical truth.

Public artifact generation uses the owner-approved US$10 total conservative reservation allowance, shared in Portal's own production Neon database. Admission is mandatory before provider transport and never automatically refills; Preview is disabled. See [generation admission](docs/GENERATION_ADMISSION.md) for exact limits, activation proof and recovery/rollback requirements.
