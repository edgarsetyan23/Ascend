// Tests for the Claude Code hooks. Run with `npm run test:hooks`.
// Each hook is run as a real child process with a real hook event on stdin,
// the same way Claude Code invokes it.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";

const hooksDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(hooksDir, "..", "..");

function runHook(name, event, projectDir = repoRoot) {
  const result = spawnSync(process.execPath, [join(hooksDir, name)], {
    input: JSON.stringify(event),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
  return { code: result.status, stderr: result.stderr, stdout: result.stdout };
}

const write = (filePath, content = "x", root = repoRoot) => ({
  tool_name: "Write",
  tool_input: { file_path: join(root, filePath), content },
});

/** A throwaway git repo on `master` with the given files committed. */
function sandboxRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), "ascend-hooks-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  const git = (...args) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir });
  git("init", "-q", "-b", "master");
  git("add", ".");
  git("commit", "-qm", "init");
  return dir;
}

describe("guard-edits (PreToolUse)", () => {
  test("blocks owner-managed env and CDK output files", () => {
    for (const file of [".env.local", ".env.production", "infra/.env", "infra/cdk-outputs.json", ".env.staging.local"]) {
      assert.equal(runHook("guard-edits.mjs", write(file)).code, 2, file);
    }
  });

  test("allows the env templates", () => {
    assert.equal(runHook("guard-edits.mjs", write(".env.example")).code, 0);
    assert.equal(runHook("guard-edits.mjs", write("infra/.env.example")).code, 0);
  });

  test("blocks a secret-looking VITE_ variable but not a public client ID", () => {
    const r = runHook("guard-edits.mjs", write("src/lib/x.js", "const k = import.meta.env.VITE_ANTHROPIC_API_KEY"));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /public JavaScript bundle/);
    assert.equal(runHook("guard-edits.mjs", write("src/lib/x.js", "import.meta.env.VITE_GOOGLE_CLIENT_ID")).code, 0);
  });

  test("blocks an Anthropic client configured for the browser", () => {
    const r = runHook("guard-edits.mjs", write("src/lib/x.js", "new Anthropic({ dangerouslyAllowBrowser: true })"));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /api\//);
  });

  test("blocks content containing a credential", () => {
    const fakeKey = ["sk", "ant", "b".repeat(30)].join("-");
    assert.equal(runHook("guard-edits.mjs", write("api/x.js", `const key = "${fakeKey}"`)).code, 2);
  });

  test("allows an ordinary edit", () => {
    assert.equal(runHook("guard-edits.mjs", write("src/components/X.jsx", "export default () => null")).code, 0);
  });
});

describe("stop-gate (Stop)", () => {
  const sandbox = sandboxRepo({
    ".gitignore": ".claude/state/\n",
    "vite.config.js": "export default {}\n",
    "public/Edgar_Resume.pdf": "v1",
    "infra/package.json": JSON.stringify({ scripts: { test: "node -e \"process.exit(require('fs').existsSync('FAIL') ? 1 : 0)\"" } }),
    "infra/lambda/handler.mjs": "export {}\n",
  });
  after(() => rmSync(sandbox, { recursive: true, force: true }));

  test("passes with a clean tree", () => {
    assert.equal(runHook("stop-gate.mjs", {}, sandbox).code, 0);
  });

  test("asks for review and fact-check together, once per change set", () => {
    writeFileSync(join(sandbox, "vite.config.js"), "export default { changed: true }\n");
    writeFileSync(join(sandbox, "public/Edgar_Resume.pdf"), "v2");
    const first = runHook("stop-gate.mjs", {}, sandbox);
    assert.equal(first.code, 2);
    assert.match(first.stderr, /ascend-reviewer/);
    assert.match(first.stderr, /portfolio-fact-checker/);
    assert.equal(runHook("stop-gate.mjs", {}, sandbox).code, 0, "same diff: gates already fired");
  });

  test("re-runs a failing test suite on every stop until it passes", () => {
    writeFileSync(join(sandbox, "infra/lambda/handler.mjs"), "export const changed = 1\n");
    writeFileSync(join(sandbox, "infra/FAIL"), "");
    const first = runHook("stop-gate.mjs", {}, sandbox);
    assert.equal(first.code, 2);
    assert.match(first.stderr, /Infra test suite .* failed/);
    const second = runHook("stop-gate.mjs", {}, sandbox);
    assert.equal(second.code, 2, "failure isn't recorded as passed");
    assert.match(second.stderr, /Infra test suite/);

    rmSync(join(sandbox, "infra/FAIL"));
    assert.equal(runHook("stop-gate.mjs", {}, sandbox).code, 0, "green suite is recorded");
  });

  test("never blocks while Claude is already continuing from a Stop hook", () => {
    writeFileSync(join(sandbox, "vite.config.js"), "export default { changed: 2 }\n");
    assert.equal(runHook("stop-gate.mjs", { stop_hook_active: true }, sandbox).code, 0);
  });
});

describe("check-after-edit (PostToolUse)", () => {
  test("skips files that have no tests to run", () => {
    assert.equal(runHook("check-after-edit.mjs", write("src/index.css")).code, 0);
    assert.equal(runHook("check-after-edit.mjs", write("README.md")).code, 0);
  });
});

describe("session-context (SessionStart)", () => {
  test("warns when the session starts on master", () => {
    const dir = sandboxRepo({ "README.md": "x" });
    try {
      const r = runHook("session-context.mjs", {}, dir);
      assert.equal(r.code, 0);
      assert.match(r.stdout, /deploys to production/);
      assert.match(r.stdout, /No `\.env\.local`/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
