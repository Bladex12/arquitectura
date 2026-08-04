"""Repository functions for Faculty items in ContentTable."""
import uuid
from boto3.dynamodb.conditions import Key

from academic.dynamodb.client import get_table, now_iso, build_update_expression
from academic.dynamodb import keys


def _to_item_fields(raw):
    return {
        'id': raw['id'],
        'name': raw['name'],
        'code': raw.get('code'),
        'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'],
        'updated_at': raw['updated_at'],
    }


def get_faculty(faculty_id):
    resp = get_table().get_item(Key={'PK': keys.faculty_pk(faculty_id), 'SK': keys.metadata_sk()})
    item = resp.get('Item')
    return _to_item_fields(item) if item else None


def get_faculties_by_ids(ids):
    ids = [str(i) for i in ids]
    if not ids:
        return {}
    table = get_table()
    keys_batch = [{'PK': keys.faculty_pk(i), 'SK': keys.metadata_sk()} for i in ids]
    result = {}
    # BatchGetItem caps at 100 keys per call.
    for i in range(0, len(keys_batch), 100):
        chunk = keys_batch[i:i + 100]
        resp = table.meta.client.batch_get_item(RequestItems={table.table_name: {'Keys': chunk}})
        for item in resp['Responses'].get(table.table_name, []):
            fields = _to_item_fields(item)
            result[fields['id']] = fields
    return result


def list_faculties(active_only=None):
    table = get_table()
    if active_only:
        resp = table.query(
            IndexName='GSI1',
            KeyConditionExpression=Key('GSI1PK').eq(keys.faculty_active_gsi1pk()),
        )
        return [_to_item_fields(item) for item in resp['Items']]

    items = []
    resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                       ExpressionAttributeValues={':type': 'Faculty'})
    items.extend(resp['Items'])
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(
            FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
            ExpressionAttributeValues={':type': 'Faculty'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
        )
        items.extend(resp['Items'])
    return [_to_item_fields(item) for item in items]


def create_faculty(*, name, code=None, is_active=True):
    # Legacy rows keep their backfilled MySQL integer id (see the backfill
    # script); freshly created rows get a UUID4 like users/game_sessions'
    # convention -- both are just opaque strings to every consumer.
    faculty_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.faculty_pk(faculty_id), 'SK': keys.metadata_sk(), 'type': 'Faculty',
        'id': faculty_id, 'name': name, 'code': code, 'is_active': is_active,
        'created_at': now, 'updated_at': now,
        'GSI1PK': keys.faculty_active_gsi1pk() if is_active else 'FACULTY#INACTIVE',
        'GSI1SK': name,
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return _to_item_fields(item)


def update_faculty(faculty_id, fields):
    table = get_table()
    update_fields = dict(fields)
    if 'is_active' in update_fields or 'name' in update_fields:
        current = get_faculty(faculty_id)
        is_active = update_fields.get('is_active', current['is_active'] if current else True)
        name = update_fields.get('name', current['name'] if current else '')
        update_fields['GSI1PK'] = keys.faculty_active_gsi1pk() if is_active else 'FACULTY#INACTIVE'
        update_fields['GSI1SK'] = name
    expr, names, values = build_update_expression(update_fields)
    table.update_item(
        Key={'PK': keys.faculty_pk(faculty_id), 'SK': keys.metadata_sk()},
        UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
    )
    return get_faculty(faculty_id)


def find_faculty_by_name(name):
    for f in list_faculties():
        if f['name'] == name:
            return f
    return None


def has_careers(faculty_id):
    table = get_table()
    resp = table.query(
        IndexName='GSI1',
        KeyConditionExpression=Key('GSI1PK').eq(keys.career_faculty_gsi1pk(faculty_id)),
        Limit=1,
    )
    return len(resp['Items']) > 0


def delete_faculty(faculty_id):
    if has_careers(faculty_id):
        raise ValueError(f'Cannot delete Faculty {faculty_id}: it has Career children (RESTRICT)')
    get_table().delete_item(Key={'PK': keys.faculty_pk(faculty_id), 'SK': keys.metadata_sk()})
