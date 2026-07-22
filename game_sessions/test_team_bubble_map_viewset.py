"""Tests for TeamBubbleMapViewSet -- ported from Django ORM to DynamoDB
in Task 20 (see .superpowers/sdd/task-20-brief.md), the last viewset task
in game_sessions/views.py.

Hybrid Django TestCase (real MySQL-backed Professor/Course/Stage fixtures)
composed with a manually-managed moto mock (DynamoDB session/team/
session-stage/bubble-map/token-transaction data) pattern, same as
test_roulette_assignment_and_token_transaction_viewset.py (Task 18).
Hits the real viewset through the URL router via DRF's APIClient.

test_finalize_is_idempotent_and_never_double_awards is this task's
regression test for lesson #2 (verify token-award source_id is
team-scoped): source_id is f'{team_id}:{session_stage_id}', which is
naturally team-scoped since it's exactly bubble_map_sk's own composite
key (team_id leads). test_two_teams_finalizing_same_stage_both_get_
awarded_independently is the direct cross-team collision check mirroring
the pattern every other token-award viewset task required.
"""
import os
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from moto import mock_aws
from rest_framework.test import APIClient

from academic.models import Career, Course, Faculty
from challenges.models import Stage
from game_sessions.dynamodb.bubble_roulette import get_bubble_map
from game_sessions.dynamodb.game_session import create_session
from game_sessions.dynamodb.stage_progress import create_session_stage
from game_sessions.dynamodb.team import create_team, get_team
from game_sessions.dynamodb.testing import create_test_table
from game_sessions.dynamodb.token_transaction import list_transactions
from users.models import Professor


def make_professor(prefix='prof'):
    user = User.objects.create_user(username=f'{prefix}_{uuid.uuid4().hex[:8]}', password='pass')
    return Professor.objects.create(user=user)


def make_course():
    suffix = uuid.uuid4().hex[:8]
    faculty = Faculty.objects.create(name=f'Faculty {suffix}')
    career = Career.objects.create(name=f'Career {suffix}', faculty=faculty)
    return Course.objects.create(name=f'Course {suffix}', career=career)


class TeamBubbleMapTestCase(TestCase):
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
        stage = Stage.objects.create(number=2, name='Empatía', is_active=True)
        session_stage = create_session_stage(room_code, stage.id)
        team = create_team(room_code, 'Equipo A', 'Azul')
        return prof, room_code, stage, session_stage, team


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

class TeamBubbleMapCreateTest(TeamBubbleMapTestCase):
    def test_requires_fields(self):
        response = self.client.post('/api/sessions/team-bubble-maps/', {}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_unknown_team_returns_404(self):
        prof, room_code, stage, session_stage, team = self.make_room()

        response = self.client.post('/api/sessions/team-bubble-maps/', {
            'team': 'not-a-real-team', 'session_stage': stage.id,
            'map_data': {'nodes': [], 'edges': []},
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_unknown_session_stage_returns_404(self):
        prof, room_code, stage, session_stage, team = self.make_room()

        response = self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': 999999,
            'map_data': {'nodes': [], 'edges': []},
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_creates_bubble_map_with_colon_joined_id_no_auth_required(self):
        prof, room_code, stage, session_stage, team = self.make_room()
        self.client.force_authenticate(user=None)

        response = self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [{'id': 1, 'text': 'idea'}], 'edges': []},
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['id'], f"{team['team_id']}:{stage.id}")
        self.assertEqual(response.data['team'], team['team_id'])
        self.assertEqual(response.data['team_name'], 'Equipo A')
        self.assertEqual(response.data['map_data'], {'nodes': [{'id': 1, 'text': 'idea'}], 'edges': []})

        stored = get_bubble_map(room_code, team['team_id'], stage.id)
        self.assertIsNotNone(stored)

    def test_create_does_not_award_tokens_without_is_final(self):
        prof, room_code, stage, session_stage, team = self.make_room()

        self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [{'id': 1}, {'id': 2}], 'edges': []},
        }, format='json')

        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 0)
        self.assertEqual(list_transactions(room_code), [])

    def test_create_with_is_final_awards_tokens(self):
        prof, room_code, stage, session_stage, team = self.make_room()

        response = self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [{'id': 1}, {'id': 2}, {'id': 3}], 'edges': []},
            'is_final': True,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 3)


# ---------------------------------------------------------------------------
# list -- live frontend call shapes
# ---------------------------------------------------------------------------

class TeamBubbleMapListTest(TeamBubbleMapTestCase):
    def test_list_by_team_and_session_stage(self):
        """Mirrors teamBubbleMapsAPI.list({team, session_stage}) --
        BubbleMapV2.tsx / profesor/etapa2/BubbleMap.tsx's call shape."""
        prof, room_code, stage, session_stage, team = self.make_room()
        self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [], 'edges': []},
        }, format='json')

        response = self.client.get('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['team'], team['team_id'])

    def test_list_by_team_only(self):
        """Mirrors teamBubbleMapsAPI.list({team}) --
        DetalleSesion.tsx's call shape (no session_stage)."""
        prof, room_code, stage, session_stage, team = self.make_room()
        self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [], 'edges': []},
        }, format='json')

        response = self.client.get('/api/sessions/team-bubble-maps/', {'team': team['team_id']})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_list_unknown_team_returns_empty(self):
        response = self.client.get('/api/sessions/team-bubble-maps/', {'team': 'not-a-real-team'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_list_no_scope_returns_empty(self):
        response = self.client.get('/api/sessions/team-bubble-maps/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_list_no_auth_required(self):
        prof, room_code, stage, session_stage, team = self.make_room()
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/sessions/team-bubble-maps/', {'team': team['team_id']})

        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# retrieve
# ---------------------------------------------------------------------------

class TeamBubbleMapRetrieveTest(TeamBubbleMapTestCase):
    def test_retrieve_by_composite_id(self):
        prof, room_code, stage, session_stage, team = self.make_room()
        created = self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [], 'edges': []},
        }, format='json')
        pk = created.data['id']

        response = self.client.get(f'/api/sessions/team-bubble-maps/{pk}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], pk)

    def test_retrieve_unknown_returns_404(self):
        prof, room_code, stage, session_stage, team = self.make_room()
        pk = f"{team['team_id']}:{stage.id}"

        response = self.client.get(f'/api/sessions/team-bubble-maps/{pk}/')

        self.assertEqual(response.status_code, 404)

    def test_retrieve_malformed_pk_returns_404(self):
        response = self.client.get('/api/sessions/team-bubble-maps/not-a-composite-id/')

        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# update / partial_update -- live frontend autosave shape
# ---------------------------------------------------------------------------

class TeamBubbleMapUpdateTest(TeamBubbleMapTestCase):
    def test_partial_update_overwrites_map_data(self):
        """Mirrors BubbleMapV2.tsx's autosave:
        teamBubbleMapsAPI.update(mapIdRef.current, {map_data}) -> PATCH."""
        prof, room_code, stage, session_stage, team = self.make_room()
        created = self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [{'id': 1}], 'edges': []},
        }, format='json')
        pk = created.data['id']

        response = self.client.patch(f'/api/sessions/team-bubble-maps/{pk}/', {
            'map_data': {'nodes': [{'id': 1}, {'id': 2}], 'edges': []},
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['map_data'], {'nodes': [{'id': 1}, {'id': 2}], 'edges': []})

        stored = get_bubble_map(room_code, team['team_id'], stage.id)
        self.assertEqual(stored['map_data'], {'nodes': [{'id': 1}, {'id': 2}], 'edges': []})

    def test_partial_update_unknown_returns_404(self):
        prof, room_code, stage, session_stage, team = self.make_room()
        pk = f"{team['team_id']}:{stage.id}"

        response = self.client.patch(f'/api/sessions/team-bubble-maps/{pk}/', {
            'map_data': {'nodes': [], 'edges': []},
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_partial_update_with_is_final_awards_tokens_once(self):
        prof, room_code, stage, session_stage, team = self.make_room()
        created = self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [{'id': 1}, {'id': 2}], 'edges': []},
        }, format='json')
        pk = created.data['id']

        response = self.client.patch(f'/api/sessions/team-bubble-maps/{pk}/', {
            'map_data': {'nodes': [{'id': 1}, {'id': 2}], 'edges': []}, 'is_final': True,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 2)

    def test_no_auth_required(self):
        prof, room_code, stage, session_stage, team = self.make_room()
        created = self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [], 'edges': []},
        }, format='json')
        pk = created.data['id']
        self.client.force_authenticate(user=None)

        response = self.client.patch(f'/api/sessions/team-bubble-maps/{pk}/', {
            'map_data': {'nodes': [{'id': 1}], 'edges': []},
        }, format='json')

        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# finalize_bubble_map -- token-award side effect
# ---------------------------------------------------------------------------

class TeamBubbleMapFinalizeTest(TeamBubbleMapTestCase):
    def test_requires_fields(self):
        response = self.client.post('/api/sessions/team-bubble-maps/finalize_bubble_map/', {}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_no_bubble_map_returns_404(self):
        prof, room_code, stage, session_stage, team = self.make_room()

        response = self.client.post('/api/sessions/team-bubble-maps/finalize_bubble_map/', {
            'team': team['team_id'], 'session_stage': stage.id,
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_awards_one_token_per_bubble_no_auth_required(self):
        prof, room_code, stage, session_stage, team = self.make_room()
        self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [{'id': 1}, {'id': 2}, {'id': 3}, {'id': 4}], 'edges': []},
        }, format='json')
        self.client.force_authenticate(user=None)

        response = self.client.post('/api/sessions/team-bubble-maps/finalize_bubble_map/', {
            'team': team['team_id'], 'session_stage': stage.id,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['tokens_awarded'])
        self.assertEqual(response.data['team_tokens_total'], 4)

        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 4)

    def test_awards_tokens_for_v2_question_answer_structure(self):
        prof, room_code, stage, session_stage, team = self.make_room()
        self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {
                'version': 2,
                'questions': [
                    {'id': 'q1', 'answers': [{'id': 'a1'}, {'id': 'a2'}]},
                    {'id': 'q2', 'answers': [{'id': 'a3'}]},
                ],
            },
        }, format='json')

        response = self.client.post('/api/sessions/team-bubble-maps/finalize_bubble_map/', {
            'team': team['team_id'], 'session_stage': stage.id,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        # 2 questions + 3 answers = 5 bubbles.
        self.assertEqual(response.data['team_tokens_total'], 5)

    def test_finalize_is_idempotent_and_never_double_awards(self):
        """Task 20's lesson #2 check: source_id is
        f'{team_id}:{session_stage_id}', team-scoped by construction. A
        second finalize call for the same team/stage must not stack a
        second award on top of the first."""
        prof, room_code, stage, session_stage, team = self.make_room()
        self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [{'id': 1}, {'id': 2}], 'edges': []},
        }, format='json')

        first = self.client.post('/api/sessions/team-bubble-maps/finalize_bubble_map/', {
            'team': team['team_id'], 'session_stage': stage.id,
        }, format='json')
        second = self.client.post('/api/sessions/team-bubble-maps/finalize_bubble_map/', {
            'team': team['team_id'], 'session_stage': stage.id,
        }, format='json')

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)

        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 2)

        activity_txs = [t for t in list_transactions(room_code) if t['source_type'] == 'activity']
        self.assertEqual(len(activity_txs), 1)
        self.assertEqual(activity_txs[0]['source_id'], f"{team['team_id']}:{stage.id}")

    def test_two_teams_finalizing_same_stage_both_get_awarded_independently(self):
        """Cross-team regression test (this task's brief lesson #2): if
        source_id were built without team_id leading it, two different
        teams finalizing a bubble map for the same session_stage in the
        same room would collide on one DynamoDB key and only the first
        team would ever be awarded."""
        prof, room_code, stage, session_stage, team_a = self.make_room()
        team_b = create_team(room_code, 'Equipo B', 'Rojo')

        self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team_a['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [{'id': 1}, {'id': 2}], 'edges': []},
        }, format='json')
        self.client.post('/api/sessions/team-bubble-maps/', {
            'team': team_b['team_id'], 'session_stage': stage.id,
            'map_data': {'nodes': [{'id': 1}, {'id': 2}, {'id': 3}], 'edges': []},
        }, format='json')

        response_a = self.client.post('/api/sessions/team-bubble-maps/finalize_bubble_map/', {
            'team': team_a['team_id'], 'session_stage': stage.id,
        }, format='json')
        response_b = self.client.post('/api/sessions/team-bubble-maps/finalize_bubble_map/', {
            'team': team_b['team_id'], 'session_stage': stage.id,
        }, format='json')

        self.assertEqual(response_a.status_code, 200, response_a.data)
        self.assertEqual(response_b.status_code, 200, response_b.data)

        team_a_after = get_team(room_code, team_a['team_id'])
        team_b_after = get_team(room_code, team_b['team_id'])
        self.assertEqual(team_a_after['tokens_total'], 2)
        self.assertEqual(team_b_after['tokens_total'], 3)

        activity_txs = [t for t in list_transactions(room_code) if t['source_type'] == 'activity']
        self.assertEqual(len(activity_txs), 2)
        self.assertEqual(
            {t['source_id'] for t in activity_txs},
            {f"{team_a['team_id']}:{stage.id}", f"{team_b['team_id']}:{stage.id}"},
        )

    def test_unknown_session_stage_returns_404(self):
        prof, room_code, stage, session_stage, team = self.make_room()

        response = self.client.post('/api/sessions/team-bubble-maps/finalize_bubble_map/', {
            'team': team['team_id'], 'session_stage': 999999,
        }, format='json')

        self.assertEqual(response.status_code, 404)
