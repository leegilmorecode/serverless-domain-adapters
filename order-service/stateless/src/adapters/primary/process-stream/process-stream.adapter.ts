import { MetricUnit, Metrics } from '@aws-lambda-powertools/metrics';
import { SQSEvent, SQSRecord } from 'aws-lambda';

import { Tracer } from '@aws-lambda-powertools/tracer';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { logger } from '@shared';
import middy from '@middy/core';
import { processStreamUseCase } from '@use-cases/process-stream';
import sqsBatch from '@middy/sqs-partial-batch-failure';

const tracer = new Tracer();
const metrics = new Metrics();

// we pull the events off the queue and publish the messages to the central topic
export const processStreamAdapter = async ({
  Records,
}: SQSEvent): Promise<PromiseSettledResult<SQSRecord>[]> => {
  try {
    // map the sqs events into our event types
    const recordPromises = Records.map(async (record) => {
      // call our use case to perform the event publishing with the event
      return await processStreamUseCase(record);
    });

    return Promise.allSettled(recordPromises);
  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) errorMessage = error.message;
    logger.error(errorMessage);

    metrics.addMetric('OrdersEventProcessorError', MetricUnit.Count, 1);

    throw error;
  }
};

export const handler = middy()
  .use(sqsBatch())
  .handler(processStreamAdapter)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics));
