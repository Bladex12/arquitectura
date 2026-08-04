"""boto3 DynamoDB table accessor and shared update-expression builder
for the game_sessions single-table schema."""
import os
from datetime import datetime, timezone

import boto3


def get_table():
    """Returns the boto3 DynamoDB Table resource for game_sessions data.

    Reads the table name from the GAME_SESSIONS_TABLE env var, which
    template.yaml sets on DjangoFunction via `!Ref GameSessionTable`.
    DYNAMODB_ENDPOINT_URL, if set (local Docker dev only -- points at the
    dynamodb-local container), overrides boto3's default AWS endpoint
    resolution.
    """
    dynamodb = boto3.resource(
        'dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'),
        endpoint_url=os.environ.get('DYNAMODB_ENDPOINT_URL') or None,
    )
    return dynamodb.Table(os.environ['GAME_SESSIONS_TABLE'])


def now_iso():
    """Returns the current UTC time as an ISO-8601 string, the timestamp
    format used for every created_at/updated_at (and similar) field
    across the game_sessions DynamoDB schema."""
    return datetime.now(timezone.utc).isoformat()


def build_update_expression(fields):
    """Builds a DynamoDB UpdateExpression + ExpressionAttributeNames +
    ExpressionAttributeValues from a dict of {field_name: new_value},
    always also setting updated_at. Uses attribute name placeholders
    throughout so reserved words (like 'status' or 'name') are safe.

    Returns (update_expression, expression_attribute_names, expression_attribute_values).
    """
    now = datetime.now(timezone.utc).isoformat()
    set_clauses = ['updated_at = :updated_at']
    names = {}
    values = {':updated_at': now}
    for i, (field_name, value) in enumerate(fields.items()):
        name_placeholder = f'#f{i}'
        value_placeholder = f':v{i}'
        set_clauses.append(f'{name_placeholder} = {value_placeholder}')
        names[name_placeholder] = field_name
        values[value_placeholder] = value
    return 'SET ' + ', '.join(set_clauses), names, values
