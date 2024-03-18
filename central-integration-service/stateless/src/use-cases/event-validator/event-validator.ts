import { logger, schemaValidator } from '@shared';

import { publishMessage } from '@adapters/secondary';
import { config } from '@config';
import { Event } from '@dto/event';
import { schema } from '@schemas/event';

// get the correct topic arns for our domain fifo topics
const centralTopicArn = config.get('centralTopicArn');

export async function eventValidatorUseCase(newEvent: Event): Promise<Event> {
  logger.info(`event: ${JSON.stringify(newEvent)}`);

  // create our event object based on the api gateway payload
  const event: Event = {
    ...newEvent,
  };

  // validate the payload aganst the correct schema for the detailType and source
  // for example, OrderCreated event from the orders.domain service.
  // We cover this in future articles in the serice.
  schemaValidator(schema, event);

  // create our unique messageGroupId for the ordering in the sns topic
  // for example: 'domain.source.id' e.g. 'orders.orders-domain.6fc292ce-059b-469a-94ea-a9860d0604ab'
  const { domain, source, id } = event.detail.metadata;
  const messageGroupId = `${domain}.${source}.${id}`;

  // publish the message to the central topic with the correct messageGroupId
  await publishMessage(centralTopicArn, JSON.stringify(event), messageGroupId);

  logger.info(`event validated and published to the ${centralTopicArn} topic`);

  return event;
}
