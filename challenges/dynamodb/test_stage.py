from challenges.dynamodb import stage as stage_repo
from challenges.dynamodb.testing import DynamoDBTestCase


class StageRepoTest(DynamoDBTestCase):
    def test_create_then_get(self):
        created = stage_repo.create_stage(number=1, name='Trabajo en Equipo')
        fetched = stage_repo.get_stage(created['id'])
        assert fetched['number'] == 1
        assert fetched['name'] == 'Trabajo en Equipo'

    def test_list_stages_ordered_by_number(self):
        stage_repo.create_stage(number=3, name='Creatividad')
        stage_repo.create_stage(number=1, name='Equipo')
        stage_repo.create_stage(number=2, name='Empatía')

        stages = stage_repo.list_stages()
        numbers = [s['number'] for s in stages]
        assert numbers == [1, 2, 3]

    def test_find_stage_by_number(self):
        stage_repo.create_stage(number=4, name='Comunicación')
        found = stage_repo.find_stage_by_number(4)
        assert found is not None
        assert stage_repo.find_stage_by_number(99) is None

    def test_update_recomputes_ordering_key(self):
        created = stage_repo.create_stage(number=1, name='A')
        stage_repo.update_stage(created['id'], {'number': 5})
        assert stage_repo.find_stage_by_number(5)['id'] == created['id']
        assert stage_repo.find_stage_by_number(1) is None
