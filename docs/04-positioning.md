# Ascend — Positioning Strategy

## What this document covers
How to think about what Ascend is, who it's for, and what to build next to make it the strongest possible interview artifact. Read this before deciding what to work on.

---

## The three layers

Ascend has three distinct layers with different audiences and responsibilities. Keeping these clear prevents the project from becoming hard to explain.

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Personal Productivity Layer                                  │
│     Audience: You                                               │
│     Purpose: Actually use the app — track LeetCode, jobs, etc.  │
│     Value: Real data, real usage, honest numbers                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  2. Engineering Showcase Layer                                   │
│     Audience: Hiring managers, recruiters, interviewers         │
│     Purpose: Demonstrate architecture decisions, security       │
│              choices, and feature-building capability           │
│     Value: Live system with real users (you), not a demo app    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  3. Infrastructure Layer                                         │
│     Audience: Senior engineers, tech leads                      │
│     Purpose: Show production-readiness thinking                 │
│     Value: CDK, single-table design, least-privilege IAM,       │
│             JWT auth, separate public/private Lambda boundary   │
└─────────────────────────────────────────────────────────────────┘
```

The recruiter page is explicitly Layer 2. The main app is Layer 1 + 3. When someone asks "what is Ascend?", lead with Layer 2, back it up with Layer 3.

---

## Current positioning

**Backend Interview Weapon + Portfolio Hybrid**

This is the right direction for a candidate at 1 YOE coming from AWS. The reasoning:

- You have production AWS experience. The CDK + Lambda + DynamoDB stack is not toy code — it mirrors what real teams use.
- The single-table DynamoDB design, JWT authorizer placement, and IAM least-privilege choices are things most bootcamp portfolios don't have.
- The Claude AI integration shows you can consume external APIs and build product features around them — not just CRUD.

---

## What to emphasize vs. downplay

### Emphasize
- **The auth model** — tokens in memory, JWT validated at the API Gateway layer before Lambda executes, Cognito managing identity. This is production-standard.
- **DynamoDB single-table design** — query pattern `begins_with(SK, "TRACKER#{id}#ENTRY#")` means one read per tab load, no scans. Senior engineers notice this.
- **Optimistic UI with rollback** — `useEntries.js` applies changes immediately, fires the API, rolls back if it fails. Shows you understand perceived performance.
- **The public Lambda security model** — hardcoded owner ID, whitelist, read-only IAM, 404 not 403. This is a real security pattern, not "I made it public."
- **Infrastructure as code** — CDK manages everything. No manual console clicks. Reproducible.

### Downplay
- The specific trackers (LeetCode, gaming) — these are implementation details.
- The resume scorer's Claude integration as an AI feature — frame it as "I built a product feature that calls an external API and presents structured results," not "I used ChatGPT."
- The UI polish (skeleton loaders, toasts, etc.) — mention it briefly as "I built it to production UX standards" and move on. It's not the point.

---

## The strongest interview narrative

> "I built a personal accountability tracker to solve a real problem — I wanted to track my LeetCode and job applications in one place. But I deliberately chose an AWS stack that mirrors what I worked with at AWS RDS: API Gateway with a JWT authorizer, Lambda functions behind least-privilege IAM roles, DynamoDB with a single-table design, and all of it provisioned through CDK.
>
> The interesting design choice is the public recruiter page. I needed a read-only endpoint without auth, so I added a separate Lambda function — same code patterns, but no JWT, no getUserId(). The owner's Cognito sub is baked into the Lambda environment variable at deploy time, so no user input ever touches the DynamoDB partition key. There's a whitelist that returns 404 for non-allowed trackers — 404, not 403, because 403 would confirm the route exists.
>
> The whole thing is live at edgarsetyan.com/portfolio — you can see the live data from DynamoDB right now."

---

## Next backend improvements (in priority order)

These are the changes that would move Ascend from "strong junior portfolio" toward "mid-level backend maturity."

### 1. Structured logging in Lambda
Currently: `console.error('error:', e)`
Better: JSON log lines with `requestId`, `trackerId`, `userId` (hashed), `latencyMs`, `errorCode`.

Why it matters: CloudWatch can't easily alert on or aggregate unstructured logs. Structured JSON logs let you build dashboards and alarms. Senior engineers who've worked in production will ask about this.

```js
console.log(JSON.stringify({
  requestId: event.requestContext.requestId,
  trackerId,
  latencyMs: Date.now() - startTime,
  itemCount: entries.length,
}))
```

### 2. Request ID correlation
API Gateway generates a `requestId` on every request. Pass it back in the response body and log it in Lambda. This lets you trace a specific failing request end-to-end through CloudWatch Logs Insights.

### 3. CloudWatch alarms
Set up alarms on:
- Lambda error rate > 1%
- Lambda P99 latency > 2000ms
- DynamoDB throttle events > 0

These are basic production hygiene. A senior engineer would expect them on any real service.

### 4. DynamoDB pagination
Currently: Lambda returns all entries for a tracker in one response.
Better: Return `LastEvaluatedKey` from DynamoDB and a `nextToken` in the API response. Client sends `?nextToken=...` to get the next page.

This is a meaningful change that demonstrates you understand that DynamoDB Queries are paginated at the service level — you're currently just getting lucky that entry counts are small.

### 5. Input validation in Lambda
Currently: Lambda trusts the request body for `create` and `update` operations.
Better: Validate field types, required fields, and max lengths before writing to DynamoDB. Return 400 with a structured error.

```js
if (!data.problem || data.problem.length > 200) {
  return err(400, 'problem is required and must be under 200 characters')
}
```

---

## What not to build

- **A social feed / sharing features** — this is a personal productivity tool, not a social app.
- **Mobile app** — the web app is responsive. A native app is a separate project.
- **User management / admin panel** — Ascend is single-user by design. Don't generalize it.
- **More tracker types** — the five existing trackers are already more than enough. Depth > breadth.
- **Heavy UI additions** — charts, dashboards, analytics. These are cosmetic. Interviewers don't care. Backend choices do.
