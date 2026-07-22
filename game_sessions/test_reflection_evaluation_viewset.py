"""Tests for ReflectionEvaluationViewSet -- ported from the ORM to
DynamoDB in Task 20 (see .superpowers/sdd/task-20-brief.md), the last
viewset task in game_sessions/views.py.

Hybrid Django TestCase (real MySQL-backed Professor/Course fixtures)
composed with a manually-managed moto mock (DynamoDB session/team/
reflection data) pattern, same as test_peer_evaluation_viewset.py (Task
19). Hits the real viewset through the URL router via DRF's APIClient.

No token-award logic exists on this entity (verified against the ORM
version), so there's no cross-team-collision regression test here the way
Tasks 15/16/18/19 each needed for their own token-award call sites.
"""
import os
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from moto import mock_aws
from rest_framework.test import APIClient

from academic.models import Career, Course, Faculty
from game_sessions.dynamodb.evaluations import get_reflection, list_reflections
from game_sessions.dynamodb.game_session import create_session
from game_sessions.dynamodb.team import create_team
from game_sessions.dynamodb.testing import create_test_table
from users.models import Professor


def make_professor(prefix='prof'):
    user = User.objects.create_user(username=f'{prefix}_{uuid.uuid4().hex[:8]}', password='pass')
    return Professor.objects.create(user=user)


def make_course():
    suffix = uuid.uuid4().hex[:8]
    faculty = Faculty.objects.create(name=f'Faculty {suffix}')
    career = Career.objects.create(name=f'Career {suffix}', faculty=faculty)
    return Course.objects.create(name=f'Course {suffix}', career=career)


class ReflectionEvaluationTestCase(TestCase):
    """Base class: starts a moto mock and creates the GameSessionTable
    schema before each test, alongside real Django ORM fixtures."""

    def setUp(self):
        self.mock = mock_aws()
        self.mock.start()
        os.environ['GAME_SESSIONS_TABLE'] = 'test-game-sessions'
        os.environ['AWS_REGION'] = 'us-east-1'
        create_test_table('test-game-sessions')
        self.client = APIClient()

    def tearDown(self):
        self.mock.stop()

    def make_room(self, room_code='ROOM1'):
        prof = make_professor()
        course = make_course()
        create_session(room_code, professor_id=prof.id, course_id=course.id)
        return prof, room_code


# ---------------------------------------------------------------------------
# create -- validation
# ---------------------------------------------------------------------------

class ReflectionEvaluationCreateValidationTest(ReflectionEvaluationTestCase):
    def test_requires_room_code(self):
        response = self.client.post('/api/sessions/reflection-evaluations/', {
            'student_name': 'Ana', 'student_email': 'ana@udd.cl',
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_unknown_room_code_returns_404(self):
        response = self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': 'NOPE', 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_requires_student_name_and_email(self):
        prof, room_code = self.make_room()

        response = self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code,
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_no_auth_required(self):
        prof, room_code = self.make_room()
        self.client.force_authenticate(user=None)

        response = self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)


# ---------------------------------------------------------------------------
# create -- happy path + id
# ---------------------------------------------------------------------------

class ReflectionEvaluationCreateTest(ReflectionEvaluationTestCase):
    def test_creates_evaluation_with_url_safe_id(self):
        prof, room_code = self.make_room()

        response = self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana Perez', 'student_email': 'ana@udd.cl',
            'faculty': 'Ingenieria', 'career': 'Civil', 'value_areas': ['empatizar'],
            'satisfaction': 'mucho', 'entrepreneurship_interest': 'me_encantaria',
            'comments': 'Genial',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn('#', response.data['id'])
        self.assertEqual(response.data['game_session'], room_code)
        self.assertEqual(response.data['student_name'], 'Ana Perez')
        self.assertEqual(response.data['value_areas'], ['empatizar'])

        stored = get_reflection(room_code, response.data['id'])
        self.assertIsNotNone(stored)
        self.assertEqual(stored['student_email'], 'ana@udd.cl')

    def test_resubmitting_same_email_updates_instead_of_duplicating(self):
        prof, room_code = self.make_room()

        first = self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
            'satisfaction': 'si',
        }, format='json')
        second = self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
            'satisfaction': 'mucho', 'comments': 'Mejor de lo esperado',
        }, format='json')

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(second.data['id'], first.data['id'])
        self.assertEqual(second.data['satisfaction'], 'mucho')
        self.assertEqual(second.data['comments'], 'Mejor de lo esperado')
        self.assertIn('message', second.data)

        self.assertEqual(len(list_reflections(room_code)), 1)

    def test_resubmitting_preserves_fields_not_sent_again(self):
        """Mirrors the ORM's partial=True update -- a re-submission that
        only sends `satisfaction` must not blank out `faculty`/`career`
        from the first submission."""
        prof, room_code = self.make_room()

        self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
            'faculty': 'Ingenieria', 'career': 'Civil',
        }, format='json')

        second = self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
            'satisfaction': 'mucho',
        }, format='json')

        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(second.data['faculty'], 'Ingenieria')
        self.assertEqual(second.data['career'], 'Civil')
        self.assertEqual(second.data['satisfaction'], 'mucho')

    def test_different_students_do_not_collide(self):
        prof, room_code = self.make_room()

        self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
        }, format='json')
        self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Bob', 'student_email': 'bob@udd.cl',
        }, format='json')

        self.assertEqual(len(list_reflections(room_code)), 2)


# ---------------------------------------------------------------------------
# by_room -- live frontend call shape
# ---------------------------------------------------------------------------

class ReflectionEvaluationByRoomTest(ReflectionEvaluationTestCase):
    def test_requires_room_code(self):
        response = self.client.get('/api/sessions/reflection-evaluations/by_room/')

        self.assertEqual(response.status_code, 400)

    def test_unknown_room_code_returns_404(self):
        response = self.client.get(
            '/api/sessions/reflection-evaluations/by_room/', {'room_code': 'NOPE'}
        )

        self.assertEqual(response.status_code, 404)

    def test_counts_and_results_no_auth_required(self):
        prof, room_code = self.make_room()
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        team_b = create_team(room_code, 'Equipo B', 'Rojo')
        from game_sessions.dynamodb.team import set_roster
        set_roster(room_code, team_a['team_id'], ['student-1', 'student-2'])
        set_roster(room_code, team_b['team_id'], ['student-3'])

        self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
        }, format='json')
        self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Bob', 'student_email': 'bob@udd.cl',
        }, format='json')
        # A duplicate response from the same student (same email) must not
        # inflate unique_students_responded.
        self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
            'satisfaction': 'mucho',
        }, format='json')
        self.client.force_authenticate(user=None)

        response = self.client.get(
            '/api/sessions/reflection-evaluations/by_room/', {'room_code': room_code}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(response.data['total_evaluations'], 2)
        self.assertEqual(response.data['total_students'], 3)
        self.assertEqual(len(response.data['results']), 2)

    def test_no_reflections_returns_zero_counts(self):
        prof, room_code = self.make_room()

        response = self.client.get(
            '/api/sessions/reflection-evaluations/by_room/', {'room_code': room_code}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['total_evaluations'], 0)
        self.assertEqual(response.data['total_students'], 0)
        self.assertEqual(response.data['results'], [])


# ---------------------------------------------------------------------------
# list / retrieve -- ported for completeness (no live frontend caller)
# ---------------------------------------------------------------------------

class ReflectionEvaluationListRetrieveTest(ReflectionEvaluationTestCase):
    def test_list_filters_by_room_code(self):
        prof, room_code = self.make_room()
        prof2, room_code2 = self.make_room('ROOM2')
        self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
        }, format='json')
        self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code2, 'student_name': 'Zoe', 'student_email': 'zoe@udd.cl',
        }, format='json')

        response = self.client.get('/api/sessions/reflection-evaluations/', {'room_code': room_code})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['student_email'], 'ana@udd.cl')

    def test_list_without_room_code_returns_every_room(self):
        prof, room_code = self.make_room()
        prof2, room_code2 = self.make_room('ROOM2')
        self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
        }, format='json')
        self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code2, 'student_name': 'Zoe', 'student_email': 'zoe@udd.cl',
        }, format='json')

        response = self.client.get('/api/sessions/reflection-evaluations/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_retrieve_by_id_with_room_code(self):
        prof, room_code = self.make_room()
        created = self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
        }, format='json')
        pk = created.data['id']

        response = self.client.get(
            f'/api/sessions/reflection-evaluations/{pk}/', {'room_code': room_code}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], pk)

    def test_retrieve_by_id_without_room_code_falls_back_to_scan(self):
        prof, room_code = self.make_room()
        created = self.client.post('/api/sessions/reflection-evaluations/', {
            'room_code': room_code, 'student_name': 'Ana', 'student_email': 'ana@udd.cl',
        }, format='json')
        pk = created.data['id']

        response = self.client.get(f'/api/sessions/reflection-evaluations/{pk}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], pk)

    def test_retrieve_unknown_returns_404(self):
        prof, room_code = self.make_room()

        response = self.client.get(
            '/api/sessions/reflection-evaluations/not-a-real-id/', {'room_code': room_code}
        )

        self.assertEqual(response.status_code, 404)
