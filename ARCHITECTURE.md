# The Portal — V3 Architecture

## Product invariant

The Portal is not a feed. No popularity ranking, engagement optimisation or behavioural profile selects artifacts.

## System layers

1. **Experience** — archive-first browser UI, curator modes, private cabinet and concept traversal.
2. **Curator** — server-side structured AI generation with explicit outcome classification and conceptual lineage.
3. **Archive** — stable artifact identifiers, normalized records, provenance and timestamps.
4. **Graph** — artifacts connect through concepts, eras, outcomes and conceptual descendants.
5. **Persistence** — local/private cabinet always works; Postgres enables the durable shared archive.
6. **Safety & economics** — server-only credentials, request throttling, bounded upstream calls, restrictive browser headers and explicit scaling gates.

## Request flow

```text
Browser
  │
  ├── POST /api/artifact ──> OpenAI Responses API
  │                           │
  │                           └── strict JSON schema
  │                                  │
  │                                  ▼
  │                         canonical artifact
  │                                  │
  │                    ┌─────────────┴─────────────┐
  │                    │                           │
  │              local cabinet              Postgres archive
  │                                          (when configured)
  │
  └── GET /api/archive ──> retrieval / concept traversal / observatory
```

## Canonical artifact

A canonical artifact contains `id`, `era`, `year`, `type`, `title`, `description`, `provenance`, `condition`, `imagined_future`, `problem`, `status`, `modern_descendant`, `concepts[]`, `question`, `mode`, `created_at` and `schema_version`.

### Identity

IDs use `PTL-<year>-<fingerprint>`. The server owns canonical identity. The fingerprint is deterministic from normalized year, title, description and imagined-future content, so identical generated records converge on the same identifier.

## Persistence tiers

### Tier A — local/private

Works without a database:

- server-generated canonical IDs
- private browser cabinet
- no additional persistence secret
- generated artifacts remain useful to the visitor even when shared persistence is unavailable

### Tier B — durable shared archive

When `DATABASE_URL` is present:

- generated canonical artifacts are inserted into Postgres
- `GET /api/archive?id=...` retrieves a canonical artifact and related conceptual traces
- `GET /api/archive?concept=...` traverses a concept
- `GET /api/archive?status=...` filters outcomes
- the archive endpoint returns collection-level constellation, status, era and date-range summaries
- `/api/health` verifies database/archive availability

The browser experience degrades to the local tier rather than making database availability a prerequisite for generation.

## Database schema

The executable schema is [`schema.sql`](schema.sql). Core indexes cover year, status and GIN lookup over the JSONB concept array.

## API contract

### `POST /api/artifact`

Generates one schema-valid artifact. Returns the canonical artifact plus a `persistence` state:

- `shared` — persisted to the shared archive
- `local` — database not configured
- `local-fallback` — generation succeeded but persistence failed

The route is POST-only, bounded by a 25-second upstream timeout and protected by a lightweight per-instance request limiter.

### `GET /api/archive`

Supported queries:

- `?id=<artifact-id>` — one artifact plus related artifacts
- `?concept=<concept>` — recent artifacts sharing a concept
- `?status=<status>` — recent artifacts sharing an outcome state
- `?limit=<n>` — bounded collection size

### `GET /api/health`

Reports whether durable archive infrastructure is configured and queryable. A missing database intentionally returns an unavailable state rather than pretending shared persistence exists.

## Security boundary

- `OPENAI_API_KEY` and `DATABASE_URL` remain server-side.
- Generation is POST-only.
- Generated responses are `no-store`.
- `vercel.json` applies CSP, anti-framing, content-type, referrer and permissions policies.
- The current in-memory limiter is explicitly not a durable distributed abuse-control layer.

See [`SECURITY.md`](SECURITY.md) for the operational security policy.

## Quality gate

`npm run verify` performs syntax validation over all server/API modules. GitHub Actions runs this verification on pushes and pull requests to `main`.

## Next infrastructure gate

Before materially increasing public traffic:

1. use durable distributed rate limiting rather than instance-local memory;
2. configure an account-level OpenAI spend ceiling;
3. add representative API contract tests around generation, persistence fallback and archive retrieval;
4. keep database and model credentials in protected deployment environment variables only.
