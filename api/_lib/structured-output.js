const string = { type: 'string' }
const array = (items) => ({ type: 'array', items })
const object = (properties) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
})

export const categories = {
  metrics: ['Metrics & Impact', '25%'], verbs: ['Action Verbs', '15%'],
  aws: ['AWS Depth', '20%'], tech: ['Tech Keywords', '15%'],
  structure: ['Structure', '10%'], length: ['Length & Format', '15%'],
}

export const resumeSchema = object({
  wordCount: { type: 'integer' },
  categories: array(object({
    key: { type: 'string', enum: Object.keys(categories) }, label: string,
    score: { type: 'number', description: 'Score from 0 to 10 inclusive' }, weight: string,
  })),
  recommendations: array(object({ category: string, text: string })),
  highlights: object({ awsServices: array(string), techStack: array(string) }),
})

export const emailSchema = object({
  applications: array(object({ company: string, role: string, appliedDate: string, source: string })),
  followUps: array(object({
    matchedEntryId: string, company: string, role: string,
    suggestedStatus: { type: 'string', enum: ['Phone Screen', 'Technical', 'Onsite', 'Offer', 'Rejected', 'Withdrawn'] },
    emailDate: string,
  })),
})

// Validate the schema subset used above, including at the external API boundary.
function validate(value, schema) {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== schema.required.length
      || !schema.required.every((key) => Object.hasOwn(value, key))) throw new Error('Invalid response fields')
    for (const [key, child] of Object.entries(schema.properties)) validate(value[key], child)
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new Error('Expected response array')
    value.forEach((item) => validate(item, schema.items))
  } else if (schema.type === 'integer' ? !Number.isInteger(value)
    : typeof value !== schema.type || (schema.type === 'number' && !Number.isFinite(value))) {
    throw new Error('Invalid response type')
  }
  if (schema.enum && !schema.enum.includes(value)) throw new Error('Invalid response enum')
}

export function parseStructuredOutput(message, schema) {
  if (message.stop_reason !== 'end_turn') throw new Error('Incomplete or refused model response')
  const blocks = message.content.filter((block) => block.type === 'text')
  if (blocks.length !== 1) throw new Error('Expected one structured response')
  const result = JSON.parse(blocks[0].text)
  validate(result, schema)
  return result
}

export function validateResume(result) {
  const keys = result.categories.map((category) => category.key)
  if (keys.length !== 6 || new Set(keys).size !== 6 || result.wordCount < 0
    || result.categories.some((category) => category.score < 0 || category.score > 10)) {
    throw new Error('Invalid resume scores or categories')
  }
  // Labels and weights belong to the scoring rubric, not to generated prose.
  result.categories = result.categories.map((category) => ({
    ...category, label: categories[category.key][0], weight: categories[category.key][1],
  }))
  return result
}

export function validateEmails(result, entries) {
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (result.applications.some((item) => !validDate(item.appliedDate))
    || result.followUps.some((item) => !validDate(item.emailDate)
      || !entries.some((entry) => String(entry.id) === item.matchedEntryId))) {
    throw new Error('Invalid email dates or unmatched application')
  }
  return result
}
