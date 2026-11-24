#!/usr/bin/env node
// PreToolUse hook (Edit|Write|MultiEdit): refuses edits that are never right
// in this repo, before they happen. Exit 2 blocks the tool call and tells
// Claude why.
//
//   1. Local env files and CDK outputs hold real IDs and secrets; they're
//      edited by the owner, not by an agent.
//   2. No credentials in any file.
//   3. Nothing secret behind a VITE_ prefix (Vite inlines those into the
//      public bundle), and no Anthropic client in the browser.
import { block, incomingText, readEvent, repoPath, SECRET_PATTERNS } from "./lib.mjs";

const PROTECTED_FILES = new Set([".env", ".env.local", ".env.production", "infra/.env", "infra/cdk-outputs.json"]);

const event = await readEvent();
const filePath = event.tool_input?.file_path;
if (!filePath) process.exit(0);
const rel = repoPath(filePath);

if (PROTECTED_FILES.has(rel) || /^\.env\..+\.local$/.test(rel)) {
  block(`Blocked: ${rel} holds real deployment values and is owner-managed. Update .env.example (or infra/.env.example) and tell the user what to set.`);
}

const text = incomingText(event.tool_input);
for (const [pattern, what] of SECRET_PATTERNS) {
  if (pattern.test(text)) block(`Blocked: this edit to ${rel} contains what looks like ${what}. Secrets belong in Vercel/AWS config, read server-side.`);
}

const viteSecret = text.match(/VITE_[A-Z0-9_]*(SECRET|API_KEY|PRIVATE|TOKEN)\b/);
if (viteSecret) {
  block(
    `Blocked: ${viteSecret[0]} would be inlined into the public JavaScript bundle (every VITE_ variable is). ` +
      `Read secrets only in api/ via process.env without the VITE_ prefix.`,
  );
}

if (/dangerouslyAllowBrowser\s*:\s*true/.test(text)) {
  block("Blocked: an Anthropic client in the browser exposes the API key. Call Claude from a Vercel function in api/ (see the /add-ai-endpoint skill).");
}
