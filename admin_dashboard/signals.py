"""
Señales para actualizar métricas automáticamente
cuando ocurren eventos en el juego
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from game_sessions.models import TeamActivityProgress, SessionStage
from .models import (
    ActivityDurationMetric, StageDurationMetric,
    TopicSelectionMetric, ChallengeSelectionMetric
)


@receiver(post_save, sender=TeamActivityProgress)
def update_activity_duration_metric(sender, instance, created, **kwargs):
    """
    Actualizar métrica de duración cuando un equipo completa una actividad
    """
    if instance.status == 'completed' and instance.completed_at and instance.started_at:
        duration_seconds = (instance.completed_at - instance.started_at).total_seconds()
        
        metric, _ = ActivityDurationMetric.objects.get_or_create(
            activity=instance.activity,
            stage=instance.session_stage.stage,
            defaults={
                'total_completions': 0,
                'total_duration_seconds': 0,
            }
        )
        
        metric.total_completions += 1
        metric.total_duration_seconds += duration_seconds
        metric.avg_duration_seconds = metric.total_duration_seconds / metric.total_completions
        
        if metric.min_duration_seconds is None or duration_seconds < metric.min_duration_seconds:
            metric.min_duration_seconds = duration_seconds
        if metric.max_duration_seconds is None or duration_seconds > metric.max_duration_seconds:
            metric.max_duration_seconds = duration_seconds
        
        metric.save()
    
    # Actualizar métricas de selección de tema/desafío
    if instance.selected_topic:
        topic_metric, _ = TopicSelectionMetric.objects.get_or_create(
            topic=instance.selected_topic,
            defaults={'selection_count': 0}
        )
        topic_metric.selection_count += 1
        topic_metric.last_selected_at = timezone.now()
        topic_metric.save()
    
    if instance.selected_challenge:
        challenge_metric, _ = ChallengeSelectionMetric.objects.get_or_create(
            challenge=instance.selected_challenge,
            topic=instance.selected_challenge.topic,
            defaults={
                'selection_count': 0,
                'avg_tokens_earned': 0,
            }
        )
        challenge_metric.selection_count += 1
        challenge_metric.last_selected_at = timezone.now()
        # Calcular tokens promedio (si hay datos de tokens)
        challenge_metric.save()


@receiver(post_save, sender=SessionStage)
def update_stage_duration_metric(sender, instance, created, **kwargs):
    """
    Actualizar métrica de duración cuando una sesión completa una etapa
    """
    if instance.status == 'completed' and instance.completed_at and instance.started_at:
        duration_seconds = (instance.completed_at - instance.started_at).total_seconds()
        
        metric, _ = StageDurationMetric.objects.get_or_create(
            stage=instance.stage,
            defaults={
                'total_completions': 0,
                'total_duration_seconds': 0,
            }
        )
        
        metric.total_completions += 1
        metric.total_duration_seconds += duration_seconds
        metric.avg_duration_seconds = metric.total_duration_seconds / metric.total_completions
        metric.save()

