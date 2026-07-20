"""TabletConnection repository - "this tablet is in this room/team right
now", distinct from the Tablet catalog entity (see catalog.py)."""
import uuid

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table, now_iso


def create_connection(room_code, team_id, tablet_id=None):
    """Creates a new TabletConnection item. team_session_token is a
    fresh UUID4, matching the current Django field's default."""
    team_session_token = str(uuid.uuid4())
    now = now_iso()
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
        ConsistentRead=True,
    )
    return response.get('Item')


def update_heartbeat(room_code, team_session_token, current_screen=None):
    """Updates last_seen to now, and current_screen if given (keeps the
    existing value otherwise). Returns None if the connection doesn't
    exist (guarded so update_item's default upsert behavior can't
    create a ghost item missing `type`)."""
    table = get_table()
    now = now_iso()
    if current_screen is not None:
        update_expression = 'SET last_seen = :now, current_screen = :screen'
        values = {':now': now, ':screen': current_screen}
    else:
        update_expression = 'SET last_seen = :now'
        values = {':now': now}
    try:
        response = table.update_item(
            Key={'PK': keys.session_pk(room_code), 'SK': keys.tablet_connection_sk(team_session_token)},
            UpdateExpression=update_expression,
            ConditionExpression='attribute_exists(PK)',
            ExpressionAttributeValues=values,
            ReturnValues='ALL_NEW',
        )
        return response['Attributes']
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise


def disconnect(room_code, team_session_token):
    """Marks a connection as disconnected (sets disconnected_at).
    Returns None if the connection doesn't exist (guarded so
    update_item's default upsert behavior can't create a ghost item
    missing `type`)."""
    table = get_table()
    try:
        response = table.update_item(
            Key={'PK': keys.session_pk(room_code), 'SK': keys.tablet_connection_sk(team_session_token)},
            UpdateExpression='SET disconnected_at = :now',
            ConditionExpression='attribute_exists(PK)',
            ExpressionAttributeValues={':now': now_iso()},
            ReturnValues='ALL_NEW',
        )
        return response['Attributes']
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise


def list_connections(room_code):
    """Returns every TabletConnection item in a room. TABLETCONN# is a
    prefix not shared with any other entity type, so no `type` filter
    is needed here (unlike TEAM#)."""
    table = get_table()
    response = table.query(
        KeyConditionExpression=Key('PK').eq(keys.session_pk(room_code)) & Key('SK').begins_with('TABLETCONN#'),
        ConsistentRead=True,
    )
    return response['Items']
