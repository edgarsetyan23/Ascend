# Ascend — Start Here

Hey Edgar. This file is for you — a plain-English map of the entire codebase so you can own it fully, not just use it.

A week of focused reading is the right estimate. Here's the order that makes sense.

---

## The mental model (read this first)

Ascend is three things running together:

```
1. React app (browser)
      ↕ HTTPS
2. Two backends:
   a. AWS (your data — auth, DynamoDB, Lambda)
   b. Vercel serverless functions (proxies — LeetCode, Gmail, Claude AI)
      ↕ HTTPS
3. External APIs (LeetCode GraphQL, Gmail API, Anthropic Claude)
```

Everything the user sees is React. Everything that persists data goes through AWS. Everything that talks to third-party APIs goes through Vercel serverless functions (so secrets never touch the browser).

---

## Day 1 — The frontend shell

**Goal:** Understand how the React app is structured and how pages/tabs work.

Read in this order:
1. `src/main.jsx` — where everything starts. Notice the provider nesting order.
2. `src/App.jsx` — four routes. Understand why `/portfolio` comes before `/`.
3. `src/components/Sidebar.jsx` — tab navigation is just `window.location.hash`.
4. `src/components/AppShell` (inside `App.jsx`) — the main layout.

**Key concept:** Hash-based navigation (`#leetcode`, `#jobs`) — React Router handles the page-level routes (`/`, `/portfolio`), but switching between tracker tabs just changes the URL hash and re-renders the same component with different data. No page reload.

---

## Day 2 — Auth

**Goal:** Understand how login works end to end and why it's secure.

Read in this order:
1. `src/components/AuthGate.jsx` — the login UI. Five modes: `login`, `signup`, `confirm`, `forgot`, `reset`.
2. `src/context/AuthContext.jsx` — what the app knows about the current user.
3. `src/lib/cognito.js` — the actual Cognito SDK calls. Each function is a Promise wrapper around a callback-based SDK.

**Key concept:** The JWT (IdToken) lives in React state only — never written to disk. When you close the tab, it's gone. Every API call sends `Authorization: Bearer <token>` in the header. The API Gateway checks it before Lambda even runs.

**Forgot password flow:** `forgotPassword(email)` → Cognito emails a 6-digit code → `confirmPassword(email, code, newPassword)` → done. Cognito handles all of this — you wrote no backend code for it.

---

## Day 3 — Data layer

**Goal:** Understand how entries are fetched, created, updated, deleted.

Read in this order:
1. `src/hooks/useEntries.js` — the single hook that manages all tracker data. Notice optimistic updates: the UI changes instantly, then the API call fires, then rolls back if it fails.
2. `infra/lambda/entries-list.mjs` — what actually runs on AWS when you load a tab.
3. `infra/lambda/shared/db.mjs` — the DynamoDB client.
4. `infra/lib/constructs/api.ts` — how routes are wired up in CDK. Notice CORS `allowOrigins` — this is what you update when the domain changes.

**Key concept:** Single-table DynamoDB design. Every entry for every tracker lives in one table. `PK = USER#{sub}`, `SK = TRACKER#{trackerId}#ENTRY#{uuid}`. A query with `begins_with(SK, "TRACKER#leetcode#ENTRY#")` returns only your LeetCode entries. Fast, one call, no joins.

---

## Day 4 — Infrastructure as code

**Goal:** Understand what CDK is and how it maps to real AWS resources.

Read in this order:
1. `infra/lib/ascend-stack.ts` — the top-level stack. It wires three constructs together.
2. `infra/lib/constructs/database.ts` — the DynamoDB table definition.
3. `infra/lib/constructs/auth.ts` — the Cognito User Pool.
4. `infra/lib/constructs/api.ts` — API Gateway + all Lambdas + routes + CORS.

**Key concept:** CDK is TypeScript code that generates a CloudFormation template. You write `new HttpApi(...)` and CDK figures out what JSON CloudFormation needs. `cdk deploy` uploads Lambda bundles to S3 and tells CloudFormation to create/update resources. You never click in the AWS console.

**Critical gotcha:** Every `cdk deploy` needs `OWNER_USER_ID` set or the public Lambda breaks. It's saved in `infra/.env` — always `source infra/.env` before deploying.

---

## Day 5 — The portfolio layer

**Goal:** Understand the public page and its security model.

Read in this order:
1. `src/components/RecruiterView.jsx` — the public page. It fetches public data and renders your resume.
2. `src/lib/publicApi.js` — the fetch calls to the unauthenticated API route.
3. `infra/lambda/public-entries-list.mjs` — the Lambda that serves public data. No JWT. `OWNER_USER_ID` is the only way it knows whose data to return.

**Key concept:** The security comes from what the Lambda does NOT do — it never reads a user ID from the request. The partition key is hardcoded via env var. A tracker whitelist returns 404 (not 403) for anything not in `['leetcode', 'activity']` so it doesn't reveal what trackers exist.

---

## Day 6 — Vercel serverless functions

**Goal:** Understand the proxy layer and why it exists.

Read in this order:
1. `api/leetcode-stats.js` — proxies LeetCode GraphQL. Accepts `?username=`. CDN-cached.
2. `api/scan-emails.js` — receives email metadata, sends to Claude Haiku, returns structured JSON.
3. `api/analyze-resume.js` — receives resume text, scores it with Claude across 6 categories.

**Key concept:** These functions exist because secrets (`ANTHROPIC_API_KEY`) can't be in the browser bundle, and some APIs block browser requests (CORS). The Vercel function runs server-side, calls the external API with the secret, and returns just the data the browser needs. The browser never sees the key.

---

## Day 7 — Gmail scanner

**Goal:** Understand the OAuth flow and why it's structured the way it is.

Read in this order:
1. `src/components/EmailScanner.jsx` — the UI and OAuth trigger.
2. `src/components/OAuthCallback.jsx` — the redirect landing page.
3. `api/scan-emails.js` — the Claude extraction step.
4. `docs/05-gmail-scanner.md` — full explanation with diagrams.

**Key concept:** The OAuth flow uses a new tab instead of a popup to avoid browser security restrictions. The callback tab writes the token to `localStorage` and closes. `localStorage` writes fire a `storage` event in all other open tabs — the scanner tab catches it and starts scanning. The token is deleted immediately after reading.

---

## The deploy checklist (when you change things)

| What changed | What to run |
|---|---|
| Frontend only (React, CSS) | `npx vercel --prod` |
| Vercel serverless functions (`api/*.js`) | `npx vercel --prod` |
| AWS infrastructure (Lambda, DynamoDB, CORS) | `source infra/.env && cd infra && npx cdk deploy --require-approval never` |
| Added a new domain / changed domain | Update CORS in `infra/lib/constructs/api.ts` → CDK deploy |
| Changed OAuth redirect URI | Update Google Cloud Console → Credentials → OAuth Client |

---

## The one thing that will trip you up most

**CORS.** When a browser makes a request from `edgarsetyan.com` to `execute-api.us-east-1.amazonaws.com`, the browser first sends a preflight `OPTIONS` request to check if the domain is allowed. If `edgarsetyan.com` isn't in `allowOrigins` in `api.ts`, every API call silently fails.

Any time you change domains or add a new one — update `api.ts` and redeploy CDK. That's it.

---

You built something real. Own it.
