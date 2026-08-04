"""Shim-level tests for challenges/models.py, verifying the exact call
shapes the six seed management commands and challenges/views.py use --
not just the repo layer underneath."""
from challenges.dynamodb.testing import DynamoDBTestCase
from challenges.models import (
    Stage, ActivityType, Activity, Topic, Challenge, WordSearchOption,
    AnagramWord, ChaosQuestion, GeneralKnowledgeQuestion,
)


class StageShimTest(DynamoDBTestCase):
    def test_get_or_create_then_mutate_and_save(self):
        stage, created = Stage.objects.get_or_create(
            number=1, defaults={'name': 'Trabajo en Equipo', 'estimated_duration': 60},
        )
        assert created is True
        assert stage.name == 'Trabajo en Equipo'

        again, created2 = Stage.objects.get_or_create(number=1, defaults={'name': 'ignored'})
        assert created2 is False
        assert again.id == stage.id

        again.name = 'Renombrada'
        again.save()
        fetched = Stage.objects.get(number=1, is_active=True)
        assert fetched.name == 'Renombrada'

    def test_get_with_number_and_is_active(self):
        Stage.objects.create(number=1, name='Etapa 1', is_active=True)
        try:
            Stage.objects.get(number=1, is_active=False)
            assert False, 'expected DoesNotExist'
        except Stage.DoesNotExist:
            pass


class ActivityTypeShimTest(DynamoDBTestCase):
    def test_get_or_create_by_code(self):
        at, created = ActivityType.objects.get_or_create(
            code='personalizacion', defaults={'name': 'Personalización'},
        )
        assert created is True
        again, created2 = ActivityType.objects.get_or_create(code='personalizacion', defaults={'name': 'x'})
        assert created2 is False
        assert again.id == at.id


class ActivityShimTest(DynamoDBTestCase):
    def setUp(self):
        super().setUp()
        self.stage = Stage.objects.create(number=1, name='Etapa 1')
        self.activity_type = ActivityType.objects.create(code='personalizacion', name='Personalización')

    def test_get_or_create_with_instance_defaults_then_mutate_save(self):
        activity, created = Activity.objects.get_or_create(
            stage=self.stage, order_number=1,
            defaults={'activity_type': self.activity_type, 'name': 'Personalización', 'order_number': 1},
        )
        assert created is True
        assert activity.activity_type_id == self.activity_type.id

        activity.order_number = 2
        activity.save()

        moved = Activity.objects.get(id=activity.id)
        assert moved.order_number == 2
        assert moved.stage_id == self.stage.id

    def test_filter_name_icontains_and_first(self):
        Activity.objects.create(
            stage=self.stage, activity_type=self.activity_type,
            name='Personalización', order_number=1,
        )
        found = Activity.objects.filter(
            stage=self.stage, name__icontains='personaliz', is_active=True,
        ).first()
        assert found is not None
        assert found.name == 'Personalización'

    def test_filter_ordered_by_order_number(self):
        Activity.objects.create(stage=self.stage, activity_type=self.activity_type, name='B', order_number=2)
        Activity.objects.create(stage=self.stage, activity_type=self.activity_type, name='A', order_number=1)
        activities = Activity.objects.filter(stage=self.stage, is_active=True).order_by('order_number')
        assert [a.name for a in activities] == ['A', 'B']

    def test_exclude_by_id(self):
        a1 = Activity.objects.create(stage=self.stage, activity_type=self.activity_type, name='A', order_number=1)
        a2 = Activity.objects.create(stage=self.stage, activity_type=self.activity_type, name='B', order_number=2)
        others = Activity.objects.filter(stage=self.stage).exclude(id=a1.id)
        assert [a.id for a in others] == [a2.id]

    def test_word_search_activity_type_gate(self):
        activity = Activity.objects.create(
            stage=self.stage, activity_type=self.activity_type, name='No Minijuego', order_number=1,
        )
        assert activity.get_word_search_data() is None

    def test_word_search_data_from_option(self):
        minigame_type = ActivityType.objects.create(code='minigame', name='Minijuego')
        activity = Activity.objects.create(
            stage=self.stage, activity_type=minigame_type, name='Sopa', order_number=1,
        )
        WordSearchOption.objects.create(
            activity_id=activity.id, name='Opción', words=['UNO', 'DOS'],
            grid=[['U']], word_positions=[{'word': 'UNO'}],
        )
        data = activity.get_word_search_data(team_id=1, session_stage_id=1)
        assert data is not None
        assert data['grid'] == [['U']]

    def test_get_anagram_data_deterministic(self):
        for w in ['uno', 'dos', 'tres', 'cuatro', 'cinco']:
            AnagramWord.objects.create(word=w)
        activity = Activity.objects.create(
            stage=self.stage, activity_type=self.activity_type, name='X', order_number=1,
        )
        data1 = activity.get_anagram_data(count=3, team_id=1, session_stage_id=1)
        data2 = activity.get_anagram_data(count=3, team_id=1, session_stage_id=1)
        assert data1 == data2
        assert len(data1['words']) == 3


class TopicChallengeShimTest(DynamoDBTestCase):
    def test_topic_get_or_create(self):
        topic, created = Topic.objects.get_or_create(name='Salud', defaults={'category': 'salud'})
        assert created is True
        again, created2 = Topic.objects.get_or_create(name='Salud', defaults={})
        assert created2 is False
        assert again.id == topic.id

    def test_challenge_get_or_create_and_mutate_save(self):
        topic = Topic.objects.create(name='Salud')
        challenge, created = Challenge.objects.get_or_create(
            topic=topic, title='Desafío A', defaults={'difficulty_level': 'medium'},
        )
        assert created is True

        challenge.description = 'Nueva descripción'
        challenge.save()

        fetched = Challenge.objects.get(id=challenge.id)
        assert fetched.description == 'Nueva descripción'


class TriviaShimTest(DynamoDBTestCase):
    def test_anagram_word_get_or_create_idempotent(self):
        _, created1 = AnagramWord.objects.get_or_create(word='equipo', defaults={'is_active': True})
        _, created2 = AnagramWord.objects.get_or_create(word='equipo', defaults={'is_active': True})
        assert created1 is True
        assert created2 is False
        assert AnagramWord.objects.count() == 1

    def test_chaos_question_get_or_create_idempotent(self):
        ChaosQuestion.objects.get_or_create(question='¿Qué harías?', defaults={'is_active': True})
        ChaosQuestion.objects.get_or_create(question='¿Qué harías?', defaults={'is_active': True})
        assert ChaosQuestion.objects.count() == 1

    def test_general_knowledge_question_get_or_create(self):
        GeneralKnowledgeQuestion.objects.get_or_create(
            question='¿Capital?', defaults={
                'option_a': 'A', 'option_b': 'B', 'option_c': 'C', 'option_d': 'D', 'correct_answer': 0,
            },
        )
        assert GeneralKnowledgeQuestion.objects.count() == 1
