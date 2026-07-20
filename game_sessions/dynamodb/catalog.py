"""SessionGroup and Tablet repository - the two game_sessions entities
that don't belong to a single room's item collection (SessionGroup
spans multiple sessions, Tablet is reused across sessions over time)."""
import uuid

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table, now_iso


def create_session_group(professor_id, course_id, total_students, number_of_sessions):
    """Creates a new SessionGroup item."""
    session_group_id = str(uuid.uuid4())
    now = now_iso()
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
        ConsistentRead=True,
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


def delete_session_group(session_group_id):
    """Deletes the SessionGroup item. Unlike GameSession, a SessionGroup
    has no child items under its own PK (its member sessions live under
    their own SESSION# partitions), so a single delete_item is enough -
    no batch/cascade needed."""
    table = get_table()
    table.delete_item(Key={'PK': keys.session_group_pk(session_group_id), 'SK': keys.metadata_sk()})


def create_tablet(tablet_code):
    """Creates a new Tablet catalog item. Returns None instead of
    raising if tablet_code is already registered."""
    now = now_iso()
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
        ConsistentRead=True,
    )
    return response.get('Item')


def list_tablets(is_active=None):
    """Returns Tablet catalog items across the whole table (a filtered
    Scan, not a Query - like scan_active_sessions, tablets are a small,
    low-frequency catalog with no natural partition to query by). Pass
    is_active to filter to just active or just inactive tablets."""
    table = get_table()
    filter_expression = Attr('type').eq('Tablet')
    if is_active is not None:
        filter_expression &= Attr('is_active').eq(is_active)
    response = table.scan(FilterExpression=filter_expression)
    return response['Items']


def delete_tablet(tablet_code):
    """Deletes the Tablet catalog item outright (as opposed to
    deactivate_tablet's soft-delete) - for admin cleanup of tablets that
    should no longer exist at all, not just be marked inactive."""
    table = get_table()
    table.delete_item(Key={'PK': keys.tablet_pk(tablet_code), 'SK': keys.metadata_sk()})


def deactivate_tablet(tablet_code):
    """Sets is_active to False for a tablet (soft-delete, matching the
    is_active convention used throughout the rest of this codebase).
    Returns None if the tablet doesn't exist (guarded so update_item's
    default upsert behavior can't create a ghost item missing `type`)."""
    table = get_table()
    try:
        response = table.update_item(
            Key={'PK': keys.tablet_pk(tablet_code), 'SK': keys.metadata_sk()},
            UpdateExpression='SET is_active = :false, updated_at = :now',
            ConditionExpression='attribute_exists(PK)',
            ExpressionAttributeValues={':false': False, ':now': now_iso()},
            ReturnValues='ALL_NEW',
        )
        return response['Attributes']
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise


def activate_tablet(tablet_code):
    """Sets is_active to True for a tablet - the mirror of
    deactivate_tablet, needed for the admin `--force` reactivate path.
    Returns None if the tablet doesn't exist (guarded so update_item's
    default upsert behavior can't create a ghost item missing `type`)."""
    table = get_table()
    try:
        response = table.update_item(
            Key={'PK': keys.tablet_pk(tablet_code), 'SK': keys.metadata_sk()},
            UpdateExpression='SET is_active = :true, updated_at = :now',
            ConditionExpression='attribute_exists(PK)',
            ExpressionAttributeValues={':true': True, ':now': now_iso()},
            ReturnValues='ALL_NEW',
        )
        return response['Attributes']
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise
