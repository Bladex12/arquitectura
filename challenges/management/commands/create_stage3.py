"""
Comando de gestión para crear la Etapa 3: Creatividad
"""
from django.core.management.base import BaseCommand
from challenges.models import Stage, ActivityType, Activity


class Command(BaseCommand):
    help = 'Crea la Etapa 3: Creatividad y su actividad de Subida de Prototipo'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Recrear los datos aunque ya existan'
        )

    def handle(self, *args, **options):
        force = options['force']
        
        # Crear Tipo de Actividad: Subida de Prototipo
        activity_type, created = ActivityType.objects.get_or_create(
            code='prototipo',
            defaults={
                'name': 'Subida de Prototipo',
                'description': 'Actividad para subir imagen del prototipo físico construido',
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Tipo de Actividad "Subida de Prototipo" creado'))
        elif force:
            activity_type.name = 'Subida de Prototipo'
            activity_type.description = 'Actividad para subir imagen del prototipo físico construido'
            activity_type.is_active = True
            activity_type.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Tipo de Actividad "Subida de Prototipo" actualizado'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Tipo de Actividad "Subida de Prototipo" ya existe'))

        # Crear Etapa 3: Creatividad
        stage, created = Stage.objects.get_or_create(
            number=3,
            defaults={
                'name': 'Creatividad',
                'description': 'Tercera etapa del juego enfocada en la creatividad y construcción de prototipos',
                'objective': 'Crear una solución con legos',
                'estimated_duration': 30,
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Etapa 3 "Creatividad" creada'))
        elif force:
            stage.name = 'Creatividad'
            stage.description = 'Tercera etapa del juego enfocada en la creatividad y construcción de prototipos'
            stage.objective = 'Crear una solución con legos'
            stage.estimated_duration = 30
            stage.is_active = True
            stage.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Etapa 3 "Creatividad" actualizada'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Etapa 3 "Creatividad" ya existe'))

        # Crear Actividad: Subida de Prototipo Lego
        activity, created = Activity.objects.get_or_create(
            stage=stage,
            order_number=1,
            defaults={
                'activity_type': activity_type,
                'name': 'Subida de Prototipo Lego',
                'description': 'Los equipos construyen físicamente un prototipo con legos y suben una foto del resultado',
                'order_number': 1,
                'timer_duration': 600,  # 10 minutos
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Actividad "Subida de Prototipo Lego" creada'))
        elif force:
            activity.activity_type = activity_type
            activity.name = 'Subida de Prototipo Lego'
            activity.description = 'Los equipos construyen físicamente un prototipo con legos y suben una foto del resultado'
            activity.timer_duration = 600
            activity.is_active = True
            activity.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Actividad "Subida de Prototipo Lego" actualizada'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Actividad "Subida de Prototipo Lego" ya existe'))

        self.stdout.write(self.style.SUCCESS('\n[DONE] Etapa 3: Creatividad creada exitosamente!'))

