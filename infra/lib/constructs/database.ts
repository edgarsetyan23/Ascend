import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

export class Database extends Construct {
  readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'AscendData', {
      tableName: 'AscendData',
      // Single-table design: PK = USER#{sub}, SK = TRACKER#{id}#ENTRY#{uuid}
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // RETAIN means cdk destroy never deletes tracker data
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // GSI for querying entries by tracker ordered by creation time
    // GSI1PK = USER#{sub}#TRACKER#{id}  /  GSI1SK = ISO createdAt
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });
  }
}
