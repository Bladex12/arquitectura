"""
Compatibility shim: ActivityDurationMetric/StageDurationMetric/
TopicSelectionMetric/ChallengeSelectionMetric/DailyMetricsSnapshot used to
be Django ORM models with FKs into `challenges`. They're now plain Python
classes backed by DynamoDB's ContentTable, keyed by the content they
describe (see admin_dashboard/dynamodb/metrics.py and
docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md).

This shim exists so admin_dashboard/services.py and admin_dashboard/views.py
keep working with `.objects.get_or_create(...)` + attribute-mutate +
`.save()` call shapes, matching the same pattern challenges/models.py uses.
"""
from admin_dashboard.dynamodb import metrics as metrics_repo


def _id_of(value):
    if value is None:
        return None
    return getattr(value, 'id', value)


class ActivityDurationMetric:
    class _Manager:
        def get_or_create(self, *, activity, stage, defaults=None):
            item, created = metrics_repo.get_or_create_activity_duration_metric(
                _id_of(activity), _id_of(stage),
            )
            return ActivityDurationMetric(item), created

        def filter(self, activity=None, stage=None):
            aid = _id_of(activity)
            if aid is None:
                return []
            item = metrics_repo.get_activity_duration_metric(aid)
            return [ActivityDurationMetric(item)] if item else []

    objects = _Manager()

    def __init__(self, item):
        self.activity_id = item['activity_id']
        self.stage_id = item['stage_id']
        self.total_completions = item.get('total_completions', 0)
        self.total_duration_seconds = item.get('total_duration_seconds', 0)
        self.avg_duration_seconds = item.get('avg_duration_seconds', 0)
        self.min_duration_seconds = item.get('min_duration_seconds')
        self.max_duration_seconds = item.get('max_duration_seconds')
        self.last_updated = item.get('last_updated')

    def save(self):
        item = metrics_repo.save_activity_duration_metric(self.activity_id, {
            'total_completions': self.total_completions,
            'total_duration_seconds': self.total_duration_seconds,
            'avg_duration_seconds': self.avg_duration_seconds,
            'min_duration_seconds': self.min_duration_seconds,
            'max_duration_seconds': self.max_duration_seconds,
        })
        self.last_updated = item['last_updated']


class StageDurationMetric:
    class _Manager:
        def get_or_create(self, *, stage, defaults=None):
            item, created = metrics_repo.get_or_create_stage_duration_metric(_id_of(stage))
            return StageDurationMetric(item), created

        def filter(self, stage=None):
            sid = _id_of(stage)
            if sid is None:
                return []
            item = metrics_repo.get_stage_duration_metric(sid)
            return [StageDurationMetric(item)] if item else []

    objects = _Manager()

    def __init__(self, item):
        self.stage_id = item['stage_id']
        self.total_completions = item.get('total_completions', 0)
        self.total_duration_seconds = item.get('total_duration_seconds', 0)
        self.avg_duration_seconds = item.get('avg_duration_seconds', 0)
        self.last_updated = item.get('last_updated')

    def save(self):
        item = metrics_repo.save_stage_duration_metric(self.stage_id, {
            'total_completions': self.total_completions,
            'total_duration_seconds': self.total_duration_seconds,
            'avg_duration_seconds': self.avg_duration_seconds,
        })
        self.last_updated = item['last_updated']


class TopicSelectionMetric:
    class _Manager:
        def get_or_create(self, *, topic, defaults=None):
            item, created = metrics_repo.get_or_create_topic_selection_metric(_id_of(topic))
            return TopicSelectionMetric(item), created

        def filter(self, topic__in=None):
            if topic__in is None:
                return []
            topic_ids = [_id_of(t) for t in topic__in]
            items = metrics_repo.get_topic_selection_metrics_for_topics(topic_ids)
            return [TopicSelectionMetric(item) for item in items.values()]

    objects = _Manager()

    def __init__(self, item):
        self.topic_id = item['topic_id']
        self.selection_count = item.get('selection_count', 0)
        self.last_selected_at = item.get('last_selected_at')

    def save(self):
        last_selected_at = self.last_selected_at
        if hasattr(last_selected_at, 'isoformat'):
            last_selected_at = last_selected_at.isoformat()
        item = metrics_repo.save_topic_selection_metric(self.topic_id, {
            'selection_count': self.selection_count, 'last_selected_at': last_selected_at,
        })
        self.last_selected_at = item['last_selected_at']


class ChallengeSelectionMetric:
    class _Manager:
        def get_or_create(self, *, challenge, topic, defaults=None):
            item, created = metrics_repo.get_or_create_challenge_selection_metric(
                _id_of(challenge), _id_of(topic),
            )
            return ChallengeSelectionMetric(item), created

        def filter(self, challenge__in=None):
            if challenge__in is None:
                return []
            pairs = [(c.id, c.topic_id) for c in challenge__in]
            items = metrics_repo.get_challenge_selection_metrics_for_challenges(pairs)
            return [ChallengeSelectionMetric(item) for item in items.values()]

    objects = _Manager()

    def __init__(self, item):
        self.challenge_id = item['challenge_id']
        self.topic_id = item['topic_id']
        self.selection_count = item.get('selection_count', 0)
        self.avg_tokens_earned = item.get('avg_tokens_earned', 0)
        self.last_selected_at = item.get('last_selected_at')

    def save(self):
        last_selected_at = self.last_selected_at
        if hasattr(last_selected_at, 'isoformat'):
            last_selected_at = last_selected_at.isoformat()
        item = metrics_repo.save_challenge_selection_metric(self.topic_id, self.challenge_id, {
            'selection_count': self.selection_count, 'avg_tokens_earned': self.avg_tokens_earned,
            'last_selected_at': last_selected_at,
        })
        self.last_selected_at = item['last_selected_at']


class DailyMetricsSnapshot:
    class DoesNotExist(Exception):
        pass

    class _Manager:
        def get(self, date):
            date_iso = date.isoformat() if hasattr(date, 'isoformat') else str(date)
            item = metrics_repo.get_daily_snapshot(date_iso)
            if item is None:
                raise DailyMetricsSnapshot.DoesNotExist('DailyMetricsSnapshot does not exist')
            return DailyMetricsSnapshot(item)

        def all(self):
            return [DailyMetricsSnapshot(i) for i in metrics_repo.list_daily_snapshots()]

        def create(self, *, date, games_completed=0, new_professors=0, new_students=0, total_sessions=0):
            date_iso = date.isoformat() if hasattr(date, 'isoformat') else str(date)
            item = metrics_repo.create_daily_snapshot(
                date_iso=date_iso, games_completed=games_completed, new_professors=new_professors,
                new_students=new_students, total_sessions=total_sessions,
            )
            return DailyMetricsSnapshot(item)

    objects = _Manager()

    def __init__(self, item):
        self.date = item['date']
        self.games_completed = item.get('games_completed', 0)
        self.new_professors = item.get('new_professors', 0)
        self.new_students = item.get('new_students', 0)
        self.total_sessions = item.get('total_sessions', 0)
        self.created_at = item.get('created_at')

    def __str__(self):
        return f"Snapshot {self.date} - {self.games_completed} juegos"
