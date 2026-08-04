"""Repository functions for Career items in ContentTable."""
import uuid
from boto3.dynamodb.conditions import Key

from academic.dynamodb.client import get_table, now_iso, build_update_expression
from academic.dynamodb import keys
from academic.dynamodb.faculty import get_faculties_by_ids


def _to_item_fields(raw):
    return {
        'id': raw['id'],
        'faculty_id': raw['faculty_id'],
        'name': raw['name'],
        'code': raw.get('code'),
        'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'],
        'updated_at': raw['updated_at'],
    }


def _attach_faculty_names(careers):
    faculty_ids = {c['faculty_id'] for c in careers}
    faculties = get_faculties_by_ids(faculty_ids)
    for c in careers:
        faculty = faculties.get(c['faculty_id'])
        c['faculty_name'] = faculty['name'] if faculty else None
    return careers


def get_career(career_id):
    resp = get_table().get_item(Key={'PK': keys.career_pk(career_id), 'SK': keys.metadata_sk()})
    item = resp.get('Item')
    if not item:
        return None
    fields = _to_item_fields(item)
    _attach_faculty_names([fields])
    return fields


def get_careers_by_ids(ids):
    ids = [str(i) for i in ids]
    if not ids:
        return {}
    table = get_table()
    keys_batch = [{'PK': keys.career_pk(i), 'SK': keys.metadata_sk()} for i in ids]
    result = {}
    for i in range(0, len(keys_batch), 100):
        chunk = keys_batch[i:i + 100]
        resp = table.meta.client.batch_get_item(RequestItems={table.table_name: {'Keys': chunk}})
        for item in resp['Responses'].get(table.table_name, []):
            fields = _to_item_fields(item)
            result[fields['id']] = fields
    _attach_faculty_names(list(result.values()))
    return result


def list_careers(faculty_id=None, active_only=None):
    table = get_table()
    if faculty_id is not None:
        resp = table.query(
            IndexName='GSI1',
            KeyConditionExpression=Key('GSI1PK').eq(keys.career_faculty_gsi1pk(faculty_id)),
        )
        items = [_to_item_fields(i) for i in resp['Items']]
    else:
        items = []
        resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                           ExpressionAttributeValues={':type': 'Career'})
        items.extend(resp['Items'])
        while 'LastEvaluatedKey' in resp:
            resp = table.scan(
                FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                ExpressionAttributeValues={':type': 'Career'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
            )
            items.extend(resp['Items'])
        items = [_to_item_fields(i) for i in items]

    if active_only:
        items = [i for i in items if i['is_active']]
    _attach_faculty_names(items)
    return items


def create_career(*, faculty_id, name, code=None, is_active=True):
    career_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.career_pk(career_id), 'SK': keys.metadata_sk(), 'type': 'Career',
        'id': career_id, 'faculty_id': str(faculty_id), 'name': name, 'code': code,
        'is_active': is_active, 'created_at': now, 'updated_at': now,
        'GSI1PK': keys.career_faculty_gsi1pk(faculty_id), 'GSI1SK': f'CAREER#{name}',
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return get_career(career_id)


def update_career(career_id, fields):
    table = get_table()
    update_fields = dict(fields)
    if 'faculty_id' in update_fields or 'name' in update_fields:
        current = get_career(career_id)
        faculty_id = update_fields.get('faculty_id', current['faculty_id'] if current else None)
        name = update_fields.get('name', current['name'] if current else '')
        update_fields['GSI1PK'] = keys.career_faculty_gsi1pk(faculty_id)
        update_fields['GSI1SK'] = f'CAREER#{name}'
    expr, names, values = build_update_expression(update_fields)
    table.update_item(
        Key={'PK': keys.career_pk(career_id), 'SK': keys.metadata_sk()},
        UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
    )
    return get_career(career_id)


def find_career(faculty_id, name):
    for c in list_careers(faculty_id=faculty_id):
        if c['name'] == name:
            return c
    return None


def has_courses(career_id):
    table = get_table()
    resp = table.query(
        IndexName='GSI1',
        KeyConditionExpression=Key('GSI1PK').eq(keys.course_career_gsi1pk(career_id)),
        Limit=1,
    )
    return len(resp['Items']) > 0


def delete_career(career_id):
    if has_courses(career_id):
        raise ValueError(f'Cannot delete Career {career_id}: it has Course children (RESTRICT)')
    get_table().delete_item(Key={'PK': keys.career_pk(career_id), 'SK': keys.metadata_sk()})
