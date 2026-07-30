"""Shared moto test helpers for the users DynamoDB schema. Mirrors
game_sessions/dynamodb/testing.py. Only imported from tests, never from
application code.
"""
import os
from unittest import TestCase

import boto3
from moto import mock_aws


def create_test_table(table_name='test-users', region_name='us-east-1'):
    """Creates the UsersTable schema (PK/SK + GSI1 + GSI2) against the
    active moto mock. Must be called inside an active @mock_aws context.

    Idempotent: drops a pre-existing table of the same name first. The
    root conftest.py provisions this table for the whole suite (the users
    app is DynamoDB-backed now, so any test building a Professor/Student
    fixture needs it), which means callers here are often nested inside
    that outer mock and moto will not have reset the backend for them."""
    dynamodb = boto3.resource('dynamodb', region_name=region_name)
    try:
        dynamodb.Table(table_name).delete()
    except dynamodb.meta.client.exceptions.ResourceNotFoundException:
        pass
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
    table.wait_until_exists()
    return table


class DynamoDBTestCase(TestCase):
    """Base class for users repository tests: starts a moto mock, sets
    USERS_TABLE, creates the schema - all torn down after each test."""

    def setUp(self):
        self.mock = mock_aws()
        self.mock.start()
        os.environ['USERS_TABLE'] = 'test-users'
        os.environ['AWS_REGION'] = 'us-east-1'
        create_test_table('test-users')

    def tearDown(self):
        self.mock.stop()
