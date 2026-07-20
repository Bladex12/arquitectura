"""GameSession repository - create/read/update sessions, and the
whole-room fetch that's the dominant hot path (see the spec's Access
patterns section)."""
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_session(room_code, professor_id, course_id, session_group_id=None):
    """Creates a new GameSession item in 'lobby' status. Raises
    botocore.exceptions.ClientError (ConditionalCheckFailedException) if
    room_code is already taken."""
    now = _now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.metadata_sk(),
        'type': 'GameSession',
        'room_code': room_code,
        'professor_id': professor_id,
        'course_id': course_id,
        'session_group_id': session_group_id,
        'qr_code': None,
        'status': 'lobby',
        'started_at': None,
        'ended_at': None,
        'cancellation_reason': None,
        'cancellation_reason_other': None,
        'current_stage_id': None,
        'current_activity_id': None,
        'show_results_stage': 0,
        'created_at': now,
        'updated_at': now,
        'GSI1PK': keys.professor_gsi1pk(professor_id),
        'GSI1SK': keys.session_gsi1sk('lobby', now),
    }
    table = get_table()
    table.put_item(
        Item=item,
        ConditionExpression='attribute_not_exists(PK)',
    )
    return item


def get_session(room_code):
    """Returns the GameSession item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.metadata_sk()},
    )
    return response.get('Item')


def update_session_status(room_code, expected_status, new_status):
    """Conditionally transitions status. Returns True if the transition
    happened, False if expected_status didn't match (someone else
    already transitioned it - e.g. a race between a professor action and
    a future expiry-check job)."""
    now = _now_iso()
    table = get_table()
    try:
        table.update_item(
            Key={'PK': keys.session_pk(room_code), 'SK': keys.metadata_sk()},
            UpdateExpression='SET #status = :new_status, updated_at = :now, GSI1SK = :gsi1sk',
            ConditionExpression='#status = :expected_status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':new_status': new_status,
                ':expected_status': expected_status,
                ':now': now,
                ':gsi1sk': keys.session_gsi1sk(new_status, now),
            },
        )
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return False
        raise


def list_sessions_for_professor(professor_id, status=None):
    """Returns GameSession items for a professor, newest-created first
    within whatever status filter is given. Pass status to filter to
    just that status (e.g. 'lobby')."""
    table = get_table()
    key_condition = Key('GSI1PK').eq(keys.professor_gsi1pk(professor_id))
    if status:
        key_condition &= Key('GSI1SK').begins_with(f'{status}#')
    response = table.query(
        IndexName='GSI1',
        KeyConditionExpression=key_condition,
        ScanIndexForward=False,
    )
    return [item for item in response['Items'] if item['type'] == 'GameSession']


def scan_active_sessions():
    """Returns all GameSession items currently in 'lobby' or 'running'
    status, across every professor. A filtered Scan, not a Query - see
    the spec's Access patterns section for why that's the right call
    here (low-frequency, small item count at course-project scale).

    Deciding *which* of these have actually expired (e.g. "2 hours since
    creation or start") is the caller's responsibility - out of scope
    here, see the separate cancel_expired_sessions -> EventBridge task.
    """
    table = get_table()
    response = table.scan(
        FilterExpression=Attr('type').eq('GameSession') & Attr('status').is_in(['lobby', 'running']),
    )
    return response['Items']


def get_room_items(room_code):
    """The dominant hot path: one Query returns every item belonging to
    a room (the GameSession itself, all teams, progress, connections,
    tokens, evaluations) in a single round trip."""
    table = get_table()
    response = table.query(
        KeyConditionExpression=Key('PK').eq(keys.session_pk(room_code)),
    )
    return response['Items']
