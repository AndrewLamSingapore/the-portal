> Portfolio status: [STATUS.md](https://github.com/AndrewLamSingapore/orqevia/blob/main/STATUS.md) is the sole portfolio status reference. Each product owns its source, configuration, contracts and domain records. The [operational manifest](https://github.com/AndrewLamSingapore/orqevia/blob/main/governance/operational-manifest.json) provides dated ORQEVIA component and observation references; it does not establish deployment status.

# Changelog

## 7.4.0 — Benchmark expansion, live rooms and multilingual facilitation

- Expands the held-out retrieval benchmark to twenty queries with paraphrases,
  conceptual relationships and unrelated negatives, adds a BM25 baseline and
  reports contamination checks and per-metric standard deviation alongside
  lexical and hybrid results.
- Adds near-real-time room updates (polling refresh) so asynchronous discussion
  reflects new messages and facilitator output without a full page reload.
- Adds multilingual tokenization to the deterministic facilitator (Latin and
  CJK); the AI facilitator remains language-agnostic.

## 7.3.0 — AI discussion facilitator and shared living intelligence

- Adds a budget-gated AI discussion facilitator (`POST /api/rooms/facilitate`)
  that summarises a room, surfaces disagreements and cross-disciplinary
  connections, and proposes competing falsifiable hypotheses, with the
  deterministic facilitator as the free fallback.
- Adds `POST /api/rooms/promote` so an authenticated moderator can promote a
  room message into the shared evidence store, where it informs the next
  autonomous discovery cycle with provenance preserved.

## 7.2.0 — Public discovery rooms (group discovery)

- Adds public discovery rooms: anonymous, consent-gated discussion threads and
  replies around questions and topics, with a deterministic AI facilitator that
  surfaces shared concepts, open questions, likely disagreements and unsupported
  claims. Popularity is never treated as truth.
- Adds `POST /api/rooms`, `GET /api/rooms`, `POST /api/rooms/messages` and
  authenticated `POST /api/rooms/moderate`, plus a new `/discover-together`
  page linked from the homepage.

## 7.1.0 — Consent-based collective discovery

- Adds anonymous, consent-gated, moderated public contributions
  (`POST /api/contribute`): hypotheses, challenges and experiment proposals.
  Nothing is retained or published without explicit visitor consent, no
  identity or IP address is stored, and submissions enter a moderation queue.
- Adds `GET /api/contribute` for the published contribution feed and
  `POST /api/contribute/moderate` for authenticated moderation. The Observatory
  participation centre now renders real published contributions.

## 7.0.0 — Collective Evolutionary Intelligence foundations

- Corrects extinction semantics: a hypothesis omitted from a new generation is
  no longer treated as falsified. Only evidence-contradicted hypotheses become
  fossils, each carrying an explicit `rejection_reason`; the rest remain dormant
  in intellectual memory for reconsideration.
- Adds type-safe job claiming so a scheduled deterministic cycle and a
  model-originated cycle can never claim each other's work.
- Settles post-provider failures conservatively: a failed model call no longer
  releases its reservation, so billable failed requests cannot be under-counted.
- Adds a per-client AI Discovery Studio usage limit with the deterministic
  fallback retained.
- Adds a longitudinal evaluation section comparing recorded generations
  (falsifiability coverage, confidence range, dormancy and revision counts) as
  structural measures, not proof of accuracy.

## 6.14.0 — Provider-usage reconciliation and budget concurrency test

- Model runs and AI discovery now record the provider's actual token usage
  (input and output tokens) in the ledger and public run feed, alongside the
  conservative reservation. Cost remains an upper-bound reservation until a
  provider rate is configured.
- Adds a disposable-PostgreSQL concurrency test that fires twenty parallel
  budget admissions and proves the atomic cap cannot be exceeded, plus a
  failed-reservation release and retry.

## 6.13.0 — Evidence-driven revision, rebirth and AI Discovery Studio

- Adds authorized evidence ingestion (`POST /api/engine/evidence`) with source
  provenance, content-hash deduplication, relevance assessment and explicit
  support/contradiction relations.
- Feeds pending evidence into the next model cycle as observations, contests
  hypotheses that are contradicted, and revives a fossil when new evidence
  supports it (controlled rebirth with REBIRTH ancestry).
- Adds an optional AI-powered Discovery Studio mode (`mode: ai`) gated by the
  living model budget with the deterministic scaffolding as the free fallback.

## 6.12.0 — Persistent cumulative model evolution and real semantic benchmark

- The model-originated living engine is now persistent and cumulative: each
  cycle loads the previous run's hypothesis population and fossil record, passes
  it back as intellectual memory, increments the generation, and carries forward
  extinct hypotheses as fossils with lineage. Contradiction tracking remains
  explicitly empty until evidence-grounded detection lands.
- The comparative benchmark now measures real embedding-based retrieval when
  `PORTAL_BENCHMARK_SEMANTIC=1`, reporting semantic mode, status and per-query
  cost alongside lexical versus hybrid precision, recall and NDCG.
- Discovery-quality scores are labelled structural checks over recorded outputs
  rather than proof of originality or scientific accuracy, and now report the
  recorded generation number and revision count.

## 6.11.0 — Owner-approved model-originated living runs and benchmark hardening

- Activates paid model-originated living runs under the owner-approved living
  model budget: US$1/day and US$30/month with a US$0.10 per-run reservation.
  Admission is atomic before any provider call; failed reservations are released
  and the budget suspends automatically on exhaustion.
- The hourly engine tick now runs a model-originated cycle when
  `PORTAL_LIVING_MODEL_ENABLED=1`, subject to available budget, otherwise the
  deterministic cycle. Model runs are persisted as `MODEL_CYCLE` jobs and their
  hypotheses, synthesis, next question and recorded expenditure are public.
- Hardens the benchmark dataset: more nodes, paraphrases, conceptual queries and
  unrelated negatives (dataset v1.1.0).

## 6.10.0 — Comparative intelligence benchmark and living model budget

- Adds the internal, reproducible comparative intelligence benchmark: a
  held-out retrieval set with annotated relevance, a scoring rubric, and
  deterministic discovery-quality metrics (novelty, falsifiability, evidence
  quality, self-correction and evolutionary improvement).
- Exposes `GET /api/benchmark` and wires the results into the Observatory
  benchmark centre. Independent validation is marked pending and limitations are
  published; no superiority claim is made.
- Adds hard, persistent spend enforcement for paid model-originated runs:
  `living_model_budget` and `living_model_ledger`, with owner-proposed defaults
  of US$1/day and US$30/month, atomic admission before any model request,
  automatic suspension on exhaustion, no automatic increases and release of
  failed reservations. The model-originated run path (`POST /api/engine/model-run`)
  is inactive until the owner enables it and approves spend.
- Adds `GET /api/engine/budget` for public budget status, and makes manual engine
  runs always executable (unique idempotency keys) while scheduled ticks remain
  hourly-deduplicated.

## 6.9.0 — Open Intelligence Observatory

- Adds a public transparency centre at `/observatory` backed by `GET
  /api/observatory`: live run activity, the living knowledge graph, a hypothesis
  arena, an open experiment laboratory, an intellectual fossil record, an
  evidence audit centre, an open source centre and a public participation
  centre.
- The observatory is composed from recorded engine runs, the live graph and
  recorded experiment results. Nothing is fabricated: the benchmark centre is
  labelled `PENDING_INDEPENDENT_VALIDATION` and empty sections are shown as
  empty rather than simulated.
- The deterministic engine now records its full hypothesis population and fossil
  record with each run, so the arena and fossil record reflect actual recorded
  state. Adds `lib/observatory.js`, `observatory.html/js/css` and
  `tests/observatory.test.js`.

## 6.8.0 — Living Engine durable foundation

- Adds a durable, governed execution layer for the deterministic discovery
  cycle: a persisted job queue with idempotency keys, time-bounded worker leases
  (crashed leases are reclaimable), checkpointing, retry/attempt tracking and an
  append-only audit trail.
- Adds a database-backed kill switch that survives process restarts, plus
  authenticated admin controls (`POST /api/engine/run`, `POST /api/engine/kill`)
  using the server-side `PORTAL_ENGINE_TOKEN`, a daily Vercel Cron
  (`/api/engine/tick`) gated by `PORTAL_LIVING_ENGINE_ENABLED=1` and `CRON_SECRET`,
  and an hourly GitHub Actions trigger for the same authenticated endpoint.
- Adds a public, sanitised run feed (`GET /api/engine/runs`). Runs are always
  labelled `DETERMINISTIC_FALLBACK` with zero model calls and all safety flags
  false; no lease owner, payload or internal detail is exposed.
- Adds `lib/living-engine.js`, `tests/living-engine.test.js`, the
  `living_jobs` / `living_audit` / `living_engine_state` schema and a migration.
  The new routes ride the `/api/meta` dispatcher so the deployment stays within
  the Hobby function ceiling.

## 6.7.0 — Discovery Studio follow-up and private saving

- Adds conversational follow-up to the Discovery Studio. A bounded, stateless
  follow-up context (seed, turn and up to six prior hypotheses) can be sent to
  `POST /api/discover`; each new turn carries its lineage and marks its ancestry
  with the deterministic `MUTATION` operator. No language model is called.
- Adds explicit-consent, browser-private saving. The visitor opts in with
  "Save this discovery"; the briefing (including their edited hypotheses) is
  stored only in their browser and can be reopened or deleted. Nothing is
  published or sent to the server.
- The journey now behaves as a real session: Encounter → Connect → Explore →
  Hypothesize → Challenge → Experiment → Evolve, then continue, save or start
  fresh.

## 6.6.0 — Discovery Studio public entry

- Adds a free-text "Enter The Portal — Begin Your Discovery" entry on the
  homepage with example prompts and a Surprise Me action, leading into a
  seven-stage guided journey (Encounter, Connect, Explore, Hypothesize,
  Challenge, Experiment, Evolve).
- Adds `POST /api/discover`, which composes the existing hybrid semantic graph
  search with clearly labelled deterministic hypothesis and experiment scaffolds.
  No language model is called and nothing is persisted without the visitor's
  explicit consent.
- The response reports its live retrieval mode (`persistent_embedding_rerank`
  or a disclosed `lexical_fallback`), so lexical matching is never presented as
  semantic intelligence and degraded operation is explicit in both API and UI.
- Adds `lib/discovery-studio.js`, `discovery.js`, `discovery.css` and
  `tests/discovery-studio.test.js`. The endpoint rides the consolidated
  `/api/meta` dispatcher so the deployment stays within the Hobby function
  ceiling.

## Unreleased - Private PRIME report ingestion

- Fixes a private read defect found during the 23 September 2026 production
  acceptance: a report id carrying PostgREST filter syntax (for example `1 OR
  1=1`) was forwarded to the query, rejected by PostgREST and surfaced as a 503
  availability failure. An id that cannot exist is now a 400 `invalid_report_id`
  that never reaches the database, and a rejected query is mapped to a client
  error rather than an outage.
- Adds the missing producer path for the private PRIME domain. The read surface
  existed but nothing in any repository could write `prime_reports`, so `/reports`
  could only ever say "No reports are visible to this identity yet". `POST
  /api/prime/publish` now accepts one immutable report from an authorised machine
  producer, and `scripts/publish-prime-report.mjs` is the fail-closed client.
- Stores only the SHA-256 digest of each producer credential (new
  `public.prime_publishers`, RLS forced, no client policies). The credential itself
  never reaches the database, the repository, a log or a browser.
- Ingestion is one `SECURITY DEFINER` function with a fixed search path that checks
  the digest, validates the payload and inserts at most once per report id; a
  repeated id never rewrites a stored report.
- Removes the unused default write grants on the private tables from `anon` and
  `authenticated`, so write refusal is defence in depth rather than RLS alone.
- Adds `scripts/prime-publish-contract.mjs` (12 checks: credential before method,
  credential before payload, digest-only forwarding, malformed payload refused
  before any insert, insert-once, owner-only rows stay owner-only, private
  no-store/noindex headers) and `tests/prime-reports.test.js`, and runs both in CI.

## Unreleased - PRIME password recovery submit

- Adds `scripts/prime-authorization-contract.mjs` (`npm run prime:authorization`): 12 server-side checks that
  authentication is decided before authorization, before parameters and before any report is read; that only the
  publishable key and the caller's own token are ever forwarded; that a MEMBER cannot read OWNER-only rows and an
  IDOR probe is a 404; that an unmapped identity is refused before any report query; and that every private
  response is `private, no-store`, `Vary: Authorization` and `noindex`.
- Adds a method guard to the private read routes: an authenticated non-GET is now 405 rather than silently
  serving a read, while an anonymous caller still gets 401 so a wrong verb never reveals a wrong credential.
- Extends the browser suite to session restore, refresh failure, sign out with reload and back-button denial,
  recovery replay, double-tap concurrency, private-data flash prevention, browser persistence and service-worker
  absence, private cache/noindex headers, and both viewports.

- Fixes "Save password and continue" appearing to do nothing on a fresh recovery link. The deployment's
  Content Security Policy said `connect-src 'self'`, so the browser refused the Supabase Auth request, the
  rejected promise had nowhere to report itself and the page never moved. The policy now allows this project's
  identity origin, and the page/CSP contract fails if a shipped client script ever fetches an origin the
  deployed policy blocks.
- Makes every recovery submit end in one of exactly two visible outcomes: continuation into private
  operations, or an actionable message for a mismatch, a too-short password, a rejected password, an expired
  or unusable link, an unreachable identity service, or an unexpected failure. A rejected update no longer
  clears the recovery session, and an expired one leaves no stale session behind.
- Binds Sign out per state instead of by a duplicated id, so the button in the signed-in state works, and
  hands a recovery session opened on `/reports` over to `/prime` instead of consuming the link and rendering
  nothing.
- Explains recovery material PRIME cannot consume - Supabase's PKCE-style `?code=` or `?error_description=` in
  the query string - and removes it from the address bar, instead of rendering an unexplained sign-in form.
- Adds `scripts/prime-recovery-submit.mjs`: 24 deterministic checks at 1280x900 and 390x844 that serve the
  repository with the headers the deployment actually sends and prove the two-outcome rule end to end.

## Unreleased — Three Worlds Atmosphere

- Reframes the three primary doorways as distinct worlds: The Tribunal, The Constellation and The Cabinet.
- Adds world-reactive light, threshold motion, peripheral field markings and a restrained exhibition vignette without changing the evidence model or core flows.
- Keeps the Living Observatory visible as a deeper threshold beyond the three homepage worlds.
- Preserves keyboard operation, reduced-motion behavior, mobile layout and every existing Portal capability.

## 6.3.1 — Scientific Acceptance

- Makes a declared prospective falsifier kill its hypothesis instead of merely reducing confidence.
- Requires evidence comparison whenever more than one hypothesis is under consideration and verifies at least three bounded green tools.
- Adds an observation-only model-origin audit with no inherited hypotheses, fossils, memory or seed statements.
- Persists clean-room acceptance evidence and replay-verifies it before production may report the novelty gates as passed.
- Pins Vercel Functions to Node.js 22 to remove the Node.js 24 `url.parse()` runtime deprecation emitted by the current Neon driver.

## 6.3.0 — Living Observatory

- Promotes the bounded Living Observatory to the production experience.
- Adds evidence-selected evolutionary generations, explicit ancestry, falsifiers, hard-kill inheritance, fossil memory, surprise branches and controlled rebirth.
- Adds a decisive experiment report that refuses to label deterministic fallback as proof of independent intelligence.
- Adds a non-persistent production evidence probe and keeps model-originated clean-room execution preview-only.
- Preserves real-world actuation, production organism-state writes, source mutation and deployment mutation as blocked capabilities.

## 6.2.0 — The Future on Trial

- Replaces the ambiguous single entrance with three clear public doorways: trial, graph and encounter.
- Adds a daily, deterministic “Future on Trial” ritual that asks visitors to judge before seeing the room.
- Persists only anonymous aggregate verdict counters—failed, too early or arrived quietly—with no voter identity or public profile.
- Reveals the public distribution, leading and minority readings only after a visitor votes.
- Adds evidence inspection, native sharing with clipboard fallback, deep links and onward traversal into a connected case.
- Adds database, API, privacy, accessibility and deployment contracts for the complete participation loop.

## 6.1.0 — Archive Awakening

- Turns the hero into a layered portal aperture with pointer-responsive depth and a cinematic first-load ignition.
- Stages graph edges and nodes as a constellation coming online, with an ambient scanning beam inside the graph.
- Adds tactile depth, moving highlights and magnetic response to archive cards, lenses, experiments and evolution events.
- Connects motion to intent: entering the graph, maximizing serendipity and generating an encounter now produce distinct visual states.
- Preserves progressive enhancement, hidden-tab pausing, touch performance and the full reduced-motion fallback.

## 6.0.0 — Continuous Futures Model

- Makes emergence, disappearance, return, failure, partial realization and realization first-class lifecycle phases.
- Adds evidence-bounded lifecycle events, recurrence conditions and observable realization signals to every generated artifact.
- Derives archive-wide transitions, phase counts, recurring conditions and a realization watchlist deterministically.
- Adds an interactive continuous-model surface and artifact-level future timelines.
- Preserves AI-generated hypotheses as hypotheses until a separate source-supported verification process upgrades them.

## 5.2.0 — Portal Sonic Identity

- Adds an original 8.4-second stereo theme built around a rising, glass-like discovery motif and warm resolved harmony.
- Introduces a persistent, accessible `SOUND · OFF/ON` control with sound off by default.
- Previews the theme only after explicit activation and replays it when the visitor enters the graph.
- Adds restrained fade-in/fade-out behavior, hidden-tab pausing and mobile autoplay-policy compatibility.
- Serves the versioned audio asset with immutable caching and an explicit self-only media security policy.
- Adds an executable sound integration contract to release verification.

## 5.1.0 — Kinetic Living System

- Adds an ambient constellation field and a slowly breathing portal halo.
- Introduces staged hero, section, card, graph-node and connection motion.
- Gives primary actions a restrained automatic light sweep and stronger tactile response.
- Pauses ambient work in hidden tabs and honors the system reduced-motion preference.
- Keeps the motion layer dependency-free, progressively enhanced and isolated from core graph behavior.

## 4.1.0 — Living Graph release

- Restores AI encounter creation to the primary Living Graph experience.
- Adds a browser-private cabinet, constellation filtering, serendipity traversal and evidence-rich artifact details.
- Restores keyboard focus, live-region, dialog, reduced-motion and responsive behavior.
- Consolidates metadata routes so the complete API remains within the 12-function Vercel Hobby deployment limit.
- Makes health and readiness verify the deployed evidence schema instead of reporting a hard-coded version.
- Aligns production smoke tests with the actual homepage and verifies the exact deployed Git revision.
- Extends the bounded generation window to 45 seconds and preserves local fallback when shared persistence fails.

## 4.0.0 — Evidence & Ancestry

- Evidence states distinguish AI curation, conceptual inference and curator-verified material.
- Source trails are persisted; generation is forbidden from inventing citations.
- Curator-only verification endpoint can promote sourced artifacts to verified status.
- Temporal graph and conceptual echo edges expose ideas across decades.
- Artifact relationship traversal adds PRECEDED_BY and ECHOED_BY semantics.
- Serendipity endpoint selects high-distance discoveries instead of similarity ranking.
- Curated exhibition system launches with two authored lenses.
- Primary museum interface explains the experiment within the first screen.
- Mobile and keyboard focus behavior are first-class; reduced-motion preferences are honored.
- V2 contract tests, production smoke tests and scheduled production monitoring are included.
- Runtime is domain-ready; domain purchase remains an owner branding decision.
