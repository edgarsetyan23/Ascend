# Ascend — Gmail Email Scanner

## What this document covers
How the Gmail email scanner works end-to-end: the OAuth flow, Gmail API calls, Claude Haiku extraction, deduplication, and the import modal. Useful for explaining the feature in interviews.

---

## The idea

Manually logging every job application is friction. The scanner lets you point Ascend at your Gmail inbox once, find all application confirmation emails from the last 90 days, review what Claude extracted, and import them in bulk — without ever leaving the app.

---

## End-to-end flow

```
[Scan Emails button]
       │
       ▼
window.open() → new tab → accounts.google.com (OAuth implicit grant)
       │
       ▼ (user signs in, Google redirects to /oauth-callback)
OAuthCallback tab: localStorage.setItem('gmail-scan-token', token) → window.close()
       │
       ▼ ('storage' event fires in original tab)
EmailScanner: picks up token → starts scan
       │
       ▼
Gmail API  →  message list (broad keyword search, last 90 days, max 50)
       │
       ▼
Gmail API  →  metadata fetch per message (Subject, From, Date headers + snippet)
              format=metadata — email body never fetched
       │
       ▼
POST /api/scan-emails  →  Claude Haiku  →  [{ company, role, appliedDate, source }]
       │
       ▼
Deduplication  →  filter out company+role pairs already in tracker
       │
       ▼
Review modal  (checkboxes — select/deselect per entry)
       │
       ▼
addEntry() × n  →  DynamoDB (optimistic UI — rows appear instantly)
```

---

## OAuth: redirect flow (new tab, no popup)

The scanner uses the **OAuth 2.0 implicit grant** with a redirect into a new tab rather than a popup. The original implementation used the Google Identity Services (GSI) `initTokenClient` popup model, but this approach is silently broken by strict browser security configurations that enforce `Cross-Origin-Opener-Policy` — the GIS library polls `window.closed` on the OAuth popup, which COOP blocks, so the token callback never fires and the UI stays stuck in "Scanning…" with no error.

**Current flow:**
1. `window.open(oauthUrl, '_blank')` — opens Google sign-in in a new tab
2. User authenticates → Google redirects to `/oauth-callback` in that tab
3. `OAuthCallback` writes the token to `localStorage` and calls `window.close()`
4. `localStorage.setItem` fires a `storage` event in all other open tabs
5. `EmailScanner` listens for `e.key === 'gmail-scan-token'` and starts scanning

**Why localStorage for cross-tab signaling:** `sessionStorage` is tab-scoped — a write in one tab is invisible to another. `localStorage` is shared across all tabs on the same origin, and writes fire a `storage` event in every tab except the one that wrote it. This makes it the correct primitive for cross-tab messaging without a service worker or BroadcastChannel.

**Scope:** `https://www.googleapis.com/auth/gmail.readonly` — read-only access to message metadata. Cannot send, modify, or delete anything.

**Google Cloud Console setup required:**
- Authorized redirect URIs must include `https://edgarsetyan.com/oauth-callback`
- No authorized JavaScript origins needed (those are only for the popup/GIS model)

---

## Gmail API: metadata-only fetches

```
GET /gmail/v1/users/me/messages?q=<query>&maxResults=50
```

Search query (broad — no `subject:` restriction, matches body text too):
```
("thank you for applying" OR "application received" OR "application submitted" OR
"we received your application" OR "application confirmation" OR "your application for" OR
"applied to" OR "thanks for applying" OR "application to" OR
"we have received your application") newer_than:90d
```

The original query used `subject:(...)` which missed many confirmation emails where the key phrases appear in the body rather than the subject line. Removing the `subject:` restriction significantly increases recall.

Then for each message ID:
```
GET /gmail/v1/users/me/messages/{id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date
```

`format=metadata` means Gmail returns only the requested headers and the `snippet` field — **no message body HTML, no attachments, nothing else**. All 50 fetches fire in parallel via `Promise.all`.

---

## Serverless function: `api/scan-emails.js`

Same pattern as `api/analyze-resume.js`.

**Input:** `{ emails: [{ subject, from, date, snippet }] }`

**System prompt key instruction:** Return only a JSON array with exactly `company`, `role`, `appliedDate` (YYYY-MM-DD), `source` keys. Empty string for unknown fields. Return `[]` if nothing found.

**Model:** `claude-haiku-4-5-20251001` — fast and cheap, sufficient for structured extraction from short metadata.

**Security:** No Gmail data is stored. The function receives subject/from/date/snippet and returns structured JSON. Nothing is written to DynamoDB by this function — imports happen client-side via `addEntry`.

---

## Deduplication

Before showing the modal, detected applications are filtered against existing tracker entries:

```js
const existingKeys = new Set(
  entries.map(e => `${e.company?.toLowerCase()}|${e.role?.toLowerCase()}`)
)
const newApps = applications.filter(
  a => !existingKeys.has(`${a.company?.toLowerCase()}|${a.role?.toLowerCase()}`)
)
```

Case-insensitive match on `company|role` pair. This prevents re-importing the same application if you scan Gmail multiple times.

---

## Review modal

- All detected applications are pre-selected (opt-out model, not opt-in)
- Header checkbox selects/deselects all
- "Import N Selected" calls `addEntry` for each checked row with `status: 'Applied'`
- Empty state: shown if Gmail had no matching emails, or all matches were already tracked

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | `.env.local` + Vercel | GSI `initTokenClient` — public, protected by allowed origins in Google Cloud |
| `ANTHROPIC_API_KEY` | Vercel only | Claude API — never in frontend bundle |

The Gmail API calls go directly from the browser to `gmail.googleapis.com` — no proxy, no server.

---

## Google Cloud Console setup

1. Create a project → Enable **Gmail API**
2. Configure **OAuth consent screen** (External, Testing status, add your Gmail as test user)
3. Create **OAuth 2.0 Client ID** (Web application)
4. Add authorized JavaScript origins: `http://localhost:5173` and your production domain
5. Copy Client ID → set as `VITE_GOOGLE_CLIENT_ID`

The app does **not** need to pass Google verification as long as you stay in Testing status and only your own Gmail account uses it.

---

## Security summary

| Concern | Mitigation |
|---|---|
| Scope creep | `gmail.readonly` only — no send, modify, delete |
| Token persistence | React state only — cleared on tab close |
| Email body exposure | `format=metadata` — body never fetched |
| Server-side storage | None — `api/scan-emails.js` is stateless |
| Client ID leakage | Intentionally public; protected by allowed origins in Google Cloud Console |
| Unauthorized domain use | Google rejects OAuth requests from origins not in the allow-list |

---

## How to describe this in an interview

**Short version (30 seconds):**
> "I added a Gmail scanner to the job tracker. It uses a redirect-based OAuth implicit grant — opens a new tab for sign-in, the callback stores the token in localStorage so a storage event delivers it back to the original tab, and then we fetch metadata for up to 50 matching emails, send subject/from/date/snippet to a Vercel function backed by Claude Haiku, and show a review modal to bulk-import. Email body is never fetched, nothing is stored server-side."

**If they ask about the OAuth approach:**
> "The original implementation used the Google Identity Services popup model. That approach is silently broken by browsers with strict security configurations that enforce Cross-Origin-Opener-Policy — the GIS library polls window.closed on the OAuth popup, which COOP blocks, so the token callback never fires. I switched to a redirect-into-new-tab flow: the callback page writes the token to localStorage and closes itself, which fires a storage event that the original tab catches. No popup, no cross-window property access needed."

**If they ask about security:**
> "Three things keep it safe: the scope is gmail.readonly so there's no write access at all, format=metadata means the email body never leaves Gmail's servers, and the access token is written to localStorage only momentarily — it's deleted the moment the storage event handler reads it."
