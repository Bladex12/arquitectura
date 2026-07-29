"""boto3 DynamoDB table accessor and shared update-expression builder
for the users single-table schema. Mirrors game_sessions/dynamodb/client.py.
"""
import os
from datetime import datetime, timezone

import boto3


def get_table():
    """Returns the boto3 DynamoDB Table resource for users data. Reads
    the table name from USERS_TABLE, which template.yaml sets on
    DjangoFunction via `!Ref UsersTable`."""
    dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
    return dynamodb.Table(os.environ['USERS_TABLE'])


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
