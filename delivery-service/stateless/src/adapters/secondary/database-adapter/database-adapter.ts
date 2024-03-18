import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

import { Event } from '@dto/event';
import { config } from '@config';
import { logger } from '@shared';
import { marshall } from '@aws-sdk/util-dynamodb';

const dynamoDb = new DynamoDBClient({});

export async function createRecord(event: Event): Promise<Event> {
  const tableName = config.get('tableName');

  const params = {
    TableName: tableName,
    Item: marshall({ ...event.detail.data, id: event.detail.metadata.id }),
  };

  try {
    await dynamoDb.send(new PutItemCommand(params));

    logger.info(
      `record created with ${event.detail.metadata.id} into ${tableName}`
    );

    return event;
  } catch (error) {
    console.error('error creating record:', error);
    throw error;
  }
}
