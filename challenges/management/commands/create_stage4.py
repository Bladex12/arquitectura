"""
Comando de gestión para crear la Etapa 4: Comunicación
"""
from django.core.management.base import BaseCommand
from challenges.models import Stage, ActivityType, Activity


class Command(BaseCommand):
    help = 'Crea la Etapa 4: Comunicación y sus actividades (Formulario de Pitch, Presentación del Pitch)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Recrear los datos aunque ya existan'
        )

    def handle(self, *args, **options):
        force = options['force']
        
        # Crear Tipo de Actividad: Formulario de Pitch
        activity_type_pitch, created = ActivityType.objects.get_or_create(
            code='formulario_pitch',
            defaults={
                'name': 'Formulario de Pitch',
                'description': 'Actividad para completar el formulario del pitch con intro-problema, solución y cierre',
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Tipo de Actividad "Formulario de Pitch" creado'))
        elif force:
            activity_type_pitch.name = 'Formulario de Pitch'
            activity_type_pitch.description = 'Actividad para completar el formulario del pitch con intro-problema, solución y cierre'
            activity_type_pitch.is_active = True
            activity_type_pitch.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Tipo de Actividad "Formulario de Pitch" actualizado'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Tipo de Actividad "Formulario de Pitch" ya existe'))

        # Crear Tipo de Actividad: Presentación del Pitch
        activity_type_presentation, created = ActivityType.objects.get_or_create(
            code='presentacion_pitch',
            defaults={
                'name': 'Presentación del Pitch',
                'description': 'Actividad para presentar el pitch y evaluar a otros equipos',
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Tipo de Actividad "Presentación del Pitch" creado'))
        elif force:
            activity_type_presentation.name = 'Presentación del Pitch'
            activity_type_presentation.description = 'Actividad para presentar el pitch y evaluar a otros equipos'
            activity_type_presentation.is_active = True
            activity_type_presentation.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Tipo de Actividad "Presentación del Pitch" actualizado'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Tipo de Actividad "Presentación del Pitch" ya existe'))

        # Crear Etapa 4: Comunicación
        stage, created = Stage.objects.get_or_create(
            number=4,
            defaults={
                'name': 'Comunicación',
                'description': 'Cuarta etapa del juego enfocada en la comunicación y presentación del pitch',
                'objective': 'Crear y comunicar pitch',
                'estimated_duration': 45,
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Etapa 4 "Comunicación" creada'))
        elif force:
            stage.name = 'Comunicación'
            stage.description = 'Cuarta etapa del juego enfocada en la comunicación y presentación del pitch'
            stage.objective = 'Crear y comunicar pitch'
            stage.estimated_duration = 45
            stage.is_active = True
            stage.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Etapa 4 "Comunicación" actualizada'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Etapa 4 "Comunicación" ya existe'))

        # Crear Actividad 1: Formulario de Pitch
        activity1, created = Activity.objects.get_or_create(
            stage=stage,
            order_number=1,
            defaults={
                'activity_type': activity_type_pitch,
                'name': 'Formulario de Pitch',
                'description': 'Los equipos completan un formulario estructurado para crear el pitch: intro-problema (etapa 2), solución (etapa 3) y cierre',
                'order_number': 1,
                'timer_duration': 900,  # 15 minutos
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Actividad "Formulario de Pitch" creada'))
        elif force:
            activity1.activity_type = activity_type_pitch
            activity1.name = 'Formulario de Pitch'
            activity1.description = 'Los equipos completan un formulario estructurado para crear el pitch: intro-problema (etapa 2), solución (etapa 3) y cierre'
            activity1.timer_duration = 900
            activity1.is_active = True
            activity1.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Actividad "Formulario de Pitch" actualizada'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Actividad "Formulario de Pitch" ya existe'))

        # Crear Actividad 2: Presentación del Pitch
        activity2, created = Activity.objects.get_or_create(
            stage=stage,
            order_number=2,
            defaults={
                'activity_type': activity_type_presentation,
                'name': 'Presentación del Pitch',
                'description': 'Los equipos presentan su pitch siguiendo un orden de presentación. Después de cada presentación, los otros equipos pueden evaluar.',
                'order_number': 2,
                'timer_duration': 1800,  # 30 minutos (para todas las presentaciones)
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Actividad "Presentación del Pitch" creada'))
        elif force:
            activity2.activity_type = activity_type_presentation
            activity2.name = 'Presentación del Pitch'
            activity2.description = 'Los equipos presentan su pitch siguiendo un orden de presentación. Después de cada presentación, los otros equipos pueden evaluar.'
            activity2.timer_duration = 1800
            activity2.is_active = True
            activity2.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Actividad "Presentación del Pitch" actualizada'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Actividad "Presentación del Pitch" ya existe'))

        self.stdout.write(self.style.SUCCESS('\n[DONE] Etapa 4: Comunicación creada exitosamente!'))



