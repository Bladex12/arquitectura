// Validates a tablet's connection request and records the WebSocket
// connectionId in ConnectionsTable so game_sessions/broadcast.py can find
// it later.
//
// The frontend sends both `token` (TabletConnection.team_session_token) and
// `room_code` as WS handshake query-string params -- both are already
// cached in localStorage from the original REST /connect/ call
// (frontend/src/pages/tablets/Join.tsx), so this can do a direct GetItem
// on GameSessionTable (PK=SESSION#<room_code>, SK=TABLETCONN#<token>)
// instead of replicating Python's find_connection_by_token() full-table
// Scan (game_sessions/dynamodb/tablet_connection.py) in Node.
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FOUR_HOURS_SECONDS = 4 * 60 * 60;

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const params = event.queryStringParameters || {};
  const token = params.token;
  const roomCode = params.room_code;

  if (!token || !roomCode) {
    return { statusCode: 400, body: 'Missing token or room_code' };
  }

  const gameSessionsTable = process.env.GAME_SESSIONS_TABLE;
  const connectionsTable = process.env.CONNECTIONS_TABLE;

  try {
    const { Item: connectionItem } = await client.send(new GetCommand({
      TableName: gameSessionsTable,
      Key: { PK: `SESSION#${roomCode}`, SK: `TABLETCONN#${token}` },
    }));

    if (!connectionItem) {
      return { statusCode: 403, body: 'Invalid token' };
    }

    await client.send(new PutCommand({
      TableName: connectionsTable,
      Item: {
        connectionId,
        room_code: roomCode,
        team_id: connectionItem.team_id,
        ttl: Math.floor(Date.now() / 1000) + FOUR_HOURS_SECONDS,
      },
    }));

    return { statusCode: 200, body: 'connected' };
  } catch (err) {
    console.error('ws-connect failed', err);
    return { statusCode: 500, body: 'Connect failed' };
  }
};
