"""Tests for TabletViewSet + TabletConnectionViewSet, ported from the ORM
to DynamoDB in Task 17 (see .superpowers/sdd/task-17-brief.md).

Sibling to test_team_viewset.py (Task 13) / test_team_activity_progress_viewset.py
(Task 15/16): same hybrid Django TestCase (real MySQL-backed Professor/Course
fixtures) composed with a manually-managed moto mock (DynamoDB session/team/
tablet-connection data) pattern. Hits the real viewsets through the URL
router via DRF's APIClient.
"""
import os
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from moto import mock_aws
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from academic.models import Career, Course, Faculty
from game_sessions.dynamodb.game_session import create_session, update_session_status
from game_sessions.dynamodb.tablet_connection import create_connection, disconnect, get_connection
from game_sessions.dynamodb.team import create_team, get_team
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


class TabletViewSetTestCase(TestCase):
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

    def make_room_with_team(self, room_code='ROOM1', team_name='Equipo A'):
        prof = make_professor()
        course = make_course()
        create_session(room_code, professor_id=prof.id, course_id=course.id)
        team = create_team(room_code, team_name, 'Azul')
        return prof, room_code, team


# ---------------------------------------------------------------------------
# TabletViewSet: list / retrieve / create / partial_update / destroy
# ---------------------------------------------------------------------------

class TabletCatalogCrudTest(TabletViewSetTestCase):
    def test_create_tablet(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.post('/api/sessions/tablets/', {'tablet_code': 'TAB-001'}, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['tablet_code'], 'TAB-001')
        self.assertEqual(response.data['id'], 'TAB-001')
        self.assertTrue(response.data['is_active'])

    def test_create_tablet_duplicate_code_rejected(self):
        prof = make_professor()
        client = make_client_for(prof.user)
        client.post('/api/sessions/tablets/', {'tablet_code': 'TAB-002'}, format='json')

        response = client.post('/api/sessions/tablets/', {'tablet_code': 'TAB-002'}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_list_tablets(self):
        prof = make_professor()
        client = make_client_for(prof.user)
        client.post('/api/sessions/tablets/', {'tablet_code': 'TAB-010'}, format='json')
        client.post('/api/sessions/tablets/', {'tablet_code': 'TAB-011'}, format='json')

        response = client.get('/api/sessions/tablets/')

        self.assertEqual(response.status_code, 200)
        codes = {t['tablet_code'] for t in response.data}
        self.assertEqual(codes, {'TAB-010', 'TAB-011'})

    def test_list_tablets_filters_is_active(self):
        prof = make_professor()
        client = make_client_for(prof.user)
        client.post('/api/sessions/tablets/', {'tablet_code': 'TAB-020'}, format='json')
        client.post('/api/sessions/tablets/', {'tablet_code': 'TAB-021'}, format='json')
        client.patch('/api/sessions/tablets/TAB-021/', {'is_active': False}, format='json')

        response = client.get('/api/sessions/tablets/?is_active=true')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([t['tablet_code'] for t in response.data], ['TAB-020'])

    def test_retrieve_tablet(self):
        prof = make_professor()
        client = make_client_for(prof.user)
        client.post('/api/sessions/tablets/', {'tablet_code': 'TAB-030'}, format='json')

        response = client.get('/api/sessions/tablets/TAB-030/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['tablet_code'], 'TAB-030')

    def test_retrieve_tablet_not_found(self):
        prof = make_professor()
        client = make_client_for(prof.user)

        response = client.get('/api/sessions/tablets/NOPE/')

        self.assertEqual(response.status_code, 404)

    def test_partial_update_deactivates_tablet(self):
        prof = make_professor()
        client = make_client_for(prof.user)
        client.post('/api/sessions/tablets/', {'tablet_code': 'TAB-040'}, format='json')

        response = client.patch('/api/sessions/tablets/TAB-040/', {'is_active': False}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['is_active'])

    def test_destroy_tablet(self):
        prof = make_professor()
        client = make_client_for(prof.user)
        client.post('/api/sessions/tablets/', {'tablet_code': 'TAB-050'}, format='json')

        response = client.delete('/api/sessions/tablets/TAB-050/')

        self.assertEqual(response.status_code, 204)
        self.assertEqual(client.get('/api/sessions/tablets/TAB-050/').status_code, 404)

    def test_requires_authentication(self):
        client = APIClient()

        response = client.get('/api/sessions/tablets/')

        self.assertEqual(response.status_code, 401)


# ---------------------------------------------------------------------------
# TabletConnectionViewSet: connect
# ---------------------------------------------------------------------------

class ConnectTest(TabletViewSetTestCase):
    def test_connect_assigns_first_available_team(self):
        prof, room_code, team = self.make_room_with_team('ROOMA')
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/connect/', {
            'room_code': room_code,
            'team_name': 'Los Innovadores',
            'team_color': 'Rojo',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['team']['id'], team['team_id'])
        self.assertEqual(response.data['team']['name'], 'Los Innovadores')
        self.assertEqual(response.data['team']['color'], 'Rojo')
        self.assertEqual(response.data['game_session']['room_code'], room_code)
        self.assertIn('team_session_token', response.data)
        self.assertEqual(response.data['connection']['team'], team['team_id'])

    def test_connect_skips_team_with_active_connection(self):
        prof, room_code, team1 = self.make_room_with_team('ROOMB', 'Team1')
        team2 = create_team(room_code, 'Team2', 'Verde')
        create_connection(room_code, team1['team_id'])
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/connect/', {
            'room_code': room_code,
            'team_name': 'Segundo Equipo',
            'team_color': 'Verde',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['team']['id'], team2['team_id'])

    def test_connect_rejects_missing_fields(self):
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/connect/', {
            'room_code': 'ROOMC',
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_connect_rejects_short_team_name(self):
        prof, room_code, team = self.make_room_with_team('ROOMD')
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/connect/', {
            'room_code': room_code,
            'team_name': 'A',
            'team_color': 'Rojo',
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_connect_rejects_invalid_room_code(self):
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/connect/', {
            'room_code': 'NOPE99',
            'team_name': 'Equipo',
            'team_color': 'Rojo',
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_connect_rejects_when_session_running(self):
        prof, room_code, team = self.make_room_with_team('ROOME')
        update_session_status(room_code, 'lobby', 'running')
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/connect/', {
            'room_code': room_code,
            'team_name': 'Equipo',
            'team_color': 'Rojo',
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_connect_rejects_when_session_ended(self):
        prof, room_code, team = self.make_room_with_team('ROOMF')
        update_session_status(room_code, 'lobby', 'completed')
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/connect/', {
            'room_code': room_code,
            'team_name': 'Equipo',
            'team_color': 'Rojo',
        }, format='json')

        self.assertEqual(response.status_code, 403)

    def test_connect_rejects_when_all_teams_connected(self):
        prof, room_code, team = self.make_room_with_team('ROOMG')
        create_connection(room_code, team['team_id'])
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/connect/', {
            'room_code': room_code,
            'team_name': 'Equipo',
            'team_color': 'Rojo',
        }, format='json')

        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# TabletConnectionViewSet: reconnect
# ---------------------------------------------------------------------------

class ReconnectTest(TabletViewSetTestCase):
    def test_reconnect_with_token_alone_no_room_code_needed(self):
        prof, room_code, team = self.make_room_with_team('ROOMH')
        connection = create_connection(room_code, team['team_id'])
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/reconnect/', {
            'team_session_token': connection['team_session_token'],
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['game_session']['room_code'], room_code)
        self.assertEqual(response.data['team']['id'], team['team_id'])

    def test_reconnect_reactivates_disconnected_connection(self):
        prof, room_code, team = self.make_room_with_team('ROOMI')
        connection = create_connection(room_code, team['team_id'])
        disconnect(room_code, connection['team_session_token'])
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/reconnect/', {
            'team_session_token': connection['team_session_token'],
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(get_connection(room_code, connection['team_session_token'])['disconnected_at'])

    def test_reconnect_invalid_token_404(self):
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/reconnect/', {
            'team_session_token': 'nonexistent-token',
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_reconnect_missing_token_400(self):
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/reconnect/', {}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_reconnect_session_ended_403(self):
        prof, room_code, team = self.make_room_with_team('ROOMJ')
        connection = create_connection(room_code, team['team_id'])
        update_session_status(room_code, 'lobby', 'completed')
        client = APIClient()

        response = client.post('/api/sessions/tablet-connections/reconnect/', {
            'team_session_token': connection['team_session_token'],
        }, format='json')

        self.assertEqual(response.status_code, 403)


# ---------------------------------------------------------------------------
# TabletConnectionViewSet: update_screen
# ---------------------------------------------------------------------------

class UpdateScreenTest(TabletViewSetTestCase):
    def test_update_screen_without_room_code(self):
        prof, room_code, team = self.make_room_with_team('ROOMK')
        connection = create_connection(room_code, team['team_id'])
        client = APIClient()

        response = client.patch(
            f"/api/sessions/tablet-connections/{connection['team_session_token']}/update_screen/",
            {'screen': 'results_1'}, format='json'
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['current_screen'], 'results_1')
        self.assertEqual(
            get_connection(room_code, connection['team_session_token'])['current_screen'], 'results_1'
        )

    def test_update_screen_not_found(self):
        client = APIClient()

        response = client.patch(
            '/api/sessions/tablet-connections/nonexistent-token/update_screen/',
            {'screen': 'lobby'}, format='json'
        )

        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# TabletConnectionViewSet: disconnect
# ---------------------------------------------------------------------------

class DisconnectTest(TabletViewSetTestCase):
    def test_disconnect_marks_disconnected(self):
        prof, room_code, team = self.make_room_with_team('ROOML')
        connection = create_connection(room_code, team['team_id'])
        client = make_client_for(prof.user)

        response = client.post(
            f"/api/sessions/tablet-connections/{connection['team_session_token']}/disconnect/"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNotNone(get_connection(room_code, connection['team_session_token'])['disconnected_at'])

    def test_disconnect_already_disconnected_400(self):
        prof, room_code, team = self.make_room_with_team('ROOMM')
        connection = create_connection(room_code, team['team_id'])
        disconnect(room_code, connection['team_session_token'])
        client = make_client_for(prof.user)

        response = client.post(
            f"/api/sessions/tablet-connections/{connection['team_session_token']}/disconnect/"
        )

        self.assertEqual(response.status_code, 400)

    def test_disconnect_requires_auth(self):
        prof, room_code, team = self.make_room_with_team('ROOMN')
        connection = create_connection(room_code, team['team_id'])
        client = APIClient()

        response = client.post(
            f"/api/sessions/tablet-connections/{connection['team_session_token']}/disconnect/"
        )

        self.assertEqual(response.status_code, 401)


# ---------------------------------------------------------------------------
# TabletConnectionViewSet: by_team
# ---------------------------------------------------------------------------

class ByTeamTest(TabletViewSetTestCase):
    def test_by_team_filters_active_connections(self):
        prof, room_code, team1 = self.make_room_with_team('ROOMO', 'Team1')
        team2 = create_team(room_code, 'Team2', 'Verde')
        conn1 = create_connection(room_code, team1['team_id'])
        create_connection(room_code, team2['team_id'])
        disconnect(room_code, conn1['team_session_token'])
        client = make_client_for(prof.user)

        response = client.get(f'/api/sessions/tablet-connections/by_team/?game_session={room_code}')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['team'], team2['team_id'])

    def test_by_team_requires_room_code(self):
        client = make_client_for(make_professor().user)

        response = client.get('/api/sessions/tablet-connections/by_team/')

        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# TabletConnectionViewSet: status
# ---------------------------------------------------------------------------

class StatusTest(TabletViewSetTestCase):
    def test_status_returns_connection_team_and_session(self):
        prof, room_code, team = self.make_room_with_team('ROOMP')
        connection = create_connection(room_code, team['team_id'])
        client = APIClient()

        response = client.get(
            f"/api/sessions/tablet-connections/status/?connection_id={connection['team_session_token']}"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['team']['id'], team['team_id'])
        self.assertEqual(response.data['game_session']['room_code'], room_code)
        self.assertIsNone(response.data['personalization'])

    def test_status_includes_personalization_when_set(self):
        prof, room_code, team = self.make_room_with_team('ROOMQ')
        from game_sessions.dynamodb.team import update_team
        update_team(
            room_code, team['team_id'],
            personalization_team_name='Los Piratas',
            personalization_members_know_each_other=True,
        )
        connection = create_connection(room_code, team['team_id'])
        client = APIClient()

        response = client.get(
            f"/api/sessions/tablet-connections/status/?connection_id={connection['team_session_token']}"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['personalization']['team_members_know_each_other'], True)

    def test_status_missing_connection_id_400(self):
        client = APIClient()

        response = client.get('/api/sessions/tablet-connections/status/')

        self.assertEqual(response.status_code, 400)

    def test_status_connection_not_found_404(self):
        client = APIClient()

        response = client.get('/api/sessions/tablet-connections/status/?connection_id=nonexistent-token')

        self.assertEqual(response.status_code, 404)
