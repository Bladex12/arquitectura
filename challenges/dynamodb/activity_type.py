"""Repository functions for ActivityType items in ContentTable. Tiny
catalog (a handful of rows) -- filtered scan is fine, no GSI."""
import uuid

from challenges.dynamodb.client import get_table, now_iso, build_update_expression
from challenges.dynamodb import keys


def _to_item_fields(raw):
    return {
        'id': raw['id'], 'code': raw['code'], 'name': raw['name'],
        'description': raw.get('description'), 'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'], 'updated_at': raw['updated_at'],
    }


def get_activity_type(activity_type_id):
    resp = get_table().get_item(Key={'PK': keys.activity_type_pk(activity_type_id), 'SK': keys.metadata_sk()})
    item = resp.get('Item')
    return _to_item_fields(item) if item else None


def get_activity_types_by_ids(ids):
    ids = [str(i) for i in ids]
    if not ids:
        return {}
    table = get_table()
    keys_batch = [{'PK': keys.activity_type_pk(i), 'SK': keys.metadata_sk()} for i in ids]
    result = {}
    for i in range(0, len(keys_batch), 100):
        chunk = keys_batch[i:i + 100]
        resp = table.meta.client.batch_get_item(RequestItems={table.table_name: {'Keys': chunk}})
        for item in resp['Responses'].get(table.table_name, []):
            fields = _to_item_fields(item)
            result[fields['id']] = fields
    return result


def _scan_all():
    table = get_table()
    items = []
    resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                       ExpressionAttributeValues={':type': 'ActivityType'})
    items.extend(resp['Items'])
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(
            FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
            ExpressionAttributeValues={':type': 'ActivityType'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
        )
        items.extend(resp['Items'])
    return items


def list_activity_types(active_only=None):
    items = [_to_item_fields(i) for i in _scan_all()]
    if active_only:
        items = [i for i in items if i['is_active']]
    return items


def find_activity_type_by_code(code):
    for t in list_activity_types():
        if t['code'] == code:
            return t
    return None


def create_activity_type(*, code, name, description=None, is_active=True):
    activity_type_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.activity_type_pk(activity_type_id), 'SK': keys.metadata_sk(), 'type': 'ActivityType',
        'id': activity_type_id, 'code': code, 'name': name, 'description': description,
        'is_active': is_active, 'created_at': now, 'updated_at': now,
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return get_activity_type(activity_type_id)


def update_activity_type(activity_type_id, fields):
    table = get_table()
    expr, names, values = build_update_expression(fields)
    table.update_item(
        Key={'PK': keys.activity_type_pk(activity_type_id), 'SK': keys.metadata_sk()},
        UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
    )
    return get_activity_type(activity_type_id)
