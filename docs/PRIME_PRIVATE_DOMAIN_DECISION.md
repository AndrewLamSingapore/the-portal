# Private PRIME operations domain — decision required

Status: **DECIDED AND IMPLEMENTED** (decision recorded 22 September 2026; the
option C surface, including the producer path, implemented 23 September 2026).

## What exists today

The Portal already has a machine-facing PRIME lane, and it follows the required
direction of travel: **ABEX pushes out, the Portal never reaches in.**

- `src/lib/trust-relay.js` + `migrations/20260915_prime_trust_relay.sql` implement an
  encrypted, role-separated relay. Producers authenticate with
  `PRIME_TRUST_ABEX_RELAY_TOKEN` / `PRIME_TRUST_VELYQUA_RELAY_TOKEN`; the two tokens
  must differ or the endpoint refuses to serve (503 `separate_role_credentials_required`).
- Entries are leased, expire, and are deleted after use; responses are idempotent per
  `(id, fingerprint)`.
- `verify:portfolio` proves bounded candidates only: "PRIME result is validated,
  evidence-bound, idempotent and attached to the Portal graph" and "Portal relays only
  bounded candidates and never infers owner approval".
- `vercel.json` keeps every `/api/*` response `noindex, nofollow` and `no-store` where
  the data is live.

There is **no human-facing private surface** yet: no `/prime` (or `/reports`) route, no
session, and no report schema in the public bundle. Nothing about PRIME operation is
displayed to visitors, which is the correct default while the decision below is open.

## What is missing, and why it is blocked

The brief requires a private, authenticated surface where Lam can read real PRIME/ABEX
mission reports, inspect artifacts, add notes, and eventually propose the next
objective. That needs two decisions the repository cannot make on its own:

1. **A human identity provider.** The Portal has no user accounts. The relay tokens are
   machine credentials and must never become a human login.
2. **Where private reports live.** The public Neon database is the wrong home for
   unpublished operational evidence unless a separate, access-controlled schema and role
   is introduced deliberately.

Inventing either one would create a second, weaker authority path and risk exposing
private operational evidence. Both decisions were then made by Lam: the human
identity provider is Supabase Auth in the estate's existing project
(`vtrfgckzpjgtmqsnumur`), and private reports live in `public.prime_identities` /
`public.prime_reports` under row level security.

## Smallest concrete choice for Lam

Pick one, and the implementation work is bounded and mechanical:

| Option | What Lam decides | Consequence |
| --- | --- | --- |
| **A. Vercel Password Protection / Deployment Protection** on a `/prime/*` path | Turn on protection for one path | Fastest; single shared secret; no per-person identity or audit trail |
| **B. Cloudflare Access (or similar SSO in front of `/prime/*`)** | Create the Access application and allow Lam's identity | Per-person identity, device posture, auditable sign-in; needs an account Lam controls |
| **C. Supabase Auth (magic link), report tables with RLS keyed to `auth.uid()`** | Confirm the Supabase project may hold private reports | Strongest fit for the existing evidence discipline; most work, and needs the Supabase project decision |

Recommendation: **B** if Lam wants the private surface usable from any device quickly,
**C** if private reports must be queryable alongside the existing evidence spine.

## What was built (23 September 2026)

Option **C** was chosen. The read side answers only to a mapped PRIME identity and
RLS decides every row. `prime_reports` had **no producer at all**, which is why the
private surface could only ever report "No reports are visible to this identity
yet" - an empty store was not an authorization failure, but it was also not a
working report surface.

The producer path now exists and follows the same direction of travel as the rest
of the estate - **the producer pushes outward, the Portal never reaches in**:

| Element | Contract |
| --- | --- |
| Endpoint | `POST /api/prime/publish` (rewrite of `api/meta.js?route=prime-publish`) |
| Credential | `Authorization: Bearer <publisher credential>`, read by the producer from its own environment |
| Storage | only the **SHA-256 digest** of the credential is stored, in `public.prime_publishers`, which has RLS forced and no client policies |
| Decision order | credential, then method (`POST` only), then body size, then payload, then the database |
| Payload | `id`, `schema_version`, `mission_id`, `task_id`, `parent_task_id`, `objective`, `summary`, `status` (`VERIFIED`/`PARTIAL`/`FAILED`), `visibility` (`OWNER`/`MEMBER`), `agents`, `artifacts`, `claims` |
| Enforcement | `public.prime_publish_report(text, jsonb)` (`SECURITY DEFINER`, `search_path = ''`) checks the digest, validates the payload and inserts at most once |
| Immutability | a repeated `id` returns `inserted: false` and never rewrites the stored report |
| Client writes | none: `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` are revoked from `anon` and `authenticated`, so a mistaken future policy cannot make a browser session an author |
| Responses | `private, no-store`, `Vary: Authorization`, `X-Robots-Tag: noindex, nofollow`, no credential ever echoed |
| Provisioning | one privileged insert of a digest; no secret transits the repository, a log or a browser |

The producer is `scripts/publish-prime-report.mjs`, which fails closed: with no
`PORTAL_PRIME_PUBLISH_TOKEN` it refuses to send anything. PRIME on ABEX (or an
owner-authorised acceptance runner) runs it with its own credential.

## Invariants that must hold in any option

1. ABEX remains off the public Internet: no inbound connection, no tunnel, no public
   webhook into ABEX. ABEX polls outward over authenticated HTTPS.
2. Report data is never included in the public static bundle, and never rendered into
   Open Graph metadata or cached HTML.
3. `/prime/*` is `noindex, nofollow`, `Cache-Control: private, no-store`.
4. Report status `VERIFIED` means *the report passed its technical verification gate*.
   It never promotes an item into `STATUS.md` → Verified; only Lam does that.
5. A Portal-submitted objective cannot bypass PRIME's own safety and authority model;
   it is a queued proposal, not a command.
6. `STATUS.md` stays the single current human-readable status source. Portal reports are
   evidence, not a replacement status system.
