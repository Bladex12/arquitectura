"""
Señales para la app users
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import Administrator, Professor

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def create_administrator_and_professor_for_staff(sender, instance, created, **kwargs):
    """
    Crear automáticamente objeto Administrator y Professor cuando un usuario es marcado como staff
    Los administradores (staff) siempre deben tener perfil de profesor
    
    Nota: is_super_admin del modelo Administrator es independiente de is_superuser de Django
    """
    # Evitar ejecución durante migraciones o carga de fixtures
    if kwargs.get('raw', False):
        return
    
    # Solo crear si el usuario es staff Y si cambió el estado de staff (created=True o update_fields contiene 'is_staff')
    # Esto evita ejecutar la señal en cada save() durante el login (que solo actualiza last_login)
    update_fields = kwargs.get('update_fields')
    if update_fields and 'is_staff' not in update_fields and not created:
        return
    
    # Solo crear Administrator y Professor si el usuario es staff (no necesariamente superuser)
    if instance.is_staff:
        try:
            # Crear o obtener Administrator
            Administrator.objects.get_or_create(
                user=instance,
                defaults={'is_super_admin': False}
            )
            
            # Crear o obtener Professor (los administradores siempre son profesores)
            Professor.objects.get_or_create(
                user=instance,
                defaults={'access_code': None}
            )
        except Exception as e:
            logger.error(f'Error creando Administrator/Professor para usuario {instance.username}: {str(e)}', exc_info=True)
    # Si el usuario deja de ser staff, eliminar Administrator
    elif not instance.is_staff:
        try:
            Administrator.objects.filter(user=instance).delete()
        except Exception as e:
            logger.error(f'Error eliminando Administrator para usuario {instance.username}: {str(e)}', exc_info=True)
