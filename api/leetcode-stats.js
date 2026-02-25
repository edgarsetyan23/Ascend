const QUERY = `
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      userAvatar
      ranking
    }
    submitStats {
      acSubmissionNum {
        difficulty
        count
      }
    }
    languageProblemCount {
      languageName
      problemsSolved
    }
  }
}
`

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const username = (req.query.username || '').trim()
  if (!username) return res.status(400).json({ error: 'username query param required' })

  try {
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0 (compatible)',
      },
      body: JSON.stringify({ query: QUERY, variables: { username } }),
    })

    const json = await response.json()
    const user = json?.data?.matchedUser

    if (!user) return res.status(502).json({ error: 'User not found' })

    const acNums = user.submitStats?.acSubmissionNum ?? []
    const get = (d) => acNums.find((x) => x.difficulty === d)?.count ?? 0

    const result = {
      username: user.username,
      avatar: user.profile?.userAvatar ?? null,
      rank: user.profile?.ranking ?? null,
      solved: { total: get('All'), easy: get('Easy'), medium: get('Medium'), hard: get('Hard') },
      languages: (user.languageProblemCount ?? [])
        .sort((a, b) => b.problemsSolved - a.problemsSolved)
        .slice(0, 4)
        .map((l) => ({ name: l.languageName, count: l.problemsSolved })),
    }

    // Cache for 5 minutes at the CDN, serve stale for up to 10
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(result)
  } catch (err) {
    console.error('leetcode-stats error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
