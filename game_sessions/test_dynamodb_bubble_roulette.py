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

    def test_update_roulette_assignment_returns_none_when_missing(self):
        from game_sessions.dynamodb.bubble_roulette import update_roulette_assignment

        self.assertIsNone(update_roulette_assignment('ABC123', team_id='nope', stage_id=1, status='accepted'))

    def test_list_roulette_assignments_returns_all_in_room(self):
        from game_sessions.dynamodb.bubble_roulette import create_roulette_assignment, list_roulette_assignments

        create_roulette_assignment('ABC123', team_id='team-1', stage_id=3, roulette_challenge_id=5)
        create_roulette_assignment('ABC123', team_id='team-2', stage_id=3, roulette_challenge_id=6)

        items = list_roulette_assignments('ABC123')

        self.assertEqual(len(items), 2)
        self.assertEqual({i['type'] for i in items}, {'TeamRouletteAssignment'})

    def test_list_roulette_assignments_excludes_sibling_entities(self):
        from game_sessions.dynamodb.bubble_roulette import create_roulette_assignment, list_roulette_assignments
        from game_sessions.dynamodb.client import get_table
        from game_sessions.dynamodb import keys

        team = 'team-1'
        create_roulette_assignment('ABC123', team_id=team, stage_id=3, roulette_challenge_id=5)
        # A bubble map item under the same team, sharing the TEAM# prefix -
        # list_roulette_assignments must not return this.
        table = get_table()
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.bubble_map_sk(team, 'stage-1'),
            'type': 'TeamBubbleMap',
            'team_id': team,
        })

        items = list_roulette_assignments('ABC123')

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['type'], 'TeamRouletteAssignment')

    def test_list_roulette_assignments_filtered_by_team_id(self):
        from game_sessions.dynamodb.bubble_roulette import create_roulette_assignment, list_roulette_assignments

        create_roulette_assignment('ABC123', team_id='team-1', stage_id=3, roulette_challenge_id=5)
        create_roulette_assignment('ABC123', team_id='team-2', stage_id=3, roulette_challenge_id=6)

        items = list_roulette_assignments('ABC123', team_id='team-1')

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['team_id'], 'team-1')

    def test_list_bubble_maps_returns_all_in_room(self):
        from game_sessions.dynamodb.bubble_roulette import upsert_bubble_map, list_bubble_maps

        upsert_bubble_map('ABC123', team_id='team-1', stage_id=2, map_data={})
        upsert_bubble_map('ABC123', team_id='team-2', stage_id=2, map_data={})

        items = list_bubble_maps('ABC123')

        self.assertEqual(len(items), 2)
        self.assertEqual({i['type'] for i in items}, {'TeamBubbleMap'})

    def test_list_bubble_maps_excludes_sibling_entities(self):
        from game_sessions.dynamodb.bubble_roulette import upsert_bubble_map, list_bubble_maps
        from game_sessions.dynamodb.client import get_table
        from game_sessions.dynamodb import keys

        team = 'team-1'
        upsert_bubble_map('ABC123', team_id=team, stage_id=2, map_data={})
        # A roulette item under the same team, sharing the TEAM# prefix -
        # list_bubble_maps must not return this.
        table = get_table()
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.roulette_sk(team, 'stage-3'),
            'type': 'TeamRouletteAssignment',
            'team_id': team,
        })

        items = list_bubble_maps('ABC123')

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['type'], 'TeamBubbleMap')

    def test_list_bubble_maps_filtered_by_team_id(self):
        from game_sessions.dynamodb.bubble_roulette import upsert_bubble_map, list_bubble_maps

        upsert_bubble_map('ABC123', team_id='team-1', stage_id=2, map_data={})
        upsert_bubble_map('ABC123', team_id='team-2', stage_id=2, map_data={})

        items = list_bubble_maps('ABC123', team_id='team-1')

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['team_id'], 'team-1')
