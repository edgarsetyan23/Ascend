import { AscendArchitectureDiagram } from './AscendArchitectureDiagram.jsx'
import { AscendDemo } from './AscendDemo.jsx'
import '../../styles/ascend-case-study.css'

const REPO = 'https://github.com/edgarsetyan23/Ascend/blob/master'

// Every claim below was checked against the current repo before being
// written — not against memory of an earlier version. Where a claim
// is about MY reasoning at the time (the "why" column) rather than
// something the code itself proves, it's presented as the rationale
// the implementation supports, not as a documented decision record —
// I didn't keep one, and this doesn't invent one.
const DECISIONS = [
  {
    title: 'One DynamoDB table, one partition per user',
    requirement:
      "Four tracker types (LeetCode, Jobs, Activity, Gaming), one account, and a tab switch that shouldn't feel like a page load.",
    approach: (
      <>
        A single table: <code>PK = USER#{'{sub}'}</code>, <code>SK = TRACKER#{'{trackerId}'}#ENTRY#{'{uuid}'}</code>.
        Loading a tab fires one <code>Query</code> with{' '}
        <code>begins_with(SK, "TRACKER#{'{id}'}#ENTRY#")</code> — verified directly in{' '}
        <a href={`${REPO}/infra/lambda/entries-list.mjs`} target="_blank" rel="noopener noreferrer">entries-list.mjs</a>{' '}
        — no scan, no join, no second round trip. That query sorts by SK, and each entry's SK ends in a
        random UUID rather than a sortable one, so the result isn't reliably ordered by creation date despite
        the code's own "newest first" comment — genuine date ordering is what the index below actually gives.
      </>
    ),
    tradeoff: (
      <>
        Every write also stamps a <code>GSI1PK</code>/<code>GSI1SK</code> pair (see{' '}
        <a href={`${REPO}/infra/lambda/entries-create.mjs`} target="_blank" rel="noopener noreferrer">entries-create.mjs</a>
        ): <code>GSI1PK = USER#{'{sub}'}#TRACKER#{'{trackerId}'}</code>, <code>GSI1SK = createdAt</code>. That's
        a <em>tracker-scoped</em>, date-ordered index — one tracker at a time, actually sorted by creation
        date — not a cross-tracker one; the partition key still includes <code>trackerId</code>, so one query
        against it can't return two trackers' entries together. No Lambda queries it yet (see Limitations). A
        genuinely cross-tracker, date-ordered view (entries from any tracker, newest first) would need a
        different index — dropping <code>trackerId</code> from the partition key — and that redesign doesn't
        exist in this codebase; it'd be new work, not a flip of a switch.
      </>
    ),
  },
  {
    title: 'A separate Lambda for the page you’re reading right now',
    requirement:
      'A recruiter needs to see live LeetCode and Activity data with no login, while Jobs and Gaming stay private.',
    approach: (
      <>
        <a href={`${REPO}/infra/lambda/public-entries-list.mjs`} target="_blank" rel="noopener noreferrer">public-entries-list.mjs</a>{' '}
        is its own function: no JWT authorizer on its route, a read-only IAM role (no write permission exists
        for it to misuse), an <code>OWNER_USER_ID</code> baked into its environment at deploy time so no
        request input ever reaches the partition key, and a hardcoded tracker whitelist that returns 404 —
        not 403 — for anything not on it, so a rejected request doesn't confirm which trackers exist.
      </>
    ),
    tradeoff:
      "It's single-tenant as configured today: OWNER_USER_ID is one fixed value baked into this Lambda's environment at deploy time, so this exact deployment only ever answers for one person's data. That's not the only conceivable way to support a second public profile — the same function could take an owner identifier from the route and look up the matching partition instead of a hardcoded one — but that redesign doesn't exist in this codebase. Today, one deployment shows one résumé.",
  },
  {
    title: 'Gmail → metadata → Claude → a review modal, in that order',
    requirement:
      "Cut down on re-typing job applications by hand, without over-trusting an LLM's read of an inbox or fetching more than necessary to do it.",
    approach: (
      <>
        New-tab OAuth (the popup-based flow silently breaks under <code>Cross-Origin-Opener-Policy</code>);{' '}
        <code>format=metadata</code> Gmail fetches only — subject, from, date, snippet, never the body; the
        list goes to{' '}
        <a href={`${REPO}/api/scan-emails.js`} target="_blank" rel="noopener noreferrer">api/scan-emails.js</a>,
        which asks Claude Haiku to classify each email and is explicitly instructed to fall back to
        "new application" whenever it isn't confident about a follow-up match; nothing reaches DynamoDB
        until the user checks boxes in a review modal and clicks Apply.
      </>
    ),
    tradeoff: (
      <>
        This implementation hands the OAuth access token across tabs via <code>localStorage</code> plus the{' '}
        <code>storage</code> event it fires — not because it's the only mechanism available, but because it
        needs no extra library and no service worker. <code>BroadcastChannel</code> is a plausible alternative
        for the same handoff, though that would need to be checked against how{' '}
        <code>OAuthCallback.jsx</code> and <code>EmailScanner.jsx</code> actually coordinate before assuming
        it's a drop-in swap. Separately, the classification step is a prompt, not a guarantee: a
        differently-worded rejection email could still be misread. The review step exists because neither of
        those is airtight alone.
      </>
    ),
  },
]

export function AscendCaseStudy() {
  return (
    <div className="exh-cs" id="ascend-case-study">
      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">The problem</h2>
        <p className="exh-cs-text">
          Ascend brings LeetCode practice, daily activity, job applications, and gaming logs into one
          application. The trackers have different fields but share a common workflow: record an entry and
          review it over time. Building one tracker with pluggable tracker types — rather than a separate
          app per tracker — means one auth flow, one API, and one data model to maintain, and it leaves room
          to automate data entry for one tracker specifically (job applications, via the Gmail scanner)
          without rebuilding that per tracker.
        </p>
      </section>

      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">System overview</h2>
        <p className="exh-cs-text">
          Every authenticated read and write goes browser → API Gateway → Lambda → DynamoDB, with a Cognito
          JWT authorizer rejecting anything without a valid token before a Lambda even cold-starts. This page
          is the one exception: it hits a second, unauthenticated route wired to a separate Lambda that can
          only ever read one hardcoded user's data (Decision 2, below). Two more integrations sit outside AWS
          entirely — Vercel functions call the Anthropic API for résumé scoring and email classification, and
          the browser talks to Gmail's API directly with a short-lived OAuth token that never reaches
          Ascend's own backend.
        </p>
        <AscendArchitectureDiagram />
      </section>

      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">Engineering decisions</h2>
        <div className="exh-cs-decisions">
          {DECISIONS.map((d, i) => (
            <div key={d.title} className="exh-cs-decision">
              <h3 className="exh-cs-decision-title"><span className="exh-cs-decision-n">{i + 1}</span>{d.title}</h3>
              <dl className="exh-cs-decision-grid">
                <dt>Requirement</dt>
                <dd>{d.requirement}</dd>
                <dt>Approach</dt>
                <dd>{d.approach}</dd>
                <dt>Tradeoff</dt>
                <dd>{d.tradeoff}</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">One workflow in detail: "Scan Emails" to a new tracker row</h2>
        <ol className="exh-cs-trace">
          <li>
            Click "📧 Scan Emails" → <code>EmailScanner.handleScan()</code> opens Google's OAuth consent
            screen in a new tab.
          </li>
          <li>
            User signs in → Google redirects to <code>/oauth-callback</code> → <code>OAuthCallback.jsx</code>{' '}
            reads the access token from the URL fragment, writes it to{' '}
            <code>localStorage['gmail-scan-token']</code>, and closes itself.
          </li>
          <li>
            The original tab's <code>storage</code> listener in <code>EmailScanner.jsx</code> fires, deletes
            that key immediately, and calls <code>handleToken(accessToken)</code>.
          </li>
          <li>
            <code>handleToken</code> calls the Gmail API twice: a message-list search (broad keyword query,
            capped at 50, last 90 days), then a <code>format=metadata</code> fetch per message — the email
            body is never requested.
          </li>
          <li>
            The flattened <code>{'{subject, from, date, snippet}'}</code> list, plus the user's existing
            tracker entries (id/company/role/status only), POST to <code>/api/scan-emails</code>.
          </li>
          <li>
            The serverless function sends it to Claude Haiku with the classification prompt and returns{' '}
            <code>{'{applications, followUps}'}</code>.
          </li>
          <li>
            The client filters out applications already in the tracker (case-insensitive company+role match)
            and follow-ups whose suggested status already matches, then opens the review modal, pre-checked.
          </li>
          <li>
            Clicking "Apply Selected" calls <code>addEntry</code>/<code>updateEntry</code> from{' '}
            <a href={`${REPO}/src/hooks/useEntries.js`} target="_blank" rel="noopener noreferrer">useEntries.js</a>{' '}
            once per selected row.
          </li>
          <li>
            <code>addEntry</code> shows an optimistic row immediately, then calls{' '}
            <code>createEntry()</code> → <code>POST /trackers/jobs/entries</code> →{' '}
            <code>entries-create.mjs</code> → a single <code>PutCommand</code> writing the item to DynamoDB,
            and swaps in the server's response (or rolls back on failure).
          </li>
        </ol>
        <details className="exh-cs-details">
          <summary>See the write itself (entries-create.mjs)</summary>
          <pre className="exh-cs-code"><code>{`await ddb.send(
  new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK:     \`USER#\${userId}\`,
      SK:     \`TRACKER#\${trackerId}#ENTRY#\${entryId}\`,
      GSI1PK: \`USER#\${userId}#TRACKER#\${trackerId}\`,
      GSI1SK: createdAt,
      data:   entryData,
    },
  }),
)`}</code></pre>
        </details>
      </section>

      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">Limitations and next steps</h2>
        <ul className="exh-cs-limitations">
          <li>The public portfolio Lambda answers for one fixed <code>OWNER_USER_ID</code> today (Decision 2) — showing a second person's data isn't a config change with the current code, though it wouldn't necessarily require a whole second Lambda either.</li>
          <li><code>GSI1</code> (tracker-scoped, date-ordered — see Decision 1) is written on every create but nothing queries it yet — wiring it into <code>entries-list.mjs</code> would fix the base table's non-chronological ordering for a single tracker; it does not, as written, support a cross-tracker query.</li>
          <li>
            Backend test coverage is two Node test files (
            <a href={`${REPO}/infra/lambda/__tests__/validate.test.mjs`} target="_blank" rel="noopener noreferrer">validate.test.mjs</a>,{' '}
            <a href={`${REPO}/infra/lambda/__tests__/public-entries-list.test.mjs`} target="_blank" rel="noopener noreferrer">public-entries-list.test.mjs</a>
            ) — the authenticated CRUD Lambdas and the optimistic-rollback path in <code>useEntries.js</code> have no automated tests yet.
          </li>
          <li>The Gmail OAuth handoff uses <code>localStorage</code> plus a <code>storage</code> event (Decision 3) — worth checking whether <code>BroadcastChannel</code> could replace that without touching storage at all, rather than assuming it's a confirmed drop-in fix.</li>
          <li>Claude's follow-up classification is a single prompt with no eval set behind it — there's no measured accuracy number, just the conservative fallback described above.</li>
        </ul>
      </section>

      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">Explore</h2>
        <AscendDemo />
        <div className="exh-cs-explore-links">
          <a href="https://github.com/edgarsetyan23/Ascend" target="_blank" rel="noopener noreferrer" className="exh-repo-link">
            View the full source on GitHub →
          </a>
        </div>
        <details className="exh-cs-details">
          <summary>Jump to specific files</summary>
          <ul className="exh-cs-file-links">
            <li><a href={`${REPO}/infra/lib/constructs/database.ts`} target="_blank" rel="noopener noreferrer">infra/lib/constructs/database.ts</a> — the table + GSI definition (CDK)</li>
            <li><a href={`${REPO}/infra/lib/constructs/api.ts`} target="_blank" rel="noopener noreferrer">infra/lib/constructs/api.ts</a> — routes, the JWT authorizer, the public route</li>
            <li><a href={`${REPO}/infra/lambda/entries-list.mjs`} target="_blank" rel="noopener noreferrer">infra/lambda/entries-list.mjs</a> — the authenticated Query</li>
            <li><a href={`${REPO}/infra/lambda/public-entries-list.mjs`} target="_blank" rel="noopener noreferrer">infra/lambda/public-entries-list.mjs</a> — the unauthenticated Lambda behind this page</li>
            <li><a href={`${REPO}/src/hooks/useEntries.js`} target="_blank" rel="noopener noreferrer">src/hooks/useEntries.js</a> — optimistic update + rollback</li>
            <li><a href={`${REPO}/src/components/EmailScanner.jsx`} target="_blank" rel="noopener noreferrer">src/components/EmailScanner.jsx</a> — the Gmail scan + review flow</li>
          </ul>
        </details>
      </section>
    </div>
  )
}
