"""
ViewSets para el Dashboard Administrativo
Completamente separado del flujo del juego
Solo lectura (GET) - No modifica ningún modelo
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q, Avg, Min, Max, F, Sum, Func, Value, IntegerField, OuterRef, Subquery
from django.db.models.functions import ExtractYear, ExtractMonth, ExtractWeek, ExtractDay, TruncDate
from django.utils import timezone
from datetime import timedelta, datetime, date
from collections import Counter
import json

from users.models import Administrator, Professor, Student
from game_sessions.models import (
    GameSession, Team, TeamStudent, SessionStage, 
    TeamActivityProgress, ReflectionEvaluation, TokenTransaction
)
from challenges.models import Topic, Challenge, Activity, Stage
from academic.models import Faculty, Career, Course
from .models import (
    ActivityDurationMetric, StageDurationMetric,
    TopicSelectionMetric, ChallengeSelectionMetric, DailyMetricsSnapshot
)


class AdminDashboardViewSet(viewsets.ViewSet):
    """
    ViewSet SOLO para Dashboard Administrativo
    - Solo métodos GET (lectura)
    - Requiere autenticación y ser administrador
    - NO modifica ningún modelo
    - NO afecta el flujo del juego
    """
    permission_classes = [IsAuthenticated]
    
    def _check_admin(self, request):
        """Verificar que el usuario sea administrador"""
        try:
            request.user.administrator
            return True
        except Administrator.DoesNotExist:
            return False
    
    # ============================================
    # TARJETAS DE MÉTRICAS (KPI)
    # ============================================
    
    @action(detail=False, methods=['get'])
    def metrics(self, request):
        """Métricas generales del dashboard"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Total de alumnos que han jugado (estudiantes únicos en TeamStudent)
        total_students_played = TeamStudent.objects.values('student').distinct().count()
        
        # Total de profesores registrados (todos los profesores, no solo los que tienen sesiones)
        total_professors_active = Professor.objects.count()
        
        # Total de sesiones creadas
        total_sessions_created = GameSession.objects.count()
        
        # Total de sesiones completadas
        total_sessions_completed = GameSession.objects.filter(status='completed').count()
        
        # Sesiones en curso
        total_sessions_running = GameSession.objects.filter(status='running').count()
        
        # Tasa de completitud
        completion_rate = (
            (total_sessions_completed / total_sessions_created * 100) 
            if total_sessions_created > 0 else 0
        )
        
        return Response({
            'total_students_played': total_students_played,
            'total_professors_active': total_professors_active,
            'total_sessions_created': total_sessions_created,
            'total_sessions_completed': total_sessions_completed,
            'total_sessions_running': total_sessions_running,
            'completion_rate': round(completion_rate, 2)
        })
    
    # ============================================
    # GRÁFICOS TEMPORALES (con filtros)
    # ============================================
    
    @action(detail=False, methods=['get'])
    def time_series(self, request):
        """
        Gráficos temporales: juegos, profesores, estudiantes
        Query params: metric (games|professors|students), period (year|month|week|day)
        """
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            metric = request.query_params.get('metric', 'games')
            period = request.query_params.get('period', 'month')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            
            data = []
            
            if metric == 'games':
                # Juegos realizados (sesiones completadas o cualquier sesión creada)
                # Incluir todas las sesiones, no solo las completadas, para ver la actividad
                queryset = GameSession.objects.all()
                
                if start_date:
                    queryset = queryset.filter(created_at__gte=start_date)
                if end_date:
                    queryset = queryset.filter(created_at__lte=end_date)
                
                try:
                    # Siempre procesar la consulta, incluso si no hay datos
                    # MySQL con timezone tiene problemas con ExtractYear/ExtractMonth/TruncDate
                    # Agrupar manualmente en Python
                    # Forzar evaluación del queryset
                    sessions_list = list(queryset)
                    from collections import defaultdict
                    
                    if period == 'year':
                        year_data = defaultdict(int)
                        for session in sessions_list:
                            if session.created_at:
                                dt = session.created_at
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                year = dt.year
                                year_data[str(year)] += 1
                        data = [{'period': k, 'count': v} for k, v in sorted(year_data.items())]
                    elif period == 'month':
                        # Agrupar manualmente por año-mes
                        month_data = defaultdict(int)
                        for session in sessions_list:
                            if session.created_at:
                                dt = session.created_at
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                period_key = f"{dt.year}-{dt.month:02d}"
                                month_data[period_key] += 1
                        data = [{'period': k, 'count': v} for k, v in sorted(month_data.items())]
                    elif period == 'week':
                        # Agrupar manualmente por semana
                        week_data = defaultdict(int)
                        for session in sessions_list:
                            if session.created_at:
                                dt = session.created_at
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                year, week, _ = dt.isocalendar()
                                key = f"{year}-W{week:02d}"
                                week_data[key] += 1
                        data = [{'period': k, 'count': v} for k, v in sorted(week_data.items())]
                    else:  # day
                        day_data = defaultdict(int)
                        for session in sessions_list:
                            if session.created_at:
                                dt = session.created_at
                                # Convertir a naive datetime si es aware
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                # Formatear como YYYY-MM-DD
                                period_key = dt.strftime('%Y-%m-%d')
                                day_data[period_key] += 1
                        # Convertir a lista ordenada
                        data = [{'period': k, 'count': v} for k, v in sorted(day_data.items())]
                except Exception as e:
                    import traceback
                    print(f"Error en consulta de games: {e}")
                    print(traceback.format_exc())
                    data = []
            
            elif metric == 'professors':
                # Profesores nuevos (primera sesión creada)
                # Obtener profesores con su primera sesión
                professors = Professor.objects.annotate(
                    first_session_date=Min('game_sessions__created_at')
                ).filter(first_session_date__isnull=False)
                
                if start_date:
                    professors = professors.filter(first_session_date__gte=start_date)
                if end_date:
                    professors = professors.filter(first_session_date__lte=end_date)
                
                # Agrupar manualmente en Python (MySQL con timezone tiene problemas)
                try:
                    # Forzar evaluación del queryset para que los campos anotados estén disponibles
                    professors_list = list(professors)
                    from collections import defaultdict
                    
                    if period == 'year':
                        year_data = defaultdict(int)
                        for prof in professors_list:
                            if prof.first_session_date:
                                dt = prof.first_session_date
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                year_data[str(dt.year)] += 1
                        data = [{'period': k, 'count': v} for k, v in sorted(year_data.items())]
                    elif period == 'month':
                        month_data = defaultdict(int)
                        for prof in professors_list:
                            if prof.first_session_date:
                                dt = prof.first_session_date
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                period_key = f"{dt.year}-{dt.month:02d}"
                                month_data[period_key] += 1
                        data = [{'period': k, 'count': v} for k, v in sorted(month_data.items())]
                    elif period == 'week':
                        week_data = defaultdict(int)
                        for prof in professors_list:
                            if prof.first_session_date:
                                dt = prof.first_session_date
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                year, week, _ = dt.isocalendar()
                                key = f"{year}-W{week:02d}"
                                week_data[key] += 1
                        data = [{'period': k, 'count': v} for k, v in sorted(week_data.items())]
                    else:  # day
                        day_data = defaultdict(int)
                        for prof in professors_list:
                            if prof.first_session_date:
                                dt = prof.first_session_date
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                period_key = dt.strftime('%Y-%m-%d')
                                day_data[period_key] += 1
                        data = [{'period': k, 'count': v} for k, v in sorted(day_data.items())]
                except Exception as e:
                    import traceback
                    print(f"Error en consulta de professors: {e}")
                    print(traceback.format_exc())
                    data = []
            
            elif metric == 'students':
                # Estudiantes nuevos (primera participación)
                # Obtener estudiantes con su primera fecha de juego
                students = Student.objects.annotate(
                    first_play_date=Min('team_students__team__game_session__created_at')
                ).filter(first_play_date__isnull=False)
                
                if start_date:
                    students = students.filter(first_play_date__gte=start_date)
                if end_date:
                    students = students.filter(first_play_date__lte=end_date)
                
                # Agrupar manualmente en Python (MySQL con timezone tiene problemas)
                try:
                    # Forzar evaluación del queryset para que los campos anotados estén disponibles
                    students_list = list(students)
                    from collections import defaultdict
                    
                    if period == 'year':
                        year_data = defaultdict(int)
                        for student in students_list:
                            if student.first_play_date:
                                dt = student.first_play_date
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                year_data[str(dt.year)] += 1
                        data = [{'period': k, 'count': v} for k, v in sorted(year_data.items())]
                    elif period == 'month':
                        month_data = defaultdict(int)
                        for student in students_list:
                            if student.first_play_date:
                                dt = student.first_play_date
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                period_key = f"{dt.year}-{dt.month:02d}"
                                month_data[period_key] += 1
                        data = [{'period': k, 'count': v} for k, v in sorted(month_data.items())]
                    elif period == 'week':
                        week_data = defaultdict(int)
                        for student in students_list:
                            if student.first_play_date:
                                dt = student.first_play_date
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                year, week, _ = dt.isocalendar()
                                key = f"{year}-W{week:02d}"
                                week_data[key] += 1
                        data = [{'period': k, 'count': v} for k, v in sorted(week_data.items())]
                    else:  # day
                        day_data = defaultdict(int)
                        for student in students_list:
                            if student.first_play_date:
                                dt = student.first_play_date
                                if timezone.is_aware(dt):
                                    dt = timezone.make_naive(dt)
                                period_key = dt.strftime('%Y-%m-%d')
                                day_data[period_key] += 1
                        data = [{'period': k, 'count': v} for k, v in sorted(day_data.items())]
                except Exception as e:
                    import traceback
                    print(f"Error en consulta de students: {e}")
                    print(traceback.format_exc())
                    data = []
            
            return Response({
                'metric': metric,
                'period': period,
                'data': data
            })
        except Exception as e:
            import traceback
            print(f"Error en time_series: {e}")
            print(traceback.format_exc())
            return Response(
                {
                    'error': 'Error al obtener series temporales',
                    'detail': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    # ============================================
    # COMPLETACIÓN DE JUEGOS
    # ============================================
    
    @action(detail=False, methods=['get'])
    def game_completion(self, request):
        """Gráfico de torta: Completación de juegos"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        total = GameSession.objects.count()
        completed = GameSession.objects.filter(status='completed').count()
        cancelled = GameSession.objects.filter(status='cancelled').count()
        
        # Calcular porcentajes solo con completadas y canceladas
        total_for_percentage = completed + cancelled
        
        return Response({
            'total': total,
            'completed': {
                'count': completed,
                'percentage': round((completed / total_for_percentage * 100) if total_for_percentage > 0 else 0, 2)
            },
            'cancelled': {
                'count': cancelled,
                'percentage': round((cancelled / total_for_percentage * 100) if total_for_percentage > 0 else 0, 2)
            }
        })
    
    # ============================================
    # GRÁFICOS INTERACTIVOS - DURACIÓN
    # ============================================
    
    @action(detail=False, methods=['get'])
    def stage_duration(self, request):
        """Duración promedio por etapa"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Calcular duración promedio por etapa usando métricas cacheadas o datos en tiempo real
        stages = Stage.objects.all().order_by('number')
        data = []
        
        for stage in stages:
            # Intentar usar métrica cacheada primero
            metric = StageDurationMetric.objects.filter(stage=stage).first()
            
            if metric and metric.total_completions > 0:
                avg_duration = metric.avg_duration_seconds
            else:
                # Calcular en tiempo real
                session_stages = SessionStage.objects.filter(
                    stage=stage,
                    status='completed',
                    completed_at__isnull=False,
                    started_at__isnull=False
                )
                
                durations = []
                for ss in session_stages:
                    if ss.completed_at and ss.started_at:
                        duration = (ss.completed_at - ss.started_at).total_seconds()
                        durations.append(duration)
                
                avg_duration = sum(durations) / len(durations) if durations else 0
            
            data.append({
                'stage_id': stage.id,
                'stage_number': stage.number,
                'stage_name': stage.name,
                'avg_duration_seconds': round(avg_duration, 2)
            })
        
        return Response({
            'stages': data
        })
    
    @action(detail=True, methods=['get'])
    def stage_activities_duration(self, request, pk=None):
        """Duración promedio por actividad de una etapa específica"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            stage = Stage.objects.get(pk=pk)
        except Stage.DoesNotExist:
            return Response(
                {'error': 'Etapa no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Obtener actividades de esta etapa
        activities = Activity.objects.filter(stage=stage).order_by('order_number')
        data = []
        
        for activity in activities:
            # Intentar usar métrica cacheada
            metric = ActivityDurationMetric.objects.filter(
                activity=activity,
                stage=stage
            ).first()
            
            if metric and metric.total_completions > 0:
                avg_duration = metric.avg_duration_seconds
            else:
                # Calcular en tiempo real
                progresses = TeamActivityProgress.objects.filter(
                    activity=activity,
                    session_stage__stage=stage,
                    status='completed',
                    completed_at__isnull=False,
                    started_at__isnull=False
                )
                
                durations = []
                for progress in progresses:
                    if progress.completed_at and progress.started_at:
                        duration = (progress.completed_at - progress.started_at).total_seconds()
                        durations.append(duration)
                
                avg_duration = sum(durations) / len(durations) if durations else 0
            
            data.append({
                'activity_id': activity.id,
                'activity_name': activity.name,
                'activity_order': activity.order_number,
                'avg_duration_seconds': round(avg_duration, 2)
            })
        
        return Response({
            'stage_id': stage.id,
            'stage_name': stage.name,
            'activities': data
        })
    
    @action(detail=True, methods=['get'])
    def activity_duration_analysis(self, request, pk=None):
        """Análisis detallado de duración de una actividad"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return Response(
                {'error': 'Actividad no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Obtener todos los progresos completados de esta actividad
        progresses = TeamActivityProgress.objects.filter(
            activity=activity,
            status='completed',
            completed_at__isnull=False,
            started_at__isnull=False
        )
        
        durations = []
        for progress in progresses:
            if progress.completed_at and progress.started_at:
                duration = (progress.completed_at - progress.started_at).total_seconds()
                durations.append(duration)
        
        if not durations:
            return Response({
                'activity_id': activity.id,
                'activity_name': activity.name,
                'histogram': [],
                'statistics': {
                    'min': 0,
                    'max': 0,
                    'avg': 0,
                    'median': 0
                },
                'time_series': [],
                'comparison': []
            })
        
        # Estadísticas
        durations_sorted = sorted(durations)
        n = len(durations_sorted)
        median = durations_sorted[n // 2] if n > 0 else 0
        
        statistics = {
            'min': round(min(durations), 2),
            'max': round(max(durations), 2),
            'avg': round(sum(durations) / len(durations), 2),
            'median': round(median, 2),
            'total_samples': n
        }
        
        # Histograma (10 bins)
        min_val = min(durations)
        max_val = max(durations)
        bin_size = (max_val - min_val) / 10 if max_val > min_val else 1
        histogram = [0] * 10
        for duration in durations:
            bin_index = min(int((duration - min_val) / bin_size), 9)
            histogram[bin_index] += 1
        
        histogram_data = [
            {
                'bin_start': round(min_val + i * bin_size, 2),
                'bin_end': round(min_val + (i + 1) * bin_size, 2),
                'count': histogram[i]
            }
            for i in range(10)
        ]
        
        # Serie temporal (agrupado por fecha de completación)
        # Calcular duración manualmente ya que Avg no funciona directamente con F() para fechas
        time_series_data = {}
        for progress in progresses:
            if progress.completed_at and progress.started_at:
                date = progress.completed_at.date()
                duration = (progress.completed_at - progress.started_at).total_seconds()
                if date not in time_series_data:
                    time_series_data[date] = {'durations': [], 'count': 0}
                time_series_data[date]['durations'].append(duration)
                time_series_data[date]['count'] += 1
        
        time_series = [
            {
                'date': str(date),
                'avg_duration': round(sum(data['durations']) / len(data['durations']), 2),
                'count': data['count']
            }
            for date, data in sorted(time_series_data.items())
        ]
        
        # Comparación con otras actividades de la misma etapa
        other_activities = Activity.objects.filter(
            stage=activity.stage
        ).exclude(id=activity.id)
        
        comparison = []
        for other_activity in other_activities:
            other_progresses = TeamActivityProgress.objects.filter(
                activity=other_activity,
                status='completed',
                completed_at__isnull=False,
                started_at__isnull=False
            )
            other_durations = []
            for progress in other_progresses:
                if progress.completed_at and progress.started_at:
                    duration = (progress.completed_at - progress.started_at).total_seconds()
                    other_durations.append(duration)
            
            if other_durations:
                comparison.append({
                    'activity_id': other_activity.id,
                    'activity_name': other_activity.name,
                    'avg_duration_seconds': round(sum(other_durations) / len(other_durations), 2)
                })
        
        return Response({
            'activity_id': activity.id,
            'activity_name': activity.name,
            'histogram': histogram_data,
            'statistics': statistics,
            'time_series': time_series,
            'comparison': comparison
        })
    
    # ============================================
    # GRÁFICOS INTERACTIVOS - TEMAS Y DESAFÍOS
    # ============================================
    
    @action(detail=False, methods=['get'])
    def topics_selection(self, request):
        """Temas más seleccionados"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Usar métricas cacheadas o calcular en tiempo real
        topics = Topic.objects.filter(is_active=True)
        data = []
        
        for topic in topics:
            metric = TopicSelectionMetric.objects.filter(topic=topic).first()
            
            if metric:
                selection_count = metric.selection_count
            else:
                # Calcular en tiempo real
                selection_count = TeamActivityProgress.objects.filter(
                    selected_topic=topic
                ).count()
            
            data.append({
                'topic_id': topic.id,
                'topic_name': topic.name,
                'selection_count': selection_count
            })
        
        # Ordenar por selecciones
        data.sort(key=lambda x: x['selection_count'], reverse=True)
        
        return Response({
            'topics': data
        })
    
    @action(detail=True, methods=['get'])
    def topic_challenges(self, request, pk=None):
        """Desafíos más elegidos de un tema"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            topic = Topic.objects.get(pk=pk)
        except Topic.DoesNotExist:
            return Response(
                {'error': 'Tema no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Obtener desafíos de este tema
        challenges = Challenge.objects.filter(topic=topic, is_active=True)
        data = []
        
        for challenge in challenges:
            metric = ChallengeSelectionMetric.objects.filter(challenge=challenge).first()
            
            if metric:
                selection_count = metric.selection_count
                avg_tokens = metric.avg_tokens_earned
            else:
                # Calcular en tiempo real
                selection_count = TeamActivityProgress.objects.filter(
                    selected_challenge=challenge
                ).count()
                avg_tokens = 0  # TODO: calcular tokens promedio
            
            data.append({
                'challenge_id': challenge.id,
                'challenge_title': challenge.title,
                'selection_count': selection_count,
                'avg_tokens_earned': round(avg_tokens, 2)
            })
        
        # Ordenar por selecciones
        data.sort(key=lambda x: x['selection_count'], reverse=True)
        
        return Response({
            'topic_id': topic.id,
            'topic_name': topic.name,
            'challenges': data
        })
    
    @action(detail=True, methods=['get'])
    def challenge_analysis(self, request, pk=None):
        """Análisis detallado de un desafío"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            challenge = Challenge.objects.get(pk=pk)
        except Challenge.DoesNotExist:
            return Response(
                {'error': 'Desafío no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Obtener todas las selecciones de este desafío
        selections = TeamActivityProgress.objects.filter(
            selected_challenge=challenge
        ).select_related('team', 'team__game_session', 'session_stage')
        
        # Frecuencia de selección en el tiempo
        frequency_time_series = list(
            selections.annotate(
                date=TruncDate('completed_at')
            ).values('date').annotate(
                count=Count('id')
            ).order_by('date')
        )
        
        # Sesiones que lo usaron
        sessions_used = GameSession.objects.filter(
            teams__activity_progress__selected_challenge=challenge
        ).distinct().values('id', 'room_code', 'created_at', 'status')
        
        # Tokens promedio obtenidos (TODO: implementar cálculo real)
        avg_tokens = 0
        
        return Response({
            'challenge_id': challenge.id,
            'challenge_title': challenge.title,
            'selection_frequency': frequency_time_series,
            'sessions_used': list(sessions_used),
            'avg_tokens': round(avg_tokens, 2)
        })
    
    # ============================================
    # ANÁLISIS DE EVALUACIONES
    # ============================================
    
    @action(detail=False, methods=['get'])
    def evaluation_response_rate(self, request):
        """Tasa de respuesta de evaluaciones"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Total que jugaron
        total_played = TeamStudent.objects.values('student').distinct().count()
        
        # Total que respondieron
        total_responded = ReflectionEvaluation.objects.values('student_email').distinct().count()
        
        return Response({
            'total_played': total_played,
            'total_responded': total_responded,
            'response_rate': round((total_responded / total_played * 100) if total_played > 0 else 0, 2)
        })
    
    @action(detail=False, methods=['get'])
    def evaluation_answers(self, request):
        """Distribución de respuestas de evaluación"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Áreas de valor (múltiple selección)
        value_areas_counter = Counter()
        for eval in ReflectionEvaluation.objects.all():
            if eval.value_areas:
                value_areas_counter.update(eval.value_areas)
        
        # Satisfacción
        satisfaction_counts = ReflectionEvaluation.objects.values('satisfaction').annotate(
            count=Count('id')
        )
        
        # Interés en emprender
        interest_counts = ReflectionEvaluation.objects.values('entrepreneurship_interest').annotate(
            count=Count('id')
        )
        
        return Response({
            'value_areas': dict(value_areas_counter),
            'satisfaction': list(satisfaction_counts),
            'entrepreneurship_interest': list(interest_counts)
        })
    
    @action(detail=False, methods=['get'])
    def evaluation_comments(self, request):
        """Lista de comentarios de estudiantes (con filtros)"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        queryset = ReflectionEvaluation.objects.filter(
            comments__isnull=False
        ).exclude(comments='').select_related('game_session')
        
        # Filtros
        session_id = request.query_params.get('session_id')
        if session_id:
            queryset = queryset.filter(game_session_id=session_id)
        
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(comments__icontains=search)
        
        date_from = request.query_params.get('date_from')
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        
        queryset = queryset.order_by('-created_at')
        
        # Paginación
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        start = (page - 1) * page_size
        end = start + page_size
        
        total = queryset.count()
        comments = queryset[start:end]
        
        return Response({
            'total': total,
            'page': page,
            'page_size': page_size,
            'results': [
                {
                    'id': c.id,
                    'student_name': c.student_name,
                    'student_email': c.student_email,
                    'session_room_code': c.game_session.room_code,
                    'session_id': c.game_session.id,
                    'created_at': c.created_at,
                    'comment': c.comments
                }
                for c in comments
            ]
        })
    
    # ============================================
    # GRÁFICOS INTERACTIVOS - FACULTADES Y CARRERAS
    # ============================================
    
    @action(detail=False, methods=['get'])
    def faculties_games(self, request):
        """Juegos realizados por facultad"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Obtener todas las facultades
        faculties = Faculty.objects.filter(is_active=True)
        data = []
        
        for faculty in faculties:
            # Contar juegos a través de Course -> Career -> Faculty
            games_count = GameSession.objects.filter(
                course__career__faculty=faculty
            ).count()
            
            data.append({
                'faculty_id': faculty.id,
                'faculty_name': faculty.name,
                'games_count': games_count
            })
        
        # Ordenar por cantidad de juegos
        data.sort(key=lambda x: x['games_count'], reverse=True)
        
        return Response({
            'faculties': data
        })
    
    @action(detail=True, methods=['get'])
    def faculty_careers_games(self, request, pk=None):
        """Juegos realizados por carrera de una facultad"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            faculty = Faculty.objects.get(pk=pk)
        except Faculty.DoesNotExist:
            return Response(
                {'error': 'Facultad no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Obtener carreras de esta facultad
        careers = Career.objects.filter(faculty=faculty, is_active=True)
        data = []
        
        for career in careers:
            # Contar juegos a través de Course -> Career
            games_count = GameSession.objects.filter(
                course__career=career
            ).count()
            
            data.append({
                'career_id': career.id,
                'career_name': career.name,
                'games_count': games_count
            })
        
        # Ordenar por cantidad de juegos
        data.sort(key=lambda x: x['games_count'], reverse=True)
        
        return Response({
            'faculty_id': faculty.id,
            'faculty_name': faculty.name,
            'careers': data
        })
    
    @action(detail=False, methods=['get'])
    def cancellation_reasons(self, request):
        """Obtener motivos de cancelación de sesiones canceladas"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Obtener todas las sesiones canceladas con sus motivos
        cancelled_sessions = GameSession.objects.filter(
            status='cancelled'
        ).exclude(
            cancellation_reason__isnull=True
        ).exclude(
            cancellation_reason=''
        ).values(
            'cancellation_reason',
            'cancellation_reason_other'
        )
        
        # Convertir a lista para poder contar
        sessions_list = list(cancelled_sessions)
        total_cancelled = len(sessions_list)
        
        # Agrupar por motivo de cancelación
        reasons_counter = Counter()
        reasons_details = {}
        
        for session in sessions_list:
            reason = session['cancellation_reason'] or 'Sin motivo'
            other = session['cancellation_reason_other']
            
            reasons_counter[reason] += 1
            
            if reason not in reasons_details:
                reasons_details[reason] = {
                    'count': 0,
                    'examples': []
                }
            
            reasons_details[reason]['count'] += 1
            
            # Guardar ejemplos de "Otro" (máximo 5)
            if reason == 'Otro' and other and len(reasons_details[reason]['examples']) < 5:
                reasons_details[reason]['examples'].append(other)
        
        # Formatear respuesta
        reasons_data = []
        for reason, count in reasons_counter.most_common():
            reasons_data.append({
                'reason': reason,
                'count': count,
                'percentage': round((count / total_cancelled * 100) if total_cancelled > 0 else 0, 2),
                'examples': reasons_details.get(reason, {}).get('examples', [])
            })
        
        return Response({
            'total_cancelled': total_cancelled,
            'reasons': reasons_data
        })

