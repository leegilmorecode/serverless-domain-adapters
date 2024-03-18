import { Event } from '@dto/event';
import { SQSRecord } from 'aws-lambda';
import { logger } from '@shared';
import { publishEvent } from '@adapters/secondary';

export async function eventProducerUseCase(
  newEvent: SQSRecord
): Promise<SQSRecord> {
  const { Message: message } = JSON.parse(newEvent.body);
  const parsedEvent = JSON.parse(message) as Event;

  logger.info(`publishing the event: ${JSON.stringify(newEvent)}`);
  await publishEvent(parsedEvent);

  return newEvent;
}
