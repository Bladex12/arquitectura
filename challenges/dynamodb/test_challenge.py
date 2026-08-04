from challenges.dynamodb import topic as topic_repo
from challenges.dynamodb import challenge as challenge_repo
from challenges.dynamodb.testing import DynamoDBTestCase


class ChallengeRepoTest(DynamoDBTestCase):
    def setUp(self):
        super().setUp()
        self.topic1 = topic_repo.create_topic(name='Tema 1')
        self.topic2 = topic_repo.create_topic(name='Tema 2')

    def test_create_then_get_by_id(self):
        created = challenge_repo.create_challenge(topic_id=self.topic1['id'], title='Desafío A')
        fetched = challenge_repo.get_challenge(created['id'])
        assert fetched['title'] == 'Desafío A'
        assert fetched['topic_id'] == self.topic1['id']

    def test_list_challenges_for_topic(self):
        challenge_repo.create_challenge(topic_id=self.topic1['id'], title='A')
        challenge_repo.create_challenge(topic_id=self.topic2['id'], title='B')

        challenges = challenge_repo.list_challenges_for_topic(self.topic1['id'])
        assert len(challenges) == 1
        assert challenges[0]['title'] == 'A'

    def test_update_moving_topic_relocates_item(self):
        created = challenge_repo.create_challenge(topic_id=self.topic1['id'], title='Mover')
        challenge_repo.update_challenge(created['id'], {'topic_id': self.topic2['id']})

        assert challenge_repo.list_challenges_for_topic(self.topic1['id']) == []
        moved = challenge_repo.list_challenges_for_topic(self.topic2['id'])
        assert len(moved) == 1
        assert moved[0]['id'] == created['id']

        fetched = challenge_repo.get_challenge(created['id'])
        assert fetched['topic_id'] == self.topic2['id']

    def test_update_non_moving_field(self):
        created = challenge_repo.create_challenge(topic_id=self.topic1['id'], title='Original')
        challenge_repo.update_challenge(created['id'], {'title': 'Actualizado'})
        assert challenge_repo.get_challenge(created['id'])['title'] == 'Actualizado'
