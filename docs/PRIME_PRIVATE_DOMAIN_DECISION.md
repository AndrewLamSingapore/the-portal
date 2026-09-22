# Private PRIME operations domain — decision required

Status: **AUTHENTICATION DECISION REQUIRED** (recorded 22 September 2026).

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
private operational evidence. So this branch builds nothing behind that line and
records the choice instead.

## Smallest concrete choice for Lam

Pick one, and the implementation work is bounded and mechanical:

| Option | What Lam decides | Consequence |
| --- | --- | --- |
| **A. Vercel Password Protection / Deployment Protection** on a `/prime/*` path | Turn on protection for one path | Fastest; single shared secret; no per-person identity or audit trail |
| **B. Cloudflare Access (or similar SSO in front of `/prime/*`)** | Create the Access application and allow Lam's identity | Per-person identity, device posture, auditable sign-in; needs an account Lam controls |
| **C. Supabase Auth (magic link), report tables with RLS keyed to `auth.uid()`** | Confirm the Supabase project may hold private reports | Strongest fit for the existing evidence discipline; most work, and needs the Supabase project decision |

Recommendation: **B** if Lam wants the private surface usable from any device quickly,
**C** if private reports must be queryable alongside the existing evidence spine.

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
