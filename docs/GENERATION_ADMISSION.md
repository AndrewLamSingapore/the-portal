# Public artifact generation admission

Policy: `portal-artifact-generation-v1`. The owner approved **US$10 total** for public artifact generation on 21 October 2026. This is a permanent conservative reservation allowance in Portal's own production database, shared across instances. It is not an account-wide invoice cap.

Each acknowledged logical request permanently reserves **1,080,000 microUSD ($1.08)** before provider transport. At most **nine** requests can therefore be admitted: $9.72 reserved, $0.28 remaining. Success, failure, abort, unknown upstream outcome and lease expiry never refund or replenish credit. Deployment/cold start/bootstrap use INSERT ON CONFLICT DO NOTHING and never reset it. There is no refill or budget-reset endpoint.

## Exact limits and tariff assumptions

- Existing OpenAI Responses endpoint and `gpt-5.6-luna`, at most two attempts, each max_output_tokens 6000; same complete JSON body limit 65,536 UTF8 bytes.
- Twelve requests/client/UTC hour, sixty globally/UTC hour; two 120-second logical leases. The stricter lifetime credit normally dominates both hourly limits.
- Existing bounded local map remains an additional per-instance brake; trusted ingress/socket identity is hashed and no raw address enters the SQL ledger.
- Vercel Preview/development generation is disabled so isolated preview branches cannot create additional paid allowances. Standalone operation requires its own explicitly controlled server database.
- Official model documentation rechecked 2026-10-21: $0.20/input-million and $1.20/output-million; long-input multipliers 2x/1.5x and cache-write 1.25x. A deliberately loose bound uses the entire 1,050,000-token context at $0.50/million plus 6,000 output at $1.80/million, twice: **$1.0716**, below $1.08. Actual bounded text input should be much smaller. No paid tools, regional endpoint, priority tier or provider substitution is added.
- Pricing/model/endpoint/transport limits are pinned to the policy. Changing them requires review. Future tariff changes, tax, other application/API usage and previously incurred charges are outside this reservation mechanism.

Source: https://developers.openai.com/api/docs/models/gpt-5.6-luna (pricing, multipliers, context and Responses support); https://developers.openai.com/api/docs/pricing.

## Atomicity and failure behavior

`lib/generation-admission-schema.js` owns the exact additive PostgreSQL statements used by runtime bootstrap and tests. No health read runs DDL. The first production generation request bootstraps through the existing server Neon connection in one transaction with a stable transaction advisory lock. Credit, counts, duplicate ticket refusal and leases are checked atomically before inserting a server-generated UUID reservation. Locks are released before provider work.

Schema/tables/functions are server-owned, SECURITY INVOKER with fixed search_path, no public/anon/authenticated/anonymous grants. No raw client SQL access or new credentials are introduced. Missing database, schema privileges, timeout, malformed acknowledgment or unknown admission outcome returns 503 without provider transport and without retrying admission. A reused ticket is denied. Known-invalid input is rejected before reserving credit.

Completion marks the lease finished only. If completion acknowledgment fails or the process dies, the reservation remains and the lease eventually expires. Two logical starts do not prove that a timed-out provider computation has stopped. Abort does not imply zero provider charges.

Response-only headers report acknowledged policy, allowance, cumulative reserved credit and remaining credit (`X-Portal-Generation-*`). They never enter the saved artifact. Reserved credit is not measured billing. Read-only archive/workflows remain available after exhaustion.

## Qualification and activation

Run `node --test tests/generation-admission.test.js tests/generation-bounds.test.js`, then standard `npm run verify`. The PostgreSQL runner requires an explicitly named, labeled, network-none task-owned container; it rejects other targets. CI creates/removes only its disposable fixture. It tests concurrent bootstrap / 20-way admission, permanent unknown holds, invalid identities, role denial, exact rate branches, 9-request exhaustion, PostgreSQL restart and isolated logical backup/restore. Synthetic rate fixtures deliberately isolate thresholds otherwise dominated by lifetime credit. No provider calls occur in these tests.

A candidate/CI pass is not production activation. After exact production revision READY, an authorized bounded root-owned ordinary request must show acknowledged ledger headers and durable artifact readback. No diagnostic backdoor or arbitrary SQL endpoint is provided.

## Recovery and rollback

Preserve both admission tables, constraints, functions and ACLs in backups. A fresh isolated restore must preserve exact cumulative credit/ledger and continue denying exhausted credit. The local logical restore test is not a managed Neon/PITR drill.

A stale backup can resurrect already-used credit. Before any production database restore, stop generation and reconcile the highest known reservation watermark/unknown charges; do not reset, delete or recreate credit to restore availability. Lost ledger or deliberate admin database/schema replacement is outside the guarantee. Independent production databases/other applications cannot share one atomic cap without sharing that ledger.

For emergency rollback, disable generation by removing its server provider configuration through the normal authorized deployment process and retain archive reads plus the ledger. Do not roll back to code that generates without admission. A later refill or policy change requires explicit review; do not change grants, add a shared service or reset user data.
