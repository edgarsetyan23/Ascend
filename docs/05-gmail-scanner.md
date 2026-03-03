# Ascend — Gmail Email Scanner

## What this document covers
How the Gmail email scanner works end-to-end: the OAuth flow, Gmail API calls, Claude Haiku classification, deduplication, and the two-section import modal. Useful for explaining the feature in interviews.

---

## The idea

Manually logging every job application is friction. The scanner lets you point Ascend at your Gmail inbox once, find all application and follow-up emails from the last 90 days, and review what Claude extracted — not just importing new applications but also detecting status changes (interview invites, rejections, offers) on applications you're already tracking.

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
POST /api/scan-emails  (emails + existing tracked entries as context)
       │
       ▼
Claude Haiku classifies each email:
  ├── new_application  →  { company, role, appliedDate, source }
  └── follow_up        →  { matchedEntryId, company, role, suggestedStatus, emailDate }
       │
       ▼
Deduplication  →  filter new apps already in tracker
Follow-up filter  →  remove follow-ups where status already matches
       │
       ▼
Review modal — two sections:
  ├── New Applications  (checkboxes → addEntry × n)
  └── Status Updates    (checkboxes → updateEntry × n)
       │
       ▼
DynamoDB (optimistic UI — rows appear instantly)
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

Search query (broad — covers both application confirmations and follow-up emails):
```
("thank you for applying" OR "application received" OR "application submitted" OR
"we received your application" OR "application confirmation" OR "your application for" OR
"applied to" OR "thanks for applying" OR "application to" OR
"we have received your application" OR
"interview" OR "next steps" OR "offer" OR "unfortunately" OR "move forward") newer_than:90d
```

Then for each message ID:
```
GET /gmail/v1/users/me/messages/{id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date
```

`format=metadata` means Gmail returns only the requested headers and the `snippet` field — **no message body HTML, no attachments, nothing else**. All fetches fire in parallel via `Promise.all`.

---

## Serverless function: `api/scan-emails.js`

**Input:**
```json
{
  "emails": [{ "subject": "...", "from": "...", "date": "...", "snippet": "..." }],
  "existingEntries": [{ "id": "...", "company": "...", "role": "...", "status": "..." }]
}
```

**What Claude does:** Each email is classified as either `new_application` (application confirmation) or `follow_up` (interview invite, rejection, offer, next steps). For follow-ups, Claude performs a fuzzy match against the provided existing entries by company and role name, and returns the `id` of the best match along with a suggested new status.

**Output:**
```json
{
  "applications": [{ "company": "...", "role": "...", "appliedDate": "...", "source": "..." }],
  "followUps": [{ "matchedEntryId": "...", "company": "...", "role": "...", "suggestedStatus": "...", "emailDate": "..." }]
}
```

**Model:** `claude-haiku-4-5-20251001` — fast and cheap, sufficient for structured classification from short metadata.

**Security:** No Gmail data is stored. The function receives subject/from/date/snippet, returns structured JSON. Nothing is written to DynamoDB by this function.

**Conservative matching:** If Claude cannot confidently match a follow-up to an existing entry, it falls back to treating the email as a `new_application`. False positives (wrongly updating a status) are worse than false negatives.

---

## Deduplication and filtering

**New applications:** filtered against existing tracker entries by case-insensitive `company|role` pair. Prevents re-importing the same application if you scan Gmail multiple times.

**Follow-ups:** filtered to only show entries where the suggested status differs from the current status. An already-rejected application with another rejection email is a no-op.

---

## Review modal

The modal has two independent sections, each with its own select/deselect all:

**New Applications** — pre-selected; importing calls `addEntry` with `status: 'Applied'`.

**Status Updates** — pre-selected; shows the transition ("Applied → Phone Screen"); applying calls `updateEntry(id, { status })` on the matched existing entry.

Empty state: shown if Gmail had no matching emails, all new apps were already tracked, and all follow-up statuses already match.

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | `.env.local` + Vercel | OAuth client ID — public, protected by allowed origins in Google Cloud |
| `ANTHROPIC_API_KEY` | Vercel only | Claude API — never in frontend bundle |

The Gmail API calls go directly from the browser to `gmail.googleapis.com` — no proxy, no server.

---

## Google Cloud Console setup

1. Create a project → Enable **Gmail API**
2. Configure **OAuth consent screen** (External, Testing status, add your Gmail as test user)
3. Create **OAuth 2.0 Client ID** (Web application)
4. Add authorized redirect URIs: `http://localhost:5173/oauth-callback` and your production domain equivalent
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
| Incorrect status updates | Conservative Claude matching — unconfident follow-ups fall back to new_application |
