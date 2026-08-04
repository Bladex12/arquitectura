"""Shared moto test helpers for the ContentTable schema (academic +
challenges + admin_dashboard). Mirrors users/dynamodb/testing.py. Only
imported from tests, never from application code.
"""
import os
from unittest import TestCase

import boto3
from moto import mock_aws


def create_test_table(table_name='test-content', region_name='us-east-1'):
    """Creates the ContentTable schema (PK/SK + GSI1) against the active
    moto mock. Must be called inside an active @mock_aws context.

    Idempotent: drops a pre-existing table of the same name first."""
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
    """Base class for academic/challenges/admin_dashboard repository
    tests: starts a moto mock, sets CONTENT_TABLE, creates the schema -
    all torn down after each test."""

    def setUp(self):
        self.mock = mock_aws()
        self.mock.start()
        os.environ['CONTENT_TABLE'] = 'test-content'
        os.environ['AWS_REGION'] = 'us-east-1'
        create_test_table('test-content')

    def tearDown(self):
        self.mock.stop()
