import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Auth } from './constructs/auth';
import { Database } from './constructs/database';
import { Api } from './constructs/api';

export class AscendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const auth = new Auth(this, 'Auth');
    const db = new Database(this, 'Database');
    const api = new Api(this, 'Api', {
      table: db.table,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
    });

    // CfnOutputs are read by scripts/generate-env.mjs after cdk deploy
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.httpApi.apiEndpoint,
      exportName: 'AscendApiUrl',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: auth.userPool.userPoolId,
      exportName: 'AscendUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: auth.userPoolClient.userPoolClientId,
      exportName: 'AscendUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      exportName: 'AscendRegion',
    });
  }
}
