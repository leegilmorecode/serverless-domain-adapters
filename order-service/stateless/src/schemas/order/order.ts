export const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    id: {
      type: 'string',
    },
    created: {
      type: 'string',
      format: 'date-time',
    },
    orderNumber: {
      type: 'string',
    },
    customerId: {
      type: 'string',
    },
    totalValue: {
      type: 'number',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
          },
          productName: {
            type: 'string',
          },
          quantity: {
            type: 'number',
          },
          unitPrice: {
            type: 'number',
          },
        },
        required: ['productId', 'productName', 'quantity', 'unitPrice'],
      },
    },
  },
  required: [
    'id',
    'created',
    'orderNumber',
    'customerId',
    'totalValue',
    'items',
  ],
};
