# Portal 6.3 release gate

The release gate now covers structured experiments, typed connections, deterministic evolution events, and backward compatibility with earlier artifacts.

A production release is acceptable only when:

1. `npm run verify` passes.
2. The deployment creates no more than 12 Vercel Functions.
3. Generated objects cannot mark themselves historically verified or invent source URLs.
4. The primary interface supports encounter creation, graph traversal, constellations, a private cabinet and explicit evidence states.
5. Keyboard focus, Escape-to-close, dialog semantics, live status, reduced motion and mobile layout remain intact.
6. `/api/health` verifies the evidence columns in the live database.
7. `npm run smoke:production` passes against the exact Git revision deployed to production.
8. The generation endpoint itself is tested once after deployment; scheduled checks must not spend model calls.
9. A newly persisted encounter appears in the archive and graph without a CDN-staleness window.
10. `/living` and `/api/living` load in production, preserve falsifiers and hard-kill inheritance, and report source, database and deployment mutation permissions as blocked.
11. Model-originated clean-room execution remains preview-only and explicitly invoked.

A dedicated domain remains a separate owner branding and financial decision.
