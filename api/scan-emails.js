import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You parse job application confirmation emails.
For each email, extract: company name, role/position title, application date, and source platform.
Return ONLY a JSON array of objects. Each object must have exactly these keys:
  company (string), role (string), appliedDate (string, YYYY-MM-DD format), source (string).
If you cannot determine a field, use an empty string.
Return [] if no valid job applications are found.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { emails } = req.body || {}
  if (!Array.isArray(emails) || emails.length === 0)
    return res.status(400).json({ error: 'emails array required' })

  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(503).json({ error: 'API key not configured' })

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const emailText = emails
      .map((e, i) => `Email ${i + 1}:\nFrom: ${e.from}\nDate: ${e.date}\nSubject: ${e.subject}\nSnippet: ${e.snippet}`)
      .join('\n\n---\n\n')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: emailText }],
    })

    const raw = message.content[0].text.trim()
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const results = JSON.parse(cleaned)
    return res.status(200).json({ applications: results })
  } catch (err) {
    console.error('scan-emails error:', err.message)
    return res.status(500).json({ error: 'Parsing failed', detail: err.message })
  }
}
