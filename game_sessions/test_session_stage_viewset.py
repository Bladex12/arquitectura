"""Tests for SessionStageViewSet's presentation-flow actions --
generate_presentation_order, update_presentation_order, start_presentation,
next_presentation, start_team_pitch, finish_team_presentation,
presentation_status, presentation_timer, mark_presentation_done,
presentation_evaluation_progress -- ported from the ORM to DynamoDB in
Task 14 (see .superpowers/sdd/task-14-brief.md).

Sibling to test_game_session_viewset_flow.py (Task 11) / test_team_viewset.py
(Task 13): same hybrid Django TestCase (real MySQL-backed Professor/Course/
Student/Stage/Activity fixtures) composed with a manually-managed moto mock
(DynamoDB session/team/stage/progress/peer-evaluation data) pattern. Hits
the real viewset through the URL router via DRF's APIClient.
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
from game_sessions.dynamodb.evaluations import create_peer_evaluation
from game_sessions.dynamodb.game_session import create_session
from game_sessions.dynamodb.stage_progress import (
    create_session_stage, get_progress, get_session_stage, upsert_progress,
)
from game_sessions.dynamodb.team import create_team
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


def make_stage_4_with_activities():
    """Creates challenges.Stage(number=4) plus the three activities
    presentation_status/mark_presentation_done look up by name substring:
    'presentación' (pitch presentation), and Stage(number=3)'s 'prototipo'
    plus this Stage(number=4)'s 'formulario' (pitch form)."""
    stage3 = Stage.objects.create(number=3, name='Creatividad', is_active=True)
    stage4 = Stage.objects.create(number=4, name='Comunicación', is_active=True)

    prototipo_type = ActivityType.objects.create(
        code=f'prototipo_{uuid.uuid4().hex[:6]}', name='Prototipo', is_active=True
    )
    formulario_type = ActivityType.objects.create(
        code=f'formulario_{uuid.uuid4().hex[:6]}', name='Formulario Pitch', is_active=True
    )
    presentacion_type = ActivityType.objects.create(
        code=f'presentacion_{uuid.uuid4().hex[:6]}', name='Presentación', is_active=True
    )

    activities = {
        'prototipo': Activity.objects.create(
            stage=stage3, activity_type=prototipo_type, name='Prototipo', order_number=1, is_active=True
        ),
        'formulario': Activity.objects.create(
            stage=stage4, activity_type=formulario_type, name='Formulario Pitch', order_number=1, is_active=True
        ),
        'presentacion': Activity.objects.create(
            stage=stage4, activity_type=presentacion_type, name='Presentación', order_number=2, is_active=True
        ),
    }
    return stage3, stage4, activities


class SessionStageFlowTestCase(TestCase):
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

    def make_room_with_stage4(self, room_code='ROOM4'):
        prof = make_professor()
        course = make_course()
        create_session(room_code, professor_id=prof.id, course_id=course.id)
        stage3, stage4, activities = make_stage_4_with_activities()
        create_session_stage(room_code, stage4.id)
        return prof, room_code, stage3, stage4, activities


# ---------------------------------------------------------------------------
# generate_presentation_order
# ---------------------------------------------------------------------------

class GeneratePresentationOrderTest(SessionStageFlowTestCase):
    def test_requires_game_session_param(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        client = make_client_for(prof.user)

        response = client.post(f'/api/sessions/session-stages/{stage4.id}/generate_presentation_order/')

        self.assertEqual(response.status_code, 400)

    def test_rejects_non_stage_4(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOM_NOT4', professor_id=prof.id, course_id=course.id)
        stage1 = Stage.objects.create(number=1, name='Trabajo en Equipo', is_active=True)
        create_session_stage('ROOM_NOT4', stage1.id)
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage1.id}/generate_presentation_order/',
            {'game_session': 'ROOM_NOT4'}, format='json'
        )

        self.assertEqual(response.status_code, 400)

    def test_generates_random_order_of_all_teams(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        team_b = create_team(room_code, 'Equipo B', 'Rojo')
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/generate_presentation_order/',
            {'game_session': room_code}, format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        order = response.data['presentation_order']
        self.assertEqual(set(order), {team_a['team_id'], team_b['team_id']})

    def test_blocked_while_presentations_in_progress(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(
            room_code, stage4.id,
            presentation_order=[team_a['team_id']],
            current_presentation_team_id=team_a['team_id'],
            presentation_state='preparing',
        )
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/generate_presentation_order/',
            {'game_session': room_code}, format='json'
        )

        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# update_presentation_order
# ---------------------------------------------------------------------------

class UpdatePresentationOrderTest(SessionStageFlowTestCase):
    def test_updates_order(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        team_b = create_team(room_code, 'Equipo B', 'Rojo')
        client = make_client_for(prof.user)

        new_order = [team_b['team_id'], team_a['team_id']]
        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/update_presentation_order/',
            {'game_session': room_code, 'presentation_order': new_order}, format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['presentation_order'], new_order)

    def test_requires_list_payload(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/update_presentation_order/',
            {'game_session': room_code}, format='json'
        )

        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# start_presentation / next_presentation
# ---------------------------------------------------------------------------

class StartAndNextPresentationTest(SessionStageFlowTestCase):
    def test_start_presentation_requires_order(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/start_presentation/',
            {'game_session': room_code}, format='json'
        )

        self.assertEqual(response.status_code, 400)

    def test_start_presentation_sets_first_team_preparing(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        team_b = create_team(room_code, 'Equipo B', 'Rojo')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(room_code, stage4.id, presentation_order=[team_a['team_id'], team_b['team_id']])
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/start_presentation/',
            {'game_session': room_code}, format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['current_presentation_team_id'], team_a['team_id'])
        self.assertEqual(response.data['presentation_state'], 'preparing')

    def test_next_presentation_advances_to_second_team(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        team_b = create_team(room_code, 'Equipo B', 'Rojo')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(
            room_code, stage4.id,
            presentation_order=[team_a['team_id'], team_b['team_id']],
            current_presentation_team_id=team_a['team_id'],
            presentation_state='evaluating',
        )
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/next_presentation/',
            {'game_session': room_code}, format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['current_presentation_team_id'], team_b['team_id'])
        self.assertEqual(response.data['presentation_state'], 'preparing')

    def test_next_presentation_finishes_after_last_team(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(
            room_code, stage4.id,
            presentation_order=[team_a['team_id']],
            current_presentation_team_id=team_a['team_id'],
            presentation_state='evaluating',
        )
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/next_presentation/',
            {'game_session': room_code}, format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data['current_presentation_team_id'])
        self.assertEqual(response.data['presentation_state'], 'not_started')


# ---------------------------------------------------------------------------
# start_team_pitch / finish_team_presentation
# ---------------------------------------------------------------------------

class TeamPitchTimingTest(SessionStageFlowTestCase):
    def test_start_team_pitch_requires_preparing_state(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(
            room_code, stage4.id,
            current_presentation_team_id=team_a['team_id'],
            presentation_state='not_started',
        )
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/start_team_pitch/',
            {'game_session': room_code}, format='json'
        )

        self.assertEqual(response.status_code, 400)

    def test_start_team_pitch_records_timestamp(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(
            room_code, stage4.id,
            current_presentation_team_id=team_a['team_id'],
            presentation_state='preparing',
        )
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/start_team_pitch/',
            {'game_session': room_code}, format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['presentation_state'], 'presenting')
        self.assertEqual(response.data['presentation_duration'], 90)
        self.assertIn('presentation_started_at', response.data)

        stored = get_session_stage(room_code, stage4.id)
        self.assertIn(str(team_a['team_id']), stored['presentation_timestamps'])

    def test_finish_team_presentation_requires_presenting_state(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(
            room_code, stage4.id,
            current_presentation_team_id=team_a['team_id'],
            presentation_state='preparing',
        )
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/finish_team_presentation/',
            {'game_session': room_code}, format='json'
        )

        self.assertEqual(response.status_code, 400)

    def test_finish_team_presentation_moves_to_evaluating(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(
            room_code, stage4.id,
            current_presentation_team_id=team_a['team_id'],
            presentation_state='presenting',
        )
        client = make_client_for(prof.user)

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/finish_team_presentation/',
            {'game_session': room_code}, format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['presentation_state'], 'evaluating')


# ---------------------------------------------------------------------------
# presentation_status (tablets, no auth)
# ---------------------------------------------------------------------------

class PresentationStatusTest(SessionStageFlowTestCase):
    def test_no_auth_required(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(
            room_code, stage4.id,
            presentation_order=[team_a['team_id']],
            current_presentation_team_id=team_a['team_id'],
        )
        client = APIClient()

        response = client.get(
            f'/api/sessions/session-stages/{stage4.id}/presentation_status/',
            {'game_session': room_code}
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data['teams']), 1)
        self.assertEqual(response.data['teams'][0]['id'], team_a['team_id'])
        self.assertTrue(response.data['order_confirmed'])

    def test_includes_prototype_and_pitch_for_current_team(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        upsert_progress(
            room_code, team_a['team_id'], activities['prototipo'].id,
            status='completed', prototype_image_url='https://example.com/proto.png',
        )
        upsert_progress(
            room_code, team_a['team_id'], activities['formulario'].id,
            status='completed', pitch_intro_problem='intro', pitch_solution='solution',
        )
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(
            room_code, stage4.id,
            presentation_order=[team_a['team_id']],
            current_presentation_team_id=team_a['team_id'],
        )
        client = APIClient()

        response = client.get(
            f'/api/sessions/session-stages/{stage4.id}/presentation_status/',
            {'game_session': room_code}
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['current_team_prototype'], 'https://example.com/proto.png')
        self.assertEqual(response.data['current_team_pitch']['intro_problem'], 'intro')
        self.assertEqual(response.data['current_team_pitch']['solution'], 'solution')

    def test_reports_completed_team_ids(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        team_b = create_team(room_code, 'Equipo B', 'Rojo')
        upsert_progress(room_code, team_a['team_id'], activities['presentacion'].id, status='completed')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(
            room_code, stage4.id,
            presentation_order=[team_a['team_id'], team_b['team_id']],
        )
        client = APIClient()

        response = client.get(
            f'/api/sessions/session-stages/{stage4.id}/presentation_status/',
            {'game_session': room_code}
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['completed_team_ids'], [team_a['team_id']])


# ---------------------------------------------------------------------------
# presentation_timer (tablets, no auth)
# ---------------------------------------------------------------------------

class PresentationTimerTest(SessionStageFlowTestCase):
    def test_requires_current_presenting_team(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        client = APIClient()

        response = client.get(
            f'/api/sessions/session-stages/{stage4.id}/presentation_timer/',
            {'game_session': room_code}
        )

        self.assertEqual(response.status_code, 400)

    def test_requires_started_timestamp(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(room_code, stage4.id, current_presentation_team_id=team_a['team_id'])
        client = APIClient()

        response = client.get(
            f'/api/sessions/session-stages/{stage4.id}/presentation_timer/',
            {'game_session': room_code}
        )

        self.assertEqual(response.status_code, 400)

    def test_returns_remaining_seconds(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        from django.utils import timezone as django_timezone
        from game_sessions.dynamodb.stage_progress import update_session_stage
        started_at = django_timezone.now()
        update_session_stage(
            room_code, stage4.id,
            current_presentation_team_id=team_a['team_id'],
            presentation_timestamps={str(team_a['team_id']): started_at.isoformat()},
        )
        client = APIClient()

        response = client.get(
            f'/api/sessions/session-stages/{stage4.id}/presentation_timer/',
            {'game_session': room_code}
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['timer_duration'], 90)
        self.assertFalse(response.data['is_finished'])
        self.assertLessEqual(response.data['remaining_seconds'], 90)


# ---------------------------------------------------------------------------
# mark_presentation_done (tablets, no auth) -- touches TeamActivityProgress
# ---------------------------------------------------------------------------

class MarkPresentationDoneTest(SessionStageFlowTestCase):
    def test_rejects_wrong_turn(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        team_b = create_team(room_code, 'Equipo B', 'Rojo')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(room_code, stage4.id, current_presentation_team_id=team_a['team_id'])
        client = APIClient()

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/mark_presentation_done/',
            {
                'game_session': room_code,
                'team_id': team_b['team_id'],
                'activity_id': activities['presentacion'].id,
            }, format='json'
        )

        self.assertEqual(response.status_code, 400)

    def test_marks_new_progress_as_completed(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(room_code, stage4.id, current_presentation_team_id=team_a['team_id'])
        client = APIClient()

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/mark_presentation_done/',
            {
                'game_session': room_code,
                'team_id': team_a['team_id'],
                'activity_id': activities['presentacion'].id,
            }, format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'completed')
        self.assertEqual(response.data['progress_percentage'], 100)

        stored = get_progress(room_code, team_a['team_id'], activities['presentacion'].id)
        self.assertEqual(stored['status'], 'completed')
        self.assertIsNotNone(stored['started_at'])
        self.assertIsNotNone(stored['completed_at'])

    def test_preserves_existing_started_at_and_unrelated_fields(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(room_code, stage4.id, current_presentation_team_id=team_a['team_id'])
        upsert_progress(
            room_code, team_a['team_id'], activities['presentacion'].id,
            status='in_progress', started_at='2026-01-01T00:00:00+00:00',
            response_data={'note': 'keep me'},
        )
        client = APIClient()

        response = client.post(
            f'/api/sessions/session-stages/{stage4.id}/mark_presentation_done/',
            {
                'game_session': room_code,
                'team_id': team_a['team_id'],
                'activity_id': activities['presentacion'].id,
            }, format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        stored = get_progress(room_code, team_a['team_id'], activities['presentacion'].id)
        self.assertEqual(stored['started_at'], '2026-01-01T00:00:00+00:00')
        self.assertEqual(stored['response_data'], {'note': 'keep me'})
        self.assertEqual(stored['status'], 'completed')


# ---------------------------------------------------------------------------
# presentation_evaluation_progress (tablets, no auth)
# ---------------------------------------------------------------------------

class PresentationEvaluationProgressTest(SessionStageFlowTestCase):
    def test_counts_evaluations_for_presenting_team(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        team_b = create_team(room_code, 'Equipo B', 'Rojo')
        team_c = create_team(room_code, 'Equipo C', 'Verde')
        create_peer_evaluation(room_code, team_b['team_id'], team_a['team_id'], {'x': 5}, 5)
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(room_code, stage4.id, current_presentation_team_id=team_a['team_id'])
        client = APIClient()

        response = client.get(
            f'/api/sessions/session-stages/{stage4.id}/presentation_evaluation_progress/',
            {'game_session': room_code}
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['completed'], 1)
        self.assertEqual(response.data['total'], 2)  # team_b + team_c, excludes team_a itself
        self.assertEqual(response.data['presenting_team_id'], team_a['team_id'])

    def test_requires_current_presenting_team(self):
        prof, room_code, stage3, stage4, activities = self.make_room_with_stage4()
        client = APIClient()

        response = client.get(
            f'/api/sessions/session-stages/{stage4.id}/presentation_evaluation_progress/',
            {'game_session': room_code}
        )

        self.assertEqual(response.status_code, 400)
