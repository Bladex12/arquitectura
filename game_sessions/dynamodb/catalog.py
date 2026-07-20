"""SessionGroup and Tablet repository - the two game_sessions entities
that don't belong to a single room's item collection (SessionGroup
spans multiple sessions, Tablet is reused across sessions over time)."""
import uuid
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_session_group(professor_id, course_id, total_students, number_of_sessions):
    """Creates a new SessionGroup item."""
    session_group_id = str(uuid.uuid4())
    now = _now_iso()
    item = {
        'PK': keys.session_group_pk(session_group_id),
        'SK': keys.metadata_sk(),
        'type': 'SessionGroup',
        'session_group_id': session_group_id,
        'professor_id': professor_id,
        'course_id': course_id,
        'total_students': total_students,
        'number_of_sessions': number_of_sessions,
        'created_at': now,
        'updated_at': now,
        'GSI1PK': keys.professor_gsi1pk(professor_id),
        'GSI1SK': now,
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_session_group(session_group_id):
    """Returns the SessionGroup item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_group_pk(session_group_id), 'SK': keys.metadata_sk()},
    )
    return response.get('Item')


def list_session_groups_for_professor(professor_id):
    """Returns every SessionGroup item for a professor, via GSI1 - the
    same index GameSession uses, discriminated by the `type` attribute
    since both share the PROFESSOR#<id> partition."""
    table = get_table()
    response = table.query(
        IndexName='GSI1',
        KeyConditionExpression=Key('GSI1PK').eq(keys.professor_gsi1pk(professor_id)),
    )
    return [item for item in response['Items'] if item['type'] == 'SessionGroup']


def create_tablet(tablet_code):
    """Creates a new Tablet catalog item. Returns None instead of
    raising if tablet_code is already registered."""
    now = _now_iso()
    item = {
        'PK': keys.tablet_pk(tablet_code),
        'SK': keys.metadata_sk(),
        'type': 'Tablet',
        'tablet_code': tablet_code,
        'is_active': True,
        'created_at': now,
        'updated_at': now,
    }
    table = get_table()
    try:
        table.put_item(Item=item, ConditionExpression='attribute_not_exists(PK)')
        return item
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise


def get_tablet(tablet_code):
    """Returns the Tablet item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.tablet_pk(tablet_code), 'SK': keys.metadata_sk()},
    )
    return response.get('Item')


def deactivate_tablet(tablet_code):
    """Sets is_active to False for a tablet (soft-delete, matching the
    is_active convention used throughout the rest of this codebase)."""
    table = get_table()
    response = table.update_item(
        Key={'PK': keys.tablet_pk(tablet_code), 'SK': keys.metadata_sk()},
        UpdateExpression='SET is_active = :false, updated_at = :now',
        ExpressionAttributeValues={':false': False, ':now': _now_iso()},
        ReturnValues='ALL_NEW',
    )
    return response['Attributes']
