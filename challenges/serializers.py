"""
Serializers para la app challenges
"""
from rest_framework import serializers
from .models import (
    Stage, ActivityType, Activity, Topic, Challenge,
    RouletteChallenge, Minigame, LearningObjective,
    WordSearchOption, AnagramWord, ChaosQuestion, GeneralKnowledgeQuestion
)
from academic.serializers import FacultySerializer


class StageSerializer(serializers.ModelSerializer):
    """Serializer para Etapa"""
    class Meta:
        model = Stage
        fields = ['id', 'number', 'name', 'description', 'objective', 'estimated_duration', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ActivityTypeSerializer(serializers.ModelSerializer):
    """Serializer para Tipo de Actividad"""
    class Meta:
        model = ActivityType
        fields = ['id', 'code', 'name', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ActivitySerializer(serializers.ModelSerializer):
    """Serializer para Actividad"""
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    activity_type_name = serializers.CharField(source='activity_type.name', read_only=True)
    word_search_data = serializers.SerializerMethodField()
    anagram_data = serializers.SerializerMethodField()
    general_knowledge_data = serializers.SerializerMethodField()
    chaos_data = serializers.SerializerMethodField()
    bubble_map_config = serializers.SerializerMethodField()
    
    class Meta:
        model = Activity
        fields = [
            'id', 'stage', 'stage_name', 'activity_type', 'activity_type_name',
            'name', 'description', 'order_number', 'timer_duration', 'config_data',
            'word_search_data', 'anagram_data', 'general_knowledge_data', 'chaos_data', 'bubble_map_config', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'stage_name', 'activity_type_name', 'word_search_data', 'anagram_data', 'general_knowledge_data', 'chaos_data', 'bubble_map_config', 'created_at', 'updated_at']
    
    def get_word_search_data(self, obj):
        """
        Genera y devuelve los datos de la sopa de letras si es una actividad de minijuego.
        Obtiene team_id y session_stage_id de los query params para selección determinística.
        """
        request = self.context.get('request')
        if not request:
            return None
        
        # Obtener team_id y session_stage_id de los query params
        team_id = request.query_params.get('team_id')
        session_stage_id = request.query_params.get('session_stage_id')
        
        team_id = int(team_id) if team_id and team_id.isdigit() else None
        session_stage_id = int(session_stage_id) if session_stage_id and session_stage_id.isdigit() else None
        
        # Generar la sopa de letras
        word_search_data = obj.get_word_search_data(team_id=team_id, session_stage_id=session_stage_id)
        return word_search_data
    
    def get_anagram_data(self, obj):
        """
        Obtiene palabras aleatorias para el juego de anagrama.
        Solo se devuelve si la actividad es de tipo minijuego.
        Obtiene team_id y session_stage_id de los query params para selección determinística.
        """
        # Verificar si es una actividad de minijuego
        # El código puede ser 'minigame' o 'minijuego' dependiendo de la base de datos
        if obj.activity_type.code not in ['minigame', 'minijuego']:
            return None
        
        request = self.context.get('request')
        if not request:
            return None
        
        # Obtener team_id y session_stage_id de los query params
        team_id = request.query_params.get('team_id')
        session_stage_id = request.query_params.get('session_stage_id')
        
        team_id = int(team_id) if team_id and team_id.isdigit() else None
        session_stage_id = int(session_stage_id) if session_stage_id and session_stage_id.isdigit() else None
        
        # Obtener 5 palabras aleatorias (determinísticas si hay team_id y session_stage_id)
        anagram_data = obj.get_anagram_data(count=5, team_id=team_id, session_stage_id=session_stage_id)
        return anagram_data
    
    def get_general_knowledge_data(self, obj):
        """
        Obtiene preguntas aleatorias de conocimiento general.
        Solo se devuelve si la actividad es de tipo minijuego.
        Obtiene team_id y session_stage_id de los query params para selección determinística.
        """
        # Verificar si es una actividad de minijuego
        if obj.activity_type.code not in ['minigame', 'minijuego']:
            return None
        
        request = self.context.get('request')
        if not request:
            return None
        
        # Obtener team_id y session_stage_id de los query params
        team_id = request.query_params.get('team_id')
        session_stage_id = request.query_params.get('session_stage_id')
        
        team_id = int(team_id) if team_id and team_id.isdigit() else None
        session_stage_id = int(session_stage_id) if session_stage_id and session_stage_id.isdigit() else None
        
        # Obtener 5 preguntas aleatorias (determinísticas si hay team_id y session_stage_id)
        general_knowledge_data = obj.get_general_knowledge_data(count=5, team_id=team_id, session_stage_id=session_stage_id)
        return general_knowledge_data
    
    def get_chaos_data(self, obj):
        """
        Obtiene información sobre las preguntas del caos disponibles.
        Solo se devuelve si la actividad es de tipo presentación.
        """
        request = self.context.get('request')
        if not request:
            return None
        
        # Obtener team_id y session_stage_id de los query params
        team_id = request.query_params.get('team_id')
        session_stage_id = request.query_params.get('session_stage_id')
        
        team_id = int(team_id) if team_id and team_id.isdigit() else None
        session_stage_id = int(session_stage_id) if session_stage_id and session_stage_id.isdigit() else None
        
        # Obtener información sobre las preguntas del caos
        chaos_data = obj.get_chaos_data(team_id=team_id, session_stage_id=session_stage_id)
        return chaos_data
    
    def get_bubble_map_config(self, obj):
        """
        Obtiene la configuración del bubble map desde el backend.
        """
        return obj.get_bubble_map_config()


class TopicSerializer(serializers.ModelSerializer):
    """Serializer para Tema"""
    from academic.models import Faculty
    
    faculties = FacultySerializer(many=True, read_only=True)
    faculty_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Faculty.objects.all(),
        source='faculties',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = Topic
        fields = ['id', 'name', 'icon', 'description', 'image_url', 'category', 'faculties', 'faculty_ids', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ChallengeSerializer(serializers.ModelSerializer):
    """Serializer para Desafío"""
    topic_name = serializers.CharField(source='topic.name', read_only=True)
    persona_image_url = serializers.SerializerMethodField()
    
    def get_persona_image_url(self, obj):
        """Obtener la URL completa de la imagen de la persona"""
        if obj.persona_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.persona_image.url)
            return obj.persona_image.url
        return None
    
    class Meta:
        model = Challenge
        fields = [
            'id', 'topic', 'topic_name', 'title', 'description', 'icon',
            'persona_name', 'persona_age', 'persona_story', 'persona_image', 'persona_image_url',
            'difficulty_level', 'learning_objectives', 'additional_resources',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'topic_name', 'persona_image_url', 'created_at', 'updated_at']


class RouletteChallengeSerializer(serializers.ModelSerializer):
    """Serializer para Reto de Ruleta"""
    class Meta:
        model = RouletteChallenge
        fields = [
            'id', 'description', 'challenge_type', 'difficulty_estimated',
            'token_reward_min', 'token_reward_max', 'stages_applicable',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class MinigameSerializer(serializers.ModelSerializer):
    """Serializer para Minijuego"""
    class Meta:
        model = Minigame
        fields = ['id', 'name', 'type', 'config', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class LearningObjectiveSerializer(serializers.ModelSerializer):
    """Serializer para Objetivo de Aprendizaje"""
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    stage_number = serializers.IntegerField(source='stage.number', read_only=True)
    
    class Meta:
        model = LearningObjective
        fields = [
            'id', 'stage', 'stage_name', 'stage_number', 'title', 'description',
            'evaluation_criteria', 'pedagogical_recommendations',
            'estimated_time', 'associated_resources', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'stage_name', 'stage_number', 'created_at', 'updated_at']


class WordSearchOptionSerializer(serializers.ModelSerializer):
    """Serializer para Opción de Sopa de Letras"""
    activity_name = serializers.CharField(source='activity.name', read_only=True)
    
    class Meta:
        model = WordSearchOption
        fields = [
            'id', 'activity', 'activity_name', 'name', 'words', 'grid',
            'word_positions', 'seed', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'activity_name', 'created_at', 'updated_at']


class AnagramWordSerializer(serializers.ModelSerializer):
    """Serializer para Palabra de Anagrama"""
    class Meta:
        model = AnagramWord
        fields = [
            'id', 'word', 'scrambled_word', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'scrambled_word', 'created_at', 'updated_at']


class ChaosQuestionSerializer(serializers.ModelSerializer):
    """Serializer para Pregunta del Caos"""
    class Meta:
        model = ChaosQuestion
        fields = [
            'id', 'question', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class GeneralKnowledgeQuestionSerializer(serializers.ModelSerializer):
    """Serializer para Pregunta de Conocimiento General"""
    options = serializers.SerializerMethodField()
    
    class Meta:
        model = GeneralKnowledgeQuestion
        fields = [
            'id', 'question', 'option_a', 'option_b', 'option_c', 'option_d',
            'correct_answer', 'is_active', 'created_at', 'updated_at', 'options'
        ]
        read_only_fields = ['id', 'options', 'created_at', 'updated_at']
    
    def get_options(self, obj):
        """Retornar opciones como lista para facilitar el frontend"""
        return [
            {'label': 'A', 'text': obj.option_a},
            {'label': 'B', 'text': obj.option_b},
            {'label': 'C', 'text': obj.option_c},
            {'label': 'D', 'text': obj.option_d},
        ]

