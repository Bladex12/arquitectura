"""
Admin para la app game_sessions
"""
from django.contrib import admin
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.urls import reverse
from .models import (
    SessionGroup, GameSession, Team, TeamStudent, TeamPersonalization,
    SessionStage, TeamActivityProgress, TeamBubbleMap, Tablet, TabletConnection,
    TeamRouletteAssignment, TokenTransaction, PeerEvaluation, ReflectionEvaluation
)


@admin.register(SessionGroup)
class SessionGroupAdmin(admin.ModelAdmin):
    list_display = ['id', 'professor', 'course', 'total_students', 'number_of_sessions', 'created_at_safe', 'game_sessions_count']
    list_filter = ['professor', 'course']  # Removido 'created_at' para evitar errores de timezone
    search_fields = ['professor__user__username', 'course__name']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-id']  # Ordenar por ID en lugar de fecha para evitar problemas con datetime
    # date_hierarchy removido temporalmente debido a problemas con timezone en MySQL
    
    def get_queryset(self, request):
        """
        Obtiene el queryset filtrando registros con valores datetime inválidos
        """
        qs = super().get_queryset(request)
        qs = qs.select_related('professor', 'professor__user', 'course').prefetch_related('game_sessions')
        return qs
    
    def changelist_view(self, request, extra_context=None):
        """
        Vista personalizada para manejar errores de datetime en el changelist
        """
        try:
            return super().changelist_view(request, extra_context=extra_context)
        except ValueError as e:
            if 'datetime' in str(e).lower() or 'time zone' in str(e).lower():
                # Si hay un error de datetime, mostrar un mensaje y redirigir
                messages.error(
                    request,
                    'Error al cargar la lista: hay valores de fecha/hora inválidos en la base de datos. '
                    'Por favor, contacte al administrador del sistema para corregir los datos.'
                )
                # Intentar mostrar la lista sin ordenar por fecha
                try:
                    # Forzar que no se ordene por created_at
                    request.GET = request.GET.copy()
                    if 'o' in request.GET:
                        # Remover ordenación por created_at si existe
                        ordering = request.GET.get('o', '')
                        if 'created_at' in ordering:
                            request.GET['o'] = '1'  # Ordenar solo por ID
                    return super().changelist_view(request, extra_context=extra_context)
                except Exception:
                    # Si aún falla, redirigir a la página principal del admin
                    return HttpResponseRedirect(reverse('admin:index'))
            raise
    
    def created_at_safe(self, obj):
        """Muestra created_at de forma segura, manejando valores inválidos"""
        try:
            if obj.created_at:
                return obj.created_at.strftime('%Y-%m-%d %H:%M:%S')
            return '-'
        except (ValueError, AttributeError, TypeError):
            return 'Fecha inválida'
    created_at_safe.short_description = 'Creado en'
    # No usar admin_order_field para evitar problemas con datetime inválidos
    
    def game_sessions_count(self, obj):
        """Muestra el número de sesiones asociadas al grupo"""
        return obj.game_sessions.count()
    game_sessions_count.short_description = 'Sesiones'
    
    def delete_model(self, request, obj):
        """
        Elimina el SessionGroup y todas sus GameSessions asociadas.
        El signal se encargará de eliminar el grupo automáticamente cuando se elimine la última sesión.
        """
        # Primero eliminamos todas las GameSessions del grupo
        # Esto activará el signal que eliminará el grupo automáticamente cuando se elimine la última sesión
        game_sessions = list(obj.game_sessions.all())
        for session in game_sessions:
            session.delete()
        
        # Si el grupo aún existe (no fue eliminado por el signal), lo eliminamos manualmente
        # Esto puede pasar si no había sesiones asociadas
        if SessionGroup.objects.filter(pk=obj.pk).exists():
            obj.delete()


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ['room_code', 'professor', 'course', 'session_group', 'status', 'started_at', 'created_at']
    list_filter = ['status', 'professor', 'course', 'session_group', 'created_at']
    search_fields = ['room_code', 'professor__user__username', 'course__name']
    readonly_fields = ['created_at', 'updated_at', 'qr_code']
    # date_hierarchy removido temporalmente debido a problemas con timezone en MySQL
    list_select_related = ['professor', 'professor__user', 'course', 'session_group', 'current_stage', 'current_activity']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('professor', 'professor__user', 'course', 'session_group', 'current_stage', 'current_activity')


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ['name', 'game_session', 'color', 'tokens_total', 'created_at']
    list_filter = ['game_session', 'color', 'created_at']
    search_fields = ['name', 'game_session__room_code']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('game_session')


@admin.register(TeamPersonalization)
class TeamPersonalizationAdmin(admin.ModelAdmin):
    list_display = ['team', 'team_name', 'team_members_know_each_other', 'created_at']
    list_filter = ['team_members_know_each_other', 'created_at']
    search_fields = ['team__name', 'team_name']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('team', 'team__game_session')


@admin.register(SessionStage)
class SessionStageAdmin(admin.ModelAdmin):
    list_display = ['game_session', 'stage', 'status', 'started_at', 'completed_at']
    list_filter = ['status', 'stage']
    search_fields = ['game_session__room_code', 'stage__name']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('game_session', 'stage')


@admin.register(TeamActivityProgress)
class TeamActivityProgressAdmin(admin.ModelAdmin):
    list_display = ['team', 'activity', 'status', 'progress_percentage', 'started_at']
    list_filter = ['status', 'activity']
    search_fields = ['team__name', 'activity__name']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('team', 'team__game_session', 'activity')


@admin.register(TeamBubbleMap)
class TeamBubbleMapAdmin(admin.ModelAdmin):
    list_display = ['team', 'session_stage', 'created_at', 'updated_at']
    list_filter = ['session_stage', 'created_at']
    search_fields = ['team__name', 'session_stage__stage__name']
    readonly_fields = ['created_at', 'updated_at']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('team', 'team__game_session', 'session_stage', 'session_stage__stage')


@admin.register(Tablet)
class TabletAdmin(admin.ModelAdmin):
    list_display = ['tablet_code', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['tablet_code']


@admin.register(TabletConnection)
class TabletConnectionAdmin(admin.ModelAdmin):
    list_display = ['tablet', 'team', 'game_session', 'connected_at', 'disconnected_at', 'last_seen']
    list_filter = ['game_session', 'connected_at']
    search_fields = ['tablet__tablet_code', 'team__name', 'game_session__room_code']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('tablet', 'team', 'game_session')


@admin.register(TeamRouletteAssignment)
class TeamRouletteAssignmentAdmin(admin.ModelAdmin):
    list_display = ['team', 'roulette_challenge', 'status', 'token_reward', 'assigned_at', 'validated_by']
    list_filter = ['status', 'assigned_at', 'validated_by']
    search_fields = ['team__name', 'roulette_challenge__description']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('team', 'team__game_session', 'roulette_challenge', 'validated_by')


@admin.register(TokenTransaction)
class TokenTransactionAdmin(admin.ModelAdmin):
    list_display = ['team', 'game_session', 'amount', 'source_type', 'created_at', 'awarded_by']
    list_filter = ['source_type', 'created_at', 'awarded_by']
    search_fields = ['team__name', 'game_session__room_code', 'reason']
    date_hierarchy = 'created_at'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('team', 'team__game_session', 'game_session', 'awarded_by')


@admin.register(ReflectionEvaluation)
class ReflectionEvaluationAdmin(admin.ModelAdmin):
    list_display = ['student_name', 'student_email', 'game_session', 'satisfaction', 'created_at']
    list_filter = ['satisfaction', 'entrepreneurship_interest', 'created_at', 'game_session']
    search_fields = ['student_name', 'student_email', 'career', 'game_session__room_code']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('game_session')


@admin.register(PeerEvaluation)
class PeerEvaluationAdmin(admin.ModelAdmin):
    list_display = ['evaluator_team', 'evaluated_team', 'game_session', 'total_score', 'tokens_awarded', 'submitted_at']
    list_filter = ['game_session', 'submitted_at']
    search_fields = ['evaluator_team__name', 'evaluated_team__name', 'game_session__room_code']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('evaluator_team', 'evaluated_team', 'game_session')
