import os

from django.test import TestCase
from django.contrib.auth.models import User
from moto import mock_aws
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from game_sessions.dynamodb.game_session import create_session as create_dynamo_session
from game_sessions.dynamodb.tablet_connection import create_connection, get_connection
from game_sessions.dynamodb.team import create_team as create_dynamo_team
from game_sessions.dynamodb.testing import create_test_table
from game_sessions.models import GameSession, Team, SessionStage, TeamActivityProgress
from users.models import Professor
from academic.models import Faculty, Career, Course
from challenges.models import Stage, Activity, ActivityType
import uuid


def make_professor_client():
    user = User.objects.create_user(username=f'prof_{uuid.uuid4().hex[:6]}', password='pass')
    professor = Professor.objects.create(user=user)
    refresh = RefreshToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    return client, professor


def make_session(professor):
    faculty = Faculty.objects.create(name='Test Faculty')
    career = Career.objects.create(name='Test Career', faculty=faculty)
    course = Course.objects.create(name='Test Course', career=career)
    session = GameSession.objects.create(
        professor=professor,
        course=course,
        room_code=f'TEST{uuid.uuid4().hex[:4].upper()}',
        status='running',
    )
    return session


class ShowResultsActionTest(TestCase):
    def setUp(self):
        self.client, self.professor = make_professor_client()
        self.session = make_session(self.professor)

    def test_set_show_results_stage(self):
        url = f'/api/sessions/game-sessions/{self.session.id}/show_results/'
        response = self.client.post(url, {'stage': 2}, format='json')
        self.assertEqual(response.status_code, 200)
        self.session.refresh_from_db()
        self.assertEqual(self.session.show_results_stage, 2)

    def test_clear_show_results_stage(self):
        self.session.show_results_stage = 3
        self.session.save()
        url = f'/api/sessions/game-sessions/{self.session.id}/show_results/'
        response = self.client.post(url, {'stage': 0}, format='json')
        self.assertEqual(response.status_code, 200)
        self.session.refresh_from_db()
        self.assertEqual(self.session.show_results_stage, 0)

    def test_invalid_stage_value(self):
        url = f'/api/sessions/game-sessions/{self.session.id}/show_results/'
        response = self.client.post(url, {'stage': 9}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_requires_auth(self):
        anon_client = APIClient()
        url = f'/api/sessions/game-sessions/{self.session.id}/show_results/'
        response = anon_client.post(url, {'stage': 1}, format='json')
        self.assertIn(response.status_code, [401, 403])


class UpdateScreenActionTest(TestCase):
    """TabletConnectionViewSet.update_screen reads/writes
    game_sessions.dynamodb.tablet_connection as of Task 17 -- these were
    originally written against the ORM TabletConnection model and needed
    updating to the hybrid ORM+moto pattern (see test_tablet_viewset.py for
    the fuller test suite covering this viewset's DynamoDB cutover)."""

    def setUp(self):
        self.mock = mock_aws()
        self.mock.start()
        os.environ['GAME_SESSIONS_TABLE'] = 'test-game-sessions'
        os.environ['AWS_REGION'] = 'us-east-1'
        create_test_table('test-game-sessions')

        _, professor = make_professor_client()
        faculty = Faculty.objects.create(name='Test Faculty US')
        career = Career.objects.create(name='Test Career US', faculty=faculty)
        course = Course.objects.create(name='Test Course US', career=career)
        self.room_code = f'TEST{uuid.uuid4().hex[:4].upper()}'
        create_dynamo_session(self.room_code, professor_id=professor.id, course_id=course.id)
        self.team = create_dynamo_team(self.room_code, 'Team A', 'Azul')
        self.connection = create_connection(self.room_code, self.team['team_id'])

    def tearDown(self):
        self.mock.stop()

    def test_update_screen(self):
        url = f"/api/sessions/tablet-connections/{self.connection['team_session_token']}/update_screen/"
        client = APIClient()
        response = client.patch(url, {'screen': 'results_1'}, format='json')
        self.assertEqual(response.status_code, 200)
        updated = get_connection(self.room_code, self.connection['team_session_token'])
        self.assertEqual(updated['current_screen'], 'results_1')

    def test_screen_truncated_to_50_chars(self):
        url = f"/api/sessions/tablet-connections/{self.connection['team_session_token']}/update_screen/"
        client = APIClient()
        response = client.patch(url, {'screen': 'x' * 100}, format='json')
        self.assertEqual(response.status_code, 200)
        updated = get_connection(self.room_code, self.connection['team_session_token'])
        self.assertEqual(len(updated['current_screen']), 50)


class ActivityTimerActionTest(TestCase):
    def setUp(self):
        _, self.professor = make_professor_client()
        self.session = make_session(self.professor)
        self.stage = Stage.objects.create(name='Test Stage', order_number=1, is_active=True)
        self.activity_type = ActivityType.objects.create(name='Test Activity Type', description='Test')
        self.activity = Activity.objects.create(
            stage=self.stage,
            activity_type=self.activity_type,
            name='Test Activity',
            order_number=1,
            timer_duration=120
        )
        self.session.current_stage = self.stage
        self.session.current_activity = self.activity
        self.session.save()
        self.session_stage = SessionStage.objects.create(
            game_session=self.session,
            stage=self.stage,
            status='in_progress',
            started_at=timezone.now()
        )
        self.team = Team.objects.create(
            game_session=self.session,
            name='Team A',
            color='Azul',
        )
        self.progress = TeamActivityProgress.objects.create(
            team=self.team,
            session_stage=self.session_stage,
            activity=self.activity,
            status='in_progress',
            started_at=timezone.now() - timezone.timedelta(seconds=30)
        )

    def test_activity_timer_returns_remaining_seconds(self):
        anon_client = APIClient()
        url = f'/api/sessions/game-sessions/{self.session.id}/activity_timer/'
        response = anon_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['activity_id'], self.activity.id)
        self.assertEqual(response.data['timer_duration'], 120)
        self.assertIsNotNone(response.data['started_at'])
        self.assertIsNotNone(response.data['current_time'])
        self.assertIn('remaining_seconds', response.data)
        self.assertTrue(abs(response.data['remaining_seconds'] - 90) <= 1)
