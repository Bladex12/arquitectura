"""
Management command para cancelar automáticamente sesiones expiradas (2 horas)
"""
from datetime import datetime, timedelta, timezone as dt_timezone

from django.conf import settings
from django.core.management.base import BaseCommand

from game_sessions.dynamodb.game_session import scan_active_sessions, update_session, update_session_status


class Command(BaseCommand):
    help = 'Cancela automáticamente las sesiones que han expirado (2 horas desde creación o inicio)'

    def handle(self, *args, **options):
        """
        Busca todas las sesiones activas (lobby o running) que han expirado
        (2 horas desde creación o inicio) y las cancela automáticamente
        """
        expiry_hours = settings.GAME_CONFIG.get('SESSION_EXPIRY_HOURS', 2)
        cutoff = datetime.now(dt_timezone.utc) - timedelta(hours=expiry_hours)
        cancelled_count = 0

        for session in scan_active_sessions():
            reference_iso = session['started_at'] or session['created_at']
            reference_dt = datetime.fromisoformat(reference_iso)
            if reference_dt < cutoff:
                if update_session_status(session['room_code'], expected_status=session['status'], new_status='cancelled'):
                    update_session(session['room_code'], cancellation_reason='auto_expired')
                    cancelled_count += 1
                    self.stdout.write(self.style.SUCCESS(f"Sesión {session['room_code']} cancelada automáticamente (expirada)"))

        if cancelled_count == 0:
            self.stdout.write(self.style.SUCCESS('No hay sesiones expiradas para cancelar'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Total de sesiones canceladas: {cancelled_count}'))
