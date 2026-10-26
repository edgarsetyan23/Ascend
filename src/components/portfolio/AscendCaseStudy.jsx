import { AscendArchitectureDiagram } from './AscendArchitectureDiagram.jsx'
import { AscendDemo } from './AscendDemo.jsx'
import '../../styles/ascend-case-study.css'

const REPO = 'https://github.com/edgarsetyan23/Ascend/blob/master'
const source = (path, label = path) => <a href={REPO + '/' + path} target="_blank" rel="noopener noreferrer">{label}</a>

export function AscendCaseStudy() {
  return (
    <div className="exh-cs" id="ascend-case-study" tabIndex={-1}>
      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">The problem</h2>
        <p className="exh-cs-text">Applications, coding practice, and activity logs need different fields but share the same basic workflow: add an entry, edit it, and review progress. Ascend puts those trackers behind one account and adds a Gmail import flow to reduce manual entry.</p>
      </section>
      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">System overview</h2>
        <p className="exh-cs-text">Vercel serves the React portfolio and tracker. Cognito protects tracker writes through API Gateway. A separate read-only Lambda supplies selected public data. Vercel functions proxy Claude and LeetCode requests; the browser calls Gmail directly after Google sign-in.</p>
        <AscendArchitectureDiagram />
      </section>
      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">Engineering decisions</h2>
        <div className="exh-cs-decisions">
          <div className="exh-cs-decision">
            <h3 className="exh-cs-decision-title">One DynamoDB table, one partition per user</h3>
            <p className="exh-cs-text">Entries use <code>PK = USER#{'{sub}'}</code> and <code>SK = TRACKER#{'{id}'}#ENTRY#{'{uuid}'}</code>. {source('infra/lambda/entries-list.mjs', 'The list handler')} queries a tracker prefix and follows pagination until all pages are read.</p>
            <p className="exh-cs-text">The UUID sort key does not give creation-date ordering. Writes also populate a tracker-specific date index, but the list handlers do not query it yet. That index could support chronological reads within a tracker; reporting across trackers would need a different access pattern.</p>
          </div>
          <div className="exh-cs-decision">
            <h3 className="exh-cs-decision-title">A separate Lambda for public tracker data</h3>
            <p className="exh-cs-text">{source('infra/lambda/public-entries-list.mjs', 'The public handler')} has read-only table permissions. It reads the configured owner's partition and accepts only the LeetCode and Activity trackers. Jobs and Gaming remain private.</p>
            <p className="exh-cs-text">The deployment serves one public profile. Supporting additional public owners would require an explicit lookup and access policy.</p>
          </div>
          <div className="exh-cs-decision">
            <h3 className="exh-cs-decision-title">Gmail → metadata → Claude → a review modal</h3>
            <p className="exh-cs-text">The browser fetches subject, sender, date, and snippet for up to 50 matching messages. Claude returns schema-constrained application suggestions. The server checks dates and follow-up IDs, and the user reviews selections before saving.</p>
            <p className="exh-cs-text">Google sign-in opens a separate tab. {source('src/components/OAuthCallback.jsx', 'The callback')} sends its result through BroadcastChannel; {source('src/components/EmailScanner.jsx', 'the scanner')} validates a one-use state value and expires pending sign-ins after five minutes. The handoff does not store the Gmail token in localStorage.</p>
          </div>
        </div>
      </section>
      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">One workflow in detail</h2>
        <ol className="exh-cs-limitations">
          <li>Start a scan and authorize read-only Gmail access in a new tab.</li>
          <li>The browser searches recent application-related messages and fetches their metadata.</li>
          <li>{source('api/scan-emails.js')} asks Claude Haiku 4.5 for new applications and suggested status changes using JSON Schema structured output.</li>
          <li>The server validates the response. The review modal filters duplicates and lets the user choose which suggestions to apply.</li>
          <li>{source('src/hooks/useEntries.js')} applies optimistic changes while the authenticated API writes to DynamoDB, and rolls back if a request fails.</li>
        </ol>
      </section>
      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">Development and verification</h2>
        <p className="exh-cs-text">Ascend was built with AI assistance. The repository records the implementation and subsequent fixes: paginated reads, scoped optimistic updates, a validated OAuth handoff, and schema-constrained model responses.</p>
        <p className="exh-cs-text">Backend tests cover input validation, public-data restrictions, list pagination, and authenticated updates. Frontend tests cover optimistic rollback and tracker switching, OAuth state handling, the sample demo, and AI response validation. Model calls are mocked in tests.</p>
        <div className="exh-cs-explore-links">{source('infra/lambda/__tests__/entries-update.test.mjs', 'Backend tests')} · {source('src/__tests__/useEntries.test.jsx', 'Optimistic update tests')} · {source('src/__tests__/gmailOAuth.test.jsx', 'OAuth tests')} · {source('src/__tests__/ai-endpoints.test.js', 'AI endpoint tests')}</div>
      </section>
      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">Limitations and next steps</h2>
        <ul className="exh-cs-limitations">
          <li>The public API is configured for one owner, and the date-ordering index is not used by list handlers yet.</li>
          <li>Schema validation enforces response shape and some application constraints. There is no labelled email evaluation set establishing classification accuracy, so imports require user review.</li>
          <li>Resume scores use a fixed early-career AWS/backend rubric. They are subjective feedback, with a local heuristic fallback if the model service is unavailable.</li>
          <li>The Cognito SDK persists its session in localStorage. Scripts running on the application's origin must remain trustworthy.</li>
        </ul>
      </section>
      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">Explore</h2>
        <AscendDemo />
        <div className="exh-cs-explore-links"><a href="https://github.com/edgarsetyan23/Ascend" target="_blank" rel="noopener noreferrer" className="exh-repo-link">View the full source on GitHub →</a></div>
      </section>
    </div>
  )
}
