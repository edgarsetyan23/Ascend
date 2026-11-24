#!/usr/bin/env node
// SessionStart hook: anything printed to stdout becomes context for Claude.
// Surfaces the state that has caused wasted time or risk before: being on
// the production branch, and missing local env values that blank the app.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { projectDir, sh } from "./lib.mjs";

const lines = ["## Ascend session context"];

const branch = sh("git branch --show-current").output || "(detached)";
const dirty = sh("git status --porcelain").output.split("\n").filter(Boolean).length;
lines.push(`- Branch: ${branch}; ${dirty} uncommitted file(s).`);
if (branch === "master") {
  lines.push("- You are on `master`, which Vercel deploys to production. Create a branch before changing anything.");
}

if (!existsSync(join(projectDir, ".env.local"))) {
  lines.push(
    "- No `.env.local`. `npm run build` needs some VITE_USER_POOL_ID / VITE_USER_POOL_CLIENT_ID or the app renders blank. " +
      "Ask the user before creating one with dummy values; never commit it.",
  );
}

lines.push("- Browser checks: unregister the PWA service worker and clear caches first, or you'll be testing stale JS.");

console.log(lines.join("\n"));
