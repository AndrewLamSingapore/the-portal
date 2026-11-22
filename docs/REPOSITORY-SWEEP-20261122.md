# THE PORTAL repository sweep, 22 November 2026

## Scope and source

Owning repository: `AndrewLamSingapore/the-portal`, baseline `ed305c98cc12124b25cf889202652f36dcd77ab4`.
ORQEVIA status, operational manifest and channel contract reference: `ced0853b9bd903ea6b2b82bde8a7aca7de73abcb`.

This sweep reviewed the public experience, archive-to-graph projection, semantic search, evidence presentation, scripts, deployment configuration, dependency audit and the requested biology addition. It does not promote portfolio status or establish private runtime acceptance.

## Findings corrected

| Finding | Consequence | Correction |
| --- | --- | --- |
| Graph projection discarded artifact source trails and useful descriptive context | Graph search received empty provenance even when the archive supplied sources, and searched an unnecessarily narrow text projection | Preserve deduplicated HTTPS source references and public descriptive context in graph nodes. Reject credential-bearing or invalid source URLs without changing the evidence label |
| Provenance contributed a positive ranking score even when lexical and semantic relevance were both zero | An unrelated record could appear in a query solely because it carried references | Require lexical or semantic relevance before applying the provenance ranking contribution |
| Semantic scores accepted non-finite or unbounded values | Malformed scores could distort ranking | Accept finite values only and bound the semantic contribution to zero through one |

Three regression tests cover the archive-to-search projection, relevance requirement, malformed scores, URL filtering and evidence-label preservation. The new tests run in `preverify`, including the existing CI path.

## Biology case study

`/ai-biology` is a curated Life + Frontiers research case, linked from the homepage. It retains all eight capability distinctions and the conceptual READ / UNDERSTAND / SIMULATE / DESIGN / VALIDATE workflow. Six primary references support the discussion. Sequencing instruments produce sequence data; AI helps interpret it. Variant predictions need additional clinical evidence. Comprehensive human-cell simulation and safe general whole-body programming retain research or speculative classifications.

The case study uses static, same-origin HTML and CSS. It requires no AI call, account, genomic upload or shared database. It does not inject a fabricated historical artifact into the archive or provide biological simulation, gene editing or clinical interpretation.

The public narrative and speaker notes for ten presentation slides are in `docs/presentations/THE-PORTAL-10-SLIDES.md`.

## Verification

- Baseline `npm run verify` and all 82 existing tests passed.
- After corrections, `npm run verify` and all 85 tests passed.
- The page/CSP contract covers all eight root HTML pages, including the new case study.
- Full and production dependency audits reported zero vulnerabilities.
- Existing API authority, generation admission, private authentication, evidence export and deployment limits remain under their repository contracts.

Source and fixture results are separate from deployed acceptance. The pull request records CI and deployment/browser results as they become available. Existing generated archive content still requires its own source review; this sweep does not certify every historical or scientific claim in that content.
