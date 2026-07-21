"""Tests for TeamRouletteAssignmentViewSet and TokenTransactionViewSet
(Task 18) -- ported from Django ORM to DynamoDB.

Hybrid Django TestCase (real MySQL-backed Professor/Course/Stage/
RouletteChallenge fixtures) composed with a manually-managed moto mock
(DynamoDB session/team/roulette-assignment/token-transaction data)
pattern, same as test_team_activity_progress_viewset_part2.py. Hits the
real viewset through the URL router via DRF's APIClient.

The cross-team token-award test (test_two_teams_validating_roulette_both_
get_awarded) is the direct regression test for the Tasks 15/16 bug this
task's brief explicitly warned against repeating: source_id must lead
with team_id, or two teams validating a roulette challenge for the same
session_stage in the same room collide on one DynamoDB key and only the
first team is ever awarded.
"""
import os
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from moto import mock_aws
from rest_framework.test import APIClient

from academic.models import Career, Course, Faculty
from challenges.models import RouletteChallenge, Stage
from game_sessions.dynamodb.bubble_roulette import get_roulette_assignment
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


class RouletteAndTokenTxTestCase(TestCase):
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
        create_session_stage(room_code, stage.id)
        team = create_team(room_code, 'Equipo A', 'Azul')
        return prof, room_code, stage, team

    def make_challenge(self):
        return RouletteChallenge.objects.create(
            description='Haz 10 saltos', challenge_type='physical',
            token_reward_min=5, token_reward_max=10,
        )

    def authenticate(self, professor):
        self.client.force_authenticate(user=professor.user)


# ---------------------------------------------------------------------------
# TeamRouletteAssignmentViewSet.create
# ---------------------------------------------------------------------------

class RouletteAssignmentCreateTest(RouletteAndTokenTxTestCase):
    def test_requires_fields(self):
        prof, room_code, stage, team = self.make_room()
        self.authenticate(prof)

        response = self.client.post('/api/sessions/roulette-assignments/', {}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_unauthenticated_rejected(self):
        _, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()

        response = self.client.post('/api/sessions/roulette-assignments/', {
            'team': team['team_id'], 'session_stage': stage.id, 'roulette_challenge': challenge.id,
        }, format='json')

        self.assertEqual(response.status_code, 401)

    def test_unknown_team_returns_404(self):
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        self.authenticate(prof)

        response = self.client.post('/api/sessions/roulette-assignments/', {
            'team': 'not-a-real-team', 'session_stage': stage.id, 'roulette_challenge': challenge.id,
            'game_session': room_code,
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_unknown_session_stage_returns_404(self):
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        self.authenticate(prof)

        response = self.client.post('/api/sessions/roulette-assignments/', {
            'team': team['team_id'], 'session_stage': 999999, 'roulette_challenge': challenge.id,
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_unknown_roulette_challenge_returns_404(self):
        prof, room_code, stage, team = self.make_room()
        self.authenticate(prof)

        response = self.client.post('/api/sessions/roulette-assignments/', {
            'team': team['team_id'], 'session_stage': stage.id, 'roulette_challenge': 999999,
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_creates_assignment_with_composite_id(self):
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        self.authenticate(prof)

        response = self.client.post('/api/sessions/roulette-assignments/', {
            'team': team['team_id'], 'session_stage': stage.id, 'roulette_challenge': challenge.id,
            'token_reward': 8,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['id'], f"{team['team_id']}:{stage.id}")
        self.assertEqual(response.data['status'], 'assigned')
        self.assertEqual(response.data['token_reward'], 8)
        self.assertEqual(response.data['team_name'], 'Equipo A')
        self.assertEqual(response.data['challenge_description'], 'Haz 10 saltos')

        stored = get_roulette_assignment(room_code, team['team_id'], stage.id)
        self.assertIsNotNone(stored)
        self.assertEqual(stored['status'], 'assigned')


# ---------------------------------------------------------------------------
# TeamRouletteAssignmentViewSet.list / retrieve
# ---------------------------------------------------------------------------

class RouletteAssignmentListRetrieveTest(RouletteAndTokenTxTestCase):
    def test_list_by_team(self):
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        self.authenticate(prof)
        self.client.post('/api/sessions/roulette-assignments/', {
            'team': team['team_id'], 'session_stage': stage.id, 'roulette_challenge': challenge.id,
        }, format='json')

        response = self.client.get('/api/sessions/roulette-assignments/', {'team': team['team_id']})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['team'], team['team_id'])

    def test_list_without_team_or_room_returns_empty(self):
        prof, room_code, stage, team = self.make_room()
        self.authenticate(prof)

        response = self.client.get('/api/sessions/roulette-assignments/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_retrieve_by_composite_id(self):
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        self.authenticate(prof)
        self.client.post('/api/sessions/roulette-assignments/', {
            'team': team['team_id'], 'session_stage': stage.id, 'roulette_challenge': challenge.id,
        }, format='json')

        pk = f"{team['team_id']}:{stage.id}"
        response = self.client.get(f'/api/sessions/roulette-assignments/{pk}/', {'game_session': room_code})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], pk)

    def test_retrieve_unknown_returns_404(self):
        prof, room_code, stage, team = self.make_room()
        self.authenticate(prof)

        response = self.client.get(f"/api/sessions/roulette-assignments/{team['team_id']}:999/")

        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# TeamRouletteAssignmentViewSet.accept / reject
# ---------------------------------------------------------------------------

class RouletteAssignmentAcceptRejectTest(RouletteAndTokenTxTestCase):
    def _create_assignment(self, prof, room_code, stage, team, challenge, token_reward=8):
        self.authenticate(prof)
        response = self.client.post('/api/sessions/roulette-assignments/', {
            'team': team['team_id'], 'session_stage': stage.id, 'roulette_challenge': challenge.id,
            'token_reward': token_reward,
        }, format='json')
        return response.data['id']

    def test_accept_from_assigned(self):
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        pk = self._create_assignment(prof, room_code, stage, team, challenge)

        response = self.client.post(f'/api/sessions/roulette-assignments/{pk}/accept/', {
            'game_session': room_code,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'accepted')
        self.assertIsNotNone(response.data['accepted_at'])

    def test_accept_wrong_status_returns_400(self):
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        pk = self._create_assignment(prof, room_code, stage, team, challenge)
        self.client.post(f'/api/sessions/roulette-assignments/{pk}/accept/', {
            'game_session': room_code,
        }, format='json')

        response = self.client.post(f'/api/sessions/roulette-assignments/{pk}/accept/', {
            'game_session': room_code,
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_reject_from_assigned(self):
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        pk = self._create_assignment(prof, room_code, stage, team, challenge)

        response = self.client.post(f'/api/sessions/roulette-assignments/{pk}/reject/', {
            'game_session': room_code,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'rejected')
        self.assertIsNotNone(response.data['rejected_at'])

    def test_accept_unknown_returns_404(self):
        prof, room_code, stage, team = self.make_room()
        self.authenticate(prof)

        response = self.client.post(f"/api/sessions/roulette-assignments/{team['team_id']}:999/accept/", {
            'game_session': room_code,
        }, format='json')

        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# TeamRouletteAssignmentViewSet.validate -- token award
# ---------------------------------------------------------------------------

class RouletteAssignmentValidateTest(RouletteAndTokenTxTestCase):
    def _accept(self, prof, room_code, pk):
        self.authenticate(prof)
        return self.client.post(f'/api/sessions/roulette-assignments/{pk}/accept/', {
            'game_session': room_code,
        }, format='json')

    def test_validate_requires_accepted_status(self):
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        self.authenticate(prof)
        create_response = self.client.post('/api/sessions/roulette-assignments/', {
            'team': team['team_id'], 'session_stage': stage.id, 'roulette_challenge': challenge.id,
            'token_reward': 8,
        }, format='json')
        pk = create_response.data['id']

        response = self.client.post(f'/api/sessions/roulette-assignments/{pk}/validate/', {
            'game_session': room_code,
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_validate_completes_and_awards_tokens(self):
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        self.authenticate(prof)
        create_response = self.client.post('/api/sessions/roulette-assignments/', {
            'team': team['team_id'], 'session_stage': stage.id, 'roulette_challenge': challenge.id,
            'token_reward': 8,
        }, format='json')
        pk = create_response.data['id']
        self._accept(prof, room_code, pk)

        response = self.client.post(f'/api/sessions/roulette-assignments/{pk}/validate/', {
            'game_session': room_code,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'completed')
        self.assertIsNotNone(response.data['completed_at'])
        self.assertEqual(response.data['validated_by'], prof.id)

        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 8)

        transactions = list_transactions(room_code)
        roulette_txs = [t for t in transactions if t['source_type'] == 'roulette_challenge']
        self.assertEqual(len(roulette_txs), 1)
        self.assertEqual(roulette_txs[0]['source_id'], f"{team['team_id']}:{stage.id}")
        self.assertEqual(roulette_txs[0]['amount'], 8)

    def test_revalidating_does_not_double_award_tokens(self):
        """Unlike the old ORM version (no idempotency guard at all), this
        DynamoDB version's token award is idempotent per (source_type,
        source_id) via create_transaction() -- a second validate() call
        (still permitted by the status check, since 'completed' is an
        accepted starting state) must not re-award tokens."""
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        self.authenticate(prof)
        create_response = self.client.post('/api/sessions/roulette-assignments/', {
            'team': team['team_id'], 'session_stage': stage.id, 'roulette_challenge': challenge.id,
            'token_reward': 8,
        }, format='json')
        pk = create_response.data['id']
        self._accept(prof, room_code, pk)

        first = self.client.post(f'/api/sessions/roulette-assignments/{pk}/validate/', {
            'game_session': room_code,
        }, format='json')
        second = self.client.post(f'/api/sessions/roulette-assignments/{pk}/validate/', {
            'game_session': room_code,
        }, format='json')

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)

        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 8)

        transactions = list_transactions(room_code)
        roulette_txs = [t for t in transactions if t['source_type'] == 'roulette_challenge']
        self.assertEqual(len(roulette_txs), 1)

    def test_two_teams_validating_roulette_both_get_awarded(self):
        """Cross-team regression test (this task's brief lesson #2): if
        source_id were built without team_id leading it (e.g. a bare
        f'{stage_id}' or f'{stage_id}:roulette'), two teams in the same
        room validating a roulette challenge for the same session_stage
        would collide on one DynamoDB key and only the first team would
        ever be awarded -- the exact bug Tasks 15/16 found and fixed for
        TeamActivityProgressViewSet. Proves both teams here are
        independently awarded."""
        prof, room_code, stage, team_a = self.make_room()
        team_b = create_team(room_code, 'Equipo B', 'Rojo')
        challenge = self.make_challenge()
        self.authenticate(prof)

        create_a = self.client.post('/api/sessions/roulette-assignments/', {
            'team': team_a['team_id'], 'session_stage': stage.id, 'roulette_challenge': challenge.id,
            'token_reward': 8,
        }, format='json')
        create_b = self.client.post('/api/sessions/roulette-assignments/', {
            'team': team_b['team_id'], 'session_stage': stage.id, 'roulette_challenge': challenge.id,
            'token_reward': 12,
        }, format='json')
        pk_a = create_a.data['id']
        pk_b = create_b.data['id']

        self._accept(prof, room_code, pk_a)
        self._accept(prof, room_code, pk_b)

        response_a = self.client.post(f'/api/sessions/roulette-assignments/{pk_a}/validate/', {
            'game_session': room_code,
        }, format='json')
        response_b = self.client.post(f'/api/sessions/roulette-assignments/{pk_b}/validate/', {
            'game_session': room_code,
        }, format='json')

        self.assertEqual(response_a.status_code, 200, response_a.data)
        self.assertEqual(response_b.status_code, 200, response_b.data)

        team_a_after = get_team(room_code, team_a['team_id'])
        team_b_after = get_team(room_code, team_b['team_id'])
        self.assertEqual(team_a_after['tokens_total'], 8)
        self.assertEqual(team_b_after['tokens_total'], 12)

        transactions = list_transactions(room_code)
        roulette_txs = [t for t in transactions if t['source_type'] == 'roulette_challenge']
        self.assertEqual(len(roulette_txs), 2)
        self.assertEqual(
            {t['source_id'] for t in roulette_txs},
            {f"{team_a['team_id']}:{stage.id}", f"{team_b['team_id']}:{stage.id}"},
        )
        self.assertEqual({t['team_id'] for t in roulette_txs}, {team_a['team_id'], team_b['team_id']})


# ---------------------------------------------------------------------------
# TokenTransactionViewSet
# ---------------------------------------------------------------------------

class TokenTransactionViewSetTest(RouletteAndTokenTxTestCase):
    def _validate_roulette(self, prof, room_code, stage, team, challenge, token_reward=8):
        self.authenticate(prof)
        create_response = self.client.post('/api/sessions/roulette-assignments/', {
            'team': team['team_id'], 'session_stage': stage.id, 'roulette_challenge': challenge.id,
            'token_reward': token_reward,
        }, format='json')
        pk = create_response.data['id']
        self.client.post(f'/api/sessions/roulette-assignments/{pk}/accept/', {
            'game_session': room_code,
        }, format='json')
        return self.client.post(f'/api/sessions/roulette-assignments/{pk}/validate/', {
            'game_session': room_code,
        }, format='json')

    def test_list_by_game_session_no_auth_required(self):
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        self._validate_roulette(prof, room_code, stage, team, challenge)
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/sessions/token-transactions/', {'game_session': room_code})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['amount'], 8)
        self.assertEqual(response.data[0]['team_name'], 'Equipo A')

    def test_list_by_team_without_room_code_matches_live_frontend_call(self):
        """Mirrors tokenTransactionsAPI.list({ team: teamId, session_stage:
        stageId }) -- the exact call BubbleMapV2.tsx (tablet, no auth) and
        BubbleMap.tsx (profesor) make, with no game_session param at all."""
        prof, room_code, stage, team = self.make_room()
        challenge = self.make_challenge()
        self._validate_roulette(prof, room_code, stage, team, challenge)
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/sessions/token-transactions/', {
            'team': team['team_id'], 'session_stage': stage.id,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['team'], team['team_id'])

    def test_list_filters_by_session_stage(self):
        prof, room_code, stage, team = self.make_room()
        other_stage = Stage.objects.create(number=3, name='Creatividad', is_active=True)
        create_session_stage(room_code, other_stage.id)
        challenge = self.make_challenge()
        self._validate_roulette(prof, room_code, stage, team, challenge)

        response = self.client.get('/api/sessions/token-transactions/', {
            'team': team['team_id'], 'session_stage': other_stage.id,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_list_unknown_team_returns_empty(self):
        response = self.client.get('/api/sessions/token-transactions/', {'team': 'not-a-real-team'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_list_without_any_scope_returns_empty(self):
        response = self.client.get('/api/sessions/token-transactions/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_retrieve_is_a_404_stub(self):
        response = self.client.get('/api/sessions/token-transactions/some-id/')

        self.assertEqual(response.status_code, 404)
