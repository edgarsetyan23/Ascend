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
4. An engineering case study on the Ascend exhibit itself, for anyone who wants more than the résumé bullets — see "Engineering case study" below

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

Strip `USER#` prefix → that's the Cognito sub. It's saved in `infra/.env`. It's saved in `infra/.env`. `bin/ascend.ts` auto-loads it via dotenv on every CDK run — no manual step needed.

---

## Frontend: RecruiterView

### Dark mode

`RecruiterView` calls `useTheme('light', 'portfolio-theme')` — the same hook `AppShell` uses, but with its own default (light, not the tracker app's dark default) and its own storage key, so toggling theme here doesn't affect Edgar's own tracker app and vice versa. It sets `data-theme` on `document.documentElement`; the page's own CSS vars (`--exh-bg`, `--exh-accent`, etc., defined under `.exh-page` in `exhibit-view.css`) then apply the correct theme.

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

### The Ascend exhibit's engineering case study

The Ascend exhibit (`/portfolio/projects/ascend`) starts with the same short résumé-style summary every other exhibit uses. Below it, a "Show me the engineering →" button (`src/components/RecruiterView.jsx`, `showEngineering` state) reveals `<AscendCaseStudy />` in place — no navigation, no page load, just a state toggle. It resets when you leave the exhibit, so coming back later starts collapsed again.

`src/components/portfolio/AscendCaseStudy.jsx` covers, in order:

1. **The problem** — why one tracker with pluggable tracker types instead of four separate apps.
2. **System overview** — a short request/data-flow explanation plus `AscendArchitectureDiagram.jsx`, a hand-built inline SVG (no generated image) styled with the same `--exh-*` CSS custom properties as the rest of the gallery, with an always-visible text-equivalent list underneath for accessibility and to survive a broken image / high zoom.
3. **Engineering decisions** — three, each with the requirement, the actual implementation (with a source link), and a concrete tradeoff: the single-table DynamoDB access pattern (including that `GSI1` is written on every create but nothing queries it yet — a real gap, not glossed over), the separate public Lambda's single-tenant design, and the Gmail OAuth → Claude → review-modal flow's `localStorage` handoff and heuristic classification.
4. **One workflow in detail** — a numbered trace of "click Scan Emails" through `EmailScanner.jsx` → Gmail API → `api/scan-emails.js` → Claude Haiku → the review modal → `useEntries.js` → `entries-create.mjs` → DynamoDB, ending in an expandable `<details>` showing the actual `PutCommand`.
5. **Limitations and next steps** — specific, code-verified gaps (see point 3), not generic caveats.
6. **Explore** — the interactive demo (below) plus direct GitHub links to the specific files referenced above.

Every technical claim in this section was checked against the current code before being written, not carried over from an earlier design.

### Interactive demo (sample data)

`src/components/portfolio/AscendDemo.jsx`, embedded in the case study's Explore section. Reproduces the Gmail scanner's review-before-import step — four fictional applications (Nimbus Cloud Systems, Solstice Analytics, Riverbed Data Co., Fernwood Robotics), a checkbox per row, "Simulate import" shows exactly which rows would land in the Jobs tracker, "Reset demo" restores the initial state. All state is local `useState` — no `fetch`, no `localStorage`, no Cognito, no Gmail, no Claude call. Labeled "Interactive demo · Sample data" in the UI so it's never mistaken for a live backend operation.

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

## Visual design

The portfolio page runs its own visual layer (`exh-` CSS class prefix, `src/styles/exhibit-view.css` + `src/styles/ascend-case-study.css`) that's independent of the main app's styles — a museum/gallery concept ("The Exhibit"), not a typical dev-portfolio look.

**Palette:** Warm paper background (`--exh-bg: #fffdf7` light / near-black `#14150f` dark) with a soft sage-green accent (`--exh-accent: #4f7a63` light / `#8fc2a6` dark) — no gradients, no glassmorphism, no ambient background animation.

**Typography:** Source Serif 4 for headings and eyebrow labels (`--exh-font-display`), Inter for body copy (`--exh-font-body`), JetBrains Mono for code excerpts (`--exh-font-mono`).

**Layout:** A sidebar of numbered nav groups (Field Work, Studio Projects, Education, Toolkit, Live Demonstrations) next to a single centered "exhibit frame" per page — each experience/project/education entry is a numbered plate (`01`, `02`, ...) with display-case corner brackets, styled like a small museum's placards rather than a resume-shaped list.

**The guide:** A low-poly Three.js character standing in the corner of every exhibit (hidden on mobile and disabled under `prefers-reduced-motion`), with a per-exhibit speech-bubble caption. Clicking "Come on, I'll show you around" on the Introduction plate starts a click-driven guided tour through every exhibit in sidebar order; manual navigation, browser Back/Forward, or "Stop tour" all cancel it immediately rather than fighting a visitor who takes over.

**Contact icons:** Inline SVG paths (GitHub octicon, LinkedIn logo, plain envelope/download glyphs) — no font/glyph dependency. Full labeled links live on the Introduction plate; compact icon-only versions of the résumé/email links stay in the topbar on every other exhibit.

**Featured cards + case study:** The Introduction plate calls out AWS and Ascend with larger, left-accented cards above the category grid. The Ascend exhibit's case study (see above) reuses the same plate/card language — numbered decision cards, the same table styles as the live LeetCode data — rather than introducing a second visual system.

**Light/dark:** Both themes are first-class (`[data-theme="dark"] .exh-page` token overrides), not a dimmed copy of one primary theme.

