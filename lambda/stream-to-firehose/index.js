// STUB -- filled in by task "Rebuild admin_dashboard on Athena".
// DynamoDB Streams event source (see template.yaml -> GameSessionTable stream
// on this function) will land here; will forward records to the Firehose
// delivery stream (AnalyticsDeliveryStream) as newline-delimited JSON so
// Athena can query them from S3.
exports.handler = async (event) => {
  return { batchItemFailures: [] };
};
