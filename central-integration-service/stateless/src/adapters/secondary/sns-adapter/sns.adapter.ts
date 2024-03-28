import {
  PublishCommand,
  PublishCommandInput,
  PublishCommandOutput,
  SNSClient,
} from '@aws-sdk/client-sns';

import { logger } from '@shared';

const snsClient = new SNSClient();

export async function publishMessage(
  topicArn: string,
  message: string,
  messageGroupId: string
): Promise<void> {
  try {
    logger.info(
      `publishing message: ${message} with messageGroupId: ${messageGroupId}`
    );

    const params: PublishCommandInput = {
      TopicArn: topicArn,
      Message: message,
      MessageGroupId: messageGroupId,
    };

    const command = new PublishCommand(params);

    const response: PublishCommandOutput = await snsClient.send(command);

    logger.info(`message published successfully: ${JSON.stringify(response)}`);
  } catch (error) {
    logger.error(`error publishing message : ${JSON.stringify(error)}`);
    throw error;
  }
}
