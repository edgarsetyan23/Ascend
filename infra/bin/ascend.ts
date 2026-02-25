#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AscendStack } from '../lib/ascend-stack';

const app = new cdk.App();

new AscendStack(app, 'AscendStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'Ascend Accountability Tracker — API, Auth, and Database',
});
