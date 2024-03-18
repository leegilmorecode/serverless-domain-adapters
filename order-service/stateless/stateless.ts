import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as pipes from 'aws-cdk-lib/aws-pipes';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';

import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

interface OrderServiceStatelessStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  central: string;
}

export class OrderServiceStatelessStack extends cdk.Stack {
  private table: dynamodb.Table;
  private eventsStreamQueue: sqs.Queue;

  constructor(
    scope: Construct,
    id: string,
    props: OrderServiceStatelessStackProps
  ) {
    super(scope, id, props);

    const { table, central } = props;

    this.table = table;

    const lambdaPowerToolsConfig = {
      LOG_LEVEL: 'DEBUG',
      POWERTOOLS_LOGGER_LOG_EVENT: 'true',
      POWERTOOLS_LOGGER_SAMPLE_RATE: '1',
      POWERTOOLS_TRACE_ENABLED: 'enabled',
      POWERTOOLS_TRACER_CAPTURE_HTTPS_REQUESTS: 'captureHTTPsRequests',
      POWERTOOLS_SERVICE_NAME: 'orders-domain-service',
      POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'captureResult',
      POWERTOOLS_METRICS_NAMESPACE: 'LJAudio',
    };

    // create our events queue from a dynamodb stream via pipes (our outbox)
    this.eventsStreamQueue = new sqs.Queue(this, 'OrdersEventStreamsQueue', {
      queueName: 'orders-event-stream-queue.fifo',
      fifo: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: new sqs.Queue(this, 'OrdersEventStreamsQueueDlq', {
          fifo: true,
          queueName: 'orders-event-stream-queue-dlq.fifo',
        }),
      },
    });

    // create the api for raising new orders in the orders domain service
    const api: apigw.RestApi = new apigw.RestApi(this, 'Api', {
      description: 'LJ Audio - Orders API',
      deploy: true,
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigw.MethodLoggingLevel.INFO,
      },
    });

    // create the 'create order' lambda function
    const createOrderLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'CreateOrderLambda', {
        functionName: 'orders-domain-create-order',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/create-order/create-order.adapter.ts'
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

    // create the 'order processor' lambda which reads from the stream queue
    const processStreamLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'ProcessStreamLambda', {
        functionName: 'orders-process-stream-order',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/process-stream/process-stream.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
        },
        environment: {
          ...lambdaPowerToolsConfig,
          CENTRAL_TOPIC_ARN: `arn:aws:sns:eu-west-1:${central}:central-domains-topic.fifo`,
        },
      });

    // allow the lambda function to publish messages to the central account
    const centralTopic = sns.Topic.fromTopicArn(
      this,
      'CentralTopic',
      `arn:aws:sns:eu-west-1:${central}:central-domains-topic.fifo`
    );
    centralTopic.grantPublish(processStreamLambda);

    // allow the lambda to process messages from the queue
    this.eventsStreamQueue.grantConsumeMessages(processStreamLambda);

    // allow the lambda to write to the database table
    this.table.grantWriteData(createOrderLambda);

    // create the pipe role
    const pipeRole = new iam.Role(this, 'PipeRole', {
      assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
    });

    this.table.grantStreamRead(pipeRole);
    this.eventsStreamQueue.grantSendMessages(pipeRole);

    // add the eventbridge pipe for the stream
    new pipes.CfnPipe(this, 'OrdersStreamPipe', {
      roleArn: pipeRole.roleArn,
      source: this.table.tableStreamArn!,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: 'LATEST',
          batchSize: 1,
          maximumRetryAttempts: 3,
        },
        filterCriteria: {
          filters: [
            {
              pattern: '{"eventName" : ["INSERT"] }', // we are only interested in raising events for new orders in this example
            },
          ],
        },
      },
      target: this.eventsStreamQueue.queueArn,
      targetParameters: {
        sqsQueueParameters: {
          messageDeduplicationId: '$.eventID',
          messageGroupId: '$.dynamodb.Keys.id.S',
        },
      },
    });

    // create our resources on the api for 'orders'
    const root: apigw.Resource = api.root.addResource('v1');
    const events: apigw.Resource = root.addResource('orders');

    // add a post endpoint so we can create orders
    events.addMethod(
      'POST',
      new apigw.LambdaIntegration(createOrderLambda, {
        proxy: true,
      })
    );

    // ensure our lambda function is invoked from the queue
    processStreamLambda.addEventSource(
      new SqsEventSource(this.eventsStreamQueue, {
        batchSize: 1, // we can set this up to 10, and the default is 10, 1 is essentially one at a time
        maxConcurrency: 50, // how many functions to invoke - max 1K
        reportBatchItemFailures: true,
      })
    );
  }
}
