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
