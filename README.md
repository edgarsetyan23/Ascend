# Ascend

A personal accountability tracker built with a production AWS stack. Tracks LeetCode progress, job applications, daily activity, and gaming sessions — with a public portfolio view for recruiters.

**Live:** [edgarsetyan.com](https://edgarsetyan.com) · **Portfolio:** [edgarsetyan.com/portfolio](https://edgarsetyan.com/portfolio)

![Ascend demo](docs/demo.gif)

---

## Architecture

```
Browser (React + Vite)
        │
        ├── AWS API Gateway (HTTP API v2)
        │       ├── JWT Authorizer → Cognito
        │       ├── Lambda (CRUD) → DynamoDB
        │       └── Lambda (public, read-only, whitelist) → DynamoDB
        │
        └── Vercel Serverless Functions
                ├── /api/leetcode-stats   → LeetCode GraphQL (CDN-cached)
                ├── /api/scan-emails      → Anthropic Claude Haiku
                └── /api/analyze-resume  → Anthropic Claude Sonnet
```

**Frontend:** React 18, Vite, React Router v7 — hosted on Vercel with a custom domain

**Backend:** AWS CDK (TypeScript) — API Gateway HTTP API v2, Lambda (ARM64, Node 22), DynamoDB single-table design, Cognito User Pool

**Infrastructure as code:** Everything in `infra/` — one `cdk deploy` provisions the entire stack

---

## Key Features

**Tracker types**
- LeetCode problems — difficulty, category, status, notes
- Job applications — company, role, status, source
- Daily activity log — title, category, impact, duration
- Gaming sessions

**Gmail scanner** — OAuth redirect flow opens a new tab, fetches metadata for up to 50 matching emails, pipes subject/from/date/snippet through Claude Haiku, shows a review modal to bulk-import detected job applications. Email body is never fetched.

**LeetCode profile banner** — Vercel serverless proxy to LeetCode's GraphQL API, CDN-cached 5 minutes. Shows solved count, difficulty breakdown, language stats.

**Resume scorer** — Drop any PDF on the portfolio page. Text is extracted client-side with pdf.js, scored by Claude across 6 weighted categories (Metrics & Impact, Action Verbs, AWS Depth, Tech Keywords, Structure, Length).

**Public portfolio page** — `/portfolio` is unauthenticated. A dedicated read-only Lambda hardcodes the owner's Cognito sub as the DynamoDB partition key — no user input touches the PK. Tracker whitelist returns 404 (not 403) for non-allowed trackers.

---

## Notable Design Decisions

| Decision | Reason |
|---|---|
| HTTP API v2 over REST API | 30–60% cheaper, lower latency, native JWT authorizer |
| ARM64 Lambda | ~20% cheaper than x86 at identical performance |
| DynamoDB single-table | One `Query` per tab load — `begins_with(SK, "TRACKER#{id}#ENTRY#")` |
| JWT in memory only | Cleared on tab close — eliminates XSS token theft vector |
| Optimistic UI updates | Changes reflect instantly; rolls back if the API call fails |
| Separate public Lambda | Zero code path overlap with authenticated handler |
| Gmail new-tab OAuth | Avoids Cross-Origin-Opener-Policy restrictions on popup-based flows |
| Gmail `format=metadata` | Email body never leaves Gmail's servers |

---

## Project Structure

```
├── src/
│   ├── components/       React components
│   ├── context/          AuthContext, ToastContext
│   ├── hooks/            useEntries (DynamoDB CRUD), useTheme, useNotifications
│   ├── lib/              Cognito SDK wrapper, API client
│   ├── trackers/         Per-tracker config (columns, badges, sort defaults)
│   └── utils/            Stats, streaks, CSV export
├── api/                  Vercel serverless functions
│   ├── leetcode-stats.js
│   ├── scan-emails.js
│   └── analyze-resume.js
├── infra/                AWS CDK (TypeScript)
│   ├── lib/constructs/   API Gateway, Cognito, DynamoDB constructs
│   ├── lambda/           Lambda handler source
│   └── bin/              CDK app entry
└── docs/                 Architecture, positioning, Gmail scanner, roadmap
```

---

## Running Locally

**Prerequisites:** Node 22, AWS CLI configured, CDK bootstrapped

```bash
# Install dependencies
npm install
cd infra && npm install && cd ..

# Set environment variables
cp .env.example .env.local
# Fill in values from your CDK outputs and Google Cloud Console

# Start dev server
npm run dev
```

**Deploy infrastructure:**
```bash
cd infra && npx cdk deploy --require-approval never
# infra/.env is auto-loaded — OWNER_USER_ID is always set
```

**Deploy frontend:**
```bash
npx vercel --prod
```

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_API_URL` | `.env.local` + Vercel | AWS API Gateway base URL |
| `VITE_COGNITO_REGION` | `.env.local` + Vercel | AWS region |
| `VITE_USER_POOL_ID` | `.env.local` + Vercel | Cognito User Pool ID |
| `VITE_USER_POOL_CLIENT_ID` | `.env.local` + Vercel | Cognito App Client ID |
| `VITE_GOOGLE_CLIENT_ID` | `.env.local` + Vercel | Google OAuth Client ID |
| `ANTHROPIC_API_KEY` | Vercel only | Claude API — never in browser bundle |
| `OWNER_USER_ID` | `infra/.env` | Cognito sub baked into public Lambda at deploy time |

See `.env.example` and `infra/.env.example` for templates.

---

## Docs

Full write-ups in `docs/`:

- `00-start-here.md` — how to understand the codebase in a week
- `01-architecture.md` — system design and decisions
- `03-recruiter-layer.md` — public portfolio layer and security model
- `05-gmail-scanner.md` — OAuth flow, Gmail API, Claude extraction
- `04-positioning.md` — interview narrative and talking points
