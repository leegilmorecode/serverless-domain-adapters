import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as targets from 'aws-cdk-lib/aws-events-targets';

import { Construct } from 'constructs';

interface DeliveryServiceStatefulStackProps extends cdk.StackProps {
  central: string;
}

export class DeliveryServiceStatefulStack extends cdk.Stack {
  public bus: events.EventBus;
  public table: dynamodb.Table;

  constructor(
    scope: Construct,
    id: string,
    props: DeliveryServiceStatefulStackProps
  ) {
    super(scope, id, props);

    const { central } = props;

    // create the table for storing delivery events
    this.table = new dynamodb.Table(this, 'DeliveryServiceTable', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      tableName: 'delivery-domain-service-table',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // create the eventbridge bus for the delivery domain
    // allowing it to consume messages from the central bus
    this.bus = new events.EventBus(this, 'DeliveryServiceBus', {
      eventBusName: 'delivery-domain-bus',
    });
    this.bus.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    this.bus._enableCrossEnvironment();

    // add an archive to the delivery bus to archive all events
    this.bus.archive('delivery-domain-event-bus-archive', {
      archiveName: 'delivery-domain-event-bus-archive',
      description: 'delivery-domain-event-bus-archive',
      eventPattern: {
        source: [{ prefix: '' }] as any[],
      },
      retention: cdk.Duration.days(5),
    });

    // get a pointer to the central bus so we can add a rule to it
    // i.e. we want consumer accounts to create their own rules
    const centralBus = events.EventBus.fromEventBusArn(
      this,
      'CentralBus',
      `arn:aws:events:eu-west-1:${central}:event-bus/central-events-bus`
    );

    // ensure that the delivery domain can subscribe cross-account to the central bus
    // for the events that they want i.e. ShippingLabelGenerated from the WMS
    const targetRule = new events.Rule(
      this,
      'CentralBusToDeliveryBusEventRule',
      {
        ruleName: 'CentralBusToDeliveryBusEventRule',
        eventBus: centralBus,
        eventPattern: {
          source: ['warehouse-domain'],
          detailType: ['ShippingLabelGenerated'],
        },
        targets: [new targets.EventBus(this.bus)],
      }
    );

    // workaround https://github.com/aws/aws-cdk/issues/26032
    (targetRule.node.defaultChild as events.CfnRule).eventBusName =
      centralBus.eventBusArn;

    // create a delivery event bus log group
    const deliveryEventLogs: logs.LogGroup = new logs.LogGroup(
      this,
      'delivery-event-bus-logs',
      {
        logGroupName: 'delivery-event-bus-logs',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    // log all events to cloudwatch so we can track what is happening and monitor
    // i.e. this should only be for non-prod
    new events.Rule(this, 'LogAllDeliveryBusEventsToCloudwatch', {
      eventBus: this.bus,
      ruleName: 'LogAllDeliveryBusEventsToCloudwatch',
      description: 'log all delivery bus events',
      eventPattern: {
        source: [{ prefix: '' }] as any[],
      },
      targets: [new targets.CloudWatchLogGroup(deliveryEventLogs)],
    });
  }
}
