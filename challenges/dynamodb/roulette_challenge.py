"""Repository functions for RouletteChallenge items in ContentTable.
Flat catalog, no FK -- filtered scan is fine at this scale."""
import uuid

from challenges.dynamodb.client import get_table, now_iso, build_update_expression
from challenges.dynamodb import keys


def _to_item_fields(raw):
    return {
        'id': raw['id'], 'description': raw['description'], 'challenge_type': raw['challenge_type'],
        'difficulty_estimated': raw.get('difficulty_estimated', 5),
        'token_reward_min': raw.get('token_reward_min', 0), 'token_reward_max': raw.get('token_reward_max', 0),
        'stages_applicable': raw.get('stages_applicable'), 'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'], 'updated_at': raw['updated_at'],
    }


def get_roulette_challenge(roulette_id):
    resp = get_table().get_item(Key={'PK': keys.roulette_pk(roulette_id), 'SK': keys.metadata_sk()})
    item = resp.get('Item')
    return _to_item_fields(item) if item else None


def list_roulette_challenges(active_only=None):
    table = get_table()
    items = []
    resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                       ExpressionAttributeValues={':type': 'RouletteChallenge'})
    items.extend(resp['Items'])
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(
            FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
            ExpressionAttributeValues={':type': 'RouletteChallenge'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
        )
        items.extend(resp['Items'])
    items = [_to_item_fields(i) for i in items]
    if active_only:
        items = [i for i in items if i['is_active']]
    return items


def create_roulette_challenge(*, description, challenge_type, difficulty_estimated=5,
                               token_reward_min=0, token_reward_max=0, stages_applicable=None, is_active=True):
    roulette_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.roulette_pk(roulette_id), 'SK': keys.metadata_sk(), 'type': 'RouletteChallenge',
        'id': roulette_id, 'description': description, 'challenge_type': challenge_type,
        'difficulty_estimated': difficulty_estimated, 'token_reward_min': token_reward_min,
        'token_reward_max': token_reward_max, 'stages_applicable': stages_applicable, 'is_active': is_active,
        'created_at': now, 'updated_at': now,
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return get_roulette_challenge(roulette_id)


def update_roulette_challenge(roulette_id, fields):
    table = get_table()
    expr, names, values = build_update_expression(fields)
    table.update_item(
        Key={'PK': keys.roulette_pk(roulette_id), 'SK': keys.metadata_sk()},
        UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
    )
    return get_roulette_challenge(roulette_id)
