import { MetricUnit, Metrics } from '@aws-lambda-powertools/metrics';
import { SQSEvent, SQSRecord } from 'aws-lambda';

import { Tracer } from '@aws-lambda-powertools/tracer';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { eventProcessorUseCase } from '@use-cases/event-processor/event-processor';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { logger } from '@shared';
import middy from '@middy/core';
import sqsBatch from '@middy/sqs-partial-batch-failure';

const tracer = new Tracer();
const metrics = new Metrics();

// we pull the events off the queue and populate the delivery notes into our read store
export const eventProcessorAdapter = async ({
  Records,
}: SQSEvent): Promise<PromiseSettledResult<SQSRecord>[]> => {
  try {
    const recordPromises = Records.map(async (record) => {
      return await eventProcessorUseCase(record);
    });

    return Promise.allSettled(recordPromises);
  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) errorMessage = error.message;
    logger.error(errorMessage);

    metrics.addMetric('DeliveryEventProcessorError', MetricUnit.Count, 1);

    throw error;
  }
};

export const handler = middy()
  .use(sqsBatch())
  .handler(eventProcessorAdapter)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics));
