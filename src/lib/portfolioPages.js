export const SITE_URL = 'https://www.edgarsetyan.com'
export const SHARE_IMAGE = `${SITE_URL}/portfolio-share.png`
export const portfolioPages = [
  { id: 'root', path: '/', title: 'Edgar Setyan | Backend & Cloud Engineer', description: 'Toronto software engineer, previously AWS RDS. Backend services, production operations, and projects in reliable job processing and AWS serverless applications.' },
  { id: 'aws', path: '/portfolio/experience/aws', title: 'AWS RDS Experience | Edgar Setyan', description: 'Java backend development, production on-call, infrastructure cleanup, and a local load-testing prototype on the AWS RDS team.' },
  { id: 'tangerine-2021', path: '/portfolio/experience/tangerine/2021', title: 'Tangerine Internship, 2021 | Edgar Setyan', description: 'Java development, SQL query improvements, and deployment work during a software development internship at Tangerine.' },
  { id: 'tangerine-2020', path: '/portfolio/experience/tangerine/2020', title: 'Tangerine Internship, 2020 | Edgar Setyan', description: 'Java application features and Maven build automation during a software development internship at Tangerine.' },
  { id: 'jobrelay', path: '/portfolio/projects/jobrelay', title: 'JobRelay | Edgar Setyan', description: 'A TypeScript image-processing service exploring durable job acceptance, transactional outbox delivery, retries, and worker-crash recovery.' },
  { id: 'ascend', path: '/portfolio/projects/ascend', title: 'Ascend | Edgar Setyan', description: 'A personal tracker with a Gmail import review flow and a public portfolio. Explore the React frontend, AWS backend, and working sample demo.' },
  { id: 'oncall', path: '/portfolio/projects/oncall-assistant', title: 'On-Call Assistant | Edgar Setyan', description: 'A team hackathon project that turns an incident ticket into a guided troubleshooting flow. First place at the AWS RDS Toronto hackathon.' },
  { id: 'york', path: '/portfolio/education/york', title: 'Education | Edgar Setyan', description: 'Bachelor of Science Honours in Computer Science, York University, Class of 2024.' },
  { id: 'skills', path: '/portfolio/skills', title: 'Technical Skills | Edgar Setyan', description: 'Languages, backend frameworks, AWS services, and development tools used across Edgar Setyan\'s work and projects.' },
  { id: 'leetcode', path: '/portfolio/live/leetcode', title: 'Problem-Solving Log | Edgar Setyan', description: 'LeetCode profile statistics fetched from the source, alongside selected problem-solving entries from Ascend.' },
  { id: 'activity', path: '/portfolio/live/activity', title: 'Activity Archive | Edgar Setyan', description: 'Dated study, coding, and activity notes from Ascend. A historical archive rather than a current daily streak.' },
  { id: 'analyzer', path: '/portfolio/analyzer/score', title: 'Resume Review | Edgar Setyan', description: 'Try an early-career AWS/backend resume rubric with Claude-powered feedback and a local fallback. Review how extracted text is used before uploading.' },
]

export function updatePortfolioMetadata(id) {
  const page = portfolioPages.find(page => page.id === id) || portfolioPages[0]
  document.title = page.title
  const values = {
    'meta[name="description"]': page.description,
    'meta[name="robots"]': 'index, follow',
    'meta[property="og:title"]': page.title,
    'meta[property="og:description"]': page.description,
    'meta[property="og:url"]': SITE_URL + page.path,
    'meta[name="twitter:title"]': page.title,
    'meta[name="twitter:description"]': page.description,
  }
  for (const [selector, value] of Object.entries(values)) document.querySelector(selector)?.setAttribute('content', value)
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', SITE_URL + page.path)
}
