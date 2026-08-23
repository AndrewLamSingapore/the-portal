# The Portal

An interactive cabinet of strange things that imagined the future before it arrived.

## Production architecture

The browser calls `/api/artifact`. The Vercel serverless function calls Anthropic, keeping `ANTHROPIC_API_KEY` server-side and out of client code.

## Deploy

Import this repository into Vercel and add `ANTHROPIC_API_KEY` as an encrypted environment variable for Production and Preview. Do not commit the key to GitHub.
