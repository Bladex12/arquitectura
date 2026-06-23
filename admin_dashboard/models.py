"""
Modelos para cachear y optimizar métricas del dashboard
Estos modelos se actualizan automáticamente cuando ocurren eventos en el juego
"""
from django.db import models
from django.utils import timezone
from datetime import timedelta


class ActivityDurationMetric(models.Model):
    """
    Métrica cacheada: Duración promedio de actividades
    Se actualiza cuando un equipo completa una actividad
    """
    activity = models.ForeignKey(
        'challenges.Activity',
        on_delete=models.CASCADE,
        related_name='duration_metrics',
        verbose_name='Actividad'
    )
    stage = models.ForeignKey(
        'challenges.Stage',
        on_delete=models.CASCADE,
        related_name='activity_duration_metrics',
        verbose_name='Etapa'
    )
    
    # Métricas agregadas
    total_completions = models.IntegerField(
        default=0,
        verbose_name='Total de Completaciones'
    )
    total_duration_seconds = models.FloatField(
        default=0,
        verbose_name='Duración Total (segundos)'
    )
    avg_duration_seconds = models.FloatField(
        default=0,
        verbose_name='Duración Promedio (segundos)'
    )
    min_duration_seconds = models.FloatField(
        null=True,
        blank=True,
        verbose_name='Duración Mínima (segundos)'
    )
    max_duration_seconds = models.FloatField(
        null=True,
        blank=True,
        verbose_name='Duración Máxima (segundos)'
    )
    
    # Última actualización
    last_updated = models.DateTimeField(
        auto_now=True,
        verbose_name='Última Actualización'
    )
    
    class Meta:
        db_table = 'activity_duration_metrics'
        verbose_name = 'Métrica de Duración de Actividad'
        verbose_name_plural = 'Métricas de Duración de Actividades'
        unique_together = [['activity', 'stage']]
        indexes = [
            models.Index(fields=['activity']),
            models.Index(fields=['stage']),
        ]
    
    def __str__(self):
        return f"{self.activity.name} - {self.avg_duration_seconds}s"


class StageDurationMetric(models.Model):
    """
    Métrica cacheada: Duración promedio de etapas
    Se actualiza cuando una sesión completa una etapa
    """
    stage = models.ForeignKey(
        'challenges.Stage',
        on_delete=models.CASCADE,
        related_name='duration_metrics',
        verbose_name='Etapa'
    )
    
    total_completions = models.IntegerField(
        default=0,
        verbose_name='Total de Completaciones'
    )
    total_duration_seconds = models.FloatField(
        default=0,
        verbose_name='Duración Total (segundos)'
    )
    avg_duration_seconds = models.FloatField(
        default=0,
        verbose_name='Duración Promedio (segundos)'
    )
    
    last_updated = models.DateTimeField(
        auto_now=True,
        verbose_name='Última Actualización'
    )
    
    class Meta:
        db_table = 'stage_duration_metrics'
        verbose_name = 'Métrica de Duración de Etapa'
        verbose_name_plural = 'Métricas de Duración de Etapas'
        unique_together = [['stage']]
    
    def __str__(self):
        return f"{self.stage.name} - {self.avg_duration_seconds}s"


class TopicSelectionMetric(models.Model):
    """
    Métrica cacheada: Conteo de selecciones de temas
    Se actualiza cuando un equipo selecciona un tema
    """
    topic = models.ForeignKey(
        'challenges.Topic',
        on_delete=models.CASCADE,
        related_name='selection_metrics',
        verbose_name='Tema'
    )
    
    selection_count = models.IntegerField(
        default=0,
        verbose_name='Total de Selecciones'
    )
    last_selected_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Última Selección'
    )
    
    class Meta:
        db_table = 'topic_selection_metrics'
        verbose_name = 'Métrica de Selección de Tema'
        verbose_name_plural = 'Métricas de Selección de Temas'
        unique_together = [['topic']]
    
    def __str__(self):
        return f"{self.topic.name} - {self.selection_count} selecciones"


class ChallengeSelectionMetric(models.Model):
    """
    Métrica cacheada: Conteo de selecciones de desafíos
    Se actualiza cuando un equipo selecciona un desafío
    """
    challenge = models.ForeignKey(
        'challenges.Challenge',
        on_delete=models.CASCADE,
        related_name='selection_metrics',
        verbose_name='Desafío'
    )
    topic = models.ForeignKey(
        'challenges.Topic',
        on_delete=models.CASCADE,
        related_name='challenge_selection_metrics',
        verbose_name='Tema'
    )
    
    selection_count = models.IntegerField(
        default=0,
        verbose_name='Total de Selecciones'
    )
    avg_tokens_earned = models.FloatField(
        default=0,
        verbose_name='Tokens Promedio Obtenidos'
    )
    last_selected_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Última Selección'
    )
    
    class Meta:
        db_table = 'challenge_selection_metrics'
        verbose_name = 'Métrica de Selección de Desafío'
        verbose_name_plural = 'Métricas de Selección de Desafíos'
        unique_together = [['challenge']]
    
    def __str__(self):
        return f"{self.challenge.title} - {self.selection_count} selecciones"


class DailyMetricsSnapshot(models.Model):
    """
    Snapshot diario de métricas agregadas
    Se genera automáticamente cada día para consultas rápidas de series temporales
    """
    date = models.DateField(
        unique=True,
        verbose_name='Fecha'
    )
    
    # Métricas del día
    games_completed = models.IntegerField(
        default=0,
        verbose_name='Juegos Completados'
    )
    new_professors = models.IntegerField(
        default=0,
        verbose_name='Nuevos Profesores'
    )
    new_students = models.IntegerField(
        default=0,
        verbose_name='Nuevos Estudiantes'
    )
    total_sessions = models.IntegerField(
        default=0,
        verbose_name='Total de Sesiones'
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Creado en'
    )
    
    class Meta:
        db_table = 'daily_metrics_snapshots'
        verbose_name = 'Snapshot Diario de Métricas'
        verbose_name_plural = 'Snapshots Diarios de Métricas'
        ordering = ['-date']
        indexes = [
            models.Index(fields=['date']),
        ]
    
    def __str__(self):
        return f"Snapshot {self.date} - {self.games_completed} juegos"

