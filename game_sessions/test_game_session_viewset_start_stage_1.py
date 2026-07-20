"""Tests for GameSessionViewSet.start_stage_1 -- ported from the ORM
(self.get_object()/self.get_serializer()) to DynamoDB as an addendum task
discovered during Task 12 (see
.superpowers/sdd/task-addendum-start-stage-1-report.md). This was the last
remaining consumer of the Task-10 get_object() ORM-compatibility shim,
which is removed alongside this port.

Sibling to test_game_session_viewset_flow.py (Task 11) and
test_game_session_viewset_remaining.py (Task 12): same hybrid Django
TestCase (real MySQL-backed Professor/Course/Stage/Activity/ActivityType
fixtures) composed with a manually-managed moto mock (DynamoDB session/
team/stage/progress data) pattern. Hits the real viewset through the URL
router via DRF's APIClient.

The Stage/Activity/ActivityType self-healing logic inside start_stage_1
(four fallback strategies for locating "Personalización", auto-creating
the ActivityType/Activity/Stage rows when seeders haven't run) stays on
the Django ORM unchanged -- only the GameSession/SessionStage/
TeamActivityProgress-equivalent reads/writes moved to DynamoDB. These
tests exercise both sides together, through the HTTP action.
"""
import os
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from moto import mock_aws
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from academic.models import Career, Course, Faculty
from challenges.models import Activity, ActivityType, Stage
from game_sessions.dynamodb.game_session import create_session, get_session, update_session, update_session_status
from game_sessions.dynamodb.stage_progress import create_session_stage, get_progress, get_session_stage, upsert_progress
from game_sessions.dynamodb.team import create_team
from game_sessions.dynamodb.testing import create_test_table
from users.models import Professor


def make_professor(prefix='prof'):
    user = User.objects.create_user(username=f'{prefix}_{uuid.uuid4().hex[:8]}', password='pass')
    return Professor.objects.create(user=user)


def make_client_for(user):
    refresh = RefreshToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    return client


def make_course():
    suffix = uuid.uuid4().hex[:8]
    faculty = Faculty.objects.create(name=f'Faculty {suffix}')
    career = Career.objects.create(name=f'Career {suffix}', faculty=faculty)
    return Course.objects.create(name=f'Course {suffix}', career=career)


class StartStage1TestCase(TestCase):
    """Base class: starts a moto mock and creates the GameSessionTable
    schema before each test, alongside real Django ORM fixtures."""

    def setUp(self):
        self.mock = mock_aws()
        self.mock.start()
        os.environ['GAME_SESSIONS_TABLE'] = 'test-game-sessions'
        os.environ['AWS_REGION'] = 'us-east-1'
        create_test_table('test-game-sessions')

    def tearDown(self):
        self.mock.stop()


class StartStage1BasicGuardsTest(StartStage1TestCase):
    def test_unknown_room_404s(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/UNKNOWN/start_stage_1/')

        self.assertEqual(response.status_code, 404)

    def test_blocked_when_not_running(self):
        prof = make_professor()
        course = make_course()
        create_session('STG1A', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/STG1A/start_stage_1/')

        self.assertEqual(response.status_code, 400)
        # Nothing was touched.
        self.assertIsNone(get_session('STG1A')['current_stage_id'])


class StartStage1HappyPathTest(StartStage1TestCase):
    def test_strategy1_finds_personalizacion_by_activity_type_code_and_initializes_state(self):
        """Strategy 1: an ActivityType with code='personalizacion' is the
        most reliable signal and should win even when another,
        earlier-ordered activity exists in the stage."""
        stage = Stage.objects.create(number=1, name='Trabajo en Equipo', is_active=True)
        deco_type = ActivityType.objects.create(code='deco', name='Otra cosa', is_active=True)
        Activity.objects.create(
            stage=stage, activity_type=deco_type, name='Actividad decorativa', order_number=1, is_active=True
        )
        personalizacion_type = ActivityType.objects.create(
            code='personalizacion', name='Personalización', is_active=True
        )
        personalizacion = Activity.objects.create(
            stage=stage, activity_type=personalizacion_type, name='Personalización',
            order_number=2, is_active=True,
        )

        prof = make_professor()
        course = make_course()
        create_session('STG1B', professor_id=prof.id, course_id=course.id)
        update_session_status('STG1B', expected_status='lobby', new_status='running')
        team = create_team('STG1B', name='Equipo A', color='Verde')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/STG1B/start_stage_1/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['current_activity_id'], personalizacion.id)
        self.assertEqual(response.data['current_stage_number'], 1)
        self.assertTrue(response.data['stage_started'])

        session = get_session('STG1B')
        self.assertEqual(session['current_stage_id'], stage.id)
        self.assertEqual(session['current_activity_id'], personalizacion.id)

        session_stage = get_session_stage('STG1B', stage.id)
        self.assertIsNotNone(session_stage)
        self.assertEqual(session_stage['status'], 'in_progress')
        self.assertIsNotNone(session_stage['started_at'])

        progress = get_progress('STG1B', team['team_id'], personalizacion.id)
        self.assertIsNotNone(progress)
        self.assertEqual(progress['status'], 'pending')
        self.assertIsNotNone(progress['started_at'])

    def test_strategy2_excludes_instructivo_and_video_by_type_code(self):
        """Strategy 2: no ActivityType has code='personalizacion', so the
        fallback must pick the lowest-order activity that is not tagged
        (or named) Instructivo/Video Institucional."""
        stage = Stage.objects.create(number=1, name='Trabajo en Equipo', is_active=True)
        video_type = ActivityType.objects.create(code='video_institucional', name='Video Institucional', is_active=True)
        instructivo_type = ActivityType.objects.create(code='instructivo', name='Instructivo', is_active=True)
        untyped = ActivityType.objects.create(code='otro', name='Otro', is_active=True)
        Activity.objects.create(stage=stage, activity_type=video_type, name='Video Institucional', order_number=1, is_active=True)
        Activity.objects.create(stage=stage, activity_type=instructivo_type, name='Instructivo', order_number=2, is_active=True)
        target = Activity.objects.create(stage=stage, activity_type=untyped, name='Presentación de equipo', order_number=3, is_active=True)

        prof = make_professor()
        course = make_course()
        create_session('STG1C', professor_id=prof.id, course_id=course.id)
        update_session_status('STG1C', expected_status='lobby', new_status='running')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/STG1C/start_stage_1/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['current_activity_id'], target.id)

    def test_preserves_existing_team_progress_instead_of_resetting_it(self):
        """Mirrors the ORM's plain get_or_create() semantics: if a
        TeamActivityProgress row already exists for the team/activity, it
        must NOT be reset to pending/started_at=now -- unlike
        next_activity's deliberate reset-on-advance behavior."""
        stage = Stage.objects.create(number=1, name='Trabajo en Equipo', is_active=True)
        personalizacion_type = ActivityType.objects.create(code='personalizacion', name='Personalización', is_active=True)
        personalizacion = Activity.objects.create(
            stage=stage, activity_type=personalizacion_type, name='Personalización', order_number=1, is_active=True,
        )

        prof = make_professor()
        course = make_course()
        create_session('STG1D', professor_id=prof.id, course_id=course.id)
        update_session_status('STG1D', expected_status='lobby', new_status='running')
        team = create_team('STG1D', name='Equipo A', color='Verde')
        upsert_progress(
            'STG1D', team['team_id'], personalizacion.id,
            status='completed', progress_percentage=100, started_at='2020-01-01T00:00:00+00:00',
            completed_at='2020-01-01T01:00:00+00:00',
        )
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/STG1D/start_stage_1/')

        self.assertEqual(response.status_code, 200, response.data)
        progress = get_progress('STG1D', team['team_id'], personalizacion.id)
        self.assertEqual(progress['status'], 'completed')
        self.assertEqual(progress['progress_percentage'], 100)
        self.assertEqual(progress['started_at'], '2020-01-01T00:00:00+00:00')

    def test_preserves_existing_session_stage_started_at(self):
        """Mirrors the ORM's `if not session_stage.started_at: ...` guard:
        an already-started SessionStage keeps its original started_at."""
        stage = Stage.objects.create(number=1, name='Trabajo en Equipo', is_active=True)
        personalizacion_type = ActivityType.objects.create(code='personalizacion', name='Personalización', is_active=True)
        Activity.objects.create(
            stage=stage, activity_type=personalizacion_type, name='Personalización', order_number=1, is_active=True,
        )

        prof = make_professor()
        course = make_course()
        create_session('STG1E', professor_id=prof.id, course_id=course.id)
        update_session_status('STG1E', expected_status='lobby', new_status='running')
        create_session_stage('STG1E', stage.id)
        from game_sessions.dynamodb.stage_progress import update_session_stage as _update_stage
        _update_stage('STG1E', stage.id, status='in_progress', started_at='2020-01-01T00:00:00+00:00')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/STG1E/start_stage_1/')

        self.assertEqual(response.status_code, 200, response.data)
        session_stage = get_session_stage('STG1E', stage.id)
        self.assertEqual(session_stage['started_at'], '2020-01-01T00:00:00+00:00')


class StartStage1SelfHealingTest(StartStage1TestCase):
    def test_creates_stage_and_personalizacion_activity_when_nothing_seeded(self):
        """Strategy 4 (self-healing): Stage(number=1) doesn't exist and no
        activity exists for it either -- both must be auto-created so the
        game can proceed even if create_initial_data was never run."""
        self.assertFalse(Stage.objects.filter(number=1).exists())

        prof = make_professor()
        course = make_course()
        create_session('STG1F', professor_id=prof.id, course_id=course.id)
        update_session_status('STG1F', expected_status='lobby', new_status='running')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/STG1F/start_stage_1/')

        self.assertEqual(response.status_code, 200, response.data)

        stage = Stage.objects.get(number=1)
        self.assertEqual(response.data['current_stage_number'], stage.number)

        activity_type = ActivityType.objects.get(code='personalizacion')
        activity = Activity.objects.get(stage=stage, activity_type=activity_type)
        self.assertEqual(activity.name, 'Personalización')
        self.assertEqual(response.data['current_activity_id'], activity.id)

        session = get_session('STG1F')
        self.assertEqual(session['current_stage_id'], stage.id)
        self.assertEqual(session['current_activity_id'], activity.id)

    def test_self_healing_reuses_existing_personalizacion_activity_type(self):
        """If the ActivityType('personalizacion') already exists (e.g. from
        another stage/run) but Stage 1 has no Activity using it yet, Strategy
        4 must reuse the existing type via get_or_create instead of failing
        on the unique `code` constraint."""
        stage = Stage.objects.create(number=1, name='Trabajo en Equipo', is_active=True)
        ActivityType.objects.create(code='personalizacion', name='Personalización', is_active=True)
        # No Activity created for this stage at all.

        prof = make_professor()
        course = make_course()
        create_session('STG1G', professor_id=prof.id, course_id=course.id)
        update_session_status('STG1G', expected_status='lobby', new_status='running')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/STG1G/start_stage_1/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(ActivityType.objects.filter(code='personalizacion').count(), 1)
        activity = Activity.objects.get(stage=stage)
        self.assertEqual(activity.name, 'Personalización')
        self.assertEqual(response.data['current_activity_id'], activity.id)
