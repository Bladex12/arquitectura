"""Tests for GameSessionViewSet's remaining actions -- activity_timer,
stage_results, next_stage, show_results, end, active_session,
start_reflection, reflection_qr, teams, lobby, etapa -- ported from the ORM
to DynamoDB in Task 12 (see .superpowers/sdd/task-12-brief.md). This is the
LAST slice of GameSessionViewSet to be ported (Tasks 10/11 covered the
rest); once this lands, the class's temporary get_object() ORM shim (added
in Task 10) should have no remaining callers left inside this class -- see
this file's own assertions plus a repo-wide grep during self-review.

Sibling to test_game_session_viewset.py (Task 10) and
test_game_session_viewset_flow.py (Task 11): same hybrid Django TestCase
(real MySQL-backed Professor/Course/Student/Stage/Activity fixtures)
composed with a manually-managed moto mock (DynamoDB session/team/stage/
progress/tablet-connection/token data) pattern. Hits the real viewset
through the URL router via DRF's APIClient.
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
from game_sessions.dynamodb.stage_progress import create_session_stage, get_session_stage, update_session_stage, upsert_progress
from game_sessions.dynamodb.tablet_connection import create_connection, disconnect, list_connections
from game_sessions.dynamodb.team import create_team, list_teams, set_roster, update_tokens
from game_sessions.dynamodb.testing import create_test_table
from game_sessions.dynamodb.token_transaction import create_transaction
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


def make_stage_with_activity(number, name='Etapa', timer_duration=None):
    stage = Stage.objects.create(number=number, name=name, is_active=True)
    activity_type = ActivityType.objects.create(
        code=f'type_{uuid.uuid4().hex[:6]}', name='Tipo', is_active=True
    )
    activity = Activity.objects.create(
        stage=stage, activity_type=activity_type, name='Actividad 1',
        order_number=1, is_active=True, timer_duration=timer_duration,
    )
    return stage, activity


class GameSessionRemainingTestCase(TestCase):
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


class ActivityTimerActionTest(GameSessionRemainingTestCase):
    def test_unknown_session_404s(self):
        client = APIClient()
        response = client.get('/api/sessions/game-sessions/UNKNOWN/activity_timer/')
        self.assertEqual(response.status_code, 404)

    def test_no_current_activity_400s(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMAT1', professor_id=prof.id, course_id=course.id)
        client = APIClient()

        response = client.get('/api/sessions/game-sessions/ROOMAT1/activity_timer/')

        self.assertEqual(response.status_code, 400)

    def test_returns_remaining_seconds_from_earliest_team_start(self):
        prof = make_professor()
        course = make_course()
        stage, activity = make_stage_with_activity(1, timer_duration=100)
        create_session('ROOMAT2', professor_id=prof.id, course_id=course.id)
        update_session('ROOMAT2', current_stage_id=stage.id, current_activity_id=activity.id)
        create_session_stage('ROOMAT2', stage.id)
        team = create_team('ROOMAT2', name='Equipo A', color='Verde')
        upsert_progress('ROOMAT2', team['team_id'], activity.id, status='in_progress', started_at='2020-01-01T00:00:00+00:00')
        client = APIClient()

        response = client.get('/api/sessions/game-sessions/ROOMAT2/activity_timer/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['activity_id'], activity.id)
        self.assertEqual(response.data['timer_duration'], 100)
        self.assertEqual(response.data['remaining_seconds'], 0)  # long elapsed -> clamped to 0

    def test_no_authentication_required(self):
        prof = make_professor()
        course = make_course()
        stage, activity = make_stage_with_activity(1)
        create_session('ROOMAT3', professor_id=prof.id, course_id=course.id)
        update_session('ROOMAT3', current_stage_id=stage.id, current_activity_id=activity.id)
        client = APIClient()

        response = client.get('/api/sessions/game-sessions/ROOMAT3/activity_timer/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data['timer_duration'])
        self.assertIsNone(response.data['remaining_seconds'])


class StageResultsActionTest(GameSessionRemainingTestCase):
    def test_unknown_session_404s(self):
        client = APIClient()
        response = client.get('/api/sessions/game-sessions/UNKNOWN/stage_results/')
        self.assertEqual(response.status_code, 404)

    def test_no_stage_id_and_no_current_stage_400s(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMSR1', professor_id=prof.id, course_id=course.id)
        client = APIClient()

        response = client.get('/api/sessions/game-sessions/ROOMSR1/stage_results/')

        self.assertEqual(response.status_code, 400)

    def test_missing_session_stage_404s(self):
        prof = make_professor()
        course = make_course()
        stage, activity = make_stage_with_activity(1)
        create_session('ROOMSR2', professor_id=prof.id, course_id=course.id)
        update_session('ROOMSR2', current_stage_id=stage.id)
        client = APIClient()

        response = client.get('/api/sessions/game-sessions/ROOMSR2/stage_results/', {'stage_id': stage.id})

        self.assertEqual(response.status_code, 404)

    def test_returns_ranked_results_with_tokens_and_progress(self):
        prof = make_professor()
        course = make_course()
        stage, activity = make_stage_with_activity(1)
        create_session('ROOMSR3', professor_id=prof.id, course_id=course.id)
        create_session_stage('ROOMSR3', stage.id)
        update_session_stage('ROOMSR3', stage.id, status='completed', completed_at='2020-01-01T00:00:00+00:00')

        team_low = create_team('ROOMSR3', name='Equipo Bajo', color='Rojo')
        team_high = create_team('ROOMSR3', name='Equipo Alto', color='Verde')
        create_transaction('ROOMSR3', team_low['team_id'], 5, 'manual', session_stage_id=stage.id)
        create_transaction('ROOMSR3', team_high['team_id'], 20, 'manual', session_stage_id=stage.id)
        # tokens_stage (this stage's ledger) is separate from tokens_total
        # (the Team item's running counter) -- the ranking sorts by the
        # latter, so it must be updated too, same as a real token award would.
        update_tokens('ROOMSR3', team_low['team_id'], 5)
        update_tokens('ROOMSR3', team_high['team_id'], 20)
        upsert_progress('ROOMSR3', team_high['team_id'], activity.id, status='completed', progress_percentage=100)

        client = APIClient()
        response = client.get('/api/sessions/game-sessions/ROOMSR3/stage_results/', {'stage_id': stage.id})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['stage_id'], stage.id)
        results = response.data['teams_results']
        self.assertEqual(len(results), 2)
        # Ranked by tokens_total descending.
        self.assertEqual(results[0]['team_id'], team_high['team_id'])
        self.assertEqual(results[0]['tokens_stage'], 20)
        self.assertEqual(results[1]['team_id'], team_low['team_id'])
        # Team with no progress row but a completed session_stage is
        # treated as having completed the activity.
        low_activity = results[1]['activities_progress'][0]
        self.assertEqual(low_activity['status'], 'completed')
        high_activity = results[0]['activities_progress'][0]
        self.assertEqual(high_activity['status'], 'completed')
        self.assertEqual(high_activity['progress_percentage'], 100)


class NextStageActionTest(GameSessionRemainingTestCase):
    def test_blocked_when_not_running(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMNS1', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMNS1/next_stage/')

        self.assertEqual(response.status_code, 400)

    def test_blocked_when_no_next_stage(self):
        prof = make_professor()
        course = make_course()
        stage1, activity1 = make_stage_with_activity(1)
        create_session('ROOMNS2', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMNS2', expected_status='lobby', new_status='running')
        update_session('ROOMNS2', current_stage_id=stage1.id, current_activity_id=activity1.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMNS2/next_stage/')

        self.assertEqual(response.status_code, 400)

    def test_advances_to_next_stage_and_initializes_progress(self):
        prof = make_professor()
        course = make_course()
        stage1, activity1 = make_stage_with_activity(1, name='Etapa 1')
        stage2, activity2 = make_stage_with_activity(2, name='Etapa 2')
        create_session('ROOMNS3', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMNS3', expected_status='lobby', new_status='running')
        update_session('ROOMNS3', current_stage_id=stage1.id, current_activity_id=activity1.id)
        team = create_team('ROOMNS3', name='Equipo A', color='Verde')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMNS3/next_stage/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['next_stage_number'], 2)

        session = get_session('ROOMNS3')
        self.assertEqual(session['current_stage_id'], stage2.id)
        self.assertEqual(session['current_activity_id'], activity2.id)
        self.assertEqual(session['show_results_stage'], 0)

        session_stage = get_session_stage('ROOMNS3', stage2.id)
        self.assertEqual(session_stage['status'], 'in_progress')

        from game_sessions.dynamodb.stage_progress import get_progress
        progress = get_progress('ROOMNS3', team['team_id'], activity2.id)
        self.assertIsNotNone(progress)
        self.assertEqual(progress['status'], 'in_progress')

    def test_resets_previously_completed_session_stage(self):
        prof = make_professor()
        course = make_course()
        stage1, activity1 = make_stage_with_activity(1, name='Etapa 1')
        stage2, activity2 = make_stage_with_activity(2, name='Etapa 2')
        create_session('ROOMNS4', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMNS4', expected_status='lobby', new_status='running')
        update_session('ROOMNS4', current_stage_id=stage1.id, current_activity_id=activity1.id)
        create_session_stage('ROOMNS4', stage2.id)
        update_session_stage('ROOMNS4', stage2.id, status='completed', completed_at='2020-01-01T00:00:00+00:00')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMNS4/next_stage/')

        self.assertEqual(response.status_code, 200, response.data)
        session_stage = get_session_stage('ROOMNS4', stage2.id)
        self.assertEqual(session_stage['status'], 'in_progress')
        self.assertIsNone(session_stage['completed_at'])


class ShowResultsActionTest(GameSessionRemainingTestCase):
    def test_unknown_session_404s(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/UNKNOWN/show_results/', {'stage': 2}, format='json')

        self.assertEqual(response.status_code, 404)

    def test_sets_show_results_stage(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMSHR1', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMSHR1/show_results/', {'stage': 2}, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['show_results_stage'], 2)
        self.assertEqual(get_session('ROOMSHR1')['show_results_stage'], 2)

    def test_invalid_stage_value_400s(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMSHR2', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMSHR2/show_results/', {'stage': 9}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_requires_auth(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMSHR3', professor_id=prof.id, course_id=course.id)
        client = APIClient()

        response = client.post('/api/sessions/game-sessions/ROOMSHR3/show_results/', {'stage': 1}, format='json')

        self.assertIn(response.status_code, [401, 403])


class EndActionTest(GameSessionRemainingTestCase):
    def test_unknown_session_404s(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/UNKNOWN/end/', {'cancellation_reason': 'x'}, format='json')

        self.assertEqual(response.status_code, 404)

    def test_requires_cancellation_reason_when_not_in_reflection(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOME1', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOME1/end/', {}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_ends_session_and_disconnects_tablets(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOME2', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOME2', expected_status='lobby', new_status='running')
        team = create_team('ROOME2', name='Equipo A', color='Verde')
        create_connection('ROOME2', team['team_id'])
        client = make_client_for(prof.user)

        response = client.post(
            '/api/sessions/game-sessions/ROOME2/end/',
            {'cancellation_reason': 'Prueba'}, format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['tablets_disconnected'], 1)
        self.assertFalse(response.data['in_reflection'])
        session = get_session('ROOME2')
        self.assertEqual(session['status'], 'cancelled')
        self.assertIsNotNone(session['ended_at'])
        connections = list_connections('ROOME2')
        self.assertIsNotNone(connections[0]['disconnected_at'])

    def test_ends_as_completed_when_in_reflection_without_reason(self):
        prof = make_professor()
        course = make_course()
        stage4, activity4 = make_stage_with_activity(4, name='Etapa 4')
        create_session('ROOME3', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOME3', expected_status='lobby', new_status='running')
        create_session_stage('ROOME3', stage4.id)
        update_session_stage(
            'ROOME3', stage4.id,
            presentation_timestamps={'_reflection': True, '_reflection_started_at': '2020-01-01T00:00:00+00:00'},
        )
        team = create_team('ROOME3', name='Equipo A', color='Verde')
        create_connection('ROOME3', team['team_id'])
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOME3/end/', {}, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['in_reflection'])
        self.assertEqual(response.data['tablets_disconnected'], 0)  # not disconnected in reflection
        session = get_session('ROOME3')
        self.assertEqual(session['status'], 'completed')
        # Tablet stays connected during reflection.
        connections = list_connections('ROOME3')
        self.assertIsNone(connections[0]['disconnected_at'])


class ActiveSessionActionTest(GameSessionRemainingTestCase):
    def test_requires_professor(self):
        user = User.objects.create_user(username=f'nonprof_{uuid.uuid4().hex[:8]}', password='pass')
        client = make_client_for(user)

        response = client.get('/api/sessions/game-sessions/active_session/')

        self.assertEqual(response.status_code, 403)

    def test_no_active_session(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.get('/api/sessions/game-sessions/active_session/')

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['active_session'])

    def test_single_active_session(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMAS1', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMAS1', expected_status='lobby', new_status='running')
        client = make_client_for(prof.user)

        response = client.get('/api/sessions/game-sessions/active_session/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['room_code'], 'ROOMAS1')

    def test_multiple_active_sessions_running_first(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMAS2', professor_id=prof.id, course_id=course.id)
        create_session('ROOMAS3', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMAS3', expected_status='lobby', new_status='running')
        client = make_client_for(prof.user)

        response = client.get('/api/sessions/game-sessions/active_session/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['number_of_sessions'], 2)
        room_codes = [s['room_code'] for s in response.data['active_sessions']]
        self.assertEqual(room_codes[0], 'ROOMAS3')  # running first


class StartReflectionActionTest(GameSessionRemainingTestCase):
    def test_no_stage_4_404s(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMSTR1', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMSTR1/start_reflection/')

        self.assertEqual(response.status_code, 404)

    def test_no_session_stage_for_stage_4_404s(self):
        prof = make_professor()
        course = make_course()
        make_stage_with_activity(4, name='Etapa 4')
        create_session('ROOMSTR2', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMSTR2/start_reflection/')

        self.assertEqual(response.status_code, 404)

    def test_marks_reflection_and_completes_running_session(self):
        prof = make_professor()
        course = make_course()
        stage4, activity4 = make_stage_with_activity(4, name='Etapa 4')
        create_session('ROOMSTR3', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMSTR3', expected_status='lobby', new_status='running')
        create_session_stage('ROOMSTR3', stage4.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/ROOMSTR3/start_reflection/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['reflection_started'])
        self.assertTrue(response.data['session_completed'])

        session_stage = get_session_stage('ROOMSTR3', stage4.id)
        self.assertTrue(session_stage['presentation_timestamps']['_reflection'])

        session = get_session('ROOMSTR3')
        self.assertEqual(session['status'], 'completed')
        self.assertIsNotNone(session['ended_at'])


class ReflectionQrActionTest(GameSessionRemainingTestCase):
    def test_unknown_session_404s(self):
        client = APIClient()
        response = client.get('/api/sessions/game-sessions/UNKNOWN/reflection_qr/')
        self.assertEqual(response.status_code, 404)

    def test_generates_qr_for_room(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMQR1', professor_id=prof.id, course_id=course.id)
        client = APIClient()

        response = client.get('/api/sessions/game-sessions/ROOMQR1/reflection_qr/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['room_code'], 'ROOMQR1')
        self.assertIn('ROOMQR1', response.data['evaluation_url'])
        self.assertTrue(response.data['qr_code'].startswith('data:image/png;base64,'))


class TeamsActionTest(GameSessionRemainingTestCase):
    def test_unknown_session_404s(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.get('/api/sessions/game-sessions/UNKNOWN/teams/')

        self.assertEqual(response.status_code, 404)

    def test_lists_teams(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMTM1', professor_id=prof.id, course_id=course.id)
        create_team('ROOMTM1', name='Equipo A', color='Verde')
        create_team('ROOMTM1', name='Equipo B', color='Azul')
        client = make_client_for(prof.user)

        response = client.get('/api/sessions/game-sessions/ROOMTM1/teams/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data), 2)
        names = sorted(t['name'] for t in response.data)
        self.assertEqual(names, ['Equipo A', 'Equipo B'])


class LobbyActionTest(GameSessionRemainingTestCase):
    def test_unknown_session_404s(self):
        client = APIClient()
        response = client.get('/api/sessions/game-sessions/UNKNOWN/lobby/')
        self.assertEqual(response.status_code, 404)

    def test_invalid_status_403s(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMLB1', professor_id=prof.id, course_id=course.id)
        update_session_status('ROOMLB1', expected_status='lobby', new_status='running')
        update_session_status('ROOMLB1', expected_status='running', new_status='cancelled')
        client = APIClient()

        response = client.get('/api/sessions/game-sessions/ROOMLB1/lobby/')

        self.assertEqual(response.status_code, 403)

    def test_returns_full_lobby_state(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMLB2', professor_id=prof.id, course_id=course.id)
        team_a = create_team('ROOMLB2', name='Equipo A', color='Verde')
        team_b = create_team('ROOMLB2', name='Equipo B', color='Azul')
        create_connection('ROOMLB2', team_a['team_id'])
        client = APIClient()

        response = client.get('/api/sessions/game-sessions/ROOMLB2/lobby/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['total_teams'], 2)
        self.assertEqual(response.data['connected_teams'], 1)
        self.assertFalse(response.data['all_teams_connected'])
        self.assertEqual(response.data['game_session']['room_code'], 'ROOMLB2')
        self.assertEqual(len(response.data['teams']), 2)
        self.assertEqual(len(response.data['tablet_connections']), 1)

    def test_all_teams_connected_true_when_every_team_has_a_tablet(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMLB3', professor_id=prof.id, course_id=course.id)
        team_a = create_team('ROOMLB3', name='Equipo A', color='Verde')
        create_connection('ROOMLB3', team_a['team_id'])
        client = APIClient()

        response = client.get('/api/sessions/game-sessions/ROOMLB3/lobby/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['all_teams_connected'])

    def test_vacuously_all_connected_with_no_teams(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMLB4', professor_id=prof.id, course_id=course.id)
        client = APIClient()

        response = client.get('/api/sessions/game-sessions/ROOMLB4/lobby/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['all_teams_connected'])


class EtapaActionTest(GameSessionRemainingTestCase):
    """etapa requires auth (IsAuthenticated default -- it's not in
    get_permissions()'s AllowAny whitelist), unlike activity_timer/
    stage_results/reflection_qr/lobby."""

    def test_unknown_session_404s(self):
        prof = make_professor()
        stage, activity = make_stage_with_activity(1)
        client = make_client_for(prof.user)

        response = client.get(f'/api/sessions/game-sessions/UNKNOWN/etapa/{stage.id}/')

        self.assertEqual(response.status_code, 404)

    def test_unknown_stage_404s(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMET1', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.get('/api/sessions/game-sessions/ROOMET1/etapa/999999/')

        self.assertEqual(response.status_code, 404)

    def test_returns_stage_activities(self):
        prof = make_professor()
        course = make_course()
        stage, activity = make_stage_with_activity(1, name='Trabajo en Equipo')
        create_session('ROOMET2', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.get(f'/api/sessions/game-sessions/ROOMET2/etapa/{stage.id}/')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['etapa_id'], stage.id)
        self.assertEqual(response.data['etapa_nombre'], 'Trabajo en Equipo')
        self.assertEqual(len(response.data['actividades']), 1)

    def test_requires_auth(self):
        prof = make_professor()
        course = make_course()
        stage, activity = make_stage_with_activity(1)
        create_session('ROOMET3', professor_id=prof.id, course_id=course.id)
        client = APIClient()

        response = client.get(f'/api/sessions/game-sessions/ROOMET3/etapa/{stage.id}/')

        self.assertIn(response.status_code, [401, 403])
