# The Portal

An interactive cabinet of strange things that imagined the future before it arrived.

## Production architecture

The browser calls `/api/artifact`. A Vercel serverless function calls the OpenAI Responses API and returns schema-validated artifact data. `OPENAI_API_KEY` remains server-side and is never exposed to browser code.

## Intelligence

The curator uses an OpenAI GPT-5.6 model with Structured Outputs. The generation prompt emphasizes originality, material specificity, diversity across eras and media, and unresolved questions while avoiding real named copyrighted works.

## Production safeguards

- Server-only OpenAI credential
- Strict structured artifact schema
- POST-only generation endpoint
- Per-instance request throttling and HTTP 429 handling
- Upstream request timeout protection
- No-store API responses
- Content Security Policy and restrictive browser security headers
- Accessible loading, error, reduced-motion, and condition states
- Graceful client handling for throttling, timeout, and upstream errors

The in-memory throttle is intentionally a lightweight safety layer because serverless instances are ephemeral. Account-level OpenAI usage budgets remain the authoritative cost ceiling for a public deployment.

## Deploy

Import this repository into Vercel and add `OPENAI_API_KEY` as a protected environment variable for Production and Preview. Never commit the key to GitHub.

Every push to `main` triggers a new Vercel deployment when Git integration is enabled.
