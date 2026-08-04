"""Repository functions for Course items in ContentTable."""
import uuid
from boto3.dynamodb.conditions import Key

from academic.dynamodb.client import get_table, now_iso, build_update_expression
from academic.dynamodb import keys
from academic.dynamodb.career import get_careers_by_ids


def _to_item_fields(raw):
    return {
        'id': raw['id'],
        'career_id': raw['career_id'],
        'faculty_id': raw.get('faculty_id'),
        'name': raw['name'],
        'code': raw.get('code'),
        'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'],
        'updated_at': raw['updated_at'],
    }


def _attach_career_names(courses):
    career_ids = {c['career_id'] for c in courses}
    careers = get_careers_by_ids(career_ids)
    for c in courses:
        career = careers.get(c['career_id'])
        c['career_name'] = career['name'] if career else None
        c['faculty_name'] = career['faculty_name'] if career else None
        if not c.get('faculty_id') and career:
            c['faculty_id'] = career['faculty_id']
    return courses


def get_course(course_id):
    resp = get_table().get_item(Key={'PK': keys.course_pk(course_id), 'SK': keys.metadata_sk()})
    item = resp.get('Item')
    if not item:
        return None
    fields = _to_item_fields(item)
    _attach_career_names([fields])
    return fields


def get_courses_by_ids(ids):
    ids = [str(i) for i in ids]
    if not ids:
        return {}
    table = get_table()
    keys_batch = [{'PK': keys.course_pk(i), 'SK': keys.metadata_sk()} for i in ids]
    result = {}
    for i in range(0, len(keys_batch), 100):
        chunk = keys_batch[i:i + 100]
        resp = table.meta.client.batch_get_item(RequestItems={table.table_name: {'Keys': chunk}})
        for item in resp['Responses'].get(table.table_name, []):
            fields = _to_item_fields(item)
            result[fields['id']] = fields
    _attach_career_names(list(result.values()))
    return result


def list_courses(career_id=None, active_only=None):
    table = get_table()
    if career_id is not None:
        resp = table.query(
            IndexName='GSI1',
            KeyConditionExpression=Key('GSI1PK').eq(keys.course_career_gsi1pk(career_id)),
        )
        items = [_to_item_fields(i) for i in resp['Items']]
    else:
        items = []
        resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                           ExpressionAttributeValues={':type': 'Course'})
        items.extend(resp['Items'])
        while 'LastEvaluatedKey' in resp:
            resp = table.scan(
                FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                ExpressionAttributeValues={':type': 'Course'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
            )
            items.extend(resp['Items'])
        items = [_to_item_fields(i) for i in items]

    if active_only:
        items = [i for i in items if i['is_active']]
    _attach_career_names(items)
    return items


def create_course(*, career_id, name, code=None, is_active=True):
    from academic.dynamodb.career import get_career
    course_id = str(uuid.uuid4())
    now = now_iso()
    career = get_career(career_id)
    item = {
        'PK': keys.course_pk(course_id), 'SK': keys.metadata_sk(), 'type': 'Course',
        'id': course_id, 'career_id': str(career_id),
        'faculty_id': career['faculty_id'] if career else None,
        'name': name, 'code': code, 'is_active': is_active, 'created_at': now, 'updated_at': now,
        'GSI1PK': keys.course_career_gsi1pk(career_id), 'GSI1SK': f'COURSE#{name}',
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return get_course(course_id)


def update_course(course_id, fields):
    from academic.dynamodb.career import get_career
    table = get_table()
    update_fields = dict(fields)
    if 'career_id' in update_fields or 'name' in update_fields:
        current = get_course(course_id)
        career_id = update_fields.get('career_id', current['career_id'] if current else None)
        name = update_fields.get('name', current['name'] if current else '')
        update_fields['GSI1PK'] = keys.course_career_gsi1pk(career_id)
        update_fields['GSI1SK'] = f'COURSE#{name}'
        if 'career_id' in update_fields:
            career = get_career(career_id)
            update_fields['faculty_id'] = career['faculty_id'] if career else None
    expr, names, values = build_update_expression(update_fields)
    table.update_item(
        Key={'PK': keys.course_pk(course_id), 'SK': keys.metadata_sk()},
        UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
    )
    return get_course(course_id)


def find_course(career_id, name):
    for c in list_courses(career_id=career_id):
        if c['name'] == name:
            return c
    return None


def delete_course(course_id):
    # No child entities reference Course by FK -- game_sessions references
    # course_id as an opaque string attribute, not a DynamoDB relationship,
    # so there's nothing to RESTRICT-check here.
    get_table().delete_item(Key={'PK': keys.course_pk(course_id), 'SK': keys.metadata_sk()})
