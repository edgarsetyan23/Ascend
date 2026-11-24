#!/usr/bin/env node
// PostToolUse hook: after Claude edits a source file, run only the tests that
// cover it and report failures back.
//
//   src/**, api/**     -> `vitest related <file>` (tests that import it)
//   infra/lambda/**    -> the infra node:test suite (~1s)
//   anything else      -> skip (CSS, docs, images, config)
//
// Exit 2 sends stderr to Claude as feedback; exit 0 stays silent.
import { readEvent, repoPath, sh, tail } from "./lib.mjs";

const event = await readEvent();
const filePath = event.tool_input?.file_path;
if (!filePath) process.exit(0);
const rel = repoPath(filePath);
if (!/\.(js|jsx|mjs)$/.test(rel)) process.exit(0);

let label, command;
if (rel.startsWith("infra/lambda/")) {
  label = "infra tests";
  command = "npm --prefix infra test";
} else if (rel.startsWith("src/") || rel.startsWith("api/")) {
  label = `tests related to ${rel}`;
  command = `npx vitest related "${rel}" --run --passWithNoTests`;
} else {
  process.exit(0);
}

const result = sh(command);
if (result.status !== 0) {
  process.stderr.write(`${label} failed after editing ${rel}:\n\n${tail(result.output)}\n`);
  process.exit(2);
}
