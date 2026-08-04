"""Unit tests for game_sessions/serializers.py -- the DynamoDB-backed plain
Serializer conversions (Task 9). These serialize hand-built dicts (the shape
game_sessions.dynamodb.*.py functions return), not ORM instances, so this is
a regular Django TestCase (real MySQL fixtures for users/academic/challenges,
which stay on the ORM) -- no DynamoDB/moto involved."""
from django.contrib.auth.models import User
from django.test import TestCase

from academic.models import Career, Course, Faculty
from challenges.models import Activity, ActivityType, Challenge, RouletteChallenge, Stage, Topic
from users.models import Professor, Student

from game_sessions.serializers import (
    GameSessionCreateSerializer,
    GameSessionSerializer,
    PeerEvaluationSerializer,
    ReflectionEvaluationSerializer,
    SessionStageSerializer,
    TabletConnectionSerializer,
    TabletSerializer,
    TeamActivityProgressSerializer,
    TeamBubbleMapSerializer,
    TeamPersonalizationSerializer,
    TeamRouletteAssignmentSerializer,
    TeamSerializer,
    TokenTransactionSerializer,
    annotate_game_session_display_fields,
    annotate_peer_evaluation_display_fields,
    annotate_session_stage_display_fields,
    annotate_tablet_connection_display_fields,
    annotate_team_activity_progress_display_fields,
    annotate_team_bubble_map_display_fields,
    annotate_team_roulette_assignment_display_fields,
    annotate_token_transaction_display_fields,
)


class GameSessionsSerializersTestCase(TestCase):
    """Shared ORM fixtures for the users/academic/challenges apps, used by
    the annotate_*_display_fields helpers under test."""

    @classmethod
    def setUpTestData(cls):
        user = User.objects.create_user(
            username='profe1', email='profe1@udd.cl', password='x', first_name='Ana', last_name='Soto'
        )
        cls.professor = Professor.objects.create(user=user, access_code='1111')

        faculty = Faculty.objects.create(name='Ingeniería', code='ING')
        career = Career.objects.create(faculty=faculty, name='Informática', code='INF')
        cls.course = Course.objects.create(career=career, name='Emprendimiento', code='EMP101')

        cls.stage = Stage.objects.create(number=1, name='Trabajo en equipo')
        activity_type = ActivityType.objects.create(code='minigame', name='Minijuego')
        cls.activity = Activity.objects.create(
            stage=cls.stage, activity_type=activity_type, name='Sopa de letras', order_number=1
        )

        cls.topic = Topic.objects.create(name='Salud')
        cls.challenge = Challenge.objects.create(topic=cls.topic, title='Reto de salud')

        cls.roulette_challenge = RouletteChallenge.objects.create(
            description='Haz 10 saltos', challenge_type='physical'
        )

        cls.student = Student.objects.create(
            full_name='Juan Pérez', email='juan@udd.cl', rut='11111111-1'
        )


class GameSessionSerializerTest(GameSessionsSerializersTestCase):
    def test_serializes_full_shape_with_annotated_display_fields(self):
        session = {
            'room_code': 'ABC123',
            'professor_id': self.professor.id,
            'course_id': self.course.id,
            'qr_code': None,
            'status': 'lobby',
            'started_at': None,
            'ended_at': None,
            'cancellation_reason': None,
            'cancellation_reason_other': None,
            'current_stage_id': self.stage.id,
            'current_activity_id': self.activity.id,
            'show_results_stage': 0,
            'created_at': '2026-07-20T10:00:00+00:00',
            'updated_at': '2026-07-20T10:00:00+00:00',
        }
        annotate_game_session_display_fields(session, teams=[{'team_id': 't1'}, {'team_id': 't2'}])

        data = GameSessionSerializer(session).data

        self.assertEqual(data['id'], 'ABC123')
        self.assertEqual(data['room_code'], 'ABC123')
        self.assertEqual(data['professor'], self.professor.id)
        self.assertEqual(data['professor_name'], 'Ana Soto')
        self.assertEqual(data['course'], self.course.id)
        self.assertEqual(data['course_name'], 'Emprendimiento')
        self.assertEqual(data['current_stage'], self.stage.id)
        self.assertEqual(data['current_stage_name'], 'Trabajo en equipo')
        self.assertEqual(data['current_stage_number'], 1)
        self.assertEqual(data['current_activity'], self.activity.id)
        self.assertEqual(data['current_activity_name'], 'Sopa de letras')
        self.assertEqual(data['current_session_stage'], self.stage.id)
        self.assertEqual(data['teams_count'], 2)
        self.assertEqual(data['status'], 'lobby')

    def test_annotate_handles_missing_stage_and_activity_gracefully(self):
        session = {
            'room_code': 'XYZ999',
            'professor_id': self.professor.id,
            'course_id': self.course.id,
            'qr_code': None,
            'status': 'lobby',
            'started_at': None,
            'ended_at': None,
            'cancellation_reason': None,
            'cancellation_reason_other': None,
            'current_stage_id': None,
            'current_activity_id': None,
            'show_results_stage': 0,
            'created_at': '2026-07-20T10:00:00+00:00',
            'updated_at': '2026-07-20T10:00:00+00:00',
        }
        annotate_game_session_display_fields(session)

        data = GameSessionSerializer(session).data

        self.assertIsNone(data['current_stage_name'])
        self.assertIsNone(data['current_stage_number'])
        self.assertIsNone(data['current_activity_name'])
        self.assertIsNone(data['current_session_stage'])
        self.assertEqual(data['teams_count'], 0)


class GameSessionCreateSerializerTest(TestCase):
    def test_validates_creation_payload(self):
        serializer = GameSessionCreateSerializer(data={'professor': 1, 'course': 2, 'room_code': 'AAA111'})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['room_code'], 'AAA111')


class TeamSerializerTest(GameSessionsSerializersTestCase):
    def test_serializes_team_with_nested_students(self):
        team = {
            'team_id': 'team-uuid-1',
            'room_code': 'ABC123',
            'name': 'Rojo',
            'color': 'red',
            'tokens_total': 5,
            'student_ids': [self.student.id],
            'created_at': '2026-07-20T10:00:00+00:00',
            'updated_at': '2026-07-20T10:00:00+00:00',
        }

        data = TeamSerializer(team).data

        self.assertEqual(data['id'], 'team-uuid-1')
        self.assertEqual(data['game_session'], 'ABC123')
        self.assertEqual(data['game_session_room_code'], 'ABC123')
        self.assertEqual(data['students_count'], 1)
        self.assertEqual(len(data['students']), 1)
        self.assertEqual(data['students'][0]['full_name'], 'Juan Pérez')
        self.assertNotIn('student_ids', data)  # write_only

    def test_validate_student_ids_rejects_unknown_ids(self):
        serializer = TeamSerializer(data={
            'game_session': 'ABC123', 'name': 'Azul', 'color': 'blue',
            'student_ids': [self.student.id, 999999],
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('student_ids', serializer.errors)

    def test_validate_student_ids_accepts_known_ids(self):
        serializer = TeamSerializer(data={
            'game_session': 'ABC123', 'name': 'Azul', 'color': 'blue',
            'student_ids': [self.student.id],
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)


class TeamPersonalizationSerializerTest(TestCase):
    def test_reads_personalization_fields_from_team_dict(self):
        team = {
            'team_id': 'team-uuid-1',
            'name': 'Rojo',
            'personalization_team_name': 'Los Ganadores',
            'personalization_members_know_each_other': True,
            'created_at': '2026-07-20T10:00:00+00:00',
            'updated_at': '2026-07-20T10:00:00+00:00',
        }

        data = TeamPersonalizationSerializer(team).data

        self.assertEqual(data['team'], 'team-uuid-1')
        self.assertEqual(data['team_name_display'], 'Rojo')
        self.assertEqual(data['team_name'], 'Los Ganadores')
        self.assertTrue(data['team_members_know_each_other'])


class SessionStageSerializerTest(GameSessionsSerializersTestCase):
    def test_serializes_with_annotated_stage_fields(self):
        session_stage = {
            'stage_id': self.stage.id,
            'room_code': 'ABC123',
            'status': 'pending',
            'started_at': None,
            'completed_at': None,
            'presentation_order': None,
            'current_presentation_team_id': None,
            'presentation_state': 'not_started',
            'presentation_timestamps': None,
        }
        annotate_session_stage_display_fields(session_stage)

        data = SessionStageSerializer(session_stage).data

        self.assertEqual(data['id'], self.stage.id)
        self.assertEqual(data['stage'], self.stage.id)
        self.assertEqual(data['stage_name'], 'Trabajo en equipo')
        self.assertEqual(data['stage_number'], 1)
        self.assertEqual(data['game_session'], 'ABC123')
        self.assertEqual(data['game_session_room_code'], 'ABC123')

    def test_current_presentation_team_id_is_a_string(self):
        session_stage = {
            'stage_id': self.stage.id,
            'room_code': 'ABC123',
            'status': 'in_progress',
            'started_at': None,
            'completed_at': None,
            'presentation_order': ['team-a', 'team-b'],
            'current_presentation_team_id': 'team-uuid-1',
            'presentation_state': 'presenting',
            'presentation_timestamps': {'team-uuid-1': '2026-07-20T10:00:00+00:00'},
        }
        annotate_session_stage_display_fields(session_stage)

        data = SessionStageSerializer(session_stage).data

        self.assertEqual(data['current_presentation_team_id'], 'team-uuid-1')
        self.assertEqual(data['presentation_order'], ['team-a', 'team-b'])


class TeamActivityProgressSerializerTest(GameSessionsSerializersTestCase):
    def test_serializes_with_annotated_fields_and_nested_topic(self):
        progress = {
            'PK': 'SESSION#ABC123',
            'SK': 'TEAM#team-uuid-1#PROGRESS#%s' % self.activity.id,
            'team_id': 'team-uuid-1',
            'activity_id': self.activity.id,
            'room_code': 'ABC123',
            'status': 'in_progress',
            'started_at': None,
            'completed_at': None,
            'progress_percentage': 50,
            'response_data': {'answer': 'ok'},
            'selected_topic_id': self.topic.id,
            'selected_challenge_id': None,
            'prototype_image_url': None,
            'pitch_intro_problem': None,
            'pitch_solution': None,
            'pitch_value': None,
            'pitch_impact': None,
            'pitch_closing': None,
        }
        annotate_team_activity_progress_display_fields(progress, team={'name': 'Rojo'})

        data = TeamActivityProgressSerializer(progress).data

        self.assertEqual(data['id'], f"team-uuid-1:{self.activity.id}")
        self.assertEqual(data['team'], 'team-uuid-1')
        self.assertEqual(data['team_name'], 'Rojo')
        self.assertEqual(data['activity'], self.activity.id)
        self.assertEqual(data['activity_name'], 'Sopa de letras')
        self.assertEqual(data['stage_name'], 'Trabajo en equipo')
        self.assertEqual(data['session_stage'], self.stage.id)
        self.assertEqual(data['selected_topic']['name'], 'Salud')
        self.assertIsNone(data['selected_challenge'])

    def test_selected_challenge_nested_serializer(self):
        progress = {
            'SK': 'TEAM#team-uuid-1#PROGRESS#%s' % self.activity.id,
            'team_id': 'team-uuid-1',
            'activity_id': self.activity.id,
            'room_code': 'ABC123',
            'status': 'completed',
            'started_at': None,
            'completed_at': None,
            'progress_percentage': 100,
            'response_data': None,
            'selected_topic_id': None,
            'selected_challenge_id': self.challenge.id,
            'prototype_image_url': None,
            'pitch_intro_problem': None,
            'pitch_solution': None,
            'pitch_value': None,
            'pitch_impact': None,
            'pitch_closing': None,
        }
        annotate_team_activity_progress_display_fields(progress, team={'name': 'Rojo'})

        data = TeamActivityProgressSerializer(progress).data

        self.assertEqual(data['selected_challenge']['title'], 'Reto de salud')
        self.assertIsNone(data['selected_topic'])


class TabletSerializerTest(TestCase):
    def test_trivial_passthrough(self):
        tablet = {
            'tablet_code': 'TAB-01',
            'is_active': True,
            'created_at': '2026-07-20T10:00:00+00:00',
            'updated_at': '2026-07-20T10:00:00+00:00',
        }

        data = TabletSerializer(tablet).data

        self.assertEqual(data['id'], 'TAB-01')
        self.assertEqual(data['tablet_code'], 'TAB-01')
        self.assertTrue(data['is_active'])


class TabletConnectionSerializerTest(TestCase):
    def test_serializes_with_annotated_fields(self):
        connection = {
            'team_session_token': 'session-token-1',
            'team_id': 'team-uuid-1',
            'room_code': 'ABC123',
            'tablet_id': 'TAB-01',
            'connected_at': '2026-07-20T10:00:00+00:00',
            'disconnected_at': None,
            'last_seen': '2026-07-20T10:05:00+00:00',
            'current_screen': 'lobby',
        }
        annotate_tablet_connection_display_fields(
            connection, team={'name': 'Rojo'}, tablet={'tablet_code': 'TAB-01'}
        )

        data = TabletConnectionSerializer(connection).data

        self.assertEqual(data['id'], 'session-token-1')
        self.assertEqual(data['tablet'], 'TAB-01')
        self.assertEqual(data['tablet_code'], 'TAB-01')
        self.assertEqual(data['team'], 'team-uuid-1')
        self.assertEqual(data['team_name'], 'Rojo')
        self.assertEqual(data['game_session'], 'ABC123')
        self.assertEqual(data['game_session_room_code'], 'ABC123')
        self.assertTrue(data['is_connected'])

    def test_is_connected_false_when_disconnected_at_set(self):
        connection = {
            'team_session_token': 'session-token-2',
            'team_id': 'team-uuid-1',
            'room_code': 'ABC123',
            'tablet_id': None,
            'connected_at': '2026-07-20T10:00:00+00:00',
            'disconnected_at': '2026-07-20T10:10:00+00:00',
            'last_seen': '2026-07-20T10:09:00+00:00',
            'current_screen': '',
        }
        annotate_tablet_connection_display_fields(connection, team={'name': 'Rojo'})

        data = TabletConnectionSerializer(connection).data

        self.assertFalse(data['is_connected'])
        self.assertIsNone(data['tablet_code'])


class TeamRouletteAssignmentSerializerTest(GameSessionsSerializersTestCase):
    def test_serializes_with_annotated_fields(self):
        assignment = {
            'SK': 'TEAM#team-uuid-1#ROULETTE#%s' % self.stage.id,
            'team_id': 'team-uuid-1',
            'stage_id': self.stage.id,
            'room_code': 'ABC123',
            'roulette_challenge_id': self.roulette_challenge.id,
            'status': 'assigned',
            'token_reward': 3,
            'assigned_at': '2026-07-20T10:00:00+00:00',
            'accepted_at': None,
            'rejected_at': None,
            'completed_at': None,
            'validated_by_id': self.professor.id,
        }
        annotate_team_roulette_assignment_display_fields(assignment, team={'name': 'Rojo'})

        data = TeamRouletteAssignmentSerializer(assignment).data

        self.assertEqual(data['id'], f"team-uuid-1:{self.stage.id}")
        self.assertEqual(data['team'], 'team-uuid-1')
        self.assertEqual(data['team_name'], 'Rojo')
        self.assertEqual(data['session_stage'], self.stage.id)
        self.assertEqual(data['roulette_challenge'], self.roulette_challenge.id)
        self.assertEqual(data['challenge_description'], 'Haz 10 saltos')
        self.assertEqual(data['challenge_type'], 'physical')
        self.assertEqual(data['validated_by_name'], 'Ana Soto')


class TokenTransactionSerializerTest(GameSessionsSerializersTestCase):
    def test_serializes_with_annotated_fields(self):
        tx = {
            'SK': 'TOKENTX#activity#42',
            'room_code': 'ABC123',
            'team_id': 'team-uuid-1',
            'session_stage_id': self.stage.id,
            'amount': 5,
            'source_type': 'activity',
            'source_id': 42,
            'reason': 'Completó actividad',
            'awarded_by_id': self.professor.id,
            'created_at': '2026-07-20T10:00:00+00:00',
        }
        annotate_token_transaction_display_fields(tx, team={'name': 'Rojo'})

        data = TokenTransactionSerializer(tx).data

        self.assertEqual(data['id'], tx['SK'])
        self.assertEqual(data['team'], 'team-uuid-1')
        self.assertEqual(data['team_name'], 'Rojo')
        self.assertEqual(data['game_session'], 'ABC123')
        self.assertEqual(data['session_stage'], self.stage.id)
        self.assertEqual(data['stage_name'], 'Trabajo en equipo')
        self.assertEqual(data['stage_number'], 1)
        self.assertEqual(data['awarded_by_name'], 'Ana Soto')

    def test_awarded_by_name_none_when_no_awarded_by(self):
        tx = {
            'SK': 'TOKENTX#2026-07-20T10:00:00+00:00#uuid-1',
            'room_code': 'ABC123',
            'team_id': 'team-uuid-1',
            'session_stage_id': None,
            'amount': 1,
            'source_type': 'manual_adjustment',
            'source_id': None,
            'reason': None,
            'awarded_by_id': None,
            'created_at': '2026-07-20T10:00:00+00:00',
        }
        annotate_token_transaction_display_fields(tx, team={'name': 'Rojo'})

        data = TokenTransactionSerializer(tx).data

        self.assertIsNone(data['awarded_by_name'])
        self.assertIsNone(data['stage_name'])
        self.assertIsNone(data['stage_number'])


class TeamBubbleMapSerializerTest(GameSessionsSerializersTestCase):
    def test_serializes_with_annotated_fields(self):
        bubble_map = {
            'SK': 'TEAM#team-uuid-1#BUBBLEMAP#%s' % self.stage.id,
            'team_id': 'team-uuid-1',
            'stage_id': self.stage.id,
            'room_code': 'ABC123',
            'map_data': {'nodes': [], 'edges': []},
            'created_at': '2026-07-20T10:00:00+00:00',
            'updated_at': '2026-07-20T10:00:00+00:00',
        }
        annotate_team_bubble_map_display_fields(bubble_map, team={'name': 'Rojo'})

        data = TeamBubbleMapSerializer(bubble_map).data

        # Task 20: id is a URL-safe "<team_id>:<stage_id>" composite, not
        # the raw '#'-delimited SK (see TeamBubbleMapSerializer docstring).
        self.assertEqual(data['id'], f"team-uuid-1:{self.stage.id}")
        self.assertEqual(data['team'], 'team-uuid-1')
        self.assertEqual(data['team_name'], 'Rojo')
        self.assertEqual(data['session_stage'], self.stage.id)
        self.assertEqual(data['stage_name'], 'Trabajo en equipo')
        self.assertEqual(data['map_data'], {'nodes': [], 'edges': []})


class PeerEvaluationSerializerTest(TestCase):
    def test_serializes_with_annotated_fields(self):
        evaluation = {
            'SK': 'PEEREVAL#team-a#team-b',
            'room_code': 'ABC123',
            'evaluator_team_id': 'team-a',
            'evaluated_team_id': 'team-b',
            'criteria_scores': {'clarity': 5},
            'total_score': 5,
            'tokens_awarded': 2,
            'feedback': 'Buen trabajo',
            'submitted_at': '2026-07-20T10:00:00+00:00',
        }
        annotate_peer_evaluation_display_fields(
            evaluation, evaluator_team={'name': 'Rojo'}, evaluated_team={'name': 'Azul'}
        )

        data = PeerEvaluationSerializer(evaluation).data

        self.assertEqual(data['id'], 'team-a:team-b')
        self.assertEqual(data['evaluator_team'], 'team-a')
        self.assertEqual(data['evaluator_team_name'], 'Rojo')
        self.assertEqual(data['evaluated_team'], 'team-b')
        self.assertEqual(data['evaluated_team_name'], 'Azul')
        self.assertEqual(data['game_session'], 'ABC123')
        self.assertEqual(data['game_session_room_code'], 'ABC123')


class ReflectionEvaluationSerializerTest(TestCase):
    def test_serializes_without_annotation(self):
        reflection = {
            'SK': 'REFLECTION#uuid-1',
            'reflection_id': 'uuid-1',
            'room_code': 'ABC123',
            'student_name': 'Juan Pérez',
            'student_email': 'juan@udd.cl',
            'faculty': 'Ingeniería',
            'career': 'Informática',
            'value_areas': ['empatia', 'trabajo_en_equipo'],
            'satisfaction': 'mucho',
            'entrepreneurship_interest': 'me_encantaria',
            'comments': 'Excelente actividad',
            'created_at': '2026-07-20T10:00:00+00:00',
        }

        data = ReflectionEvaluationSerializer(reflection).data

        # Task 20: id is sourced from reflection_id, not the raw '#'-
        # delimited SK (see ReflectionEvaluationSerializer docstring).
        self.assertEqual(data['id'], 'uuid-1')
        self.assertEqual(data['game_session'], 'ABC123')
        self.assertEqual(data['game_session_room_code'], 'ABC123')
        self.assertEqual(data['student_name'], 'Juan Pérez')
        self.assertEqual(data['value_areas'], ['empatia', 'trabajo_en_equipo'])
