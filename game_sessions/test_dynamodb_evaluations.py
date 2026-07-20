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
