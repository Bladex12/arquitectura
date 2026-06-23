"""
Comando de gestión para actualizar todos los desafíos según la información proporcionada
"""
from django.core.management.base import BaseCommand
from challenges.models import Topic, Challenge


class Command(BaseCommand):
    help = 'Actualiza todos los desafíos para los temas Salud, Educación y Sustentabilidad con iconos y datos de persona'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Actualizar los desafíos aunque ya existan'
        )

    def handle(self, *args, **options):
        force = options['force']
        
        # Desafíos por tema con iconos y datos de persona
        challenges_data = {
            'Salud': [
                {
                    'title': 'Autogestión de tratamientos',
                    'description': 'Muchos errores médicos y complicaciones surgen al cambiar de un centro de salud a otro, por falta de continuidad y seguimiento personalizado.',
                    'icon': '🏥',
                    'persona_name': 'Don Humberto',
                    'persona_age': 50,
                    'persona_story': 'Fue dado de alta con indicaciones médicas complejas, pero no entendió qué debía seguir tomando ni a quién acudir si se sentía mal.',
                    'difficulty_level': 'medium'
                },
                {
                    'title': 'Obesidad',
                    'description': 'Más de un 70% de la población en Chile presenta sobrepeso u obesidad (MINSAL). Esta situación se debe múltiples factores, entre ellos la falta de ejercicio y educación nutricional, disponibilidad de productos ultraprocesados y la desinformación.',
                    'icon': '⚖️',
                    'persona_name': 'Simona',
                    'persona_age': 27,
                    'persona_story': 'Tiene una hija pequeña y trabaja tiempo completo. Sabe que la alimentación es clave, pero no ha podido organizar ni aprender a darle una nutrición buena a su hija.',
                    'difficulty_level': 'medium'
                },
                {
                    'title': 'Envejecimiento activo',
                    'description': 'La población chilena está envejeciendo rápidamente y muchos adultos mayores enfrentan soledad, pérdida de movilidad y falta de programas de prevención.',
                    'icon': '🚶',
                    'persona_name': 'Juana',
                    'persona_age': 72,
                    'persona_story': 'Vive sola desde que sus hijos se independizaron. Le gustaría mantenerse activa, pero no conoce programas accesibles que la motiven a hacer ejercicio, socializar y prevenir enfermedades.',
                    'difficulty_level': 'medium'
                }
            ],
            'Educación': [
                {
                    'title': 'Educación financiera accesible',
                    'description': 'La ausencia de educación financiera en realidades económicas inestables dificulta la planificación y el uso responsable del dinero.',
                    'icon': '💰',
                    'persona_name': 'Martina',
                    'persona_age': 22,
                    'persona_story': 'Joven emprendedora de 22 años, vende productos por redes sociales. Aunque gana dinero, no sabe cómo organizarlo ni cuánto debe ahorrar o invertir, lo que lo mantiene en constante inestabilidad.',
                    'difficulty_level': 'medium'
                },
                {
                    'title': 'Inicio de vida laboral',
                    'description': 'Muchos estudiantes recién titulados enfrentan barreras para conseguir su primer empleo, ya que se les exige experiencia previa que aún no han podido adquirir.',
                    'icon': '🎓',
                    'persona_name': 'Andrés',
                    'persona_age': 23,
                    'persona_story': 'Acaba de egresar de odontología. Le preocupa no poder trabajar pronto, pero ninguna clínica lo ha llamado porque no tiene experiencia previa.',
                    'difficulty_level': 'medium'
                },
                {
                    'title': 'Tecnología adultos mayores',
                    'description': 'El avance tecnológico en los últimos años ha sido incremental. Esto ha beneficiado a múltiples sectores, sin embargo el conocimiento y adaptación para los adultos mayores ha sido una gran dificultad.',
                    'icon': '📱',
                    'persona_name': 'Osvaldo',
                    'persona_age': 70,
                    'persona_story': 'Es un adulto mayor de 70 años y debe pedir ayuda a sus hijos o nietos cada vez que debe hacer tramites.',
                    'difficulty_level': 'medium'
                }
            ],
            'Sustentabilidad': [
                {
                    'title': 'Contaminación por fast fashion',
                    'description': 'La moda rápida ha traído graves consecuencias al medio ambiente. Especialmente en sectores del norte de Chile en donde los vertederos y basurales están afectando el diario vivir de las personas.',
                    'icon': '👕',
                    'persona_name': 'Gabriela',
                    'persona_age': 18,
                    'persona_story': 'Estudiante de 18 años que vive cerca de esta zona y debe pasar a diario por lugares con desagradables olores.',
                    'difficulty_level': 'medium'
                },
                {
                    'title': 'Acceso al agua en la agricultura',
                    'description': 'El agua dulce es un recurso natural fundamental para la vida. Hay zonas rurales en que el agua se ha hecho escasa.',
                    'icon': '💧',
                    'persona_name': 'Camila',
                    'persona_age': 50,
                    'persona_story': 'Agricultora de 50 años que cultiva paltas de exportación, ella está complicada de perder su negocio por la cantidad de agua que debe utilizar.',
                    'difficulty_level': 'medium'
                },
                {
                    'title': 'Gestión de residuos electrónicos',
                    'description': 'El aumento del consumo tecnológico ha generado toneladas de desechos electrónicos difíciles de reciclar.',
                    'icon': '♻️',
                    'persona_name': 'Francisco',
                    'persona_age': 29,
                    'persona_story': 'Cambió su celular y computador el año pasado, pero no sabe dónde llevar los antiguos dispositivos. Terminó guardándolos en un cajón, como millones de personas que desconocen alternativas de reciclaje.',
                    'difficulty_level': 'medium'
                }
            ]
        }
        
        # Obtener o crear temas
        topics = {}
        for topic_name in challenges_data.keys():
            topic, created = Topic.objects.get_or_create(
                name=topic_name,
                defaults={
                    'description': f'Temas relacionados con {topic_name.lower()}',
                    'category': topic_name.lower(),
                    'is_active': True
                }
            )
            topics[topic_name] = topic
            if created:
                self.stdout.write(self.style.SUCCESS(f'[OK] Tema "{topic_name}" creado'))
            else:
                self.stdout.write(self.style.WARNING(f'[SKIP] Tema "{topic_name}" ya existe'))
        
        # Crear o actualizar desafíos
        total_created = 0
        total_updated = 0
        
        for topic_name, challenges_list in challenges_data.items():
            topic = topics[topic_name]
            self.stdout.write(f'\nProcesando desafios para "{topic_name}"...')
            
            for challenge_data in challenges_list:
                challenge, created = Challenge.objects.get_or_create(
                    topic=topic,
                    title=challenge_data['title'],
                    defaults={
                        'description': challenge_data.get('description', ''),
                        'icon': challenge_data.get('icon', ''),
                        'persona_name': challenge_data.get('persona_name'),
                        'persona_age': challenge_data.get('persona_age'),
                        'persona_story': challenge_data.get('persona_story'),
                        'difficulty_level': challenge_data['difficulty_level'],
                        'is_active': True
                    }
                )
                
                if created:
                    total_created += 1
                    self.stdout.write(self.style.SUCCESS(f'  [OK] Creado: "{challenge_data["title"]}"'))
                elif force:
                    challenge.description = challenge_data.get('description', '')
                    challenge.icon = challenge_data.get('icon', '')
                    challenge.persona_name = challenge_data.get('persona_name')
                    challenge.persona_age = challenge_data.get('persona_age')
                    challenge.persona_story = challenge_data.get('persona_story')
                    challenge.difficulty_level = challenge_data['difficulty_level']
                    challenge.is_active = True
                    challenge.save()
                    total_updated += 1
                    self.stdout.write(self.style.SUCCESS(f'  [UPDATE] Actualizado: "{challenge_data["title"]}"'))
                else:
                    # Actualizar solo si faltan datos
                    updated = False
                    if not challenge.description and challenge_data.get('description'):
                        challenge.description = challenge_data.get('description')
                        updated = True
                    if not challenge.icon and challenge_data.get('icon'):
                        challenge.icon = challenge_data.get('icon')
                        updated = True
                    if not challenge.persona_name and challenge_data.get('persona_name'):
                        challenge.persona_name = challenge_data.get('persona_name')
                        updated = True
                    if not challenge.persona_age and challenge_data.get('persona_age'):
                        challenge.persona_age = challenge_data.get('persona_age')
                        updated = True
                    if not challenge.persona_story and challenge_data.get('persona_story'):
                        challenge.persona_story = challenge_data.get('persona_story')
                        updated = True
                    
                    if updated:
                        challenge.save()
                        total_updated += 1
                        self.stdout.write(self.style.SUCCESS(f'  [UPDATE] Actualizado: "{challenge_data["title"]}"'))
                    else:
                        self.stdout.write(self.style.WARNING(f'  [SKIP] Ya existe: "{challenge_data["title"]}"'))
        
        self.stdout.write(self.style.SUCCESS(
            f'\n[DONE] Proceso completado: {total_created} creados, {total_updated} actualizados'
        ))
