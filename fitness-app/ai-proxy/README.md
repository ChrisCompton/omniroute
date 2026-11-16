# Rowian Tracker AI server

A Cloudflare Worker that powers the in-app AI Coach. It keeps the Anthropic API key secret, so app and website users don't need their own key.

## What it does

- Accepts only `POST /chat` from the app's site (`ALLOWED_ORIGINS`).
- Builds the coaching prompt itself and checks every request (`src/validate.ts`), so it can't be used as a general-purpose AI.
- Limits each visitor (by IP) to 10 replies per minute.
- Calls Claude (`MODEL`, default `claude-opus-5-5`) with structured JSON output, so the app can log food and workouts automatically.

## Deploy

```bash
npm install
npx wrangler login                          # or set CLOUDFLARE_API_TOKEN
npx wrangler deploy
npx wrangler secret put ANTHROPIC_API_KEY   # paste your key from console.anthropic.com
```

Then build the web app with `EXPO_PUBLIC_AI_PROXY_URL=https://rowian-tracker-ai.<your-subdomain>.workers.dev`.

**Cost control:** you pay for every user's chats. Set a monthly spend limit at console.anthropic.com → Settings → Limits. To make each chat cheaper, set `MODEL` in `wrangler.jsonc` to `claude-haiku-5-5`.

## Test

```bash
npm test          # request validation
npm run typecheck
```
