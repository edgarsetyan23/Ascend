# Public portfolio

The public homepage is `/`; Ascend's private tracker is `/app`. The old `/portfolio` overview redirects to `/`. Existing deep links under `/portfolio/experience`, `/portfolio/projects`, and `/portfolio/live` remain valid. Legacy tracker bookmarks such as `/#jobs` open `/app#jobs`.

## Rendering and metadata

Vercel serves the React app. The build emits an HTML entry for each known portfolio page, with route-specific titles, descriptions, canonical URLs, and Open Graph/Twitter tags. `src/lib/portfolioPages.js` supplies both the build and client-side metadata. `scripts/build-page-metadata.mjs` writes these pages and the sitemap. `vercel.json` maps clean visitor URLs to those HTML entries. The private tracker and OAuth callback are noindex.

The homepage presents experience, JobRelay, and Ascend, with resume and contact links. Project pages start with a short problem/result summary and direct source/demo actions. Ascend's expanded case study includes implementation decisions, current test coverage, development notes, limitations, and a fictional import demo. JobRelay's local benchmark retains its small-workload qualifications.

## Public data

A separate read-only Lambda serves the configured owner's LeetCode and Activity entries through API Gateway. It accepts only those two tracker IDs, reads the owner from its environment, and has no write permission. It does not serve the HTML page. List handlers follow DynamoDB pagination.

The browser requests a public feed only when its corresponding page is opened. Failures show a retry action. The activity page is labelled as an archive and preserves the original dates and notes.

## Optional features

The private tracker is a separate lazy route. The PDF/scoring module loads only for the resume tool or the private tracker's resume tab. Mini Edgar remains visible on desktop; his 3D scene loads after the main content. The homepage gives him a compact tour section after the featured work, with a display platform, a tour action, and a direct link to browse the projects. He scrolls with that section; exhibit pages keep the accompanying guide. Narrow layouts use the gallery menu.

The public resume tool explains that PDF text is extracted in the browser and sent to Anthropic. It does not save public uploads to DynamoDB. Scores use an early-career AWS/backend rubric. When the cloud call fails, the results explicitly identify the local heuristic fallback. The upload limit is 5 MB, 10 pages, and 16,000 extracted characters.

See the README for AI authentication, input checks, request caps, and optional shared quota configuration.
