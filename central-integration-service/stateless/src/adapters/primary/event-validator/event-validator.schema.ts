export const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    detail: {
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            domain: {
              type: 'string',
              enum: ['orders', 'warehouse', 'delivery'],
            },
            source: { type: 'string' },
            type: { type: 'string' },
            correlationId: { type: 'string' },
          },
          required: ['id', 'domain', 'source', 'type', 'correlationId'],
          additionalProperties: false,
        },
        data: {},
      },
      required: ['metadata', 'data'],
      additionalProperties: false,
    },
  },
  required: ['detail'],
  additionalProperties: false,
};
