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

        upsert_progress('ABC123', team_id='team-1', activity_id='act-1', status='in_progress', progress_percentage=50)
        upsert_progress('ABC123', team_id='team-1', activity_id='act-1', status='completed', progress_percentage=100)

        fetched = get_progress('ABC123', team_id='team-1', activity_id='act-1')
        self.assertEqual(fetched['status'], 'completed')
        self.assertEqual(fetched['progress_percentage'], 100)

    def test_get_progress_returns_none_when_missing(self):
        from game_sessions.dynamodb.stage_progress import get_progress

        self.assertIsNone(get_progress('ABC123', team_id='nope', activity_id='nope'))
