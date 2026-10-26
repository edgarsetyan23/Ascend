import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { portfolioPages, SITE_URL } from '../src/lib/portfolioPages.js'

const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const template = await readFile('dist/index.html', 'utf8')
const privatePages = [
  { path: '/app', title: 'Ascend | Private tracker', description: 'Sign in to your personal Ascend workspace.', private: true },
  { path: '/oauth-callback', title: 'Google sign-in | Ascend', description: 'Return to the original tab to finish sign-in.', private: true },
]
for (const page of [...portfolioPages, ...privatePages]) {
  let html = template.replace(/<title>.*?<\/title>/, `<title>${escape(page.title)}</title>`)
  for (const [key, value] of Object.entries({ description: page.description, 'og:title': page.title, 'og:description': page.description, 'og:url': SITE_URL + page.path, 'twitter:title': page.title, 'twitter:description': page.description })) {
    html = html.replace(new RegExp(`(<meta (?:name|property)="${key}" content=")[^"]*`), (_, prefix) => prefix + escape(value))
  }
  html = html.replace(/(<link rel="canonical" href=")[^"]*/, (_, prefix) => prefix + SITE_URL + page.path)
  if (page.private) html = html.replace('content="index, follow"', 'content="noindex, nofollow"')
  const destination = page.path === '/' ? 'dist/index.html' : `dist${page.path}.html`
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, html)
}
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${portfolioPages.map(page => `<url><loc>${SITE_URL}${page.path}</loc></url>`).join('')}</urlset>\n`)
console.log(`Generated initial HTML metadata for ${portfolioPages.length} portfolio pages and ${privatePages.length} private pages.`)
