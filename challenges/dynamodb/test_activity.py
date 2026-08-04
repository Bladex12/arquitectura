from challenges.dynamodb import stage as stage_repo
from challenges.dynamodb import activity_type as activity_type_repo
from challenges.dynamodb import activity as activity_repo
from challenges.dynamodb import word_search_option as wso_repo
from challenges.dynamodb.testing import DynamoDBTestCase


class ActivityRepoTest(DynamoDBTestCase):
    def setUp(self):
        super().setUp()
        self.stage = stage_repo.create_stage(number=1, name='Etapa 1')
        self.other_stage = stage_repo.create_stage(number=2, name='Etapa 2')
        self.activity_type = activity_type_repo.create_activity_type(code='minigame', name='Minijuego')

    def _make_activity(self, order_number, stage=None, name='Actividad'):
        return activity_repo.create_activity(
            stage_id=(stage or self.stage)['id'], activity_type_id=self.activity_type['id'],
            name=name, order_number=order_number,
        )

    def test_create_then_get_by_id(self):
        created = self._make_activity(1)
        fetched = activity_repo.get_activity(created['id'])
        assert fetched['name'] == 'Actividad'
        assert fetched['order_number'] == 1

    def test_list_activities_for_stage_ordered(self):
        self._make_activity(3, name='Tercera')
        self._make_activity(1, name='Primera')
        self._make_activity(2, name='Segunda')

        activities = activity_repo.list_activities_for_stage(self.stage['id'])
        names = [a['name'] for a in activities]
        assert names == ['Primera', 'Segunda', 'Tercera']

    def test_list_activities_for_stage_excludes_word_search_options(self):
        """WordSearchOption items share the ACTIVITY# SK prefix under the
        same Stage partition -- the type filter must keep them out."""
        activity = self._make_activity(1)
        wso_repo.create_word_search_option(activity_id=activity['id'], name='Opción', words=['UNO', 'DOS'])

        activities = activity_repo.list_activities_for_stage(self.stage['id'])
        assert len(activities) == 1
        assert activities[0]['id'] == activity['id']

    def test_update_order_number_only_moves_item(self):
        activity = self._make_activity(1)
        activity_repo.update_activity(activity['id'], {'order_number': 5})

        moved = activity_repo.get_activity(activity['id'])
        assert moved['order_number'] == 5
        assert moved['stage_id'] == self.stage['id']

        activities = activity_repo.list_activities_for_stage(self.stage['id'])
        assert len(activities) == 1
        assert activities[0]['order_number'] == 5

    def test_update_stage_moves_item_to_new_partition(self):
        activity = self._make_activity(1)
        activity_repo.update_activity(activity['id'], {'stage_id': self.other_stage['id']})

        assert activity_repo.list_activities_for_stage(self.stage['id']) == []
        moved = activity_repo.list_activities_for_stage(self.other_stage['id'])
        assert len(moved) == 1
        assert moved[0]['id'] == activity['id']

        # Direct by-id lookup (GSI1) still resolves post-move.
        fetched = activity_repo.get_activity(activity['id'])
        assert fetched['stage_id'] == self.other_stage['id']

    def test_update_non_moving_field_is_plain_update(self):
        activity = self._make_activity(1)
        activity_repo.update_activity(activity['id'], {'name': 'Renombrada'})
        assert activity_repo.get_activity(activity['id'])['name'] == 'Renombrada'

    def test_delete_activity_cascades_word_search_options(self):
        activity = self._make_activity(1)
        option = wso_repo.create_word_search_option(activity_id=activity['id'], name='Opción', words=['UNO'])

        activity_repo.delete_activity(activity['id'])

        assert activity_repo.get_activity(activity['id']) is None
        assert wso_repo.get_word_search_option(option['id'], activity['id']) is None

    def test_find_activity_by_stage_and_order(self):
        self._make_activity(2, name='Buscar')
        found = activity_repo.find_activity(self.stage['id'], 2)
        assert found is not None
        assert found['name'] == 'Buscar'
        assert activity_repo.find_activity(self.stage['id'], 99) is None
