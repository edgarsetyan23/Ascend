# Ascend — Portfolio Layer

## What this document covers
The public `/portfolio` route: what it is, how it's secured, what it shows, and how to talk about it in conversations with hiring managers.

---

## The idea

Ascend is a private productivity tool — everything behind an auth gate. But the app itself is a portfolio artifact. A recruiter or hiring manager clicking a link shouldn't have to create an account just to see what was built.

The portfolio layer solves this: a public, read-only page at `edgarsetyan.com/portfolio` that showcases:

1. A real resume (experience, projects, skills, education)
2. A live Claude AI resume scorer (try it with any PDF)
3. Live tracker data pulled from DynamoDB right now — real data, not screenshots

---

## Route structure

```
/portfolio       →  RecruiterView     (no auth, React Router public route)
/oauth-callback  →  OAuthCallback     (Gmail OAuth redirect landing, no auth)
/                →  AuthGate          (requires Cognito login)
*                →  NotFound          (404 page — cosmic mythology theme)
```

In `App.jsx`:
```jsx
<Routes>
  <Route path="/portfolio" element={<RecruiterView />} />
  <Route path="/oauth-callback" element={<OAuthCallback />} />
  <Route path="/" element={<AuthGate><AppShell /></AuthGate>} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

React Router evaluates routes top to bottom. The named routes (`/portfolio`, `/oauth-callback`) match first; `/` matches only the root exactly; `*` catches everything else and renders the 404 page.

The route was intentionally named `/portfolio` rather than something more revealing — it's a public showcase, not an internal tool.

The `vercel.json` SPA rewrite sends all paths to `index.html`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
Without this, a direct browser load of `/recruiter` would return a 404 from Vercel's CDN (no physical file exists there).

---

## Backend: the public Lambda

### Why a separate Lambda function

The authenticated `ascend-entries-list` Lambda calls `getUserId(event)` to extract the Cognito sub from the JWT. The public Lambda never sees a JWT at all.

If these were the same function with an "is this a public request?" flag, a bug in that flag could expose any user's data. Separation means there's **no code path** that can accidentally bypass auth.

### Security model

| Threat | Mitigation |
|---|---|
| Reading another user's data | `OWNER_USER_ID` is baked into the Lambda env var at deploy time — no user input ever touches the DynamoDB partition key |
| Accessing Gaming or Jobs data | Whitelist in Lambda: only `'leetcode'` and `'activity'` are allowed. Everything else returns 404 |
| Writing data | IAM: `table.grantReadData(publicListFn)` — this Lambda's execution role has zero write permissions |
| Leaking which trackers exist | Non-whitelisted trackers return 404, not 403 — a 403 would confirm the route exists |

### Route (no authorizer)

In `infra/lib/constructs/api.ts`:
```typescript
this.httpApi.addRoutes({
  path: '/public/trackers/{trackerId}/entries',
  methods: [HttpMethod.GET],
  integration: new HttpLambdaIntegration('PublicListIntegration', publicListFn),
  // authorizer intentionally omitted
})
```

The private CRUD routes all use `addRoute()` (a helper that attaches the JWT authorizer). The public route calls `addRoutes()` directly and omits the authorizer key.

### Getting OWNER_USER_ID

```bash
aws dynamodb scan \
  --table-name AscendData \
  --projection-expression "PK" \
  --region us-east-1 \
  --output json | grep -o '"USER#[^"]*"' | sort -u
```

Strip `USER#` prefix → that's the Cognito sub. It's saved in `infra/.env`. Always source it before deploying — if you forget, the public Lambda loses the variable and returns 500:
```bash
source infra/.env && npx cdk deploy --require-approval never
```

---

## Frontend: RecruiterView

### Dark mode

`RecruiterView` calls `useTheme()` directly. This is the same hook used in `AppShell`. It reads the stored preference from `localStorage` on mount and sets `data-theme` on `document.documentElement`. The CSS vars (`--bg`, `--bg-surface`, `--accent`, etc.) then apply the correct theme everywhere on the page.

Without this call, the page would always render in light mode because `data-theme` would never be set.

### Theme toggle

The nav bar includes `<ThemeToggle>` from the same component used in the main app. Same behavior, same CSS.

### Public API fetch

`src/lib/publicApi.js`:
```js
export async function listPublicEntries(trackerId) {
  const res = await fetch(`${BASE_URL}/public/trackers/${trackerId}/entries`)
  // ...
}
```

No `Authorization` header. The browser calls the API Gateway public route directly. Two calls fire in parallel via `Promise.all` on mount.

### LeetCode profile banner

`RecruiterView` renders `<LeetCodeProfile fixedUsername="user2986fQ" fixedDisplayName="Eddy-Setyan" />`. The `fixedUsername` prop bypasses the localStorage prompt flow entirely — the banner always shows Edgar's data, no edit controls, read-only. The component fetches from `/api/leetcode-stats?username=user2986fQ` (Vercel serverless proxy to LeetCode GraphQL, CDN-cached 5 min).

### Resume analyzer

`RecruiterView` imports `ScoreCircle`, `CatBar`, `DropZone`, `scoreResume`, and `extractTextFromPdf` from `ResumeReview.jsx` (these were given named exports in this session).

The scoring call:
```
Browser → POST /api/analyze-resume → Vercel Serverless → Anthropic Claude API
                                                        ← JSON result
```

`/api/analyze-resume` is a Vercel function (`api/analyze-resume.js`) — it runs on Vercel's infrastructure, not AWS. It needs `ANTHROPIC_API_KEY` set in Vercel's environment. It has no auth of its own — any caller can POST to it.

Nothing is saved. The recruiter page has no DynamoDB write path.

---

## How to describe this in an interview

**Short version (30 seconds):**
> "I added a public recruiter page to my personal tracking app. It's a separate unauthenticated route backed by a dedicated read-only Lambda. The owner's user ID is baked into the Lambda environment so no user input ever touches the DynamoDB partition key. There's a whitelist that rejects any tracker not in the allowed list — returns 404, not 403, so it doesn't leak which trackers exist."

**If they ask about the frontend:**
> "React Router handles the routing. The public route comes before the catch-all auth route so it never hits the auth gate. I added a vercel.json SPA rewrite so direct URL loads work — without it, Vercel's CDN would return 404 since there's no physical file at /portfolio."

**If they ask about the Claude integration:**
> "The resume scorer is a Vercel serverless function that POSTs to the Anthropic API. On the recruiter page, visitors can drop any PDF — the text gets extracted client-side with pdf.js, sent to the function, scored across six weighted categories, and the results render with the same animated components from the main app. Nothing is stored."
