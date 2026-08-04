from admin_dashboard.dynamodb import metrics as metrics_repo
from academic.dynamodb.testing import DynamoDBTestCase


class ActivityDurationMetricTest(DynamoDBTestCase):
    def test_get_or_create_then_save_increment(self):
        metric, created = metrics_repo.get_or_create_activity_duration_metric('act-1', 'stage-1')
        assert created is True
        assert metric['total_completions'] == 0

        metric2, created2 = metrics_repo.get_or_create_activity_duration_metric('act-1', 'stage-1')
        assert created2 is False

        saved = metrics_repo.save_activity_duration_metric('act-1', {
            'total_completions': 1, 'total_duration_seconds': 120.5, 'avg_duration_seconds': 120.5,
            'min_duration_seconds': 120.5, 'max_duration_seconds': 120.5,
        })
        assert saved['total_completions'] == 1
        assert saved['total_duration_seconds'] == 120.5


class StageDurationMetricTest(DynamoDBTestCase):
    def test_get_or_create_then_save(self):
        metric, created = metrics_repo.get_or_create_stage_duration_metric('stage-1')
        assert created is True
        saved = metrics_repo.save_stage_duration_metric('stage-1', {
            'total_completions': 3, 'total_duration_seconds': 90.0, 'avg_duration_seconds': 30.0,
        })
        assert saved['total_completions'] == 3
        assert saved['avg_duration_seconds'] == 30.0


class TopicSelectionMetricTest(DynamoDBTestCase):
    def test_get_or_create_then_filter_for_topics(self):
        metrics_repo.get_or_create_topic_selection_metric('topic-1')
        metrics_repo.save_topic_selection_metric('topic-1', {
            'selection_count': 2, 'last_selected_at': '2026-08-03T00:00:00',
        })
        found = metrics_repo.get_topic_selection_metrics_for_topics(['topic-1', 'topic-2'])
        assert found['topic-1']['selection_count'] == 2
        assert 'topic-2' not in found


class ChallengeSelectionMetricTest(DynamoDBTestCase):
    def test_get_or_create_then_filter_by_challenge(self):
        metrics_repo.get_or_create_challenge_selection_metric('challenge-1', 'topic-1')
        metrics_repo.save_challenge_selection_metric('topic-1', 'challenge-1', {
            'selection_count': 5, 'avg_tokens_earned': 10.0, 'last_selected_at': '2026-08-03T00:00:00',
        })
        found = metrics_repo.get_challenge_selection_metrics_for_challenges([('challenge-1', 'topic-1')])
        assert found['challenge-1']['selection_count'] == 5
        assert found['challenge-1']['avg_tokens_earned'] == 10.0


class DailyMetricsSnapshotTest(DynamoDBTestCase):
    def test_create_then_list(self):
        metrics_repo.create_daily_snapshot(date_iso='2026-08-03', games_completed=4)
        snapshots = metrics_repo.list_daily_snapshots()
        assert len(snapshots) == 1
        assert snapshots[0]['games_completed'] == 4
