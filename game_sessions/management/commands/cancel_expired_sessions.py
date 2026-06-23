"""
Management command para cancelar automáticamente sesiones expiradas (2 horas)
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from game_sessions.models import GameSession
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Cancela automáticamente las sesiones que han expirado (2 horas desde creación o inicio)'

    def handle(self, *args, **options):
        """
        Busca todas las sesiones activas (lobby o running) que han expirado
        y las cancela automáticamente
        """
        # Obtener sesiones activas que no estén completadas o canceladas
        active_sessions = GameSession.objects.filter(
            status__in=['lobby', 'running']
        )
        
        cancelled_count = 0
        
        for session in active_sessions:
            if session.auto_cancel_if_expired():
                cancelled_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Sesión {session.room_code} cancelada automáticamente (expirada)'
                    )
                )
        
        if cancelled_count == 0:
            self.stdout.write(
                self.style.SUCCESS('No hay sesiones expiradas para cancelar')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Total de sesiones canceladas: {cancelled_count}'
                )
            )
        
        logger.info(f'Comando cancel_expired_sessions ejecutado: {cancelled_count} sesiones canceladas')







