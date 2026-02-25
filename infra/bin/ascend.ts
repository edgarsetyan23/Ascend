#!/usr/bin/env node
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { AscendStack } from '../lib/ascend-stack';

// Auto-load infra/.env so OWNER_USER_ID is always available during deploys
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = new cdk.App();

new AscendStack(app, 'AscendStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'Ascend Accountability Tracker — API, Auth, and Database',
});
