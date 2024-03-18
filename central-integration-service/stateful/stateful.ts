import * as cdk from 'aws-cdk-lib';
import * as eventBridge from 'aws-cdk-lib/aws-events';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';

import { CloudWatchLogGroup } from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

interface CentralIntegrationServiceStatefulStackProps extends cdk.StackProps {
  central: string;
  orders: string;
  delivery: string;
  warehouse: string;
  org: string;
}

export class CentralIntegrationServiceStatefulStack extends cdk.Stack {
  public centralTopic: sns.Topic;
  public bus: eventBridge.EventBus;

  constructor(
    scope: Construct,
    id: string,
    props: CentralIntegrationServiceStatefulStackProps
  ) {
    super(scope, id, props);

    const { org, central, warehouse, delivery } = props;

    // create the orders sns fifo topic for our central account
    this.centralTopic = new sns.Topic(this, 'CentralTopic', {
      topicName: 'central-domains-topic',
      displayName: 'central-domains-topic',
      fifo: true, // fifo topic
      contentBasedDeduplication: true,
    });
    this.centralTopic.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // ensure that the following accounts can publish messages to the central topic
    // as long as they are in the org. In prod you should tie this down further.
    this.centralTopic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish'],
        resources: [this.centralTopic.topicArn],
        principals: [new iam.AnyPrincipal()],
        conditions: {
          StringEquals: {
            'aws:PrincipalOrgID': org,
          },
        },
      })
    );

    // create the central eventbridge bus
    this.bus = new eventBridge.EventBus(this, 'CentralEventsBus', {
      eventBusName: 'central-events-bus',
    });
    this.bus.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // add an archive to the central bus to archive all events
    this.bus.archive('central-event-bus-archive', {
      archiveName: 'central-event-bus-archive',
      description: 'central-event-bus-archive',
      eventPattern: {
        source: [{ prefix: '' }] as any[],
      },
      retention: cdk.Duration.days(5),
    });

    this.bus._enableCrossEnvironment();

    // create a shared event bus log group
    const sharedEventLogs: logs.LogGroup = new logs.LogGroup(
      this,
      'central-event-bus-logs',
      {
        logGroupName: 'central-event-bus-logs',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    // log all events to cloudwatch so we can track what is happening and monitor
    // on the local bus
    new events.Rule(this, 'LogAllEventsToCloudwatch', {
      eventBus: this.bus,
      ruleName: 'LogAllEventsToCloudwatch',
      description: 'log all events',
      eventPattern: {
        source: [{ prefix: '' }] as any[],
      },
      targets: [new CloudWatchLogGroup(sharedEventLogs)],
    });

    // create a policy to allow the other accounts in our org to publish events directly
    // and to create new rules from certain accounts in the organisation.
    new events.CfnEventBusPolicy(this, 'SharedPutEventBusPolicy', {
      eventBusName: this.bus.eventBusName,
      statementId: 'global-event-bus-put-event-policy-stmt',
      statement: {
        Effect: 'Allow',
        Principal: '*',
        Action: 'events:PutEvents',
        Resource: `arn:aws:events:eu-west-1:${central}:event-bus/central-events-bus`,
        Condition: {
          StringEquals: {
            'aws:PrincipalOrgID': org,
          },
        },
      },
    });

    new events.CfnEventBusPolicy(this, 'SharedRuleBusPolicy', {
      eventBusName: this.bus.eventBusName,
      statementId: 'global-event-bus-rule-policy-stmt',
      statement: {
        Effect: 'Allow',
        Principal: {
          AWS: [
            `arn:aws:iam::${warehouse}:root`,
            `arn:aws:iam::${delivery}:root`,
          ],
        },
        Action: [
          'events:PutRule',
          'events:PutTargets',
          'events:DeleteRule',
          'events:RemoveTargets',
          'events:DisableRule',
          'events:EnableRule',
          'events:TagResource',
          'events:UntagResource',
          'events:DescribeRule',
          'events:ListTargetsByRule',
          'events:ListTagsForResource',
        ],
        Resource: `arn:aws:events:eu-west-1:${central}:rule/central-events-bus/*`,
        Condition: {
          StringEqualsIfExists: {
            'events:creatorAccount': [warehouse, delivery],
          },
        },
      },
    });
  }
}
