import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as targets from 'aws-cdk-lib/aws-events-targets';

import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

interface DeliveryServiceStatelessStackProps extends cdk.StackProps {
  bus: events.EventBus;
  table: dynamodb.Table;
}

export class DeliveryServiceStatelessStack extends cdk.Stack {
  private bus: events.EventBus;
  private table: dynamodb.Table;
  private eventQueue: sqs.Queue;

  constructor(
    scope: Construct,
    id: string,
    props: DeliveryServiceStatelessStackProps
  ) {
    super(scope, id, props);

    const { table, bus } = props;

    this.bus = bus;
    this.table = table;

    const lambdaPowerToolsConfig = {
      LOG_LEVEL: 'DEBUG',
      POWERTOOLS_LOGGER_LOG_EVENT: 'true',
      POWERTOOLS_LOGGER_SAMPLE_RATE: '1',
      POWERTOOLS_TRACE_ENABLED: 'enabled',
      POWERTOOLS_TRACER_CAPTURE_HTTPS_REQUESTS: 'captureHTTPsRequests',
      POWERTOOLS_SERVICE_NAME: 'delivery-domain-service',
      POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'captureResult',
      POWERTOOLS_METRICS_NAMESPACE: 'LJAudio',
    };

    // create the sqs queue which takes messages from the delivery event bus
    this.eventQueue = new sqs.Queue(this, 'DeliveryBusEventQueue', {
      queueName: 'delivery-bus-event-queue',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deadLetterQueue: {
        maxReceiveCount: 10,
        queue: new sqs.Queue(this, 'DeliveryBusEventQueueDlq', {
          queueName: 'delivery-bus-event-queue-dlq',
        }),
      },
    });

    // create the rule for the bus so events flow to the sqs queue
    new events.Rule(this, 'DeliveryEventBusToSqsEventRule', {
      ruleName: 'DeliveryEventBusToSqsEventRule',
      eventBus: this.bus,
      eventPattern: {
        source: ['warehouse-domain'],
        detailType: ['ShippingLabelGenerated'],
      },
      targets: [new targets.SqsQueue(this.eventQueue)],
    });

    // create the lambda function which reads from the queue and writes to dynamodb
    const eventProcessorLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'DeliveryEventProcessorLambda', {
        functionName: 'delivery-event-processor',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/event-processor/event-processor.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
        },
        environment: {
          ...lambdaPowerToolsConfig,
          TABLE_NAME: this.table.tableName,
        },
      });

    // give the lambda function access to write to the delivery table
    this.table.grantWriteData(eventProcessorLambda);

    eventProcessorLambda.addEventSource(
      new SqsEventSource(this.eventQueue, {
        batchSize: 10, // we can set this up to 10, and the default is 10, 1 is essentially one at a time
        maxConcurrency: 50, // how many functions to invoke - max 1K
        reportBatchItemFailures: true,
      })
    );
  }
}
