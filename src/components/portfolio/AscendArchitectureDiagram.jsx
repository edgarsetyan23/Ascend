// A compact, hand-built SVG of Ascend's real request/data flow — not a
// generated image, so it stays crisp at any zoom and can be restyled
// with the same CSS custom properties (--exh-*) as the rest of the
// gallery instead of carrying its own baked-in colors. Every box and
// line below corresponds to something in infra/lib/constructs/api.ts:
// the JWT authorizer sits in front of the CRUD Lambda, the public
// route has none, and both paths land on the same DynamoDB table.
//
// Colors come from CSS classes (not inline var() on presentation
// attributes, which browsers handle inconsistently) — see the
// .exh-diagram-* rules in ascend-case-study.css.
export function AscendArchitectureDiagram() {
  return (
    <figure className="exh-diagram-figure">
      <svg
        className="exh-diagram-svg"
        viewBox="0 0 680 400"
        role="img"
        aria-labelledby="ascend-diagram-title"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id="ascend-diagram-title">
          Ascend request flow: the browser calls API Gateway, which routes
          authenticated requests through a JWT authorizer to a CRUD Lambda,
          and unauthenticated portfolio reads through a separate,
          read-only Lambda — both writing to and reading from the same
          DynamoDB table.
        </title>

        <defs>
          {/* Three markers, not one — an SVG marker renders in its own
              context, so making the arrowhead match its line's color
              needs a separate marker per color rather than one marker
              styled by the referencing path's class. */}
          <marker id="exh-arrow-auth" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="exh-diagram-arrowhead exh-diagram-arrowhead--auth" />
          </marker>
          <marker id="exh-arrow-public" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="exh-diagram-arrowhead exh-diagram-arrowhead--public" />
          </marker>
          <marker id="exh-arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="exh-diagram-arrowhead exh-diagram-arrowhead--muted" />
          </marker>
        </defs>

        {/* Browser */}
        <rect x="250" y="14" width="180" height="52" rx="8" className="exh-diagram-box" />
        <text x="340" y="36" textAnchor="middle" className="exh-diagram-label">Browser</text>
        <text x="340" y="53" textAnchor="middle" className="exh-diagram-sublabel">React + Vite</text>

        {/* Vercel / Claude branch */}
        <rect x="470" y="14" width="196" height="52" rx="8" className="exh-diagram-box exh-diagram-box--muted" />
        <text x="568" y="36" textAnchor="middle" className="exh-diagram-label">Vercel Functions</text>
        <text x="568" y="53" textAnchor="middle" className="exh-diagram-sublabel">Claude API · LeetCode GraphQL</text>
        <path d="M 430 40 L 468 40" className="exh-diagram-line exh-diagram-line--muted" markerEnd="url(#exh-arrow-muted)" />

        {/* API Gateway — authenticated */}
        <rect x="20" y="126" width="260" height="60" rx="8" className="exh-diagram-box" />
        <text x="150" y="150" textAnchor="middle" className="exh-diagram-label">API Gateway</text>
        <text x="150" y="168" textAnchor="middle" className="exh-diagram-sublabel">JWT Authorizer (Cognito)</text>

        {/* API Gateway — public */}
        <rect x="400" y="126" width="260" height="60" rx="8" className="exh-diagram-box" />
        <text x="530" y="150" textAnchor="middle" className="exh-diagram-label">API Gateway</text>
        <text x="530" y="168" textAnchor="middle" className="exh-diagram-sublabel">public route · no authorizer</text>

        <path d="M 300 66 L 170 124" className="exh-diagram-line exh-diagram-line--auth" markerEnd="url(#exh-arrow-auth)" />
        <path d="M 380 66 L 500 124" className="exh-diagram-line exh-diagram-line--public" markerEnd="url(#exh-arrow-public)" />

        {/* Lambdas */}
        <rect x="20" y="234" width="260" height="52" rx="8" className="exh-diagram-box" />
        <text x="150" y="256" textAnchor="middle" className="exh-diagram-label">Lambda — CRUD</text>
        <text x="150" y="273" textAnchor="middle" className="exh-diagram-sublabel">read + write, own IAM role</text>

        <rect x="400" y="234" width="260" height="52" rx="8" className="exh-diagram-box" />
        <text x="530" y="256" textAnchor="middle" className="exh-diagram-label">Lambda — public read-only</text>
        <text x="530" y="273" textAnchor="middle" className="exh-diagram-sublabel">hardcoded owner id · read-only IAM</text>

        <path d="M 150 186 L 150 232" className="exh-diagram-line exh-diagram-line--auth" markerEnd="url(#exh-arrow-auth)" />
        <path d="M 530 186 L 530 232" className="exh-diagram-line exh-diagram-line--public" markerEnd="url(#exh-arrow-public)" />

        {/* DynamoDB */}
        <rect x="180" y="326" width="320" height="58" rx="8" className="exh-diagram-box exh-diagram-box--accent" />
        <text x="340" y="350" textAnchor="middle" className="exh-diagram-label">DynamoDB — AscendData</text>
        <text x="340" y="368" textAnchor="middle" className="exh-diagram-sublabel">single table · PK = USER#{'{sub}'}</text>

        <path d="M 150 286 L 260 326" className="exh-diagram-line exh-diagram-line--auth" markerEnd="url(#exh-arrow-auth)" />
        <path d="M 530 286 L 420 326" className="exh-diagram-line exh-diagram-line--public" markerEnd="url(#exh-arrow-public)" />
      </svg>

      {/* Text equivalent — not a fallback for a missing image, an
          always-visible companion so the flow reads the same to a
          screen reader, at 200% zoom, or with images off. */}
      <figcaption className="exh-diagram-caption">
        <span className="exh-diagram-caption-label">The flow, in words:</span>
        <ol>
          <li>The browser calls API Gateway over HTTPS for both trackers and this portfolio page.</li>
          <li>Authenticated routes (tracker CRUD) go through a Cognito JWT authorizer that rejects an invalid token before any Lambda runs.</li>
          <li>The public portfolio route has no authorizer — it's a separate Lambda with a hardcoded owner id and a read-only IAM role instead.</li>
          <li>Both Lambdas read and write the same single DynamoDB table, just under different permissions.</li>
          <li>Two integrations sit outside AWS entirely: Vercel serverless functions call the Anthropic API for résumé scoring and Gmail-email classification, and the LeetCode profile banner proxies LeetCode's GraphQL API.</li>
        </ol>
      </figcaption>
    </figure>
  )
}
