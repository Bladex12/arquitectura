// STUB -- filled in by task "WebSocket Lambdas ($connect/$disconnect/broadcast)".
// Default route for any inbound WS message; tablets are expected to be
// push-only recipients, so this mostly exists to satisfy API Gateway's
// requirement for a $default route. Broadcast-out logic (post_to_connection)
// lives in the Lambdas that perform game-state mutations, not here.
exports.handler = async (event) => {
  return { statusCode: 200, body: 'ok' };
};
