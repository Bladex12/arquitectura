from game_sessions.dynamodb.testing import DynamoDBTestCase


class GameSessionRepositoryTest(DynamoDBTestCase):
    def test_create_and_get_session(self):
        from game_sessions.dynamodb.game_session import create_session, get_session

        created = create_session('ABC123', professor_id=1, course_id=2)

        self.assertEqual(created['room_code'], 'ABC123')
        self.assertEqual(created['status'], 'lobby')
        self.assertEqual(created['type'], 'GameSession')

        fetched = get_session('ABC123')
        self.assertEqual(fetched['room_code'], 'ABC123')
        self.assertEqual(fetched['professor_id'], 1)

    def test_get_session_returns_none_when_missing(self):
        from game_sessions.dynamodb.game_session import get_session

        self.assertIsNone(get_session('NOPE99'))

    def test_create_session_rejects_duplicate_room_code(self):
        from botocore.exceptions import ClientError

        from game_sessions.dynamodb.game_session import create_session

        create_session('ABC123', professor_id=1, course_id=2)

        with self.assertRaises(ClientError) as ctx:
            create_session('ABC123', professor_id=1, course_id=2)
        self.assertEqual(ctx.exception.response['Error']['Code'], 'ConditionalCheckFailedException')

    def test_update_session_status_succeeds_when_expected_matches(self):
        from game_sessions.dynamodb.game_session import create_session, get_session, update_session_status

        create_session('ABC123', professor_id=1, course_id=2)

        result = update_session_status('ABC123', expected_status='lobby', new_status='running')

        self.assertTrue(result)
        self.assertEqual(get_session('ABC123')['status'], 'running')

    def test_update_session_status_fails_when_expected_mismatches(self):
        from game_sessions.dynamodb.game_session import create_session, get_session, update_session_status

        create_session('ABC123', professor_id=1, course_id=2)
        update_session_status('ABC123', expected_status='lobby', new_status='running')

        result = update_session_status('ABC123', expected_status='lobby', new_status='cancelled')

        self.assertFalse(result)
        self.assertEqual(get_session('ABC123')['status'], 'running')

    def test_list_sessions_for_professor(self):
        from game_sessions.dynamodb.game_session import create_session, list_sessions_for_professor

        create_session('ROOM1', professor_id=9, course_id=1)
        create_session('ROOM2', professor_id=9, course_id=1)
        create_session('ROOM3', professor_id=99, course_id=1)

        results = list_sessions_for_professor(9)

        self.assertEqual({item['room_code'] for item in results}, {'ROOM1', 'ROOM2'})

    def test_list_sessions_for_professor_filtered_by_status(self):
        from game_sessions.dynamodb.game_session import (
            create_session,
            list_sessions_for_professor,
            update_session_status,
        )

        create_session('ROOM1', professor_id=9, course_id=1)
        create_session('ROOM2', professor_id=9, course_id=1)
        update_session_status('ROOM2', expected_status='lobby', new_status='running')

        lobby_only = list_sessions_for_professor(9, status='lobby')

        self.assertEqual([item['room_code'] for item in lobby_only], ['ROOM1'])

    def test_scan_active_sessions_excludes_cancelled_and_completed(self):
        from game_sessions.dynamodb.game_session import (
            create_session,
            scan_active_sessions,
            update_session_status,
        )

        create_session('ROOM1', professor_id=1, course_id=1)
        create_session('ROOM2', professor_id=2, course_id=1)
        update_session_status('ROOM2', expected_status='lobby', new_status='cancelled')

        active = scan_active_sessions()

        self.assertEqual([item['room_code'] for item in active], ['ROOM1'])

    def test_get_room_items_returns_everything_under_the_room(self):
        from game_sessions.dynamodb.client import get_table
        from game_sessions.dynamodb.game_session import create_session, get_room_items
        from game_sessions.dynamodb import keys

        create_session('ABC123', professor_id=1, course_id=2)
        table = get_table()
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.team_sk('team-1'),
            'type': 'Team',
            'name': 'Rojo',
        })

        items = get_room_items('ABC123')

        self.assertEqual(len(items), 2)
        self.assertEqual({item['type'] for item in items}, {'GameSession', 'Team'})

    def test_get_room_items_does_not_leak_across_rooms(self):
        from game_sessions.dynamodb.game_session import create_session, get_room_items

        create_session('ROOM1', professor_id=1, course_id=1)
        create_session('ROOM2', professor_id=1, course_id=1)

        items = get_room_items('ROOM1')

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['room_code'], 'ROOM1')

    def test_update_session_partial_update_leaves_other_fields_untouched(self):
        from game_sessions.dynamodb.game_session import create_session, get_session, update_session

        create_session('ABC123', professor_id=1, course_id=2)

        updated = update_session('ABC123', qr_code='some-qr-data')

        self.assertEqual(updated['qr_code'], 'some-qr-data')
        self.assertEqual(updated['professor_id'], 1)
        self.assertEqual(updated['course_id'], 2)
        self.assertEqual(updated['status'], 'lobby')

        fetched = get_session('ABC123')
        self.assertEqual(fetched['qr_code'], 'some-qr-data')
        self.assertEqual(fetched['professor_id'], 1)

    def test_update_session_returns_none_when_missing(self):
        from game_sessions.dynamodb.game_session import update_session

        self.assertIsNone(update_session('NOPE99', qr_code='x'))

    def test_delete_session_removes_every_item_under_the_room(self):
        from game_sessions.dynamodb import keys
        from game_sessions.dynamodb.client import get_table
        from game_sessions.dynamodb.game_session import create_session, delete_session, get_room_items

        create_session('ROOM1', professor_id=1, course_id=1)
        table = get_table()
        table.put_item(Item={
            'PK': keys.session_pk('ROOM1'),
            'SK': keys.team_sk('team-1'),
            'type': 'Team',
            'name': 'Rojo',
        })
        create_session('ROOM2', professor_id=1, course_id=1)

        delete_session('ROOM1')

        self.assertEqual(get_room_items('ROOM1'), [])
        # Regression guard: a different room's items must be untouched.
        remaining = get_room_items('ROOM2')
        self.assertEqual(len(remaining), 1)
        self.assertEqual(remaining[0]['room_code'], 'ROOM2')

    def test_scan_all_sessions_includes_completed_and_cancelled(self):
        from game_sessions.dynamodb.game_session import (
            create_session,
            scan_all_sessions,
            update_session_status,
        )

        create_session('ROOM1', professor_id=1, course_id=1)
        create_session('ROOM2', professor_id=2, course_id=1)
        create_session('ROOM3', professor_id=3, course_id=1)
        update_session_status('ROOM2', expected_status='lobby', new_status='cancelled')
        update_session_status('ROOM3', expected_status='lobby', new_status='running')
        update_session_status('ROOM3', expected_status='running', new_status='completed')

        results = scan_all_sessions()

        self.assertEqual({item['room_code'] for item in results}, {'ROOM1', 'ROOM2', 'ROOM3'})

    def test_scan_all_sessions_filtered_by_status(self):
        from game_sessions.dynamodb.game_session import (
            create_session,
            scan_all_sessions,
            update_session_status,
        )

        create_session('ROOM1', professor_id=1, course_id=1)
        create_session('ROOM2', professor_id=2, course_id=1)
        update_session_status('ROOM2', expected_status='lobby', new_status='cancelled')

        results = scan_all_sessions(status='cancelled')

        self.assertEqual([item['room_code'] for item in results], ['ROOM2'])
