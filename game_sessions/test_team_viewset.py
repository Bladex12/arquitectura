"""Tests for TeamViewSet + TeamPersonalizationViewSet, ported from the ORM
to DynamoDB in Task 13 (see .superpowers/sdd/task-13-brief.md).

Django TestCase (real MySQL-backed Professor/Course/Student fixtures)
composed with a manually-managed moto mock (DynamoDB session/team data),
mirroring game_sessions/test_game_session_viewset.py's pattern.
"""
import os
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from moto import mock_aws
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from academic.models import Career, Course, Faculty
from game_sessions.dynamodb.game_session import create_session
from game_sessions.dynamodb.team import create_team, get_team, list_teams, scan_all_teams, set_roster
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
        full_name=f'{prefix} {suffix}',
        email=f'{prefix}_{suffix}@example.com',
        rut=f'{suffix}-K',
    )


class TeamViewSetTestCase(TestCase):
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


# ---------------------------------------------------------------------------
# TeamViewSet: list / retrieve / create / update / destroy
# ---------------------------------------------------------------------------

class TeamCrudTest(TeamViewSetTestCase):
    def test_create_team(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMA', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/teams/', {
            'game_session': 'ROOMA',
            'name': 'Equipo Uno',
            'color': 'Azul',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['name'], 'Equipo Uno')
        self.assertEqual(response.data['game_session'], 'ROOMA')
        team_id = response.data['id']
        self.assertIsNotNone(get_team('ROOMA', team_id))

    def test_create_team_with_student_ids_sets_roster(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMB', professor_id=prof.id, course_id=course.id)
        student = make_student()
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/teams/', {
            'game_session': 'ROOMB',
            'name': 'Equipo Dos',
            'color': 'Rojo',
            'student_ids': [student.id],
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['students_count'], 1)

    def test_create_team_rejects_unknown_student_id(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMB2', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/teams/', {
            'game_session': 'ROOMB2',
            'name': 'Equipo Dos',
            'color': 'Rojo',
            'student_ids': [999999],
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_list_scoped_by_game_session(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMC', professor_id=prof.id, course_id=course.id)
        create_session('ROOMD', professor_id=prof.id, course_id=course.id)
        create_team('ROOMC', name='C1', color='Azul')
        create_team('ROOMD', name='D1', color='Rojo')
        client = make_client_for(prof.user)

        response = client.get('/api/sessions/teams/?game_session=ROOMC')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([t['name'] for t in response.data], ['C1'])

    def test_list_unscoped_returns_all_teams(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOME', professor_id=prof.id, course_id=course.id)
        create_session('ROOMF', professor_id=prof.id, course_id=course.id)
        create_team('ROOME', name='E1', color='Azul')
        create_team('ROOMF', name='F1', color='Rojo')
        client = make_client_for(prof.user)

        response = client.get('/api/sessions/teams/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual({t['name'] for t in response.data}, {'E1', 'F1'})

    def test_retrieve_with_game_session_param(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMG', professor_id=prof.id, course_id=course.id)
        team = create_team('ROOMG', name='G1', color='Azul')
        client = make_client_for(prof.user)

        response = client.get(f"/api/sessions/teams/{team['team_id']}/?game_session=ROOMG")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'G1')

    def test_retrieve_without_game_session_falls_back_to_scan(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMH', professor_id=prof.id, course_id=course.id)
        team = create_team('ROOMH', name='H1', color='Azul')
        client = make_client_for(prof.user)

        response = client.get(f"/api/sessions/teams/{team['team_id']}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'H1')

    def test_retrieve_unknown_team_404s(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.get('/api/sessions/teams/does-not-exist/')

        self.assertEqual(response.status_code, 404)

    def test_partial_update_requires_game_session(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMI', professor_id=prof.id, course_id=course.id)
        team = create_team('ROOMI', name='I1', color='Azul')
        client = make_client_for(prof.user)

        response = client.patch(f"/api/sessions/teams/{team['team_id']}/", {'name': 'Renamed'}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_partial_update_renames_team(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMJ', professor_id=prof.id, course_id=course.id)
        team = create_team('ROOMJ', name='J1', color='Azul')
        client = make_client_for(prof.user)

        response = client.patch(
            f"/api/sessions/teams/{team['team_id']}/",
            {'name': 'Renamed', 'game_session': 'ROOMJ'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['name'], 'Renamed')
        self.assertEqual(get_team('ROOMJ', team['team_id'])['name'], 'Renamed')

    def test_destroy_removes_team(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMK', professor_id=prof.id, course_id=course.id)
        team = create_team('ROOMK', name='K1', color='Azul')
        client = make_client_for(prof.user)

        response = client.delete(f"/api/sessions/teams/{team['team_id']}/?game_session=ROOMK")

        self.assertEqual(response.status_code, 204)
        self.assertIsNone(get_team('ROOMK', team['team_id']))

    def test_destroy_requires_game_session(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOML', professor_id=prof.id, course_id=course.id)
        team = create_team('ROOML', name='L1', color='Azul')
        client = make_client_for(prof.user)

        response = client.delete(f"/api/sessions/teams/{team['team_id']}/")

        self.assertEqual(response.status_code, 400)
        self.assertIsNotNone(get_team('ROOML', team['team_id']))


# ---------------------------------------------------------------------------
# TeamViewSet.move_student
# ---------------------------------------------------------------------------

class MoveStudentTest(TeamViewSetTestCase):
    def _setup_two_teams(self, room_code):
        prof = make_professor()
        course = make_course()
        create_session(room_code, professor_id=prof.id, course_id=course.id)
        student_a = make_student('alice')
        student_b = make_student('bob')
        source = create_team(room_code, name='Source', color='Azul')
        target = create_team(room_code, name='Target', color='Rojo')
        set_roster(room_code, source['team_id'], [student_a.id, student_b.id])
        return prof, source, target, student_a, student_b

    def test_move_student_between_teams(self):
        prof, source, target, student_a, student_b = self._setup_two_teams('ROOMMS1')
        client = make_client_for(prof.user)

        response = client.post(f"/api/sessions/teams/{source['team_id']}/move_student/", {
            'game_session': 'ROOMMS1',
            'student_id': student_a.id,
            'target_team_id': target['team_id'],
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        source_after = get_team('ROOMMS1', source['team_id'])
        target_after = get_team('ROOMMS1', target['team_id'])
        self.assertEqual(source_after['student_ids'], [student_b.id])
        self.assertEqual(target_after['student_ids'], [student_a.id])
        self.assertEqual([s['id'] for s in response.data['source_team']['students']], [student_b.id])
        self.assertEqual([s['id'] for s in response.data['target_team']['students']], [student_a.id])

    def test_move_student_not_in_source_team_400(self):
        prof, source, target, student_a, student_b = self._setup_two_teams('ROOMMS2')
        stranger = make_student('stranger')
        client = make_client_for(prof.user)

        response = client.post(f"/api/sessions/teams/{source['team_id']}/move_student/", {
            'game_session': 'ROOMMS2',
            'student_id': stranger.id,
            'target_team_id': target['team_id'],
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_move_student_missing_fields_400(self):
        prof, source, target, student_a, student_b = self._setup_two_teams('ROOMMS3')
        client = make_client_for(prof.user)

        response = client.post(f"/api/sessions/teams/{source['team_id']}/move_student/", {
            'student_id': student_a.id,
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_move_student_unknown_target_team_404(self):
        prof, source, target, student_a, student_b = self._setup_two_teams('ROOMMS4')
        client = make_client_for(prof.user)

        response = client.post(f"/api/sessions/teams/{source['team_id']}/move_student/", {
            'game_session': 'ROOMMS4',
            'student_id': student_a.id,
            'target_team_id': 'does-not-exist',
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_move_student_target_in_different_session_404(self):
        prof, source, target, student_a, student_b = self._setup_two_teams('ROOMMS5')
        course = make_course()
        create_session('ROOMMS5-OTHER', professor_id=prof.id, course_id=course.id)
        other_team = create_team('ROOMMS5-OTHER', name='Other', color='Verde')
        client = make_client_for(prof.user)

        # target_team_id belongs to a different room than `game_session` --
        # get_team(room_code, target_team_id) can't find it there, so this
        # now surfaces as 404 rather than the old "misma sesión" 400.
        response = client.post(f"/api/sessions/teams/{source['team_id']}/move_student/", {
            'game_session': 'ROOMMS5',
            'student_id': student_a.id,
            'target_team_id': other_team['team_id'],
        }, format='json')

        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# TeamViewSet.shuffle_all
# ---------------------------------------------------------------------------

class ShuffleAllTest(TeamViewSetTestCase):
    def test_shuffle_all_redistributes_and_conserves_students(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMSH1', professor_id=prof.id, course_id=course.id)
        students = [make_student(f's{i}') for i in range(12)]
        team1 = create_team('ROOMSH1', name='T1', color='Azul')
        team2 = create_team('ROOMSH1', name='T2', color='Rojo')
        team3 = create_team('ROOMSH1', name='T3', color='Verde')
        set_roster('ROOMSH1', team1['team_id'], [s.id for s in students[0:4]])
        set_roster('ROOMSH1', team2['team_id'], [s.id for s in students[4:8]])
        set_roster('ROOMSH1', team3['team_id'], [s.id for s in students[8:12]])
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/teams/shuffle_all/', {'game_session': 'ROOMSH1'}, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        teams_after = list_teams('ROOMSH1')
        self.assertEqual(len(teams_after), 3)
        all_ids_after = []
        for team in teams_after:
            self.assertGreaterEqual(len(team['student_ids']), 3)
            self.assertLessEqual(len(team['student_ids']), 8)
            all_ids_after.extend(team['student_ids'])
        self.assertEqual(sorted(all_ids_after), sorted(s.id for s in students))

    def test_shuffle_all_uneven_distribution_matches_balancing_rule(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMSH2', professor_id=prof.id, course_id=course.id)
        # 10 students across 3 teams -> base=3, remainder=1: sizes [4, 3, 3]
        students = [make_student(f's{i}') for i in range(10)]
        team1 = create_team('ROOMSH2', name='T1', color='Azul')
        team2 = create_team('ROOMSH2', name='T2', color='Rojo')
        team3 = create_team('ROOMSH2', name='T3', color='Verde')
        set_roster('ROOMSH2', team1['team_id'], [s.id for s in students[0:4]])
        set_roster('ROOMSH2', team2['team_id'], [s.id for s in students[4:7]])
        set_roster('ROOMSH2', team3['team_id'], [s.id for s in students[7:10]])
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/teams/shuffle_all/', {'game_session': 'ROOMSH2'}, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        sizes = sorted(t['students_count'] for t in response.data['teams'])
        self.assertEqual(sizes, [3, 3, 4])

    def test_shuffle_all_missing_game_session_400(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/teams/shuffle_all/', {}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_shuffle_all_unknown_session_404(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/teams/shuffle_all/', {'game_session': 'NOPE'}, format='json')

        self.assertEqual(response.status_code, 404)

    def test_shuffle_all_no_teams_400(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMSH3', professor_id=prof.id, course_id=course.id)
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/teams/shuffle_all/', {'game_session': 'ROOMSH3'}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_shuffle_all_no_students_400(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMSH4', professor_id=prof.id, course_id=course.id)
        create_team('ROOMSH4', name='Empty', color='Azul')
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/teams/shuffle_all/', {'game_session': 'ROOMSH4'}, format='json')

        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# TeamPersonalizationViewSet
# ---------------------------------------------------------------------------

class TeamPersonalizationCreateTest(TeamViewSetTestCase):
    def test_create_new_personalization_returns_201(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMTP1', professor_id=prof.id, course_id=course.id)
        team = create_team('ROOMTP1', name='TP1', color='Azul')
        client = APIClient()  # no auth needed -- tablets call this endpoint

        response = client.post('/api/sessions/team-personalizations/', {
            'room_code': 'ROOMTP1',
            'team': team['team_id'],
            'team_name': 'Los Ganadores',
            'team_members_know_each_other': True,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['team_name'], 'Los Ganadores')
        self.assertEqual(response.data['team_members_know_each_other'], True)
        stored = get_team('ROOMTP1', team['team_id'])
        self.assertEqual(stored['personalization_team_name'], 'Los Ganadores')
        self.assertEqual(stored['personalization_members_know_each_other'], True)

    def test_create_updates_existing_personalization_returns_200(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMTP2', professor_id=prof.id, course_id=course.id)
        team = create_team('ROOMTP2', name='TP2', color='Azul')
        client = APIClient()
        client.post('/api/sessions/team-personalizations/', {
            'room_code': 'ROOMTP2',
            'team': team['team_id'],
            'team_name': 'First Name',
            'team_members_know_each_other': False,
        }, format='json')

        response = client.post('/api/sessions/team-personalizations/', {
            'room_code': 'ROOMTP2',
            'team': team['team_id'],
            'team_name': 'Updated Name',
            'team_members_know_each_other': True,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['team_name'], 'Updated Name')
        stored = get_team('ROOMTP2', team['team_id'])
        self.assertEqual(stored['personalization_team_name'], 'Updated Name')
        self.assertEqual(stored['personalization_members_know_each_other'], True)

    def test_create_missing_team_404s(self):
        client = APIClient()

        response = client.post('/api/sessions/team-personalizations/', {
            'room_code': 'ROOMTP3',
            'team': 'does-not-exist',
            'team_name': 'X',
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_create_missing_room_code_400s(self):
        client = APIClient()

        response = client.post('/api/sessions/team-personalizations/', {
            'team': 'some-team-id',
            'team_name': 'X',
        }, format='json')

        self.assertEqual(response.status_code, 400)


class TeamPersonalizationListTest(TeamViewSetTestCase):
    def test_list_by_team_without_room_code_uses_scan_fallback(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMTP4', professor_id=prof.id, course_id=course.id)
        team = create_team('ROOMTP4', name='TP4', color='Azul')
        APIClient().post('/api/sessions/team-personalizations/', {
            'room_code': 'ROOMTP4',
            'team': team['team_id'],
            'team_name': 'Scanned',
            'team_members_know_each_other': True,
        }, format='json')
        client = APIClient()

        response = client.get(f"/api/sessions/team-personalizations/?team={team['team_id']}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['team_name'], 'Scanned')

    def test_list_scoped_by_room_code(self):
        prof = make_professor()
        course = make_course()
        create_session('ROOMTP5', professor_id=prof.id, course_id=course.id)
        create_team('ROOMTP5', name='TP5a', color='Azul')
        create_team('ROOMTP5', name='TP5b', color='Rojo')
        client = APIClient()

        response = client.get('/api/sessions/team-personalizations/?room_code=ROOMTP5')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
