"""
Modelos para la app game_sessions (Sesiones de juego, equipos, progreso, etc.)
"""
import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from users.models import Professor, Student
from academic.models import Course


class SessionGroup(models.Model):
    """
    Grupo de sesiones de juego (para manejar múltiples salas cuando hay muchos alumnos)
    """
    professor = models.ForeignKey(
        Professor,
        on_delete=models.RESTRICT,
        related_name='session_groups',
        verbose_name='Profesor'
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.RESTRICT,
        related_name='session_groups',
        verbose_name='Curso'
    )
    total_students = models.IntegerField(
        verbose_name='Total de Estudiantes'
    )
    number_of_sessions = models.IntegerField(
        verbose_name='Número de Salas'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'session_groups'
        verbose_name = 'Grupo de Sesiones'
        verbose_name_plural = 'Grupos de Sesiones'
        indexes = [
            models.Index(fields=['professor']),
            models.Index(fields=['course']),
        ]

    def __str__(self):
        return f"Grupo {self.id} - {self.course.name} ({self.number_of_sessions} salas)"


class GameSession(models.Model):
    """
    Sesión de juego (sala)
    """
    STATUS_CHOICES = [
        ('lobby', 'Lobby'),
        ('running', 'En Curso'),
        ('completed', 'Completada'),
        ('cancelled', 'Cancelada'),
    ]

    session_group = models.ForeignKey(
        'SessionGroup',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='game_sessions',
        verbose_name='Grupo de Sesiones'
    )
    professor = models.ForeignKey(
        Professor,
        on_delete=models.RESTRICT,
        related_name='game_sessions',
        verbose_name='Profesor'
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.RESTRICT,
        related_name='game_sessions',
        verbose_name='Curso'
    )
    room_code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Código de Sala'
    )
    qr_code = models.TextField(
        blank=True,
        null=True,
        verbose_name='Código QR'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='lobby',
        verbose_name='Estado'
    )
    started_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Iniciada en'
    )
    ended_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Finalizada en'
    )
    cancellation_reason = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='Motivo de Cancelación',
        help_text='Motivo por el cual se canceló la sesión'
    )
    cancellation_reason_other = models.TextField(
        blank=True,
        null=True,
        verbose_name='Motivo de Cancelación (Otro)',
        help_text='Descripción adicional si se seleccionó "Otro" como motivo'
    )
    current_stage = models.ForeignKey(
        'challenges.Stage',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='current_sessions',
        verbose_name='Etapa Actual'
    )
    current_activity = models.ForeignKey(
        'challenges.Activity',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='current_sessions',
        verbose_name='Actividad Actual'
    )
    show_results_stage = models.PositiveSmallIntegerField(
        default=0,
        verbose_name='Mostrar Resultados Etapa',
        help_text='0=oculto; 1-4=mostrando resultados de esa etapa'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'game_sessions'
        verbose_name = 'Sesión de Juego'
        verbose_name_plural = 'Sesiones de Juego'
        indexes = [
            models.Index(fields=['professor']),
            models.Index(fields=['room_code']),
            models.Index(fields=['status']),
            models.Index(fields=['status', 'started_at']),
            models.Index(fields=['created_at']),
            models.Index(fields=['course']),
        ]

    def __str__(self):
        return f"Sesión {self.room_code} - {self.course.name}"


class Team(models.Model):
    """
    Equipo dentro de una sesión de juego
    """
    game_session = models.ForeignKey(
        GameSession,
        on_delete=models.CASCADE,
        related_name='teams',
        verbose_name='Sesión de Juego'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='Nombre'
    )
    color = models.CharField(
        max_length=50,
        verbose_name='Color'
    )
    tokens_total = models.IntegerField(
        default=0,
        verbose_name='Tokens Totales'
    )
    students = models.ManyToManyField(
        Student,
        through='TeamStudent',
        related_name='teams',
        verbose_name='Estudiantes'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'teams'
        verbose_name = 'Equipo'
        verbose_name_plural = 'Equipos'
        unique_together = [['game_session', 'name']]
        indexes = [
            models.Index(fields=['game_session']),
            models.Index(fields=['color']),
        ]

    def __str__(self):
        return f"Equipo {self.name} ({self.color}) - {self.game_session.room_code}"


class TeamStudent(models.Model):
    """
    Relación Many-to-Many entre Teams y Students
    """
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='team_students'
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='team_students'
    )

    class Meta:
        db_table = 'team_students'
        unique_together = [['team', 'student']]
        indexes = [
            models.Index(fields=['student']),
        ]


class TeamPersonalization(models.Model):
    """
    Personalización del equipo (Etapa 1)
    """
    team = models.OneToOneField(
        Team,
        on_delete=models.CASCADE,
        related_name='personalization',
        primary_key=True,
        verbose_name='Equipo'
    )
    team_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Nombre del Equipo'
    )
    team_members_know_each_other = models.BooleanField(
        blank=True,
        null=True,
        verbose_name='Los miembros se conocen'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'team_personalization'
        verbose_name = 'Personalización del Equipo'
        verbose_name_plural = 'Personalizaciones de Equipos'

    def __str__(self):
        return f"Personalización de {self.team.name}"


class SessionStage(models.Model):
    """
    Progreso de una etapa en una sesión de juego
    """
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('in_progress', 'En Progreso'),
        ('completed', 'Completada'),
    ]

    game_session = models.ForeignKey(
        GameSession,
        on_delete=models.CASCADE,
        related_name='session_stages',
        verbose_name='Sesión de Juego'
    )
    stage = models.ForeignKey(
        'challenges.Stage',
        on_delete=models.RESTRICT,
        related_name='session_stages',
        verbose_name='Etapa'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='Estado'
    )
    started_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Iniciada en'
    )
    completed_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Completada en'
    )
    presentation_order = models.JSONField(
        blank=True,
        null=True,
        verbose_name='Orden de Presentación',
        help_text='Array de IDs de equipos en orden de presentación (Etapa 4)'
    )
    current_presentation_team_id = models.IntegerField(
        blank=True,
        null=True,
        verbose_name='ID del Equipo Presentando Actualmente',
        help_text='ID del equipo que está presentando actualmente (Etapa 4)'
    )
    presentation_state = models.CharField(
        max_length=20,
        choices=[
            ('not_started', 'No Iniciado'),
            ('preparing', 'Preparación'),
            ('presenting', 'Presentando'),
            ('evaluating', 'Evaluando'),
        ],
        default='not_started',
        verbose_name='Estado de Presentación',
        help_text='Estado actual del flujo de presentaciones (Etapa 4)'
    )
    presentation_timestamps = models.JSONField(
        blank=True,
        null=True,
        verbose_name='Timestamps de Presentaciones',
        help_text='Diccionario con timestamps de inicio de cada presentación: {team_id: timestamp} (Etapa 4)'
    )

    class Meta:
        db_table = 'session_stages'
        verbose_name = 'Etapa de Sesión'
        verbose_name_plural = 'Etapas de Sesión'
        unique_together = [['game_session', 'stage']]
        indexes = [
            models.Index(fields=['game_session']),
            models.Index(fields=['stage']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.stage.name} - {self.game_session.room_code}"


class TeamActivityProgress(models.Model):
    """
    Progreso de una actividad por equipo (Tabla genérica unificada)
    """
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('in_progress', 'En Progreso'),
        ('submitted', 'Entregado'),
        ('completed', 'Completado'),
    ]

    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='activity_progress',
        verbose_name='Equipo'
    )
    session_stage = models.ForeignKey(
        SessionStage,
        on_delete=models.CASCADE,
        related_name='team_activities',
        verbose_name='Etapa de Sesión'
    )
    activity = models.ForeignKey(
        'challenges.Activity',
        on_delete=models.RESTRICT,
        related_name='team_progress',
        verbose_name='Actividad'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='Estado'
    )
    started_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Iniciada en'
    )
    completed_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Completada en'
    )
    progress_percentage = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name='Porcentaje de Progreso'
    )
    
    # Respuesta genérica (JSON flexible)
    response_data = models.JSONField(
        blank=True,
        null=True,
        verbose_name='Datos de Respuesta'
    )
    
    # Campos específicos (opcionales)
    selected_topic = models.ForeignKey(
        'challenges.Topic',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='selected_in_activities',
        verbose_name='Tema Seleccionado'
    )
    selected_challenge = models.ForeignKey(
        'challenges.Challenge',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='selected_in_activities',
        verbose_name='Desafío Seleccionado'
    )
    prototype_image_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name='URL de Imagen del Prototipo'
    )
    pitch_intro_problem = models.TextField(
        blank=True,
        null=True,
        verbose_name='Pitch: Problema'
    )
    pitch_solution = models.TextField(
        blank=True,
        null=True,
        verbose_name='Pitch: Solución'
    )
    pitch_value = models.TextField(
        blank=True,
        null=True,
        verbose_name='Pitch: Valor'
    )
    pitch_impact = models.TextField(
        blank=True,
        null=True,
        verbose_name='Pitch: Impacto'
    )
    pitch_closing = models.TextField(
        blank=True,
        null=True,
        verbose_name='Pitch: Cierre'
    )

    class Meta:
        db_table = 'team_activity_progress'
        verbose_name = 'Progreso de Actividad del Equipo'
        verbose_name_plural = 'Progresos de Actividades de Equipos'
        unique_together = [
            ('team', 'activity', 'session_stage'),
        ]
        indexes = [
            models.Index(fields=['team']),
            models.Index(fields=['session_stage']),
            models.Index(fields=['activity']),
            models.Index(fields=['status']),
            models.Index(fields=['team', 'activity']),
            models.Index(fields=['session_stage', 'activity']),
        ]

    def __str__(self):
        return f"{self.team.name} - {self.activity.name} ({self.status})"


class TeamBubbleMap(models.Model):
    """
    Bubble Map (Mapa Mental) creado por un equipo en la Etapa 2: Empatía
    """
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='bubble_maps',
        verbose_name='Equipo'
    )
    session_stage = models.ForeignKey(
        SessionStage,
        on_delete=models.CASCADE,
        related_name='bubble_maps',
        verbose_name='Etapa de Sesión'
    )
    # Estructura JSON del bubble map: {nodes: [{id, text, x, y, ...}], edges: [...]}
    map_data = models.JSONField(
        verbose_name='Datos del Mapa'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'team_bubble_maps'
        verbose_name = 'Bubble Map del Equipo'
        verbose_name_plural = 'Bubble Maps de Equipos'
        unique_together = [
            ('team', 'session_stage'),
        ]
        indexes = [
            models.Index(fields=['team']),
            models.Index(fields=['session_stage']),
        ]

    def __str__(self):
        return f"{self.team.name} - Bubble Map ({self.session_stage.stage.name})"


class Tablet(models.Model):
    """
    Tablet disponible para uso en sesiones
    """
    tablet_code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Código de Tablet'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activa'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tablets'
        verbose_name = 'Tablet'
        verbose_name_plural = 'Tablets'
        indexes = [
            models.Index(fields=['tablet_code']),
        ]

    def __str__(self):
        return f"Tablet {self.tablet_code}"


class TabletConnection(models.Model):
    """
    Conexión de una tablet a un equipo en una sesión
    """
    tablet = models.ForeignKey(
        Tablet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='connections',
        verbose_name='Tablet'
    )
    team_session_token = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        verbose_name='Token de Sesión de Equipo'
    )
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='tablet_connections',
        verbose_name='Equipo'
    )
    game_session = models.ForeignKey(
        GameSession,
        on_delete=models.CASCADE,
        related_name='tablet_connections',
        verbose_name='Sesión de Juego'
    )
    connected_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Conectada en'
    )
    disconnected_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Desconectada en'
    )
    last_seen = models.DateTimeField(
        auto_now=True,
        verbose_name='Última Vez Vista'
    )
    current_screen = models.CharField(
        max_length=50,
        default='',
        blank=True,
        verbose_name='Pantalla Actual',
        help_text='Pantalla que reporta la tablet (ej: results_1, lobby, activity)'
    )

    class Meta:
        db_table = 'tablet_connections'
        verbose_name = 'Conexión de Tablet'
        verbose_name_plural = 'Conexiones de Tablets'
        indexes = [
            models.Index(fields=['tablet']),
            models.Index(fields=['team']),
            models.Index(fields=['game_session']),
            models.Index(fields=['last_seen']),
        ]

    def __str__(self):
        return f"{self.tablet.tablet_code} - {self.team.name}"


class TeamRouletteAssignment(models.Model):
    """
    Asignación de reto de ruleta a un equipo
    """
    STATUS_CHOICES = [
        ('assigned', 'Asignado'),
        ('accepted', 'Aceptado'),
        ('rejected', 'Rechazado'),
        ('completed', 'Completado'),
        ('failed', 'Fallido'),
    ]

    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='roulette_assignments',
        verbose_name='Equipo'
    )
    session_stage = models.ForeignKey(
        SessionStage,
        on_delete=models.CASCADE,
        related_name='roulette_assignments',
        verbose_name='Etapa de Sesión'
    )
    roulette_challenge = models.ForeignKey(
        'challenges.RouletteChallenge',
        on_delete=models.RESTRICT,
        related_name='assignments',
        verbose_name='Reto de Ruleta'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='assigned',
        verbose_name='Estado'
    )
    token_reward = models.IntegerField(
        default=0,
        verbose_name='Recompensa en Tokens'
    )
    assigned_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Asignado en'
    )
    accepted_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Aceptado en'
    )
    rejected_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Rechazado en'
    )
    completed_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Completado en'
    )
    validated_by = models.ForeignKey(
        Professor,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='validated_roulette_challenges',
        verbose_name='Validado por'
    )

    class Meta:
        db_table = 'team_roulette_assignments'
        verbose_name = 'Asignación de Reto de Ruleta'
        verbose_name_plural = 'Asignaciones de Retos de Ruleta'
        indexes = [
            models.Index(fields=['team']),
            models.Index(fields=['roulette_challenge']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.team.name} - {self.roulette_challenge} ({self.status})"


class TokenTransaction(models.Model):
    """
    Transacción de tokens (normalizado)
    """
    SOURCE_TYPE_CHOICES = [
        ('activity', 'Actividad'),
        ('roulette_challenge', 'Reto de Ruleta'),
        ('peer_evaluation', 'Evaluación Peer'),
        ('manual_adjustment', 'Ajuste Manual'),
        ('system', 'Sistema'),
    ]

    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='token_transactions',
        verbose_name='Equipo'
    )
    game_session = models.ForeignKey(
        GameSession,
        on_delete=models.CASCADE,
        related_name='token_transactions',
        verbose_name='Sesión de Juego'
    )
    session_stage = models.ForeignKey(
        SessionStage,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='token_transactions',
        verbose_name='Etapa de Sesión'
    )
    amount = models.IntegerField(
        verbose_name='Cantidad'
    )
    source_type = models.CharField(
        max_length=30,
        choices=SOURCE_TYPE_CHOICES,
        verbose_name='Tipo de Fuente'
    )
    source_id = models.IntegerField(
        blank=True,
        null=True,
        verbose_name='ID de Fuente'
    )
    reason = models.TextField(
        blank=True,
        null=True,
        verbose_name='Razón'
    )
    awarded_by = models.ForeignKey(
        Professor,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='awarded_tokens',
        verbose_name='Otorgado por'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Creado en'
    )

    class Meta:
        db_table = 'token_transactions'
        verbose_name = 'Transacción de Tokens'
        verbose_name_plural = 'Transacciones de Tokens'
        indexes = [
            models.Index(fields=['team']),
            models.Index(fields=['game_session']),
            models.Index(fields=['source_type', 'source_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.team.name} - {self.amount} tokens ({self.source_type})"


class PeerEvaluation(models.Model):
    """
    Evaluación peer (Etapa 4)
    """
    evaluator_team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='evaluations_given',
        verbose_name='Equipo Evaluador'
    )
    evaluated_team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='evaluations_received',
        verbose_name='Equipo Evaluado'
    )
    game_session = models.ForeignKey(
        GameSession,
        on_delete=models.CASCADE,
        related_name='peer_evaluations',
        verbose_name='Sesión de Juego'
    )
    criteria_scores = models.JSONField(
        verbose_name='Puntuaciones por Criterio'
    )
    total_score = models.IntegerField(
        verbose_name='Puntuación Total'
    )
    tokens_awarded = models.IntegerField(
        default=0,
        verbose_name='Tokens Otorgados'
    )
    feedback = models.TextField(
        blank=True,
        null=True,
        verbose_name='Feedback'
    )
    submitted_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Enviado en'
    )

    class Meta:
        db_table = 'peer_evaluations'
        verbose_name = 'Evaluación Peer'
        verbose_name_plural = 'Evaluaciones Peer'
        unique_together = [['evaluator_team', 'evaluated_team', 'game_session']]
        indexes = [
            models.Index(fields=['evaluator_team']),
            models.Index(fields=['evaluated_team']),
            models.Index(fields=['game_session']),
        ]

    def __str__(self):
        return f"{self.evaluator_team.name} → {self.evaluated_team.name} ({self.total_score})"


class ReflectionEvaluation(models.Model):
    """Evaluación de reflexión post-juego"""
    game_session = models.ForeignKey(
        GameSession,
        on_delete=models.CASCADE,
        related_name='reflection_evaluations',
        verbose_name='Sesión de Juego'
    )
    student_name = models.CharField(
        max_length=200,
        verbose_name='Nombre y Apellido'
    )
    student_email = models.EmailField(
        verbose_name='Correo UDD'
    )
    faculty = models.CharField(
        max_length=200,
        verbose_name='Facultad',
        blank=True,
        null=True
    )
    career = models.CharField(
        max_length=200,
        verbose_name='Carrera',
        blank=True,
        null=True
    )
    
    # Múltiple selección (guardar como JSON)
    value_areas = models.JSONField(
        default=list,
        verbose_name='Áreas de Valor',
        help_text='Resolver desafíos, Trabajar en equipo, Empatizar, etc.'
    )
    
    # Escala de satisfacción
    satisfaction = models.CharField(
        max_length=50,
        choices=[
            ('mucho', 'Sí, mucho'),
            ('si', 'Sí'),
            ('masomenos', 'Más o menos'),
            ('nomucho', 'No mucho'),
            ('no', 'No'),
        ],
        verbose_name='Te gustó la actividad realizada?',
        blank=True,
        null=True
    )
    
    # Incremento de interés en emprender
    entrepreneurship_interest = models.CharField(
        max_length=50,
        choices=[
            ('ya_tenia', 'Ya tenía ganas de emprender antes de la actividad'),
            ('me_encantaria', 'Sí, me encantaría emprender'),
            ('posible_opcion', 'Ahora lo veo como una posible opción'),
            ('no_interesa', 'No, sigue sin interesarme'),
        ],
        verbose_name='¿Se incrementaron tus ganas de querer emprender?',
        blank=True,
        null=True
    )
    
    comments = models.TextField(
        blank=True,
        null=True,
        verbose_name='Comentarios sobre la actividad o intereses'
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Creado en'
    )
    
    class Meta:
        db_table = 'reflection_evaluations'
        verbose_name = 'Evaluación de Reflexión'
        verbose_name_plural = 'Evaluaciones de Reflexión'
        indexes = [
            models.Index(fields=['game_session']),
            models.Index(fields=['student_email']),
        ]
    
    def __str__(self):
        return f"Evaluación de {self.student_name} - {self.game_session.room_code}"
