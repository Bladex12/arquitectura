"""SessionStage and TeamActivityProgress repository."""
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import build_update_expression, get_table, now_iso


def create_session_stage(room_code, stage_id):
    """Creates a new SessionStage item in 'pending' status."""
    now = now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.stage_sk(stage_id),
        'type': 'SessionStage',
        'stage_id': stage_id,
        'room_code': room_code,
        'status': 'pending',
        'started_at': None,
        'completed_at': None,
        'presentation_order': None,
        'current_presentation_team_id': None,
        'presentation_state': 'not_started',
        'presentation_timestamps': None,
        'created_at': now,
        'updated_at': now,
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_session_stage(room_code, stage_id):
    """Returns the SessionStage item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.stage_sk(stage_id)},
        ConsistentRead=True,
    )
    return response.get('Item')


def update_session_stage(room_code, stage_id, **fields):
    """Partial update - pass any subset of status/started_at/
    completed_at/presentation_order/current_presentation_team_id/
    presentation_state/presentation_timestamps as keyword arguments.
    Returns None if the SessionStage doesn't exist (guarded so
    update_item's default upsert behavior can't create a ghost item
    missing `type`)."""
    table = get_table()
    update_expression, names, values = build_update_expression(fields)
    try:
        response = table.update_item(
            Key={'PK': keys.session_pk(room_code), 'SK': keys.stage_sk(stage_id)},
            UpdateExpression=update_expression,
            ConditionExpression='attribute_exists(PK)',
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues='ALL_NEW',
        )
        return response['Attributes']
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise


def upsert_progress(room_code, team_id, activity_id, **fields):
    """Creates or fully overwrites a TeamActivityProgress item. Uses a
    full put (not a partial update) because progress fields are
    typically saved together as one unit, matching how the Django
    serializer currently sets response_data wholesale."""
    now = now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.progress_sk(team_id, activity_id),
        'type': 'TeamActivityProgress',
        'team_id': team_id,
        'activity_id': activity_id,
        'room_code': room_code,
        'status': fields.get('status', 'pending'),
        'started_at': fields.get('started_at'),
        'completed_at': fields.get('completed_at'),
        'progress_percentage': fields.get('progress_percentage', 0),
        'response_data': fields.get('response_data'),
        'selected_topic_id': fields.get('selected_topic_id'),
        'selected_challenge_id': fields.get('selected_challenge_id'),
        'prototype_image_url': fields.get('prototype_image_url'),
        'pitch_intro_problem': fields.get('pitch_intro_problem'),
        'pitch_solution': fields.get('pitch_solution'),
        'pitch_value': fields.get('pitch_value'),
        'pitch_impact': fields.get('pitch_impact'),
        'pitch_closing': fields.get('pitch_closing'),
        'created_at': now,
        'updated_at': now,
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_progress(room_code, team_id, activity_id):
    """Returns the TeamActivityProgress item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.progress_sk(team_id, activity_id)},
        ConsistentRead=True,
    )
    return response.get('Item')


def scan_all_stages(stage_id=None):
    """Returns SessionStage items across every room. Optionally narrows to
    one stage_id when passed. Needed by admin_dashboard's cross-room
    stage duration/analysis endpoints."""
    table = get_table()
    filter_expression = Attr('type').eq('SessionStage')
    if stage_id is not None:
        filter_expression = filter_expression & Attr('stage_id').eq(stage_id)
    response = table.scan(FilterExpression=filter_expression)
    return response['Items']


def scan_all_progress(activity_id=None):
    """Returns TeamActivityProgress items across every room. Optionally
    narrows to one activity_id when passed. Needed by admin_dashboard's
    cross-room progress/analysis endpoints."""
    table = get_table()
    filter_expression = Attr('type').eq('TeamActivityProgress')
    if activity_id is not None:
        filter_expression = filter_expression & Attr('activity_id').eq(activity_id)
    response = table.scan(FilterExpression=filter_expression)
    return response['Items']
