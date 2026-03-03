import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You analyze job application emails. Given a list of already-tracked applications and a set of incoming emails, classify each email and extract structured data.

Classification rules:
- "new_application": a confirmation that the user submitted a new job application (e.g. "thank you for applying", "application received", "we got your application")
- "follow_up": a status update on an application already in the tracked list (e.g. interview invitation, rejection, offer letter, background check request, next steps email)

For each email, decide which category it belongs to:
- new_application → extract: company (string), role (string), appliedDate (string YYYY-MM-DD), source (string, e.g. LinkedIn/Indeed/Company Website/Other)
- follow_up → find the closest matching tracked application by company+role name, then extract: matchedEntryId (string, the id of the matching tracked entry), company (string), role (string), suggestedStatus (one of: "Phone Screen", "Technical", "Onsite", "Offer", "Rejected", "Withdrawn"), emailDate (string YYYY-MM-DD)

Rules:
- Only include a follow_up if you can confidently match it to an existing tracked entry (fuzzy match on company and role is fine)
- If you cannot match a follow-up to any tracked entry, include it in applications as a new_application instead
- Prefer conservative matching — if unsure whether an email is about a tracked application, treat it as a new_application
- If an email is clearly not job-related, skip it entirely

Return ONLY valid JSON with this exact schema:
{
  "applications": [{"company": string, "role": string, "appliedDate": string, "source": string}],
  "followUps": [{"matchedEntryId": string, "company": string, "role": string, "suggestedStatus": string, "emailDate": string}]
}
Return {"applications": [], "followUps": []} if nothing is found.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { emails, existingEntries = [] } = req.body || {}
  if (!Array.isArray(emails) || emails.length === 0)
    return res.status(400).json({ error: 'emails array required' })

  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(503).json({ error: 'API key not configured' })

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const entriesContext = existingEntries.length > 0
      ? `Already tracked applications:\n${existingEntries.map((e) => `  id=${e.id} | ${e.company} | ${e.role} | status=${e.status}`).join('\n')}\n\n`
      : ''

    const emailText = emails
      .map((e, i) => `Email ${i + 1}:\nFrom: ${e.from}\nDate: ${e.date}\nSubject: ${e.subject}\nSnippet: ${e.snippet}`)
      .join('\n\n---\n\n')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `${entriesContext}Emails to analyze:\n\n${emailText}` }],
    })

    const raw = message.content[0].text.trim()
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const results = JSON.parse(cleaned)

    return res.status(200).json({
      applications: results.applications ?? [],
      followUps: results.followUps ?? [],
    })
  } catch (err) {
    console.error('scan-emails error:', err.message)
    return res.status(500).json({ error: 'Parsing failed', detail: err.message })
  }
}
