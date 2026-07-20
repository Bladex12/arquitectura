"""Shared moto test helpers for the game_sessions DynamoDB schema.

Only imported from tests, never from application code. Mirrors the
GameSessionTable schema deployed via template.yaml (base PK/SK + GSI1)
so tests exercise the real key structure, not a simplified stand-in.
"""
import os
from unittest import TestCase

import boto3
from moto import mock_aws


def create_test_table(table_name='test-game-sessions', region_name='us-east-1'):
    """Creates the GameSessionTable schema against the active moto mock.
    Must be called inside an active @mock_aws context/decorator.
    """
    dynamodb = boto3.resource('dynamodb', region_name=region_name)
    table = dynamodb.create_table(
        TableName=table_name,
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
    table.wait_until_exists()
    return table


class DynamoDBTestCase(TestCase):
    """Base class for repository tests: starts a moto mock, sets the env
    vars client.get_table() reads, and creates the GameSessionTable
    schema - all torn down after each test. Subclass this instead of
    repeating the same setUp/tearDown in every repository test file."""

    def setUp(self):
        self.mock = mock_aws()
        self.mock.start()
        os.environ['GAME_SESSIONS_TABLE'] = 'test-game-sessions'
        os.environ['AWS_REGION'] = 'us-east-1'
        create_test_table('test-game-sessions')

    def tearDown(self):
        self.mock.stop()
