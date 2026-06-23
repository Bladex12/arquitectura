"""
Comando de gestión para crear datos iniciales del juego
Crea la primera etapa (Trabajo en Equipo) y la actividad de Personalización
"""
from django.core.management.base import BaseCommand
from challenges.models import Stage, ActivityType, Activity


class Command(BaseCommand):
    help = 'Crea los datos iniciales del juego: Etapa 1 y actividad de Personalización'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Recrear los datos aunque ya existan'
        )

    def handle(self, *args, **options):
        force = options['force']
        
        # Crear Tipo de Actividad: Personalización
        activity_type, created = ActivityType.objects.get_or_create(
            code='personalizacion',
            defaults={
                'name': 'Personalización',
                'description': 'Actividad de personalización de equipos',
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Tipo de Actividad "Personalización" creado'))
        elif force:
            activity_type.name = 'Personalización'
            activity_type.description = 'Actividad de personalización de equipos'
            activity_type.is_active = True
            activity_type.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Tipo de Actividad "Personalización" actualizado'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Tipo de Actividad "Personalización" ya existe'))

        # Crear Etapa 1: Trabajo en Equipo
        stage, created = Stage.objects.get_or_create(
            number=1,
            defaults={
                'name': 'Trabajo en Equipo',
                'description': 'Primera etapa del juego enfocada en trabajo colaborativo',
                'objective': 'Fomentar el trabajo en equipo y la colaboración',
                'estimated_duration': 60,
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Etapa 1 "Trabajo en Equipo" creada'))
        elif force:
            stage.name = 'Trabajo en Equipo'
            stage.description = 'Primera etapa del juego enfocada en trabajo colaborativo'
            stage.objective = 'Fomentar el trabajo en equipo y la colaboración'
            stage.estimated_duration = 60
            stage.is_active = True
            stage.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Etapa 1 "Trabajo en Equipo" actualizada'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Etapa 1 "Trabajo en Equipo" ya existe'))

        # Crear Actividad: Personalización (primera actividad de la Etapa 1)
        activity, created = Activity.objects.get_or_create(
            stage=stage,
            order_number=1,
            defaults={
                'activity_type': activity_type,
                'name': 'Personalización',
                'description': 'Los equipos personalizan su nombre e indican si se conocen',
                'order_number': 1,
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Actividad "Personalización" creada'))
        elif force:
            activity.activity_type = activity_type
            activity.name = 'Personalización'
            activity.description = 'Los equipos personalizan su nombre e indican si se conocen'
            activity.is_active = True
            activity.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Actividad "Personalización" actualizada'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Actividad "Personalización" ya existe'))

        # Crear Tipo de Actividad: Minijuego/Presentación
        minigame_type, created = ActivityType.objects.get_or_create(
            code='minijuego',
            defaults={
                'name': 'Minijuego',
                'description': 'Actividades de minijuegos y presentación',
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Tipo de Actividad "Minijuego" creado'))
        elif force:
            minigame_type.name = 'Minijuego'
            minigame_type.description = 'Actividades de minijuegos y presentación'
            minigame_type.is_active = True
            minigame_type.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Tipo de Actividad "Minijuego" actualizado'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Tipo de Actividad "Minijuego" ya existe'))

        # Crear Actividad: Presentación (segunda actividad de la Etapa 1)
        # Configuración: 3 palabras, 5 tokens por palabra = 15 tokens total
        import random
        
        def shuffle_word(word):
            """Genera un anagrama (mezcla las letras)"""
            letters = list(word)
            random.shuffle(letters)
            return ''.join(letters)
        
        words_list = ['emprender', 'innovacion', 'creativos']
        presentation_config = {
            'type': 'anagram',
            'words_per_game': 3,
            'tokens_per_word': 1,  # 1 token por palabra
            'total_tokens': 3,  # 3 palabras * 1 token = 3 tokens total
            'words': [
                {'word': word, 'anagram': shuffle_word(word)} for word in words_list
            ]
        }
        
        presentation_activity, created = Activity.objects.get_or_create(
            stage=stage,
            order_number=2,
            defaults={
                'activity_type': minigame_type,
                'name': 'Presentación',
                'description': 'Minijuego de anagramas: adivina las palabras desordenadas (3 palabras, 1 token cada una = 3 tokens total)',
                'order_number': 2,
                'timer_duration': 300,  # 5 minutos
                'config_data': presentation_config,
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Actividad "Presentación" creada'))
        elif force:
            presentation_activity.activity_type = minigame_type
            presentation_activity.name = 'Presentación'
            presentation_activity.description = 'Minijuego de anagramas: adivina las palabras desordenadas (3 palabras, 1 token cada una = 3 tokens total)'
            presentation_activity.config_data = presentation_config
            presentation_activity.is_active = True
            presentation_activity.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Actividad "Presentación" actualizada'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Actividad "Presentación" ya existe'))

        self.stdout.write(self.style.SUCCESS('\n[DONE] Datos iniciales creados exitosamente!'))

