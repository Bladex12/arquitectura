"""
Comando de gestión para crear las tablets del sistema
Crea tablets con códigos TAB1, TAB2, TAB3, ..., TAB8
"""
from django.core.management.base import BaseCommand
from game_sessions.models import Tablet


class Command(BaseCommand):
    help = 'Crea las tablets del sistema con códigos TAB1 a TAB8'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=8,
            help='Número de tablets a crear (default: 8)'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Recrear tablets aunque ya existan'
        )

    def handle(self, *args, **options):
        count = options['count']
        force = options['force']
        
        created_count = 0
        updated_count = 0
        skipped_count = 0
        
        for i in range(1, count + 1):
            tablet_code = f'TAB{i}'
            
            try:
                tablet, created = Tablet.objects.get_or_create(
                    tablet_code=tablet_code,
                    defaults={
                        'is_active': True
                    }
                )
                
                if created:
                    created_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'[OK] Tablet {tablet_code} creada exitosamente')
                    )
                else:
                    if force:
                        tablet.is_active = True
                        tablet.save()
                        updated_count += 1
                        self.stdout.write(
                            self.style.WARNING(f'[UPDATE] Tablet {tablet_code} actualizada')
                        )
                    else:
                        skipped_count += 1
                        self.stdout.write(
                            self.style.NOTICE(f'[SKIP] Tablet {tablet_code} ya existe (usa --force para actualizar)')
                        )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'[ERROR] Error al crear tablet {tablet_code}: {str(e)}')
                )
        
        # Resumen
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write(self.style.SUCCESS(f'Resumen:'))
        self.stdout.write(f'  Creadas: {created_count}')
        if updated_count > 0:
            self.stdout.write(f'  Actualizadas: {updated_count}')
        if skipped_count > 0:
            self.stdout.write(f'  Omitidas: {skipped_count}')
        self.stdout.write('=' * 50)

