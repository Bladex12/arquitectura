"""
Comando de gestión para crear la actividad Video Institucional
y actualizar el orden de las actividades de la Etapa 1
"""
from django.core.management.base import BaseCommand
from challenges.models import Stage, ActivityType, Activity


class Command(BaseCommand):
    help = 'Crea la actividad Video Institucional como primera actividad de la Etapa 1 y actualiza el orden de las demás'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Recrear los datos aunque ya existan'
        )

    def handle(self, *args, **options):
        force = options['force']
        
        # Obtener Etapa 1
        try:
            stage = Stage.objects.get(number=1, is_active=True)
        except Stage.DoesNotExist:
            self.stdout.write(self.style.ERROR('[ERROR] Etapa 1 no existe. Ejecuta primero: python manage.py create_initial_data'))
            return
        
        # Crear Tipo de Actividad: Video Institucional
        video_type, created = ActivityType.objects.get_or_create(
            code='video_institucional',
            defaults={
                'name': 'Video Institucional',
                'description': 'Video institucional de la universidad',
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Tipo de Actividad "Video Institucional" creado'))
        elif force:
            video_type.name = 'Video Institucional'
            video_type.description = 'Video institucional de la universidad'
            video_type.is_active = True
            video_type.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Tipo de Actividad "Video Institucional" actualizado'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Tipo de Actividad "Video Institucional" ya existe'))

        # Actualizar orden de actividades existentes primero
        # Personalización: order_number 1 -> 2
        personalizacion = Activity.objects.filter(
            stage=stage,
            name__icontains='Personalización',
            is_active=True
        ).first()
        
        if personalizacion:
            if personalizacion.order_number != 2:
                personalizacion.order_number = 2
                personalizacion.save()
                self.stdout.write(self.style.SUCCESS(f'[UPDATE] Actividad "Personalización" actualizada a order_number=2'))
            else:
                self.stdout.write(self.style.WARNING('[SKIP] Actividad "Personalización" ya tiene order_number=2'))
        
        # Presentación: order_number 2 -> 3
        presentacion = Activity.objects.filter(
            stage=stage,
            name__icontains='Presentación',
            is_active=True
        ).first()
        
        if presentacion:
            if presentacion.order_number != 3:
                presentacion.order_number = 3
                presentacion.save()
                self.stdout.write(self.style.SUCCESS(f'[UPDATE] Actividad "Presentación" actualizada a order_number=3'))
            else:
                self.stdout.write(self.style.WARNING('[SKIP] Actividad "Presentación" ya tiene order_number=3'))

        # Crear Actividad: Video Institucional (primera actividad de la Etapa 1)
        video_activity, created = Activity.objects.get_or_create(
            stage=stage,
            order_number=1,
            defaults={
                'activity_type': video_type,
                'name': 'Video Institucional',
                'description': 'Video institucional de la universidad sobre emprendimiento',
                'order_number': 1,
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('[OK] Actividad "Video Institucional" creada con order_number=1'))
        elif force:
            video_activity.activity_type = video_type
            video_activity.name = 'Video Institucional'
            video_activity.description = 'Video institucional de la universidad sobre emprendimiento'
            video_activity.order_number = 1
            video_activity.is_active = True
            video_activity.save()
            self.stdout.write(self.style.SUCCESS('[UPDATE] Actividad "Video Institucional" actualizada'))
        else:
            self.stdout.write(self.style.WARNING('[SKIP] Actividad "Video Institucional" ya existe con order_number=1'))

        self.stdout.write(self.style.SUCCESS('\n[DONE] Video Institucional creado y orden de actividades actualizado!'))
        self.stdout.write(self.style.SUCCESS('Orden de actividades de la Etapa 1:'))
        activities = Activity.objects.filter(stage=stage, is_active=True).order_by('order_number')
        for activity in activities:
            self.stdout.write(self.style.SUCCESS(f'  {activity.order_number}. {activity.name}'))














