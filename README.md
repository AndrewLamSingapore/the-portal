# The Portal

## An archive of strange things that imagined the future before it arrived.

The Portal is an AI-assisted discovery experiment about **forgotten futures**: inventions, proposals, systems, artworks and ideas that anticipated something recognisable in the world that followed.

It is deliberately **not a feed**.

No popularity ranking. No trending page. No engagement optimisation. No behavioural recommendation profile.

Instead, each discovery is treated as a structured artifact with provenance, concepts, an outcome and an unresolved question.

---

## The experiment

Most discovery systems optimise for what is popular now.

The Portal asks a different question:

> **What becomes visible when discovery is organised around conceptual ancestry instead of engagement?**

A historical object can be interesting not because it was famous, but because it contains an idea that later became ordinary.

The Portal is software for exploring those connections. It is **not** presented as a historical authority: AI-generated curation should be treated as a discovery surface whose claims require source verification.

**Evidence level: E2 — working software prototype.**

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
Canonical artifact ID
        ↓
Structured discovery card
        ↓
Private browser cabinet for revisiting
```

The curator assigns deterministic canonical IDs such as `PTL-1964-A19F02C9E1`.

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

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the durable shared-archive design and database contract.

---

## Design principles

### Discovery without behavioural capture
The product does not need a behavioural recommendation profile to be interesting.

### Structure before scale
Artifacts are created in a form that can later support a shared graph/archive rather than becoming disposable generated text.

### Provenance over false certainty
The interface can suggest connections; it should not convert model output into historical fact merely because the prose sounds confident.

### AI calls should have a reason
Ordinary page loads do not generate content. Saved local discoveries can be revisited without another model call.

---

## Security and cost boundaries

- `OPENAI_API_KEY` remains server-side.
- Generation is POST-only.
- Responses use a strict Structured Outputs schema.
- Per-instance throttling and HTTP 429 handling are implemented.
- Upstream calls have a 25-second timeout.
- Generation responses use `no-store`.
- Browser security headers and CSP are restrictive.
- Ordinary page load makes no AI generation call.
- Local cabinet retrieval costs no model call.

The current in-memory throttle is intentionally lightweight because Vercel instances are ephemeral. A higher-traffic public release should use distributed rate limiting and an account-level model-spend ceiling.

---

## Persistence path

**Current:** canonical server IDs + a private browser cabinet.

**Designed next tier:** permanent shared archive backed by Postgres. The target schema and rollout contract live in [`ARCHITECTURE.md`](ARCHITECTURE.md).

This keeps infrastructure proportional to evidence of demand instead of adding complexity before it is needed.

---

## Portfolio role

The Portal is an experimental **BUILD** project inside [Andrew Lam's operations-intelligence portfolio](https://github.com/AndrewLamSingapore).

Where [Open Aqua](https://github.com/AndrewLamSingapore/open-aqua) explores intelligence around a physical living system, The Portal explores intelligence around a cultural information system.

Both ask a related question:

> **Can better structure reveal relationships that ordinary observation misses?**

---

## Deploy

The Vercel project requires `OPENAI_API_KEY` in protected Production and Preview environment variables. Credentials must never be committed.

Git integration deploys pushes to `main` automatically.
