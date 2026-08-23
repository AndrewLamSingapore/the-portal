# The Portal

An interactive cabinet of strange things that imagined the future before it arrived.

## Production architecture

The browser calls `/api/artifact`. A Vercel serverless function calls the OpenAI Responses API and returns schema-validated artifact data. `OPENAI_API_KEY` remains server-side and is never exposed to browser code.

## Intelligence

The curator uses an OpenAI GPT-5.6 model with Structured Outputs. The generation prompt emphasizes originality, material specificity, diversity across eras and media, and unresolved questions while avoiding real named copyrighted works.

## Deploy

Import this repository into Vercel and add `OPENAI_API_KEY` as a protected environment variable for Production and Preview. Do not commit the key to GitHub.

Every push to `main` triggers a new Vercel deployment when Git integration is enabled.
