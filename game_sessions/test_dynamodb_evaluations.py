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
