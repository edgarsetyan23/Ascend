import { vi, describe, it, expect, beforeEach } from 'vitest'
const { create } = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({ default: class {
  messages = { create }
} }))
import resume from '../../api/analyze-resume.js'
import emails from '../../api/scan-emails.js'
import { categories } from '../../api/_lib/structured-output.js'

const report = () => ({
  wordCount: 100,
  categories: Object.entries(categories).map(([key, [label, weight]]) => ({ key, label, weight, score: 8 })),
  recommendations: [], highlights: { awsServices: [], techStack: [] },
})
const response = (value, stop_reason = 'end_turn') => ({ stop_reason, content: [{ type: 'text', text: JSON.stringify(value) }] })
async function call(handler, body) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }
  await handler({ method: 'POST', body }, res)
  return [res.status.mock.calls[0][0], res.json.mock.calls[0][0]]
}
beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  create.mockReset()
})
describe('AI response contracts', () => {
  it('requests structured Haiku output and computes the resume score', async () => {
    create.mockResolvedValue(response(report()))
    const [status, result] = await call(resume, { text: 'word '.repeat(100) })
    expect(status).toBe(200)
    expect(result.overall).toBe(80)
    expect(create.mock.calls[0][0]).toMatchObject({ model: 'claude-haiku-4-5-20251001', output_config: { format: { type: 'json_schema' } } })
  })
  it.each(['max_tokens', 'refusal'])('rejects %s even with parseable JSON', async (reason) => {
    create.mockResolvedValue(response(report(), reason))
    expect((await call(resume, { text: 'word '.repeat(100) }))[0]).toBe(500)
  })
  it.each(['duplicate', 'range', 'missing'])('rejects invalid resume %s', async (kind) => {
    const value = report()
    if (kind === 'duplicate') value.categories[1].key = 'metrics'
    if (kind === 'range') value.categories[0].score = 11
    if (kind === 'missing') delete value.highlights
    create.mockResolvedValue(response(value))
    expect((await call(resume, { text: 'word '.repeat(100) }))[0]).toBe(500)
  })
  it('accepts empty scanner results and requests a schema', async () => {
    create.mockResolvedValue(response({ applications: [], followUps: [] }))
    expect((await call(emails, { emails: [{}] }))[0]).toBe(200)
    expect(create.mock.calls[0][0].output_config.format.schema.required).toEqual(['applications', 'followUps'])
  })
  it.each(['unknown-id', 'status', 'date'])('rejects scanner %s', async (kind) => {
    const followUp = { matchedEntryId: '1', company: 'Acme', role: 'SWE', suggestedStatus: 'Offer', emailDate: '2026-10-26' }
    if (kind === 'unknown-id') followUp.matchedEntryId = 'invented'
    if (kind === 'status') followUp.suggestedStatus = 'Made Up'
    if (kind === 'date') followUp.emailDate = '2026-02-30'
    create.mockResolvedValue(response({ applications: [], followUps: [followUp] }))
    expect((await call(emails, { emails: [{}], existingEntries: [{ id: '1' }] }))[0]).toBe(500)
  })
})
