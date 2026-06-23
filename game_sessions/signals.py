"""
Signals para la app game_sessions
"""
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.db import transaction
from .models import GameSession, SessionGroup


@receiver(post_delete, sender=GameSession)
def delete_empty_session_group(sender, instance, **kwargs):
    """
    Elimina el SessionGroup si ya no tiene GameSessions asociadas
    """
    if instance.session_group:
        session_group_id = instance.session_group_id
        # Usar transaction para evitar race conditions
        with transaction.atomic():
            try:
                session_group = SessionGroup.objects.select_for_update().get(pk=session_group_id)
                # Verificar si quedan más GameSessions en este grupo
                remaining_sessions = GameSession.objects.filter(session_group=session_group).count()
                
                # Si no quedan más sesiones, eliminar el grupo
                if remaining_sessions == 0:
                    session_group.delete()
            except SessionGroup.DoesNotExist:
                # El grupo ya fue eliminado, no hacer nada
                pass

