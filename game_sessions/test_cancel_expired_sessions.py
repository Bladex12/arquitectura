from datetime import datetime, timedelta, timezone

from django.core.management import call_command

from game_sessions.dynamodb.testing import DynamoDBTestCase


def _backdate(room_code, **fields):
    """Directly overwrites timestamp fields on a GameSession item,
    bypassing create_session/update_session (which always stamp 'now')
    so tests can simulate sessions created/started hours in the past."""
    from game_sessions.dynamodb import keys
    from game_sessions.dynamodb.client import get_table

    table = get_table()
    names = {f'#{k}': k for k in fields}
    values = {f':{k}': v for k, v in fields.items()}
    table.update_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.metadata_sk()},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in fields),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


class CancelExpiredSessionsCommandTest(DynamoDBTestCase):
    def test_lobby_session_created_3h_ago_gets_cancelled(self):
        from game_sessions.dynamodb.game_session import create_session, get_session

        create_session('ROOM1', professor_id=1, course_id=1)
        three_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
        _backdate('ROOM1', created_at=three_hours_ago)

        call_command('cancel_expired_sessions')

        session = get_session('ROOM1')
        self.assertEqual(session['status'], 'cancelled')
        self.assertEqual(session['cancellation_reason'], 'auto_expired')

    def test_running_session_started_3h_ago_gets_cancelled(self):
        from game_sessions.dynamodb.game_session import (
            create_session,
            get_session,
            update_session_status,
        )

        create_session('ROOM2', professor_id=1, course_id=1)
        update_session_status('ROOM2', expected_status='lobby', new_status='running')
        three_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
        _backdate('ROOM2', started_at=three_hours_ago)

        call_command('cancel_expired_sessions')

        session = get_session('ROOM2')
        self.assertEqual(session['status'], 'cancelled')
        self.assertEqual(session['cancellation_reason'], 'auto_expired')

    def test_lobby_session_10_minutes_old_is_untouched(self):
        from game_sessions.dynamodb.game_session import create_session, get_session

        create_session('ROOM3', professor_id=1, course_id=1)
        ten_minutes_ago = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        _backdate('ROOM3', created_at=ten_minutes_ago)

        call_command('cancel_expired_sessions')

        session = get_session('ROOM3')
        self.assertEqual(session['status'], 'lobby')
        self.assertIsNone(session['cancellation_reason'])

    def test_completed_session_is_untouched(self):
        from game_sessions.dynamodb.game_session import (
            create_session,
            get_session,
            update_session_status,
        )

        create_session('ROOM4', professor_id=1, course_id=1)
        update_session_status('ROOM4', expected_status='lobby', new_status='running')
        update_session_status('ROOM4', expected_status='running', new_status='completed')
        three_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
        _backdate('ROOM4', created_at=three_hours_ago)

        call_command('cancel_expired_sessions')

        session = get_session('ROOM4')
        self.assertEqual(session['status'], 'completed')
        self.assertIsNone(session['cancellation_reason'])
