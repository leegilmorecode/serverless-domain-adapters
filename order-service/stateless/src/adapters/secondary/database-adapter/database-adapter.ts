import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

import { Order } from '@dto/order';
import { config } from '@config';
import { logger } from '@shared';
import { marshall } from '@aws-sdk/util-dynamodb';

const dynamoDb = new DynamoDBClient({});

export async function createOrder(order: Order): Promise<Order> {
  const tableName = config.get('tableName');

  const params = {
    TableName: tableName,
    Item: marshall({ ...order }),
  };

  try {
    await dynamoDb.send(new PutItemCommand(params));

    logger.info(`order created with ${order.id} into ${tableName}`);

    return order;
  } catch (error) {
    console.error('error creating order:', error);
    throw error;
  }
}
