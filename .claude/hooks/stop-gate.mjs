#!/usr/bin/env node
// Stop hook: runs when Claude is about to end its turn. Exit 2 sends it back
// to work with stderr as the reason. Each gate fires once per distinct
// change set (fingerprinted), so it nudges and doesn't loop.
//
//   1. Full test run: the PostToolUse hook only runs tests related to each
//      edited file; this runs the whole frontend suite (and the infra suite
//      if Lambdas changed) once before finishing.
//   2. Review gate: changes to api/, infra/, or auth code need an
//      ascend-reviewer pass.
//   3. Fact gate: changes to public portfolio content need a
//      portfolio-fact-checker pass, because recruiters read it.
import { block, diffFingerprint, readEvent, readState, sh, tail, writeState } from "./lib.mjs";

const GATES = [
  {
    key: "tests",
    paths: ["src", "api"],
    run: () => sh("npx vitest run", 180_000),
    label: "Frontend test suite (npx vitest run)",
  },
  {
    key: "infraTests",
    paths: ["infra/lambda"],
    run: () => sh("npm --prefix infra test", 120_000),
    label: "Infra test suite (npm --prefix infra test)",
  },
  {
    key: "review",
    paths: ["api", "infra/lambda", "infra/lib", "src/lib", "src/context/AuthContext.jsx", "vite.config.js", "vercel.json"],
    message: "Security-relevant files changed (API handlers, Lambdas, CDK, auth, or build/deploy config). Before finishing, run the ascend-reviewer subagent on the uncommitted diff and address any Blocking findings.",
  },
  {
    key: "facts",
    paths: ["src/components/RecruiterView.jsx", "src/components/portfolio", "src/lib/portfolioPages.js", "public/Edgar_Resume.pdf"],
    message: "Public portfolio content changed. Before finishing, run the portfolio-fact-checker subagent and fix or remove any claim it can't verify.",
  },
];

const event = await readEvent();
if (event.stop_hook_active) process.exit(0);

// Evaluate every gate before blocking: Claude's next stop arrives with
// stop_hook_active set and is let through, so anything not reported now
// would be skipped for this turn.
const state = readState();
const reasons = [];
for (const gate of GATES) {
  const fingerprint = diffFingerprint(gate.paths);
  if (!fingerprint || state[gate.key] === fingerprint) continue;

  if (gate.run) {
    const result = gate.run();
    // A failure isn't recorded, so the suite re-runs on the next stop until it's green.
    if (result.status !== 0) reasons.push(`${gate.label} failed:\n\n${tail(result.output)}`);
    else state[gate.key] = fingerprint;
  } else {
    state[gate.key] = fingerprint;
    reasons.push(gate.message);
  }
}
writeState(state);

if (reasons.length > 0) {
  block(`${reasons.join("\n\n")}\n\n(Review gates fire once per change set.)`);
}
