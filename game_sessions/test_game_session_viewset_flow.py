"""Tests for GameSessionViewSet's game-flow actions -- start, sync_teams,
next_activity, set_video_institucional_activity, set_instructivo_activity,
complete_stage -- ported from the ORM to DynamoDB in Task 11 (see
.superpowers/sdd/task-11-brief.md).

Sibling to test_game_session_viewset.py (Task 10): same hybrid Django
TestCase (real MySQL-backed Professor/Course/Student/Stage/Activity
fixtures) composed with a manually-managed moto mock (DynamoDB session/
team/stage/progress/tablet-connection data) pattern. Hits the real
viewset through the URL router via DRF's APIClient.
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
from game_sessions.dynamodb.tablet_connection import create_connection, disconnect
from game_sessions.dynamodb.team import create_team, get_team, list_teams, set_roster
from game_sessions.dynamodb.testing import create_test_table
from users.models import Professor, Student


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


def make_student(prefix='student'):
    suffix = uuid.uuid4().hex[:8]
    return Student.objects.create(
        email=f'{prefix}_{suffix}@example.com',
        full_name=f'{prefix} {suffix}',
        rut=f'{suffix}-1',
    )


def make_stage_1_with_activities():
    """Creates challenges.Stage(number=1) with the four pre-stage/Stage-1
    activities in the order set_video_institucional_activity/
    set_instructivo_activity/next_activity expect: Video Institucional (1),
    Instructivo (2), Personalización (3), Presentación (4)."""
    stage = Stage.objects.create(number=1, name='Trabajo en Equipo', is_active=True)
    video_type = ActivityType.objects.create(
        code=f'video_institucional_{uuid.uuid4().hex[:6]}', name='Video Institucional', is_active=True
    )
    instructivo_type = ActivityType.objects.create(
        code=f'instructivo_{uuid.uuid4().hex[:6]}', name='Instructivo', is_active=True
    )
    personalizacion_type = ActivityType.objects.create(
        code=f'personalizacion_{uuid.uuid4().hex[:6]}', name='Personalización', is_active=True
    )
    presentacion_type = ActivityType.objects.create(
        code=f'minijuego_{uuid.uuid4().hex[:6]}', name='Minijuego', is_active=True
    )

    activities = {
        'video': Activity.objects.create(
            stage=stage, activity_type=video_type, name='Video Institucional', order_number=1, is_active=True
        ),
        'instructivo': Activity.objects.create(
            stage=stage, activity_type=instructivo_type, name='Instructivo', order_number=2, is_active=True
        ),
        'personalizacion': Activity.objects.create(
            stage=stage, activity_type=personalizacion_type, name='Personalización', order_number=3, is_active=True
        ),
        'presentacion': Activity.objects.create(
            stage=stage, activity_type=presentacion_type, name='Presentación', order_number=4, is_active=True
        ),
    }
    return stage, activities


class GameSessionFlowTestCase(TestCase):
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


class StartTest(GameSessionFlowTestCase):
    def test_start_unknown_room_404s(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/UNKNOWN/start/')

        self.assertEqual(response.status_code, 404)

    def test_start_blocked_when_not_lobby(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMS1', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMS1', expected_status='lobby', new_status='running')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMS1/start/')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(get_session('ROOMS1')['status'], 'running')

    def test_start_blocked_when_not_all_teams_connected(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMS2', professor_id=prof.id, course_id=course.id)
        team_a = create_team('ROOMS2', name='Equipo A', color='Verde')
        team_b = create_team('ROOMS2', name='Equipo B', color='Azul')
        create_connection('ROOMS2', team_a['team_id'])
        # team_b has no connection at all
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMS2/start/')

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data['teams_connected'], 1)
        self.assertEqual(response.data['total_teams'], 2)
        self.assertEqual(get_session('ROOMS2')['status'], 'lobby')

    def test_start_blocked_when_a_team_only_has_a_disconnected_tablet(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMS3', professor_id=prof.id, course_id=course.id)
        team_a = create_team('ROOMS3', name='Equipo A', color='Verde')
        connection = create_connection('ROOMS3', team_a['team_id'])
        disconnect('ROOMS3', connection['team_session_token'])
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMS3/start/')

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data['teams_connected'], 0)

    def test_start_succeeds_when_all_teams_connected(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMS4', professor_id=prof.id, course_id=course.id)
        team_a = create_team('ROOMS4', name='Equipo A', color='Verde')
        team_b = create_team('ROOMS4', name='Equipo B', color='Azul')
        create_connection('ROOMS4', team_a['team_id'])
        create_connection('ROOMS4', team_b['team_id'])
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMS4/start/')

        self.assertEqual(response.status_code, 200, response.data)
        session = get_session('ROOMS4')
        self.assertEqual(session['status'], 'running')
        self.assertIsNotNone(session['started_at'])

    def test_start_succeeds_vacuously_with_no_teams(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMS5', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMS5/start/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(get_session('ROOMS5')['status'], 'running')


class SyncTeamsTest(GameSessionFlowTestCase):
    def test_sync_teams_blocked_when_not_lobby(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMT1', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMT1', expected_status='lobby', new_status='running')
        client = make_client_for(prof.user)

        response = client.post(
            '/api/sessions/game-sessions/ROOMT1/sync_teams/',
            {'teams': [{'name': 'Equipo A', 'color': 'Verde', 'student_ids': []}]},
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_sync_teams_requires_non_empty_list(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMT2', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMT2/sync_teams/', {'teams': []}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_sync_teams_adds_updates_and_removes_in_one_call(self):
        """Covers all three sync_teams cases (add/keep-and-update/remove)
        in a single request, per the task brief's explicit requirement."""
        prof = make_professor()
        course = make_course()
        create_session('ROOMT3', professor_id=prof.id, course_id=course.id)
        student_1 = make_student('s1')
        student_2 = make_student('s2')
        student_3 = make_student('s3')

        team_keep = create_team('ROOMT3', name='Equipo Mantener', color='Verde')
        set_roster('ROOMT3', team_keep['team_id'], [student_1.id])
        team_remove = create_team('ROOMT3', name='Equipo Eliminar', color='Rojo')
        client = make_client_for(prof.user)

        response = client.post(
            '/api/sessions/game-sessions/ROOMT3/sync_teams/',
            {
                'teams': [
                    {'id': team_keep['team_id'], 'name': 'Equipo Mantener', 'color': 'Verde',
                     'student_ids': [student_1.id, student_2.id]},
                    {'name': 'Equipo Nuevo', 'color': 'Azul', 'student_ids': [student_3.id]},
                ]
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)

        final_teams = list_teams('ROOMT3')
        final_ids = {t['team_id'] for t in final_teams}
        # Removed team is gone.
        self.assertNotIn(team_remove['team_id'], final_ids)
        # Kept team survives with the same id and updated roster.
        self.assertIn(team_keep['team_id'], final_ids)
        kept = get_team('ROOMT3', team_keep['team_id'])
        self.assertEqual(set(kept['student_ids']), {student_1.id, student_2.id})
        # New team was created with its roster.
        new_teams = [t for t in final_teams if t['name'] == 'Equipo Nuevo']
        self.assertEqual(len(new_teams), 1)
        self.assertEqual(new_teams[0]['student_ids'], [student_3.id])
        self.assertEqual(len(final_teams), 2)

    def test_sync_teams_skips_unknown_student_ids(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMT4', professor_id=prof.id, course_id=course.id)
        student_1 = make_student('s1')
        client = make_client_for(prof.user)

        response = client.post(
            '/api/sessions/game-sessions/ROOMT4/sync_teams/',
            {'teams': [{'name': 'Equipo A', 'color': 'Verde', 'student_ids': [student_1.id, 999999]}]},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        teams = list_teams('ROOMT4')
        self.assertEqual(len(teams), 1)
        self.assertEqual(teams[0]['student_ids'], [student_1.id])

    def test_sync_teams_deduplicates_default_names(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMT5', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post(
            '/api/sessions/game-sessions/ROOMT5/sync_teams/',
            {
                'teams': [
                    {'name': 'Equipo Duplicado', 'color': 'Verde', 'student_ids': []},
                    {'name': 'Equipo Duplicado', 'color': 'Azul', 'student_ids': []},
                ]
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        names = sorted(t['name'] for t in list_teams('ROOMT5'))
        self.assertEqual(names, ['Equipo Duplicado', 'Equipo Duplicado (2)'])


class NextActivityTest(GameSessionFlowTestCase):
    def test_next_activity_blocked_when_not_running(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMN1', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMN1/next_activity/')

        self.assertEqual(response.status_code, 400)

    def test_next_activity_advances_within_stage_and_marks_old_activity_completed(self):
        prof = make_professor()
        course = make_course()
        stage, activities = make_stage_1_with_activities()
        create_session('ROOMN2', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMN2', expected_status='lobby', new_status='running')
        update_session(
            'ROOMN2',
            current_stage_id=stage.id,
            current_activity_id=activities['personalizacion'].id,
        )
        create_session_stage('ROOMN2', stage.id)
        team = create_team('ROOMN2', name='Equipo A', color='Verde')
        upsert_progress(
            'ROOMN2', team['team_id'], activities['personalizacion'].id,
            status='in_progress', progress_percentage=50,
        )
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMN2/next_activity/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['current_activity_id'], activities['presentacion'].id)
        session = get_session('ROOMN2')
        self.assertEqual(session['current_activity_id'], activities['presentacion'].id)

        # Old activity marked completed for the team, but its other saved
        # fields (progress_percentage was 50 before completion) end up
        # overwritten to 100/completed -- that's the expected "activity is
        # now done" transition, not data loss of unrelated fields.
        old_progress = get_progress('ROOMN2', team['team_id'], activities['personalizacion'].id)
        self.assertEqual(old_progress['status'], 'completed')
        self.assertEqual(old_progress['progress_percentage'], 100)

        # New activity progress initialized as pending for the team.
        new_progress = get_progress('ROOMN2', team['team_id'], activities['presentacion'].id)
        self.assertEqual(new_progress['status'], 'pending')

    def test_next_activity_completes_stage_when_no_more_activities(self):
        prof = make_professor()
        course = make_course()
        stage, activities = make_stage_1_with_activities()
        create_session('ROOMN3', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMN3', expected_status='lobby', new_status='running')
        update_session(
            'ROOMN3',
            current_stage_id=stage.id,
            current_activity_id=activities['presentacion'].id,  # last activity (order 4)
        )
        create_session_stage('ROOMN3', stage.id)
        team = create_team('ROOMN3', name='Equipo A', color='Verde')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMN3/next_activity/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['stage_completed'])
        self.assertEqual(response.data['stage_id'], stage.id)

        session = get_session('ROOMN3')
        self.assertIsNone(session['current_activity_id'])

        session_stage = get_session_stage('ROOMN3', stage.id)
        self.assertEqual(session_stage['status'], 'completed')
        self.assertIsNotNone(session_stage['completed_at'])

        progress = get_progress('ROOMN3', team['team_id'], activities['presentacion'].id)
        self.assertEqual(progress['status'], 'completed')


class SetVideoInstitucionalActivityTest(GameSessionFlowTestCase):
    def test_sets_stage_and_activity_and_initializes_progress(self):
        prof = make_professor()
        course = make_course()
        stage, activities = make_stage_1_with_activities()
        create_session('ROOMV1', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMV1', expected_status='lobby', new_status='running')
        team = create_team('ROOMV1', name='Equipo A', color='Verde')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMV1/set_video_institucional_activity/')

        self.assertEqual(response.status_code, 200, response.data)
        session = get_session('ROOMV1')
        self.assertEqual(session['current_stage_id'], stage.id)
        self.assertEqual(session['current_activity_id'], activities['video'].id)

        session_stage = get_session_stage('ROOMV1', stage.id)
        self.assertEqual(session_stage['status'], 'in_progress')

        progress = get_progress('ROOMV1', team['team_id'], activities['video'].id)
        self.assertEqual(progress['status'], 'in_progress')

    def test_blocked_when_not_running(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMV2', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMV2/set_video_institucional_activity/')

        self.assertEqual(response.status_code, 400)


class SetInstructivoActivityTest(GameSessionFlowTestCase):
    def test_sets_activity_only_leaves_stage_unset(self):
        prof = make_professor()
        course = make_course()
        stage, activities = make_stage_1_with_activities()
        create_session('ROOMI1', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMI1', expected_status='lobby', new_status='running')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMI1/set_instructivo_activity/')

        self.assertEqual(response.status_code, 200, response.data)
        session = get_session('ROOMI1')
        self.assertEqual(session['current_activity_id'], activities['instructivo'].id)
        self.assertIsNone(session['current_stage_id'])
        self.assertIsNone(response.data['current_stage_number'])
        # No SessionStage created for the pre-stage Instructivo activity.
        self.assertIsNone(get_session_stage('ROOMI1', stage.id))


class CompleteStageTest(GameSessionFlowTestCase):
    def test_marks_stage_and_activity_completed_and_clears_current_activity(self):
        prof = make_professor()
        course = make_course()
        stage, activities = make_stage_1_with_activities()
        create_session('ROOMC1', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMC1', expected_status='lobby', new_status='running')
        update_session(
            'ROOMC1',
            current_stage_id=stage.id,
            current_activity_id=activities['presentacion'].id,
        )
        create_session_stage('ROOMC1', stage.id)
        team = create_team('ROOMC1', name='Equipo A', color='Verde')
        client = make_client_for(prof.user)

        response = client.post(
            '/api/sessions/game-sessions/ROOMC1/complete_stage/', {'stage_number': stage.number}, format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['stage_completed'])

        session = get_session('ROOMC1')
        self.assertIsNone(session['current_activity_id'])

        session_stage = get_session_stage('ROOMC1', stage.id)
        self.assertEqual(session_stage['status'], 'completed')

        progress = get_progress('ROOMC1', team['team_id'], activities['presentacion'].id)
        self.assertEqual(progress['status'], 'completed')

    def test_rejects_mismatched_stage_number(self):
        prof = make_professor()
        course = make_course()
        stage, activities = make_stage_1_with_activities()
        create_session('ROOMC2', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMC2', expected_status='lobby', new_status='running')
        update_session('ROOMC2', current_stage_id=stage.id, current_activity_id=activities['presentacion'].id)
        client = make_client_for(prof.user)

        response = client.post(
            '/api/sessions/game-sessions/ROOMC2/complete_stage/', {'stage_number': stage.number + 1}, format='json'
        )

        self.assertEqual(response.status_code, 400)

    def test_creates_session_stage_when_missing(self):
        """complete_stage must work even if no SessionStage row exists yet
        (e.g. professor jumps straight to results) -- unlike next_activity's
        stage-completion branch, which skips completion when the row is
        missing."""
        prof = make_professor()
        course = make_course()
        stage, activities = make_stage_1_with_activities()
        create_session('ROOMC3', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMC3', expected_status='lobby', new_status='running')
        update_session('ROOMC3', current_stage_id=stage.id, current_activity_id=activities['presentacion'].id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMC3/complete_stage/', {}, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        session_stage = get_session_stage('ROOMC3', stage.id)
        self.assertIsNotNone(session_stage)
        self.assertEqual(session_stage['status'], 'completed')
