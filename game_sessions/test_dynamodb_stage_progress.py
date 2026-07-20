from game_sessions.dynamodb.testing import DynamoDBTestCase


class StageProgressRepositoryTest(DynamoDBTestCase):
    def test_create_and_get_session_stage(self):
        from game_sessions.dynamodb.stage_progress import create_session_stage, get_session_stage

        created = create_session_stage('ABC123', stage_id=1)

        self.assertEqual(created['status'], 'pending')
        self.assertEqual(created['type'], 'SessionStage')

        fetched = get_session_stage('ABC123', stage_id=1)
        self.assertEqual(fetched['stage_id'], 1)

    def test_get_session_stage_returns_none_when_missing(self):
        from game_sessions.dynamodb.stage_progress import get_session_stage

        self.assertIsNone(get_session_stage('ABC123', stage_id=99))

    def test_update_session_stage_partial_update(self):
        from game_sessions.dynamodb.stage_progress import create_session_stage, update_session_stage

        create_session_stage('ABC123', stage_id=1)

        updated = update_session_stage('ABC123', stage_id=1, status='in_progress', started_at='2026-07-19T10:00:00+00:00')

        self.assertEqual(updated['status'], 'in_progress')
        self.assertEqual(updated['started_at'], '2026-07-19T10:00:00+00:00')

    def test_update_session_stage_handles_reserved_word_status(self):
        # 'status' is a DynamoDB reserved word - this test exists
        # specifically to catch a regression to a bare (unaliased)
        # attribute name in the UpdateExpression.
        from game_sessions.dynamodb.stage_progress import create_session_stage, update_session_stage

        create_session_stage('ABC123', stage_id=1)

        updated = update_session_stage('ABC123', stage_id=1, status='completed')

        self.assertEqual(updated['status'], 'completed')

    def test_update_session_stage_returns_none_when_missing(self):
        from game_sessions.dynamodb.stage_progress import update_session_stage

        self.assertIsNone(update_session_stage('ABC123', stage_id=99, status='in_progress'))

    def test_upsert_and_get_progress(self):
        from game_sessions.dynamodb.stage_progress import get_progress, upsert_progress

        created = upsert_progress(
            'ABC123', team_id='team-1', activity_id='act-1',
            status='in_progress', progress_percentage=50,
        )

        self.assertEqual(created['status'], 'in_progress')
        self.assertEqual(created['progress_percentage'], 50)
        self.assertEqual(created['type'], 'TeamActivityProgress')

        fetched = get_progress('ABC123', team_id='team-1', activity_id='act-1')
        self.assertEqual(fetched['progress_percentage'], 50)

    def test_upsert_progress_overwrites_previous_value(self):
        from game_sessions.dynamodb.stage_progress import get_progress, upsert_progress

        # First call: set status, progress_percentage, AND response_data
        upsert_progress('ABC123', team_id='team-1', activity_id='act-1', status='in_progress', progress_percentage=50, response_data={'foo': 'bar'})

        # Second call: update status and progress_percentage, but omit response_data
        # This verifies that upsert_progress does a full overwrite (put_item),
        # not a partial merge (update_item) — if it were merge-based,
        # response_data would still be {'foo': 'bar'} after the second call
        upsert_progress('ABC123', team_id='team-1', activity_id='act-1', status='completed', progress_percentage=100)

        fetched = get_progress('ABC123', team_id='team-1', activity_id='act-1')
        self.assertEqual(fetched['status'], 'completed')
        self.assertEqual(fetched['progress_percentage'], 100)
        # Assert that response_data was cleared (full overwrite, not merge)
        self.assertIsNone(fetched['response_data'])

    def test_get_progress_returns_none_when_missing(self):
        from game_sessions.dynamodb.stage_progress import get_progress

        self.assertIsNone(get_progress('ABC123', team_id='nope', activity_id='nope'))

    def test_scan_all_stages_returns_items_across_multiple_rooms(self):
        from game_sessions.dynamodb.stage_progress import create_session_stage, scan_all_stages

        # Create stages in multiple rooms
        create_session_stage('ROOM1', stage_id=1)
        create_session_stage('ROOM1', stage_id=2)
        create_session_stage('ROOM2', stage_id=1)
        create_session_stage('ROOM2', stage_id=3)

        # Scan all stages across all rooms
        all_stages = scan_all_stages()

        # Should return all 4 stages
        self.assertEqual(len(all_stages), 4)
        # All should be SessionStage type
        self.assertTrue(all(item['type'] == 'SessionStage' for item in all_stages))
        # Should have items from multiple rooms
        room_codes = {item['room_code'] for item in all_stages}
        self.assertEqual(room_codes, {'ROOM1', 'ROOM2'})

    def test_scan_all_stages_with_stage_id_filter(self):
        from game_sessions.dynamodb.stage_progress import create_session_stage, scan_all_stages

        # Create stages in multiple rooms
        create_session_stage('ROOM1', stage_id=1)
        create_session_stage('ROOM1', stage_id=2)
        create_session_stage('ROOM2', stage_id=1)
        create_session_stage('ROOM2', stage_id=3)

        # Scan stages with stage_id=1 filter
        filtered_stages = scan_all_stages(stage_id=1)

        # Should return only 2 stages (stage_id=1 from ROOM1 and ROOM2)
        self.assertEqual(len(filtered_stages), 2)
        # All should be type SessionStage and have stage_id=1
        self.assertTrue(all(item['type'] == 'SessionStage' and item['stage_id'] == 1 for item in filtered_stages))
        # Should span multiple rooms
        room_codes = {item['room_code'] for item in filtered_stages}
        self.assertEqual(room_codes, {'ROOM1', 'ROOM2'})

    def test_scan_all_progress_returns_items_across_multiple_rooms(self):
        from game_sessions.dynamodb.stage_progress import scan_all_progress, upsert_progress

        # Create progress items in multiple rooms
        upsert_progress('ROOM1', team_id='team-1', activity_id='act-1', status='in_progress')
        upsert_progress('ROOM1', team_id='team-2', activity_id='act-2', status='pending')
        upsert_progress('ROOM2', team_id='team-3', activity_id='act-1', status='completed')
        upsert_progress('ROOM2', team_id='team-4', activity_id='act-3', status='in_progress')

        # Scan all progress items across all rooms
        all_progress = scan_all_progress()

        # Should return all 4 progress items
        self.assertEqual(len(all_progress), 4)
        # All should be TeamActivityProgress type
        self.assertTrue(all(item['type'] == 'TeamActivityProgress' for item in all_progress))
        # Should have items from multiple rooms
        room_codes = {item['room_code'] for item in all_progress}
        self.assertEqual(room_codes, {'ROOM1', 'ROOM2'})

    def test_scan_all_progress_with_activity_id_filter(self):
        from game_sessions.dynamodb.stage_progress import scan_all_progress, upsert_progress

        # Create progress items in multiple rooms
        upsert_progress('ROOM1', team_id='team-1', activity_id='act-1', status='in_progress')
        upsert_progress('ROOM1', team_id='team-2', activity_id='act-2', status='pending')
        upsert_progress('ROOM2', team_id='team-3', activity_id='act-1', status='completed')
        upsert_progress('ROOM2', team_id='team-4', activity_id='act-3', status='in_progress')

        # Scan progress items with activity_id='act-1' filter
        filtered_progress = scan_all_progress(activity_id='act-1')

        # Should return only 2 progress items (act-1 from ROOM1 and ROOM2)
        self.assertEqual(len(filtered_progress), 2)
        # All should be type TeamActivityProgress and have activity_id='act-1'
        self.assertTrue(all(item['type'] == 'TeamActivityProgress' and item['activity_id'] == 'act-1' for item in filtered_progress))
        # Should span multiple rooms
        room_codes = {item['room_code'] for item in filtered_progress}
        self.assertEqual(room_codes, {'ROOM1', 'ROOM2'})
