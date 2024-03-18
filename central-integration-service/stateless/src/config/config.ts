const convict = require('convict');

export const config = convict({
  centralBusName: {
    doc: 'The central eventbridge bus name',
    format: String,
    default: '',
    env: 'CENTRAL_BUS_NAME',
  },
  centralTopicArn: {
    doc: 'The central sns topic arn',
    format: String,
    default: '',
    env: 'CENTRAL_TOPIC',
  },
}).validate({ allowed: 'strict' });
