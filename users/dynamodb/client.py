"""boto3 DynamoDB table accessor and shared update-expression builder
for the users single-table schema. Mirrors game_sessions/dynamodb/client.py.
"""
import os
from datetime import datetime, timezone

import boto3


def get_table():
    """Returns the boto3 DynamoDB Table resource for users data. Reads
    the table name from USERS_TABLE, which template.yaml sets on
    DjangoFunction via `!Ref UsersTable`. DYNAMODB_ENDPOINT_URL, if set
    (local Docker dev only -- points at the dynamodb-local container),
    overrides boto3's default AWS endpoint resolution."""
    dynamodb = boto3.resource(
        'dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'),
        endpoint_url=os.environ.get('DYNAMODB_ENDPOINT_URL') or None,
    )
    return dynamodb.Table(os.environ['USERS_TABLE'])


def get_client():
    """Returns a plain low-level boto3 DynamoDB client -- NOT
    `get_table().meta.client`. A resource-derived client carries boto3's
    high-level auto-transform handlers (native Python <-> AttributeValue),
    which double-serialize call sites that already hand it raw
    AttributeValue dicts via TypeSerializer (transact_write_items /
    batch_write_item with manually-built Items), producing
    'ValidationException: Invalid attribute value type'. Use this for
    those call sites; use get_table() (or get_table().meta.client with
    native Python Keys, e.g. batch_get_item) for everything else."""
    return boto3.client(
        'dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'),
        endpoint_url=os.environ.get('DYNAMODB_ENDPOINT_URL') or None,
    )


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def build_update_expression(fields):
    """Builds a DynamoDB UpdateExpression + ExpressionAttributeNames +
    ExpressionAttributeValues from a dict of {field_name: new_value},
    always also setting updated_at. Returns
    (update_expression, expression_attribute_names, expression_attribute_values).
    """
    now = now_iso()
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
