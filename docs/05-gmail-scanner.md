# Gmail scanner

Ascend searches application-related Gmail messages from the last 90 days, up to 50 results. It reads subject, sender, date, and snippet with `format=metadata`; full bodies and attachments are not fetched. Metadata is sent to Anthropic for suggested applications and status changes. The user reviews selections before any tracker write.

## OAuth handoff

1. `EmailScanner.jsx` generates an unpredictable state value and opens Google sign-in in a separate tab.
2. Google redirects to `/oauth-callback`. The callback reads the fragment, removes it from browser history, and posts the result through `BroadcastChannel('gmail-scan-oauth')`.
3. The scanner accepts only the current, unused state value and expires pending sign-ins after five minutes. Cancellation and expiry show retry feedback.
4. The Gmail token is used by the browser. It is not written to localStorage or sent to Ascend's serverless function.

The scope is `gmail.readonly`, which permits broader reading than the metadata-only requests this implementation makes. It does not permit sending or modifying messages.

## Classification and saving

The browser sends email metadata plus tracked company/role/status context to `/api/scan-emails`, using the current Cognito ID token. The server verifies its signature and claims against the configured pool before calling Claude Haiku 4.5. Requests have size, field, count, and runtime limits; optional Redis counters share quotas across instances.

Claude uses JSON Schema structured output for `{ applications, followUps }`. The server validates types, allowed statuses, dates, and follow-up IDs against supplied entries. The client filters duplicates and unchanged statuses. Review selections then call the authenticated create/update API.

A valid response can still misclassify an email. The project has no labelled accuracy evaluation, and suggestions are not applied automatically. The public sample demo uses fictional entries and makes no Gmail, model, or database calls.

## Setup

Enable Gmail API in Google Cloud, create a web OAuth client, and add the deployed `/oauth-callback` URL and its local equivalent to the authorized redirect URIs. Set `VITE_GOOGLE_CLIENT_ID` for the frontend. The Vercel functions need server-only `ANTHROPIC_API_KEY` and the existing Cognito pool/client deployment variables. If the OAuth app is in Testing status, add the accounts that should be able to sign in as test users.

The live app and Google settings should be checked together before changing consent-screen or verification status.
