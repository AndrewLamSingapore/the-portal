# The Portal — 6.2 Architecture

Version 6 makes imagined-future lifecycles executable. A single generation creates an artifact, a testable experiment, optional typed links, and an evidence-bounded timeline showing how a future emerged, disappeared, returned, failed, partially materialized, or became real.

> The Portal is a continuously evolving model of humanity's imagined futures—tracking how ideas emerge, disappear, return, fail and become real.

## Product invariant

The Portal is not a feed. No popularity ranking, engagement optimisation or behavioural profile selects artifacts.

## System layers

1. **Experience** — archive-first browser UI, anonymous public trials, curator modes, private cabinet and concept traversal.
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
  ├── GET /api/archive ──> retrieval / concept traversal / observatory
  │
  └── GET/POST /api/trial ──> aggregate public verdict counters
```

## Canonical artifact

A canonical artifact also carries `lifecycle[]`, `current_phase`, `recurrence_conditions[]`, and `realization_signal`. Each lifecycle event includes a phase, year, description and explicit evidence basis.

## Continuous futures model

The archive deterministically derives four views from canonical artifacts:

- phase counts across `EMERGED`, `DISAPPEARED`, `RETURNED`, `FAILED`, `PARTIALLY_REALIZED` and `REALIZED`;
- chronological transitions, including the previous and next phase;
- recurring conditions that may explain why futures return;
- a realization watchlist whose claims can be checked against observable signals.

The derived model never silently upgrades an inference. An event remains `AI-GENERATED-HYPOTHESIS` until a separate evidence workflow can mark it `SOURCE-SUPPORTED`.

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
- `GET /api/trial?id=...` returns three aggregate verdict counters
- `POST /api/trial` atomically increments one permitted verdict

The browser experience degrades to the local tier rather than making database availability a prerequisite for generation.

### Anonymous public participation

`artifact_verdicts` stores one aggregate counter per artifact and verdict. It does not store visitor IDs, accounts, comments, IP addresses or fingerprints. The browser privately remembers that it voted, reveals the room only after that vote and uses the record to prevent casual repeat submissions. This is deliberately lightweight participation, not identity-grade election integrity.

## Database schema

The executable schema is [`schema.sql`](schema.sql). Core indexes cover year, status and GIN lookup over the JSONB concept array.

## API contract

### `POST /api/artifact`

Generates one schema-valid artifact. Returns the canonical artifact plus a `persistence` state:

- `shared` — persisted to the shared archive
- `local` — database not configured
- `local-fallback` — generation succeeded but persistence failed

The route is POST-only, bounded by a 45-second upstream timeout and protected by a lightweight per-instance request limiter.

### `GET /api/archive`

Supported queries:

- `?id=<artifact-id>` — one artifact plus related artifacts
- `?concept=<concept>` — recent artifacts sharing a concept
- `?status=<status>` — recent artifacts sharing an outcome state
- `?limit=<n>` — bounded collection size

### `GET /api/health`

Reports whether durable archive infrastructure is configured and queryable. A missing database intentionally returns an unavailable state rather than pretending shared persistence exists.

### `GET /api/trial` and `POST /api/trial`

`GET ?id=<artifact-id>` returns aggregate counts for `FAILED`, `TOO_EARLY` and `ARRIVED_QUIETLY`. `POST` accepts one canonical `artifact_id` and one permitted `verdict`, validates that the artifact exists, and increments the corresponding counter atomically. The route is `no-store` and applies a lightweight per-instance abuse ceiling without persisting network identifiers.

## Security boundary

- `OPENAI_API_KEY` and `DATABASE_URL` remain server-side.
- Generation is POST-only.
- Generated responses are `no-store`.
- `vercel.json` applies CSP, anti-framing, content-type, referrer and permissions policies.
- The current in-memory limiter is explicitly not a durable distributed abuse-control layer.

See [`SECURITY.md`](SECURITY.md) for the operational security policy.

## Quality gate

`npm run verify` performs syntax validation over all server/API modules. GitHub Actions runs this verification on pushes and pull requests to `main`.

Metadata, status and curator-verification routes are dispatched through one consolidated function while their public URLs remain stable through Vercel rewrites. This keeps the deployment below the Hobby plan's 12-function ceiling without shrinking the API.

## Next infrastructure gate

Before materially increasing public traffic:

1. use durable distributed rate limiting rather than instance-local memory;
2. configure an account-level OpenAI spend ceiling;
3. add representative API contract tests around generation, persistence fallback and archive retrieval;
4. keep database and model credentials in protected deployment environment variables only.
