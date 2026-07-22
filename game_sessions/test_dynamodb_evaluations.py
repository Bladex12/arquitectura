from game_sessions.dynamodb.testing import DynamoDBTestCase


class EvaluationsRepositoryTest(DynamoDBTestCase):
    def test_create_peer_evaluation(self):
        from game_sessions.dynamodb.evaluations import create_peer_evaluation

        created = create_peer_evaluation(
            'ABC123', evaluator_team_id='team-1', evaluated_team_id='team-2',
            criteria_scores={'teamwork': 5}, total_score=5,
        )

        self.assertEqual(created['total_score'], 5)
        self.assertEqual(created['type'], 'PeerEvaluation')

    def test_create_peer_evaluation_rejects_duplicate_pair(self):
        from game_sessions.dynamodb.evaluations import create_peer_evaluation

        create_peer_evaluation('ABC123', evaluator_team_id='team-1', evaluated_team_id='team-2', criteria_scores={}, total_score=5)
        result = create_peer_evaluation('ABC123', evaluator_team_id='team-1', evaluated_team_id='team-2', criteria_scores={}, total_score=3)

        self.assertIsNone(result)

    def test_list_peer_evaluations(self):
        from game_sessions.dynamodb.evaluations import create_peer_evaluation, list_peer_evaluations

        create_peer_evaluation('ABC123', evaluator_team_id='team-1', evaluated_team_id='team-2', criteria_scores={}, total_score=5)
        create_peer_evaluation('ABC123', evaluator_team_id='team-2', evaluated_team_id='team-1', criteria_scores={}, total_score=4)

        results = list_peer_evaluations('ABC123')

        self.assertEqual(len(results), 2)

    def test_get_peer_evaluation_returns_none_when_missing(self):
        from game_sessions.dynamodb.evaluations import get_peer_evaluation

        self.assertIsNone(get_peer_evaluation('ABC123', 'team-1', 'team-2'))

    def test_get_peer_evaluation_returns_the_item(self):
        from game_sessions.dynamodb.evaluations import create_peer_evaluation, get_peer_evaluation

        create_peer_evaluation('ABC123', evaluator_team_id='team-1', evaluated_team_id='team-2', criteria_scores={'teamwork': 5}, total_score=5)

        found = get_peer_evaluation('ABC123', 'team-1', 'team-2')

        self.assertIsNotNone(found)
        self.assertEqual(found['total_score'], 5)

    def test_update_peer_evaluation_overwrites_mutable_fields(self):
        from game_sessions.dynamodb.evaluations import create_peer_evaluation, update_peer_evaluation

        create_peer_evaluation(
            'ABC123', evaluator_team_id='team-1', evaluated_team_id='team-2',
            criteria_scores={'teamwork': 5}, total_score=5, tokens_awarded=5, feedback='ok',
        )

        updated = update_peer_evaluation(
            'ABC123', 'team-1', 'team-2', criteria_scores={'teamwork': 8}, total_score=8,
            tokens_awarded=8, feedback='mejor',
        )

        self.assertEqual(updated['total_score'], 8)
        self.assertEqual(updated['tokens_awarded'], 8)
        self.assertEqual(updated['feedback'], 'mejor')
        self.assertEqual(updated['criteria_scores'], {'teamwork': 8})

    def test_update_peer_evaluation_never_touches_submitted_at(self):
        """Mirrors the Django model's auto_now_add=True on submitted_at,
        which .save() never re-triggers on an already-existing row."""
        from game_sessions.dynamodb.evaluations import create_peer_evaluation, update_peer_evaluation

        created = create_peer_evaluation(
            'ABC123', evaluator_team_id='team-1', evaluated_team_id='team-2',
            criteria_scores={}, total_score=5, tokens_awarded=5,
        )

        updated = update_peer_evaluation(
            'ABC123', 'team-1', 'team-2', criteria_scores={}, total_score=9,
            tokens_awarded=9, feedback=None,
        )

        self.assertEqual(updated['submitted_at'], created['submitted_at'])

    def test_update_peer_evaluation_returns_none_when_missing(self):
        from game_sessions.dynamodb.evaluations import update_peer_evaluation

        result = update_peer_evaluation(
            'ABC123', 'team-1', 'team-2', criteria_scores={}, total_score=1, tokens_awarded=1, feedback=None,
        )

        self.assertIsNone(result)

    def test_create_reflection(self):
        from game_sessions.dynamodb.evaluations import create_reflection

        created = create_reflection(
            'ABC123', student_name='Ana Perez', student_email='ana@udd.cl',
            value_areas=['empatizar'], satisfaction='mucho',
        )

        self.assertEqual(created['student_email'], 'ana@udd.cl')
        self.assertEqual(created['value_areas'], ['empatizar'])
        self.assertEqual(created['type'], 'ReflectionEvaluation')

    def test_create_reflection_defaults_value_areas_to_empty_list(self):
        from game_sessions.dynamodb.evaluations import create_reflection

        created = create_reflection('ABC123', student_name='Ana Perez', student_email='ana@udd.cl')

        self.assertEqual(created['value_areas'], [])

    def test_create_reflection_stores_a_url_safe_reflection_id(self):
        """Task 20's serializer id fix relies on a plain `reflection_id`
        attribute (no '#') existing on the item, separate from the raw SK
        ("REFLECTION#<uuid>")."""
        from game_sessions.dynamodb.evaluations import create_reflection

        created = create_reflection('ABC123', student_name='Ana Perez', student_email='ana@udd.cl')

        self.assertIn('reflection_id', created)
        self.assertNotIn('#', created['reflection_id'])
        self.assertEqual(created['SK'], f"REFLECTION#{created['reflection_id']}")

    def test_list_reflections_returns_all_in_room(self):
        from game_sessions.dynamodb.evaluations import create_reflection, list_reflections

        create_reflection('ABC123', student_name='Ana', student_email='ana@udd.cl')
        create_reflection('ABC123', student_name='Bob', student_email='bob@udd.cl')
        create_reflection('ROOM2', student_name='Charlie', student_email='charlie@udd.cl')

        results = list_reflections('ABC123')

        self.assertEqual(len(results), 2)
        self.assertEqual({r['student_email'] for r in results}, {'ana@udd.cl', 'bob@udd.cl'})

    def test_get_reflection_returns_none_when_missing(self):
        from game_sessions.dynamodb.evaluations import get_reflection

        self.assertIsNone(get_reflection('ABC123', 'not-a-real-id'))

    def test_get_reflection_returns_the_item(self):
        from game_sessions.dynamodb.evaluations import create_reflection, get_reflection

        created = create_reflection('ABC123', student_name='Ana', student_email='ana@udd.cl')

        found = get_reflection('ABC123', created['reflection_id'])

        self.assertIsNotNone(found)
        self.assertEqual(found['student_email'], 'ana@udd.cl')

    def test_update_reflection_overwrites_mutable_fields(self):
        from game_sessions.dynamodb.evaluations import create_reflection, update_reflection

        created = create_reflection(
            'ABC123', student_name='Ana', student_email='ana@udd.cl',
            satisfaction='si', comments='ok',
        )

        updated = update_reflection(
            'ABC123', created['reflection_id'], student_name='Ana Perez', faculty='Ingenieria',
            career='Civil', value_areas=['empatizar'], satisfaction='mucho',
            entrepreneurship_interest='me_encantaria', comments='mejor aun',
        )

        self.assertEqual(updated['student_name'], 'Ana Perez')
        self.assertEqual(updated['faculty'], 'Ingenieria')
        self.assertEqual(updated['satisfaction'], 'mucho')
        self.assertEqual(updated['comments'], 'mejor aun')

    def test_update_reflection_never_touches_student_email_or_created_at(self):
        from game_sessions.dynamodb.evaluations import create_reflection, update_reflection

        created = create_reflection('ABC123', student_name='Ana', student_email='ana@udd.cl')

        updated = update_reflection('ABC123', created['reflection_id'], satisfaction='mucho')

        self.assertEqual(updated['student_email'], 'ana@udd.cl')
        self.assertEqual(updated['created_at'], created['created_at'])

    def test_update_reflection_returns_none_when_missing(self):
        from game_sessions.dynamodb.evaluations import update_reflection

        result = update_reflection('ABC123', 'not-a-real-id', satisfaction='mucho')

        self.assertIsNone(result)

    def test_scan_all_reflections_cross_room(self):
        from game_sessions.dynamodb.evaluations import create_reflection, scan_all_reflections

        # Create reflections in multiple rooms
        create_reflection('ROOM1', student_name='Ana', student_email='ana@udd.cl')
        create_reflection('ROOM1', student_name='Bob', student_email='bob@udd.cl')
        create_reflection('ROOM2', student_name='Charlie', student_email='charlie@udd.cl')

        results = scan_all_reflections()

        # Verify all 3 reflections are returned from all rooms
        self.assertEqual(len(results), 3)
        # Verify all items are ReflectionEvaluation type
        for item in results:
            self.assertEqual(item['type'], 'ReflectionEvaluation')
        # Verify we have reflections from both rooms
        room_codes = {item['room_code'] for item in results}
        self.assertEqual(room_codes, {'ROOM1', 'ROOM2'})
