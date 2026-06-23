"""
Admin para la app challenges
"""
from django.contrib import admin
from .models import (
    Stage, ActivityType, Activity, Topic, Challenge,
    RouletteChallenge, Minigame, LearningObjective, WordSearchOption
)


@admin.register(Stage)
class StageAdmin(admin.ModelAdmin):
    list_display = ['number', 'name', 'estimated_duration', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['number']


@admin.register(ActivityType)
class ActivityTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['code', 'name']


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ['name', 'stage', 'activity_type', 'order_number', 'timer_duration', 'timer_duration_display', 'is_active']
    list_filter = ['stage', 'activity_type', 'is_active']
    search_fields = ['name', 'description']
    ordering = ['stage', 'order_number']
    fields = ['stage', 'activity_type', 'name', 'description', 'order_number', 'timer_duration', 'config_data', 'is_active']
    
    def timer_duration_display(self, obj):
        """Mostrar duración en formato legible"""
        if obj.timer_duration:
            minutes = obj.timer_duration // 60
            seconds = obj.timer_duration % 60
            if minutes > 0:
                return f"{minutes}m {seconds}s" if seconds > 0 else f"{minutes}m"
            return f"{seconds}s"
        return "No configurado"
    timer_duration_display.short_description = 'Duración'


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ['name', 'icon', 'category', 'is_active', 'created_at']
    list_filter = ['category', 'is_active', 'created_at']
    search_fields = ['name', 'description']
    filter_horizontal = ['faculties']


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ['title', 'topic', 'icon', 'persona_name', 'difficulty_level', 'is_active', 'created_at']
    list_filter = ['topic', 'difficulty_level', 'is_active', 'created_at']
    search_fields = ['title', 'persona_name', 'persona_story']
    fieldsets = (
        ('Información Básica', {
            'fields': ('topic', 'title', 'description', 'icon', 'difficulty_level', 'is_active')
        }),
        ('Persona', {
            'fields': ('persona_name', 'persona_age', 'persona_story', 'persona_image'),
            'description': 'Información de la persona en la historia de usuario'
        }),
        ('Recursos', {
            'fields': ('learning_objectives', 'additional_resources'),
            'classes': ('collapse',)
        }),
    )


@admin.register(RouletteChallenge)
class RouletteChallengeAdmin(admin.ModelAdmin):
    list_display = ['description_short', 'challenge_type', 'difficulty_estimated', 'token_reward_min', 'token_reward_max', 'is_active']
    list_filter = ['challenge_type', 'is_active']
    search_fields = ['description']
    
    def description_short(self, obj):
        return obj.description[:50] + '...' if len(obj.description) > 50 else obj.description
    description_short.short_description = 'Descripción'


@admin.register(Minigame)
class MinigameAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'is_active', 'created_at']
    list_filter = ['type', 'is_active', 'created_at']
    search_fields = ['name']


@admin.register(LearningObjective)
class LearningObjectiveAdmin(admin.ModelAdmin):
    list_display = ['title', 'stage', 'estimated_time', 'is_active', 'created_at']
    list_filter = ['stage', 'is_active', 'created_at']
    search_fields = ['title', 'description']


@admin.register(WordSearchOption)
class WordSearchOptionAdmin(admin.ModelAdmin):
    list_display = ['name', 'activity', 'word_count', 'is_active', 'created_at']
    list_filter = ['activity', 'is_active', 'created_at']
    search_fields = ['name', 'activity__name']
    list_select_related = ['activity']
    
    def word_count(self, obj):
        """Mostrar el número de palabras"""
        if isinstance(obj.words, list):
            return len(obj.words)
        return 0
    word_count.short_description = 'Número de Palabras'
