from game_sessions.dynamodb.testing import DynamoDBTestCase


class CatalogRepositoryTest(DynamoDBTestCase):
    def test_create_and_get_session_group(self):
        from game_sessions.dynamodb.catalog import create_session_group, get_session_group

        created = create_session_group(professor_id=1, course_id=2, total_students=30, number_of_sessions=4)

        self.assertEqual(created['total_students'], 30)
        self.assertEqual(created['type'], 'SessionGroup')

        fetched = get_session_group(created['session_group_id'])
        self.assertEqual(fetched['number_of_sessions'], 4)

    def test_get_session_group_returns_none_when_missing(self):
        from game_sessions.dynamodb.catalog import get_session_group

        self.assertIsNone(get_session_group('nonexistent'))

    def test_list_session_groups_for_professor(self):
        from game_sessions.dynamodb.catalog import create_session_group, list_session_groups_for_professor
        from game_sessions.dynamodb.game_session import create_session

        create_session_group(professor_id=1, course_id=2, total_students=30, number_of_sessions=4)
        create_session_group(professor_id=1, course_id=3, total_students=20, number_of_sessions=3)
        create_session_group(professor_id=2, course_id=2, total_students=10, number_of_sessions=1)

        # Plant a GameSession item under the same professor's GSI1 partition
        # to verify the type discriminator actually filters it out
        create_session(room_code='TEST-ROOM', professor_id=1, course_id=2)

        results = list_session_groups_for_professor(1)

        # Should return only the 2 SessionGroup items, not the GameSession
        self.assertEqual(len(results), 2)
        # Verify all results are SessionGroup type
        for item in results:
            self.assertEqual(item['type'], 'SessionGroup')

    def test_create_and_get_tablet(self):
        from game_sessions.dynamodb.catalog import create_tablet, get_tablet

        created = create_tablet('TABLET-01')

        self.assertTrue(created['is_active'])
        self.assertEqual(created['type'], 'Tablet')

        fetched = get_tablet('TABLET-01')
        self.assertEqual(fetched['tablet_code'], 'TABLET-01')

    def test_create_tablet_rejects_duplicate_code(self):
        from game_sessions.dynamodb.catalog import create_tablet

        create_tablet('TABLET-01')
        result = create_tablet('TABLET-01')

        self.assertIsNone(result)

    def test_deactivate_tablet(self):
        from game_sessions.dynamodb.catalog import create_tablet, deactivate_tablet

        create_tablet('TABLET-01')

        updated = deactivate_tablet('TABLET-01')

        self.assertFalse(updated['is_active'])
