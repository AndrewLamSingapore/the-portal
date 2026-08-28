# Portal 6.3 — First Implementation Plan

## PR 1: evolutionary substrate and contracts

Goal: establish reviewable foundations without changing production behavior.

### Deliverables
- Living Intelligence master blueprint.
- Living hypothesis genome JSON Schema.
- Deterministic in-memory ECE primitives: dominance/Pareto frontier, diversity preservation, confidence update and lifecycle transition guards.
- Seeded sandbox fixture with hidden relationships and later contradictions.
- Contract tests proving ancestry/falsifier requirements and contradiction-driven weakening/death.
- Feature flag boundary (`PORTAL_LIVING_SANDBOX`) default-off.
- No production DB migration and no autonomous source/deployment mutation.

### Phase 2
Introduce durable sandbox persistence as additive tables only: `living_hypotheses`, `living_evidence`, `living_lineage`, `living_observations`, `living_runs`, `living_tool_events`. Production archive remains authoritative for v6.2 artifacts.

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
2. Existing v6.2 API contracts remain unchanged unless explicitly versioned.
3. Main is untouched until review/merge approval.
4. Sandbox is deterministic under a fixed seed.
5. Contradictory evidence can lower confidence and trigger a valid DEAD transition.
6. No DEAD hypothesis can silently return to LIVING; rebirth requires a recorded REBORN event and new evidence.
7. Speculative/unknown-law candidates cannot be surfaced as observed/source-supported without an explicit evidence transition.
8. Tool execution is bounded and auditable.
9. Evolution cannot mutate credentials, permissions, deployment config, production data or source code.
10. A later unattended benchmark must demonstrate novel, defensible, falsifiable discovery rather than merely fluent output.

## Deployment strategy
Push only `portal-6.3-living`. Use Vercel's Git preview deployment for the branch/PR. Validate preview and CI before any consideration of production promotion. Never deploy this PR directly to production and never merge automatically.
