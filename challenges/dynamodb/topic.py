"""Repository functions for Topic items (+ the TopicFaculty M2M join) in
ContentTable."""
import uuid
from boto3.dynamodb.conditions import Key

from challenges.dynamodb.client import get_table, now_iso, build_update_expression
from challenges.dynamodb import keys


def _to_item_fields(raw):
    return {
        'id': raw['id'], 'name': raw['name'], 'icon': raw.get('icon'),
        'description': raw.get('description'), 'image_url': raw.get('image_url'),
        'category': raw.get('category'), 'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'], 'updated_at': raw['updated_at'],
    }


def get_topic(topic_id):
    resp = get_table().get_item(Key={'PK': keys.topic_pk(topic_id), 'SK': keys.metadata_sk()})
    item = resp.get('Item')
    return _to_item_fields(item) if item else None


def get_topics_by_ids(ids):
    ids = [str(i) for i in ids]
    if not ids:
        return {}
    table = get_table()
    keys_batch = [{'PK': keys.topic_pk(i), 'SK': keys.metadata_sk()} for i in ids]
    result = {}
    for i in range(0, len(keys_batch), 100):
        chunk = keys_batch[i:i + 100]
        resp = table.meta.client.batch_get_item(RequestItems={table.table_name: {'Keys': chunk}})
        for item in resp['Responses'].get(table.table_name, []):
            fields = _to_item_fields(item)
            result[fields['id']] = fields
    return result


def list_topics(active_only=None):
    table = get_table()
    if active_only:
        resp = table.query(IndexName='GSI1', KeyConditionExpression=Key('GSI1PK').eq(keys.topic_active_gsi1pk()))
        return [_to_item_fields(i) for i in resp['Items']]

    items = []
    resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                       ExpressionAttributeValues={':type': 'Topic'})
    items.extend(resp['Items'])
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(
            FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
            ExpressionAttributeValues={':type': 'Topic'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
        )
        items.extend(resp['Items'])
    return [_to_item_fields(i) for i in items]


def list_topics_for_faculty(faculty_id, active_only=None):
    table = get_table()
    resp = table.query(
        IndexName='GSI1', KeyConditionExpression=Key('GSI1PK').eq(keys.topic_faculty_gsi1pk(faculty_id)),
    )
    topic_ids = [i['topic_id'] for i in resp['Items']]
    topics = list(get_topics_by_ids(topic_ids).values())
    if active_only:
        topics = [t for t in topics if t['is_active']]
    return topics


def list_faculty_ids_for_topic(topic_id):
    table = get_table()
    resp = table.query(
        KeyConditionExpression=Key('PK').eq(keys.topic_pk(topic_id)) & Key('SK').begins_with('FACULTY#'),
    )
    return [i['faculty_id'] for i in resp['Items']]


def set_topic_faculties(topic_id, faculty_ids):
    """Replaces the full set of Faculty links for a Topic (matches
    Django's `topic.faculties.set(...)` / PrimaryKeyRelatedField(many=True)
    write semantics)."""
    table = get_table()
    current = set(list_faculty_ids_for_topic(topic_id))
    desired = {str(f) for f in faculty_ids}
    to_add = desired - current
    to_remove = current - desired
    for faculty_id in to_add:
        table.put_item(Item={
            'PK': keys.topic_pk(topic_id), 'SK': keys.topic_faculty_sk(faculty_id), 'type': 'TopicFaculty',
            'topic_id': str(topic_id), 'faculty_id': faculty_id,
            'GSI1PK': keys.topic_faculty_gsi1pk(faculty_id), 'GSI1SK': f'TOPIC#{topic_id}',
        })
    for faculty_id in to_remove:
        table.delete_item(Key={'PK': keys.topic_pk(topic_id), 'SK': keys.topic_faculty_sk(faculty_id)})


def create_topic(*, name, icon=None, description=None, image_url=None, category=None,
                  is_active=True, faculty_ids=None):
    topic_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.topic_pk(topic_id), 'SK': keys.metadata_sk(), 'type': 'Topic',
        'id': topic_id, 'name': name, 'icon': icon, 'description': description,
        'image_url': image_url, 'category': category, 'is_active': is_active,
        'created_at': now, 'updated_at': now,
    }
    if is_active:
        item['GSI1PK'] = keys.topic_active_gsi1pk()
        item['GSI1SK'] = name
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    if faculty_ids:
        set_topic_faculties(topic_id, faculty_ids)
    return get_topic(topic_id)


def update_topic(topic_id, fields):
    table = get_table()
    update_fields = dict(fields)
    faculty_ids = update_fields.pop('faculty_ids', None)
    if 'is_active' in update_fields or 'name' in update_fields:
        current = get_topic(topic_id)
        is_active = update_fields.get('is_active', current['is_active'] if current else True)
        name = update_fields.get('name', current['name'] if current else '')
        update_fields['GSI1PK'] = keys.topic_active_gsi1pk() if is_active else 'TOPIC#INACTIVE'
        update_fields['GSI1SK'] = name
    if update_fields:
        expr, names, values = build_update_expression(update_fields)
        table.update_item(
            Key={'PK': keys.topic_pk(topic_id), 'SK': keys.metadata_sk()},
            UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
        )
    if faculty_ids is not None:
        set_topic_faculties(topic_id, faculty_ids)
    return get_topic(topic_id)
