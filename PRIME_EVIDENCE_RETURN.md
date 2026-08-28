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
