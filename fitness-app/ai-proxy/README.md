# Rowian Tracker AI server

A Cloudflare Worker that powers the in-app AI Coach. It keeps the Anthropic API key secret, so app and website users don't need their own key.

## What it does

- Accepts only `POST /chat` from the app's site (`ALLOWED_ORIGINS`).
- Builds the coaching prompt itself and checks every request (`src/validate.ts`), so it can't be used as a general-purpose AI.
- Limits each visitor (by IP) to 10 replies per minute.
- Uses **Cloudflare Workers AI** (`AI_MODEL`, default Llama 3.3 70B) by default. It's free within Cloudflare's daily allowance (about 10,000 "neurons" a day, roughly 100+ chat messages across all users) and needs no API key or billing. When the allowance runs out, the AI pauses until it resets at midnight UTC; nothing is charged.
- Optional upgrade: add an `ANTHROPIC_API_KEY` secret and it switches to Claude (`CLAUDE_MODEL`), which is smarter but paid per message.
- Replies are structured JSON, so the app can log food and workouts automatically.

## Deploy

```bash
npm install
npx wrangler login      # or set CLOUDFLARE_API_TOKEN
npx wrangler deploy
```

Live at `https://rowian-tracker-ai.rowian0.workers.dev`. Build the web app with `EXPO_PUBLIC_AI_PROXY_URL` set to that address.

## Test

```bash
npm test          # request validation
npm run typecheck
```
