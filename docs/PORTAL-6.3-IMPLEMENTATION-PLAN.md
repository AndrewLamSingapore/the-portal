# Portal 6.3 — Production Implementation Plan

## Production release state

Portal 6.3 is approved for production promotion. The Living Observatory is a bounded public surface; real-world actuation, autonomous source/deployment mutation and production organism-state writes remain blocked.

### Deliverables
- Living Intelligence master blueprint.
- Living hypothesis genome JSON Schema.
- Deterministic in-memory ECE primitives: dominance/Pareto frontier, diversity preservation, confidence update and lifecycle transition guards.
- Seeded sandbox fixture with hidden relationships and later contradictions.
- Contract tests proving ancestry/falsifier requirements and contradiction-driven weakening/death.
- Production Living Observatory plus an optional feature flag for non-Vercel environments.
- No production DB migration and no autonomous source/deployment mutation.

### Phase 2
Introduce durable sandbox persistence as additive tables only: `living_runs`, `living_events` and `living_fossils`. The production artifact archive remains authoritative for versioned artifacts.

### Phase 3
Add tool registry/execution envelopes with budgets, permissions, provenance and result verification. Tool results become evidence records, never unlabelled facts.

### Phase 4
Add layered memory with explicit consolidation/decay and retrieval provenance. Measure whether remembered information improves held-out tasks rather than merely increasing recall.

### Phase 5
Add evolutionary niches and co-evolving critics. Preserve a Pareto frontier and novelty archive; prevent one reward scalar from collapsing diversity.

### Phase 6
Expose a sandbox Observatory UI: living hypotheses, ancestry graph, confidence history, falsifiers, predictions, evidence polarity, deaths/rebirths and tool traces.

## Acceptance gates
1. `npm run verify` remains green.
2. Existing artifact/archive API contracts remain unchanged unless explicitly versioned.
3. The exact reconciled head must pass review and release verification before promotion.
4. Sandbox is deterministic under a fixed seed.
5. Contradictory evidence can lower confidence and trigger a valid DEAD transition.
6. No DEAD hypothesis can silently return to LIVING; rebirth requires a recorded REBORN event and new evidence.
7. Speculative/unknown-law candidates cannot be surfaced as observed/source-supported without an explicit evidence transition.
8. Tool execution is bounded and auditable.
9. Evolution cannot mutate credentials, permissions, deployment config, production data or source code.
10. A later unattended benchmark must demonstrate novel, defensible, falsifiable discovery rather than merely fluent output.

## Deployment strategy
Validate the reconciled Portal 6.3 head in preview and CI, merge only that exact green head, allow the Git-linked production deployment, and run the exact-revision production smoke gate. Keep clean-room model origination preview-only and keep the production Observatory read-only.
