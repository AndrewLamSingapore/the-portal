# Closed PRIME Evidence Return

The Portal accepts only authenticated, versioned PRIME experiment results.

- Results are monotonic by result_version and idempotent by experiment/result identity.
- Conflicting replays and stale versions are rejected.
- Observation counts are preserved without being promoted into scientific support claims.
- Result safety must explicitly deny actuation authority, inferred approval and scientific-support claims.
- Matching Portal node_ids receive EXPERIMENT_EVIDENCE edges in /api/graph.
- The Living Observatory remains read-only; only the separate authenticated PRIME result endpoint may write returned evidence.

Required production configuration:

- PORTAL_RESULT_TOKEN: shared only with the owner-controlled PRIME runtime.
- PRIME PORTAL_RESULT_URL: the exact HTTPS /api/experiment-result endpoint.

No result may mutate source code, deployments or physical systems.

The release gate now executes a complete non-physical synthetic loop: invalid authentication is rejected, a valid result is written, an exact replay is idempotent, a conflicting replay is rejected, the stored result is read back, and an `EXPERIMENT_EVIDENCE` graph edge is derived. Production readiness requires both the durable `experiment_results` schema and `PORTAL_RESULT_TOKEN` configuration.

## Candidate relay

The owner-only `POST /api/prime-experiment` route sends a validated Portal `ExperimentCandidate` to PRIME from the server runtime. It requires:

- `PORTAL_PRIME_TOKEN`: authenticates the owner request into The Portal.
- `PRIME_BASE_URL`: the HTTPS hostname of PRIME's restricted integration gateway.
- `PRIME_INTEGRATION_TOKEN`: authenticates The Portal to PRIME.

None of these values may appear in browser JavaScript. The relay rejects non-Portal identities, unsupported fields, non-`proposed`/`accepted` states, non-VELYQUA targets and any PRIME response that claims owner approval.
