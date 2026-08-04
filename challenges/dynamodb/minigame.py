"""Repository functions for Minigame items in ContentTable. Flat
catalog -- filtered scan is fine at this scale."""
import uuid

from challenges.dynamodb.client import get_table, now_iso, build_update_expression
from challenges.dynamodb import keys


def _to_item_fields(raw):
    return {
        'id': raw['id'], 'name': raw['name'], 'type': raw['minigame_type'],
        'config': raw.get('config'), 'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'], 'updated_at': raw['updated_at'],
    }


def get_minigame(minigame_id):
    resp = get_table().get_item(Key={'PK': keys.minigame_pk(minigame_id), 'SK': keys.metadata_sk()})
    item = resp.get('Item')
    return _to_item_fields(item) if item else None


def list_minigames(active_only=None):
    table = get_table()
    items = []
    resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                       ExpressionAttributeValues={':type': 'Minigame'})
    items.extend(resp['Items'])
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(
            FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
            ExpressionAttributeValues={':type': 'Minigame'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
        )
        items.extend(resp['Items'])
    items = [_to_item_fields(i) for i in items]
    if active_only:
        items = [i for i in items if i['is_active']]
    return items


def create_minigame(*, name, type, config=None, is_active=True):
    minigame_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.minigame_pk(minigame_id), 'SK': keys.metadata_sk(), 'type': 'Minigame',
        'id': minigame_id, 'name': name, 'minigame_type': type, 'config': config, 'is_active': is_active,
        'created_at': now, 'updated_at': now,
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return get_minigame(minigame_id)


def update_minigame(minigame_id, fields):
    table = get_table()
    update_fields = dict(fields)
    if 'type' in update_fields:
        update_fields['minigame_type'] = update_fields.pop('type')
    expr, names, values = build_update_expression(update_fields)
    table.update_item(
        Key={'PK': keys.minigame_pk(minigame_id), 'SK': keys.metadata_sk()},
        UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
    )
    return get_minigame(minigame_id)
