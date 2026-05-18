# Cloudflare Leaderboard Setup

The game expects a Cloudflare Pages Function at `/api/leaderboard` with:

- D1 binding: `LEADERBOARD_DB`
- Secret variable: `TURNSTILE_SECRET_KEY`
- Optional secret variable: `TURNSTILE_HOSTNAME`
- Build-time public variable: `VITE_TURNSTILE_SITE_KEY`

The Pages Function is type-checked with `functions/tsconfig.json`, which uses Wrangler-generated Cloudflare runtime types from `functions/types.d.ts` for globals such as `PagesFunction` and `D1Database`. Keep this separate from the browser `tsconfig.json` so Worker runtime types do not mix with DOM/Vite client types.

Run `npm run cf:types` after changing `wrangler.jsonc` or Cloudflare bindings.

Create the D1 database and apply `migrations/0001_leaderboard.sql`. The function also runs `CREATE TABLE IF NOT EXISTS` defensively, but the migration is the deployment source of truth.

Create a Cloudflare Turnstile widget in Invisible mode. Use its site key as `VITE_TURNSTILE_SITE_KEY`, and its secret key as `TURNSTILE_SECRET_KEY`.

Only the default player-controlled ruleset submits scores. Autopilot, sandbox mode, projector debug mode, non-default initial instance counts, custom special-brick URL params, and custom ball-speed caps are excluded client-side; the API also requires the `default-v1` ruleset marker.

`public/_routes.json` keeps Pages Functions scoped to `/api/*`, so the Vite static assets remain static asset requests.
