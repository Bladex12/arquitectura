"""Tests for GameSessionViewSet's CRUD + Excel-import actions, ported from
the ORM to DynamoDB in Task 10 (see .superpowers/sdd/task-10-brief.md).

Django TestCase (real MySQL-backed Professor/Course/Student fixtures)
composed with a manually-managed moto mock (DynamoDB session/team data),
mirroring the pattern in users/test_get_unique_students_count.py and
game_sessions/test_cancel_expired_sessions.py. Hits the real viewset
through the URL router via DRF's APIClient, matching game_sessions/tests.py.
"""
import io
import os
import uuid

import pandas as pd
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from moto import mock_aws
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from academic.models import Career, Course, Faculty
from game_sessions.dynamodb.catalog import create_session_group, get_session_group
from game_sessions.dynamodb.game_session import create_session, get_session, update_session_status
from game_sessions.dynamodb.team import list_teams
from game_sessions.dynamodb.testing import create_test_table
from users.models import Administrator, Professor


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


def make_excel_file(num_students, filename='students.xlsx'):
    """Builds an in-memory .xlsx upload matching create_with_excel's
    required columns (Correo, RUT, Nombre, Apellido Paterno, Apellido
    Materno), each row a distinct student."""
    rows = []
    for i in range(num_students):
        suffix = uuid.uuid4().hex[:8]
        rows.append({
            'Correo': f'student{i}_{suffix}@example.com',
            'RUT': f'{10000000 + i}-{i % 10}',
            'Nombre': f'Nombre{i}',
            'Apellido Paterno': f'ApellidoP{i}',
            'Apellido Materno': f'ApellidoM{i}',
        })
    df = pd.DataFrame(rows)
    buffer = io.BytesIO()
    df.to_excel(buffer, index=False)
    buffer.seek(0)
    return SimpleUploadedFile(
        filename,
        buffer.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )


class GameSessionViewSetTestCase(TestCase):
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


class ListScopingTest(GameSessionViewSetTestCase):
    def test_professor_sees_only_own_sessions_by_default(self):
        prof_a = make_professor('profa')
        prof_b = make_professor('profb')
        course = make_course()
        create_session('ROOMA', professor_id=prof_a.id, course_id=course.id)
        create_session('ROOMB', professor_id=prof_b.id, course_id=course.id)

        response = make_client_for(prof_a.user).get('/api/sessions/game-sessions/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual({s['room_code'] for s in response.data}, {'ROOMA'})

    def test_admin_view_shows_all_sessions_when_also_administrator(self):
        prof_a = make_professor('profa')
        prof_b = make_professor('profb')
        Administrator.objects.create(user=prof_a.user)
        course = make_course()
        create_session('ROOMA', professor_id=prof_a.id, course_id=course.id)
        create_session('ROOMB', professor_id=prof_b.id, course_id=course.id)

        response = make_client_for(prof_a.user).get('/api/sessions/game-sessions/?admin_view=true')

        self.assertEqual(response.status_code, 200)
        self.assertEqual({s['room_code'] for s in response.data}, {'ROOMA', 'ROOMB'})

    def test_admin_view_ignored_for_non_administrator_professor(self):
        prof_a = make_professor('profa')
        prof_b = make_professor('profb')
        course = make_course()
        create_session('ROOMA', professor_id=prof_a.id, course_id=course.id)
        create_session('ROOMB', professor_id=prof_b.id, course_id=course.id)

        # prof_a requests admin_view but is not an Administrator -- must
        # stay scoped to their own sessions, exactly like the old
        # get_queryset()'s `if admin_view and is_administrator` branch.
        response = make_client_for(prof_a.user).get('/api/sessions/game-sessions/?admin_view=true')

        self.assertEqual(response.status_code, 200)
        self.assertEqual({s['room_code'] for s in response.data}, {'ROOMA'})

    def test_administrator_only_user_sees_all_sessions(self):
        prof_a = make_professor('profa')
        prof_b = make_professor('profb')
        admin_user = User.objects.create_user(username=f'admin_{uuid.uuid4().hex[:8]}', password='pass')
        Administrator.objects.create(user=admin_user)
        course = make_course()
        create_session('ROOMA', professor_id=prof_a.id, course_id=course.id)
        create_session('ROOMB', professor_id=prof_b.id, course_id=course.id)

        response = make_client_for(admin_user).get('/api/sessions/game-sessions/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual({s['room_code'] for s in response.data}, {'ROOMA', 'ROOMB'})

    def test_status_query_param_filters_within_scope(self):
        prof_a = make_professor('profa')
        course = make_course()
        create_session('ROOMA', professor_id=prof_a.id, course_id=course.id)
        create_session('ROOMB', professor_id=prof_a.id, course_id=course.id)
        update_session_status('ROOMB', expected_status='lobby', new_status='running')

        response = make_client_for(prof_a.user).get('/api/sessions/game-sessions/?status=running')

        self.assertEqual(response.status_code, 200)
        self.assertEqual({s['room_code'] for s in response.data}, {'ROOMB'})

    def test_display_fields_annotated_and_batched(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMC', professor_id=prof.id, course_id=course.id)

        response = make_client_for(prof.user).get('/api/sessions/game-sessions/')

        self.assertEqual(response.status_code, 200)
        session_data = response.data[0]
        expected_name = prof.user.get_full_name() or prof.user.username
        self.assertEqual(session_data['professor_name'], expected_name)
        self.assertEqual(session_data['course_name'], course.name)
        self.assertEqual(session_data['teams_count'], 0)


class RetrieveTest(GameSessionViewSetTestCase):
    def test_retrieve_unknown_room_code_404s(self):
        response = APIClient().get('/api/sessions/game-sessions/UNKNOWN/')
        self.assertEqual(response.status_code, 404)

    def test_retrieve_known_room_code_returns_annotated_session(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMX', professor_id=prof.id, course_id=course.id)

        response = APIClient().get('/api/sessions/game-sessions/ROOMX/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['room_code'], 'ROOMX')
        self.assertEqual(response.data['id'], 'ROOMX')
        self.assertEqual(response.data['status'], 'lobby')
        self.assertEqual(response.data['teams_count'], 0)
        self.assertEqual(response.data['course_name'], course.name)


class CreateTest(GameSessionViewSetTestCase):
    def test_create_session(self):
        prof = make_professor()
        course = make_course()
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/', {
            'professor': prof.id,
            'course': course.id,
            'room_code': 'NEWROOM',
        }, format='multipart')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNotNone(get_session('NEWROOM'))
        self.assertEqual(response.data['room_code'], 'NEWROOM')
        self.assertEqual(response.data['status'], 'lobby')

    def test_create_duplicate_room_code_fails(self):
        prof = make_professor()
        course = make_course()
        create_session('DUPLI', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/game-sessions/', {
            'professor': prof.id,
            'course': course.id,
            'room_code': 'DUPLI',
        }, format='multipart')

        self.assertEqual(response.status_code, 400)


class UpdateTest(GameSessionViewSetTestCase):
    def test_partial_update_status_transitions_and_resyncs_gsi(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMU', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.patch('/api/sessions/game-sessions/ROOMU/', {'status': 'running'}, format='multipart')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'running')
        self.assertEqual(get_session('ROOMU')['status'], 'running')
        # GSI1SK re-synced by update_session_status (not a raw update_session
        # field write) -- shows up correctly under the status filter now.
        list_response = client.get('/api/sessions/game-sessions/?status=running')
        self.assertIn('ROOMU', {s['room_code'] for s in list_response.data})

    def test_partial_update_plain_field(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMV', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.patch(
            '/api/sessions/game-sessions/ROOMV/',
            {'cancellation_reason': 'test_reason'},
            format='multipart',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(get_session('ROOMV')['cancellation_reason'], 'test_reason')

    def test_partial_update_unknown_room_code_404s(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.patch(
            '/api/sessions/game-sessions/UNKNOWN/', {'cancellation_reason': 'x'}, format='multipart'
        )

        self.assertEqual(response.status_code, 404)


class DestroyTest(GameSessionViewSetTestCase):
    def test_destroy_deletes_session_without_group(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMD', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.delete('/api/sessions/game-sessions/ROOMD/')

        self.assertEqual(response.status_code, 204)
        self.assertIsNone(get_session('ROOMD'))

    def test_destroy_unknown_room_code_404s(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.delete('/api/sessions/game-sessions/UNKNOWN/')

        self.assertEqual(response.status_code, 404)

    def test_destroy_last_session_in_group_deletes_group(self):
        prof = make_professor()
        course = make_course()
        group = create_session_group(
            professor_id=prof.id, course_id=course.id, total_students=10, number_of_sessions=1,
        )
        create_session(
            'ROOMLAST', professor_id=prof.id, course_id=course.id,
            session_group_id=group['session_group_id'],
        )
        client = make_client_for(prof.user)

        response = client.delete('/api/sessions/game-sessions/ROOMLAST/')

        self.assertEqual(response.status_code, 204)
        self.assertIsNone(get_session('ROOMLAST'))
        self.assertIsNone(get_session_group(group['session_group_id']))

    def test_destroy_one_of_two_sessions_in_group_keeps_group(self):
        prof = make_professor()
        course = make_course()
        group = create_session_group(
            professor_id=prof.id, course_id=course.id, total_students=10, number_of_sessions=2,
        )
        create_session(
            'ROOMONE', professor_id=prof.id, course_id=course.id,
            session_group_id=group['session_group_id'],
        )
        create_session(
            'ROOMTWO', professor_id=prof.id, course_id=course.id,
            session_group_id=group['session_group_id'],
        )
        client = make_client_for(prof.user)

        response = client.delete('/api/sessions/game-sessions/ROOMONE/')

        self.assertEqual(response.status_code, 204)
        self.assertIsNone(get_session('ROOMONE'))
        self.assertIsNotNone(get_session('ROOMTWO'))
        self.assertIsNotNone(get_session_group(group['session_group_id']))


class CreateWithExcelTest(GameSessionViewSetTestCase):
    def test_single_session_produces_balanced_teams_and_full_roster(self):
        prof = make_professor()
        course = make_course()
        client = make_client_for(prof.user)
        excel_file = make_excel_file(20)

        response = client.post('/api/sessions/game-sessions/create_with_excel/', {
            'course_id': course.id,
            'file': excel_file,
            'number_of_sessions': 1,
        }, format='multipart')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['students_processed'], 20)

        room_code = response.data['game_session']['room_code']
        self.assertIsNotNone(get_session(room_code))

        teams = list_teams(room_code)
        self.assertEqual(len(teams), response.data['teams_created'])
        self.assertEqual(sum(len(t['student_ids']) for t in teams), 20)
        for t in teams:
            self.assertGreaterEqual(len(t['student_ids']), 3)
            self.assertLessEqual(len(t['student_ids']), 8)
        # No duplicate students across teams.
        all_student_ids = [sid for t in teams for sid in t['student_ids']]
        self.assertEqual(len(all_student_ids), len(set(all_student_ids)))

    def test_multiple_sessions_creates_session_group_and_splits_students(self):
        prof = make_professor()
        course = make_course()
        client = make_client_for(prof.user)
        excel_file = make_excel_file(40)

        response = client.post('/api/sessions/game-sessions/create_with_excel/', {
            'course_id': course.id,
            'file': excel_file,
            'number_of_sessions': 2,
        }, format='multipart')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data['game_sessions']), 2)
        self.assertEqual(response.data['total_students'], 40)
        self.assertIn('session_group_id', response.data)

        total_teams = 0
        total_rostered = 0
        for session_data in response.data['game_sessions']:
            room_code = session_data['room_code']
            session_item = get_session(room_code)
            self.assertIsNotNone(session_item)
            self.assertEqual(session_item['session_group_id'], response.data['session_group_id'])
            teams = list_teams(room_code)
            total_teams += len(teams)
            for t in teams:
                self.assertGreaterEqual(len(t['student_ids']), 3)
                self.assertLessEqual(len(t['student_ids']), 8)
                total_rostered += len(t['student_ids'])

        self.assertEqual(total_teams, response.data['total_teams_created'])
        self.assertEqual(total_rostered, 40)

    def test_blocks_when_professor_has_active_ungrouped_session(self):
        prof = make_professor()
        course = make_course()
        create_session('ACTIVE1', professor_id=prof.id, course_id=course.id)  # defaults to 'lobby'
        client = make_client_for(prof.user)
        excel_file = make_excel_file(20)

        response = client.post('/api/sessions/game-sessions/create_with_excel/', {
            'course_id': course.id,
            'file': excel_file,
            'number_of_sessions': 1,
        }, format='multipart')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['active_sessions'], [{'id': 'ACTIVE1', 'room_code': 'ACTIVE1'}])

    def test_qr_code_persisted_on_created_session(self):
        prof = make_professor()
        course = make_course()
        client = make_client_for(prof.user)
        excel_file = make_excel_file(10)

        response = client.post('/api/sessions/game-sessions/create_with_excel/', {
            'course_id': course.id,
            'file': excel_file,
            'number_of_sessions': 1,
        }, format='multipart')

        self.assertEqual(response.status_code, 201, response.data)
        room_code = response.data['game_session']['room_code']
        session_item = get_session(room_code)
        self.assertIsNotNone(session_item['qr_code'])
        self.assertTrue(session_item['qr_code'].startswith('data:image/png;base64,'))
