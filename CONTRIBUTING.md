# Contributing to The Portal

The Portal is an AI-assisted discovery experiment, not a historical authority.

## Invariants

- No popularity ranking, engagement optimisation or behavioural recommendation profile.
- AI-generated catalogue material must remain clearly distinguishable from verified historical evidence.
- `modern_descendant` describes conceptual resemblance, not direct historical causation.
- Server credentials stay server-side.
- Generation should be deliberate; ordinary browsing and saved-item retrieval should not require unnecessary model calls.

## Verification

```bash
npm run verify
```

This checks the server/API modules for JavaScript syntax errors. When changing the browser experience, also verify the relevant interaction manually.

## Persistence

The product must remain usable in its local/private tier when a shared database is not configured. Database-backed archive features should degrade clearly rather than inventing persistence.

## Pull requests

Explain the product invariant affected, the implementation change, how it was verified, and any cost, provenance or privacy consequence.
