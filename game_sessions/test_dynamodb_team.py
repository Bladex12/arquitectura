from game_sessions.dynamodb.testing import DynamoDBTestCase


class TeamRepositoryTest(DynamoDBTestCase):
    def test_create_and_get_team(self):
        from game_sessions.dynamodb.team import create_team, get_team

        created = create_team('ABC123', name='Rojo', color='red')

        self.assertEqual(created['name'], 'Rojo')
        self.assertEqual(created['tokens_total'], 0)
        self.assertEqual(created['student_ids'], [])
        self.assertEqual(created['type'], 'Team')

        fetched = get_team('ABC123', created['team_id'])
        self.assertEqual(fetched['name'], 'Rojo')

    def test_get_team_returns_none_when_missing(self):
        from game_sessions.dynamodb.team import get_team

        self.assertIsNone(get_team('ABC123', 'nope'))

    def test_list_teams_excludes_child_items(self):
        from game_sessions.dynamodb.client import get_table
        from game_sessions.dynamodb.team import create_team, list_teams
        from game_sessions.dynamodb import keys

        team = create_team('ABC123', name='Rojo', color='red')
        create_team('ABC123', name='Azul', color='blue')
        # A progress item under the same team, sharing the TEAM# prefix -
        # list_teams must not return this.
        table = get_table()
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.progress_sk(team['team_id'], 'act-1'),
            'type': 'TeamActivityProgress',
        })

        teams = list_teams('ABC123')

        self.assertEqual(len(teams), 2)
        self.assertEqual({t['type'] for t in teams}, {'Team'})

    def test_add_student_appends_to_roster(self):
        from game_sessions.dynamodb.team import add_student, create_team, get_team

        team = create_team('ABC123', name='Rojo', color='red')

        result = add_student('ABC123', team['team_id'], student_id=101)

        self.assertEqual(result['student_ids'], [101])
        self.assertEqual(get_team('ABC123', team['team_id'])['student_ids'], [101])

    def test_add_student_is_idempotent(self):
        from game_sessions.dynamodb.team import add_student, create_team

        team = create_team('ABC123', name='Rojo', color='red')

        add_student('ABC123', team['team_id'], student_id=101)
        result = add_student('ABC123', team['team_id'], student_id=101)

        self.assertEqual(result['student_ids'], [101])

    def test_add_student_returns_none_when_team_missing(self):
        from game_sessions.dynamodb.team import add_student

        self.assertIsNone(add_student('ABC123', 'nope', student_id=1))

    def test_update_tokens_adds_delta(self):
        from game_sessions.dynamodb.team import create_team, get_team, update_tokens

        team = create_team('ABC123', name='Rojo', color='red')

        new_total = update_tokens('ABC123', team['team_id'], delta=10)

        self.assertEqual(new_total, 10)
        self.assertEqual(get_team('ABC123', team['team_id'])['tokens_total'], 10)

    def test_update_tokens_accumulates_across_calls(self):
        from game_sessions.dynamodb.team import create_team, update_tokens

        team = create_team('ABC123', name='Rojo', color='red')

        update_tokens('ABC123', team['team_id'], delta=10)
        second_total = update_tokens('ABC123', team['team_id'], delta=-3)

        self.assertEqual(second_total, 7)

    def test_update_tokens_can_go_negative(self):
        from game_sessions.dynamodb.team import create_team, update_tokens

        team = create_team('ABC123', name='Rojo', color='red')

        total = update_tokens('ABC123', team['team_id'], delta=-5)

        self.assertEqual(total, -5)

    def test_update_tokens_returns_none_when_team_missing(self):
        from game_sessions.dynamodb.team import update_tokens

        self.assertIsNone(update_tokens('ABC123', 'nonexistent-team', delta=10))
