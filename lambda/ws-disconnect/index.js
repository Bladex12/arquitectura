// Removes the ConnectionsTable row for a closed WebSocket connection.
// Always returns 200 -- API Gateway requires this regardless of whether
// the row existed (a connection that never completed $connect, or one
// already cleaned up by a GoneException in game_sessions/broadcast.py,
// is not an error here).
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;

  try {
    await client.send(new DeleteCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Key: { connectionId },
    }));
  } catch (err) {
    console.error('ws-disconnect failed', err);
  }

  return { statusCode: 200, body: 'disconnected' };
};
