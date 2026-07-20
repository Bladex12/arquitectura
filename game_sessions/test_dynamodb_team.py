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

    def test_update_team_partial_update_leaves_other_fields_untouched(self):
        from game_sessions.dynamodb.team import create_team, get_team, update_team

        team = create_team('ABC123', name='Rojo', color='red')

        updated = update_team('ABC123', team['team_id'], name='Rojo Actualizado')

        self.assertEqual(updated['name'], 'Rojo Actualizado')
        self.assertEqual(updated['color'], 'red')
        self.assertEqual(updated['tokens_total'], 0)

        fetched = get_team('ABC123', team['team_id'])
        self.assertEqual(fetched['name'], 'Rojo Actualizado')
        self.assertEqual(fetched['color'], 'red')

    def test_update_team_can_set_personalization_fields(self):
        from game_sessions.dynamodb.team import create_team, get_team, update_team

        team = create_team('ABC123', name='Rojo', color='red')

        update_team(
            'ABC123',
            team['team_id'],
            personalization_team_name='Los Ganadores',
            personalization_members_know_each_other=True,
        )

        fetched = get_team('ABC123', team['team_id'])
        self.assertEqual(fetched['personalization_team_name'], 'Los Ganadores')
        self.assertTrue(fetched['personalization_members_know_each_other'])

    def test_update_team_returns_none_when_missing(self):
        from game_sessions.dynamodb.team import update_team

        self.assertIsNone(update_team('ABC123', 'nope', name='x'))

    def test_set_roster_replaces_existing_roster(self):
        from game_sessions.dynamodb.team import add_student, create_team, get_team, set_roster

        team = create_team('ABC123', name='Rojo', color='red')
        add_student('ABC123', team['team_id'], student_id=101)
        add_student('ABC123', team['team_id'], student_id=102)

        result = set_roster('ABC123', team['team_id'], student_ids=[103, 104])

        self.assertEqual(result['student_ids'], [103, 104])
        fetched = get_team('ABC123', team['team_id'])
        self.assertEqual(fetched['student_ids'], [103, 104])
        # Regression guard: student 101/102 must actually be gone, not
        # merged in - set_roster replaces wholesale, unlike add_student.
        self.assertNotIn(101, fetched['student_ids'])
        self.assertNotIn(102, fetched['student_ids'])

    def test_set_roster_can_empty_the_roster(self):
        from game_sessions.dynamodb.team import add_student, create_team, get_team, set_roster

        team = create_team('ABC123', name='Rojo', color='red')
        add_student('ABC123', team['team_id'], student_id=101)

        set_roster('ABC123', team['team_id'], student_ids=[])

        self.assertEqual(get_team('ABC123', team['team_id'])['student_ids'], [])

    def test_set_roster_returns_none_when_team_missing(self):
        from game_sessions.dynamodb.team import set_roster

        self.assertIsNone(set_roster('ABC123', 'nope', student_ids=[1]))

    def test_delete_team_removes_prefix_scoped_children(self):
        from boto3.dynamodb.conditions import Key

        from game_sessions.dynamodb import keys
        from game_sessions.dynamodb.client import get_table
        from game_sessions.dynamodb.team import create_team, delete_team, get_team

        team = create_team('ABC123', name='Rojo', color='red')
        table = get_table()
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.progress_sk(team['team_id'], 'act-1'),
            'type': 'TeamActivityProgress',
            'team_id': team['team_id'],
        })
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.bubble_map_sk(team['team_id'], 'stage-1'),
            'type': 'TeamBubbleMap',
            'team_id': team['team_id'],
        })

        delete_team('ABC123', team['team_id'])

        self.assertIsNone(get_team('ABC123', team['team_id']))
        response = table.query(
            KeyConditionExpression=(
                Key('PK').eq(keys.session_pk('ABC123'))
                & Key('SK').begins_with(keys.team_prefix(team['team_id']))
            ),
        )
        self.assertEqual(response['Items'], [])

    def test_delete_team_removes_non_prefix_children_referencing_team_id(self):
        """Regression guard: TabletConnection and TokenTransaction items
        reference team_id as a plain attribute but their SKs (TABLETCONN#...,
        TOKENTX#...) do NOT share the TEAM#<id># prefix, so a prefix-only
        query would miss them. delete_team must find and delete these too."""
        from game_sessions.dynamodb import keys
        from game_sessions.dynamodb.client import get_table
        from game_sessions.dynamodb.game_session import get_room_items
        from game_sessions.dynamodb.team import create_team, delete_team

        team = create_team('ABC123', name='Rojo', color='red')
        other_team = create_team('ABC123', name='Azul', color='blue')
        table = get_table()
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.tablet_connection_sk('token-1'),
            'type': 'TabletConnection',
            'team_id': team['team_id'],
        })
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.token_tx_sk_for_manual('2026-07-20T00:00:00+00:00', 'tx-1'),
            'type': 'TokenTransaction',
            'team_id': team['team_id'],
        })
        # A TabletConnection referencing a *different* team must survive.
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.tablet_connection_sk('token-2'),
            'type': 'TabletConnection',
            'team_id': other_team['team_id'],
        })

        delete_team('ABC123', team['team_id'])

        remaining = get_room_items('ABC123')
        remaining_sks = {item['SK'] for item in remaining}
        self.assertNotIn(keys.tablet_connection_sk('token-1'), remaining_sks)
        self.assertNotIn(keys.token_tx_sk_for_manual('2026-07-20T00:00:00+00:00', 'tx-1'), remaining_sks)
        # Untouched: the other team's own record and its TabletConnection.
        self.assertIn(keys.tablet_connection_sk('token-2'), remaining_sks)
        self.assertIn(keys.team_sk(other_team['team_id']), remaining_sks)

    def test_delete_team_removes_peer_evaluations_referencing_team(self):
        """Regression guard: PeerEvaluation items reference teams via
        evaluator_team_id/evaluated_team_id attributes, never a plain
        team_id attribute, and their SK (PEEREVAL#<evaluator>#<evaluated>)
        never shares the TEAM#<id># prefix. Both existing filters miss
        them, so delete_team must check these attributes explicitly."""
        from game_sessions.dynamodb import keys
        from game_sessions.dynamodb.client import get_table
        from game_sessions.dynamodb.game_session import get_room_items
        from game_sessions.dynamodb.team import create_team, delete_team

        team = create_team('ABC123', name='Rojo', color='red')
        other_team = create_team('ABC123', name='Azul', color='blue')
        third_team = create_team('ABC123', name='Verde', color='green')
        table = get_table()
        # team is the evaluator.
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.peer_eval_sk(team['team_id'], other_team['team_id']),
            'type': 'PeerEvaluation',
            'evaluator_team_id': team['team_id'],
            'evaluated_team_id': other_team['team_id'],
        })
        # team is the evaluated one.
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.peer_eval_sk(other_team['team_id'], team['team_id']),
            'type': 'PeerEvaluation',
            'evaluator_team_id': other_team['team_id'],
            'evaluated_team_id': team['team_id'],
        })
        # A PeerEvaluation referencing only *other* teams must survive.
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.peer_eval_sk(other_team['team_id'], third_team['team_id']),
            'type': 'PeerEvaluation',
            'evaluator_team_id': other_team['team_id'],
            'evaluated_team_id': third_team['team_id'],
        })

        delete_team('ABC123', team['team_id'])

        remaining = get_room_items('ABC123')
        remaining_sks = {item['SK'] for item in remaining}
        self.assertNotIn(keys.peer_eval_sk(team['team_id'], other_team['team_id']), remaining_sks)
        self.assertNotIn(keys.peer_eval_sk(other_team['team_id'], team['team_id']), remaining_sks)
        # Untouched: the PeerEvaluation between the two surviving teams.
        self.assertIn(keys.peer_eval_sk(other_team['team_id'], third_team['team_id']), remaining_sks)

    def test_delete_team_does_not_leak_across_rooms(self):
        from game_sessions.dynamodb.game_session import get_room_items
        from game_sessions.dynamodb.team import create_team, delete_team

        team1 = create_team('ROOM1', name='Rojo', color='red')
        create_team('ROOM2', name='Azul', color='blue')

        delete_team('ROOM1', team1['team_id'])

        self.assertEqual(get_room_items('ROOM1'), [])
        self.assertEqual(len(get_room_items('ROOM2')), 1)

    def test_scan_all_teams_returns_teams_across_rooms(self):
        from game_sessions.dynamodb.team import create_team, scan_all_teams

        create_team('ROOM1', name='Rojo', color='red')
        create_team('ROOM2', name='Azul', color='blue')

        results = scan_all_teams()

        self.assertEqual({t['name'] for t in results}, {'Rojo', 'Azul'})
        self.assertEqual({t['type'] for t in results}, {'Team'})

    def test_scan_all_teams_excludes_child_items(self):
        from game_sessions.dynamodb import keys
        from game_sessions.dynamodb.client import get_table
        from game_sessions.dynamodb.team import create_team, scan_all_teams

        team = create_team('ROOM1', name='Rojo', color='red')
        table = get_table()
        table.put_item(Item={
            'PK': keys.session_pk('ROOM1'),
            'SK': keys.progress_sk(team['team_id'], 'act-1'),
            'type': 'TeamActivityProgress',
        })

        results = scan_all_teams()

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['type'], 'Team')
