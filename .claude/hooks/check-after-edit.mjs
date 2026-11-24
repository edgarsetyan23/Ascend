#!/usr/bin/env node
// PostToolUse hook: after Claude edits a source file, run only the tests that
// cover it and report failures back.
//
//   src/**, api/**     -> `vitest related <file>` (tests that import it)
//   infra/lambda/**    -> the infra node:test suite (~1s)
//   anything else      -> skip (CSS, docs, images, config)
//
// Exit 2 sends stderr to Claude as feedback; exit 0 stays silent.
import { spawnSync } from "node:child_process";
import { relative } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;

let filePath = "";
try {
  filePath = JSON.parse(input).tool_input?.file_path ?? "";
} catch {
  process.exit(0); // malformed event: never block on our own bug
}

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const rel = relative(projectDir, filePath).replaceAll("\\", "/");
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

const result = spawnSync(command, { cwd: projectDir, encoding: "utf8", shell: true, env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" } });
if (result.status !== 0) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n").slice(-40).join("\n");
  process.stderr.write(`${label} failed after editing ${rel}:\n\n${output}\n`);
  process.exit(2);
}
