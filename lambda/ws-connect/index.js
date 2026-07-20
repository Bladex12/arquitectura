// STUB -- filled in by task "WebSocket Lambdas ($connect/$disconnect/broadcast)".
// Will validate TabletConnection.team_session_token (query string param on the
// WS handshake) and write { connectionId, room_code, team_id } into the
// connections DynamoDB table (see template.yaml -> ConnectionsTable).
exports.handler = async (event) => {
  return { statusCode: 200, body: 'connected' };
};
