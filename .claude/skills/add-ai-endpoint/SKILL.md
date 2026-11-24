---
name: add-ai-endpoint
description: Add a new Claude-backed Vercel function to Ascend (api/*.js) with the repo's required protections — origin/size validation, rate limiting, structured output, server-side validation, and mocked tests. Use when adding any feature that calls the Anthropic API.
---

# Add an AI endpoint

Both existing AI endpoints (`api/analyze-resume.js`, `api/scan-emails.js`)
follow the same pattern. A new one must too. Read `api/analyze-resume.js`
first. It's the template.

## 1. Schema and validator — `api/_lib/structured-output.js`

- Add `export const <feature>Schema = object({...})` using the local
  `string` / `array` / `object` helpers. `object()` sets
  `additionalProperties: false` and `required`, which strict structured
  output needs.
- Add `export function validate<Feature>(result, ...context)` that checks
  everything the schema can't: numeric bounds, enum membership, uniqueness,
  date formats, and that any IDs the model returns exist in the input.
  Throw on violation. A response can match the schema and still be wrong.

## 2. Handler — `api/<feature>.js`

The order is the contract:

```js
import Anthropic from '@anthropic-ai/sdk'
import { validateJSONRequest, reserveAIRequest, sendAIError /*, requireTrackerUser */ } from './_lib/ai-protection.js'
import { <feature>Schema, parseStructuredOutput, validate<Feature> } from './_lib/structured-output.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try { validateJSONRequest(req, <maxBytes>) } catch (error) { return sendAIError(res, error) }
  // await requireTrackerUser(req)  <- if it touches the user's private data
  // validate input fields/lengths -> 400/413 BEFORE any model call
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'API key not configured' })

  let release
  try {
    release = await reserveAIRequest(req, '<feature>')   // unique feature key
    res.setHeader?.('Cache-Control', 'no-store')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 0 })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: <n>,
      temperature: 0,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: <feature>Schema } },
      messages: [{ role: 'user', content: <input> }],
    })
    const result = validate<Feature>(parseStructuredOutput(message, <feature>Schema))
    // derive any totals/scores in code, never trust model arithmetic
    return res.status(200).json(result)
  } catch (err) {
    console.error('<Feature> error:', err.message)   // never log user content
    return sendAIError(res, err)
  } finally {
    release?.()
  }
}
```

Rules:
- `maxRetries: 0`. Retries multiply cost and bypass the rate limit.
- Never read the key from a `VITE_*` var. Never return raw model text.
- If the endpoint reads Gmail, tracker entries, or other private data, it
  must call `requireTrackerUser(req)`.
- Send the model only the fields it needs. Say which fields in a code
  comment, and in the README if they're user data.

## 3. Tests — `src/__tests__/ai-endpoints.test.js`

The file already mocks `@anthropic-ai/sdk` (`create`) and has a `call()`
helper. Add at least:
- a 200 case with a valid mocked structured response
- a rejected-output case (schema-valid but semantically wrong → error status)
- a malformed-input case asserting `create` was **not** called
- a `stop_reason: 'max_tokens'` or invalid-JSON case

No test may hit the real API.

## 4. Client and docs

- Call it from a component with `fetch('/api/<feature>', { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body })`, and show the
  429/503 messages from `sendAIError` instead of a generic error.
- Add it to the architecture block and "Current limits" in `README.md`.
  Note that `npm run dev` doesn't serve `api/`. It needs a Vercel runtime.

## 5. Verify

`npm test`, `npm run build`. Then ask the `ascend-reviewer` subagent to
review the diff.
