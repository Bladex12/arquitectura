"""
Modelos para la app academic (Estructura académica: Facultades, Carreras, Cursos)
"""
from django.db import models


class Faculty(models.Model):
    """
    Facultad de la universidad
    """
    name = models.CharField(
        max_length=200,
        unique=True,
        verbose_name='Nombre'
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        null=True,
        verbose_name='Código'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'faculties'
        verbose_name = 'Facultad'
        verbose_name_plural = 'Facultades'
        indexes = [
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name


class Career(models.Model):
    """
    Carrera perteneciente a una Facultad
    """
    faculty = models.ForeignKey(
        Faculty,
        on_delete=models.RESTRICT,
        related_name='careers',
        verbose_name='Facultad'
    )
    name = models.CharField(
        max_length=200,
        verbose_name='Nombre'
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        null=True,
        verbose_name='Código'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'careers'
        verbose_name = 'Carrera'
        verbose_name_plural = 'Carreras'
        unique_together = [['faculty', 'name']]
        indexes = [
            models.Index(fields=['faculty']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} - {self.faculty.name}"


class Course(models.Model):
    """
    Curso perteneciente a una Carrera
    """
    career = models.ForeignKey(
        Career,
        on_delete=models.RESTRICT,
        related_name='courses',
        verbose_name='Carrera'
    )
    name = models.CharField(
        max_length=200,
        verbose_name='Nombre'
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        null=True,
        verbose_name='Código'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'courses'
        verbose_name = 'Curso'
        verbose_name_plural = 'Cursos'
        indexes = [
            models.Index(fields=['career']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} - {self.career.name}"
