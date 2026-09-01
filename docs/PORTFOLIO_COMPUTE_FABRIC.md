# Portfolio Compute Fabric

The Portal is the semantic knowledge plane of the portfolio. Cross-product cognition uses `contracts/portfolio-event-v1.schema.json` as the transport-neutral event contract.

## Canonical topology

`products -> Portfolio Event -> PRIME cognition -> Portal graph/evidence -> verified return`

Events are facts or explicitly labelled hypotheses; transport does not upgrade evidence. Producers retain authority for their own state. PRIME may reason over events but does not mutate a producer merely because an event exists.

## Event families

- `portal.artifact.created`, `portal.hypothesis.created`, `portal.experiment.proposed`
- `velyqua.observation.recorded`, `velyqua.risk.detected`, `velyqua.experiment.completed`
- `game.simulation.completed`, `game.strategy.tested`, `game.anomaly.detected`
- `authority.evidence.published`, `authority.claim.updated`
- `prime.reasoning.completed`, `prime.memory.promoted`, `prime.review.completed`

Every event carries evidence level and provenance. Consumers must be idempotent by `event_id` and preserve `correlation_id` across derived work. No event authorizes external actuation.

## Live implementation

Clean-room hypotheses and completed experiments enter a durable Postgres outbox. Delivery retries with exponential backoff, reaches `DEAD` after eight failed attempts, and can be replayed safely because PRIME deduplicates `event_id`.

Graph queries use versioned, content-hashed OpenAI embeddings cached in `semantic_embeddings`, lexical/provenance reranking, and one-hop graph expansion. If the database, embedding credential, or provider is unavailable, the API returns an explicit `lexical_fallback` status instead of claiming semantic retrieval.
