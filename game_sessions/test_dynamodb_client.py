import os
from unittest import TestCase
from unittest.mock import patch

from moto import mock_aws

from game_sessions.dynamodb.testing import create_test_table


class GetTableTest(TestCase):
    @mock_aws
    @patch.dict(os.environ, {'GAME_SESSIONS_TABLE': 'test-game-sessions', 'AWS_REGION': 'us-east-1'})
    def test_get_table_returns_usable_table(self):
        from game_sessions.dynamodb.client import get_table

        create_test_table('test-game-sessions')
        table = get_table()

        self.assertEqual(table.table_name, 'test-game-sessions')
        table.put_item(Item={'PK': 'TEST#1', 'SK': 'METADATA'})
        response = table.get_item(Key={'PK': 'TEST#1', 'SK': 'METADATA'})
        self.assertEqual(response['Item']['SK'], 'METADATA')


class BuildUpdateExpressionTest(TestCase):
    def test_builds_set_clause_with_name_placeholders(self):
        from game_sessions.dynamodb.client import build_update_expression

        expression, names, values = build_update_expression({'status': 'running', 'name': 'Team A'})

        self.assertTrue(expression.startswith('SET updated_at = :updated_at, '))
        self.assertEqual(names, {'#f0': 'status', '#f1': 'name'})
        self.assertEqual(values[':v0'], 'running')
        self.assertEqual(values[':v1'], 'Team A')
        self.assertIn(':updated_at', values)

    def test_empty_fields_still_sets_updated_at(self):
        from game_sessions.dynamodb.client import build_update_expression

        expression, names, values = build_update_expression({})

        self.assertEqual(expression, 'SET updated_at = :updated_at')
        self.assertEqual(names, {})
        self.assertIn(':updated_at', values)
