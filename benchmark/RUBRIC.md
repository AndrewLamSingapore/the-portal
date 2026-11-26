# Portal Intelligence Benchmark — scoring rubric

This is an internal, deterministic benchmark. It does not establish superiority and
is not independent scientific validation.

## Retrieval

- Precision@3: fraction of the top three ranked records that are annotated relevant.
- Recall@5: fraction of all annotated relevant records found in the top five.
- NDCG@5: discounted gain of relevant records in the top five, normalised by the
  ideal ranking.
- Baselines are matched: the lexical-only baseline uses the same tokenisation and
  the same held-out set as the Portal hybrid. The hybrid adds provenance and, when
  embeddings are enabled, semantic similarity. Embedding cost is reported.

## Discovery quality (deterministic proxies over recorded outputs)

- Novelty: fraction of candidate statements that are distinct from one another.
- Falsifiability: fraction of candidates that declare at least one falsifier and
  one hard-kill condition.
- Evidence quality: fraction of candidates that carry an epistemic class and a
  recorded ancestry.
- Self-correction: whether a superseded or killed hypothesis is retained in the
  fossil record.
- Evolutionary improvement: whether lineage carries a mutation operator or a
  superseded predecessor.

These proxies are intentionally narrow. Human expert review is required before any
claim of validated scientific value.
