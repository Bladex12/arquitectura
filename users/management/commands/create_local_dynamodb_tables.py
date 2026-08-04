"""
Creates the UsersTable/GameSessionTable/ContentTable schemas against a
real DynamoDB endpoint (dynamodb-local in Docker dev; could point at a
real AWS account too via DYNAMODB_ENDPOINT_URL unset + real credentials,
though that's not this command's intended use).

Idempotent: skips a table that already exists (unlike the moto test
helpers, this does NOT drop existing tables first -- local dev data
should survive a container restart).

Local Docker dev only. Real deploys create these tables via
template.yaml's AWS::DynamoDB::Table resources instead.
"""
import os

import boto3
from django.core.management.base import BaseCommand


def _client():
    return boto3.client(
        'dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'),
        endpoint_url=os.environ.get('DYNAMODB_ENDPOINT_URL') or None,
    )


def _table_exists(client, table_name):
    try:
        client.describe_table(TableName=table_name)
        return True
    except client.exceptions.ResourceNotFoundException:
        return False


def _create_table(client, **kwargs):
    table_name = kwargs['TableName']
    if _table_exists(client, table_name):
        return False
    client.create_table(**kwargs)
    client.get_waiter('table_exists').wait(TableName=table_name)
    return True


USERS_TABLE_SPEC = dict(
    KeySchema=[
        {'AttributeName': 'PK', 'KeyType': 'HASH'},
        {'AttributeName': 'SK', 'KeyType': 'RANGE'},
    ],
    AttributeDefinitions=[
        {'AttributeName': 'PK', 'AttributeType': 'S'},
        {'AttributeName': 'SK', 'AttributeType': 'S'},
        {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},
        {'AttributeName': 'GSI1SK', 'AttributeType': 'S'},
        {'AttributeName': 'GSI2PK', 'AttributeType': 'S'},
        {'AttributeName': 'GSI2SK', 'AttributeType': 'S'},
    ],
    GlobalSecondaryIndexes=[
        {
            'IndexName': 'GSI1',
            'KeySchema': [
                {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
                {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'},
            ],
            'Projection': {'ProjectionType': 'ALL'},
        },
        {
            'IndexName': 'GSI2',
            'KeySchema': [
                {'AttributeName': 'GSI2PK', 'KeyType': 'HASH'},
                {'AttributeName': 'GSI2SK', 'KeyType': 'RANGE'},
            ],
            'Projection': {'ProjectionType': 'ALL'},
        },
    ],
    BillingMode='PAY_PER_REQUEST',
)

GAME_SESSION_TABLE_SPEC = dict(
    KeySchema=[
        {'AttributeName': 'PK', 'KeyType': 'HASH'},
        {'AttributeName': 'SK', 'KeyType': 'RANGE'},
    ],
    AttributeDefinitions=[
        {'AttributeName': 'PK', 'AttributeType': 'S'},
        {'AttributeName': 'SK', 'AttributeType': 'S'},
        {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},
        {'AttributeName': 'GSI1SK', 'AttributeType': 'S'},
    ],
    GlobalSecondaryIndexes=[
        {
            'IndexName': 'GSI1',
            'KeySchema': [
                {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
                {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'},
            ],
            'Projection': {'ProjectionType': 'ALL'},
        },
    ],
    BillingMode='PAY_PER_REQUEST',
)

CONTENT_TABLE_SPEC = dict(
    KeySchema=[
        {'AttributeName': 'PK', 'KeyType': 'HASH'},
        {'AttributeName': 'SK', 'KeyType': 'RANGE'},
    ],
    AttributeDefinitions=[
        {'AttributeName': 'PK', 'AttributeType': 'S'},
        {'AttributeName': 'SK', 'AttributeType': 'S'},
        {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},
        {'AttributeName': 'GSI1SK', 'AttributeType': 'S'},
    ],
    GlobalSecondaryIndexes=[
        {
            'IndexName': 'GSI1',
            'KeySchema': [
                {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
                {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'},
            ],
            'Projection': {'ProjectionType': 'ALL'},
        },
    ],
    BillingMode='PAY_PER_REQUEST',
)


class Command(BaseCommand):
    help = 'Creates UsersTable/GameSessionTable/ContentTable against a local DynamoDB endpoint (idempotent).'

    def handle(self, *args, **options):
        client = _client()

        tables = [
            (os.environ.get('USERS_TABLE', 'UsersTable'), USERS_TABLE_SPEC),
            (os.environ.get('GAME_SESSIONS_TABLE', 'GameSessionTable'), GAME_SESSION_TABLE_SPEC),
            (os.environ.get('CONTENT_TABLE', 'ContentTable'), CONTENT_TABLE_SPEC),
        ]

        for table_name, spec in tables:
            created = _create_table(client, TableName=table_name, **spec)
            if created:
                self.stdout.write(self.style.SUCCESS(f'[OK] Created table {table_name}'))
            else:
                self.stdout.write(self.style.WARNING(f'[SKIP] Table {table_name} already exists'))
