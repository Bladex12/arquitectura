"""
Serializers para la app challenges.

Plain serializers.Serializer, not ModelSerializer -- ModelSerializer
introspects Meta.model._meta (real Django ORM machinery), which the
DynamoDB-backed shim classes in challenges/models.py don't have.
"""
import os

from rest_framework import serializers

from academic.serializers import FacultySerializer


class StageSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    number = serializers.IntegerField()
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    objective = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    estimated_duration = serializers.IntegerField(required=False, allow_null=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def create(self, validated_data):
        from challenges.models import Stage
        return Stage.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class ActivityTypeSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    code = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def create(self, validated_data):
        from challenges.models import ActivityType
        return ActivityType.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class ActivitySerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    stage = serializers.CharField(source='stage_id')
    stage_name = serializers.CharField(read_only=True)
    activity_type = serializers.CharField(source='activity_type_id')
    activity_type_name = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    order_number = serializers.IntegerField()
    timer_duration = serializers.IntegerField(required=False, allow_null=True)
    config_data = serializers.JSONField(required=False, allow_null=True)
    word_search_data = serializers.SerializerMethodField()
    anagram_data = serializers.SerializerMethodField()
    general_knowledge_data = serializers.SerializerMethodField()
    chaos_data = serializers.SerializerMethodField()
    bubble_map_config = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def _team_and_stage_ids(self):
        request = self.context.get('request')
        if not request:
            return None, None
        team_id = request.query_params.get('team_id')
        session_stage_id = request.query_params.get('session_stage_id')
        team_id = int(team_id) if team_id and team_id.isdigit() else None
        session_stage_id = int(session_stage_id) if session_stage_id and session_stage_id.isdigit() else None
        return team_id, session_stage_id

    def get_word_search_data(self, obj):
        if not self.context.get('request'):
            return None
        team_id, session_stage_id = self._team_and_stage_ids()
        return obj.get_word_search_data(team_id=team_id, session_stage_id=session_stage_id)

    def get_anagram_data(self, obj):
        if obj.activity_type.code not in ['minigame', 'minijuego']:
            return None
        if not self.context.get('request'):
            return None
        team_id, session_stage_id = self._team_and_stage_ids()
        return obj.get_anagram_data(count=5, team_id=team_id, session_stage_id=session_stage_id)

    def get_general_knowledge_data(self, obj):
        if obj.activity_type.code not in ['minigame', 'minijuego']:
            return None
        if not self.context.get('request'):
            return None
        team_id, session_stage_id = self._team_and_stage_ids()
        return obj.get_general_knowledge_data(count=5, team_id=team_id, session_stage_id=session_stage_id)

    def get_chaos_data(self, obj):
        if not self.context.get('request'):
            return None
        team_id, session_stage_id = self._team_and_stage_ids()
        return obj.get_chaos_data(team_id=team_id, session_stage_id=session_stage_id)

    def get_bubble_map_config(self, obj):
        return obj.get_bubble_map_config()

    def create(self, validated_data):
        from challenges.models import Activity
        validated_data['stage'] = validated_data.pop('stage_id')
        validated_data['activity_type'] = validated_data.pop('activity_type_id')
        return Activity.objects.create(**validated_data)

    def update(self, instance, validated_data):
        if 'stage_id' in validated_data:
            instance.stage_id = validated_data.pop('stage_id')
        if 'activity_type_id' in validated_data:
            instance.activity_type_id = validated_data.pop('activity_type_id')
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class TopicSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=200)
    icon = serializers.CharField(max_length=10, required=False, allow_null=True, allow_blank=True)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    image_url = serializers.URLField(max_length=500, required=False, allow_null=True, allow_blank=True)
    category = serializers.CharField(max_length=100, required=False, allow_null=True, allow_blank=True)
    faculties = FacultySerializer(many=True, read_only=True)
    faculty_ids = serializers.ListField(
        child=serializers.CharField(), source='faculties', write_only=True, required=False, allow_null=True,
    )
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def create(self, validated_data):
        from challenges.models import Topic
        return Topic.objects.create(**validated_data)

    def update(self, instance, validated_data):
        from challenges.dynamodb import topic as topic_repo
        faculty_ids = validated_data.pop('faculties', None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        if faculty_ids is not None:
            topic_repo.set_topic_faculties(instance.id, faculty_ids)
            instance._faculties = None
        return instance


class ChallengeSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    topic = serializers.CharField(source='topic_id')
    topic_name = serializers.CharField(read_only=True)
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    icon = serializers.CharField(max_length=10, required=False, allow_null=True, allow_blank=True)
    persona_name = serializers.CharField(max_length=100, required=False, allow_null=True, allow_blank=True)
    persona_age = serializers.IntegerField(required=False, allow_null=True)
    persona_story = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    persona_image = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    persona_image_url = serializers.SerializerMethodField()
    difficulty_level = serializers.ChoiceField(
        choices=[('low', 'Baja'), ('medium', 'Media'), ('high', 'Alta')], default='medium',
    )
    learning_objectives = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    additional_resources = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def get_persona_image_url(self, obj):
        if not obj.persona_image:
            return None
        request = self.context.get('request')
        bucket = os.environ.get('STATIC_MEDIA_BUCKET')
        region = os.environ.get('AWS_REGION', 'us-east-1')
        if bucket:
            url = f'https://{bucket}.s3.{region}.amazonaws.com/media/{obj.persona_image}'
        else:
            url = f'/media/{obj.persona_image}'
        return request.build_absolute_uri(url) if request else url

    def create(self, validated_data):
        from challenges.models import Challenge
        validated_data['topic'] = validated_data.pop('topic_id')
        return Challenge.objects.create(**validated_data)

    def update(self, instance, validated_data):
        if 'topic_id' in validated_data:
            instance.topic_id = validated_data.pop('topic_id')
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class RouletteChallengeSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    description = serializers.CharField()
    challenge_type = serializers.ChoiceField(
        choices=[('physical', 'Físico'), ('mental', 'Mental'), ('creative', 'Creativo'), ('other', 'Otro')],
    )
    difficulty_estimated = serializers.IntegerField(default=5)
    token_reward_min = serializers.IntegerField(default=0)
    token_reward_max = serializers.IntegerField(default=0)
    stages_applicable = serializers.JSONField(required=False, allow_null=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def create(self, validated_data):
        from challenges.models import RouletteChallenge
        return RouletteChallenge.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class MinigameSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=100)
    type = serializers.ChoiceField(
        choices=[('word_search', 'Sopa de Letras'), ('puzzle', 'Puzzle'), ('other', 'Otro')],
    )
    config = serializers.JSONField(required=False, allow_null=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def create(self, validated_data):
        from challenges.models import Minigame
        return Minigame.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class LearningObjectiveSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    stage = serializers.CharField(source='stage_id', required=False, allow_null=True)
    stage_name = serializers.CharField(read_only=True)
    stage_number = serializers.IntegerField(read_only=True)
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    evaluation_criteria = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    pedagogical_recommendations = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    estimated_time = serializers.IntegerField(required=False, allow_null=True)
    associated_resources = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def create(self, validated_data):
        from challenges.models import LearningObjective
        validated_data['stage'] = validated_data.pop('stage_id', None)
        return LearningObjective.objects.create(**validated_data)

    def update(self, instance, validated_data):
        if 'stage_id' in validated_data:
            instance.stage_id = validated_data.pop('stage_id')
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class WordSearchOptionSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    activity = serializers.CharField(source='activity_id')
    activity_name = serializers.SerializerMethodField()
    name = serializers.CharField(max_length=100)
    words = serializers.JSONField()
    grid = serializers.JSONField(required=False, allow_null=True)
    word_positions = serializers.JSONField(required=False, allow_null=True)
    seed = serializers.IntegerField(required=False, allow_null=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def get_activity_name(self, obj):
        return obj.activity.name if obj.activity else None

    def create(self, validated_data):
        from challenges.models import WordSearchOption
        return WordSearchOption.objects.create(**validated_data)


class AnagramWordSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    word = serializers.CharField(max_length=100)
    scrambled_word = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def create(self, validated_data):
        from challenges.models import AnagramWord
        return AnagramWord.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class ChaosQuestionSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    question = serializers.CharField()
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def create(self, validated_data):
        from challenges.models import ChaosQuestion
        return ChaosQuestion.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class GeneralKnowledgeQuestionSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    question = serializers.CharField()
    option_a = serializers.CharField(max_length=255)
    option_b = serializers.CharField(max_length=255)
    option_c = serializers.CharField(max_length=255)
    option_d = serializers.CharField(max_length=255)
    correct_answer = serializers.ChoiceField(choices=[(0, 'A'), (1, 'B'), (2, 'C'), (3, 'D')])
    options = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def get_options(self, obj):
        return [
            {'label': 'A', 'text': obj.option_a},
            {'label': 'B', 'text': obj.option_b},
            {'label': 'C', 'text': obj.option_c},
            {'label': 'D', 'text': obj.option_d},
        ]

    def create(self, validated_data):
        from challenges.models import GeneralKnowledgeQuestion
        return GeneralKnowledgeQuestion.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance
