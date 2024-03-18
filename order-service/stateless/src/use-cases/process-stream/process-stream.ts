import { domains, logger } from '@shared';

import { Event } from '@dto/event';
import { Order } from '@dto/order';
import { SQSRecord } from 'aws-lambda';
import { config } from '@config';
import { publishMessage } from '@adapters/secondary';
import { unmarshall } from '@aws-sdk/util-dynamodb';

export async function processStreamUseCase(
  newEvent: SQSRecord
): Promise<SQSRecord> {
  const centralTopicArn = config.get('centralTopicArn');

  const body = JSON.parse(newEvent.body);
  const parsedEvent = unmarshall(body.dynamodb.NewImage) as Order;

  // create the correct event shape
  const event: Event = {
    created: parsedEvent.created as string,
    detail: {
      metadata: {
        domain: domains.orders,
        source: 'orders-domain-service',
        type: 'OrderCreated',
        id: parsedEvent.id as string,
      },
      data: parsedEvent,
    },
  };

  logger.info(`event: ${JSON.stringify(event)}`);

  // create the correct message group id
  const { domain, source, id } = event.detail.metadata;
  const messageGroupId = `${domain}.${source}.${id}`;

  // publish the message
  await publishMessage(centralTopicArn, JSON.stringify(event), messageGroupId);

  return newEvent;
}
