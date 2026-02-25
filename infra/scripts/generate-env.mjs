#!/usr/bin/env node
/**
 * Reads cdk-outputs.json (produced by `cdk deploy --outputs-file ./cdk-outputs.json`)
 * and writes ../.env.production for Vite / Vercel.
 *
 * Usage:
 *   cd infra && cdk deploy --outputs-file ./cdk-outputs.json
 *   node scripts/generate-env.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const outputsPath = join(__dirname, '..', 'cdk-outputs.json');
const envPath = join(__dirname, '..', '..', '.env.production');

let outputs;
try {
  outputs = JSON.parse(readFileSync(outputsPath, 'utf8'));
} catch {
  console.error('ERROR: cdk-outputs.json not found. Run: cdk deploy --outputs-file ./cdk-outputs.json');
  process.exit(1);
}

const stack = outputs.AscendStack;
if (!stack) {
  console.error('ERROR: AscendStack not found in cdk-outputs.json');
  process.exit(1);
}

const lines = [
  `VITE_API_URL=${stack.ApiUrl}`,
  `VITE_COGNITO_REGION=${stack.Region}`,
  `VITE_USER_POOL_ID=${stack.UserPoolId}`,
  `VITE_USER_POOL_CLIENT_ID=${stack.UserPoolClientId}`,
];

const content = lines.join('\n') + '\n';
writeFileSync(envPath, content);

console.log('Generated .env.production:');
console.log(content);
console.log('Next: Set these same values in your Vercel dashboard under Settings → Environment Variables.');
