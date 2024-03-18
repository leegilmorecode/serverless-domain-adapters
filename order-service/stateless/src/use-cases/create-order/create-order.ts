import { getISOString, logger, schemaValidator } from '@shared';

import { createOrder } from '@adapters/secondary';
import { Order } from '@dto/order';
import { schema } from '@schemas/order';

export async function createOrderUseCase(newOrder: Order): Promise<Order> {
  const createdDate = getISOString();

  const order: Order = {
    id: newOrder.orderNumber,
    created: createdDate,
    ...newOrder,
  };

  logger.info(`order: ${JSON.stringify(order)}`);

  schemaValidator(schema, order);

  // write the order to the database
  await createOrder(order);

  logger.info(`order created event published`);

  return order;
}
