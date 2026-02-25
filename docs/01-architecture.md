# Ascend — Architecture

## What this document covers
How the three layers of Ascend fit together: the browser, the API, and the data store. Read this when you want to explain the system in an interview or understand why things are structured the way they are.

---

## The three-layer model

```
Browser (React + Vite)          Vercel CDN + Serverless        Google APIs
        │                               │                            │
        │  HTTPS fetch                  │  /api/analyze-resume       │  gmail.googleapis.com
        │                               │  /api/scan-emails          │  (metadata only)
        ▼                               ▼                            ▼
API Gateway (HTTP API v2)       Vercel Serverless Functions    Gmail API
        │                         (Anthropic Claude API)       (gmail.readonly scope)
        ├── JWT Authorizer
        │       │
        │       ▼
        │   Lambda (CRUD) ──────► DynamoDB
        │
        └── Public Route (no auth)
                │
                ▼
            Lambda (read-only, whitelist) ──► DynamoDB
```

---

## Component breakdown

### Frontend — React + Vite (Vercel)

| File | Role |
|---|---|
| `src/main.jsx` | React root. Wraps the tree: `BrowserRouter > ToastProvider > AuthProvider > App` |
| `src/App.jsx` | Route guard. `/portfolio` and `/oauth-callback` are public; `/` requires auth via `AuthGate`; `*` renders `NotFound` |
| `src/components/AppShell` | The authenticated app: sidebar, topbar, tracker table, modals |
| `src/hooks/useEntries.js` | All DynamoDB reads/writes live here. Optimistic updates with rollback |
| `src/context/AuthContext.jsx` | Cognito session state — JWT stored in memory only, never localStorage |
| `src/context/ToastContext.jsx` | Global toast system. Any component calls `useToast().addToast()` |
| `src/trackers/` | Config files for each tracker (columns, badges, sort defaults) |

### Backend — AWS (CDK-managed)

| Resource | Role |
|---|---|
| API Gateway HTTP API v2 | Single entry point for all backend calls. Handles CORS |
| JWT Authorizer | Validates Cognito IdTokens before Lambda ever executes |
| `ascend-entries-list` | `GET /trackers/{id}/entries` — queries DynamoDB by USER# PK |
| `ascend-entries-create` | `POST /trackers/{id}/entries` — writes new item |
| `ascend-entries-update` | `PUT /trackers/{id}/entries/{entryId}` — overwrites item data |
| `ascend-entries-delete` | `DELETE /trackers/{id}/entries/{entryId}` — deletes item |
| `ascend-public-entries-list` | `GET /public/trackers/{id}/entries` — **no auth**, whitelist only |
| DynamoDB `AscendData` | Single table. PK = `USER#{sub}`, SK = `TRACKER#{id}#ENTRY#{uuid}` |
| Cognito User Pool | Handles sign-up, sign-in, MFA, JWT issuance |

---

## DynamoDB data model

Single-table design — one table holds all users and all tracker types.

```
PK                              SK                                    data
─────────────────────────────── ────────────────────────────────────── ──────────────────────────────
USER#8448d468-...               TRACKER#leetcode#ENTRY#abc123          { problem: "Two Sum", ... }
USER#8448d468-...               TRACKER#activity#ENTRY#def456          { title: "Morning run", ... }
USER#8448d468-...               TRACKER#jobs#ENTRY#ghi789              { company: "Google", ... }
```

Why single-table:
- One `Query` call per tracker tab load — `begins_with(SK, "TRACKER#{id}#ENTRY#")`
- No cross-table joins needed
- One set of IAM policies to manage

---

## Auth flow

```
1. User enters email + password in AuthGate form
2. Cognito SDK (amazon-cognito-identity-js) exchanges credentials for 3 tokens:
   - IdToken (JWT, 1hr TTL) — sent in Authorization header
   - AccessToken — not used
   - RefreshToken (30 days) — used to silently renew the IdToken
3. IdToken is stored in React state (memory only)
4. Every API call: Authorization: Bearer <IdToken>
5. API Gateway JWT Authorizer validates signature, audience, expiry
6. Lambda receives event.requestContext.authorizer.jwt.claims.sub (= Cognito sub)
7. sub is used as the DynamoDB PK: USER#{sub}
```

Security properties:
- Token never touches disk — cleared on tab close
- JWT Authorizer runs at the API Gateway layer — Lambda can't even be invoked without a valid token
- Each user can only read/write their own PK — no user ID in the request body, only from the verified JWT

---

## Public endpoint (portfolio page)

The `/public/trackers/{id}/entries` route has **no authorizer**. Instead:

1. `OWNER_USER_ID` is baked into the Lambda environment variable at deploy time
2. The Lambda reads this env var and queries `USER#{OWNER_USER_ID}`
3. A hardcoded whitelist rejects any `trackerId` not in `['leetcode', 'activity']`
4. IAM: `grantReadData` only — this Lambda cannot write anything

Result: a recruiter can call `GET /public/trackers/leetcode/entries` and get data, but cannot access gaming/jobs data, cannot write anything, and cannot access any other user's data because the partition key is hardcoded server-side.

---

## Infrastructure as code (CDK)

Everything in `infra/` is defined in TypeScript CDK:

```
infra/
├── bin/app.ts              CDK app entry — instantiates the stack
├── lib/
│   ├── ascend-stack.ts     Top-level stack — wires table + auth + API together
│   └── constructs/
│       ├── api.ts          API Gateway + all Lambda functions + routes
│       ├── auth.ts         Cognito User Pool + App Client
│       └── database.ts     DynamoDB table definition
└── lambda/
    ├── entries-list.mjs    CRUD handlers
    ├── entries-create.mjs
    ├── entries-update.mjs
    ├── entries-delete.mjs
    ├── public-entries-list.mjs   Unauthenticated public handler
    └── shared/
        ├── auth.mjs        JWT sub extraction
        ├── db.mjs          Singleton DynamoDB client
        └── response.mjs    ok() / err() helpers
```

Deploy command:
```bash
OWNER_USER_ID="<cognito-sub>" npx cdk deploy --require-approval never
```

**Important:** `OWNER_USER_ID` must be set on every CDK deploy or the public Lambda loses its environment variable and returns 500. The value is saved in `infra/.env` — source it before deploying:
```bash
source infra/.env && npx cdk deploy --require-approval never
```

To look up the value if lost:
```bash
aws dynamodb scan --table-name AscendData --projection-expression "PK" \
  --region us-east-1 --output json | grep -o '"USER#[^"]*"' | sort -u
```

CDK synthesizes a CloudFormation template and uploads Lambda bundles to S3. CloudFormation handles the actual resource creation/update.

---

## Key architectural decisions and why

| Decision | Why |
|---|---|
| HTTP API v2 (not REST API) | 30–60% cheaper, lower latency, built-in JWT authorizer |
| ARM_64 Lambda | ~20% cheaper than x86 at identical performance |
| Single DynamoDB table | One query per page load, simpler IAM, no joins |
| Tokens in memory | Eliminates XSS token theft — attacker can read DOM but not a JS variable in a different scope |
| Optimistic UI updates | Instant perceived performance — UI reflects changes before the API responds |
| Separate public Lambda | Zero code path overlap with authenticated handler — can't accidentally skip auth |
| Gmail redirect-to-new-tab OAuth | Avoids Cross-Origin-Opener-Policy restrictions that silently break popup-based OAuth flows; token passed via localStorage storage event and deleted immediately |
| Gmail format=metadata | Email body never leaves Gmail's servers; only subject/from/date/snippet sent to Claude |
| LeetCode stats proxy (`/api/leetcode-stats`) | Vercel serverless function proxies LeetCode's GraphQL API; CDN-cached 5 min — avoids CORS issues calling LeetCode directly from the browser |
| LeetCode username in localStorage | No account link needed; user enters their handle once, stored as a preference, settable display name stored separately |
| Custom domain (`edgarsetyan.com`) | Namecheap DNS → Vercel. A record `@` → `216.198.79.1`, CNAME `www` → Vercel DNS. CORS allowlist in `api.ts` must include the domain or all API calls fail |
| Forgot password via Cognito | `cognitoUser.forgotPassword()` emails a reset code; `confirmPassword(code, newPassword)` sets the new one. Two new modes in `AuthGate`: `forgot` and `reset` |
