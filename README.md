# The Portal

## An archive of strange things that imagined the future before it arrived.

The Portal is an AI-assisted discovery experiment about **forgotten futures**: inventions, proposals, systems, artworks and ideas that anticipated something recognisable in the world that followed.

It is deliberately **not a feed**.

No popularity ranking. No trending page. No engagement optimisation. No behavioural recommendation profile.

Instead, each discovery becomes a structured artifact with provenance, concepts, an outcome and an unresolved question.

**Evidence level: E2 — working software prototype.**

---

## The experiment

Most discovery systems optimise for what is popular now.

The Portal asks a different question:

> **What becomes visible when discovery is organised around conceptual ancestry instead of engagement?**

A historical object can be interesting not because it was famous, but because it contains an idea that later became ordinary.

The Portal is software for exploring those connections. It is **not a historical authority**: AI-generated curation is a discovery surface, and factual historical claims require independent source verification.

---

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

Canonical IDs look like `PTL-1964-A19F02C9E1`.

Each artifact is graph-ready and can carry:

- era and year
- object type
- imagined future
- problem addressed
- outcome status
- modern conceptual descendant
- concepts
- provenance
- condition
- unresolved question

The archive API can retrieve an artifact, follow shared concepts, filter outcomes and summarize the visible collection when durable persistence is enabled.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the complete system contract.

---

## Design principles

### Discovery without behavioural capture
The experience does not require a behavioural recommendation profile.

### Structure before scale
Artifacts are created in a form that can support a shared graph/archive rather than becoming disposable generated text.

### Provenance over false certainty
The interface may suggest conceptual connections; fluent model output does not become historical fact merely because it sounds confident.

### AI calls should have a reason
Ordinary page loads do not generate content. Saved local discoveries can be revisited without another model call.

### Graceful infrastructure tiers
Generation and the private cabinet remain useful without Postgres. When `DATABASE_URL` is configured, the same canonical artifacts can become part of a durable shared archive.

---

## Security and cost boundaries

- `OPENAI_API_KEY` remains server-side.
- `DATABASE_URL` remains server-side when configured.
- Generation is POST-only.
- Responses use a strict Structured Outputs schema.
- Per-instance throttling and HTTP 429 handling are implemented.
- Upstream model calls have a 25-second timeout.
- Generation responses use `no-store`.
- Browser security headers and CSP are restrictive.
- Ordinary page load makes no AI generation call.
- Local cabinet retrieval costs no model call.

The current in-memory throttle is intentionally lightweight because Vercel instances are ephemeral. Before materially increasing public traffic, use durable distributed rate limiting and an account-level model-spend ceiling.

See [`SECURITY.md`](SECURITY.md).

---

## Persistence

| Tier | Behaviour | Requirement |
|---|---|---|
| **Local/private** | Canonical server IDs + private browser cabinet | `OPENAI_API_KEY` |
| **Shared archive** | Adds durable Postgres persistence, retrieval and concept traversal | `OPENAI_API_KEY` + `DATABASE_URL` |

The executable database contract is [`schema.sql`](schema.sql).

---

## Quality gate

```bash
npm install
npm run verify
```

`verify` syntax-checks the server/API modules. GitHub Actions runs the same gate on pushes and pull requests to `main`.

This is intentionally a minimum gate, not a claim of exhaustive test coverage. Representative API contract tests are the next engineering-quality step.

---

## Portfolio role

The Portal is an experimental **BUILD** project inside [Andrew Lam's operations-intelligence portfolio](https://github.com/AndrewLamSingapore).

Where [Open Aqua](https://github.com/AndrewLamSingapore/open-aqua) explores intelligence around a physical living system, The Portal explores intelligence around a cultural information system.

Both ask a related question:

> **Can better structure reveal relationships that ordinary observation misses?**

---

## Deploy

Copy `.env.example` for the runtime-variable contract.

The Vercel project requires `OPENAI_API_KEY` in protected Production and Preview environment variables. `DATABASE_URL` is optional and enables the shared archive. Credentials must never be committed.

Git integration deploys pushes to `main` automatically.
