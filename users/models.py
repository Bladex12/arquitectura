"""
Modelos para la app users (Usuarios, Profesores, Estudiantes, Administradores)
"""
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import RegexValidator


class Administrator(models.Model):
    """
    Administrador del sistema (OneToOne con User)
    Los administradores también son profesores automáticamente
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='administrator',
        verbose_name='Usuario'
    )
    is_super_admin = models.BooleanField(
        default=False,
        verbose_name='Super Administrador'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'administrators'
        verbose_name = 'Administrador'
        verbose_name_plural = 'Administradores'
        indexes = [
            models.Index(fields=['user']),
        ]


    def __str__(self):
        return f"Administrador: {self.user.username}"


class ProfessorAccessCode(models.Model):
    """
    Códigos de acceso pendientes para profesores
    Se generan cuando el administrador invita a un profesor
    """
    email = models.EmailField(
        unique=True,
        verbose_name='Correo Electrónico',
        help_text='Correo del profesor al que se envió el código'
    )
    access_code = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='Código de Acceso',
        validators=[
            RegexValidator(
                regex=r'^\d+$',
                message='El código de acceso debe contener solo números'
            )
        ]
    )
    is_used = models.BooleanField(
        default=False,
        verbose_name='Usado',
        help_text='Indica si el código ya fue utilizado para registrarse'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'professor_access_codes'
        verbose_name = 'Código de Acceso de Profesor'
        verbose_name_plural = 'Códigos de Acceso de Profesores'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['access_code']),
            models.Index(fields=['is_used']),
            # Índice compuesto para la consulta más común: buscar código no usado por email y código
            models.Index(fields=['access_code', 'is_used', 'email'], name='prof_access_code_lookup_idx'),
        ]

    def __str__(self):
        return f"Código {self.access_code} para {self.email}"


class Professor(models.Model):
    """
    Profesor que gestiona sesiones de juego (OneToOne con User)
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='professor',
        verbose_name='Usuario'
    )
    access_code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        verbose_name='Código de Acceso',
        validators=[
            RegexValidator(
                regex=r'^\d+$',
                message='El código de acceso debe contener solo números'
            )
        ]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'professors'
        verbose_name = 'Profesor'
        verbose_name_plural = 'Profesores'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['access_code']),
        ]

    def __str__(self):
        return f"Profesor: {self.user.get_full_name() or self.user.username}"
    
    def get_unique_students_count(self):
        """
        Calcula el número de estudiantes únicos que han participado
        en todas las sesiones completadas del profesor.
        """
        from game_sessions.models import TeamStudent
        
        # Obtener todas las sesiones completadas del profesor
        completed_sessions = self.game_sessions.filter(status='completed')
        
        # Contar estudiantes únicos usando TeamStudent (tabla intermedia)
        unique_students = TeamStudent.objects.filter(
            team__game_session__in=completed_sessions
        ).values('student').distinct().count()
        
        return unique_students


class Student(models.Model):
    """
    Estudiante que participa en el juego (NO tiene login, solo datos)
    """
    full_name = models.CharField(
        max_length=200,
        verbose_name='Nombre Completo'
    )
    email = models.EmailField(
        unique=True,
        verbose_name='Correo UDD'
    )
    rut = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='RUT'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'students'
        verbose_name = 'Estudiante'
        verbose_name_plural = 'Estudiantes'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['rut']),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.rut})"
