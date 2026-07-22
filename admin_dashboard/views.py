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
from collections import Counter, defaultdict
import json

from users.models import Administrator, Professor, Student
from game_sessions.dynamodb.game_session import scan_all_sessions
from game_sessions.dynamodb.team import scan_all_teams
from game_sessions.dynamodb.stage_progress import scan_all_stages, scan_all_progress
from game_sessions.dynamodb.evaluations import scan_all_reflections
from challenges.models import Topic, Challenge, Activity, Stage
from academic.models import Faculty, Career, Course
from .models import (
    ActivityDurationMetric, StageDurationMetric,
    TopicSelectionMetric, ChallengeSelectionMetric, DailyMetricsSnapshot
)


def _parse_iso(value):
    """Parsea un timestamp ISO-8601 de DynamoDB (o None) a datetime.
    Devuelve None si el valor está vacío o no es parseable. Los items de
    game_sessions guardan created_at/started_at/completed_at como strings
    ISO (game_sessions.dynamodb.client.now_iso), no como datetime, así que
    toda agregación temporal debe parsearlos primero."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _duration_seconds(item):
    """Duración en segundos entre started_at y completed_at de un item
    DynamoDB (SessionStage o TeamActivityProgress), o None si falta alguno
    de los dos timestamps."""
    started = _parse_iso(item.get('started_at'))
    completed = _parse_iso(item.get('completed_at'))
    if started is None or completed is None:
        return None
    return (completed - started).total_seconds()


def _naive_dt(dt):
    """Normaliza un datetime a naive (misma corrección de timezone que ya
    hacía el bucketing manual de time_series para MySQL)."""
    if dt is None:
        return None
    if timezone.is_aware(dt):
        return timezone.make_naive(dt)
    return dt


def _bucket_by_period(dts, period):
    """Agrupa una lista de datetime naive por year|month|week|day y devuelve
    [{'period': k, 'count': n}] ordenado. Mismo esquema de claves que el
    time_series original (default = day, para paridad exacta)."""
    buckets = defaultdict(int)
    for dt in dts:
        if dt is None:
            continue
        if period == 'year':
            key = str(dt.year)
        elif period == 'month':
            key = f"{dt.year}-{dt.month:02d}"
        elif period == 'week':
            year, week, _ = dt.isocalendar()
            key = f"{year}-W{week:02d}"
        else:  # day
            key = dt.strftime('%Y-%m-%d')
        buckets[key] += 1
    return [{'period': k, 'count': v} for k, v in sorted(buckets.items())]


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
        
        # Total de alumnos que han jugado (student_ids únicos en todos los equipos)
        total_students_played = len({
            sid for team in scan_all_teams() for sid in team.get('student_ids', [])
        })

        # Total de profesores registrados (todos los profesores, no solo los que tienen sesiones)
        total_professors_active = Professor.objects.count()

        # Sesiones (una sola Scan, se agregan los estados en Python)
        sessions = scan_all_sessions()
        total_sessions_created = len(sessions)
        total_sessions_completed = sum(1 for s in sessions if s.get('status') == 'completed')
        total_sessions_running = sum(1 for s in sessions if s.get('status') == 'running')
        
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
                # Juegos realizados: todas las sesiones por fecha de creación.
                event_dts = [
                    _naive_dt(_parse_iso(s.get('created_at')))
                    for s in scan_all_sessions() if s.get('created_at')
                ]
            elif metric == 'professors':
                # Profesores nuevos: fecha de la PRIMERA sesión de cada profesor
                # (equivale al Min('game_sessions__created_at') del ORM).
                first_by_professor = {}
                for s in scan_all_sessions():
                    pid = s.get('professor_id')
                    created = _naive_dt(_parse_iso(s.get('created_at')))
                    if pid is None or created is None:
                        continue
                    if pid not in first_by_professor or created < first_by_professor[pid]:
                        first_by_professor[pid] = created
                event_dts = list(first_by_professor.values())
            elif metric == 'students':
                # Estudiantes nuevos: primera participación de cada student_id
                # (equivale al Min('team_students__team__game_session__created_at')
                # del ORM). La fecha de juego de un estudiante es el created_at de
                # la sesión de cada equipo al que pertenece; nos quedamos con la
                # más temprana por estudiante.
                created_by_room = {}
                for s in scan_all_sessions():
                    created = _naive_dt(_parse_iso(s.get('created_at')))
                    if created is not None:
                        created_by_room[s['room_code']] = created
                first_by_student = {}
                for team in scan_all_teams():
                    created = created_by_room.get(team.get('room_code'))
                    if created is None:
                        continue
                    for sid in team.get('student_ids', []):
                        if sid not in first_by_student or created < first_by_student[sid]:
                            first_by_student[sid] = created
                event_dts = list(first_by_student.values())
            else:
                event_dts = []

            # Filtro de rango (misma semántica __gte/__lte que el ORM: límites
            # inclusivos a medianoche del día indicado).
            start_dt = _naive_dt(_parse_iso(start_date)) if start_date else None
            end_dt = _naive_dt(_parse_iso(end_date)) if end_date else None
            filtered = [
                dt for dt in event_dts
                if dt is not None
                and (start_dt is None or dt >= start_dt)
                and (end_dt is None or dt <= end_dt)
            ]
            data = _bucket_by_period(filtered, period)

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
        
        sessions = scan_all_sessions()
        total = len(sessions)
        completed = sum(1 for s in sessions if s.get('status') == 'completed')
        cancelled = sum(1 for s in sessions if s.get('status') == 'cancelled')

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
                # Fallback: calcular en tiempo real desde DynamoDB
                durations = []
                for ss in scan_all_stages(stage_id=stage.id):
                    if ss.get('status') != 'completed':
                        continue
                    duration = _duration_seconds(ss)
                    if duration is not None:
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
                # Fallback: calcular en tiempo real desde DynamoDB. Filtrar por
                # activity_id basta: una Activity pertenece a una sola Stage, así
                # que equivale al filtro activity+session_stage__stage del ORM.
                durations = []
                for progress in scan_all_progress(activity_id=activity.id):
                    if progress.get('status') != 'completed':
                        continue
                    duration = _duration_seconds(progress)
                    if duration is not None:
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
        
        # Una sola Scan de todos los progresos; se agrupa por activity_id en
        # Python (evita N+1 Scans para la comparación con otras actividades).
        all_progress = scan_all_progress()

        def _completed_pairs(items):
            """(item, duración) sólo para progresos completados con ambos
            timestamps presentes."""
            pairs = []
            for p in items:
                if p.get('status') != 'completed':
                    continue
                d = _duration_seconds(p)
                if d is not None:
                    pairs.append((p, d))
            return pairs

        target_pairs = _completed_pairs(
            [p for p in all_progress if p.get('activity_id') == activity.id]
        )
        durations = [d for _p, d in target_pairs]

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
        time_series_data = {}
        for progress, duration in target_pairs:
            completed = _parse_iso(progress.get('completed_at'))
            day = completed.date()
            if day not in time_series_data:
                time_series_data[day] = {'durations': [], 'count': 0}
            time_series_data[day]['durations'].append(duration)
            time_series_data[day]['count'] += 1

        time_series = [
            {
                'date': str(day),
                'avg_duration': round(sum(data['durations']) / len(data['durations']), 2),
                'count': data['count']
            }
            for day, data in sorted(time_series_data.items())
        ]

        # Comparación con otras actividades de la misma etapa
        other_activities = Activity.objects.filter(
            stage=activity.stage
        ).exclude(id=activity.id)

        progress_by_activity = defaultdict(list)
        for p in all_progress:
            progress_by_activity[p.get('activity_id')].append(p)

        comparison = []
        for other_activity in other_activities:
            other_durations = [
                d for _p, d in _completed_pairs(progress_by_activity.get(other_activity.id, []))
            ]
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
        
        # Preferir métricas cacheadas; sólo escanear DynamoDB si algún tema no
        # tiene métrica (fallback en tiempo real).
        topics = Topic.objects.filter(is_active=True)
        metrics_by_topic = {
            m.topic_id: m for m in TopicSelectionMetric.objects.filter(topic__in=topics)
        }
        topic_counts = None  # scan diferido
        data = []

        for topic in topics:
            metric = metrics_by_topic.get(topic.id)

            if metric:
                selection_count = metric.selection_count
            else:
                if topic_counts is None:
                    topic_counts = Counter(
                        p.get('selected_topic_id') for p in scan_all_progress()
                        if p.get('selected_topic_id') is not None
                    )
                selection_count = topic_counts.get(topic.id, 0)

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
        metrics_by_challenge = {
            m.challenge_id: m
            for m in ChallengeSelectionMetric.objects.filter(challenge__in=challenges)
        }
        challenge_counts = None  # scan diferido
        data = []

        for challenge in challenges:
            metric = metrics_by_challenge.get(challenge.id)

            if metric:
                selection_count = metric.selection_count
                avg_tokens = metric.avg_tokens_earned
            else:
                if challenge_counts is None:
                    challenge_counts = Counter(
                        p.get('selected_challenge_id') for p in scan_all_progress()
                        if p.get('selected_challenge_id') is not None
                    )
                selection_count = challenge_counts.get(challenge.id, 0)
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
        selections = [
            p for p in scan_all_progress()
            if p.get('selected_challenge_id') == challenge.id
        ]

        # Frecuencia de selección en el tiempo (agrupado por fecha de
        # completación; TruncDate del ORM dejaba NULL primero -> aquí None).
        freq_counts = Counter()
        for p in selections:
            completed = _parse_iso(p.get('completed_at'))
            freq_counts[completed.date() if completed else None] += 1
        frequency_time_series = [
            {'date': day, 'count': count}
            for day, count in sorted(
                freq_counts.items(),
                key=lambda kv: (kv[0] is not None, kv[0]),
            )
        ]

        # Sesiones que lo usaron (join DynamoDB por room_code; ya no hay id
        # entero, el room_code ES el identificador de la sesión).
        used_room_codes = {p.get('room_code') for p in selections if p.get('room_code')}
        sessions_by_room = {
            s['room_code']: s for s in scan_all_sessions()
            if s['room_code'] in used_room_codes
        }
        sessions_used = [
            {
                'id': s['room_code'],
                'room_code': s['room_code'],
                'created_at': s.get('created_at'),
                'status': s.get('status'),
            }
            for s in sorted(sessions_by_room.values(), key=lambda s: s['room_code'])
        ]

        # Tokens promedio obtenidos (TODO: implementar cálculo real)
        avg_tokens = 0

        return Response({
            'challenge_id': challenge.id,
            'challenge_title': challenge.title,
            'selection_frequency': frequency_time_series,
            'sessions_used': sessions_used,
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
        
        # Total que jugaron (student_ids únicos en todos los equipos)
        total_played = len({
            sid for team in scan_all_teams() for sid in team.get('student_ids', [])
        })

        # Total que respondieron (emails únicos en las reflexiones)
        total_responded = len({
            r.get('student_email') for r in scan_all_reflections()
            if r.get('student_email')
        })

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
        
        reflections = scan_all_reflections()

        # Áreas de valor (múltiple selección)
        value_areas_counter = Counter()
        for r in reflections:
            if r.get('value_areas'):
                value_areas_counter.update(r['value_areas'])

        # Satisfacción / interés en emprender (equivale a .values(...).annotate(Count))
        satisfaction_counter = Counter(r.get('satisfaction') for r in reflections)
        interest_counter = Counter(r.get('entrepreneurship_interest') for r in reflections)

        def _as_rows(counter, key):
            return [
                {key: value, 'count': count}
                for value, count in sorted(
                    counter.items(), key=lambda kv: (kv[0] is None, kv[0] or '')
                )
            ]

        return Response({
            'value_areas': dict(value_areas_counter),
            'satisfaction': _as_rows(satisfaction_counter, 'satisfaction'),
            'entrepreneurship_interest': _as_rows(interest_counter, 'entrepreneurship_interest')
        })
    
    @action(detail=False, methods=['get'])
    def evaluation_comments(self, request):
        """Lista de comentarios de estudiantes (con filtros)"""
        if not self._check_admin(request):
            return Response(
                {'error': 'Acceso denegado. Se requieren permisos de administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Sólo reflexiones con comentario no vacío (isnull=False + excluir '')
        reflections = [r for r in scan_all_reflections() if r.get('comments')]

        # Filtros (aplicados en Python sobre la lista materializada)
        # session_id se mapea a room_code: ya no existe el id entero de sesión,
        # el room_code ES el identificador y es lo que devolvemos como session_id.
        session_id = request.query_params.get('session_id')
        if session_id:
            reflections = [r for r in reflections if r.get('room_code') == session_id]

        search = request.query_params.get('search')
        if search:
            needle = search.lower()
            reflections = [r for r in reflections if needle in (r.get('comments') or '').lower()]

        date_from = request.query_params.get('date_from')
        if date_from:
            bound = _naive_dt(_parse_iso(date_from))
            if bound is not None:
                reflections = [
                    r for r in reflections
                    if (_naive_dt(_parse_iso(r.get('created_at'))) or datetime.min) >= bound
                ]

        # Orden descendente por created_at (ISO ordena cronológicamente)
        reflections.sort(key=lambda r: r.get('created_at') or '', reverse=True)

        # Paginación: se corta la lista materializada, no un queryset
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        start = (page - 1) * page_size
        end = start + page_size

        total = len(reflections)
        comments = reflections[start:end]

        return Response({
            'total': total,
            'page': page,
            'page_size': page_size,
            'results': [
                {
                    'id': c.get('reflection_id'),
                    'student_name': c.get('student_name'),
                    'student_email': c.get('student_email'),
                    'session_room_code': c.get('room_code'),
                    'session_id': c.get('room_code'),
                    'created_at': c.get('created_at'),
                    'comment': c.get('comments')
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
        
        # Escanear sesiones (DynamoDB) y hacer el join Course->Career->Faculty
        # por lotes en el ORM (una sola query id__in, no N+1).
        faculties = Faculty.objects.filter(is_active=True)
        sessions = scan_all_sessions()
        course_ids = {s.get('course_id') for s in sessions if s.get('course_id') is not None}
        course_to_faculty = dict(
            Course.objects.filter(id__in=course_ids).values_list('id', 'career__faculty_id')
        )
        faculty_counts = Counter(
            course_to_faculty.get(s.get('course_id')) for s in sessions
            if course_to_faculty.get(s.get('course_id')) is not None
        )

        data = [
            {
                'faculty_id': faculty.id,
                'faculty_name': faculty.name,
                'games_count': faculty_counts.get(faculty.id, 0)
            }
            for faculty in faculties
        ]
        
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
        
        # Escanear sesiones y hacer el join Course->Career por lotes (id__in).
        careers = Career.objects.filter(faculty=faculty, is_active=True)
        sessions = scan_all_sessions()
        course_ids = {s.get('course_id') for s in sessions if s.get('course_id') is not None}
        course_to_career = dict(
            Course.objects.filter(id__in=course_ids).values_list('id', 'career_id')
        )
        career_counts = Counter(
            course_to_career.get(s.get('course_id')) for s in sessions
            if course_to_career.get(s.get('course_id')) is not None
        )

        data = [
            {
                'career_id': career.id,
                'career_name': career.name,
                'games_count': career_counts.get(career.id, 0)
            }
            for career in careers
        ]
        
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
        
        # Sesiones canceladas con motivo (isnull=False + excluir '') filtradas
        # en Python desde el Scan por status='cancelled'.
        sessions_list = [
            s for s in scan_all_sessions(status='cancelled')
            if s.get('cancellation_reason')
        ]
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

