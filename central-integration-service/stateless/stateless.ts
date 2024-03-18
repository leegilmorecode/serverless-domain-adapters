import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';
import * as eventBridge from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';

import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export interface CentralIntegrationServiceStatelessStackProps
  extends cdk.StackProps {
  centralTopic: sns.Topic;
  bus: eventBridge.EventBus;
}

export class CentralIntegrationServiceStatelessStack extends cdk.Stack {
  private centralTopic: sns.Topic;
  private bus: eventBridge.EventBus;
  private centralQueue: sqs.Queue;

  constructor(
    scope: Construct,
    id: string,
    props: CentralIntegrationServiceStatelessStackProps
  ) {
    super(scope, id, props);

    const { bus, centralTopic } = props;

    this.bus = bus;
    this.centralTopic = centralTopic;

    const lambdaPowerToolsConfig = {
      LOG_LEVEL: 'DEBUG',
      POWERTOOLS_LOGGER_LOG_EVENT: 'true',
      POWERTOOLS_LOGGER_SAMPLE_RATE: '1',
      POWERTOOLS_TRACE_ENABLED: 'enabled',
      POWERTOOLS_TRACER_CAPTURE_HTTPS_REQUESTS: 'captureHTTPsRequests',
      POWERTOOLS_SERVICE_NAME: 'central-integration-service',
      POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'captureResult',
      POWERTOOLS_METRICS_NAMESPACE: 'LJAudio',
    };

    // create the sqs queue from the sns topic
    this.centralQueue = new sqs.Queue(this, 'CentralEventQueue', {
      queueName: 'central-domains-event-queue',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deadLetterQueue: {
        maxReceiveCount: 10,
        queue: new sqs.Queue(this, 'CentralEventQueueDlq', {
          queueName: 'central-domains-event-queue-dlq',
        }),
      },
    });

    // create the lambda function for the api gateway validation
    // and pushing messages to the central sns topic directly (event gateway pattern)
    const eventValidatorLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'EventValidatorLambda', {
        functionName: 'event-validator',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/event-validator/event-validator.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
        },
        environment: {
          ...lambdaPowerToolsConfig,
          CENTRAL_TOPIC: this.centralTopic.topicArn,
        },
      });

    // create the event producer handler for reading from the queue
    // and pushing the events to the central eventbridge bus
    const centralEventProducerLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'CentralEventProducerLambda', {
        functionName: 'central-event-producer',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/central-event-producer/central-event-producer.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
        },
        environment: {
          ...lambdaPowerToolsConfig,
          CENTRAL_BUS_NAME: this.bus.eventBusName,
        },
      });

    // allow the event producer lambda to put events to the central bus
    centralEventProducerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [this.bus.eventBusArn],
      })
    );

    // add the lambda event source for the queue so we can read the events
    centralEventProducerLambda.addEventSource(
      new SqsEventSource(this.centralQueue, {
        batchSize: 10, // we can set this up to 10K, and the default is 10, 1 is essentially one at a time
        maxConcurrency: 50, // how many functions to invoke - max 1K
        reportBatchItemFailures: true,
      })
    );

    // allow the producer function to read from the queue and write to the central event bus
    this.centralQueue.grantConsumeMessages(centralEventProducerLambda);

    // ensure the event validator lambda function can publish messages to the central topic
    this.centralTopic.grantPublish(eventValidatorLambda);

    // create the event gateway i.e. our api for raising events
    const api: apigw.RestApi = new apigw.RestApi(this, 'Api', {
      description: 'LJ Audio - Event Gateway API',
      deploy: true,
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigw.MethodLoggingLevel.INFO,
      },
    });

    // create our resources on the api for 'events'
    const root: apigw.Resource = api.root.addResource('v1');
    const events: apigw.Resource = root.addResource('events');

    // add a post endpoint so we can create events
    events.addMethod(
      'POST',
      new apigw.LambdaIntegration(eventValidatorLambda, {
        proxy: true,
      })
    );

    // ensure that messages pushed to the fifo topic go to our central queue
    this.centralTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(this.centralQueue)
    );
  }
}
