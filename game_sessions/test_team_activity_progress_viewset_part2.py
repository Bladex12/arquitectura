"""Tests for TeamActivityProgressViewSet's remaining actions --
select_topic/select_challenge/upload_prototype/save_pitch (Task 16).

These four were left fully ORM-backed by Task 15 (viewsets.ModelViewSet
-> viewsets.ViewSet conversion) and were therefore CRASHING on every call
before this task: they called Team.objects.get(id=team_id) against a
DynamoDB UUID4 string (ORM Team.id is an integer AutoField) and, even had
that lookup somehow succeeded, self.get_serializer() no longer exists on
a bare viewsets.ViewSet. This file is the first real test coverage any
of these four actions have had.

Sibling to test_team_activity_progress_viewset.py (Task 15's create/
partial_update/submit_anagram/submit_word_search/submit_general_knowledge/
list/retrieve coverage) -- same hybrid Django TestCase (real MySQL-backed
Professor/Course/Student/Stage/Activity/Topic/Challenge fixtures) composed
with a manually-managed moto mock (DynamoDB session/team/progress data)
pattern. Hits the real viewset through the URL router via DRF's APIClient.
"""
import io
import os
import tempfile
import uuid

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from moto import mock_aws
from PIL import Image as PILImage
from rest_framework.test import APIClient

from academic.models import Career, Course, Faculty
from challenges.models import Activity, ActivityType, Challenge, Stage, Topic
from game_sessions.dynamodb.game_session import create_session
from game_sessions.dynamodb.stage_progress import create_session_stage, get_progress, upsert_progress
from game_sessions.dynamodb.team import create_team, get_team
from game_sessions.dynamodb.testing import create_test_table
from game_sessions.dynamodb.token_transaction import list_transactions
from users.models import Professor


def make_professor(prefix='prof'):
    user = User.objects.create_user(username=f'{prefix}_{uuid.uuid4().hex[:8]}', password='pass')
    return Professor.objects.create(user=user)


def make_course():
    suffix = uuid.uuid4().hex[:8]
    faculty = Faculty.objects.create(name=f'Faculty {suffix}')
    career = Career.objects.create(name=f'Career {suffix}', faculty=faculty)
    return Course.objects.create(name=f'Course {suffix}', career=career)


def make_image_upload(filename='photo.jpg'):
    """Builds a small real JPEG in-memory, since select_challenge/
    upload_prototype open the upload with Pillow (a fake byte string
    would fail Image.open and hit the 400 error path, not the happy path
    this is meant to cover)."""
    buffer = io.BytesIO()
    PILImage.new('RGB', (10, 10), color='red').save(buffer, format='JPEG')
    buffer.seek(0)
    return SimpleUploadedFile(filename, buffer.read(), content_type='image/jpeg')


class TeamActivityProgressPart2TestCase(TestCase):
    """Base class: starts a moto mock and creates the GameSessionTable
    schema before each test, alongside real Django ORM fixtures."""

    def setUp(self):
        self.mock = mock_aws()
        self.mock.start()
        os.environ['GAME_SESSIONS_TABLE'] = 'test-game-sessions'
        os.environ['AWS_REGION'] = 'us-east-1'
        create_test_table('test-game-sessions')
        self.client = APIClient()

    def tearDown(self):
        self.mock.stop()

    def make_room_with_activity(self, room_code='ROOM1', activity_name='Empatia'):
        prof = make_professor()
        course = make_course()
        create_session(room_code, professor_id=prof.id, course_id=course.id)
        stage = Stage.objects.create(number=2, name='Empatía', is_active=True)
        create_session_stage(room_code, stage.id)
        activity_type = ActivityType.objects.create(
            code=f'type_{uuid.uuid4().hex[:6]}', name='Selección', is_active=True
        )
        activity = Activity.objects.create(
            stage=stage, activity_type=activity_type, name=activity_name, order_number=1, is_active=True
        )
        team = create_team(room_code, 'Equipo A', 'Azul')
        return prof, room_code, stage, activity, team

    def make_topic(self):
        return Topic.objects.create(name=f'Topic {uuid.uuid4().hex[:6]}')

    def make_challenge(self, topic=None):
        topic = topic or self.make_topic()
        return Challenge.objects.create(topic=topic, title=f'Challenge {uuid.uuid4().hex[:6]}')


# ---------------------------------------------------------------------------
# select_topic
# ---------------------------------------------------------------------------

class SelectTopicTest(TeamActivityProgressPart2TestCase):
    def test_requires_fields(self):
        response = self.client.post('/api/sessions/team-activity-progress/select_topic/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_unknown_team_returns_404(self):
        _, room_code, stage, activity, _team = self.make_room_with_activity()
        topic = self.make_topic()
        response = self.client.post('/api/sessions/team-activity-progress/select_topic/', {
            'team': 'not-a-real-team', 'activity': activity.id, 'session_stage': stage.id, 'topic': topic.id,
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_unknown_topic_returns_404(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        response = self.client.post('/api/sessions/team-activity-progress/select_topic/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id, 'topic': 999999,
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_selects_topic_sets_in_progress(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        topic = self.make_topic()

        response = self.client.post('/api/sessions/team-activity-progress/select_topic/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id, 'topic': topic.id,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'in_progress')
        self.assertEqual(response.data['selected_topic']['id'], topic.id)

        progress = get_progress(room_code, team['team_id'], activity.id)
        self.assertEqual(progress['selected_topic_id'], topic.id)

    def test_selecting_topic_after_challenge_marks_completed(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        challenge = self.make_challenge()
        topic = self.make_topic()
        # Pre-seed a row with a challenge already selected (out of order --
        # mirrors a team going back and picking the topic last).
        upsert_progress(room_code, team['team_id'], activity.id, status='in_progress',
                         selected_challenge_id=challenge.id)

        response = self.client.post('/api/sessions/team-activity-progress/select_topic/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id, 'topic': topic.id,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'completed')
        self.assertIsNotNone(response.data['completed_at'])
        self.assertEqual(response.data['progress_percentage'], 100)


# ---------------------------------------------------------------------------
# select_challenge
# ---------------------------------------------------------------------------

class SelectChallengeTest(TeamActivityProgressPart2TestCase):
    def test_requires_fields(self):
        response = self.client.post('/api/sessions/team-activity-progress/select_challenge/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_unknown_challenge_returns_404(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        response = self.client.post('/api/sessions/team-activity-progress/select_challenge/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id, 'challenge': 999999,
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_selecting_challenge_auto_fills_topic_and_completes(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        challenge = self.make_challenge()

        response = self.client.post('/api/sessions/team-activity-progress/select_challenge/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'challenge': challenge.id,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'completed')
        self.assertEqual(response.data['selected_challenge']['id'], challenge.id)
        self.assertEqual(response.data['selected_topic']['id'], challenge.topic_id)

        progress = get_progress(room_code, team['team_id'], activity.id)
        self.assertEqual(progress['selected_challenge_id'], challenge.id)
        self.assertEqual(progress['selected_topic_id'], challenge.topic_id)

    def test_does_not_override_an_existing_selected_topic(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        other_topic = self.make_topic()
        challenge = self.make_challenge()  # has its own, different topic
        upsert_progress(room_code, team['team_id'], activity.id, status='in_progress',
                         selected_topic_id=other_topic.id)

        response = self.client.post('/api/sessions/team-activity-progress/select_challenge/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'challenge': challenge.id,
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['selected_topic']['id'], other_topic.id)

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_persona_image_upload_is_processed(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        challenge = self.make_challenge()

        response = self.client.post('/api/sessions/team-activity-progress/select_challenge/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'challenge': challenge.id, 'persona_image': make_image_upload(),
        }, format='multipart')

        self.assertEqual(response.status_code, 200, response.data)
        challenge.refresh_from_db()
        self.assertTrue(bool(challenge.persona_image))


# ---------------------------------------------------------------------------
# upload_prototype
# ---------------------------------------------------------------------------

class UploadPrototypeTest(TeamActivityProgressPart2TestCase):
    def test_requires_fields(self):
        response = self.client.post('/api/sessions/team-activity-progress/upload_prototype/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_unknown_team_returns_404(self):
        _, room_code, stage, activity, _team = self.make_room_with_activity()
        response = self.client.post('/api/sessions/team-activity-progress/upload_prototype/', {
            'team': 'nope', 'activity': activity.id, 'session_stage': stage.id,
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_without_image_sets_submitted_and_awards_15_tokens(self):
        """Skipping the photo is a supported flow per the action's own
        docstring ('puede omitirse si el equipo saltó la foto')."""
        _, room_code, stage, activity, team = self.make_room_with_activity()

        response = self.client.post('/api/sessions/team-activity-progress/upload_prototype/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
        }, format='multipart')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'submitted')
        self.assertEqual(response.data['progress_percentage'], 100)
        self.assertIsNone(response.data['prototype_image_url'])

        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 15)

    def test_reuploading_does_not_double_award_tokens(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        payload = {'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id}

        first = self.client.post('/api/sessions/team-activity-progress/upload_prototype/', payload, format='multipart')
        self.assertEqual(first.status_code, 200, first.data)
        second = self.client.post('/api/sessions/team-activity-progress/upload_prototype/', payload, format='multipart')
        self.assertEqual(second.status_code, 200, second.data)

        team_after = get_team(room_code, team['team_id'])
        self.assertEqual(team_after['tokens_total'], 15)

        transactions = list_transactions(room_code)
        prototype_txs = [
            t for t in transactions if t['source_id'] == f'{team["team_id"]}:{activity.id}:prototype_uploaded'
        ]
        self.assertEqual(len(prototype_txs), 1)

    def test_two_teams_uploading_prototype_both_get_awarded(self):
        """Cross-team regression: source_id used to be
        f'{activity.id}:prototype_uploaded' with no team_id, so two teams
        in the same room uploading a prototype for the same activity
        collided on one DynamoDB key and only the first team was ever
        awarded (see this fix's task report for the reviewer-confirmed
        repro: team A got 15, team B got 0, only one transaction)."""
        _, room_code, stage, activity, team_a = self.make_room_with_activity()
        team_b = create_team(room_code, 'Equipo B', 'Rojo')

        response_a = self.client.post('/api/sessions/team-activity-progress/upload_prototype/', {
            'team': team_a['team_id'], 'activity': activity.id, 'session_stage': stage.id,
        }, format='multipart')
        response_b = self.client.post('/api/sessions/team-activity-progress/upload_prototype/', {
            'team': team_b['team_id'], 'activity': activity.id, 'session_stage': stage.id,
        }, format='multipart')

        self.assertEqual(response_a.status_code, 200, response_a.data)
        self.assertEqual(response_b.status_code, 200, response_b.data)

        team_a_after = get_team(room_code, team_a['team_id'])
        team_b_after = get_team(room_code, team_b['team_id'])
        self.assertEqual(team_a_after['tokens_total'], 15)
        self.assertEqual(team_b_after['tokens_total'], 15)

        transactions = list_transactions(room_code)
        prototype_txs = [t for t in transactions if t['source_id'].endswith(':prototype_uploaded')]
        self.assertEqual(len(prototype_txs), 2)
        self.assertEqual({t['team_id'] for t in prototype_txs}, {team_a['team_id'], team_b['team_id']})

    def test_product_name_and_tagline_saved_to_response_data(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()

        response = self.client.post('/api/sessions/team-activity-progress/upload_prototype/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'product_name': '  Widget  ', 'product_tagline': '  Best widget ever  ',
        }, format='multipart')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['response_data']['product_name'], 'Widget')
        self.assertEqual(response.data['response_data']['product_tagline'], 'Best widget ever')

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_with_image_saves_prototype_image_url(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()

        response = self.client.post('/api/sessions/team-activity-progress/upload_prototype/', {
            'team': team['team_id'], 'activity': activity.id, 'session_stage': stage.id,
            'image': make_image_upload(),
        }, format='multipart')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNotNone(response.data['prototype_image_url'])
        self.assertIn('prototypes/', response.data['prototype_image_url'])


# ---------------------------------------------------------------------------
# save_pitch
# ---------------------------------------------------------------------------

class SavePitchTest(TeamActivityProgressPart2TestCase):
    def test_requires_fields(self):
        response = self.client.post('/api/sessions/team-activity-progress/save_pitch/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_unknown_team_returns_404(self):
        _, room_code, stage, activity, _team = self.make_room_with_activity()
        response = self.client.post('/api/sessions/team-activity-progress/save_pitch/', {
            'team_id': 'nope', 'activity_id': activity.id, 'session_stage_id': stage.id,
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_partial_pitch_computes_percentage_and_stays_in_progress(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()

        response = self.client.post('/api/sessions/team-activity-progress/save_pitch/', {
            'team_id': team['team_id'], 'activity_id': activity.id, 'session_stage_id': stage.id,
            'pitch_intro_problem': 'Problema', 'pitch_solution': 'Solución',
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'in_progress')
        self.assertEqual(response.data['progress_percentage'], 40)  # 2 of 5 fields

    def test_full_pitch_marks_completed(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()

        response = self.client.post('/api/sessions/team-activity-progress/save_pitch/', {
            'team_id': team['team_id'], 'activity_id': activity.id, 'session_stage_id': stage.id,
            'pitch_intro_problem': 'Problema', 'pitch_solution': 'Solución', 'pitch_value': 'Valor',
            'pitch_impact': 'Impacto', 'pitch_closing': 'Cierre',
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'completed')
        self.assertEqual(response.data['progress_percentage'], 100)
        self.assertIsNotNone(response.data['completed_at'])

        progress = get_progress(room_code, team['team_id'], activity.id)
        self.assertEqual(progress['pitch_intro_problem'], 'Problema')
        self.assertEqual(progress['pitch_closing'], 'Cierre')

    def test_completed_at_is_set_only_once(self):
        _, room_code, stage, activity, team = self.make_room_with_activity()
        payload = {
            'team_id': team['team_id'], 'activity_id': activity.id, 'session_stage_id': stage.id,
            'pitch_intro_problem': 'Problema', 'pitch_solution': 'Solución', 'pitch_value': 'Valor',
            'pitch_impact': 'Impacto', 'pitch_closing': 'Cierre',
        }

        first = self.client.post('/api/sessions/team-activity-progress/save_pitch/', payload, format='json')
        completed_at = first.data['completed_at']

        second = self.client.post('/api/sessions/team-activity-progress/save_pitch/', payload, format='json')
        self.assertEqual(second.data['completed_at'], completed_at)
