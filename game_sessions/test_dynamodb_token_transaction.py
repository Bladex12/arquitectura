from game_sessions.dynamodb.testing import DynamoDBTestCase


class TokenTransactionRepositoryTest(DynamoDBTestCase):
    def test_create_transaction_with_source_id(self):
        from game_sessions.dynamodb.token_transaction import create_transaction

        created = create_transaction(
            'ABC123', team_id='team-1', amount=10,
            source_type='activity', source_id=42,
        )

        self.assertEqual(created['amount'], 10)
        self.assertEqual(created['source_type'], 'activity')
        self.assertEqual(created['type'], 'TokenTransaction')

    def test_create_transaction_is_idempotent_for_same_source(self):
        from game_sessions.dynamodb.token_transaction import create_transaction, list_transactions

        first = create_transaction('ABC123', team_id='team-1', amount=10, source_type='activity', source_id=42)
        second = create_transaction('ABC123', team_id='team-1', amount=10, source_type='activity', source_id=42)

        self.assertIsNotNone(first)
        self.assertIsNone(second)
        self.assertEqual(len(list_transactions('ABC123')), 1)

    def test_create_transaction_without_source_id_is_never_deduplicated(self):
        from game_sessions.dynamodb.token_transaction import create_transaction, list_transactions

        create_transaction('ABC123', team_id='team-1', amount=5, source_type='manual_adjustment')
        create_transaction('ABC123', team_id='team-1', amount=5, source_type='manual_adjustment')

        self.assertEqual(len(list_transactions('ABC123')), 2)

    def test_list_transactions_returns_all_in_room(self):
        from game_sessions.dynamodb.token_transaction import create_transaction, list_transactions

        create_transaction('ABC123', team_id='team-1', amount=10, source_type='activity', source_id=1)
        create_transaction('ABC123', team_id='team-2', amount=5, source_type='activity', source_id=2)

        transactions = list_transactions('ABC123')

        self.assertEqual(len(transactions), 2)
        self.assertEqual({t['team_id'] for t in transactions}, {'team-1', 'team-2'})
