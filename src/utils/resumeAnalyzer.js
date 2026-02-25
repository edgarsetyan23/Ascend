// ─── Resume Analyzer ──────────────────────────────────────────────────────
// Scores a resume text against benchmarks for a 1-year post-grad SWE
// (AWS background). Returns scored categories + actionable recommendations.

const AWS_SERVICES = [
  'lambda', 'dynamodb', 's3', 'cloudwatch', 'ecs', 'ec2', 'rds', 'sqs',
  'sns', 'api gateway', 'cloudfront', 'route 53', 'iam', 'vpc', 'eks',
  'fargate', 'step functions', 'kinesis', 'glue', 'athena', 'redshift',
  'elasticache', 'eventbridge', 'secrets manager', 'ssm', 'cdk', 'sam',
  'amplify', 'cognito', 'bedrock', 'sagemaker',
]

const TECH_KEYWORDS = [
  'python', 'java', 'typescript', 'javascript', 'go', 'rust', 'c++',
  'react', 'node', 'fastapi', 'spring', 'django', 'flask',
  'docker', 'kubernetes', 'terraform', 'ci/cd', 'github actions',
  'postgresql', 'mysql', 'mongodb', 'redis',
  'rest', 'graphql', 'grpc', 'microservices',
  'git', 'linux', 'bash', 'sql',
]

const ACTION_VERBS = [
  'built', 'designed', 'reduced', 'deployed', 'implemented', 'architected',
  'optimized', 'migrated', 'automated', 'developed', 'created', 'engineered',
  'led', 'launched', 'improved', 'integrated', 'refactored', 'scaled',
  'maintained', 'debugged', 'shipped', 'contributed', 'owned', 'drove',
  'increased', 'decreased', 'eliminated', 'established', 'accelerated',
]

const STRUCTURE_HEADERS = [
  'experience', 'education', 'skills', 'projects', 'work experience',
  'technical skills', 'professional experience', 'summary', 'objective',
  'certifications', 'publications', 'awards',
]

const METRIC_PATTERN = /\b(\d+[%x]|\d+\s*(ms|seconds?|minutes?|hours?|days?)|\$\d+|\d+[km]\+?|\d+\s*(users?|requests?|services?|teams?|engineers?|repos?))\b/gi

// ─── Individual scorers (each returns 0–10) ───────────────────────────────

function scoreMetrics(text) {
  const matches = text.match(METRIC_PATTERN) || []
  // 0 matches → 0, 3+ matches in bullets → ideal
  if (matches.length === 0) return 0
  if (matches.length === 1) return 3
  if (matches.length === 2) return 5
  if (matches.length === 3) return 7
  if (matches.length <= 5) return 9
  return 10
}

function scoreActionVerbs(lower) {
  const found = ACTION_VERBS.filter(v => lower.includes(v))
  if (found.length === 0) return 0
  if (found.length <= 2) return 4
  if (found.length <= 4) return 6
  if (found.length <= 6) return 8
  return 10
}

function scoreAWS(lower) {
  const found = AWS_SERVICES.filter(s => lower.includes(s))
  if (found.length === 0) return 0
  if (found.length === 1) return 4
  if (found.length === 2) return 6
  if (found.length === 3) return 8
  return 10
}

function scoreTech(lower) {
  const found = TECH_KEYWORDS.filter(k => lower.includes(k))
  if (found.length === 0) return 0
  if (found.length <= 2) return 3
  if (found.length <= 4) return 6
  if (found.length <= 6) return 8
  return 10
}

function scoreStructure(lower) {
  const found = STRUCTURE_HEADERS.filter(h => lower.includes(h))
  if (found.length === 0) return 0
  if (found.length === 1) return 3
  if (found.length === 2) return 5
  if (found.length === 3) return 8
  return 10
}

function scoreLength(wordCount) {
  if (wordCount < 200) return 2
  if (wordCount < 300) return 5
  if (wordCount <= 700) return 10
  if (wordCount <= 900) return 7
  return 4
}

// ─── Recommendation generator ─────────────────────────────────────────────

function buildRecommendations(scores, lower, wordCount) {
  const recs = []

  if (scores.metrics < 7) {
    recs.push({
      category: 'Metrics & Impact',
      text: 'Add quantified results to every bullet — e.g. "Reduced API latency by 40%" or "Served 50k daily requests". Recruiters at AWS-caliber companies skip unquantified bullets.',
    })
  }

  if (scores.verbs < 6) {
    const missing = ACTION_VERBS.filter(v => !lower.includes(v)).slice(0, 5)
    recs.push({
      category: 'Action Verbs',
      text: `Start each bullet with a strong verb. You're underusing: ${missing.join(', ')}. Avoid "responsible for" or "helped with".`,
    })
  }

  if (scores.aws < 6) {
    recs.push({
      category: 'AWS Depth',
      text: 'Name specific AWS services in your bullets (Lambda, DynamoDB, CloudWatch, etc.). Hiring managers ctrl+F for these. Even if you used them, they need to be visible.',
    })
  }

  if (scores.tech < 6) {
    recs.push({
      category: 'Tech Keywords',
      text: 'Add a dedicated Skills section with your languages, frameworks, and tools. Many ATS systems reject resumes missing keyword density in tech skills.',
    })
  }

  if (scores.structure < 8) {
    recs.push({
      category: 'Structure',
      text: 'Include clearly labeled sections: Experience, Education, Skills, and Projects. Missing sections signal an incomplete resume to ATS and recruiters.',
    })
  }

  if (wordCount < 300) {
    recs.push({
      category: 'Length',
      text: `Your resume is only ~${wordCount} words. At 1 year of experience, aim for 400–600 words. Expand your project descriptions and add 2–3 bullet points per role.`,
    })
  } else if (wordCount > 900) {
    recs.push({
      category: 'Length',
      text: `Your resume is ~${wordCount} words — likely spilling past one page. Cut older or weaker bullets. At 1 YOE, one focused page outperforms two sparse ones.`,
    })
  }

  return recs
}

// ─── Main export ──────────────────────────────────────────────────────────

export function analyzeResume(text) {
  if (!text || text.trim().length < 50) {
    return null
  }

  const lower = text.toLowerCase()
  const wordCount = text.trim().split(/\s+/).length

  const rawScores = {
    metrics: scoreMetrics(text),
    verbs: scoreActionVerbs(lower),
    aws: scoreAWS(lower),
    tech: scoreTech(lower),
    structure: scoreStructure(lower),
    length: scoreLength(wordCount),
  }

  // Weighted overall (weights sum to 1.0)
  const overall = Math.round(
    rawScores.metrics * 0.25 +
    rawScores.verbs   * 0.15 +
    rawScores.aws     * 0.20 +
    rawScores.tech    * 0.15 +
    rawScores.structure * 0.10 +
    rawScores.length  * 0.15
  ) * 10  // scale 0–10 → 0–100

  const categories = [
    { key: 'metrics',   label: 'Metrics & Impact',  score: rawScores.metrics, weight: '25%' },
    { key: 'verbs',     label: 'Action Verbs',       score: rawScores.verbs,   weight: '15%' },
    { key: 'aws',       label: 'AWS Depth',          score: rawScores.aws,     weight: '20%' },
    { key: 'tech',      label: 'Tech Keywords',      score: rawScores.tech,    weight: '15%' },
    { key: 'structure', label: 'Structure',          score: rawScores.structure, weight: '10%' },
    { key: 'length',    label: 'Length & Format',    score: rawScores.length,  weight: '15%' },
  ]

  const recommendations = buildRecommendations(rawScores, lower, wordCount)

  const awsServices = AWS_SERVICES.filter(s => lower.includes(s))
  const techStack = TECH_KEYWORDS.filter(k => lower.includes(k))

  return {
    overall,
    wordCount,
    categories,
    recommendations,
    highlights: { awsServices, techStack },
  }
}
