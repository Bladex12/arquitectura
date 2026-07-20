"""Tests for Professor.get_unique_students_count, which now reads
completed-session/team rosters from DynamoDB instead of joining through
the game_sessions ORM's TeamStudent table (see task-6-brief.md)."""
import uuid

from django.contrib.auth.models import User
from django.test import TestCase

from game_sessions.dynamodb.game_session import create_session, update_session_status
from game_sessions.dynamodb.team import create_team, set_roster
from game_sessions.dynamodb.testing import create_test_table
from moto import mock_aws
from users.models import Professor


class GetUniqueStudentsCountTest(TestCase):
    """Django TestCase (real MySQL-backed User/Professor) composed with a
    manually-managed moto mock (DynamoDB session/team data), since
    DynamoDBTestCase is a plain unittest.TestCase and multiple inheritance
    with Django's TestCase is more trouble than it's worth."""

    def setUp(self):
        self.mock = mock_aws()
        self.mock.start()
        import os
        os.environ['GAME_SESSIONS_TABLE'] = 'test-game-sessions'
        os.environ['AWS_REGION'] = 'us-east-1'
        create_test_table('test-game-sessions')

        user = User.objects.create_user(username=f'prof_{uuid.uuid4().hex[:6]}', password='pass')
        self.professor = Professor.objects.create(user=user)

    def tearDown(self):
        self.mock.stop()

    def test_counts_distinct_students_across_completed_sessions_not_sum(self):
        # Session A: teams with students [1,2,3] and [4,5]
        create_session('ROOMA', professor_id=self.professor.id, course_id=1)
        team_a1 = create_team('ROOMA', name='A1', color='red')
        set_roster('ROOMA', team_a1['team_id'], [1, 2, 3])
        team_a2 = create_team('ROOMA', name='A2', color='blue')
        set_roster('ROOMA', team_a2['team_id'], [4, 5])
        update_session_status('ROOMA', expected_status='lobby', new_status='completed')

        # Session B: teams with students [3,4] (overlap with A) and [6]
        create_session('ROOMB', professor_id=self.professor.id, course_id=1)
        team_b1 = create_team('ROOMB', name='B1', color='green')
        set_roster('ROOMB', team_b1['team_id'], [3, 4])
        team_b2 = create_team('ROOMB', name='B2', color='yellow')
        set_roster('ROOMB', team_b2['team_id'], [6])
        update_session_status('ROOMB', expected_status='lobby', new_status='completed')

        count = self.professor.get_unique_students_count()

        # Distinct union {1,2,3,4,5,6} = 6, NOT the sum (3+2+2+1=8).
        self.assertEqual(count, 6)

    def test_ignores_non_completed_sessions(self):
        create_session('ROOMC', professor_id=self.professor.id, course_id=1)
        team_c1 = create_team('ROOMC', name='C1', color='red')
        set_roster('ROOMC', team_c1['team_id'], [1, 2, 3])
        # Left in 'lobby' status - never completed.

        count = self.professor.get_unique_students_count()

        self.assertEqual(count, 0)
