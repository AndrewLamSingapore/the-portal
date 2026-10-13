> Portfolio status: [STATUS.md](https://github.com/AndrewLamSingapore/orqevia/blob/main/STATUS.md) is the sole portfolio status reference. Each product owns its source, configuration, contracts and domain records. The [operational manifest](https://github.com/AndrewLamSingapore/orqevia/blob/main/governance/operational-manifest.json) provides dated ORQEVIA component and observation references; it does not establish deployment status.

# The Portal Cross-Project Contracts

The Portal is the discovery layer. It may turn a graph connection or unresolved question into a structured experiment candidate without claiming that the candidate is validated.

## ExperimentCandidate

`experiment-candidate.schema.json` defines the first cross-project handoff.

The contract preserves:

- the originating Portal identity;
- the question and optional hypothesis;
- graph nodes/concepts that produced the candidate;
- provenance;
- the evidence boundary; and
- lifecycle status.

The Portal owns discovery and provenance. It does not own execution approval.

## Intended handoff

```text
Portal nodes / connections
        ↓
question
        ↓
ExperimentCandidate
        ↓
PRIME reasoning + verification
```

The receiving system must treat generated interpretations as hypotheses unless supported by attached provenance/evidence.

## Architecture boundary

The Portal must remain independently useful. It must not import PRIME or VELYQUA application internals. Future integration should use versioned contracts and APIs/events around them.
