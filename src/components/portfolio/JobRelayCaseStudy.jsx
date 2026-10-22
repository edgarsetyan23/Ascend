import { JobRelayArchitectureDiagram, JobRelayRecoveryDiagram } from './JobRelayDiagrams.jsx'
import '../../styles/ascend-case-study.css'

const REPO = 'https://github.com/edgarsetyan23/jobrelay/blob/main'

// Same rule as the Ascend write-up: every claim here was checked
// against the jobrelay repo (code, docs/, bench/RESULTS.md), not
// written from memory. Where the repo's own docs state a limitation
// (CI runs unit tests only, a flaky outage test), it's repeated here
// rather than left out. Shares ascend-case-study.css (.exh-cs-*) so
// both write-ups read as one format.
const DECISIONS = [
  {
    title: 'A transactional outbox between PostgreSQL and Redis',
    requirement:
      'A 202 has to mean "this job will run", even if Redis is down at that moment or the API crashes right after.',
    approach: (
      <>
        <code>createJobWithOutbox</code> writes the job row and an <code>outbox_events</code> row in one
        transaction, with <code>INSERT … ON CONFLICT (idempotency_key) DO NOTHING</code> so concurrent
        retries of the same request collapse into one job. A dispatcher claims unpublished rows with{' '}
        <code>SKIP LOCKED</code> and calls <code>queue.add</code> using the Postgres id as BullMQ's{' '}
        <code>jobId</code>, so republishing a row is a no-op instead of a second job (
        <a href={`${REPO}/src/outbox/dispatcher.ts`} target="_blank" rel="noopener noreferrer">dispatcher.ts</a>).
      </>
    ),
    tradeoff:
      "It's one more table and a background sweep, and it gives at-least-once delivery, not exactly-once: if a finished job has already been trimmed from Redis when a retry lands, the work can run a second time. That residual case is why result storage is made safe on its own (decision 2), instead of relying on BullMQ's dedup.",
  },
  {
    title: 'Ownership tokens so a "dead" worker can’t overwrite a live one',
    requirement:
      "An expired lock doesn't prove a worker crashed. It may just have paused (a long GC pause, a saturated event loop) and finish later. Two attempts must never both publish a result.",
    approach: (
      <>
        Every time an attempt enters <code>running</code>, it stamps a fresh <code>running_token</code> on the
        job row. Every finishing <code>UPDATE</code> requires both a non-terminal status and that same token (
        <a href={`${REPO}/src/db/jobsRepo.ts`} target="_blank" rel="noopener noreferrer">jobsRepo.ts</a>), so a
        stale attempt's write updates zero rows. Thumbnails go into a folder per attempt that is never moved,
        and downloads are served from whichever attempt the row says won.
      </>
    ),
    tradeoff:
      'The same image can be processed more than once, which wastes work, but only one result is ever stored. The design accepts that because exactly-once across two independent systems would need a distributed transaction, which BullMQ doesn’t offer.',
    diagram: <JobRelayRecoveryDiagram />,
  },
  {
    title: 'PostgreSQL for the record, Redis for execution',
    requirement:
      'Push-based delivery, retries with a capped backoff, and automatic pickup of jobs from crashed workers, without hand-building all of it.',
    approach: (
      <>
        BullMQ handles delivery and stalled-job detection: an 8-second lock and a stalled check every 2
        seconds, shortened from BullMQ's 30-second default so the live demo recovers in seconds. Retries use a
        custom backoff, <code>min(500ms × 2ⁿ⁻¹, 30s) ± 30%</code> (
        <a href={`${REPO}/src/queue/backoff.ts`} target="_blank" rel="noopener noreferrer">backoff.ts</a>),
        because BullMQ's built-in exponential option has no cap. Postgres stays the source of truth: failed
        jobs and every attempt's history live there, not in Redis.
      </>
    ),
    tradeoff:
      "It's two systems to run and monitor. The repo's own architecture doc says a Postgres-only queue (SELECT … FOR UPDATE SKIP LOCKED) is a legitimate, simpler choice at low volume; Redis is there because push delivery, jittered backoff and stalled-job recovery were the point.",
  },
]

const BENCH = [
  { concurrency: 1, jobsPerSec: '24.2', queueWait: 772 },
  { concurrency: 2, jobsPerSec: '40.1', queueWait: 435 },
  { concurrency: 4, jobsPerSec: '76.3', queueWait: 251 },
  { concurrency: 8, jobsPerSec: '73.9', queueWait: 191 },
]

export function JobRelayCaseStudy() {
  return (
    <div className="exh-cs" id="jobrelay-case-study">
      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">The problem</h2>
        <p className="exh-cs-text">
          Accepting a background job means two systems have to agree: a durable record in PostgreSQL and a
          queued task in Redis. The gaps between them are where jobs get lost or done twice: Redis down
          for a few seconds, a crash between the two writes, a worker dying halfway through. JobRelay is a
          small image-thumbnail service built to stay correct through those gaps, and its dashboard lets you
          cause them yourself (send a request twice, fail an attempt, kill a real worker process) and watch it
          recover.
        </p>
      </section>

      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">How a job moves through it</h2>
        <JobRelayArchitectureDiagram />
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
              {d.diagram}
            </div>
          ))}
        </div>
      </section>

      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">How it's tested</h2>
        <p className="exh-cs-text">
          29 integration tests across 11 files run against a real PostgreSQL and Redis, not mocks. A few of
          them go further than usual:
        </p>
        <ul className="exh-cs-limitations">
          <li>
            <a href={`${REPO}/test/integration/redisOutage.test.ts`} target="_blank" rel="noopener noreferrer">redisOutage.test.ts</a>{' '}
            stops the actual Redis container with <code>docker stop</code>, submits a job, starts Redis again, and
            checks the job still completes.
          </li>
          <li>
            <a href={`${REPO}/test/integration/demoPanel.test.ts`} target="_blank" rel="noopener noreferrer">demoPanel.test.ts</a>{' '}
            spawns a real worker process and kills it mid-job.
          </li>
          <li>
            <a href={`${REPO}/test/integration/successCommitCrash.test.ts`} target="_blank" rel="noopener noreferrer">successCommitCrash.test.ts</a>{' '}
            simulates a crash just before and just after the success write, using gates the test releases by
            hand instead of timed delays, so the overlap happens every run, not just usually.
          </li>
        </ul>
        <p className="exh-cs-text">
          Benchmark, one run on one machine (8-core desktop, local Postgres and Redis, 40 jobs per run, a
          ~5.9 KB synthetic image), from{' '}
          <a href={`${REPO}/bench/RESULTS.md`} target="_blank" rel="noopener noreferrer">bench/RESULTS.md</a>:
        </p>
        <div className="exh-table-wrap">
          <table className="exh-table">
            <thead>
              <tr>
                <th className="exh-th">Worker concurrency</th>
                <th className="exh-th">Completed jobs/sec</th>
                <th className="exh-th">Avg queue wait</th>
              </tr>
            </thead>
            <tbody>
              {BENCH.map((r) => (
                <tr key={r.concurrency}>
                  <td className="exh-td">{r.concurrency}</td>
                  <td className="exh-td">{r.jobsPerSec}</td>
                  <td className="exh-td">{r.queueWait} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="exh-cs-text">
          Throughput levels off between 4 and 8. With no network between components and a tiny image, these
          numbers show the shape of the scaling, not production capacity.
        </p>
      </section>

      <section className="exh-cs-section">
        <h2 className="exh-cs-heading">Limitations</h2>
        <ul className="exh-cs-limitations">
          <li>It's a local, single-tenant demo with no authentication, and the README says plainly not to deploy it publicly as-is.</li>
          <li>Files live on local disk, so the API and workers have to share a machine. Running them apart would mean moving storage to something like S3.</li>
          <li>Delivery is at-least-once, so work can repeat. Only the stored result is guaranteed to be single.</li>
          <li>CI runs the unit tests only. The integration suite needs Docker and is run locally, and the Redis-outage test has timed out once in a full run (it passed alone).</li>
        </ul>
        <div className="exh-cs-explore-links">
          <a href="https://github.com/edgarsetyan23/jobrelay" target="_blank" rel="noopener noreferrer" className="exh-repo-link">
            View the full source on GitHub →
          </a>
        </div>
      </section>
    </div>
  )
}
