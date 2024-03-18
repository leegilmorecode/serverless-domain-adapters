const convict = require('convict');

export const config = convict({
  tableName: {
    doc: 'The delivery table name',
    format: String,
    default: '',
    env: 'TABLE_NAME',
  },
  centralTopicArn: {
    doc: 'The central topic arn',
    format: String,
    default: '',
    env: 'CENTRAL_TOPIC_ARN',
  },
}).validate({ allowed: 'strict' });
