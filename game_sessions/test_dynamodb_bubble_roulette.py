from game_sessions.dynamodb.testing import DynamoDBTestCase


class BubbleRouletteRepositoryTest(DynamoDBTestCase):
    def test_upsert_and_get_bubble_map(self):
        from game_sessions.dynamodb.bubble_roulette import get_bubble_map, upsert_bubble_map

        map_data = {'nodes': [{'id': 1, 'text': 'idea'}], 'edges': []}
        created = upsert_bubble_map('ABC123', team_id='team-1', stage_id=2, map_data=map_data)

        self.assertEqual(created['map_data'], map_data)
        self.assertEqual(created['type'], 'TeamBubbleMap')

        fetched = get_bubble_map('ABC123', team_id='team-1', stage_id=2)
        self.assertEqual(fetched['map_data'], map_data)

    def test_upsert_bubble_map_overwrites(self):
        from game_sessions.dynamodb.bubble_roulette import get_bubble_map, upsert_bubble_map

        upsert_bubble_map('ABC123', team_id='team-1', stage_id=2, map_data={'nodes': [], 'edges': []})
        upsert_bubble_map('ABC123', team_id='team-1', stage_id=2, map_data={'nodes': [{'id': 1}], 'edges': []})

        fetched = get_bubble_map('ABC123', team_id='team-1', stage_id=2)
        self.assertEqual(fetched['map_data'], {'nodes': [{'id': 1}], 'edges': []})

    def test_get_bubble_map_returns_none_when_missing(self):
        from game_sessions.dynamodb.bubble_roulette import get_bubble_map

        self.assertIsNone(get_bubble_map('ABC123', team_id='nope', stage_id=1))

    def test_create_and_get_roulette_assignment(self):
        from game_sessions.dynamodb.bubble_roulette import create_roulette_assignment, get_roulette_assignment

        created = create_roulette_assignment('ABC123', team_id='team-1', stage_id=3, roulette_challenge_id=5, token_reward=20)

        self.assertEqual(created['status'], 'assigned')
        self.assertEqual(created['token_reward'], 20)
        self.assertEqual(created['type'], 'TeamRouletteAssignment')

        fetched = get_roulette_assignment('ABC123', team_id='team-1', stage_id=3)
        self.assertEqual(fetched['roulette_challenge_id'], 5)

    def test_get_roulette_assignment_returns_none_when_missing(self):
        from game_sessions.dynamodb.bubble_roulette import get_roulette_assignment

        self.assertIsNone(get_roulette_assignment('ABC123', team_id='nope', stage_id=1))

    def test_update_roulette_assignment_partial_update(self):
        from game_sessions.dynamodb.bubble_roulette import create_roulette_assignment, update_roulette_assignment

        create_roulette_assignment('ABC123', team_id='team-1', stage_id=3, roulette_challenge_id=5)

        updated = update_roulette_assignment(
            'ABC123', team_id='team-1', stage_id=3,
            status='accepted', accepted_at='2026-07-19T10:00:00+00:00',
        )

        self.assertEqual(updated['status'], 'accepted')
        self.assertEqual(updated['accepted_at'], '2026-07-19T10:00:00+00:00')
