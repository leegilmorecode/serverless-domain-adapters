import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

import { Construct } from 'constructs';

export class OrderServiceStatefulStack extends cdk.Stack {
  public table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create our dynamodb table for storing new orders
    this.table = new dynamodb.Table(this, 'OrderServiceTable', {
      tableName: 'orders-domain-service-table',
      stream: dynamodb.StreamViewType.NEW_IMAGE, // we use dynamodb streams
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
    });
  }
}
