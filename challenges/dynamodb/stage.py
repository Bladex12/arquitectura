"""Repository functions for Stage items in ContentTable."""
import uuid
from boto3.dynamodb.conditions import Key

from challenges.dynamodb.client import get_table, now_iso, build_update_expression
from challenges.dynamodb import keys


def _to_item_fields(raw):
    return {
        'id': raw['id'], 'number': int(raw['number']), 'name': raw['name'],
        'description': raw.get('description'), 'objective': raw.get('objective'),
        'estimated_duration': raw.get('estimated_duration'),
        'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'], 'updated_at': raw['updated_at'],
    }


def get_stage(stage_id):
    resp = get_table().get_item(Key={'PK': keys.stage_pk(stage_id), 'SK': keys.metadata_sk()})
    item = resp.get('Item')
    return _to_item_fields(item) if item else None


def get_stages_by_ids(ids):
    ids = [str(i) for i in ids]
    if not ids:
        return {}
    table = get_table()
    keys_batch = [{'PK': keys.stage_pk(i), 'SK': keys.metadata_sk()} for i in ids]
    result = {}
    for i in range(0, len(keys_batch), 100):
        chunk = keys_batch[i:i + 100]
        resp = table.meta.client.batch_get_item(RequestItems={table.table_name: {'Keys': chunk}})
        for item in resp['Responses'].get(table.table_name, []):
            fields = _to_item_fields(item)
            result[fields['id']] = fields
    return result


def list_stages(active_only=None):
    table = get_table()
    resp = table.query(IndexName='GSI1', KeyConditionExpression=Key('GSI1PK').eq(keys.stage_all_gsi1pk()))
    items = [_to_item_fields(i) for i in resp['Items']]
    if active_only:
        items = [i for i in items if i['is_active']]
    return items


def find_stage_by_number(number, active_only=None):
    for s in list_stages(active_only=active_only):
        if s['number'] == number:
            return s
    return None


def create_stage(*, number, name, description=None, objective=None, estimated_duration=None, is_active=True):
    stage_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.stage_pk(stage_id), 'SK': keys.metadata_sk(), 'type': 'Stage',
        'id': stage_id, 'number': number, 'name': name, 'description': description,
        'objective': objective, 'estimated_duration': estimated_duration, 'is_active': is_active,
        'created_at': now, 'updated_at': now,
        'GSI1PK': keys.stage_all_gsi1pk(), 'GSI1SK': keys.pad(number),
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return get_stage(stage_id)


def update_stage(stage_id, fields):
    table = get_table()
    update_fields = dict(fields)
    if 'number' in update_fields:
        update_fields['GSI1PK'] = keys.stage_all_gsi1pk()
        update_fields['GSI1SK'] = keys.pad(update_fields['number'])
    expr, names, values = build_update_expression(update_fields)
    table.update_item(
        Key={'PK': keys.stage_pk(stage_id), 'SK': keys.metadata_sk()},
        UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
    )
    return get_stage(stage_id)
