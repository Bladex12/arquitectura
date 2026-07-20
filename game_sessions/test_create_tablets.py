from django.core.management import call_command

from game_sessions.dynamodb.testing import DynamoDBTestCase


class CreateTabletsCommandTest(DynamoDBTestCase):
    def test_count_3_creates_tab1_through_tab3(self):
        from game_sessions.dynamodb.catalog import get_tablet

        call_command('create_tablets', '--count', '3')

        for i in range(1, 4):
            tablet = get_tablet(f'TAB{i}')
            self.assertIsNotNone(tablet)
            self.assertTrue(tablet['is_active'])

    def test_rerun_without_force_reports_ya_existe_and_does_not_error(self):
        from io import StringIO

        call_command('create_tablets', '--count', '2')

        out = StringIO()
        call_command('create_tablets', '--count', '2', stdout=out)

        self.assertIn('ya existe', out.getvalue())

    def test_force_reactivates_previously_deactivated_tablet(self):
        from game_sessions.dynamodb.catalog import deactivate_tablet, get_tablet

        call_command('create_tablets', '--count', '1')
        deactivate_tablet('TAB1')
        self.assertFalse(get_tablet('TAB1')['is_active'])

        call_command('create_tablets', '--count', '1', '--force')

        self.assertTrue(get_tablet('TAB1')['is_active'])
