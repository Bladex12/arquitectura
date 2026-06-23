"""
Serializers para la app game_sessions
"""
from rest_framework import serializers
from .models import (
    GameSession, Team, TeamStudent, TeamPersonalization,
    SessionStage, TeamActivityProgress, TeamBubbleMap, Tablet, TabletConnection,
    TeamRouletteAssignment, TokenTransaction, PeerEvaluation, ReflectionEvaluation
)
from users.serializers import ProfessorSerializer, StudentSerializer
from academic.serializers import CourseSerializer
from challenges.serializers import StageSerializer, ActivitySerializer


class GameSessionSerializer(serializers.ModelSerializer):
    """Serializer para Sesión de Juego"""
    professor_name = serializers.CharField(source='professor.user.get_full_name', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    current_stage_name = serializers.SerializerMethodField()
    current_stage_number = serializers.SerializerMethodField()
    current_activity_name = serializers.SerializerMethodField()
    current_session_stage = serializers.SerializerMethodField()
    teams_count = serializers.SerializerMethodField()

    def get_current_stage_name(self, obj):
        try:
            return obj.current_stage.name if obj.current_stage else None
        except Exception:
            return None

    def get_current_stage_number(self, obj):
        try:
            return obj.current_stage.number if obj.current_stage else None
        except Exception:
            return None

    def get_current_activity_name(self, obj):
        try:
            return obj.current_activity.name if obj.current_activity else None
        except Exception:
            return None

    def get_current_session_stage(self, obj):
        try:
            if not obj.current_stage:
                return None
            session_stage = SessionStage.objects.filter(game_session=obj, stage=obj.current_stage).first()
            return session_stage.id if session_stage else None
        except Exception:
            return None

    class Meta:
        model = GameSession
        fields = [
            'id', 'professor', 'professor_name', 'course', 'course_name',
            'room_code', 'qr_code', 'status', 'started_at', 'ended_at',
            'current_stage', 'current_stage_name', 'current_stage_number',
            'current_activity', 'current_activity_name', 'current_session_stage',
            'cancellation_reason', 'cancellation_reason_other',
            'show_results_stage',
            'teams_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'professor_name', 'course_name', 'qr_code', 'current_stage_name', 'current_stage_number', 'current_activity_name', 'current_session_stage', 'teams_count', 'created_at', 'updated_at', 'show_results_stage']
    
    def get_teams_count(self, obj):
        # Optimizar: usar prefetch_related si está disponible, sino usar count()
        if hasattr(obj, '_prefetched_objects_cache') and 'teams' in obj._prefetched_objects_cache:
            return len(obj._prefetched_objects_cache['teams'])
        return obj.teams.count()


class GameSessionCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear una Sesión de Juego"""
    class Meta:
        model = GameSession
        fields = ['professor', 'course', 'room_code']


class TeamSerializer(serializers.ModelSerializer):
    """Serializer para Equipo"""
    from users.models import Student
    
    game_session_room_code = serializers.CharField(source='game_session.room_code', read_only=True)
    students = StudentSerializer(many=True, read_only=True)
    student_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Student.objects.all(),
        source='students',
        write_only=True,
        required=False
    )
    students_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Team
        fields = [
            'id', 'game_session', 'game_session_room_code', 'name', 'color',
            'tokens_total', 'students', 'student_ids', 'students_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'game_session_room_code', 'students_count', 'created_at', 'updated_at']
    
    def get_students_count(self, obj):
        return obj.students.count()


class TeamPersonalizationSerializer(serializers.ModelSerializer):
    """Serializer para Personalización del Equipo"""
    team_name_display = serializers.CharField(source='team.name', read_only=True)
    
    class Meta:
        model = TeamPersonalization
        fields = [
            'team', 'team_name_display', 'team_name',
            'team_members_know_each_other', 'created_at', 'updated_at'
        ]
        read_only_fields = ['team_name_display', 'created_at', 'updated_at']


class SessionStageSerializer(serializers.ModelSerializer):
    """Serializer para Etapa de Sesión"""
    game_session_room_code = serializers.CharField(source='game_session.room_code', read_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    stage_number = serializers.IntegerField(source='stage.number', read_only=True)
    presentation_state = serializers.SerializerMethodField()
    
    class Meta:
        model = SessionStage
        fields = [
            'id', 'game_session', 'game_session_room_code', 'stage', 'stage_name', 'stage_number',
            'status', 'started_at', 'completed_at', 'presentation_order', 'current_presentation_team_id', 
            'presentation_state', 'presentation_timestamps'
        ]
        read_only_fields = ['id', 'game_session_room_code', 'stage_name', 'stage_number']
    
    def get_presentation_state(self, obj):
        """Obtener presentation_state de forma segura (soporta migración no aplicada)"""
        return getattr(obj, 'presentation_state', 'not_started')


class TeamActivityProgressSerializer(serializers.ModelSerializer):
    """Serializer para Progreso de Actividad del Equipo"""
    team_name = serializers.CharField(source='team.name', read_only=True)
    activity_name = serializers.CharField(source='activity.name', read_only=True)
    stage_name = serializers.CharField(source='session_stage.stage.name', read_only=True)
    
    # Serializar el tema completo en lugar de solo el ID
    selected_topic = serializers.SerializerMethodField()
    selected_challenge = serializers.SerializerMethodField()
    
    def get_selected_topic(self, obj):
        """Devolver el tema completo si está seleccionado"""
        if obj.selected_topic:
            from challenges.serializers import TopicSerializer
            return TopicSerializer(obj.selected_topic).data
        return None
    
    def get_selected_challenge(self, obj):
        """Devolver el desafío completo si está seleccionado"""
        if obj.selected_challenge:
            from challenges.serializers import ChallengeSerializer
            return ChallengeSerializer(obj.selected_challenge).data
        return None
    
    class Meta:
        model = TeamActivityProgress
        fields = [
            'id', 'team', 'team_name', 'session_stage', 'stage_name', 'activity', 'activity_name',
            'status', 'started_at', 'completed_at', 'progress_percentage', 'response_data',
            'selected_topic', 'selected_challenge', 'prototype_image_url',
            'pitch_intro_problem', 'pitch_solution', 'pitch_value', 'pitch_impact', 'pitch_closing'
        ]
        read_only_fields = ['id', 'team_name', 'activity_name', 'stage_name']


class TabletSerializer(serializers.ModelSerializer):
    """Serializer para Tablet"""
    class Meta:
        model = Tablet
        fields = ['id', 'tablet_code', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TabletConnectionSerializer(serializers.ModelSerializer):
    """Serializer para Conexión de Tablet"""
    tablet_code = serializers.SerializerMethodField()
    team_name = serializers.CharField(source='team.name', read_only=True)
    game_session_room_code = serializers.CharField(source='game_session.room_code', read_only=True)
    is_connected = serializers.SerializerMethodField()

    class Meta:
        model = TabletConnection
        fields = [
            'id', 'tablet', 'tablet_code', 'team', 'team_name', 'game_session',
            'game_session_room_code', 'connected_at', 'disconnected_at', 'last_seen',
            'is_connected', 'team_session_token', 'current_screen'
        ]
        read_only_fields = [
            'id', 'tablet_code', 'team_name', 'game_session_room_code',
            'is_connected', 'team_session_token'
        ]

    def get_tablet_code(self, obj):
        return obj.tablet.tablet_code if obj.tablet else None

    def get_is_connected(self, obj):
        return obj.disconnected_at is None


class TeamRouletteAssignmentSerializer(serializers.ModelSerializer):
    """Serializer para Asignación de Reto de Ruleta"""
    team_name = serializers.CharField(source='team.name', read_only=True)
    challenge_description = serializers.CharField(source='roulette_challenge.description', read_only=True)
    challenge_type = serializers.CharField(source='roulette_challenge.challenge_type', read_only=True)
    validated_by_name = serializers.CharField(source='validated_by.user.get_full_name', read_only=True)
    
    class Meta:
        model = TeamRouletteAssignment
        fields = [
            'id', 'team', 'team_name', 'session_stage', 'roulette_challenge',
            'challenge_description', 'challenge_type', 'status', 'token_reward',
            'assigned_at', 'accepted_at', 'rejected_at', 'completed_at',
            'validated_by', 'validated_by_name'
        ]
        read_only_fields = ['id', 'team_name', 'challenge_description', 'challenge_type', 'validated_by_name']


class TokenTransactionSerializer(serializers.ModelSerializer):
    """Serializer para Transacción de Tokens"""
    team_name = serializers.CharField(source='team.name', read_only=True)
    game_session_room_code = serializers.CharField(source='game_session.room_code', read_only=True)
    awarded_by_name = serializers.CharField(source='awarded_by.user.get_full_name', read_only=True, allow_null=True)
    stage_name = serializers.SerializerMethodField()
    stage_number = serializers.SerializerMethodField()
    
    def get_stage_name(self, obj):
        """Obtener el nombre de la etapa desde session_stage"""
        if obj.session_stage and obj.session_stage.stage:
            return obj.session_stage.stage.name
        return None
    
    def get_stage_number(self, obj):
        """Obtener el número de la etapa desde session_stage"""
        if obj.session_stage and obj.session_stage.stage:
            return obj.session_stage.stage.number
        return None
    
    class Meta:
        model = TokenTransaction
        fields = [
            'id', 'team', 'team_name', 'game_session', 'game_session_room_code',
            'session_stage', 'stage_name', 'stage_number', 'amount', 'source_type', 'source_id', 'reason',
            'awarded_by', 'awarded_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'team_name', 'game_session_room_code', 'awarded_by_name', 'stage_name', 'stage_number', 'created_at']


class TeamBubbleMapSerializer(serializers.ModelSerializer):
    """Serializer para Bubble Map del Equipo"""
    team_name = serializers.CharField(source='team.name', read_only=True)
    stage_name = serializers.CharField(source='session_stage.stage.name', read_only=True)
    
    class Meta:
        model = TeamBubbleMap
        fields = [
            'id', 'team', 'team_name', 'session_stage', 'stage_name',
            'map_data', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'team_name', 'stage_name', 'created_at', 'updated_at']


class PeerEvaluationSerializer(serializers.ModelSerializer):
    """Serializer para Evaluación Peer"""
    evaluator_team_name = serializers.CharField(source='evaluator_team.name', read_only=True)
    evaluated_team_name = serializers.CharField(source='evaluated_team.name', read_only=True)
    game_session_room_code = serializers.CharField(source='game_session.room_code', read_only=True)
    
    class Meta:
        model = PeerEvaluation
        fields = [
            'id', 'evaluator_team', 'evaluator_team_name', 'evaluated_team', 'evaluated_team_name',
            'game_session', 'game_session_room_code', 'criteria_scores', 'total_score',
            'tokens_awarded', 'feedback', 'submitted_at'
        ]
        read_only_fields = ['id', 'evaluator_team_name', 'evaluated_team_name', 'game_session_room_code', 'submitted_at']


class ReflectionEvaluationSerializer(serializers.ModelSerializer):
    """Serializer para Evaluación de Reflexión"""
    game_session_room_code = serializers.CharField(source='game_session.room_code', read_only=True)
    
    class Meta:
        model = ReflectionEvaluation
        fields = [
            'id', 'game_session', 'game_session_room_code', 'student_name', 'student_email',
            'faculty', 'career', 'value_areas', 'satisfaction', 'entrepreneurship_interest',
            'comments', 'created_at'
        ]
        read_only_fields = ['id', 'game_session_room_code', 'created_at']

