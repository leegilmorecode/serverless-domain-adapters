export const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
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
            type: 'integer',
          },
          unitPrice: {
            type: 'number',
          },
        },
        required: ['productId', 'productName', 'quantity', 'unitPrice'],
      },
    },
  },
  required: ['orderNumber', 'customerId', 'totalValue', 'items'],
};
