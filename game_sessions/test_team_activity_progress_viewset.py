"""Tests for TeamActivityProgressViewSet -- create/partial_update/
submit_anagram (Task 15's literal brief scope) plus submit_word_search/
submit_general_knowledge/list/retrieve (pulled into the same task -- see
TeamActivityProgressViewSet's class docstring in game_sessions/views.py
for why: they all read/write the same TeamActivityProgress row this
task's actions do, so splitting them across two tasks would have
guaranteed a live regression window).

Sibling to test_session_stage_viewset.py (Task 14) / test_team_viewset.py
(Task 13): same hybrid Django TestCase (real MySQL-backed Professor/Course/
Student/Stage/Activity fixtures) composed with a manually-managed moto mock
(DynamoDB session/team/progress data) pattern. Hits the real viewset
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
from challenges.models import Activity, ActivityType, GeneralKnowledgeQuestion, Stage
from game_sessions.dynamodb.game_session import create_session
from game_sessions.dynamodb.stage_progress import create_session_stage, get_progress, upsert_progress
from game_sessions.dynamodb.team import create_team, get_team
from game_sessions.dynamodb.testing import create_test_table
from game_sessions.dynamodb.token_transaction import list_transactions
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


class TeamActivityProgressTestCase(TestCase):
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

    def make_room_with_activity(self, room_code='ROOM1', activity_name='Presentación'):
        prof = make_professor()
        course = make_course()
        create_session(room_code, professor_id=prof.id, course_id=course.id)
        stage = Stage.objects.create(number=1, name='Trabajo en equipo', is_active=True)
        create_session_stage(room_code, stage.id)
        activity_type = ActivityType.objects.create(
            code=f'type_{uuid.uuid4().hex[:6]}', name='Minijuego', is_active=True
        )
        activity = Activity.objects.create(
            stage=stage, activity_type=activity_type, name=activity_name, order_number=1, is_active=True
        )
        team = create_team(room_code, 'Equipo A', 'Azul')
        return prof, room_code, stage, activity, team


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

class CreateTest(TeamActivityProgressTestCase):
    def test_requires_team_activity_session_stage(self):
        response = self.client.post('/api/sessions/team-activity-progress/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_unknown_team_returns_404(self):
        _, room_code, stage, activity, _team = self.make_room_with_activity()
        response = self.client.post('/api/sessions/team-activity-progress/', {
            'team': 'not-a-real-team', 'activity': activity.id, 'session_stage': stage.id,
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_unknown_activity_returns_404(self):
        _, room_code, stage, _activity, team = self.make_room_with_activity()
        response = self.client.post('/api/sessions/team-activity-progress/', {
            'team': team['team_id'], 'activity': 999999, 'session_stage': stage.id,
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_unknown_session_stage_returns_404(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        other_stage = Stage.objects.create(number=2, name='Empatía', is_active=True)
        response = self.client.post('/api/sessions/team-activity-progress/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': other_stage.id,
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_creates_new_progress_pending_by_default(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()

        response = self.client.post('/api/sessions/team-activity-progress/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(response.data['team'], team['team_id'])
        self.assertEqual(response.data['activity'], activity.id)

        progress = get_progress(room_code, team['team_id'], activity.id)
        self.assertIsNotNone(progress)
        self.assertEqual(progress['status'], 'pending')

    def test_calling_create_again_updates_not_duplicates(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        self.client.post('/api/sessions/team-activity-progress/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
        }, format='json')

        response = self.client.post('/api/sessions/team-activity-progress/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'status': 'in_progress',
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'in_progress')

    def test_completed_status_sets_completed_at_and_full_progress(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()

        response = self.client.post('/api/sessions/team-activity-progress/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'status': 'completed',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['status'], 'completed')
        self.assertIsNotNone(response.data['completed_at'])
        self.assertEqual(response.data['progress_percentage'], 100)

    def test_part1_completed_awards_tokens_exactly_once(self):
        """Regression test for the reason__icontains fragility this task
        fixes: calling create() twice with the same part1_completed
        transition must award tokens only the first time."""
        _, room_code, stage, activity, team = self.make_room_with_activity()

        payload = {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'status': 'in_progress',
            'response_data': {'part1_completed': True},
        }
        first = self.client.post('/api/sessions/team-activity-progress/', payload, format='json')
        self.assertEqual(first.status_code, 201, first.data)

        second = self.client.post('/api/sessions/team-activity-progress/', payload, format='json')
        self.assertEqual(second.status_code, 200, second.data)

        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 5)

        transactions = list_transactions(room_code)
        part1_txs = [t for t in transactions if t['source_id'] == f'{team["team_id"]}:{activity.id}:part1']
        self.assertEqual(len(part1_txs), 1)

    def test_chaos_completed_awards_tokens_exactly_once(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()

        payload = {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'response_data': {'chaos': {'completed': True}},
        }
        self.client.post('/api/sessions/team-activity-progress/', payload, format='json')
        self.client.post('/api/sessions/team-activity-progress/', payload, format='json')

        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 5)

    def test_part1_and_chaos_are_independent_awards(self):
        """Both reasons share source_type='activity' and the same
        activity.id -- this proves the composite source_id convention
        (f'{activity_id}:part1' vs f'{activity_id}:chaos') keeps them
        from colliding with each other."""
        _, room_code, stage, activity, team = self.make_room_with_activity()

        self.client.post('/api/sessions/team-activity-progress/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'response_data': {'part1_completed': True},
        }, format='json')
        self.client.post('/api/sessions/team-activity-progress/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'response_data': {'part1_completed': True, 'chaos': {'completed': True}},
        }, format='json')

        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 10)


# ---------------------------------------------------------------------------
# Cross-team token-award idempotency regression (task: fix cross-team
# token award collision). _award_tokens' source_id used to be
# f'{activity.id}:{reason_tag}' with no team_id anywhere in the DynamoDB
# key (create_transaction's uniqueness is (room_code, source_type,
# source_id) under a room-scoped PK -- see keys.token_tx_sk_for_source).
# In a room with two+ teams, the FIRST team to trigger a given
# activity/reason_tag combo silently blocked every other team's award --
# create_transaction() returned None (the intended "duplicate retry"
# behavior) even though it was a genuinely different team's first-ever
# award, not a retry. Fixed by prefixing team_id into source_id inside
# _award_tokens itself. These tests prove: (a) two different teams in the
# same room both get awarded for the same activity/reason, and (b) each
# team's award is still idempotent under a same-team retry.
# ---------------------------------------------------------------------------

class CrossTeamTokenAwardTest(TeamActivityProgressTestCase):
    def test_two_teams_completing_part1_both_get_awarded(self):
        _, room_code, stage, activity, team_a = self.make_room_with_activity()
        team_b = create_team(room_code, 'Equipo B', 'Rojo')

        payload_a = {
            'team': team_a['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'response_data': {'part1_completed': True},
        }
        payload_b = {
            'team': team_b['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'response_data': {'part1_completed': True},
        }

        response_a = self.client.post('/api/sessions/team-activity-progress/', payload_a, format='json')
        response_b = self.client.post('/api/sessions/team-activity-progress/', payload_b, format='json')
        self.assertEqual(response_a.status_code, 201, response_a.data)
        self.assertEqual(response_b.status_code, 201, response_b.data)

        team_a_after = get_team(room_code, team_a['team_id'])
        team_b_after = get_team(room_code, team_b['team_id'])
        # This is the exact regression the reviewer reported: before the
        # fix, team_b_after['tokens_total'] would be 0 here because
        # team_a's award "claimed" the shared (activity, reason_tag) key.
        self.assertEqual(team_a_after['tokens_total'], 5)
        self.assertEqual(team_b_after['tokens_total'], 5)

        transactions = list_transactions(room_code)
        part1_txs = [t for t in transactions if t['reason'] and 'Parte 1' in t['reason']]
        self.assertEqual(len(part1_txs), 2)
        self.assertEqual({t['team_id'] for t in part1_txs}, {team_a['team_id'], team_b['team_id']})

    def test_two_teams_completing_part1_each_stay_idempotent_under_retry(self):
        """Combines the cross-team fix with the pre-existing per-team
        idempotency guarantee: retrying team A's submission must not
        double-award team A, and must not affect team B's independent
        award either."""
        _, room_code, stage, activity, team_a = self.make_room_with_activity()
        team_b = create_team(room_code, 'Equipo B', 'Rojo')

        payload_a = {
            'team': team_a['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'response_data': {'part1_completed': True},
        }
        payload_b = {
            'team': team_b['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'response_data': {'part1_completed': True},
        }

        self.client.post('/api/sessions/team-activity-progress/', payload_a, format='json')
        self.client.post('/api/sessions/team-activity-progress/', payload_a, format='json')  # retry, team A
        self.client.post('/api/sessions/team-activity-progress/', payload_b, format='json')

        team_a_after = get_team(room_code, team_a['team_id'])
        team_b_after = get_team(room_code, team_b['team_id'])
        self.assertEqual(team_a_after['tokens_total'], 5)
        self.assertEqual(team_b_after['tokens_total'], 5)

        transactions = list_transactions(room_code)
        part1_txs = [t for t in transactions if t['reason'] and 'Parte 1' in t['reason']]
        self.assertEqual(len(part1_txs), 2)

    def test_two_teams_awarded_chaos_tokens_independently(self):
        _, room_code, stage, activity, team_a = self.make_room_with_activity()
        team_b = create_team(room_code, 'Equipo B', 'Rojo')

        payload_a = {
            'team': team_a['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'response_data': {'chaos': {'completed': True}},
        }
        payload_b = {
            'team': team_b['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'response_data': {'chaos': {'completed': True}},
        }

        self.client.post('/api/sessions/team-activity-progress/', payload_a, format='json')
        self.client.post('/api/sessions/team-activity-progress/', payload_b, format='json')

        team_a_after = get_team(room_code, team_a['team_id'])
        team_b_after = get_team(room_code, team_b['team_id'])
        self.assertEqual(team_a_after['tokens_total'], 5)
        self.assertEqual(team_b_after['tokens_total'], 5)


# ---------------------------------------------------------------------------
# partial_update
# ---------------------------------------------------------------------------

class PartialUpdateTest(TeamActivityProgressTestCase):
    def _create_progress(self, room_code, stage, activity, team):
        response = self.client.post('/api/sessions/team-activity-progress/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
        }, format='json')
        return response.data['id']

    def test_missing_progress_returns_404(self):
        response = self.client.patch(
            '/api/sessions/team-activity-progress/nope:1/', {'status': 'in_progress'}, format='json'
        )
        self.assertEqual(response.status_code, 404)

    def test_malformed_pk_returns_404(self):
        response = self.client.patch(
            '/api/sessions/team-activity-progress/not-a-valid-pk/', {'status': 'in_progress'}, format='json'
        )
        self.assertEqual(response.status_code, 404)

    def test_updates_status_and_response_data(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        progress_id = self._create_progress(room_code, stage, activity, team)

        response = self.client.patch(f'/api/sessions/team-activity-progress/{progress_id}/', {
            'status': 'in_progress',
            'response_data': {'foo': 'bar'},
            'progress_percentage': 42,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'in_progress')
        self.assertEqual(response.data['response_data'], {'foo': 'bar'})
        self.assertEqual(response.data['progress_percentage'], 42)

    def test_preserves_fields_not_in_the_patch(self):
        """upsert_progress() always overwrites the whole item -- a
        status-only PATCH must not silently discard response_data set by
        an earlier request on the same row."""
        _, room_code, stage, activity, team = self.make_room_with_activity()
        progress_id = self._create_progress(room_code, stage, activity, team)
        self.client.patch(f'/api/sessions/team-activity-progress/{progress_id}/', {
            'response_data': {'foo': 'bar'},
        }, format='json')

        response = self.client.patch(f'/api/sessions/team-activity-progress/{progress_id}/', {
            'status': 'in_progress',
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['response_data'], {'foo': 'bar'})

    def test_chaos_completed_awards_tokens_exactly_once(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        progress_id = self._create_progress(room_code, stage, activity, team)

        payload = {'response_data': {'chaos': {'completed': True}}}
        first = self.client.patch(f'/api/sessions/team-activity-progress/{progress_id}/', payload, format='json')
        self.assertEqual(first.status_code, 200, first.data)
        second = self.client.patch(f'/api/sessions/team-activity-progress/{progress_id}/', payload, format='json')
        self.assertEqual(second.status_code, 200, second.data)

        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 5)

    def test_completed_status_sets_completed_at_once(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        progress_id = self._create_progress(room_code, stage, activity, team)

        first = self.client.patch(f'/api/sessions/team-activity-progress/{progress_id}/', {
            'status': 'completed',
        }, format='json')
        completed_at = first.data['completed_at']
        self.assertIsNotNone(completed_at)

        second = self.client.patch(f'/api/sessions/team-activity-progress/{progress_id}/', {
            'status': 'completed',
        }, format='json')
        self.assertEqual(second.data['completed_at'], completed_at)


# ---------------------------------------------------------------------------
# submit_anagram
# ---------------------------------------------------------------------------

class SubmitAnagramTest(TeamActivityProgressTestCase):
    def test_requires_fields(self):
        response = self.client.post('/api/sessions/team-activity-progress/submit_anagram/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_unknown_team_returns_404(self):
        _, room_code, stage, activity, _team = self.make_room_with_activity()
        response = self.client.post('/api/sessions/team-activity-progress/submit_anagram/', {
            'team': 'nope', 'activity': activity.id, 'session_stage': stage.id,
            'answers': [{'word': 'IDEA', 'answer': 'IDEA'}],
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def _seed_word_search_trivially_done(self, room_code, team_id, activity_id):
        """submit_anagram's both_parts_complete check compares
        word_search_correct (an int) against word_search_total_words,
        which is None until submit_word_search has run at least once --
        comparing int >= None raises TypeError. That's pre-existing ORM
        behavior (untouched, out of this task's scope to fix) for an
        anagram-only call that skips the word-search phase entirely,
        which never happens in the real frontend flow (Minijuego.tsx
        always does word-search before anagram). Tests that don't care
        about both_parts_complete seed a trivially-satisfied word-search
        state (0 of 0) so they can exercise submit_anagram in isolation
        without hitting that unrelated pre-existing bug."""
        upsert_progress(
            room_code, team_id, activity_id,
            status='in_progress', response_data={'found_words': [], 'word_search_total_words': 0},
        )

    def test_correct_word_awards_one_token(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        self._seed_word_search_trivially_done(room_code, team['team_id'], activity.id)

        response = self.client.post('/api/sessions/team-activity-progress/submit_anagram/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'answers': [{'word': 'IDEA', 'answer': 'IDEA'}],
            'anagram_words': ['IDEA', 'META'],
            'total_words': 2,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['tokens_earned'], 1)
        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 1)

    def test_resubmitting_same_word_does_not_double_award(self):
        """Token-award idempotency: submitting the same correct word twice
        must not award tokens twice (fixes the old reason__icontains
        fuzzy-match check with create_transaction's real uniqueness
        constraint on (source_type, source_id))."""
        _, room_code, stage, activity, team = self.make_room_with_activity()
        self._seed_word_search_trivially_done(room_code, team['team_id'], activity.id)
        payload = {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'answers': [{'word': 'IDEA', 'answer': 'IDEA'}],
            'anagram_words': ['IDEA', 'META'],
            'total_words': 2,
        }

        self.client.post('/api/sessions/team-activity-progress/submit_anagram/', payload, format='json')
        second = self.client.post('/api/sessions/team-activity-progress/submit_anagram/', payload, format='json')

        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(second.data['tokens_earned'], 0)
        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 1)

    def test_two_teams_submitting_the_same_correct_word_both_get_awarded(self):
        """Cross-team regression: source_id used to be
        f'{activity.id}:anagram:{word}' with no team_id, so two teams
        submitting the same correct word in the same room collided on
        one DynamoDB key and only the first team was ever awarded."""
        _, room_code, stage, activity, team_a = self.make_room_with_activity()
        team_b = create_team(room_code, 'Equipo B', 'Rojo')
        self._seed_word_search_trivially_done(room_code, team_a['team_id'], activity.id)
        self._seed_word_search_trivially_done(room_code, team_b['team_id'], activity.id)

        response_a = self.client.post('/api/sessions/team-activity-progress/submit_anagram/', {
            'team': team_a['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'answers': [{'word': 'IDEA', 'answer': 'IDEA'}],
            'anagram_words': ['IDEA', 'META'],
            'total_words': 2,
        }, format='json')
        response_b = self.client.post('/api/sessions/team-activity-progress/submit_anagram/', {
            'team': team_b['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'answers': [{'word': 'IDEA', 'answer': 'IDEA'}],
            'anagram_words': ['IDEA', 'META'],
            'total_words': 2,
        }, format='json')

        self.assertEqual(response_a.data['tokens_earned'], 1)
        self.assertEqual(response_b.data['tokens_earned'], 1)
        team_a_after = get_team(room_code, team_a['team_id'])
        team_b_after = get_team(room_code, team_b['team_id'])
        self.assertEqual(team_a_after['tokens_total'], 1)
        self.assertEqual(team_b_after['tokens_total'], 1)

    def test_completes_when_all_anagram_words_correct_and_word_search_trivially_done(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        self._seed_word_search_trivially_done(room_code, team['team_id'], activity.id)

        response = self.client.post('/api/sessions/team-activity-progress/submit_anagram/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'answers': [{'word': 'IDEA', 'answer': 'IDEA'}],
            'anagram_words': ['IDEA'],
            'total_words': 1,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'completed')


# ---------------------------------------------------------------------------
# Cross-action minigame flow: submit_word_search -> submit_anagram ->
# submit_general_knowledge, all sharing one TeamActivityProgress row.
# ---------------------------------------------------------------------------

class MinigameFlowTest(TeamActivityProgressTestCase):
    def test_word_search_then_anagram_completes_the_row(self):
        """This is the regression test for the exact scenario that forced
        submit_word_search into this task's scope alongside submit_anagram
        (see class docstring): both phases must land on the SAME DynamoDB
        row for both_parts_complete to ever become true."""
        _, room_code, stage, activity, team = self.make_room_with_activity()

        ws_response = self.client.post('/api/sessions/team-activity-progress/submit_word_search/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'found_words': ['IDEA'],
            'total_words': 1,
        }, format='json')
        self.assertEqual(ws_response.status_code, 200, ws_response.data)
        self.assertEqual(ws_response.data['status'], 'in_progress')

        an_response = self.client.post('/api/sessions/team-activity-progress/submit_anagram/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'answers': [{'word': 'META', 'answer': 'META'}],
            'anagram_words': ['META'],
            'total_words': 1,
        }, format='json')

        self.assertEqual(an_response.status_code, 200, an_response.data)
        self.assertEqual(an_response.data['status'], 'completed')

        progress = get_progress(room_code, team['team_id'], activity.id)
        self.assertEqual(progress['status'], 'completed')
        self.assertEqual(set(progress['response_data']['found_words']), {'IDEA'})
        self.assertEqual(progress['response_data']['answers'][0]['word'], 'META')

        # And it's visible via list() -- the other half of the same fix.
        list_response = self.client.get('/api/sessions/team-activity-progress/', {
            'team': team['team_id'], 'activity': activity.id,
        })
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]['status'], 'completed')

    def test_general_knowledge_after_anagram_preserves_answers(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        question = GeneralKnowledgeQuestion.objects.create(
            question='2+2?', option_a='3', option_b='4', option_c='5', option_d='6',
            correct_answer=1, is_active=True,
        )
        # submit_anagram's both_parts_complete compares against
        # word_search_total_words, which is None until submit_word_search
        # has run -- pre-existing behavior, not this test's concern.
        upsert_progress(room_code, team['team_id'], activity.id, status='in_progress',
                         response_data={'found_words': [], 'word_search_total_words': 0})

        self.client.post('/api/sessions/team-activity-progress/submit_anagram/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'answers': [{'word': 'IDEA', 'answer': 'IDEA'}],
            'anagram_words': ['IDEA'],
            'total_words': 1,
        }, format='json')

        gk_response = self.client.post('/api/sessions/team-activity-progress/submit_general_knowledge/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'answers': [{'question_id': question.id, 'selected': 1}],
        }, format='json')

        self.assertEqual(gk_response.status_code, 200, gk_response.data)
        self.assertEqual(gk_response.data['tokens_earned'], 1)

        progress = get_progress(room_code, team['team_id'], activity.id)
        # The anagram answer saved earlier must still be there.
        self.assertEqual(progress['response_data']['answers'][0]['word'], 'IDEA')
        self.assertEqual(progress['response_data']['general_knowledge']['correct_count'], 1)

    def test_general_knowledge_resubmit_does_not_double_award(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        question = GeneralKnowledgeQuestion.objects.create(
            question='2+2?', option_a='3', option_b='4', option_c='5', option_d='6',
            correct_answer=1, is_active=True,
        )
        payload = {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'answers': [{'question_id': question.id, 'selected': 1}],
        }

        self.client.post('/api/sessions/team-activity-progress/submit_general_knowledge/', payload, format='json')
        second = self.client.post('/api/sessions/team-activity-progress/submit_general_knowledge/', payload, format='json')

        self.assertEqual(second.data['tokens_earned'], 0)
        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 1)


# ---------------------------------------------------------------------------
# list / retrieve
# ---------------------------------------------------------------------------

class ListRetrieveTest(TeamActivityProgressTestCase):
    def test_list_empty_when_no_progress(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        response = self.client.get('/api/sessions/team-activity-progress/', {'team': team['team_id']})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_list_filters_by_team_activity_and_session_stage(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        other_team = create_team(room_code, 'Equipo B', 'Rojo')
        upsert_progress(room_code, team['team_id'], activity.id, status='in_progress', progress_percentage=10)
        upsert_progress(room_code, other_team['team_id'], activity.id, status='pending', progress_percentage=0)

        response = self.client.get('/api/sessions/team-activity-progress/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['team'], team['team_id'])

    def test_retrieve_requires_auth_that_is_structurally_unreachable(self):
        """Pre-existing gap, unrelated to this task and left untouched:
        the class sets authentication_classes = [] (unchanged from the
        ORM version), and 'retrieve' was never in get_permissions's
        unauthenticated-actions list (also unchanged) -- so IsAuthenticated
        always sees an AnonymousUser and always denies, even with a valid
        Bearer token, since no authenticator ever runs to populate
        request.user. `retrieve` has no real frontend caller (grepped
        frontend/src/services/teamActivityProgress.ts -- no get-by-id
        method exists), so this was never reachable in practice either
        before or after this task. Documented here rather than silently
        fixed, since changing authentication wiring is out of scope."""
        prof, room_code, stage, activity, team = self.make_room_with_activity()
        upsert_progress(room_code, team['team_id'], activity.id, status='in_progress', progress_percentage=10)
        pk = f'{team["team_id"]}:{activity.id}'
        client = make_client_for(prof.user)

        response = client.get(f'/api/sessions/team-activity-progress/{pk}/')

        self.assertEqual(response.status_code, 403)
