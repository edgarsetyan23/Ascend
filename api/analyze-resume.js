import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are a senior technical recruiter scoring resumes for 1-year post-grad software engineers with AWS cloud experience. These candidates are competing for L4/SWE2 roles at top-tier tech companies (Amazon, Google, Meta, Stripe, Figma, etc.) against CS grads from top schools with internship experience.

Score the resume on 6 categories (each 0–10) and return ONLY valid JSON — no markdown, no explanation, just the JSON object.

Schema:
{
  "wordCount": <integer>,
  "categories": [
    { "key": "metrics",   "label": "Metrics & Impact",  "score": <0-10>, "weight": "25%" },
    { "key": "verbs",     "label": "Action Verbs",       "score": <0-10>, "weight": "15%" },
    { "key": "aws",       "label": "AWS Depth",          "score": <0-10>, "weight": "20%" },
    { "key": "tech",      "label": "Tech Keywords",      "score": <0-10>, "weight": "15%" },
    { "key": "structure", "label": "Structure",          "score": <0-10>, "weight": "10%" },
    { "key": "length",    "label": "Length & Format",    "score": <0-10>, "weight": "15%" }
  ],
  "recommendations": [
    { "category": "<name>", "text": "<specific actionable advice tailored to 1yr AWS SWE competing at top companies>" }
  ],
  "highlights": {
    "awsServices": ["<service names found in resume>"],
    "techStack": ["<languages/frameworks/tools found>"]
  }
}

Scoring criteria:
- Metrics & Impact (25%): Every bullet should quantify impact — latency numbers, scale (requests/users), cost savings, % improvements. 0 = no metrics, 10 = every bullet has a number.
- Action Verbs (15%): Each bullet should open with a strong verb (built, deployed, reduced, architected, optimized). Penalize "responsible for", "helped", "worked on".
- AWS Depth (20%): Specific service names matter — Lambda, DynamoDB, S3, CloudWatch, ECS, CDK, etc. Generic "AWS experience" is weak. 10 = 4+ relevant services named with context.
- Tech Keywords (15%): Languages, frameworks, tools explicitly named. ATS systems keyword-match. Python, TypeScript, React, Docker, Kubernetes, Terraform, etc.
- Structure (10%): Needs Experience, Education, Skills, Projects sections. Contact info visible. Clean hierarchy.
- Length & Format (15%): 350–600 words is ideal for 1 YOE. Under 300 = too thin. Over 800 = likely 2 pages, penalize.

Only include recommendations for categories scoring below 7. Be direct and specific — name exactly what's missing, reference the profile (1yr AWS SWE, top-company competition).`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text } = req.body || {}
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing resume text' })
  }

  const wordCount = text.trim().split(/\s+/).length
  if (wordCount < 50) {
    return res.status(400).json({ error: 'Resume too short (need 50+ words)' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'API key not configured' })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Score this resume:\n\n${text.slice(0, 8000)}` }
      ],
    })

    const raw = message.content[0].text.trim()
    // Strip markdown code fences if the model wraps in ```json
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const result = JSON.parse(cleaned)

    // Compute overall deterministically from category scores — never trust the model's arithmetic
    const weights = { metrics: 0.25, verbs: 0.15, aws: 0.20, tech: 0.15, structure: 0.10, length: 0.15 }
    const overall = Math.round(
      result.categories.reduce((sum, cat) => sum + (cat.score * (weights[cat.key] ?? 0)), 0) * 10
    )

    return res.status(200).json({ ...result, overall })
  } catch (err) {
    console.error('Resume analysis error:', err.message)
    return res.status(500).json({ error: 'Analysis failed', detail: err.message })
  }
}
