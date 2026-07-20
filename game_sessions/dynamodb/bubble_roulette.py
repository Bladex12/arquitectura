"""TeamBubbleMap and TeamRouletteAssignment repository."""
from datetime import datetime, timezone

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import build_update_expression, get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def upsert_bubble_map(room_code, team_id, stage_id, map_data):
    """Creates or fully overwrites a TeamBubbleMap item - the frontend
    always saves the whole map_data blob together, matching the current
    Django model's single JSONField."""
    now = _now_iso()
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
    )
    return response.get('Item')


def create_roulette_assignment(room_code, team_id, stage_id, roulette_challenge_id, token_reward=0):
    """Creates a new TeamRouletteAssignment item in 'assigned' status."""
    now = _now_iso()
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
    )
    return response.get('Item')


def update_roulette_assignment(room_code, team_id, stage_id, **fields):
    """Partial update - pass any subset of status/token_reward/
    accepted_at/rejected_at/completed_at/validated_by_id as keyword
    arguments."""
    table = get_table()
    update_expression, names, values = build_update_expression(fields)
    response = table.update_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.roulette_sk(team_id, stage_id)},
        UpdateExpression=update_expression,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues='ALL_NEW',
    )
    return response['Attributes']
