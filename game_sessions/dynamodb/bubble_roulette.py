"""TeamBubbleMap and TeamRouletteAssignment repository."""
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import build_update_expression, get_table, now_iso


def upsert_bubble_map(room_code, team_id, stage_id, map_data):
    """Creates or fully overwrites a TeamBubbleMap item - the frontend
    always saves the whole map_data blob together, matching the current
    Django model's single JSONField."""
    now = now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.bubble_map_sk(team_id, stage_id),
        'type': 'TeamBubbleMap',
        'team_id': team_id,
        'stage_id': stage_id,
        'room_code': room_code,
        'map_data': map_data,
        'created_at': now,
        'updated_at': now,
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_bubble_map(room_code, team_id, stage_id):
    """Returns the TeamBubbleMap item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.bubble_map_sk(team_id, stage_id)},
        ConsistentRead=True,
    )
    return response.get('Item')


def create_roulette_assignment(room_code, team_id, stage_id, roulette_challenge_id, token_reward=0):
    """Creates a new TeamRouletteAssignment item in 'assigned' status."""
    now = now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.roulette_sk(team_id, stage_id),
        'type': 'TeamRouletteAssignment',
        'team_id': team_id,
        'stage_id': stage_id,
        'room_code': room_code,
        'roulette_challenge_id': roulette_challenge_id,
        'status': 'assigned',
        'token_reward': token_reward,
        'assigned_at': now,
        'accepted_at': None,
        'rejected_at': None,
        'completed_at': None,
        'validated_by_id': None,
        'created_at': now,
        'updated_at': now,
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_roulette_assignment(room_code, team_id, stage_id):
    """Returns the TeamRouletteAssignment item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.roulette_sk(team_id, stage_id)},
        ConsistentRead=True,
    )
    return response.get('Item')


def update_roulette_assignment(room_code, team_id, stage_id, **fields):
    """Partial update - pass any subset of status/token_reward/
    accepted_at/rejected_at/completed_at/validated_by_id as keyword
    arguments. Returns None if the TeamRouletteAssignment doesn't exist
    (guarded so update_item's default upsert behavior can't create a
    ghost item missing `type`)."""
    table = get_table()
    update_expression, names, values = build_update_expression(fields)
    try:
        response = table.update_item(
            Key={'PK': keys.session_pk(room_code), 'SK': keys.roulette_sk(team_id, stage_id)},
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


def list_roulette_assignments(room_code, team_id=None):
    """Returns every TeamRouletteAssignment item in a room (not its siblings -
    bubble maps and progress items all share the TEAM# prefix, so this filters
    on `type` to exclude them). Optionally narrows to one team when team_id
    is passed."""
    table = get_table()
    key_condition = Key('PK').eq(keys.session_pk(room_code)) & Key('SK').begins_with('TEAM#')
    filter_expression = Attr('type').eq('TeamRouletteAssignment')
    if team_id is not None:
        filter_expression = filter_expression & Attr('team_id').eq(team_id)
    response = table.query(
        KeyConditionExpression=key_condition,
        FilterExpression=filter_expression,
        ConsistentRead=True,
    )
    return response['Items']


def list_bubble_maps(room_code, team_id=None):
    """Returns every TeamBubbleMap item in a room (not its siblings - roulette
    assignments and progress items all share the TEAM# prefix, so this filters
    on `type` to exclude them). Optionally narrows to one team when team_id
    is passed."""
    table = get_table()
    key_condition = Key('PK').eq(keys.session_pk(room_code)) & Key('SK').begins_with('TEAM#')
    filter_expression = Attr('type').eq('TeamBubbleMap')
    if team_id is not None:
        filter_expression = filter_expression & Attr('team_id').eq(team_id)
    response = table.query(
        KeyConditionExpression=key_condition,
        FilterExpression=filter_expression,
        ConsistentRead=True,
    )
    return response['Items']
