# The Portal

## An explorable model of how encounters become connections, experiments and new ways of seeing.

The Portal is an AI-assisted discovery and knowledge-graph experiment. It is not a website *about* Andrew Lam and it is not a conventional feed. Its long-term direction is to model a living process:

> **ENCOUNTER → CONNECT → EXPERIMENT → EVOLVE ↻**

A book, exhibition, technology, place, historical artifact, operating observation or strange idea can enter as a node. The useful question is not merely *what is this?* but:

> **What does this connect to, what might that connection mean, and what becomes worth testing because of it?**

**Evidence level: E2 — working software prototype.** The broader living-graph direction described here is an evolving product thesis, not a claim of completed capability.

## The experiment

Most discovery systems optimise for what is popular now. The Portal asks a different set of questions:

> **What becomes visible when discovery is organised around conceptual ancestry instead of engagement?**
>
> **Can apparently unrelated encounters reveal useful relationships when they are structured as a graph?**
>
> **Can those relationships generate better questions and experiments?**

The Portal is deliberately **not a feed**. No popularity ranking, trending page, engagement optimisation or behavioural recommendation profile is required.

Each discovery becomes a structured artifact with provenance, concepts, an outcome and an unresolved question. Over time, artifacts can become nodes in a larger graph connecting encounters, ideas, projects, technologies and experiments.

The Portal is **not a historical authority**: AI-generated curation is a discovery surface, and factual historical claims require independent source verification.

## The operating loop

### 01 — ENCOUNTER
Something enters attention: an object, book, exhibition, system, place, observation, technology or idea.

### 02 — CONNECT
The encounter is linked to concepts and other nodes that may initially appear unrelated.

### 03 — EXPERIMENT
A promising connection becomes a question, prototype, model, investigation or test.

### 04 — EVOLVE
The result changes the graph: strengthening, weakening, rejecting or creating connections.

Then the cycle repeats.

```text
ENCOUNTER
    ↓
OBSERVATION
    ↓
CONNECTIONS ─────→ other nodes / constellations
    ↓
QUESTION
    ↓
EXPERIMENT
    ↓
EVIDENCE
    ↓
EVOLVE ──────────→ new encounters + revised connections
```

## From artifacts to an externalised knowledge graph

The long-term unit of The Portal is the **node**.

A node can represent an encounter, idea, book, place, technology, project, experiment or unresolved question. A graph-ready node can carry fields such as:

- **type** — encounter / idea / place / book / technology / experiment / project / question
- **source** — where it came from
- **date / era**
- **observation** — what made it interesting
- **interpretation** — what it might mean
- **connections** — related nodes and concepts
- **question** — what remains unresolved
- **experiment** — what was tested because of it
- **status / evidence** — observed, exploring, testing, validated, rejected or dormant
- **provenance** — evidence for factual claims

This is intentionally graph-shaped rather than page-shaped. One node may belong to several conceptual **constellations** at once.

Possible constellations include **Intelligence**, **Worlds**, **Life**, **Civilization** and **Frontiers**. Their boundaries should emerge from useful relationships rather than become rigid folders.

## Example: from imagined worlds to machine economies

An encounter with fantasy and speculative-fiction artifacts can traverse a chain such as:

```text
myth
  ↓
story
  ↓
world-building
  ↓
rules
  ↓
games + participation
  ↓
simulation
  ↓
emergent behaviour
  ↓
AI agents
  ↓
autonomous exchange
  ↓
machine economies
  ↓
?
```

The final `?` is deliberate. The Portal should expose uncertainty rather than manufacture certainty.

A second path can connect imagined ecosystems and resource-constrained worlds to ecology, sensing, closed systems and **Open Aqua**. The value is not the association itself; the value is whether the association produces a useful question or experiment.

## How the current prototype works

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

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the executable system contract.

## Experience direction

The interface should behave more like an explorable museum of relationships than a dashboard or social feed.

The design principle is **darkness + isolation + hierarchy**: reveal a small number of meaningful nodes first, then let interaction expose deeper connections. Complexity should be discovered progressively rather than dumped onto the visitor as a giant graph.

The desired progression is:

```text
simple → curious → deeper → surprising
```

Selected encounters can be presented as digital artifacts: an image or object, its provenance, the observation it triggered, the connections it suggests, the unresolved question and any experiment that followed.

## Design principles

- **Discovery without behavioural capture.** No behavioural recommendation profile is required.
- **Connections over categories.** Relationships can cross projects, disciplines and media.
- **Questions over manufactured certainty.** Unknowns remain visible.
- **Structure before scale.** Artifacts are graph/archive-ready rather than disposable generated text.
- **Provenance over false certainty.** Fluent model output does not become historical fact merely because it sounds confident.
- **Experiments over aesthetic association.** A connection becomes valuable when it generates a useful question, decision or test.
- **Progressive disclosure over graph spectacle.** Visual complexity must serve comprehension.
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

Where [Open Aqua](https://github.com/AndrewLamSingapore/open-aqua) explores intelligence around a physical living system, The Portal explores intelligence around a cultural and conceptual information system. Both ask:

> **Can better structure reveal relationships that ordinary observation misses?**

The Portal extends that question one step further:

> **Can those relationships become experiments?**

## Deploy

Copy `.env.example` for the runtime-variable contract. The Vercel project requires `OPENAI_API_KEY` in protected Production and Preview environment variables. `DATABASE_URL` enables the shared archive. Credentials must never be committed.

Git integration deploys pushes to `main` automatically. The production smoke workflow provides an independent verification layer after deployment.

---

### The Portal is not a record of what has been done. It is a living map of how encounters become connections, connections become experiments, and experiments create new ways of seeing the world.
