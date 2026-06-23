"""
Seed AnagramWord, ChaosQuestion, and GeneralKnowledgeQuestion records.
Safe to run multiple times (uses get_or_create).
"""
from django.core.management.base import BaseCommand
from challenges.models import AnagramWord, ChaosQuestion, GeneralKnowledgeQuestion


ANAGRAM_WORDS = [
    'empresa', 'cliente', 'proyecto', 'mercado', 'producto',
    'impacto', 'usuario', 'capital', 'equipo', 'startup',
    'recursos', 'negocio', 'problema', 'servicio', 'valor',
]

CHAOS_QUESTIONS = [
    '¿Cuál sería tu superpoder si pudieras elegir uno?',
    '¿Qué harías si tuvieras un día libre sin límites?',
    'Si pudieras vivir en cualquier época histórica, ¿cuál elegirías y por qué?',
    '¿Qué habilidad te gustaría aprender en una semana?',
    '¿Cuál es tu mayor miedo y cómo lo enfrentarías?',
    '¿Si pudieras cambiar una cosa del mundo, qué sería?',
    '¿Qué harías si ganaras un millón de dólares mañana?',
    '¿Cuál es tu talento secreto que pocos conocen?',
    '¿Si fueras un animal, cuál serías y por qué?',
    '¿Qué canción describe mejor tu vida en este momento?',
    '¿Cuál es el consejo más valioso que has recibido?',
    '¿Qué lugar del mundo te gustaría visitar y por qué?',
    '¿Si pudieras tener cena con alguien famoso, quién sería?',
    '¿Qué invento cambiaría más tu vida cotidiana?',
    '¿Cuál es la cosa más loca que has hecho por diversión?',
    '¿Qué libro, película o serie recomendarías a todos?',
    '¿Si pudieras dominar un idioma instantáneamente, cuál sería?',
    '¿Qué trabajo harías aunque no te pagaran?',
    '¿Cuál es tu recuerdo favorito de la infancia?',
    '¿Qué es lo primero que haces cuando te levantas por la mañana?',
]

GENERAL_KNOWLEDGE_QUESTIONS = [
    {
        'question': '¿Qué significa MVP en emprendimiento?',
        'option_a': 'Minimum Viable Product',
        'option_b': 'Maximum Value Proposition',
        'option_c': 'Most Valuable Player',
        'option_d': 'Minimum Viable Process',
        'correct_answer': 0,
    },
    {
        'question': '¿Qué es el Design Thinking?',
        'option_a': 'Metodología centrada en el usuario para resolver problemas',
        'option_b': 'Software de diseño gráfico',
        'option_c': 'Técnica de programación orientada a objetos',
        'option_d': 'Estrategia de marketing digital',
        'correct_answer': 0,
    },
    {
        'question': '¿Qué es un "pitch" en el contexto empresarial?',
        'option_a': 'Un campo de fútbol',
        'option_b': 'Presentación breve de una idea de negocio',
        'option_c': 'Un tipo de contrato laboral',
        'option_d': 'Una herramienta de análisis financiero',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es el modelo Canvas de negocio?',
        'option_a': 'Un programa de contabilidad',
        'option_b': 'Herramienta para visualizar y diseñar modelos de negocio',
        'option_c': 'Una metodología de programación',
        'option_d': 'Un tipo de contrato de sociedad',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es el "bootstrapping" en emprendimiento?',
        'option_a': 'Técnica de programación web',
        'option_b': 'Financiar un negocio con recursos propios sin inversores externos',
        'option_c': 'Estrategia de marketing en redes sociales',
        'option_d': 'Proceso de contratación de empleados',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué significa B2B en negocios?',
        'option_a': 'Back to Basics',
        'option_b': 'Business to Business (empresa a empresa)',
        'option_c': 'Brand to Brand',
        'option_d': 'Budget to Budget',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es una startup?',
        'option_a': 'Una empresa consolidada con más de 50 años',
        'option_b': 'Empresa emergente con alto potencial de crecimiento escalable',
        'option_c': 'Un organismo gubernamental',
        'option_d': 'Una organización sin fines de lucro',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es el "networking" en emprendimiento?',
        'option_a': 'Configurar una red de computadoras',
        'option_b': 'Construcción y cultivo de relaciones profesionales',
        'option_c': 'Vender productos por internet',
        'option_d': 'Analizar la competencia del mercado',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es la propuesta de valor de un negocio?',
        'option_a': 'El precio de venta del producto',
        'option_b': 'La descripción clara de cómo se resuelve el problema del cliente',
        'option_c': 'El número de empleados de la empresa',
        'option_d': 'El lugar donde opera la empresa',
        'correct_answer': 1,
    },
    {
        'question': '¿Qué es el "pivot" en una startup?',
        'option_a': 'El fundador principal de la empresa',
        'option_b': 'Cambio estratégico en el modelo de negocio basado en aprendizaje',
        'option_c': 'Una ronda de inversión inicial',
        'option_d': 'El primer producto lanzado al mercado',
        'correct_answer': 1,
    },
]


class Command(BaseCommand):
    help = 'Crea datos iniciales para AnagramWord, ChaosQuestion y GeneralKnowledgeQuestion'

    def handle(self, *args, **options):
        self._create_anagram_words()
        self._create_chaos_questions()
        self._create_general_knowledge_questions()
        self.stdout.write(self.style.SUCCESS('Datos del minijuego creados exitosamente.'))

    def _create_anagram_words(self):
        created_count = 0
        for word in ANAGRAM_WORDS:
            _, created = AnagramWord.objects.get_or_create(
                word=word,
                defaults={'is_active': True}
            )
            if created:
                created_count += 1
        self.stdout.write(f'  AnagramWord: {created_count} nuevas, {len(ANAGRAM_WORDS) - created_count} ya existían')

    def _create_chaos_questions(self):
        created_count = 0
        for question_text in CHAOS_QUESTIONS:
            _, created = ChaosQuestion.objects.get_or_create(
                question=question_text,
                defaults={'is_active': True}
            )
            if created:
                created_count += 1
        self.stdout.write(f'  ChaosQuestion: {created_count} nuevas, {len(CHAOS_QUESTIONS) - created_count} ya existían')

    def _create_general_knowledge_questions(self):
        created_count = 0
        for q in GENERAL_KNOWLEDGE_QUESTIONS:
            _, created = GeneralKnowledgeQuestion.objects.get_or_create(
                question=q['question'],
                defaults={
                    'option_a': q['option_a'],
                    'option_b': q['option_b'],
                    'option_c': q['option_c'],
                    'option_d': q['option_d'],
                    'correct_answer': q['correct_answer'],
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
        self.stdout.write(f'  GeneralKnowledgeQuestion: {created_count} nuevas, {len(GENERAL_KNOWLEDGE_QUESTIONS) - created_count} ya existían')
