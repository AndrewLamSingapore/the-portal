# The Portal — V3 Architecture

## Product invariant
The Portal is not a feed. No popularity ranking, engagement optimization, or behavioral profile selects artifacts.

## Layers
1. **Experience** — archive-first UI, curator modes, cabinet, concept traversal.
2. **Curator** — structured AI generation with explicit outcome classification and conceptual lineage.
3. **Archive** — stable artifact identifiers, normalized records, provenance and timestamps.
4. **Graph** — artifacts connect through concepts, eras, outcomes and descendants.
5. **Persistence** — durable Postgres is the production target; browser storage remains an offline/private cabinet only.
6. **Safety/economics** — server-only credentials, durable rate limiting, archive retrieval before generation, account spend limits.

## Canonical artifact
A canonical artifact has: `id`, `era`, `year`, `type`, `title`, `description`, `provenance`, `condition`, `imagined_future`, `problem`, `status`, `modern_descendant`, `concepts[]`, `question`, `mode`, `created_at`, and `schema_version`.

## Identity
IDs use `PTL-<year>-<fingerprint>`. The server, not the browser, owns canonical identity. Fingerprints are deterministic from normalized artifact content so identical generated records resolve to the same identity.

## Persistence rollout
The application supports two tiers:

- **Tier A (works with the current Vercel project):** canonical server IDs + local cabinet + deterministic graph traversal. No additional secret required.
- **Tier B (durable shared archive):** Neon Postgres through Vercel Marketplace. Set `DATABASE_URL`; the API then stores canonical artifacts and serves them by ID. Add Upstash Redis later for durable distributed rate limiting.

This separation keeps production working even when database provisioning is unavailable and avoids coupling the experience to infrastructure setup.

## Database schema target
```sql
create table artifacts (
  id text primary key,
  schema_version integer not null default 3,
  year integer not null,
  era text not null,
  type text not null,
  title text not null,
  description text not null,
  provenance text not null,
  condition integer not null check (condition between 1 and 5),
  imagined_future text not null,
  problem text not null,
  status text not null,
  modern_descendant text not null,
  question text not null,
  mode text not null,
  concepts jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index artifacts_year_idx on artifacts(year);
create index artifacts_status_idx on artifacts(status);
create index artifacts_concepts_gin on artifacts using gin(concepts);
```

## API contract
- `POST /api/artifact` — generate a canonical structured artifact. Returns stable `id`, `created_at`, `schema_version`.
- Future `GET /api/archive?id=...` — retrieve a durable artifact.
- Future `GET /api/archive?concept=...` — traverse the graph.

## Next infrastructure gate
Provision Neon from the Vercel Marketplace and expose `DATABASE_URL` to Production/Preview. This is the only external provisioning step required to turn Tier A into the shared permanent archive. Never commit credentials.
