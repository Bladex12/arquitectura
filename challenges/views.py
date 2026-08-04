"""
Views para la app challenges.

Plain viewsets.ViewSet, not ModelViewSet -- ModelViewSet's pagination/
filter-backend machinery needs a real QuerySet, which the DynamoDB-backed
shim in challenges/models.py doesn't provide. List responses are plain
arrays, same precedent as academic/views.py and the users/game_sessions
viewsets.
"""
import random

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.decorators import action
from rest_framework.response import Response

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


def _apply_search(items, term, fields):
    if not term:
        return items
    term = term.lower()
    return [i for i in items if any(term in str(getattr(i, f, '') or '').lower() for f in fields)]


def _apply_ordering(items, ordering_param, default_field, allowed_fields):
    field = (ordering_param or default_field) or ''
    reverse = field.startswith('-')
    field = field.lstrip('-')
    if field not in allowed_fields:
        field = default_field.lstrip('-')
        reverse = default_field.startswith('-')
    return sorted(items, key=lambda i: (getattr(i, field, '') or ''), reverse=reverse)


class StageViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_queryset(self):
        items = Stage.objects.all() if self.request.query_params.get('include_inactive') == 'true' \
            else Stage.objects.filter(is_active=True)
        items = _apply_search(items, self.request.query_params.get('search'), ['name', 'description'])
        items = _apply_ordering(items, self.request.query_params.get('ordering'), 'number', ['number', 'name'])
        return items

    def list(self, request):
        return Response(StageSerializer(self._get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        try:
            instance = Stage.objects.get(id=pk)
        except Stage.DoesNotExist:
            return Response({'error': 'Etapa no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        return Response(StageSerializer(instance).data)

    def create(self, request):
        serializer = StageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(StageSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = Stage.objects.get(id=pk)
        except Stage.DoesNotExist:
            return Response({'error': 'Etapa no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        serializer = StageSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(StageSerializer(serializer.save()).data)

    partial_update = update


class ActivityTypeViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_queryset(self):
        items = ActivityType.objects.all() if self.request.query_params.get('include_inactive') == 'true' \
            else ActivityType.objects.filter(is_active=True)
        return _apply_search(items, self.request.query_params.get('search'), ['code', 'name'])

    def list(self, request):
        return Response(ActivityTypeSerializer(self._get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        try:
            instance = ActivityType.objects.get(id=pk)
        except ActivityType.DoesNotExist:
            return Response({'error': 'Tipo de actividad no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ActivityTypeSerializer(instance).data)

    def create(self, request):
        serializer = ActivityTypeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(ActivityTypeSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = ActivityType.objects.get(id=pk)
        except ActivityType.DoesNotExist:
            return Response({'error': 'Tipo de actividad no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ActivityTypeSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(ActivityTypeSerializer(serializer.save()).data)

    partial_update = update


class ActivityViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['retrieve', 'list']:
            return []
        return super().get_permissions()

    def get_serializer_context(self):
        return {'request': self.request}

    def _get_queryset(self):
        stage_id = self.request.query_params.get('stage')
        items = Activity.objects.filter(stage_id=stage_id) if stage_id else Activity.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            items = [i for i in items if i.is_active]
        items = _apply_search(items, self.request.query_params.get('search'), ['name', 'description'])
        return items

    def list(self, request):
        serializer = ActivitySerializer(self._get_queryset(), many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        try:
            instance = Activity.objects.get(id=pk)
        except Activity.DoesNotExist:
            return Response({'error': 'Actividad no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ActivitySerializer(instance, context=self.get_serializer_context()).data)

    def create(self, request):
        serializer = ActivitySerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(ActivitySerializer(instance, context=self.get_serializer_context()).data,
                         status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = Activity.objects.get(id=pk)
        except Activity.DoesNotExist:
            return Response({'error': 'Actividad no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ActivitySerializer(instance, data=request.data, partial=True,
                                         context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(ActivitySerializer(instance, context=self.get_serializer_context()).data)

    partial_update = update

    def destroy(self, request, pk=None):
        from challenges.dynamodb import activity as activity_repo
        activity_repo.delete_activity(pk)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TopicViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['retrieve', 'list']:
            return []
        return super().get_permissions()

    def _get_queryset(self):
        faculty_id = self.request.query_params.get('faculty')
        items = Topic.objects.filter(faculty_id=faculty_id) if faculty_id else Topic.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            items = [i for i in items if i.is_active]
        items = _apply_search(items, self.request.query_params.get('search'), ['name', 'description'])
        items = _apply_ordering(items, self.request.query_params.get('ordering'), 'name', ['name', 'category'])
        return items

    def list(self, request):
        return Response(TopicSerializer(self._get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        try:
            instance = Topic.objects.get(id=pk)
        except Topic.DoesNotExist:
            return Response({'error': 'Tema no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response(TopicSerializer(instance).data)

    def create(self, request):
        serializer = TopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(TopicSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = Topic.objects.get(id=pk)
        except Topic.DoesNotExist:
            return Response({'error': 'Tema no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TopicSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(TopicSerializer(serializer.save()).data)

    partial_update = update


class ChallengeViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['retrieve', 'list']:
            return []
        return super().get_permissions()

    def get_serializer_context(self):
        return {'request': self.request}

    def _get_queryset(self):
        topic_id = self.request.query_params.get('topic')
        items = Challenge.objects.filter(topic_id=topic_id) if topic_id else Challenge.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            items = [i for i in items if i.is_active]
        items = _apply_search(items, self.request.query_params.get('search'),
                               ['title', 'persona_name', 'persona_story'])
        items = _apply_ordering(items, self.request.query_params.get('ordering'), 'title',
                                 ['title', 'difficulty_level'])
        return items

    def list(self, request):
        serializer = ChallengeSerializer(self._get_queryset(), many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        try:
            instance = Challenge.objects.get(id=pk)
        except Challenge.DoesNotExist:
            return Response({'error': 'Desafío no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ChallengeSerializer(instance, context=self.get_serializer_context()).data)

    def create(self, request):
        serializer = ChallengeSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(ChallengeSerializer(instance, context=self.get_serializer_context()).data,
                         status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = Challenge.objects.get(id=pk)
        except Challenge.DoesNotExist:
            return Response({'error': 'Desafío no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ChallengeSerializer(instance, data=request.data, partial=True,
                                          context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(ChallengeSerializer(instance, context=self.get_serializer_context()).data)

    partial_update = update


class RouletteChallengeViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_queryset(self):
        items = RouletteChallenge.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            items = [i for i in items if i.is_active]
        return _apply_search(items, self.request.query_params.get('search'), ['description'])

    def list(self, request):
        return Response(RouletteChallengeSerializer(self._get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        try:
            instance = RouletteChallenge.objects.get(id=pk)
        except RouletteChallenge.DoesNotExist:
            return Response({'error': 'Reto no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response(RouletteChallengeSerializer(instance).data)

    def create(self, request):
        serializer = RouletteChallengeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(RouletteChallengeSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = RouletteChallenge.objects.get(id=pk)
        except RouletteChallenge.DoesNotExist:
            return Response({'error': 'Reto no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        serializer = RouletteChallengeSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(RouletteChallengeSerializer(serializer.save()).data)

    partial_update = update


class MinigameViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_queryset(self):
        items = Minigame.objects.all() if self.request.query_params.get('include_inactive') == 'true' \
            else Minigame.objects.filter(is_active=True)
        return _apply_search(items, self.request.query_params.get('search'), ['name'])

    def list(self, request):
        return Response(MinigameSerializer(self._get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        try:
            instance = Minigame.objects.get(id=pk)
        except Minigame.DoesNotExist:
            return Response({'error': 'Minijuego no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response(MinigameSerializer(instance).data)

    def create(self, request):
        serializer = MinigameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(MinigameSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = Minigame.objects.get(id=pk)
        except Minigame.DoesNotExist:
            return Response({'error': 'Minijuego no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        serializer = MinigameSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(MinigameSerializer(serializer.save()).data)

    partial_update = update


class LearningObjectiveViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_queryset(self):
        stage_id = self.request.query_params.get('stage')
        items = LearningObjective.objects.filter(stage_id=stage_id) if stage_id else LearningObjective.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            items = [i for i in items if i.is_active]
        items = _apply_search(items, self.request.query_params.get('search'), ['title', 'description'])
        items = _apply_ordering(items, self.request.query_params.get('ordering'), 'title',
                                 ['title', 'estimated_time'])
        return items

    def list(self, request):
        return Response(LearningObjectiveSerializer(self._get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        try:
            instance = LearningObjective.objects.get(id=pk)
        except LearningObjective.DoesNotExist:
            return Response({'error': 'Objetivo no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response(LearningObjectiveSerializer(instance).data)

    def create(self, request):
        serializer = LearningObjectiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(LearningObjectiveSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = LearningObjective.objects.get(id=pk)
        except LearningObjective.DoesNotExist:
            return Response({'error': 'Objetivo no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        serializer = LearningObjectiveSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(LearningObjectiveSerializer(serializer.save()).data)

    partial_update = update


class WordSearchOptionViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def _get_queryset(self):
        activity_id = self.request.query_params.get('activity')
        if not activity_id:
            return []
        items = WordSearchOption.objects.filter(activity_id=activity_id)
        if self.request.query_params.get('include_inactive') != 'true':
            items = [i for i in items if i.is_active]
        return _apply_search(items, self.request.query_params.get('search'), ['name'])

    def list(self, request):
        return Response(WordSearchOptionSerializer(self._get_queryset(), many=True).data)

    def create(self, request):
        serializer = WordSearchOptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(WordSearchOptionSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def generate_preview(self, request):
        words = request.data.get('words', [])
        name = request.data.get('name', '')

        if len(words) > 5:
            return Response({'error': 'Máximo 5 palabras permitidas'}, status=status.HTTP_400_BAD_REQUEST)
        if len(words) < 1:
            return Response({'error': 'Se requiere al menos 1 palabra'}, status=status.HTTP_400_BAD_REQUEST)

        words = [w.strip().upper() for w in words if w and w.strip()]
        if not words:
            return Response({'error': 'Las palabras no pueden estar vacías'}, status=status.HTTP_400_BAD_REQUEST)

        palabras_invalidas = [w for w in words if len(w) > 10]
        if palabras_invalidas:
            return Response({
                'error': f'Las siguientes palabras exceden 10 caracteres: {", ".join(palabras_invalidas)}'
            }, status=status.HTTP_400_BAD_REQUEST)

        seed = random.randint(1, 1000000)

        from .services import generate_word_search
        try:
            result = generate_word_search(words, seed=seed, max_attempts=50)
            if result is None:
                return Response({
                    'error': 'No se pudo generar la sopa de letras. Intenta con palabras más cortas o menos palabras.'
                }, status=status.HTTP_400_BAD_REQUEST)
            return Response({
                'preview': {
                    'grid': result['grid'], 'wordPositions': result['wordPositions'],
                    'words': result['words'], 'seed': seed,
                }
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def confirm_and_save(self, request):
        words = request.data.get('words', [])
        name = request.data.get('name', '')
        grid = request.data.get('grid')
        word_positions = request.data.get('word_positions') or request.data.get('wordPositions')
        seed = request.data.get('seed')
        activity_id = request.data.get('activity_id')

        palabras_invalidas = [w for w in words if len(w) > 10]
        if palabras_invalidas:
            return Response({
                'error': f'Las siguientes palabras exceden 10 caracteres: {", ".join(palabras_invalidas)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        if not name:
            return Response({'error': 'Se requiere un nombre'}, status=status.HTTP_400_BAD_REQUEST)
        if not activity_id:
            return Response({'error': 'Se requiere activity_id'}, status=status.HTTP_400_BAD_REQUEST)
        if not grid or not word_positions:
            return Response({'error': 'Se requiere grid y word_positions'}, status=status.HTTP_400_BAD_REQUEST)

        words_in_positions = {wp['word'] for wp in word_positions}
        words_set = set(w.upper() for w in words)
        if words_in_positions != words_set:
            return Response({
                'error': 'No todas las palabras se colocaron correctamente en la sopa de letras'
            }, status=status.HTTP_400_BAD_REQUEST)

        word_search_option = WordSearchOption.objects.create(
            activity_id=activity_id, name=name, words=words, grid=grid,
            word_positions=word_positions, seed=seed, is_active=True,
        )
        return Response(WordSearchOptionSerializer(word_search_option).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[])
    def random(self, request):
        activity_id = request.query_params.get('activity_id')
        if not activity_id:
            return Response({'error': 'Se requiere activity_id'}, status=status.HTTP_400_BAD_REQUEST)

        word_search_options = WordSearchOption.objects.filter(activity_id=activity_id, is_active=True)
        if not word_search_options.exists():
            return Response({'error': 'No hay sopas de letras disponibles'}, status=status.HTTP_404_NOT_FOUND)

        selected = random.choice(list(word_search_options))

        if selected.grid and selected.word_positions:
            return Response({
                'id': selected.id, 'name': selected.name, 'words': selected.words,
                'grid': selected.grid, 'wordPositions': selected.word_positions,
            })

        from .services import generate_word_search
        seed = selected.seed or random.randint(1, 1000000)
        result = generate_word_search(selected.words, seed=seed)
        return Response({
            'id': selected.id, 'name': selected.name, 'words': selected.words,
            'grid': result['grid'], 'wordPositions': result['wordPositions'],
        })


class AnagramWordViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def _get_queryset(self):
        items = AnagramWord.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            items = [i for i in items if i.is_active]
        items = _apply_search(items, self.request.query_params.get('search'), ['word'])
        items = _apply_ordering(items, self.request.query_params.get('ordering'), 'word', ['word', 'created_at'])
        return items

    def list(self, request):
        return Response(AnagramWordSerializer(self._get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        try:
            instance = AnagramWord.objects.get(id=pk)
        except AnagramWord.DoesNotExist:
            return Response({'error': 'Palabra no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AnagramWordSerializer(instance).data)

    def create(self, request):
        serializer = AnagramWordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(AnagramWordSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = AnagramWord.objects.get(id=pk)
        except AnagramWord.DoesNotExist:
            return Response({'error': 'Palabra no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        serializer = AnagramWordSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(AnagramWordSerializer(serializer.save()).data)

    partial_update = update

    @action(detail=False, methods=['get'], permission_classes=[])
    def random(self, request):
        count = int(request.query_params.get('count', 5))
        all_words = list(AnagramWord.objects.filter(is_active=True))
        words = random.sample(all_words, min(count, len(all_words)))
        return Response(AnagramWordSerializer(words, many=True).data)


class ChaosQuestionViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def _get_queryset(self):
        items = ChaosQuestion.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            items = [i for i in items if i.is_active]
        items = _apply_search(items, self.request.query_params.get('search'), ['question'])
        items = _apply_ordering(items, self.request.query_params.get('ordering'), '-created_at',
                                 ['created_at', 'question'])
        return items

    def list(self, request):
        return Response(ChaosQuestionSerializer(self._get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        try:
            instance = ChaosQuestion.objects.get(id=pk)
        except ChaosQuestion.DoesNotExist:
            return Response({'error': 'Pregunta no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ChaosQuestionSerializer(instance).data)

    def create(self, request):
        serializer = ChaosQuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(ChaosQuestionSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = ChaosQuestion.objects.get(id=pk)
        except ChaosQuestion.DoesNotExist:
            return Response({'error': 'Pregunta no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ChaosQuestionSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(ChaosQuestionSerializer(serializer.save()).data)

    partial_update = update

    @action(detail=False, methods=['get'], permission_classes=[])
    def random(self, request):
        exclude_ids_str = request.query_params.get('exclude_ids', '')
        exclude_ids = []
        if exclude_ids_str:
            exclude_ids = [s.strip() for s in exclude_ids_str.split(',') if s.strip()]

        candidates = [q for q in ChaosQuestion.objects.filter(is_active=True) if q.id not in exclude_ids]
        if not candidates:
            return Response({'error': 'No hay preguntas disponibles'}, status=status.HTTP_404_NOT_FOUND)

        question = random.choice(candidates)
        return Response(ChaosQuestionSerializer(question).data)


class GeneralKnowledgeQuestionViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def _get_queryset(self):
        items = GeneralKnowledgeQuestion.objects.all()
        if self.request.query_params.get('include_inactive') != 'true':
            items = [i for i in items if i.is_active]
        items = _apply_search(items, self.request.query_params.get('search'),
                               ['question', 'option_a', 'option_b', 'option_c', 'option_d'])
        items = _apply_ordering(items, self.request.query_params.get('ordering'), '-created_at',
                                 ['created_at', 'question'])
        return items

    def list(self, request):
        return Response(GeneralKnowledgeQuestionSerializer(self._get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        try:
            instance = GeneralKnowledgeQuestion.objects.get(id=pk)
        except GeneralKnowledgeQuestion.DoesNotExist:
            return Response({'error': 'Pregunta no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        return Response(GeneralKnowledgeQuestionSerializer(instance).data)

    def create(self, request):
        serializer = GeneralKnowledgeQuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(GeneralKnowledgeQuestionSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        try:
            instance = GeneralKnowledgeQuestion.objects.get(id=pk)
        except GeneralKnowledgeQuestion.DoesNotExist:
            return Response({'error': 'Pregunta no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        serializer = GeneralKnowledgeQuestionSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(GeneralKnowledgeQuestionSerializer(serializer.save()).data)

    partial_update = update

    @action(detail=False, methods=['get'], permission_classes=[])
    def random(self, request):
        count = int(request.query_params.get('count', 5))
        all_questions = list(GeneralKnowledgeQuestion.objects.filter(is_active=True))
        questions = random.sample(all_questions, min(count, len(all_questions)))
        return Response(GeneralKnowledgeQuestionSerializer(questions, many=True).data)
