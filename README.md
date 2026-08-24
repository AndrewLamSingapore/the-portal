# The Portal

## An archive of strange things that imagined the future before it arrived.

The Portal is an AI-assisted discovery experiment about **forgotten futures**: inventions, proposals, systems, artworks and ideas that anticipated something recognisable in the world that followed.

It is deliberately **not a feed**. No popularity ranking, trending page, engagement optimisation or behavioural recommendation profile. Each discovery becomes a structured artifact with provenance, concepts, an outcome and an unresolved question.

**Evidence level: E2 — working software prototype.**

## The experiment

Most discovery systems optimise for what is popular now. The Portal asks:

> **What becomes visible when discovery is organised around conceptual ancestry instead of engagement?**

The Portal is software for exploring those connections. It is **not a historical authority**: AI-generated curation is a discovery surface, and factual historical claims require independent source verification.

## How it works

```text
Visitor requests a discovery
        ↓
POST /api/artifact
        ↓
Server-side OpenAI Responses API
        ↓
Strict structured-output validation
        ↓
Deterministic canonical artifact ID
        ↓
        ├── private browser cabinet
        └── shared Postgres archive when configured
```

Canonical IDs look like `PTL-1964-A19F02C9E1`. Each artifact is graph-ready and can carry era/year, object type, imagined future, problem addressed, outcome, modern conceptual descendant, concepts, provenance, condition and an unresolved question.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the complete system contract.

## Design principles

- **Discovery without behavioural capture.** No behavioural recommendation profile is required.
- **Structure before scale.** Artifacts are graph/archive-ready rather than disposable generated text.
- **Provenance over false certainty.** Fluent model output does not become historical fact merely because it sounds confident.
- **AI calls should have a reason.** Ordinary page loads and saved local discoveries require no generation call.
- **Graceful infrastructure tiers.** Generation/private cabinet remain useful without Postgres; `DATABASE_URL` enables the durable shared archive.

## Security and cost boundaries

- `OPENAI_API_KEY` and `DATABASE_URL` remain server-side.
- Generation is POST-only and uses strict Structured Outputs.
- Per-instance throttling and HTTP 429 handling are implemented.
- Upstream generation has a 25-second timeout and responses use `no-store`.
- Browser security headers and CSP are restrictive.
- Ordinary page loads make no AI generation call.
- Production smoke verification never calls the generation endpoint, so scheduled health checks do not consume model output.

Before materially increasing public traffic, use durable distributed rate limiting and an account-level model-spend ceiling. See [`SECURITY.md`](SECURITY.md).

## Persistence

| Tier | Behaviour | Requirement |
|---|---|---|
| **Local/private** | Canonical server IDs + private browser cabinet | `OPENAI_API_KEY` |
| **Shared archive** | Durable Postgres persistence, retrieval and concept traversal | `OPENAI_API_KEY` + `DATABASE_URL` |

The executable database contract is [`schema.sql`](schema.sql).

## Quality and production verification

```bash
npm run verify
npm run smoke:production
```

`verify` syntax-checks the server/API and production-smoke modules without secrets or external services.

`smoke:production` verifies the live public system end-to-end without generating a new AI artifact: homepage availability, database/archive health, AI-generation configuration, non-empty Shared Stacks, canonical artifact IDs and retrieval of a known persisted artifact.

GitHub Actions runs static verification on pushes and pull requests to `main`. Production smoke verification runs after pushes to `main`, can be launched manually, and also runs daily as an independent production-health check. No application secrets are required by the smoke job.

## Portfolio role

The Portal is an experimental **BUILD** project inside [Andrew Lam's operations-intelligence portfolio](https://github.com/AndrewLamSingapore).

Where [Open Aqua](https://github.com/AndrewLamSingapore/open-aqua) explores intelligence around a physical living system, The Portal explores intelligence around a cultural information system. Both ask:

> **Can better structure reveal relationships that ordinary observation misses?**

## Deploy

Copy `.env.example` for the runtime-variable contract. The Vercel project requires `OPENAI_API_KEY` in protected Production and Preview environment variables. `DATABASE_URL` enables the shared archive. Credentials must never be committed.

Git integration deploys pushes to `main` automatically. The production smoke workflow provides an independent verification layer after deployment.
