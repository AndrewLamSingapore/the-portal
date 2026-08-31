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