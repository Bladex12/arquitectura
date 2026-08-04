"""
Frozen copy of the original Django ORM models for `admin_dashboard`, kept
ONLY so challenges/management/commands/backfill_content_to_dynamodb.py
can still read prod MySQL data after admin_dashboard/models.py became a
DynamoDB compatibility shim (see
docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md).

Not imported anywhere else.
"""
from django.db import models

from challenges.legacy_orm_models import Activity, Stage, Topic, Challenge


class ActivityDurationMetric(models.Model):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='+')
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name='+')
    total_completions = models.IntegerField(default=0)
    total_duration_seconds = models.FloatField(default=0)
    avg_duration_seconds = models.FloatField(default=0)
    min_duration_seconds = models.FloatField(null=True, blank=True)
    max_duration_seconds = models.FloatField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'admin_dashboard'
        db_table = 'activity_duration_metrics'
        managed = False


class StageDurationMetric(models.Model):
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name='+')
    total_completions = models.IntegerField(default=0)
    total_duration_seconds = models.FloatField(default=0)
    avg_duration_seconds = models.FloatField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'admin_dashboard'
        db_table = 'stage_duration_metrics'
        managed = False


class TopicSelectionMetric(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='+')
    selection_count = models.IntegerField(default=0)
    last_selected_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'admin_dashboard'
        db_table = 'topic_selection_metrics'
        managed = False


class ChallengeSelectionMetric(models.Model):
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='+')
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='+')
    selection_count = models.IntegerField(default=0)
    avg_tokens_earned = models.FloatField(default=0)
    last_selected_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'admin_dashboard'
        db_table = 'challenge_selection_metrics'
        managed = False


class DailyMetricsSnapshot(models.Model):
    date = models.DateField(unique=True)
    games_completed = models.IntegerField(default=0)
    new_professors = models.IntegerField(default=0)
    new_students = models.IntegerField(default=0)
    total_sessions = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'admin_dashboard'
        db_table = 'daily_metrics_snapshots'
        managed = False
