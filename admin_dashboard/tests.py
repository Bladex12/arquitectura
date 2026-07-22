"""
Tests para admin_dashboard

Task 22: admin_dashboard/services.py replaces the post_save signals that
used to live in admin_dashboard/signals.py (fired on TeamActivityProgress/
SessionStage ORM saves). Since those models are now DynamoDB items
(game_sessions/views.py, Tasks 10-21), there's no post_save to hook -- these
tests call record_activity_progress_metric/record_stage_duration_metric
directly with hand-built dicts (the same shape upsert_progress()/
update_session_stage() return), the same way game_sessions/views.py now
calls them explicitly right after a write that transitions status to
'completed' (or, for topic/challenge selection, right after select_topic/
select_challenge write selected_topic_id/selected_challenge_id).
"""
from django.test import TestCase
from django.utils import timezone

from academic.models import Faculty
from challenges.models import Stage, ActivityType, Activity, Topic, Challenge
from admin_dashboard.models import (
    ActivityDurationMetric, StageDurationMetric,
    TopicSelectionMetric, ChallengeSelectionMetric,
)
from admin_dashboard.services import (
    record_activity_progress_metric, record_stage_duration_metric,
)


class RecordActivityProgressMetricTest(TestCase):
    def setUp(self):
        self.stage = Stage.objects.create(number=1, name='Trabajo en Equipo', is_active=True)
        self.activity_type = ActivityType.objects.create(code='minigame', name='Minijuego')
        self.activity = Activity.objects.create(
            stage=self.stage, activity_type=self.activity_type,
            name='Sopa de letras', order_number=1,
        )
        self.faculty = Faculty.objects.create(name='Test Faculty')
        self.topic = Topic.objects.create(name='Salud')
        self.challenge = Challenge.objects.create(topic=self.topic, title='Reto de salud')

    def _completed_item(self, **overrides):
        item = {
            'activity_id': self.activity.id,
            'status': 'completed',
            'started_at': '2026-01-01T10:00:00+00:00',
            'completed_at': '2026-01-01T10:05:00+00:00',
        }
        item.update(overrides)
        return item

    def test_creates_activity_duration_metric_on_completion(self):
        record_activity_progress_metric(self._completed_item())

        metric = ActivityDurationMetric.objects.get(activity=self.activity, stage=self.stage)
        self.assertEqual(metric.total_completions, 1)
        self.assertEqual(metric.total_duration_seconds, 300)
        self.assertEqual(metric.avg_duration_seconds, 300)
        self.assertEqual(metric.min_duration_seconds, 300)
        self.assertEqual(metric.max_duration_seconds, 300)

    def test_second_completion_accumulates_into_existing_metric(self):
        record_activity_progress_metric(self._completed_item())
        record_activity_progress_metric(self._completed_item(
            started_at='2026-01-01T11:00:00+00:00',
            completed_at='2026-01-01T11:01:40+00:00',  # 100s
        ))

        metric = ActivityDurationMetric.objects.get(activity=self.activity, stage=self.stage)
        self.assertEqual(metric.total_completions, 2)
        self.assertEqual(metric.total_duration_seconds, 400)
        self.assertEqual(metric.avg_duration_seconds, 200)
        self.assertEqual(metric.min_duration_seconds, 100)
        self.assertEqual(metric.max_duration_seconds, 300)

    def test_no_duration_metric_when_status_not_completed(self):
        record_activity_progress_metric(self._completed_item(status='in_progress'))
        self.assertFalse(ActivityDurationMetric.objects.exists())

    def test_no_duration_metric_when_timestamps_missing(self):
        record_activity_progress_metric(self._completed_item(started_at=None))
        record_activity_progress_metric(self._completed_item(completed_at=None))
        self.assertFalse(ActivityDurationMetric.objects.exists())

    def test_records_topic_selection_metric(self):
        item = self._completed_item(status='in_progress', completed_at=None, selected_topic_id=self.topic.id)
        record_activity_progress_metric(item)

        metric = TopicSelectionMetric.objects.get(topic=self.topic)
        self.assertEqual(metric.selection_count, 1)
        self.assertIsNotNone(metric.last_selected_at)

    def test_topic_selection_metric_accumulates_independent_of_completion_status(self):
        item = self._completed_item(status='pending', completed_at=None, selected_topic_id=self.topic.id)
        record_activity_progress_metric(item)
        record_activity_progress_metric(item)

        metric = TopicSelectionMetric.objects.get(topic=self.topic)
        self.assertEqual(metric.selection_count, 2)

    def test_records_challenge_selection_metric(self):
        item = self._completed_item(
            status='completed', selected_challenge_id=self.challenge.id,
        )
        record_activity_progress_metric(item)

        metric = ChallengeSelectionMetric.objects.get(challenge=self.challenge, topic=self.topic)
        self.assertEqual(metric.selection_count, 1)
        self.assertIsNotNone(metric.last_selected_at)

    def test_completion_and_selection_both_fire_from_one_call(self):
        item = self._completed_item(
            selected_topic_id=self.topic.id, selected_challenge_id=self.challenge.id,
        )
        record_activity_progress_metric(item)

        self.assertEqual(ActivityDurationMetric.objects.get(activity=self.activity).total_completions, 1)
        self.assertEqual(TopicSelectionMetric.objects.get(topic=self.topic).selection_count, 1)
        self.assertEqual(ChallengeSelectionMetric.objects.get(challenge=self.challenge).selection_count, 1)

    def test_missing_activity_does_not_raise(self):
        # The DynamoDB write behind this dict has already committed by the
        # time this is called -- a deleted Activity must not turn into a
        # 500 for an analytics side-effect (Finding 2, final review).
        item = self._completed_item(activity_id=999999)
        with self.assertLogs('admin_dashboard.services', level='ERROR'):
            record_activity_progress_metric(item)
        self.assertFalse(ActivityDurationMetric.objects.exists())

    def test_missing_topic_does_not_raise(self):
        item = self._completed_item(status='in_progress', completed_at=None, selected_topic_id=999999)
        with self.assertLogs('admin_dashboard.services', level='ERROR'):
            record_activity_progress_metric(item)
        self.assertFalse(TopicSelectionMetric.objects.exists())

    def test_missing_challenge_does_not_raise(self):
        item = self._completed_item(selected_challenge_id=999999)
        with self.assertLogs('admin_dashboard.services', level='ERROR'):
            record_activity_progress_metric(item)
        self.assertFalse(ChallengeSelectionMetric.objects.exists())
        # the duration metric (a separate, unrelated Activity lookup) still
        # fires normally -- the missing-challenge failure doesn't leak into it.
        self.assertEqual(ActivityDurationMetric.objects.get(activity=self.activity).total_completions, 1)


class RecordStageDurationMetricTest(TestCase):
    def setUp(self):
        self.stage = Stage.objects.create(number=2, name='Empatía', is_active=True)

    def _completed_item(self, **overrides):
        item = {
            'stage_id': self.stage.id,
            'status': 'completed',
            'started_at': '2026-01-01T09:00:00+00:00',
            'completed_at': '2026-01-01T09:10:00+00:00',
        }
        item.update(overrides)
        return item

    def test_creates_stage_duration_metric_on_completion(self):
        record_stage_duration_metric(self._completed_item())

        metric = StageDurationMetric.objects.get(stage=self.stage)
        self.assertEqual(metric.total_completions, 1)
        self.assertEqual(metric.total_duration_seconds, 600)
        self.assertEqual(metric.avg_duration_seconds, 600)

    def test_second_completion_accumulates_into_existing_metric(self):
        record_stage_duration_metric(self._completed_item())
        record_stage_duration_metric(self._completed_item(
            started_at='2026-01-01T10:00:00+00:00',
            completed_at='2026-01-01T10:05:00+00:00',  # 300s
        ))

        metric = StageDurationMetric.objects.get(stage=self.stage)
        self.assertEqual(metric.total_completions, 2)
        self.assertEqual(metric.total_duration_seconds, 900)
        self.assertEqual(metric.avg_duration_seconds, 450)

    def test_no_metric_when_status_not_completed(self):
        record_stage_duration_metric(self._completed_item(status='in_progress'))
        self.assertFalse(StageDurationMetric.objects.exists())

    def test_no_metric_when_timestamps_missing(self):
        record_stage_duration_metric(self._completed_item(started_at=None))
        record_stage_duration_metric(self._completed_item(completed_at=None))
        self.assertFalse(StageDurationMetric.objects.exists())

    def test_missing_stage_does_not_raise(self):
        # Same defensive-write guarantee as record_activity_progress_metric
        # above: the DynamoDB write already committed, a deleted Stage must
        # not turn into a 500 (Finding 2, final review).
        item = self._completed_item(stage_id=999999)
        with self.assertLogs('admin_dashboard.services', level='ERROR'):
            record_stage_duration_metric(item)
        self.assertFalse(StageDurationMetric.objects.exists())


# ============================================================================
# Task 23: AdminDashboardViewSet ported to DynamoDB Scan-based aggregation.
#
# Hybrid fixtures: real ORM rows for Stage/Activity/Topic/Challenge/Faculty/
# Career/Course (they stay on MySQL), moto-mocked DynamoDB for game_sessions
# data (GameSession/Team/TeamActivityProgress/SessionStage/ReflectionEvaluation
# items). Each test asserts EXACT aggregate numbers against hand-built items.
# ============================================================================
import os
import uuid

from moto import mock_aws
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User

from users.models import Administrator, Professor
from academic.models import Career, Course
from challenges.models import ActivityType
from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table
from game_sessions.dynamodb.testing import create_test_table


def make_admin_client():
    user = User.objects.create_user(username=f'admin_{uuid.uuid4().hex[:6]}', password='pass')
    Administrator.objects.create(user=user)
    refresh = RefreshToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    return client, user


class DashboardTestBase(TestCase):
    """moto DynamoDB + admin-authenticated APIClient. Subclasses build
    hand-crafted items via the put_* helpers and hit the endpoints."""

    def setUp(self):
        self.mock = mock_aws()
        self.mock.start()
        os.environ['GAME_SESSIONS_TABLE'] = 'test-game-sessions'
        os.environ['AWS_REGION'] = 'us-east-1'
        create_test_table('test-game-sessions')
        self.table = get_table()
        self.client, self.admin_user = make_admin_client()

    def tearDown(self):
        self.mock.stop()

    # ---- DynamoDB item builders (exact shapes the views read) ----

    def put_session(self, room_code, status='completed',
                    created_at='2026-01-01T10:00:00+00:00', course_id=None,
                    professor_id=1, cancellation_reason=None,
                    cancellation_reason_other=None):
        self.table.put_item(Item={
            'PK': keys.session_pk(room_code), 'SK': keys.metadata_sk(),
            'type': 'GameSession', 'room_code': room_code, 'status': status,
            'created_at': created_at, 'professor_id': professor_id,
            'course_id': course_id, 'cancellation_reason': cancellation_reason,
            'cancellation_reason_other': cancellation_reason_other,
        })

    def put_team(self, room_code, team_id, student_ids):
        self.table.put_item(Item={
            'PK': keys.session_pk(room_code), 'SK': keys.team_sk(team_id),
            'type': 'Team', 'team_id': team_id, 'room_code': room_code,
            'student_ids': list(student_ids),
        })

    def put_progress(self, room_code, team_id, activity_id, status='completed',
                     started_at=None, completed_at=None,
                     selected_topic_id=None, selected_challenge_id=None):
        self.table.put_item(Item={
            'PK': keys.session_pk(room_code),
            'SK': keys.progress_sk(team_id, activity_id),
            'type': 'TeamActivityProgress', 'room_code': room_code,
            'team_id': team_id, 'activity_id': activity_id, 'status': status,
            'started_at': started_at, 'completed_at': completed_at,
            'selected_topic_id': selected_topic_id,
            'selected_challenge_id': selected_challenge_id,
        })

    def put_stage(self, room_code, stage_id, status='completed',
                  started_at=None, completed_at=None):
        self.table.put_item(Item={
            'PK': keys.session_pk(room_code), 'SK': keys.stage_sk(stage_id),
            'type': 'SessionStage', 'room_code': room_code,
            'stage_id': stage_id, 'status': status,
            'started_at': started_at, 'completed_at': completed_at,
        })

    def put_reflection(self, room_code, student_email, student_name='Alumno',
                       value_areas=None, satisfaction=None,
                       entrepreneurship_interest=None, comments=None,
                       created_at='2026-01-01T10:00:00+00:00'):
        reflection_id = str(uuid.uuid4())
        self.table.put_item(Item={
            'PK': keys.session_pk(room_code),
            'SK': keys.reflection_sk(reflection_id),
            'type': 'ReflectionEvaluation', 'reflection_id': reflection_id,
            'room_code': room_code, 'student_email': student_email,
            'student_name': student_name,
            'value_areas': value_areas if value_areas is not None else [],
            'satisfaction': satisfaction,
            'entrepreneurship_interest': entrepreneurship_interest,
            'comments': comments, 'created_at': created_at,
        })


class MetricsEndpointTest(DashboardTestBase):
    def test_metrics_exact_aggregates(self):
        # 3 sessions: 2 completed, 1 running
        self.put_session('AAAA', status='completed')
        self.put_session('BBBB', status='completed')
        self.put_session('CCCC', status='running')
        # Teams: distinct students 1,2,3 (2 repeated across teams)
        self.put_team('AAAA', 't1', [1, 2])
        self.put_team('AAAA', 't2', [2, 3])
        self.put_team('BBBB', 't3', [3])
        # 2 professors registered (only counts Professor rows, not sessions)
        Professor.objects.create(user=User.objects.create_user('p1'))
        Professor.objects.create(user=User.objects.create_user('p2'))

        resp = self.client.get('/api/admin/dashboard/metrics/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['total_students_played'], 3)
        self.assertEqual(resp.data['total_professors_active'], 2)
        self.assertEqual(resp.data['total_sessions_created'], 3)
        self.assertEqual(resp.data['total_sessions_completed'], 2)
        self.assertEqual(resp.data['total_sessions_running'], 1)
        self.assertEqual(resp.data['completion_rate'], round(2 / 3 * 100, 2))

    def test_metrics_requires_admin(self):
        user = User.objects.create_user(username='plain', password='x')
        refresh = RefreshToken.for_user(user)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        resp = client.get('/api/admin/dashboard/metrics/')
        self.assertEqual(resp.status_code, 403)


class TimeSeriesEndpointTest(DashboardTestBase):
    def test_games_bucketed_by_month(self):
        self.put_session('AAAA', created_at='2026-01-05T10:00:00+00:00')
        self.put_session('BBBB', created_at='2026-01-20T10:00:00+00:00')
        self.put_session('CCCC', created_at='2026-02-10T10:00:00+00:00')

        resp = self.client.get('/api/admin/dashboard/time_series/?metric=games&period=month')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['data'], [
            {'period': '2026-01', 'count': 2},
            {'period': '2026-02', 'count': 1},
        ])

    def test_professors_counts_only_first_session(self):
        # Professor 10: sessions in Jan and Mar -> counted once, in Jan.
        self.put_session('AAAA', professor_id=10, created_at='2026-01-05T10:00:00+00:00')
        self.put_session('BBBB', professor_id=10, created_at='2026-03-05T10:00:00+00:00')
        # Professor 20: single session in Feb.
        self.put_session('CCCC', professor_id=20, created_at='2026-02-05T10:00:00+00:00')

        resp = self.client.get('/api/admin/dashboard/time_series/?metric=professors&period=month')
        self.assertEqual(resp.data['data'], [
            {'period': '2026-01', 'count': 1},
            {'period': '2026-02', 'count': 1},
        ])

    def test_students_counts_earliest_participation(self):
        self.put_session('AAAA', created_at='2026-01-05T10:00:00+00:00')
        self.put_session('BBBB', created_at='2026-02-05T10:00:00+00:00')
        self.put_team('AAAA', 't1', [1, 2])
        self.put_team('BBBB', 't2', [2, 3])  # student 2 appears again in Feb

        resp = self.client.get('/api/admin/dashboard/time_series/?metric=students&period=month')
        # student 1 -> Jan, student 2 -> Jan (earliest), student 3 -> Feb
        self.assertEqual(resp.data['data'], [
            {'period': '2026-01', 'count': 2},
            {'period': '2026-02', 'count': 1},
        ])

    def test_games_respects_date_range(self):
        self.put_session('AAAA', created_at='2025-12-31T10:00:00+00:00')
        self.put_session('BBBB', created_at='2026-01-15T10:00:00+00:00')
        self.put_session('CCCC', created_at='2026-03-15T10:00:00+00:00')

        resp = self.client.get(
            '/api/admin/dashboard/time_series/'
            '?metric=games&period=year&start_date=2026-01-01&end_date=2026-02-01'
        )
        self.assertEqual(resp.data['data'], [{'period': '2026', 'count': 1}])

    def test_games_empty(self):
        resp = self.client.get('/api/admin/dashboard/time_series/?metric=games&period=month')
        self.assertEqual(resp.data['data'], [])


class GameCompletionEndpointTest(DashboardTestBase):
    def test_completion_percentages(self):
        # 3 completed, 1 cancelled, 1 running (running excluded from % base)
        self.put_session('A1', status='completed')
        self.put_session('A2', status='completed')
        self.put_session('A3', status='completed')
        self.put_session('C1', status='cancelled')
        self.put_session('R1', status='running')

        resp = self.client.get('/api/admin/dashboard/game_completion/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['total'], 5)
        self.assertEqual(resp.data['completed']['count'], 3)
        self.assertEqual(resp.data['cancelled']['count'], 1)
        # base = completed + cancelled = 4
        self.assertEqual(resp.data['completed']['percentage'], 75.0)
        self.assertEqual(resp.data['cancelled']['percentage'], 25.0)

    def test_completion_empty(self):
        resp = self.client.get('/api/admin/dashboard/game_completion/')
        self.assertEqual(resp.data['total'], 0)
        self.assertEqual(resp.data['completed']['percentage'], 0)


class StageDurationEndpointTest(DashboardTestBase):
    def test_prefers_cached_metric(self):
        stage = Stage.objects.create(number=2, name='Empatía', is_active=True)
        StageDurationMetric.objects.create(
            stage=stage, total_completions=5, avg_duration_seconds=123.45,
        )
        # A raw stage that would give a different number if cache were ignored.
        self.put_stage('AAAA', stage.id, status='completed',
                       started_at='2026-01-01T10:00:00+00:00',
                       completed_at='2026-01-01T10:30:00+00:00')

        resp = self.client.get('/api/admin/dashboard/stage_duration/')
        self.assertEqual(resp.status_code, 200)
        row = next(r for r in resp.data['stages'] if r['stage_id'] == stage.id)
        self.assertEqual(row['avg_duration_seconds'], 123.45)

    def test_fallback_scans_dynamodb(self):
        stage = Stage.objects.create(number=1, name='Trabajo en Equipo', is_active=True)
        # 300s and 180s completions -> avg 240
        self.put_stage('AAAA', stage.id, status='completed',
                       started_at='2026-01-01T10:00:00+00:00',
                       completed_at='2026-01-01T10:05:00+00:00')
        self.put_stage('BBBB', stage.id, status='completed',
                       started_at='2026-01-01T10:00:00+00:00',
                       completed_at='2026-01-01T10:03:00+00:00')
        # Excluded: not completed, and missing timestamp
        self.put_stage('CCCC', stage.id, status='in_progress',
                       started_at='2026-01-01T10:00:00+00:00',
                       completed_at='2026-01-01T10:10:00+00:00')
        self.put_stage('DDDD', stage.id, status='completed',
                       started_at=None,
                       completed_at='2026-01-01T10:10:00+00:00')

        resp = self.client.get('/api/admin/dashboard/stage_duration/')
        row = next(r for r in resp.data['stages'] if r['stage_id'] == stage.id)
        self.assertEqual(row['avg_duration_seconds'], 240.0)


class StageActivitiesDurationEndpointTest(DashboardTestBase):
    def setUp(self):
        super().setUp()
        self.stage = Stage.objects.create(number=1, name='Etapa 1', is_active=True)
        self.atype = ActivityType.objects.create(code='minigame', name='Minijuego')
        self.a1 = Activity.objects.create(
            stage=self.stage, activity_type=self.atype, name='Act 1', order_number=1)
        self.a2 = Activity.objects.create(
            stage=self.stage, activity_type=self.atype, name='Act 2', order_number=2)

    def test_cached_and_fallback_mixed(self):
        # a1: cached metric wins
        ActivityDurationMetric.objects.create(
            activity=self.a1, stage=self.stage,
            total_completions=3, avg_duration_seconds=99.0)
        # a2: no metric -> scan fallback. 200s and 100s -> avg 150
        self.put_progress('AAAA', 't1', self.a2.id, status='completed',
                          started_at='2026-01-01T10:00:00+00:00',
                          completed_at='2026-01-01T10:03:20+00:00')  # 200s
        self.put_progress('BBBB', 't2', self.a2.id, status='completed',
                          started_at='2026-01-01T10:00:00+00:00',
                          completed_at='2026-01-01T10:01:40+00:00')  # 100s
        self.put_progress('CCCC', 't3', self.a2.id, status='in_progress',
                          started_at='2026-01-01T10:00:00+00:00',
                          completed_at='2026-01-01T10:10:00+00:00')  # excluded

        resp = self.client.get(
            f'/api/admin/dashboard/{self.stage.id}/stage_activities_duration/')
        self.assertEqual(resp.status_code, 200)
        by_id = {r['activity_id']: r for r in resp.data['activities']}
        self.assertEqual(by_id[self.a1.id]['avg_duration_seconds'], 99.0)
        self.assertEqual(by_id[self.a2.id]['avg_duration_seconds'], 150.0)
        # ordered by order_number
        self.assertEqual([r['activity_id'] for r in resp.data['activities']],
                         [self.a1.id, self.a2.id])

    def test_missing_stage_404(self):
        resp = self.client.get('/api/admin/dashboard/999999/stage_activities_duration/')
        self.assertEqual(resp.status_code, 404)


class ActivityDurationAnalysisEndpointTest(DashboardTestBase):
    def setUp(self):
        super().setUp()
        self.stage = Stage.objects.create(number=1, name='Etapa 1', is_active=True)
        self.atype = ActivityType.objects.create(code='minigame', name='Minijuego')
        self.a1 = Activity.objects.create(
            stage=self.stage, activity_type=self.atype, name='Target', order_number=1)
        self.a2 = Activity.objects.create(
            stage=self.stage, activity_type=self.atype, name='Other', order_number=2)
        self.a3 = Activity.objects.create(
            stage=self.stage, activity_type=self.atype, name='NoData', order_number=3)

    def test_full_analysis(self):
        # Target a1: durations 100, 200 (both 2026-01-01), 300 (2026-01-02)
        self.put_progress('AAAA', 't1', self.a1.id, status='completed',
                          started_at='2026-01-01T10:00:00+00:00',
                          completed_at='2026-01-01T10:01:40+00:00')  # 100s
        self.put_progress('BBBB', 't2', self.a1.id, status='completed',
                          started_at='2026-01-01T10:00:00+00:00',
                          completed_at='2026-01-01T10:03:20+00:00')  # 200s
        self.put_progress('CCCC', 't3', self.a1.id, status='completed',
                          started_at='2026-01-02T10:00:00+00:00',
                          completed_at='2026-01-02T10:05:00+00:00')  # 300s
        # a1 non-completed -> excluded
        self.put_progress('DDDD', 't4', self.a1.id, status='in_progress',
                          started_at='2026-01-01T10:00:00+00:00',
                          completed_at='2026-01-01T11:00:00+00:00')
        # a2: 400s and 600s -> avg 500 (comparison)
        self.put_progress('AAAA', 't1', self.a2.id, status='completed',
                          started_at='2026-01-01T10:00:00+00:00',
                          completed_at='2026-01-01T10:06:40+00:00')  # 400s
        self.put_progress('BBBB', 't2', self.a2.id, status='completed',
                          started_at='2026-01-01T10:00:00+00:00',
                          completed_at='2026-01-01T10:10:00+00:00')  # 600s
        # a3: no completed data

        resp = self.client.get(
            f'/api/admin/dashboard/{self.a1.id}/activity_duration_analysis/')
        self.assertEqual(resp.status_code, 200)

        stats = resp.data['statistics']
        self.assertEqual(stats['min'], 100.0)
        self.assertEqual(stats['max'], 300.0)
        self.assertEqual(stats['avg'], 200.0)
        self.assertEqual(stats['median'], 200.0)
        self.assertEqual(stats['total_samples'], 3)

        # histogram: bin_size = 20; 100->bin0, 200->bin5, 300->bin9
        hist = resp.data['histogram']
        self.assertEqual(len(hist), 10)
        self.assertEqual(hist[0]['count'], 1)
        self.assertEqual(hist[5]['count'], 1)
        self.assertEqual(hist[9]['count'], 1)
        self.assertEqual(sum(b['count'] for b in hist), 3)
        self.assertEqual(hist[0]['bin_start'], 100.0)
        self.assertEqual(hist[0]['bin_end'], 120.0)

        # time series grouped by completion date
        self.assertEqual(resp.data['time_series'], [
            {'date': '2026-01-01', 'avg_duration': 150.0, 'count': 2},
            {'date': '2026-01-02', 'avg_duration': 300.0, 'count': 1},
        ])

        # comparison: a2 present (avg 500), a3 excluded (no data)
        comp = {c['activity_id']: c for c in resp.data['comparison']}
        self.assertEqual(comp[self.a2.id]['avg_duration_seconds'], 500.0)
        self.assertNotIn(self.a3.id, comp)

    def test_empty_activity(self):
        resp = self.client.get(
            f'/api/admin/dashboard/{self.a1.id}/activity_duration_analysis/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['histogram'], [])
        self.assertEqual(resp.data['statistics']['avg'], 0)
        self.assertEqual(resp.data['time_series'], [])
        self.assertEqual(resp.data['comparison'], [])


class TopicsSelectionEndpointTest(DashboardTestBase):
    def test_cached_and_fallback_sorted(self):
        t1 = Topic.objects.create(name='Salud')
        t2 = Topic.objects.create(name='Educación')
        t3 = Topic.objects.create(name='Medio Ambiente')
        # t1 cached = 7
        TopicSelectionMetric.objects.create(topic=t1, selection_count=7)
        # t2 fallback: 3 progress selections
        for room in ('AAAA', 'BBBB', 'CCCC'):
            self.put_progress(room, 't1', 1, status='completed',
                              selected_topic_id=t2.id)
        # t3 fallback: none -> 0

        resp = self.client.get('/api/admin/dashboard/topics_selection/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['topics'], [
            {'topic_id': t1.id, 'topic_name': 'Salud', 'selection_count': 7},
            {'topic_id': t2.id, 'topic_name': 'Educación', 'selection_count': 3},
            {'topic_id': t3.id, 'topic_name': 'Medio Ambiente', 'selection_count': 0},
        ])


class TopicChallengesEndpointTest(DashboardTestBase):
    def test_cached_and_fallback(self):
        topic = Topic.objects.create(name='Salud')
        c1 = Challenge.objects.create(topic=topic, title='Reto A')
        c2 = Challenge.objects.create(topic=topic, title='Reto B')
        ChallengeSelectionMetric.objects.create(
            challenge=c1, topic=topic, selection_count=5, avg_tokens_earned=12.5)
        # c2 fallback: 2 selections
        self.put_progress('AAAA', 't1', 1, selected_challenge_id=c2.id)
        self.put_progress('BBBB', 't2', 1, selected_challenge_id=c2.id)

        resp = self.client.get(
            f'/api/admin/dashboard/{topic.id}/topic_challenges/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['challenges'], [
            {'challenge_id': c1.id, 'challenge_title': 'Reto A',
             'selection_count': 5, 'avg_tokens_earned': 12.5},
            {'challenge_id': c2.id, 'challenge_title': 'Reto B',
             'selection_count': 2, 'avg_tokens_earned': 0},
        ])


class ChallengeAnalysisEndpointTest(DashboardTestBase):
    def test_frequency_and_sessions(self):
        from datetime import date
        topic = Topic.objects.create(name='Salud')
        challenge = Challenge.objects.create(topic=topic, title='Reto A')
        other = Challenge.objects.create(topic=topic, title='Reto B')

        # selections of `challenge` across rooms/dates
        self.put_session('AAAA', status='completed', created_at='2026-01-01T09:00:00+00:00')
        self.put_session('BBBB', status='completed', created_at='2026-01-01T09:00:00+00:00')
        self.put_session('CCCC', status='running', created_at='2026-01-02T09:00:00+00:00')
        self.put_session('DDDD', status='completed', created_at='2026-01-03T09:00:00+00:00')
        self.put_progress('AAAA', 't1', 1, selected_challenge_id=challenge.id,
                          completed_at='2026-01-01T10:00:00+00:00')
        self.put_progress('BBBB', 't2', 1, selected_challenge_id=challenge.id,
                          completed_at='2026-01-01T11:00:00+00:00')
        self.put_progress('CCCC', 't3', 1, selected_challenge_id=challenge.id,
                          completed_at='2026-01-02T10:00:00+00:00')
        self.put_progress('DDDD', 't4', 1, selected_challenge_id=challenge.id,
                          completed_at=None)  # None date bucket
        # distractor: different challenge, must be excluded
        self.put_progress('AAAA', 't9', 2, selected_challenge_id=other.id,
                          completed_at='2026-01-01T10:00:00+00:00')

        resp = self.client.get(
            f'/api/admin/dashboard/{challenge.id}/challenge_analysis/')
        self.assertEqual(resp.status_code, 200)
        # None first, then dates ascending
        self.assertEqual(resp.data['selection_frequency'], [
            {'date': None, 'count': 1},
            {'date': date(2026, 1, 1), 'count': 2},
            {'date': date(2026, 1, 2), 'count': 1},
        ])
        # sessions_used: 4 distinct rooms, sorted by room_code
        self.assertEqual([s['room_code'] for s in resp.data['sessions_used']],
                         ['AAAA', 'BBBB', 'CCCC', 'DDDD'])
        self.assertEqual(resp.data['sessions_used'][0]['id'], 'AAAA')
        self.assertEqual(resp.data['sessions_used'][2]['status'], 'running')


class EvaluationResponseRateEndpointTest(DashboardTestBase):
    def test_response_rate(self):
        # 3 distinct students played
        self.put_team('AAAA', 't1', [1, 2])
        self.put_team('BBBB', 't2', [2, 3])
        # 2 distinct responders (a@x repeated)
        self.put_reflection('AAAA', 'a@x.cl')
        self.put_reflection('AAAA', 'a@x.cl')
        self.put_reflection('BBBB', 'b@x.cl')

        resp = self.client.get('/api/admin/dashboard/evaluation_response_rate/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['total_played'], 3)
        self.assertEqual(resp.data['total_responded'], 2)
        self.assertEqual(resp.data['response_rate'], round(2 / 3 * 100, 2))


class EvaluationAnswersEndpointTest(DashboardTestBase):
    def test_answer_distribution(self):
        self.put_reflection('AAAA', 'a@x.cl', value_areas=['equipo', 'empatia'],
                            satisfaction='mucho', entrepreneurship_interest='ya_tenia')
        self.put_reflection('BBBB', 'b@x.cl', value_areas=['equipo'],
                            satisfaction='mucho', entrepreneurship_interest='me_encantaria')
        self.put_reflection('CCCC', 'c@x.cl', value_areas=[],
                            satisfaction='si', entrepreneurship_interest=None)

        resp = self.client.get('/api/admin/dashboard/evaluation_answers/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['value_areas'], {'equipo': 2, 'empatia': 1})
        self.assertEqual(resp.data['satisfaction'], [
            {'satisfaction': 'mucho', 'count': 2},
            {'satisfaction': 'si', 'count': 1},
        ])
        # None sorted last
        self.assertEqual(resp.data['entrepreneurship_interest'], [
            {'entrepreneurship_interest': 'me_encantaria', 'count': 1},
            {'entrepreneurship_interest': 'ya_tenia', 'count': 1},
            {'entrepreneurship_interest': None, 'count': 1},
        ])


class EvaluationCommentsEndpointTest(DashboardTestBase):
    def setUp(self):
        super().setUp()
        self.put_reflection('ROOM1', 'a@x.cl', comments='buenisimo',
                            created_at='2026-01-03T10:00:00+00:00')
        self.put_reflection('ROOM1', 'b@x.cl', comments='me gusto mucho',
                            created_at='2026-01-02T10:00:00+00:00')
        self.put_reflection('ROOM2', 'c@x.cl', comments='aburrido',
                            created_at='2026-01-01T10:00:00+00:00')
        # excluded: empty and None comment
        self.put_reflection('ROOM2', 'd@x.cl', comments='',
                            created_at='2026-01-05T10:00:00+00:00')
        self.put_reflection('ROOM2', 'e@x.cl', comments=None,
                            created_at='2026-01-05T10:00:00+00:00')

    def test_lists_only_nonempty_comments_desc(self):
        resp = self.client.get('/api/admin/dashboard/evaluation_comments/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['total'], 3)
        self.assertEqual([r['comment'] for r in resp.data['results']],
                         ['buenisimo', 'me gusto mucho', 'aburrido'])
        self.assertEqual(resp.data['results'][0]['session_room_code'], 'ROOM1')
        self.assertEqual(resp.data['results'][0]['session_id'], 'ROOM1')
        self.assertIsNotNone(resp.data['results'][0]['id'])

    def test_pagination_slices_list(self):
        p1 = self.client.get('/api/admin/dashboard/evaluation_comments/?page=1&page_size=2')
        self.assertEqual(p1.data['total'], 3)
        self.assertEqual([r['comment'] for r in p1.data['results']],
                         ['buenisimo', 'me gusto mucho'])
        p2 = self.client.get('/api/admin/dashboard/evaluation_comments/?page=2&page_size=2')
        self.assertEqual(p2.data['total'], 3)
        self.assertEqual([r['comment'] for r in p2.data['results']], ['aburrido'])
        # out-of-range page -> empty slice, no crash
        p9 = self.client.get('/api/admin/dashboard/evaluation_comments/?page=9&page_size=2')
        self.assertEqual(p9.data['results'], [])

    def test_filter_by_session_id_maps_to_room_code(self):
        resp = self.client.get('/api/admin/dashboard/evaluation_comments/?session_id=ROOM1')
        self.assertEqual(resp.data['total'], 2)
        self.assertEqual({r['session_room_code'] for r in resp.data['results']}, {'ROOM1'})

    def test_filter_by_search(self):
        resp = self.client.get('/api/admin/dashboard/evaluation_comments/?search=GUSTO')
        self.assertEqual(resp.data['total'], 1)
        self.assertEqual(resp.data['results'][0]['comment'], 'me gusto mucho')

    def test_filter_by_date_from(self):
        resp = self.client.get('/api/admin/dashboard/evaluation_comments/?date_from=2026-01-02')
        self.assertEqual(resp.data['total'], 2)
        self.assertEqual([r['comment'] for r in resp.data['results']],
                         ['buenisimo', 'me gusto mucho'])


class FacultiesGamesEndpointTest(DashboardTestBase):
    def test_counts_by_faculty(self):
        f1 = Faculty.objects.create(name='Ingeniería')
        f2 = Faculty.objects.create(name='Medicina')
        f3 = Faculty.objects.create(name='Inactiva', is_active=False)
        ca1 = Career.objects.create(name='Civil', faculty=f1)
        ca2 = Career.objects.create(name='Enfermería', faculty=f2)
        co1 = Course.objects.create(name='Curso 1', career=ca1)
        co2 = Course.objects.create(name='Curso 2', career=ca2)
        co3 = Course.objects.create(name='Curso 3', career=ca1)
        self.put_session('AAAA', course_id=co1.id)  # f1
        self.put_session('BBBB', course_id=co3.id)  # f1
        self.put_session('CCCC', course_id=co2.id)  # f2
        self.put_session('DDDD', course_id=None)    # ignored

        resp = self.client.get('/api/admin/dashboard/faculties_games/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['faculties'], [
            {'faculty_id': f1.id, 'faculty_name': 'Ingeniería', 'games_count': 2},
            {'faculty_id': f2.id, 'faculty_name': 'Medicina', 'games_count': 1},
        ])
        # inactive faculty not listed
        self.assertNotIn(f3.id, [r['faculty_id'] for r in resp.data['faculties']])


class FacultyCareersGamesEndpointTest(DashboardTestBase):
    def test_counts_by_career(self):
        f1 = Faculty.objects.create(name='Ingeniería')
        f2 = Faculty.objects.create(name='Medicina')
        ca1 = Career.objects.create(name='Civil', faculty=f1)
        ca3 = Career.objects.create(name='Industrial', faculty=f1)  # no courses
        ca_in = Career.objects.create(name='Vieja', faculty=f1, is_active=False)
        ca2 = Career.objects.create(name='Enfermería', faculty=f2)
        co1 = Course.objects.create(name='C1', career=ca1)
        co3 = Course.objects.create(name='C3', career=ca1)
        co2 = Course.objects.create(name='C2', career=ca2)
        self.put_session('AAAA', course_id=co1.id)  # ca1
        self.put_session('BBBB', course_id=co3.id)  # ca1
        self.put_session('CCCC', course_id=co2.id)  # ca2 (other faculty)

        resp = self.client.get(f'/api/admin/dashboard/{f1.id}/faculty_careers_games/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['careers'], [
            {'career_id': ca1.id, 'career_name': 'Civil', 'games_count': 2},
            {'career_id': ca3.id, 'career_name': 'Industrial', 'games_count': 0},
        ])
        self.assertNotIn(ca_in.id, [r['career_id'] for r in resp.data['careers']])

    def test_missing_faculty_404(self):
        resp = self.client.get('/api/admin/dashboard/999999/faculty_careers_games/')
        self.assertEqual(resp.status_code, 404)


class CancellationReasonsEndpointTest(DashboardTestBase):
    def test_grouped_reasons_with_examples(self):
        self.put_session('AAAA', status='cancelled', cancellation_reason='tiempo')
        self.put_session('BBBB', status='cancelled', cancellation_reason='tiempo')
        self.put_session('EEEE', status='cancelled', cancellation_reason='tiempo')
        self.put_session('CCCC', status='cancelled', cancellation_reason='Otro',
                         cancellation_reason_other='se cayo internet')
        self.put_session('DDDD', status='cancelled', cancellation_reason='Otro',
                         cancellation_reason_other='alumnos se fueron')
        # excluded: null / empty reason, and non-cancelled
        self.put_session('FFFF', status='cancelled', cancellation_reason=None)
        self.put_session('GGGG', status='cancelled', cancellation_reason='')
        self.put_session('HHHH', status='completed', cancellation_reason='tiempo')

        resp = self.client.get('/api/admin/dashboard/cancellation_reasons/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['total_cancelled'], 5)
        reasons = resp.data['reasons']
        self.assertEqual(reasons[0]['reason'], 'tiempo')
        self.assertEqual(reasons[0]['count'], 3)
        self.assertEqual(reasons[0]['percentage'], 60.0)
        self.assertEqual(reasons[1]['reason'], 'Otro')
        self.assertEqual(reasons[1]['count'], 2)
        self.assertEqual(reasons[1]['percentage'], 40.0)
        self.assertEqual(set(reasons[1]['examples']),
                         {'se cayo internet', 'alumnos se fueron'})
