from academic.dynamodb import faculty as faculty_repo
from challenges.dynamodb import topic as topic_repo
from challenges.dynamodb.testing import DynamoDBTestCase


class TopicRepoTest(DynamoDBTestCase):
    def setUp(self):
        super().setUp()
        self.f1 = faculty_repo.create_faculty(name='Ingeniería')
        self.f2 = faculty_repo.create_faculty(name='Medicina')

    def test_create_with_faculties_then_list_faculty_ids(self):
        topic = topic_repo.create_topic(name='Salud Digital', faculty_ids=[self.f1['id'], self.f2['id']])
        ids = set(topic_repo.list_faculty_ids_for_topic(topic['id']))
        assert ids == {self.f1['id'], self.f2['id']}

    def test_list_topics_for_faculty(self):
        t1 = topic_repo.create_topic(name='Tema A', faculty_ids=[self.f1['id']])
        topic_repo.create_topic(name='Tema B', faculty_ids=[self.f2['id']])

        topics = topic_repo.list_topics_for_faculty(self.f1['id'])
        assert len(topics) == 1
        assert topics[0]['id'] == t1['id']

    def test_set_topic_faculties_replaces_full_set(self):
        topic = topic_repo.create_topic(name='Tema', faculty_ids=[self.f1['id']])
        topic_repo.set_topic_faculties(topic['id'], [self.f2['id']])

        ids = set(topic_repo.list_faculty_ids_for_topic(topic['id']))
        assert ids == {self.f2['id']}
        # f1 no longer sees this topic in its reverse index.
        assert topic_repo.list_topics_for_faculty(self.f1['id']) == []

    def test_update_topic_faculties_via_update_topic(self):
        topic = topic_repo.create_topic(name='Tema', faculty_ids=[self.f1['id']])
        topic_repo.update_topic(topic['id'], {'name': 'Tema Renombrado', 'faculty_ids': [self.f1['id'], self.f2['id']]})

        updated = topic_repo.get_topic(topic['id'])
        assert updated['name'] == 'Tema Renombrado'
        ids = set(topic_repo.list_faculty_ids_for_topic(topic['id']))
        assert ids == {self.f1['id'], self.f2['id']}

    def test_list_topics_active_only(self):
        topic_repo.create_topic(name='Activo')
        topic_repo.create_topic(name='Inactivo', is_active=False)
        active = topic_repo.list_topics(active_only=True)
        assert {t['name'] for t in active} == {'Activo'}
