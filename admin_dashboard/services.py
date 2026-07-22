"""
Explicit metric-update hooks, replacing the post_save signals that used to
live in admin_dashboard/signals.py (fired on TeamActivityProgress/
SessionStage post_save). Since those models are now DynamoDB items
(game_sessions/views.py, Tasks 10-21), there's no ORM post_save to hook
into any more -- game_sessions/views.py calls these functions explicitly,
right after any repository call (upsert_progress()/update_session_stage())
that can transition status to 'completed', or (for
record_activity_progress_metric's topic/challenge selection tracking,
which the original signal fired unconditionally on `instance.selected_topic`/
`instance.selected_challenge` -- see original admin_dashboard/signals.py's
update_activity_duration_metric, NOT gated on status=='completed') right
after a write that sets selected_topic_id/selected_challenge_id
(select_topic/select_challenge actions).

ActivityDurationMetric, StageDurationMetric, TopicSelectionMetric and
ChallengeSelectionMetric all stay on the Django ORM/MySQL, unchanged by the
DynamoDB cutover -- only their trigger mechanism moves from an ORM signal to
an explicit call.
"""
from django.utils import timezone
from datetime import datetime

from .models import (
    ActivityDurationMetric, StageDurationMetric,
    TopicSelectionMetric, ChallengeSelectionMetric,
)


def record_activity_progress_metric(progress_item):
    """Call right after a game_sessions.dynamodb.stage_progress.upsert_progress()
    (or the game_sessions/views.py helpers built on top of it) write whose
    resulting TeamActivityProgress-shaped dict has status == 'completed'
    (duration metric), and/or right after a write that sets
    selected_topic_id/selected_challenge_id (selection metrics -- these fire
    independently of `status`, mirroring the original signal's unconditional
    `if instance.selected_topic:` / `if instance.selected_challenge:` checks).

    progress_item is the dict upsert_progress()/_upsert_progress_preserving()/
    _mark_progress_completed() returns -- same fields the old
    TeamActivityProgress ORM instance exposed as attributes, here as dict
    keys instead.
    """
    from challenges.models import Activity, Topic, Challenge

    if progress_item['status'] == 'completed' and progress_item.get('completed_at') and progress_item.get('started_at'):
        started = datetime.fromisoformat(progress_item['started_at'])
        completed = datetime.fromisoformat(progress_item['completed_at'])
        duration_seconds = (completed - started).total_seconds()

        activity = Activity.objects.get(id=progress_item['activity_id'])
        metric, _ = ActivityDurationMetric.objects.get_or_create(
            activity=activity, stage=activity.stage,
            defaults={'total_completions': 0, 'total_duration_seconds': 0},
        )
        metric.total_completions += 1
        metric.total_duration_seconds += duration_seconds
        metric.avg_duration_seconds = metric.total_duration_seconds / metric.total_completions
        if metric.min_duration_seconds is None or duration_seconds < metric.min_duration_seconds:
            metric.min_duration_seconds = duration_seconds
        if metric.max_duration_seconds is None or duration_seconds > metric.max_duration_seconds:
            metric.max_duration_seconds = duration_seconds
        metric.save()

    if progress_item.get('selected_topic_id'):
        topic = Topic.objects.get(id=progress_item['selected_topic_id'])
        topic_metric, _ = TopicSelectionMetric.objects.get_or_create(topic=topic, defaults={'selection_count': 0})
        topic_metric.selection_count += 1
        topic_metric.last_selected_at = timezone.now()
        topic_metric.save()

    if progress_item.get('selected_challenge_id'):
        challenge = Challenge.objects.get(id=progress_item['selected_challenge_id'])
        challenge_metric, _ = ChallengeSelectionMetric.objects.get_or_create(
            challenge=challenge, topic=challenge.topic,
            defaults={'selection_count': 0, 'avg_tokens_earned': 0},
        )
        challenge_metric.selection_count += 1
        challenge_metric.last_selected_at = timezone.now()
        challenge_metric.save()


def record_stage_duration_metric(stage_item):
    """Call right after a game_sessions.dynamodb.stage_progress.update_session_stage()
    write whose resulting SessionStage-shaped dict has status == 'completed'.

    stage_item is the dict update_session_stage() returns -- same fields the
    old SessionStage ORM instance exposed as attributes, here as dict keys.
    """
    from challenges.models import Stage

    if stage_item['status'] == 'completed' and stage_item.get('completed_at') and stage_item.get('started_at'):
        started = datetime.fromisoformat(stage_item['started_at'])
        completed = datetime.fromisoformat(stage_item['completed_at'])
        duration_seconds = (completed - started).total_seconds()

        stage = Stage.objects.get(id=stage_item['stage_id'])
        metric, _ = StageDurationMetric.objects.get_or_create(
            stage=stage, defaults={'total_completions': 0, 'total_duration_seconds': 0},
        )
        metric.total_completions += 1
        metric.total_duration_seconds += duration_seconds
        metric.avg_duration_seconds = metric.total_duration_seconds / metric.total_completions
        metric.save()
