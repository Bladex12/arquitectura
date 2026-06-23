"""
Admin para admin_dashboard
"""
from django.contrib import admin
from .models import (
    ActivityDurationMetric, StageDurationMetric,
    TopicSelectionMetric, ChallengeSelectionMetric, DailyMetricsSnapshot
)


@admin.register(ActivityDurationMetric)
class ActivityDurationMetricAdmin(admin.ModelAdmin):
    list_display = ['activity', 'stage', 'total_completions', 'avg_duration_seconds', 'last_updated']
    list_filter = ['stage', 'last_updated']
    search_fields = ['activity__name', 'stage__name']
    readonly_fields = ['last_updated']


@admin.register(StageDurationMetric)
class StageDurationMetricAdmin(admin.ModelAdmin):
    list_display = ['stage', 'total_completions', 'avg_duration_seconds', 'last_updated']
    list_filter = ['last_updated']
    search_fields = ['stage__name']
    readonly_fields = ['last_updated']


@admin.register(TopicSelectionMetric)
class TopicSelectionMetricAdmin(admin.ModelAdmin):
    list_display = ['topic', 'selection_count', 'last_selected_at']
    list_filter = ['last_selected_at']
    search_fields = ['topic__name']
    readonly_fields = ['last_selected_at']


@admin.register(ChallengeSelectionMetric)
class ChallengeSelectionMetricAdmin(admin.ModelAdmin):
    list_display = ['challenge', 'topic', 'selection_count', 'avg_tokens_earned', 'last_selected_at']
    list_filter = ['topic', 'last_selected_at']
    search_fields = ['challenge__title', 'topic__name']
    readonly_fields = ['last_selected_at']


@admin.register(DailyMetricsSnapshot)
class DailyMetricsSnapshotAdmin(admin.ModelAdmin):
    list_display = ['date', 'games_completed', 'new_professors', 'new_students', 'total_sessions', 'created_at']
    list_filter = ['date', 'created_at']
    search_fields = ['date']
    readonly_fields = ['created_at']
    ordering = ['-date']

