# Security policy

## Supported source

The `main` branch is the supported public source for The Portal.

## Secrets

- `OPENAI_API_KEY` is server-only and must never be committed or exposed to browser code.
- `DATABASE_URL` is server-only when the shared archive is enabled.
- Local `.env*` files are ignored except `.env.example`.
- Do not place Vercel tokens, database credentials, API keys or private incident details in issues, screenshots or commits.

## Current controls

- Artifact generation accepts POST only.
- The generation endpoint uses strict structured output, a 45-second upstream timeout and `no-store` responses.
- Browser responses receive restrictive security headers and CSP through `vercel.json`.
- The API key never leaves the serverless function.
- The current request throttle is per-instance and is not a durable distributed abuse-control boundary.

## Known scaling boundary

The in-memory rate limiter is suitable only for the present experimental stage because serverless instances are ephemeral. Before materially increasing public traffic, move rate limiting to a durable distributed store and configure an account-level model-spend ceiling.

## Reporting a vulnerability

Use GitHub's private security-advisory channel for this repository. Do not publish exploitable details or credentials in a public issue.
