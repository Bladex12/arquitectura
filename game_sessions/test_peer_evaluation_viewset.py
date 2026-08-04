"""Tests for PeerEvaluationViewSet -- ported from the ORM to DynamoDB in
Task 19 (see .superpowers/sdd/task-19-brief.md).

Sibling to test_roulette_assignment_and_token_transaction_viewset.py
(Task 18) / test_team_activity_progress_viewset.py (Task 15): same hybrid
Django TestCase (real MySQL-backed Professor/Course/Stage/Activity
fixtures) composed with a manually-managed moto mock (DynamoDB session/
team/session_stage/peer-evaluation/token-transaction data) pattern. Hits
the real viewset through the URL router via DRF's APIClient.

The cross-team token-award test
(test_two_teams_being_evaluated_both_get_awarded_independently) is the
direct regression test for the Tasks 15/16/18 bug this task's brief
explicitly warned against repeating: source_id must lead with the
*awarded* team's id (evaluated_team_id here), or two different evaluated
teams in the same room being evaluated by the same evaluator team would
collide on one DynamoDB key and only the first evaluated team would ever
be awarded.
"""
import os
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from moto import mock_aws
from rest_framework.test import APIClient

from academic.models import Career, Course, Faculty
from challenges.models import Activity, ActivityType, Stage
from game_sessions.dynamodb.evaluations import get_peer_evaluation
from game_sessions.dynamodb.game_session import create_session
from game_sessions.dynamodb.stage_progress import create_session_stage, get_progress
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


def make_stage_4_with_presentation_activity():
    """Creates challenges.Stage(number=4) plus the 'presentación' Activity
    the token-bookkeeping side effect looks up by name substring (mirrors
    make_stage_4_with_activities() in test_session_stage_viewset.py,
    trimmed to just what this viewset's create() needs)."""
    stage4 = Stage.objects.create(number=4, name='Comunicación', is_active=True)
    presentacion_type = ActivityType.objects.create(
        code=f'presentacion_{uuid.uuid4().hex[:6]}', name='Presentación', is_active=True
    )
    presentation_activity = Activity.objects.create(
        stage=stage4, activity_type=presentacion_type, name='Presentación', order_number=2, is_active=True
    )
    return stage4, presentation_activity


class PeerEvaluationTestCase(TestCase):
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

    def make_room(self, room_code='ROOM1', with_stage_4=True):
        prof = make_professor()
        course = make_course()
        create_session(room_code, professor_id=prof.id, course_id=course.id)
        stage_4 = None
        if with_stage_4:
            stage_4, _ = make_stage_4_with_presentation_activity()
            create_session_stage(room_code, stage_4.id)
        team_a = create_team(room_code, 'Equipo A', 'Azul')
        team_b = create_team(room_code, 'Equipo B', 'Rojo')
        return prof, room_code, stage_4, team_a, team_b


# ---------------------------------------------------------------------------
# create -- basic validation
# ---------------------------------------------------------------------------

class PeerEvaluationCreateValidationTest(PeerEvaluationTestCase):
    def test_requires_fields(self):
        response = self.client.post('/api/sessions/peer-evaluations/', {}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_team_cannot_evaluate_itself(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()

        response = self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_a['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_unknown_evaluator_team_returns_404(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()

        response = self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': 'not-a-real-team', 'evaluated_team_id': team_a['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_unknown_evaluated_team_returns_404(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()

        response = self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': 'not-a-real-team',
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')

        self.assertEqual(response.status_code, 404)

    def test_unknown_game_session_returns_404(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()

        response = self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': 'NOPE', 'criteria_scores': {'clarity': 5},
        }, format='json')

        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# create -- happy path + composite id
# ---------------------------------------------------------------------------

class PeerEvaluationCreateTest(PeerEvaluationTestCase):
    def test_creates_evaluation_with_composite_id(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()

        response = self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code,
            'criteria_scores': {'clarity': 3, 'solution': 2, 'presentation': 1},
            'feedback': 'Buen trabajo',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['id'], f"{team_a['team_id']}:{team_b['team_id']}")
        self.assertEqual(response.data['total_score'], 6)
        self.assertEqual(response.data['tokens_awarded'], 6)
        self.assertEqual(response.data['evaluator_team_name'], 'Equipo A')
        self.assertEqual(response.data['evaluated_team_name'], 'Equipo B')
        self.assertEqual(response.data['feedback'], 'Buen trabajo')

        stored = get_peer_evaluation(room_code, team_a['team_id'], team_b['team_id'])
        self.assertIsNotNone(stored)
        self.assertEqual(stored['total_score'], 6)

    def test_zero_score_creates_evaluation_without_awarding_tokens(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()

        response = self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 0},
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['tokens_awarded'], 0)

        team_b_after = get_team(room_code, team_b['team_id'])
        self.assertEqual(team_b_after['tokens_total'], 0)
        self.assertEqual(list_transactions(room_code), [])


# ---------------------------------------------------------------------------
# create -- token-bookkeeping side effect (awards tokens to evaluated team)
# ---------------------------------------------------------------------------

class PeerEvaluationTokenAwardTest(PeerEvaluationTestCase):
    def test_awards_tokens_to_evaluated_team(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()

        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5, 'solution': 4},
        }, format='json')

        team_b_after = get_team(room_code, team_b['team_id'])
        self.assertEqual(team_b_after['tokens_total'], 9)

        transactions = list_transactions(room_code)
        peer_eval_txs = [t for t in transactions if t['source_type'] == 'peer_evaluation']
        self.assertEqual(len(peer_eval_txs), 1)
        self.assertEqual(peer_eval_txs[0]['team_id'], team_b['team_id'])
        self.assertEqual(peer_eval_txs[0]['amount'], 9)
        self.assertEqual(peer_eval_txs[0]['source_id'], f"{team_b['team_id']}:{team_a['team_id']}")

    def test_resubmitting_same_pair_updates_evaluation_not_duplicates(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()

        first = self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')
        second = self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 8}, 'feedback': 'Actualizado',
        }, format='json')

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(second.data['id'], first.data['id'])
        self.assertEqual(second.data['total_score'], 8)
        self.assertEqual(second.data['feedback'], 'Actualizado')

        # Only one PeerEvaluation item exists for this pair.
        self.assertEqual(
            len([e for e in list_transactions(room_code) if e['source_type'] == 'peer_evaluation']), 1
        )

        # The existing TokenTransaction's amount was adjusted (5 -> 8), and
        # the team's tokens_total reflects the +3 delta, not a fresh +8
        # award stacked on top of the original +5.
        team_b_after = get_team(room_code, team_b['team_id'])
        self.assertEqual(team_b_after['tokens_total'], 8)

        transactions = [t for t in list_transactions(room_code) if t['source_type'] == 'peer_evaluation']
        self.assertEqual(transactions[0]['amount'], 8)

    def test_resubmitting_with_same_score_does_not_change_tokens(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()

        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')
        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')

        team_b_after = get_team(room_code, team_b['team_id'])
        self.assertEqual(team_b_after['tokens_total'], 5)

    def test_two_teams_being_evaluated_both_get_awarded_independently(self):
        """Cross-team regression test (this task's brief lesson #2): if
        source_id were built without the evaluated team's id leading it
        (e.g. a bare evaluator_team_id, or team-agnostic), two different
        evaluated teams being evaluated by the same evaluator team in the
        same room would collide on one DynamoDB key and only the first
        evaluated team would ever be awarded."""
        prof, room_code, stage_4, team_a, team_b = self.make_room()
        team_c = create_team(room_code, 'Equipo C', 'Verde')

        response_b = self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')
        response_c = self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_c['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 7},
        }, format='json')

        self.assertEqual(response_b.status_code, 201, response_b.data)
        self.assertEqual(response_c.status_code, 201, response_c.data)

        team_b_after = get_team(room_code, team_b['team_id'])
        team_c_after = get_team(room_code, team_c['team_id'])
        self.assertEqual(team_b_after['tokens_total'], 5)
        self.assertEqual(team_c_after['tokens_total'], 7)

        transactions = [t for t in list_transactions(room_code) if t['source_type'] == 'peer_evaluation']
        self.assertEqual(len(transactions), 2)
        self.assertEqual(
            {t['source_id'] for t in transactions},
            {f"{team_b['team_id']}:{team_a['team_id']}", f"{team_c['team_id']}:{team_a['team_id']}"},
        )
        self.assertEqual({t['team_id'] for t in transactions}, {team_b['team_id'], team_c['team_id']})

    def test_no_stage_4_session_stage_skips_token_award(self):
        """Mirrors the ORM's own gate: tokens are only ever awarded if a
        SessionStage for Stage(number=4) exists in this room -- the
        evaluation itself is still created either way."""
        prof, room_code, stage_4, team_a, team_b = self.make_room(with_stage_4=False)

        response = self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        team_b_after = get_team(room_code, team_b['team_id'])
        self.assertEqual(team_b_after['tokens_total'], 0)
        self.assertEqual(list_transactions(room_code), [])


# ---------------------------------------------------------------------------
# create -- presentation-activity completion side effect
# ---------------------------------------------------------------------------

class PeerEvaluationPresentationCompletionTest(PeerEvaluationTestCase):
    def test_marks_presentation_activity_completed_once_all_teams_evaluated(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()
        team_c = create_team(room_code, 'Equipo C', 'Verde')
        from game_sessions.dynamodb.stage_progress import update_session_stage
        update_session_stage(
            room_code, stage_4.id,
            presentation_order=[team_a['team_id'], team_b['team_id'], team_c['team_id']],
        )
        presentation_activity = next(
            a for a in Activity.objects.filter(stage=stage_4, is_active=True)
            if a.activity_type and 'presentación' in (a.activity_type.name or '').lower()
        )

        # team_b is evaluated by both other teams (team_a and team_c) -- 2
        # evaluations >= (3 teams - 1), so its presentation activity
        # should flip to completed after the second one.
        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')
        progress_after_first = get_progress(room_code, team_b['team_id'], presentation_activity.id)
        self.assertTrue(progress_after_first is None or progress_after_first.get('status') != 'completed')

        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_c['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 3},
        }, format='json')

        progress_after_second = get_progress(room_code, team_b['team_id'], presentation_activity.id)
        self.assertIsNotNone(progress_after_second)
        self.assertEqual(progress_after_second['status'], 'completed')
        self.assertEqual(progress_after_second['progress_percentage'], 100)


# ---------------------------------------------------------------------------
# list -- live frontend call shape (evaluator_team + evaluated_team + game_session)
# ---------------------------------------------------------------------------

class PeerEvaluationListTest(PeerEvaluationTestCase):
    def test_list_matches_live_frontend_call_shape(self):
        """Mirrors peerEvaluationsAPI.list({evaluator_team, evaluated_team,
        game_session}) -- PresentacionPitch.tsx (tablet, no auth) calls
        this exact shape to check whether an evaluation was already
        submitted, before deciding whether to call create()."""
        prof, room_code, stage_4, team_a, team_b = self.make_room()
        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')

        response = self.client.get('/api/sessions/peer-evaluations/', {
            'evaluator_team': team_a['team_id'], 'evaluated_team': team_b['team_id'],
            'game_session': room_code,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['evaluator_team'], team_a['team_id'])
        self.assertEqual(response.data[0]['evaluated_team'], team_b['team_id'])

    def test_list_reflects_just_written_evaluation_without_room_code(self):
        """No frontend caller currently omits game_session, but list()
        must still resolve room_code via a team-id fallback (mirrors
        TeamActivityProgressViewSet._resolve_team/
        TokenTransactionViewSet.list) for robustness."""
        prof, room_code, stage_4, team_a, team_b = self.make_room()
        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')

        response = self.client.get('/api/sessions/peer-evaluations/', {'evaluated_team': team_b['team_id']})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_list_with_no_scope_returns_empty(self):
        response = self.client.get('/api/sessions/peer-evaluations/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_list_no_auth_required(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/sessions/peer-evaluations/', {'game_session': room_code})

        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# retrieve
# ---------------------------------------------------------------------------

class PeerEvaluationRetrieveTest(PeerEvaluationTestCase):
    def test_retrieve_by_composite_id(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()
        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')
        pk = f"{team_a['team_id']}:{team_b['team_id']}"

        response = self.client.get(f'/api/sessions/peer-evaluations/{pk}/', {'game_session': room_code})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], pk)

    def test_retrieve_unknown_returns_404(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()

        pk = f"{team_a['team_id']}:{team_b['team_id']}"
        response = self.client.get(f'/api/sessions/peer-evaluations/{pk}/', {'game_session': room_code})

        self.assertEqual(response.status_code, 404)

    def test_retrieve_malformed_pk_returns_404(self):
        response = self.client.get('/api/sessions/peer-evaluations/not-a-composite-id/')

        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# for_professor
# ---------------------------------------------------------------------------

class PeerEvaluationForProfessorTest(PeerEvaluationTestCase):
    def test_returns_all_evaluations_in_session_no_auth_required(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()
        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')
        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_b['team_id'], 'evaluated_team_id': team_a['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 3},
        }, format='json')
        self.client.force_authenticate(user=None)

        response = self.client.get(
            '/api/sessions/peer-evaluations/for_professor/', {'game_session_id': room_code}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_missing_game_session_id_returns_400(self):
        response = self.client.get('/api/sessions/peer-evaluations/for_professor/')

        self.assertEqual(response.status_code, 400)

    def test_unknown_game_session_returns_404(self):
        response = self.client.get(
            '/api/sessions/peer-evaluations/for_professor/', {'game_session_id': 'NOPE'}
        )

        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# for_team
# ---------------------------------------------------------------------------

class PeerEvaluationForTeamTest(PeerEvaluationTestCase):
    def test_returns_evaluations_received_by_team_no_auth_required(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()
        team_c = create_team(room_code, 'Equipo C', 'Verde')
        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_a['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 5},
        }, format='json')
        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_c['team_id'], 'evaluated_team_id': team_b['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 4},
        }, format='json')
        self.client.post('/api/sessions/peer-evaluations/', {
            'evaluator_team_id': team_b['team_id'], 'evaluated_team_id': team_a['team_id'],
            'game_session_id': room_code, 'criteria_scores': {'clarity': 1},
        }, format='json')
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/sessions/peer-evaluations/for_team/', {
            'team_id': team_b['team_id'], 'game_session_id': room_code,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertEqual({e['evaluator_team'] for e in response.data}, {team_a['team_id'], team_c['team_id']})

    def test_missing_params_returns_400(self):
        response = self.client.get('/api/sessions/peer-evaluations/for_team/')

        self.assertEqual(response.status_code, 400)

    def test_unknown_team_returns_404(self):
        prof, room_code, stage_4, team_a, team_b = self.make_room()

        response = self.client.get('/api/sessions/peer-evaluations/for_team/', {
            'team_id': 'not-a-real-team', 'game_session_id': room_code,
        })

        self.assertEqual(response.status_code, 404)
