import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Duration } from 'aws-cdk-lib';
import * as path from 'path';

interface ApiProps {
  table: dynamodb.Table;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class Api extends Construct {
  readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'ascend-api',
      corsPreflight: {
        allowOrigins: [
          'https://edgarsetyan.com',
          'https://www.edgarsetyan.com',
          'https://useascend.vercel.app',
          'https://accountability-tracker-three.vercel.app',
          'http://localhost:5173',
        ],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: Duration.days(1),
      },
    });

    // JWT authorizer validates Cognito IdTokens before Lambda ever runs
    const authorizer = new HttpJwtAuthorizer(
      'CognitoAuthorizer',
      props.userPool.userPoolProviderUrl, // https://cognito-idp.{region}.amazonaws.com/{poolId}
      {
        jwtAudience: [props.userPoolClient.userPoolClientId],
      },
    );

    const lambdaDir = path.join(__dirname, '../../lambda');

    // Shared Lambda config — ARM_64 is ~20% cheaper than x86 at same performance
    const sharedProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: Duration.seconds(10),
      memorySize: 256,
      environment: { TABLE_NAME: props.table.tableName },
      bundling: {
        // CJS is more reliable for Lambda cold starts than ESM.
        // ESM bundles can crash at initialization when AWS SDK internals
        // try to use require() — CJS avoids that entirely.
        format: OutputFormat.CJS,
        // Bundle @aws-sdk — not available by default in Node 22 Lambda runtime
        externalModules: [],
      },
    };

    const lambdaEntry = (filename: string) => path.join(lambdaDir, filename);

    const listFn = new NodejsFunction(this, 'EntriesListFn', {
      ...sharedProps,
      functionName: 'ascend-entries-list',
      entry: lambdaEntry('entries-list.mjs'),
    });

    const createFn = new NodejsFunction(this, 'EntriesCreateFn', {
      ...sharedProps,
      functionName: 'ascend-entries-create',
      entry: lambdaEntry('entries-create.mjs'),
    });

    const updateFn = new NodejsFunction(this, 'EntriesUpdateFn', {
      ...sharedProps,
      functionName: 'ascend-entries-update',
      entry: lambdaEntry('entries-update.mjs'),
    });

    const deleteFn = new NodejsFunction(this, 'EntriesDeleteFn', {
      ...sharedProps,
      functionName: 'ascend-entries-delete',
      entry: lambdaEntry('entries-delete.mjs'),
    });

    // Public (unauthenticated) Lambda — exposes only whitelisted trackers
    // OWNER_USER_ID is baked in at deploy time; no user input touches the PK
    const publicListFn = new NodejsFunction(this, 'PublicEntriesListFn', {
      ...sharedProps,
      functionName: 'ascend-public-entries-list',
      entry: lambdaEntry('public-entries-list.mjs'),
      environment: {
        TABLE_NAME: props.table.tableName,
        OWNER_USER_ID: process.env.OWNER_USER_ID ?? '',
      },
    });

    // Least-privilege IAM — read-only vs write-only per function
    props.table.grantReadData(listFn);
    props.table.grantWriteData(createFn);
    props.table.grantWriteData(updateFn);
    props.table.grantWriteData(deleteFn);
    props.table.grantReadData(publicListFn);

    const addRoute = (
      method: apigwv2.HttpMethod,
      routePath: string,
      fn: lambda.IFunction,
      integrationId: string,
    ) => {
      this.httpApi.addRoutes({
        path: routePath,
        methods: [method],
        integration: new HttpLambdaIntegration(integrationId, fn),
        authorizer,
      });
    };

    addRoute(apigwv2.HttpMethod.GET,    '/trackers/{trackerId}/entries',            listFn,   'ListIntegration');
    addRoute(apigwv2.HttpMethod.POST,   '/trackers/{trackerId}/entries',            createFn, 'CreateIntegration');
    addRoute(apigwv2.HttpMethod.PUT,    '/trackers/{trackerId}/entries/{entryId}',  updateFn, 'UpdateIntegration');
    addRoute(apigwv2.HttpMethod.DELETE, '/trackers/{trackerId}/entries/{entryId}',  deleteFn, 'DeleteIntegration');

    // Public route — no authorizer attached
    this.httpApi.addRoutes({
      path: '/public/trackers/{trackerId}/entries',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('PublicListIntegration', publicListFn),
      // authorizer intentionally omitted — this route is unauthenticated by design
    });
  }
}
