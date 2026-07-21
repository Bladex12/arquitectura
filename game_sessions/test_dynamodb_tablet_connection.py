from game_sessions.dynamodb.testing import DynamoDBTestCase


class TabletConnectionRepositoryTest(DynamoDBTestCase):
    def test_create_and_get_connection(self):
        from game_sessions.dynamodb.tablet_connection import create_connection, get_connection

        created = create_connection('ABC123', team_id='team-1', tablet_id='tablet-1')

        self.assertEqual(created['team_id'], 'team-1')
        self.assertEqual(created['current_screen'], '')
        self.assertIsNone(created['disconnected_at'])
        self.assertEqual(created['type'], 'TabletConnection')

        fetched = get_connection('ABC123', created['team_session_token'])
        self.assertEqual(fetched['team_id'], 'team-1')

    def test_get_connection_returns_none_when_missing(self):
        from game_sessions.dynamodb.tablet_connection import get_connection

        self.assertIsNone(get_connection('ABC123', 'nonexistent-token'))

    def test_update_heartbeat_updates_last_seen_and_screen(self):
        from game_sessions.dynamodb.tablet_connection import create_connection, update_heartbeat

        created = create_connection('ABC123', team_id='team-1')
        original_last_seen = created['last_seen']

        updated = update_heartbeat('ABC123', created['team_session_token'], current_screen='results_1')

        self.assertEqual(updated['current_screen'], 'results_1')
        self.assertGreaterEqual(updated['last_seen'], original_last_seen)

    def test_update_heartbeat_without_screen_keeps_existing_screen(self):
        from game_sessions.dynamodb.tablet_connection import (
            create_connection,
            get_connection,
            update_heartbeat,
        )

        created = create_connection('ABC123', team_id='team-1')
        update_heartbeat('ABC123', created['team_session_token'], current_screen='lobby')

        update_heartbeat('ABC123', created['team_session_token'])

        self.assertEqual(get_connection('ABC123', created['team_session_token'])['current_screen'], 'lobby')

    def test_update_heartbeat_returns_none_when_connection_missing(self):
        from game_sessions.dynamodb.tablet_connection import update_heartbeat

        self.assertIsNone(update_heartbeat('ABC123', 'nonexistent-token'))

    def test_disconnect_sets_disconnected_at(self):
        from game_sessions.dynamodb.tablet_connection import create_connection, disconnect

        created = create_connection('ABC123', team_id='team-1')

        updated = disconnect('ABC123', created['team_session_token'])

        self.assertIsNotNone(updated['disconnected_at'])

    def test_disconnect_returns_none_when_connection_missing(self):
        from game_sessions.dynamodb.tablet_connection import disconnect

        self.assertIsNone(disconnect('ABC123', 'nonexistent-token'))

    def test_list_connections_returns_all_in_room(self):
        from game_sessions.dynamodb.tablet_connection import create_connection, list_connections

        create_connection('ABC123', team_id='team-1')
        create_connection('ABC123', team_id='team-2')

        connections = list_connections('ABC123')

        self.assertEqual(len(connections), 2)

    def test_reactivate_clears_disconnected_at(self):
        from game_sessions.dynamodb.tablet_connection import create_connection, disconnect, reactivate

        created = create_connection('ABC123', team_id='team-1')
        disconnect('ABC123', created['team_session_token'])

        reactivated = reactivate('ABC123', created['team_session_token'])

        self.assertIsNone(reactivated['disconnected_at'])

    def test_reactivate_returns_none_when_connection_missing(self):
        from game_sessions.dynamodb.tablet_connection import reactivate

        self.assertIsNone(reactivate('ABC123', 'nonexistent-token'))

    def test_find_connection_by_token_locates_across_rooms(self):
        from game_sessions.dynamodb.tablet_connection import create_connection, find_connection_by_token

        create_connection('ABC123', team_id='team-1')
        created = create_connection('XYZ789', team_id='team-2')

        found = find_connection_by_token(created['team_session_token'])

        self.assertIsNotNone(found)
        self.assertEqual(found['room_code'], 'XYZ789')
        self.assertEqual(found['team_id'], 'team-2')

    def test_find_connection_by_token_returns_none_when_missing(self):
        from game_sessions.dynamodb.tablet_connection import find_connection_by_token

        self.assertIsNone(find_connection_by_token('nonexistent-token'))
