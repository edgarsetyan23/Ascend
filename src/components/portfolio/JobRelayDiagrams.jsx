// Two hand-built SVGs for the JobRelay write-up, drawn with the same
// .exh-diagram-* classes as AscendArchitectureDiagram so they share the
// gallery's palette and theme switching. Every box, arrow and label
// corresponds to something in the jobrelay repo (src/db/jobsRepo.ts,
// src/outbox/dispatcher.ts, src/worker/processor.ts) — see
// docs/ARCHITECTURE.md and docs/FAILURE_SCENARIOS.md there.
//
// Marker ids are prefixed jr- so they can never collide with the
// Ascend diagram's markers if both ever render on one page.

function Markers() {
  return (
    <defs>
      <marker id="jr-arrow-accent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" className="exh-diagram-arrowhead exh-diagram-arrowhead--auth" />
      </marker>
      <marker id="jr-arrow-gray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" className="exh-diagram-arrowhead exh-diagram-arrowhead--public" />
      </marker>
      <marker id="jr-arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" className="exh-diagram-arrowhead exh-diagram-arrowhead--muted" />
      </marker>
    </defs>
  )
}

export function JobRelayArchitectureDiagram() {
  return (
    <figure className="exh-diagram-figure">
      <svg
        className="exh-diagram-svg"
        viewBox="0 0 680 370"
        role="img"
        aria-labelledby="jr-arch-title"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id="jr-arch-title">
          JobRelay job flow: the API writes the job and an outbox event to
          PostgreSQL in one transaction and returns 202; an outbox
          dispatcher publishes unpublished events to Redis/BullMQ; workers
          pick jobs up, write thumbnails to their own per-attempt folder on
          local disk, and record the outcome back in PostgreSQL with a
          guarded update.
        </title>
        <Markers />

        {/* Browser → API */}
        <rect x="20" y="20" width="130" height="52" rx="8" className="exh-diagram-box" />
        <text x="85" y="42" textAnchor="middle" className="exh-diagram-label">Browser</text>
        <text x="85" y="59" textAnchor="middle" className="exh-diagram-sublabel">POST /api/jobs</text>
        <path d="M 150 46 L 198 46" className="exh-diagram-line exh-diagram-line--public" markerEnd="url(#jr-arrow-gray)" />

        <rect x="200" y="20" width="200" height="52" rx="8" className="exh-diagram-box" />
        <text x="300" y="42" textAnchor="middle" className="exh-diagram-label">API · Express</text>
        <text x="300" y="59" textAnchor="middle" className="exh-diagram-sublabel">202 once the commit lands</text>

        {/* API → Postgres: the one transaction */}
        <path d="M 300 72 L 300 148" className="exh-diagram-line exh-diagram-line--auth" markerEnd="url(#jr-arrow-accent)" />
        <text x="310" y="114" className="exh-diagram-sublabel">1 · one transaction</text>

        <rect x="200" y="150" width="200" height="60" rx="8" className="exh-diagram-box exh-diagram-box--accent" />
        <text x="300" y="174" textAnchor="middle" className="exh-diagram-label">PostgreSQL</text>
        <text x="300" y="192" textAnchor="middle" className="exh-diagram-sublabel">jobs + outbox_events</text>

        {/* Postgres → dispatcher */}
        <path d="M 400 180 L 478 180" className="exh-diagram-line exh-diagram-line--auth" markerEnd="url(#jr-arrow-accent)" />
        <text x="439" y="172" textAnchor="middle" className="exh-diagram-sublabel">2 · unsent</text>

        <rect x="480" y="150" width="180" height="60" rx="8" className="exh-diagram-box" />
        <text x="570" y="174" textAnchor="middle" className="exh-diagram-label">Outbox dispatcher</text>
        <text x="570" y="192" textAnchor="middle" className="exh-diagram-sublabel">sweeps every 2s</text>

        {/* dispatcher → Redis */}
        <path d="M 570 210 L 570 288" className="exh-diagram-line exh-diagram-line--auth" markerEnd="url(#jr-arrow-accent)" />
        <text x="560" y="254" textAnchor="end" className="exh-diagram-sublabel">3 · queue.add</text>

        <rect x="480" y="290" width="180" height="60" rx="8" className="exh-diagram-box" />
        <text x="570" y="314" textAnchor="middle" className="exh-diagram-label">Redis · BullMQ</text>
        <text x="570" y="332" textAnchor="middle" className="exh-diagram-sublabel">jobId = Postgres id</text>

        {/* Redis → workers */}
        <path d="M 480 320 L 402 320" className="exh-diagram-line exh-diagram-line--auth" markerEnd="url(#jr-arrow-accent)" />
        <text x="441" y="312" textAnchor="middle" className="exh-diagram-sublabel">4 · deliver</text>

        <rect x="200" y="290" width="200" height="60" rx="8" className="exh-diagram-box" />
        <text x="300" y="314" textAnchor="middle" className="exh-diagram-label">Workers</text>
        <text x="300" y="332" textAnchor="middle" className="exh-diagram-sublabel">main + 2 demo processes</text>

        {/* workers → Postgres (guarded update) */}
        <path d="M 270 288 L 270 212" className="exh-diagram-line exh-diagram-line--public" markerEnd="url(#jr-arrow-gray)" />
        <text x="262" y="254" textAnchor="end" className="exh-diagram-sublabel">5 · guarded UPDATE</text>

        {/* workers → disk */}
        <path d="M 200 320 L 152 320" className="exh-diagram-line exh-diagram-line--public" markerEnd="url(#jr-arrow-gray)" />
        <rect x="20" y="290" width="130" height="60" rx="8" className="exh-diagram-box exh-diagram-box--muted" />
        <text x="85" y="314" textAnchor="middle" className="exh-diagram-label">Local disk</text>
        <text x="85" y="332" textAnchor="middle" className="exh-diagram-sublabel">a folder per attempt</text>
      </svg>

      <figcaption className="exh-diagram-caption">
        <span className="exh-diagram-caption-label">The flow, in words:</span>
        <ol>
          <li>The browser posts an image with an idempotency key. The API saves the upload, then writes the job row and an outbox row in a single PostgreSQL transaction. The 202 goes back as soon as that commits, whatever state Redis is in.</li>
          <li>An outbox dispatcher picks up unpublished rows, right away and again on a sweep every 2 seconds, claiming them with <code>SKIP LOCKED</code>.</li>
          <li>It adds each one to BullMQ with the job's own Postgres id as the BullMQ <code>jobId</code>, so publishing the same row twice doesn't create a second job. If Redis is down, the row just stays unpublished until a later sweep.</li>
          <li>A worker picks the job up and writes three thumbnails into a folder that belongs to this attempt only.</li>
          <li>The worker records the outcome with an <code>UPDATE</code> that only succeeds if the job isn't already finished and this attempt still owns it.</li>
        </ol>
      </figcaption>
    </figure>
  )
}

export function JobRelayRecoveryDiagram() {
  return (
    <figure className="exh-diagram-figure">
      <svg
        className="exh-diagram-svg"
        viewBox="0 0 680 290"
        role="img"
        aria-labelledby="jr-recovery-title"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id="jr-recovery-title">
          Crash recovery timeline: worker A's lock expires, the job is
          re-delivered to worker B with a new ownership token, B finishes
          and marks the job succeeded, and a late write from A is rejected
          because its token no longer matches.
        </title>
        <Markers />

        {/* Lane labels */}
        <text x="20" y="74" className="exh-diagram-label">Worker A</text>
        <text x="20" y="154" className="exh-diagram-label">Worker B</text>
        <text x="20" y="234" className="exh-diagram-label">Job row</text>
        <text x="20" y="250" className="exh-diagram-sublabel">PostgreSQL</text>

        {/* Worker A: attempt 1, then lock expiry */}
        <rect x="120" y="56" width="200" height="28" rx="6" className="exh-diagram-box" />
        <text x="220" y="75" textAnchor="middle" className="exh-diagram-sublabel">attempt 1 · token a1</text>
        <text x="330" y="66" className="exh-diagram-sublabel">lock expires</text>
        <text x="330" y="81" className="exh-diagram-sublabel">(crash or long pause)</text>
        {/* A may still be alive: its late finish */}
        <rect x="480" y="56" width="180" height="28" rx="6" className="exh-diagram-box exh-diagram-box--muted" />
        <text x="570" y="75" textAnchor="middle" className="exh-diagram-sublabel">A finishes late</text>

        {/* Stalled check hands the job to B */}
        <path d="M 320 84 L 358 134" className="exh-diagram-line exh-diagram-line--public" markerEnd="url(#jr-arrow-gray)" />
        <text x="250" y="114" textAnchor="middle" className="exh-diagram-sublabel">stalled check re-delivers</text>

        {/* Worker B: attempt 2 */}
        <rect x="360" y="136" width="190" height="28" rx="6" className="exh-diagram-box exh-diagram-box--accent" />
        <text x="455" y="155" textAnchor="middle" className="exh-diagram-sublabel">attempt 2 · token b2</text>

        {/* Job row timeline */}
        <rect x="120" y="216" width="240" height="28" rx="6" className="exh-diagram-box" />
        <text x="240" y="235" textAnchor="middle" className="exh-diagram-sublabel">running · token a1</text>
        <rect x="360" y="216" width="190" height="28" rx="6" className="exh-diagram-box" />
        <text x="455" y="235" textAnchor="middle" className="exh-diagram-sublabel">running · token b2</text>
        <rect x="550" y="216" width="110" height="28" rx="6" className="exh-diagram-box exh-diagram-box--accent" />
        <text x="605" y="235" textAnchor="middle" className="exh-diagram-sublabel">succeeded · b2</text>

        {/* B claims the row, then commits */}
        <path d="M 365 164 L 365 214" className="exh-diagram-line exh-diagram-line--auth" markerEnd="url(#jr-arrow-accent)" />
        <path d="M 545 164 L 555 214" className="exh-diagram-line exh-diagram-line--auth" markerEnd="url(#jr-arrow-accent)" />
        <text x="372" y="194" className="exh-diagram-sublabel">new token</text>
        <text x="500" y="194" textAnchor="end" className="exh-diagram-sublabel">commit</text>

        {/* A's late write is fenced off */}
        <path d="M 640 84 L 640 214" className="exh-diagram-line exh-diagram-line--muted" markerEnd="url(#jr-arrow-muted)" />
        <text x="632" y="120" textAnchor="end" className="exh-diagram-sublabel">a1 ≠ b2</text>
        <text x="632" y="135" textAnchor="end" className="exh-diagram-sublabel">→ 0 rows updated</text>

        {/* Time axis */}
        <path d="M 120 274 L 660 274" className="exh-diagram-line exh-diagram-line--muted" markerEnd="url(#jr-arrow-muted)" />
        <text x="120" y="268" className="exh-diagram-sublabel">time</text>
      </svg>

      <figcaption className="exh-diagram-caption">
        <span className="exh-diagram-caption-label">The recovery, in words:</span>
        <ol>
          <li>Worker A starts the job, and the job row gets ownership token <code>a1</code>.</li>
          <li>A's lock in Redis expires, either because the process crashed or because it stalled long enough. From the outside, those two cases look identical.</li>
          <li>BullMQ's stalled-job check gives the job to worker B. B's claim writes a new token, <code>b2</code>, to the row.</li>
          <li>B finishes, and its guarded update marks the job succeeded and records <code>b2</code> as the attempt whose files are the result.</li>
          <li>If A was only paused and finishes later, its update still requires token <code>a1</code>, so it changes nothing. Its files sit in its own folder and get deleted rather than replacing B's.</li>
        </ol>
      </figcaption>
    </figure>
  )
}
