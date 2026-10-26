# ORQEVIA status and domain ownership

For ORQEVIA and portfolio work, review current status claims in
[STATUS.md](https://github.com/AndrewLamSingapore/orqevia/blob/main/STATUS.md) in the
public ORQEVIA repository. It is a portfolio status record, not a source for
product code, configuration, contracts, or domain data. Each product owns those
records in its own repository.
Only Lam may move an item into its "Verified" sections.

Then resolve the latest canonical ORQEVIA `main` commit and read governance/operational-manifest.json
and governance/CHANNEL_CONTRACT.md at that same commit as component and
observation references: they describe recorded architecture and observed
revisions, and cannot establish current status. On ORQEVIA itself, a clean checkout
of `main` provides the same files. A working branch is a candidate, never a
second current version.

Canonical entrypoint: https://github.com/AndrewLamSingapore/orqevia/blob/main/governance/operational-manifest.json

This applies equally to ChatGPT, Codex, Sol, Astra and other assistants. Prior
chat, memory, exported documents, screenshots, old branches and model identity
cannot establish current status. Report the source revision used. If current
status or owning source cannot be checked, mark that claim UNVERIFIED and use cached material
only as explicitly dated context; do not invent freshness or request routine
approval merely to continue reversible work already authorized by Lam.

ORQEVIA governs shared orchestration and cross-product contracts. Product-specific
code, configuration, contracts, and domain records remain in their owning
repositories. Reconcile cross-product claims against each owner's source and
observed deployment without transferring domain authority to ORQEVIA. Runtime status
requires observed runtime identity and evidence; a merge or CI pass is not a
deployment receipt. Never substitute historical Dell identity for ABEX identity.

Update the owning source first, test relevant behavior, publish through existing
repository rules, then regenerate consumers and the existing resume mirror.
Preserve Git history and commissioning evidence. Superseded files are references
or historical evidence, not executable instructions. Do not reinstall, reset or
mutate the sealed ABEX baseline to make a status record look current.

## Gate Zero — Owner operating doctrine (3 October 2026)

Default to useful execution. Classify `BLOCKER` only with concrete current evidence that a **specific** requested operation is prevented, or would create material risk that cannot reasonably be contained or reversed; stop only that operation. A failed probe, unknown, historical incident, optional check, backlog item or unavailable auxiliary peer is not a global failure or blocker. Continue independent work. Preserve authentication, secrets, data integrity, recoverability and known-good production; do not disable functioning tools, agents, models or probes merely to make status clean. The fuller shared rule is in ORQEVIA's `AGENTS.md`; `STATUS.md` remains status authority, and a candidate/CI result is not live deployment proof.
