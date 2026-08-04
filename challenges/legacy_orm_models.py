"""
Frozen copy of the original Django ORM models for `challenges`, kept
ONLY so challenges/management/commands/backfill_content_to_dynamodb.py
can still read prod MySQL data after challenges/models.py became a
DynamoDB compatibility shim (see
docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md).

Field definitions only -- the business-logic methods
(get_word_search_data/get_anagram_data/etc.) live on the real
challenges/models.py shim now and aren't needed for a one-time read-only
backfill. Not imported anywhere else.
"""
from django.db import models

from academic.legacy_orm_models import Faculty


class Stage(models.Model):
    number = models.IntegerField(unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    objective = models.TextField(blank=True, null=True)
    estimated_duration = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'stages'
        managed = False


class ActivityType(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'activity_types'
        managed = False


class Activity(models.Model):
    stage = models.ForeignKey(Stage, on_delete=models.RESTRICT, related_name='+')
    activity_type = models.ForeignKey(ActivityType, on_delete=models.RESTRICT, related_name='+')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    order_number = models.IntegerField()
    timer_duration = models.IntegerField(blank=True, null=True)
    config_data = models.JSONField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'activities'
        managed = False


class Topic(models.Model):
    name = models.CharField(max_length=200)
    icon = models.CharField(max_length=10, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    image_url = models.URLField(max_length=500, blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    faculties = models.ManyToManyField(Faculty, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'topics'
        managed = False


class Challenge(models.Model):
    DIFFICULTY_LEVEL_CHOICES = [('low', 'Baja'), ('medium', 'Media'), ('high', 'Alta')]

    topic = models.ForeignKey(Topic, on_delete=models.RESTRICT, related_name='+')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    icon = models.CharField(max_length=10, blank=True, null=True)
    persona_name = models.CharField(max_length=100, blank=True, null=True)
    persona_age = models.IntegerField(blank=True, null=True)
    persona_story = models.TextField(blank=True, null=True)
    persona_image = models.ImageField(upload_to='personas/', blank=True, null=True)
    difficulty_level = models.CharField(max_length=20, choices=DIFFICULTY_LEVEL_CHOICES, default='medium')
    learning_objectives = models.TextField(blank=True, null=True)
    additional_resources = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'challenges'
        managed = False


class RouletteChallenge(models.Model):
    CHALLENGE_TYPE_CHOICES = [('physical', 'Físico'), ('mental', 'Mental'), ('creative', 'Creativo'), ('other', 'Otro')]

    description = models.TextField()
    challenge_type = models.CharField(max_length=20, choices=CHALLENGE_TYPE_CHOICES)
    difficulty_estimated = models.IntegerField(default=5)
    token_reward_min = models.IntegerField(default=0)
    token_reward_max = models.IntegerField(default=0)
    stages_applicable = models.JSONField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'roulette_challenges'
        managed = False


class WordSearchOption(models.Model):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name='+')
    name = models.CharField(max_length=100)
    words = models.JSONField()
    grid = models.JSONField(blank=True, null=True)
    word_positions = models.JSONField(blank=True, null=True)
    seed = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'word_search_options'
        managed = False


class Minigame(models.Model):
    MINIGAME_TYPE_CHOICES = [('word_search', 'Sopa de Letras'), ('puzzle', 'Puzzle'), ('other', 'Otro')]

    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=MINIGAME_TYPE_CHOICES)
    config = models.JSONField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'minigames'
        managed = False


class LearningObjective(models.Model):
    stage = models.ForeignKey(Stage, on_delete=models.SET_NULL, blank=True, null=True, related_name='+')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    evaluation_criteria = models.TextField(blank=True, null=True)
    pedagogical_recommendations = models.TextField(blank=True, null=True)
    estimated_time = models.IntegerField(blank=True, null=True)
    associated_resources = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'learning_objectives'
        managed = False


class AnagramWord(models.Model):
    word = models.CharField(max_length=100)
    scrambled_word = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'anagram_words'
        managed = False


class ChaosQuestion(models.Model):
    question = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'chaos_questions'
        managed = False


class GeneralKnowledgeQuestion(models.Model):
    question = models.TextField()
    option_a = models.CharField(max_length=255)
    option_b = models.CharField(max_length=255)
    option_c = models.CharField(max_length=255)
    option_d = models.CharField(max_length=255)
    correct_answer = models.IntegerField(choices=[(0, 'A'), (1, 'B'), (2, 'C'), (3, 'D')])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'challenges'
        db_table = 'general_knowledge_questions'
        managed = False
