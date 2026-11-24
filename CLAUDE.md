# Ascend — notes for Claude Code (and humans)

A personal tracker (jobs, LeetCode, activity, gaming, resume) plus the public
portfolio at edgarsetyan.com. React 18 + Vite + React Router frontend on
Vercel; AWS CDK backend (Cognito, HTTP API Gateway, Node Lambdas, DynamoDB);
two Claude Haiku 4.5 features behind Vercel functions. Plain JavaScript
(JSX) in the frontend, `.mjs` Lambdas, TypeScript only in `infra/lib`.

## Architecture in one screen

```
React + Vite (src/)
  ├─ API Gateway ── Cognito JWT authorizer ─▶ private CRUD Lambdas ─▶ DynamoDB
  │             └── public read-only Lambda (owner's leetcode + activity only)
  ├─ Vercel functions (api/)
  │     /api/leetcode-stats   -> LeetCode GraphQL
  │     /api/scan-emails      -> Claude Haiku (requires Cognito ID token)
  │     /api/analyze-resume   -> Claude Haiku
  └─ Gmail API, called from the browser after Google OAuth
```

| Path | What lives there |
|---|---|
| `src/trackers/*.js` | One config object per tracker: columns, badges, defaults. Registered in `src/trackers/index.js`. |
| `src/hooks/useEntries.js` | Reads/writes with optimistic updates + rollback on failure |
| `src/lib/` | Cognito session, private API client, public API client |
| `src/components/RecruiterView.jsx`, `src/components/portfolio/` | The public portfolio ("The Exhibit") |
| `api/_lib/ai-protection.js` | Origin allowlist, body-size check, rate limits, Cognito verification for AI routes |
| `api/_lib/structured-output.js` | JSON Schemas + server-side validation of model output |
| `infra/lambda/` | Lambda handlers, `shared/` helpers, `node --test` tests |
| `infra/lib/` | CDK constructs (api, auth, database) |

DynamoDB key design: `PK = USER#{sub}`, `SK = TRACKER#{trackerId}#ENTRY#{uuid}`.

## Rules that matter

- **Identity comes from the verified JWT, never the request.** Private
  handlers read `sub` from the authorizer claims. Don't add a `userId`
  parameter anywhere.
- **The public handler stays separate and narrow.** `public-entries-list.mjs`
  has read-only permissions, a configured owner ID, and an explicit
  `ALLOWED_TRACKERS` set. Don't widen it, and don't reuse the private
  handlers with auth turned off.
- **Tracker IDs are allowlisted** in `infra/lambda/shared/validate.mjs`
  (`VALID_TRACKERS`), because they become DynamoDB sort-key prefixes.
- **Every AI endpoint**: `validateJSONRequest` → input checks → 503 if no
  `ANTHROPIC_API_KEY` → `reserveAIRequest` → SDK with `maxRetries: 0` and a
  timeout → structured output (`output_config.format` JSON Schema) →
  validate the parsed result in code → `sendAIError` on failure → always
  `release()`. Compute anything numeric (like the weighted score) in code.
- **No secrets in `VITE_*` vars.** They ship to the browser. Server keys
  (`ANTHROPIC_API_KEY`, `UPSTASH_*`) are only read in `api/`.
- **The portfolio must be factual.** Every claim on the public pages must
  match the real résumé or the real repo. Never add placeholder copy,
  invented metrics, or made-up course names. Leave a slot empty instead.
- **Portfolio design direction:** no boxed eyebrow labels, no decorative
  plate numbers, no all-caps card eyebrows, no tech-stack chips. Keep
  "Download résumé" as the only filled button on home.

## Commands

```
npm test                 # vitest (jsdom), frontend + api/ handlers, ~5s
npm --prefix infra test  # node --test for Lambdas
npm run build            # vite build + page metadata
```

## Local testing gotchas

- `npm run dev` can fail with `ReferenceError: global is not defined` from
  `amazon-cognito-identity-js`. If it does, use
  `npm run build && npx vite preview --port 4173`.
- The build needs *some* `VITE_USER_POOL_ID` / `VITE_USER_POOL_CLIENT_ID`,
  or the Cognito constructor throws and blanks the app. Use a throwaway
  `.env.local` with dummy values. It's gitignored; never commit it.
- `vite-plugin-pwa` registers a service worker that caches JS/CSS
  aggressively. Before checking a change in a browser, unregister service
  workers and clear caches, or you'll be looking at stale code. New
  lazy-loaded route chunks should be added to `workbox.globIgnores` in
  `vite.config.js`.
- With `VITE_API_URL` empty, `/public/trackers/*` hits Vite's SPA fallback
  and returns HTML. `listPublicEntries` guards against non-array responses;
  keep that guard.
- Known and accepted: Live Demonstration pages show "Failed to fetch" on
  ephemeral Vercel preview URLs because API Gateway CORS
  (`infra/lib/constructs/api.ts`) uses a fixed origin list. Don't change it
  without asking.

## Deploys

`master` is production (Vercel auto-deploys). Do feature work on a branch.
Merging to `master` needs an explicit go-ahead. Backend changes need
`cd infra && npx cdk deploy`, which is never automatic.

## Claude Code setup in this repo

Hooks (`.claude/settings.json`, scripts in `.claude/hooks/`, tested by
`npm run test:hooks`):

| Event | Hook | What it does |
|---|---|---|
| SessionStart | `session-context.mjs` | Warns if you're on `master` (production) or missing `.env.local`, and reminds you about the PWA cache. |
| PreToolUse | `guard-edits.mjs` | Blocks edits to real env files and CDK outputs, credentials in any file, secret-looking `VITE_*` variables, and `dangerouslyAllowBrowser: true`. |
| PostToolUse | `check-after-edit.mjs` | Runs `vitest related` for the edited file, or the infra tests for Lambda edits. |
| Stop | `stop-gate.mjs` | Before finishing: runs the full suite(s) for what changed, and requires `ascend-reviewer` for security-relevant changes and `portfolio-fact-checker` for public portfolio changes, once per change set. |

Skills: `/add-tracker`, `/add-ai-endpoint`.

Subagents:
- `ascend-reviewer`: read-only. Finds candidate issues, then tries to
  disprove each as a concrete actor + request + outcome path, and reports
  only what survives (CONFIRMED / PLAUSIBLE) with a merge verdict.
- `portfolio-fact-checker`: checks every claim on the public portfolio
  against `public/Edgar_Resume.pdf` and the project repos, and flags
  anything contradicted, unverified, inflated, or inconsistent across
  pages. Pass "full" for a whole-site audit.
