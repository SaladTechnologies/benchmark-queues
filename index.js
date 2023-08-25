import { SQSClient, SendMessageCommand,ReceiveMessageCommand, CreateQueueCommand, GetQueueUrlCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import crypto from 'crypto';

const { AWS_REGION, API_KEY, AUTH_HEADER, QUEUE_PREFIX } = process.env;

const sqsClient = new SQSClient({
  region: AWS_REGION,
});

// const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const handler = async (event) => {
  const { requestContext: { http: { method, path }, timeEpoch}, body, headers} = event;

  // Check the API key  
  if (!headers[AUTH_HEADER]) {
    console.error('No auth header');
    return {
      statusCode: 401,
      body: JSON.stringify({
        error: 'Unauthorized',
      }),
    };
  }

  if (headers[AUTH_HEADER] !== API_KEY) {
    console.error('Invalid auth header');
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: 'Forbidden',
      }), 
    }; 
  }

  let queueUrl, queueId, queueName;
  if (method !== "DELETE"){
    // Most methods have the signature METHOD /$queueId
    queueId = path.substring(1).replaceAll('/', '-');
    queueName = `${QUEUE_PREFIX}-${queueId}.fifo`;
  } else {
    // Delete has the signature DELETE /$queueId/$messageId
    const pathParts = path.substring(1).split('/');
    queueId = pathParts[0].replaceAll('/', '-');
    queueName = `${QUEUE_PREFIX}-${queueId}.fifo`;

    // Get the Queue URL
    const getQueueUrlCommand = new GetQueueUrlCommand({
      QueueName: queueName,
    });
    const getQueueUrlResponse = await sqsClient.send(getQueueUrlCommand);
    queueUrl = getQueueUrlResponse.QueueUrl;

    // Get the message ID, which is the remainder of the path, and may include slashes
    const messageId = pathParts.slice(1).join('/');
    const deleteMessageCommand = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: messageId,
    });

    try {
      const deleteMessageResponse = await sqsClient.send(deleteMessageCommand);
      console.log(`Deleted message from queue ${queueName}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Message deleted',
        }),
      };
    } catch (e) {
      console.error(`Error deleting message from queue ${queueName}`);
      console.error(e);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Error deleting message',
        }),
      };
    }
  }
 


  try {
    // Make the queue
    const createQueueCommand = new CreateQueueCommand({
      QueueName: queueName,
      Attributes: {
        VisibilityTimeout: 60*5,
        ReceiveMessageWaitTimeSeconds: 10,
        FifoQueue: true,
      }
    });

    const createQueueResponse = await sqsClient.send(createQueueCommand);
    console.log(`Created queue ${queueName}`);
    queueUrl = createQueueResponse.QueueUrl;
  } catch (e) {
    if (e.name === 'QueueAlreadyExists') {
      console.log(`Queue ${queueName} already exists`);
      const getQueueUrlCommand = new GetQueueUrlCommand({
        QueueName: queueName,
      });
      const getQueueUrlResponse = await sqsClient.send(getQueueUrlCommand);
      queueUrl = getQueueUrlResponse.QueueUrl;
    } else {
      console.error(`Error creating queue ${queueName}`);
      console.error(e);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Error creating queue',
        }),
      };
    }
  }

  if (method === 'POST') {
    // Send the message
    const sendMessageCommand = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: body,
      MessageGroupId: crypto.randomUUID(),
      MessageDeduplicationId: crypto.randomUUID(),
    });

    try {
      const sendMessageResponse = await sqsClient.send(sendMessageCommand);
      console.log(`Sent message to queue ${queueName}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Message sent',
        }),
      };
    } catch (e) {
      console.error(`Error sending message to queue ${queueName}`);
      console.error(e);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Error sending message',
        }),
      };
    } 
  } else if (method === 'GET') {
    // Get the message
    const getMessageCommand = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
    });

    try {
      const getMessageResponse = await sqsClient.send(getMessageCommand);
      console.log(`Got message from queue ${queueName}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: getMessageResponse.Messages && getMessageResponse.Messages.length > 0 ? 'Messages Found' : 'No Messages Found',
          messages: (getMessageResponse.Messages || []).map((message) => ({
            messageId: message.ReceiptHandle,
            body: message.Body,
          })),
        }),
      };
    } catch (e) {
      console.error(`Error getting message from queue ${queueName}`);
      console.error(e);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Error getting message',
        }),
      };
    }
  } else {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: 'Method not allowed',
      }),
    };
  }

}