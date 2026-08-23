# The Portal

An archive of strange things that imagined the future before it arrived.

## V3

The Portal is deliberately not a feed. It has no popularity ranking, engagement optimization, trending page, or behavioral recommendation profile.

The browser calls `/api/artifact`. A Vercel serverless curator calls the OpenAI Responses API, validates a strict schema, then assigns a deterministic canonical ID such as `PTL-1964-A19F02C9E1`. The browser keeps a private cabinet for revisiting discoveries without extra AI calls.

Each artifact carries graph-ready structure: era, year, object type, imagined future, problem, outcome status, modern conceptual descendant, concepts, provenance, condition and an unresolved question.

See `ARCHITECTURE.md` for the durable shared-archive design and database schema.

## Security and cost controls

- `OPENAI_API_KEY` remains server-side.
- POST-only generation endpoint.
- Strict Structured Outputs schema.
- Per-instance request throttling and HTTP 429 handling.
- 25-second upstream timeout.
- `no-store` generation responses.
- Restrictive browser security headers and CSP.
- No AI generation on ordinary page load.
- Local cabinet retrieval costs no model call.

The current in-memory throttle is intentionally lightweight because Vercel instances are ephemeral. For a public high-traffic release, use Upstash Redis for distributed rate limiting and an account-level OpenAI spend ceiling.

## Persistence tiers

**Current / zero-additional-infrastructure:** canonical server IDs plus a private browser cabinet.

**Permanent shared archive:** provision Neon Postgres from the Vercel Marketplace and expose `DATABASE_URL`. The target schema and rollout contract are in `ARCHITECTURE.md`.

## Deploy

The Vercel project must have `OPENAI_API_KEY` protected in Production and Preview. Never commit credentials. Git integration deploys pushes to `main` automatically.
