"""TabletConnection repository - "this tablet is in this room/team right
now", distinct from the Tablet catalog entity (see catalog.py)."""
import uuid
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_connection(room_code, team_id, tablet_id=None):
    """Creates a new TabletConnection item. team_session_token is a
    fresh UUID4, matching the current Django field's default."""
    team_session_token = str(uuid.uuid4())
    now = _now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.tablet_connection_sk(team_session_token),
        'type': 'TabletConnection',
        'team_session_token': team_session_token,
        'team_id': team_id,
        'room_code': room_code,
        'tablet_id': tablet_id,
        'connected_at': now,
        'disconnected_at': None,
        'last_seen': now,
        'current_screen': '',
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_connection(room_code, team_session_token):
    """Returns the TabletConnection item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.tablet_connection_sk(team_session_token)},
    )
    return response.get('Item')


def update_heartbeat(room_code, team_session_token, current_screen=None):
    """Updates last_seen to now, and current_screen if given (keeps the
    existing value otherwise)."""
    table = get_table()
    now = _now_iso()
    if current_screen is not None:
        update_expression = 'SET last_seen = :now, current_screen = :screen'
        values = {':now': now, ':screen': current_screen}
    else:
        update_expression = 'SET last_seen = :now'
        values = {':now': now}
    response = table.update_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.tablet_connection_sk(team_session_token)},
        UpdateExpression=update_expression,
        ExpressionAttributeValues=values,
        ReturnValues='ALL_NEW',
    )
    return response['Attributes']


def disconnect(room_code, team_session_token):
    """Marks a connection as disconnected (sets disconnected_at)."""
    table = get_table()
    response = table.update_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.tablet_connection_sk(team_session_token)},
        UpdateExpression='SET disconnected_at = :now',
        ExpressionAttributeValues={':now': _now_iso()},
        ReturnValues='ALL_NEW',
    )
    return response['Attributes']


def list_connections(room_code):
    """Returns every TabletConnection item in a room. TABLETCONN# is a
    prefix not shared with any other entity type, so no `type` filter
    is needed here (unlike TEAM#)."""
    table = get_table()
    response = table.query(
        KeyConditionExpression=Key('PK').eq(keys.session_pk(room_code)) & Key('SK').begins_with('TABLETCONN#'),
    )
    return response['Items']
