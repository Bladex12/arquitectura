"""Runs the real seed management commands (unmodified) against the
DynamoDB shim to prove the shim's call-shape compatibility end-to-end,
not just via hand-written unit tests."""
from io import StringIO

from django.core.management import call_command

from challenges.dynamodb.testing import DynamoDBTestCase
from challenges.models import Stage, ActivityType, Activity, Topic, Challenge


class SeedCommandsTest(DynamoDBTestCase):
    def test_create_initial_data(self):
        call_command('create_initial_data', stdout=StringIO())
        stage = Stage.objects.get(number=1, is_active=True)
        assert stage.name == 'Trabajo en Equipo'
        activities = Activity.objects.filter(stage=stage, is_active=True).order_by('order_number')
        assert [a.name for a in activities] == ['Personalización', 'Presentación']

        # Idempotent without --force: re-running shouldn't create duplicates.
        call_command('create_initial_data', stdout=StringIO())
        activities_again = Activity.objects.filter(stage=stage, is_active=True)
        assert len(activities_again) == 2

    def test_create_initial_data_then_force_update(self):
        call_command('create_initial_data', stdout=StringIO())
        call_command('create_initial_data', '--force', stdout=StringIO())
        stage = Stage.objects.get(number=1, is_active=True)
        assert stage.name == 'Trabajo en Equipo'

    def test_create_video_institucional_reorders_stage_1(self):
        call_command('create_initial_data', stdout=StringIO())
        call_command('create_video_institucional', stdout=StringIO())

        stage = Stage.objects.get(number=1, is_active=True)
        activities = Activity.objects.filter(stage=stage, is_active=True).order_by('order_number')
        names_by_order = [(a.order_number, a.name) for a in activities]
        assert names_by_order == [
            (1, 'Video Institucional'), (2, 'Personalización'), (3, 'Presentación'),
        ]

    def test_create_stage3(self):
        call_command('create_stage3', stdout=StringIO())
        stage = Stage.objects.get(number=3, is_active=True)
        assert stage.name == 'Creatividad'
        activities = Activity.objects.filter(stage=stage, is_active=True)
        assert len(activities) == 1

    def test_create_stage4(self):
        call_command('create_stage4', stdout=StringIO())
        stage = Stage.objects.get(number=4, is_active=True)
        activities = Activity.objects.filter(stage=stage, is_active=True).order_by('order_number')
        assert len(activities) == 2

    def test_create_minigame_data(self):
        call_command('create_minigame_data', stdout=StringIO())
        from challenges.models import AnagramWord, ChaosQuestion, GeneralKnowledgeQuestion
        assert AnagramWord.objects.filter(is_active=True).count() >= 15
        assert ChaosQuestion.objects.filter(is_active=True).count() >= 20
        assert GeneralKnowledgeQuestion.objects.filter(is_active=True).count() >= 10

        # Idempotent.
        before = AnagramWord.objects.count()
        call_command('create_minigame_data', stdout=StringIO())
        assert AnagramWord.objects.count() == before

    def test_update_challenges_creates_topics_and_challenges(self):
        call_command('update_challenges', stdout=StringIO())
        topics = Topic.objects.filter(is_active=True)
        assert len(topics) > 0
        some_topic = topics[0]
        challenges = Challenge.objects.filter(topic=some_topic, is_active=True)
        assert len(challenges) > 0
