"""
Views para la app challenges
"""
from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    Stage, ActivityType, Activity, Topic, Challenge,
    RouletteChallenge, Minigame, LearningObjective,
    WordSearchOption, AnagramWord, ChaosQuestion, GeneralKnowledgeQuestion
)
from .serializers import (
    StageSerializer, ActivityTypeSerializer, ActivitySerializer,
    TopicSerializer, ChallengeSerializer, RouletteChallengeSerializer,
    MinigameSerializer, LearningObjectiveSerializer,
    WordSearchOptionSerializer, AnagramWordSerializer,
    ChaosQuestionSerializer, GeneralKnowledgeQuestionSerializer
)


class StageViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Etapas
    """
    queryset = Stage.objects.filter(is_active=True)
    serializer_class = StageSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['number', 'name']
    ordering = ['number']

    def get_queryset(self):
        queryset = Stage.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset


class ActivityTypeViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Tipos de Actividad
    """
    queryset = ActivityType.objects.filter(is_active=True)
    serializer_class = ActivityTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['code', 'name']


class ActivityViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Actividades
    """
    queryset = Activity.objects.filter(is_active=True)
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activity_type', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['order_number', 'name']
    ordering = ['stage', 'order_number']

    def get_permissions(self):
        """
        Permite leer sin autenticación para tablets
        """
        if self.action in ['retrieve', 'list']:
            return []
        return super().get_permissions()

    def get_queryset(self):
        queryset = Activity.objects.select_related('stage', 'activity_type').prefetch_related('word_search_options')
        stage_id = self.request.query_params.get('stage')
        if stage_id:
            queryset = queryset.filter(stage_id=stage_id)
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset
    
    def get_serializer_context(self):
        """Pasar el request al contexto del serializer"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class TopicViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Temas
    """
    queryset = Topic.objects.filter(is_active=True)
    serializer_class = TopicSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active', 'faculties']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'category']
    ordering = ['name']

    def get_permissions(self):
        """
        Permite leer sin autenticación para tablets
        """
        if self.action in ['retrieve', 'list']:
            return []
        return super().get_permissions()

    def get_queryset(self):
        queryset = Topic.objects.prefetch_related('faculties')
        faculty_id = self.request.query_params.get('faculty')
        if faculty_id:
            queryset = queryset.filter(faculties__id=faculty_id)
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset.distinct()


class ChallengeViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Desafíos
    """
    queryset = Challenge.objects.filter(is_active=True)
    serializer_class = ChallengeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['topic', 'difficulty_level', 'is_active']
    search_fields = ['title', 'persona_name', 'persona_story']
    ordering_fields = ['title', 'difficulty_level']
    ordering = ['title']

    def get_permissions(self):
        """
        Permite leer sin autenticación para tablets
        """
        if self.action in ['retrieve', 'list']:
            return []
        return super().get_permissions()

    def get_queryset(self):
        queryset = Challenge.objects.select_related('topic')
        topic_id = self.request.query_params.get('topic')
        if topic_id:
            queryset = queryset.filter(topic_id=topic_id)
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset
    
    def get_serializer_context(self):
        """Asegurar que el request esté en el contexto para generar URLs completas"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class RouletteChallengeViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Retos de Ruleta
    """
    queryset = RouletteChallenge.objects.filter(is_active=True)
    serializer_class = RouletteChallengeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['challenge_type', 'is_active']
    search_fields = ['description']

    def get_queryset(self):
        queryset = RouletteChallenge.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset


class MinigameViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Minijuegos
    """
    queryset = Minigame.objects.filter(is_active=True)
    serializer_class = MinigameSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['type', 'is_active']
    search_fields = ['name']


class LearningObjectiveViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Objetivos de Aprendizaje
    """
    queryset = LearningObjective.objects.filter(is_active=True)
    serializer_class = LearningObjectiveSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['stage', 'is_active']
    search_fields = ['title', 'description']
    ordering_fields = ['title', 'estimated_time']
    ordering = ['title']

    def get_queryset(self):
        queryset = LearningObjective.objects.select_related('stage')
        stage_id = self.request.query_params.get('stage')
        if stage_id:
            queryset = queryset.filter(stage_id=stage_id)
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset


class WordSearchOptionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Opciones de Sopa de Letras
    """
    queryset = WordSearchOption.objects.all()
    serializer_class = WordSearchOptionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activity', 'is_active']
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = WordSearchOption.objects.select_related('activity')
        activity_id = self.request.query_params.get('activity')
        if activity_id:
            queryset = queryset.filter(activity_id=activity_id)
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def generate_preview(self, request):
        """
        Generar preview de sopa de letras sin guardar
        Valida que las palabras tengan máximo 10 caracteres
        """
        words = request.data.get('words', [])
        name = request.data.get('name', '')
        
        # Validar: máximo 5 palabras
        if len(words) > 5:
            return Response(
                {'error': 'Máximo 5 palabras permitidas'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(words) < 1:
            return Response(
                {'error': 'Se requiere al menos 1 palabra'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar que todas las palabras sean strings no vacíos
        words = [w.strip().upper() for w in words if w and w.strip()]
        if not words:
            return Response(
                {'error': 'Las palabras no pueden estar vacías'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar que las palabras tengan máximo 10 caracteres
        palabras_invalidas = [w for w in words if len(w) > 10]
        if palabras_invalidas:
            return Response({
                'error': f'Las siguientes palabras exceden 10 caracteres: {", ".join(palabras_invalidas)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generar semilla aleatoria para esta generación
        import random
        seed = random.randint(1, 1000000)
        
        # Generar sopa de letras (con validación e iteración)
        from .services import generate_word_search
        try:
            result = generate_word_search(words, seed=seed, max_attempts=50)
            
            if result is None:
                return Response({
                    'error': 'No se pudo generar la sopa de letras. Intenta con palabras más cortas o menos palabras.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'preview': {
                    'grid': result['grid'],
                    'wordPositions': result['wordPositions'],
                    'words': result['words'],
                    'seed': seed
                }
            })
        except ValueError as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def confirm_and_save(self, request):
        """
        Confirmar y guardar la sopa de letras generada
        Valida que todas las palabras estén colocadas correctamente
        """
        words = request.data.get('words', [])
        name = request.data.get('name', '')
        grid = request.data.get('grid')
        word_positions = request.data.get('word_positions') or request.data.get('wordPositions')
        seed = request.data.get('seed')
        activity_id = request.data.get('activity_id')
        
        # Validar que las palabras tengan máximo 10 caracteres
        palabras_invalidas = [w for w in words if len(w) > 10]
        if palabras_invalidas:
            return Response({
                'error': f'Las siguientes palabras exceden 10 caracteres: {", ".join(palabras_invalidas)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validaciones
        if not name:
            return Response(
                {'error': 'Se requiere un nombre'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not activity_id:
            return Response(
                {'error': 'Se requiere activity_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not grid or not word_positions:
            return Response(
                {'error': 'Se requiere grid y word_positions'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar que todas las palabras estén en word_positions
        words_in_positions = {wp['word'] for wp in word_positions}
        words_set = set(w.upper() for w in words)
        
        if words_in_positions != words_set:
            return Response({
                'error': 'No todas las palabras se colocaron correctamente en la sopa de letras'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Crear y guardar
        word_search_option = WordSearchOption.objects.create(
            activity_id=activity_id,
            name=name,
            words=words,
            grid=grid,
            word_positions=word_positions,
            seed=seed,
            is_active=True
        )
        
        serializer = self.get_serializer(word_search_option)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[])
    def random(self, request):
        """
        Obtener una sopa de letras aleatoria (para tablets, sin autenticación)
        """
        activity_id = request.query_params.get('activity_id')
        if not activity_id:
            return Response(
                {'error': 'Se requiere activity_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        word_search_options = WordSearchOption.objects.filter(
            activity_id=activity_id,
            is_active=True
        )
        
        if not word_search_options.exists():
            return Response(
                {'error': 'No hay sopas de letras disponibles'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Seleccionar una aleatoria
        import random
        selected = random.choice(list(word_search_options))
        
        # Si tiene grid guardado, usarlo; si no, generar uno nuevo
        if selected.grid and selected.word_positions:
            return Response({
                'id': selected.id,
                'name': selected.name,
                'words': selected.words,
                'grid': selected.grid,
                'wordPositions': selected.word_positions,
            })
        else:
            # Generar uno nuevo con la semilla guardada o nueva
            from .services import generate_word_search
            seed = selected.seed or random.randint(1, 1000000)
            result = generate_word_search(selected.words, seed=seed)
            return Response({
                'id': selected.id,
                'name': selected.name,
                'words': selected.words,
                'grid': result['grid'],
                'wordPositions': result['wordPositions'],
            })


class AnagramWordViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Palabras de Anagrama
    """
    queryset = AnagramWord.objects.all()
    serializer_class = AnagramWordSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['word']
    ordering_fields = ['word', 'created_at']
    ordering = ['word']

    def get_queryset(self):
        queryset = AnagramWord.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset

    @action(detail=False, methods=['get'], permission_classes=[])
    def random(self, request):
        """
        Obtener 5 palabras aleatorias (para tablets, sin autenticación)
        """
        count = int(request.query_params.get('count', 5))
        words = AnagramWord.objects.filter(
            is_active=True
        ).order_by('?')[:count]
        
        serializer = self.get_serializer(words, many=True)
        return Response(serializer.data)


class ChaosQuestionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Preguntas del Caos
    """
    queryset = ChaosQuestion.objects.all()
    serializer_class = ChaosQuestionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['question']
    ordering_fields = ['created_at', 'question']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = ChaosQuestion.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset

    @action(detail=False, methods=['get'], permission_classes=[])
    def random(self, request):
        """
        Obtener una pregunta aleatoria (para tablets, sin autenticación)
        Acepta 'exclude_ids' como parámetro de consulta separado por comas
        """
        exclude_ids_str = request.query_params.get('exclude_ids', '')
        exclude_ids = []
        
        if exclude_ids_str:
            try:
                exclude_ids = [int(id_str.strip()) for id_str in exclude_ids_str.split(',') if id_str.strip().isdigit()]
            except ValueError:
                pass
        
        queryset = ChaosQuestion.objects.filter(is_active=True)
        
        if exclude_ids:
            queryset = queryset.exclude(id__in=exclude_ids)
        
        question = queryset.order_by('?').first()
        
        if not question:
            return Response(
                {'error': 'No hay preguntas disponibles'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = self.get_serializer(question)
        return Response(serializer.data)


class GeneralKnowledgeQuestionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Preguntas de Conocimiento General
    """
    queryset = GeneralKnowledgeQuestion.objects.all()
    serializer_class = GeneralKnowledgeQuestionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['question', 'option_a', 'option_b', 'option_c', 'option_d']
    ordering_fields = ['created_at', 'question']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = GeneralKnowledgeQuestion.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset

    @action(detail=False, methods=['get'], permission_classes=[])
    def random(self, request):
        """
        Obtener 5 preguntas aleatorias (para tablets, sin autenticación)
        """
        count = int(request.query_params.get('count', 5))
        questions = GeneralKnowledgeQuestion.objects.filter(
            is_active=True
        ).order_by('?')[:count]
        
        serializer = self.get_serializer(questions, many=True)
        return Response(serializer.data)
