"""
Modelos para la app challenges (Etapas, Actividades, Desafíos, Retos, Temas, etc.)
"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from academic.models import Faculty
from typing import Optional, Dict
import random


class Stage(models.Model):
    """
    Etapa del juego (Trabajo en equipo, Empatía, Creatividad, Comunicación)
    """
    number = models.IntegerField(
        unique=True,
        verbose_name='Número'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='Nombre'
    )
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='Descripción'
    )
    objective = models.TextField(
        blank=True,
        null=True,
        verbose_name='Objetivo'
    )
    estimated_duration = models.IntegerField(
        blank=True,
        null=True,
        verbose_name='Duración Estimada (minutos)'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activa'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stages'
        verbose_name = 'Etapa'
        verbose_name_plural = 'Etapas'
        indexes = [
            models.Index(fields=['number']),
            models.Index(fields=['is_active']),
        ]
        ordering = ['number']

    def __str__(self):
        return f"Etapa {self.number}: {self.name}"


class ActivityType(models.Model):
    """
    Tipo de actividad (personalización, minijuego, tema, etc.)
    """
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Código'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='Nombre'
    )
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='Descripción'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'activity_types'
        verbose_name = 'Tipo de Actividad'
        verbose_name_plural = 'Tipos de Actividades'
        indexes = [
            models.Index(fields=['code']),
        ]

    def __str__(self):
        return self.name


class Activity(models.Model):
    """
    Actividad dentro de una etapa
    """
    stage = models.ForeignKey(
        Stage,
        on_delete=models.RESTRICT,
        related_name='activities',
        verbose_name='Etapa'
    )
    activity_type = models.ForeignKey(
        ActivityType,
        on_delete=models.RESTRICT,
        related_name='activities',
        verbose_name='Tipo de Actividad'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='Nombre'
    )
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='Descripción'
    )
    order_number = models.IntegerField(
        verbose_name='Número de Orden'
    )
    timer_duration = models.IntegerField(
        blank=True,
        null=True,
        verbose_name='Duración del Temporizador (segundos)'
    )
    config_data = models.JSONField(
        blank=True,
        null=True,
        verbose_name='Datos de Configuración'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activa'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'activities'
        verbose_name = 'Actividad'
        verbose_name_plural = 'Actividades'
        unique_together = [['stage', 'order_number']]
        indexes = [
            models.Index(fields=['stage']),
            models.Index(fields=['activity_type']),
            models.Index(fields=['stage', 'order_number']),
        ]
        ordering = ['stage', 'order_number']

    def get_word_search_data(self, team_id: Optional[int] = None, session_stage_id: Optional[int] = None) -> Optional[Dict]:
        """
        Genera y devuelve los datos de la sopa de letras para esta actividad.
        Si hay múltiples opciones de sopas de letras, selecciona una determinísticamente
        basada en team_id y session_stage_id.
        
        Args:
            team_id: ID del equipo (para selección determinística)
            session_stage_id: ID de la sesión de etapa (para selección determinística)
        
        Returns:
            Diccionario con 'words', 'grid' y 'wordPositions' o None si no es una actividad de sopa de letras
        """
        from challenges.services import generate_word_search
        
        config = self.config_data or {}
        
        # Verificar si es una actividad de minijuego
        # Para minijuegos, siempre devolver word_search_data si hay opciones guardadas
        # El código puede ser 'minigame' o 'minijuego' dependiendo de la base de datos
        if self.activity_type.code not in ['minigame', 'minijuego']:
            return None
        
        # Obtener opciones de sopas de letras si existen
        word_search_options = self.word_search_options.filter(is_active=True)
        
        words = []
        seed = None
        
        if word_search_options.exists():
            # Si hay múltiples opciones, seleccionar una determinísticamente
            options_list = list(word_search_options)
            
            if team_id is not None and session_stage_id is not None:
                # Generar índice determinístico basado en team_id, session_stage_id y activity_id
                # Esto hace que diferentes equipos tengan diferentes sopas de letras
                seed_string = f"{team_id}_{session_stage_id}_{self.id}"
                seed_value = abs(sum(ord(c) for c in seed_string))
                selected_index = seed_value % len(options_list)
            else:
                # Si no hay team_id/session_stage_id, seleccionar aleatoriamente
                selected_index = random.randint(0, len(options_list) - 1)
            
            selected_option = options_list[selected_index]
            words = selected_option.words if isinstance(selected_option.words, list) else []
            
            # Si la opción ya tiene grid y word_positions guardados, devolverlos directamente
            if selected_option.grid and selected_option.word_positions:
                # Asegurar que words sea una lista de strings en mayúsculas
                words_list = [w.upper() if isinstance(w, str) else str(w).upper() for w in words] if words else []
                return {
                    'words': words_list,
                    'grid': selected_option.grid,
                    'wordPositions': selected_option.word_positions,
                }
            
            # Si no tiene grid guardado, generar uno (fallback - no debería pasar)
            # Usar el ID de la opción como parte de la semilla para generar la misma sopa siempre
            if seed is None:
                seed = selected_option.id * 1000 + (team_id or 0) + (session_stage_id or 0)
        elif config.get('words'):
            # Compatibilidad: usar palabras de config_data (estructura antigua)
            words_config = config.get('words', [])
            if isinstance(words_config, list):
                if words_config and isinstance(words_config[0], str):
                    words = words_config
                elif words_config and isinstance(words_config[0], dict):
                    words = [w.get('word', '') for w in words_config if w.get('word')]
            
            # Generar semilla basada en team_id y session_stage_id si están disponibles
            if team_id is not None and session_stage_id is not None:
                seed_string = f"{team_id}_{session_stage_id}_{self.id}"
                seed = abs(sum(ord(c) for c in seed_string))
        
        if not words:
            return None
        
        # Generar la sopa de letras
        return generate_word_search(words, seed=seed)
    
    def get_bubble_map_config(self) -> Dict:
        """
        Obtiene la configuración del bubble map para esta actividad.
        Retorna valores por defecto si no hay configuración específica en config_data.
        
        Returns:
            Diccionario con la configuración del bubble map:
            - max_answers_per_question: máximo de respuestas por pregunta (default: 4)
            - max_questions: máximo de preguntas (default: 7)
            - max_question_length: longitud máxima de pregunta (default: 60)
            - max_answer_length: longitud máxima de respuesta (default: 30)
        """
        config = self.config_data or {}
        bubble_map_config = config.get('bubble_map', {})
        
        return {
            'max_answers_per_question': bubble_map_config.get('max_answers_per_question', 4),
            'max_questions': bubble_map_config.get('max_questions', 7),
            'max_question_length': bubble_map_config.get('max_question_length', 60),
            'max_answer_length': bubble_map_config.get('max_answer_length', 30),
        }
    
    def get_anagram_data(self, count: int = 5, team_id: Optional[int] = None, session_stage_id: Optional[int] = None) -> Optional[Dict]:
        """
        Obtiene palabras aleatorias para el juego de anagrama.
        La selección es determinística basada en team_id y session_stage_id para que sea consistente.
        
        Args:
            count: Número de palabras a obtener (default: 5)
            team_id: ID del equipo (para selección determinística)
            session_stage_id: ID de la etapa de sesión (para selección determinística)
        
        Returns:
            Diccionario con 'words' (lista de objetos {word, scrambled_word})
        """
        from .models import AnagramWord
        import random
        
        # Obtener todas las palabras activas
        all_words = list(AnagramWord.objects.filter(is_active=True))
        
        if not all_words:
            return None
        
        # Validar que haya suficientes palabras
        if len(all_words) < count:
            # Si no hay suficientes palabras, lanzar error
            raise ValueError(f'No hay suficientes palabras activas. Se requieren {count} pero solo hay {len(all_words)}')
        
        # Si hay team_id y session_stage_id, usar selección determinística
        if team_id is not None and session_stage_id is not None:
            seed_string = f"{team_id}_{session_stage_id}_{self.id}"
            seed_value = abs(sum(ord(c) for c in seed_string))
            random.seed(seed_value)
            selected_words = random.sample(all_words, count)  # Siempre devolver exactamente 'count' palabras
            random.seed()  # Resetear semilla
        else:
            # Selección completamente aleatoria
            selected_words = random.sample(all_words, count)  # Siempre devolver exactamente 'count' palabras
        
        return {
            'words': [
                {
                    'word': word.word,
                    'anagram': word.scrambled_word
                }
                for word in selected_words
            ]
        }
    
    def get_chaos_data(self, team_id: Optional[int] = None, session_stage_id: Optional[int] = None) -> Optional[Dict]:
        """
        Obtiene información sobre las preguntas del caos disponibles.
        Las preguntas del caos son aleatorias (no determinísticas).
        Solo se devuelve si la actividad es de tipo presentación.
        """
        # Verificar si es una actividad de presentación
        if self.activity_type.code not in ['presentation', 'presentación']:
            return None
        
        # Importar aquí para evitar importación circular
        from challenges.models import ChaosQuestion
        
        # Obtener todas las preguntas activas del caos
        active_questions = ChaosQuestion.objects.filter(is_active=True)
        
        if not active_questions.exists():
            return None
        
        # Devolver información sobre las preguntas disponibles
        # (no devolvemos las preguntas completas porque son aleatorias)
        return {
            'available_count': active_questions.count(),
            'questions_available': True,
        }
    
    def get_general_knowledge_data(self, count: int = 5, team_id: Optional[int] = None, session_stage_id: Optional[int] = None) -> Optional[Dict]:
        """
        Obtiene preguntas aleatorias de conocimiento general.
        La selección es determinística basada en team_id y session_stage_id para que sea consistente.
        
        Args:
            count: Número de preguntas a obtener (default: 5)
            team_id: ID del equipo (para selección determinística)
            session_stage_id: ID de la etapa de sesión (para selección determinística)
        
        Returns:
            Diccionario con 'questions' (lista de objetos de pregunta)
        """
        from .models import GeneralKnowledgeQuestion
        import random
        
        # Obtener todas las preguntas activas
        all_questions = list(GeneralKnowledgeQuestion.objects.filter(is_active=True))
        
        if not all_questions:
            return None
        
        # Validar que haya suficientes preguntas
        if len(all_questions) < count:
            # Si no hay suficientes preguntas, lanzar error
            raise ValueError(f'No hay suficientes preguntas activas. Se requieren {count} pero solo hay {len(all_questions)}')
        
        # Si hay team_id y session_stage_id, usar selección determinística
        if team_id is not None and session_stage_id is not None:
            seed_string = f"{team_id}_{session_stage_id}_{self.id}_gk"
            seed_value = abs(sum(ord(c) for c in seed_string))
            random.seed(seed_value)
            selected_questions = random.sample(all_questions, count)  # Siempre devolver exactamente 'count' preguntas
            random.seed()  # Resetear semilla
        else:
            # Selección completamente aleatoria
            selected_questions = random.sample(all_questions, count)
        
        # Serializar las preguntas
        questions_data = []
        for q in selected_questions:
            questions_data.append({
                'id': q.id,
                'question': q.question,
                'option_a': q.option_a,
                'option_b': q.option_b,
                'option_c': q.option_c,
                'option_d': q.option_d,
                'correct_answer': q.correct_answer,
                'options': [
                    {'label': 'A', 'text': q.option_a},
                    {'label': 'B', 'text': q.option_b},
                    {'label': 'C', 'text': q.option_c},
                    {'label': 'D', 'text': q.option_d},
                ]
            })
        
        return {
            'questions': questions_data
        }
    
    def __str__(self):
        return f"{self.stage.name} - {self.name}"


class Topic(models.Model):
    """
    Tema para la etapa de Empatía (Many-to-Many con Facultades)
    """
    name = models.CharField(
        max_length=200,
        verbose_name='Nombre'
    )
    icon = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        verbose_name='Icono',
        help_text='Emoji o símbolo para representar el tema (ej: 🏥, 💰, 🌱)'
    )
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='Descripción'
    )
    image_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name='URL de Imagen'
    )
    category = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Categoría'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    faculties = models.ManyToManyField(
        Faculty,
        related_name='topics',
        verbose_name='Facultades'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'topics'
        verbose_name = 'Tema'
        verbose_name_plural = 'Temas'
        indexes = [
            models.Index(fields=['is_active']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return self.name


class Challenge(models.Model):
    """
    Desafío (Historia de Usuario) asociado a un tema
    """
    DIFFICULTY_LEVEL_CHOICES = [
        ('low', 'Baja'),
        ('medium', 'Media'),
        ('high', 'Alta'),
    ]

    topic = models.ForeignKey(
        Topic,
        on_delete=models.RESTRICT,
        related_name='challenges',
        verbose_name='Tema'
    )
    title = models.CharField(
        max_length=200,
        verbose_name='Título'
    )
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='Descripción del Desafío',
        help_text='Descripción del problema o desafío que se busca resolver'
    )
    icon = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        verbose_name='Icono',
        help_text='Emoji o símbolo para representar el desafío (ej: 💰, 🎓, 📱)'
    )
    # Campos para la persona de la historia de usuario
    persona_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Nombre de la Persona',
        help_text='Nombre de la persona en la historia de usuario'
    )
    persona_age = models.IntegerField(
        blank=True,
        null=True,
        verbose_name='Edad de la Persona',
        help_text='Edad de la persona en la historia de usuario'
    )
    persona_story = models.TextField(
        blank=True,
        null=True,
        verbose_name='Historia de la Persona',
        help_text='Cita o historia específica de la persona'
    )
    persona_image = models.ImageField(
        upload_to='personas/',
        blank=True,
        null=True,
        verbose_name='Imagen de la Persona',
        help_text='Imagen de perfil de la persona del desafío'
    )
    difficulty_level = models.CharField(
        max_length=20,
        choices=DIFFICULTY_LEVEL_CHOICES,
        default='medium',
        verbose_name='Nivel de Dificultad'
    )
    learning_objectives = models.TextField(
        blank=True,
        null=True,
        verbose_name='Objetivos de Aprendizaje'
    )
    additional_resources = models.TextField(
        blank=True,
        null=True,
        verbose_name='Recursos Adicionales'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'challenges'
        verbose_name = 'Desafío'
        verbose_name_plural = 'Desafíos'
        indexes = [
            models.Index(fields=['topic']),
            models.Index(fields=['difficulty_level']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.title} - {self.topic.name}"


class RouletteChallenge(models.Model):
    """
    Reto de ruleta (retos físicos/mentales/creativos)
    """
    CHALLENGE_TYPE_CHOICES = [
        ('physical', 'Físico'),
        ('mental', 'Mental'),
        ('creative', 'Creativo'),
        ('other', 'Otro'),
    ]

    description = models.TextField(
        verbose_name='Descripción'
    )
    challenge_type = models.CharField(
        max_length=20,
        choices=CHALLENGE_TYPE_CHOICES,
        verbose_name='Tipo de Reto'
    )
    difficulty_estimated = models.IntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        verbose_name='Dificultad Estimada (1-10)'
    )
    token_reward_min = models.IntegerField(
        default=0,
        verbose_name='Recompensa Mínima en Tokens'
    )
    token_reward_max = models.IntegerField(
        default=0,
        verbose_name='Recompensa Máxima en Tokens'
    )
    stages_applicable = models.JSONField(
        blank=True,
        null=True,
        verbose_name='Etapas Aplicables'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'roulette_challenges'
        verbose_name = 'Reto de Ruleta'
        verbose_name_plural = 'Retos de Ruleta'
        indexes = [
            models.Index(fields=['challenge_type']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.description[:50]}... ({self.challenge_type})"


class WordSearchOption(models.Model):
    """
    Opción de sopa de letras creada por la administradora
    Cada opción contiene una lista de palabras que se usarán para generar la sopa de letras
    """
    activity = models.ForeignKey(
        'Activity',
        on_delete=models.CASCADE,
        related_name='word_search_options',
        verbose_name='Actividad'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='Nombre de la opción',
        help_text='Nombre descriptivo para identificar esta opción de sopa de letras'
    )
    words = models.JSONField(
        verbose_name='Palabras',
        help_text='Lista de palabras para esta sopa de letras (máximo 5 palabras)'
    )
    grid = models.JSONField(
        blank=True,
        null=True,
        verbose_name='Grid Generado',
        help_text='Matriz 12x12 de la sopa de letras generada'
    )
    word_positions = models.JSONField(
        blank=True,
        null=True,
        verbose_name='Posiciones de Palabras',
        help_text='Lista de posiciones de cada palabra en el grid'
    )
    seed = models.IntegerField(
        blank=True,
        null=True,
        verbose_name='Semilla',
        help_text='Semilla usada para generar esta sopa de letras'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activa'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'word_search_options'
        verbose_name = 'Opción de Sopa de Letras'
        verbose_name_plural = 'Opciones de Sopa de Letras'
        indexes = [
            models.Index(fields=['activity', 'is_active']),
        ]
        ordering = ['activity', 'name']

    def __str__(self):
        return f"{self.name} ({self.activity.name})"


class Minigame(models.Model):
    """
    Minijuego (sopa de letras, puzzle, etc.)
    """
    MINIGAME_TYPE_CHOICES = [
        ('word_search', 'Sopa de Letras'),
        ('puzzle', 'Puzzle'),
        ('other', 'Otro'),
    ]

    name = models.CharField(
        max_length=100,
        verbose_name='Nombre'
    )
    type = models.CharField(
        max_length=20,
        choices=MINIGAME_TYPE_CHOICES,
        verbose_name='Tipo'
    )
    config = models.JSONField(
        blank=True,
        null=True,
        verbose_name='Configuración'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'minigames'
        verbose_name = 'Minijuego'
        verbose_name_plural = 'Minijuegos'
        indexes = [
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class LearningObjective(models.Model):
    """
    Objetivo de aprendizaje (puede estar asociado a una etapa)
    """
    stage = models.ForeignKey(
        Stage,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='learning_objectives',
        verbose_name='Etapa'
    )
    title = models.CharField(
        max_length=200,
        verbose_name='Título'
    )
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='Descripción'
    )
    evaluation_criteria = models.TextField(
        blank=True,
        null=True,
        verbose_name='Criterios de Evaluación'
    )
    pedagogical_recommendations = models.TextField(
        blank=True,
        null=True,
        verbose_name='Recomendaciones Pedagógicas'
    )
    estimated_time = models.IntegerField(
        blank=True,
        null=True,
        verbose_name='Tiempo Estimado (minutos)'
    )
    associated_resources = models.TextField(
        blank=True,
        null=True,
        verbose_name='Recursos Asociados'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'learning_objectives'
        verbose_name = 'Objetivo de Aprendizaje'
        verbose_name_plural = 'Objetivos de Aprendizaje'
        indexes = [
            models.Index(fields=['stage']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.title} - {self.stage.name if self.stage else 'General'}"


class AnagramWord(models.Model):
    """
    Palabras para el juego de Anagrama
    """
    word = models.CharField(
        max_length=100,
        verbose_name='Palabra'
    )
    scrambled_word = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Palabra Desordenada',
        help_text='Se genera automáticamente al guardar'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activa'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'anagram_words'
        verbose_name = 'Palabra de Anagrama'
        verbose_name_plural = 'Palabras de Anagrama'
        indexes = [
            models.Index(fields=['is_active']),
        ]
        ordering = ['word']

    def __str__(self):
        return self.word

    def save(self, *args, **kwargs):
        # Auto-generar scrambled_word si no existe o si la palabra cambió
        if not self.scrambled_word or (self.pk and self.word != self._get_original_word()):
            self.scrambled_word = self._scramble_word(self.word)
        super().save(*args, **kwargs)

    def _get_original_word(self):
        """Obtener la palabra original desde la BD"""
        if self.pk:
            try:
                original = AnagramWord.objects.get(pk=self.pk)
                return original.word
            except AnagramWord.DoesNotExist:
                pass
        return None

    @staticmethod
    def _scramble_word(word):
        """Desordenar palabra aleatoriamente"""
        word_list = list(word.upper())
        random.shuffle(word_list)
        return ''.join(word_list)


class ChaosQuestion(models.Model):
    """
    Preguntas del caos (Parte 2 de Presentación)
    Cada estudiante presiona el botón y recibe una pregunta aleatoria
    """
    question = models.TextField(
        verbose_name='Pregunta'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activa'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'chaos_questions'
        verbose_name = 'Pregunta del Caos'
        verbose_name_plural = 'Preguntas del Caos'
        indexes = [
            models.Index(fields=['is_active']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return self.question[:50] + '...' if len(self.question) > 50 else self.question


class GeneralKnowledgeQuestion(models.Model):
    """
    Preguntas de conocimiento general (no emprendimiento)
    Usadas en Parte 3 del minijuego y presentación
    """
    question = models.TextField(
        verbose_name='Pregunta'
    )
    option_a = models.CharField(
        max_length=255,
        verbose_name='Opción A'
    )
    option_b = models.CharField(
        max_length=255,
        verbose_name='Opción B'
    )
    option_c = models.CharField(
        max_length=255,
        verbose_name='Opción C'
    )
    option_d = models.CharField(
        max_length=255,
        verbose_name='Opción D'
    )
    correct_answer = models.IntegerField(
        choices=[(0, 'A'), (1, 'B'), (2, 'C'), (3, 'D')],
        verbose_name='Respuesta Correcta'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activa'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'general_knowledge_questions'
        verbose_name = 'Pregunta de Conocimiento General'
        verbose_name_plural = 'Preguntas de Conocimiento General'
        indexes = [
            models.Index(fields=['is_active']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return self.question[:50] + '...' if len(self.question) > 50 else self.question
