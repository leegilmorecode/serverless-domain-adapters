import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsCommandInput,
  PutEventsCommandOutput,
  PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';

import { Event } from '@dto/event';
import { config } from '@config';
import { logger } from '@shared';

const client = new EventBridgeClient({});
const centralBusName = config.get('centralBusName');

export async function publishEvent(event: Event): Promise<void> {
  try {
    // publish the event using our generic adapter
    const newEvent: PutEventsRequestEntry = {
      Detail: JSON.stringify(event.detail),
      DetailType: event.detail.metadata.type,
      EventBusName: centralBusName,
      Source: event.detail.metadata.source,
    };

    const params: PutEventsCommandInput = {
      Entries: [newEvent],
    };

    const response: PutEventsCommandOutput = await client.send(
      new PutEventsCommand(params)
    );

    logger.info(`events published successfully: ${JSON.stringify(response)}`);
  } catch (error) {
    logger.error(`error publishing message : ${JSON.stringify(error)}`);
    throw error;
  }
}
