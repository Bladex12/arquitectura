"""Repository functions for Challenge items in ContentTable. Parented
under its Topic's partition (dominant read: challenges for a topic)."""
import uuid
from boto3.dynamodb.conditions import Key

from challenges.dynamodb.client import get_table, now_iso, build_update_expression
from challenges.dynamodb import keys


def _to_item_fields(raw):
    return {
        'id': raw['id'], 'topic_id': raw['topic_id'], 'title': raw['title'],
        'description': raw.get('description'), 'icon': raw.get('icon'),
        'persona_name': raw.get('persona_name'), 'persona_age': raw.get('persona_age'),
        'persona_story': raw.get('persona_story'), 'persona_image': raw.get('persona_image'),
        'difficulty_level': raw.get('difficulty_level', 'medium'),
        'learning_objectives': raw.get('learning_objectives'),
        'additional_resources': raw.get('additional_resources'),
        'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'], 'updated_at': raw['updated_at'],
    }


def _get_raw_by_id(challenge_id):
    table = get_table()
    resp = table.query(IndexName='GSI1', KeyConditionExpression=Key('GSI1PK').eq(keys.challenge_gsi1pk(challenge_id)))
    items = resp['Items']
    return items[0] if items else None


def get_challenge(challenge_id):
    raw = _get_raw_by_id(challenge_id)
    return _to_item_fields(raw) if raw else None


def get_challenges_by_ids(ids):
    result = {}
    for i in ids:
        item = get_challenge(str(i))
        if item:
            result[item['id']] = item
    return result


def list_challenges_for_topic(topic_id, active_only=None):
    table = get_table()
    resp = table.query(
        KeyConditionExpression=Key('PK').eq(keys.topic_pk(topic_id)) & Key('SK').begins_with('CHALLENGE#'),
    )
    items = [_to_item_fields(i) for i in resp['Items']]
    if active_only:
        items = [i for i in items if i['is_active']]
    return items


def list_challenges(active_only=None):
    table = get_table()
    items = []
    resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                       ExpressionAttributeValues={':type': 'Challenge'})
    items.extend(resp['Items'])
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(
            FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
            ExpressionAttributeValues={':type': 'Challenge'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
        )
        items.extend(resp['Items'])
    items = [_to_item_fields(i) for i in items]
    if active_only:
        items = [i for i in items if i['is_active']]
    return items


def create_challenge(*, topic_id, title, description=None, icon=None, persona_name=None,
                      persona_age=None, persona_story=None, persona_image=None,
                      difficulty_level='medium', learning_objectives=None,
                      additional_resources=None, is_active=True):
    challenge_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.topic_pk(topic_id), 'SK': keys.challenge_sk(challenge_id), 'type': 'Challenge',
        'id': challenge_id, 'topic_id': str(topic_id), 'title': title, 'description': description,
        'icon': icon, 'persona_name': persona_name, 'persona_age': persona_age,
        'persona_story': persona_story, 'persona_image': persona_image,
        'difficulty_level': difficulty_level, 'learning_objectives': learning_objectives,
        'additional_resources': additional_resources, 'is_active': is_active,
        'created_at': now, 'updated_at': now,
        'GSI1PK': keys.challenge_gsi1pk(challenge_id), 'GSI1SK': 'METADATA',
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return get_challenge(challenge_id)


def update_challenge(challenge_id, fields):
    table = get_table()
    raw = _get_raw_by_id(challenge_id)
    if raw is None:
        raise ValueError(f'Challenge {challenge_id} does not exist')

    if 'topic_id' in fields and str(fields['topic_id']) != raw['topic_id']:
        # Moving to a different Topic changes PK -- delete/put pair.
        current = _to_item_fields(raw)
        merged = {**current, **fields}
        new_item = {
            'PK': keys.topic_pk(merged['topic_id']), 'SK': keys.challenge_sk(challenge_id), 'type': 'Challenge',
            'id': challenge_id, 'topic_id': str(merged['topic_id']), 'title': merged['title'],
            'description': merged.get('description'), 'icon': merged.get('icon'),
            'persona_name': merged.get('persona_name'), 'persona_age': merged.get('persona_age'),
            'persona_story': merged.get('persona_story'), 'persona_image': merged.get('persona_image'),
            'difficulty_level': merged.get('difficulty_level', 'medium'),
            'learning_objectives': merged.get('learning_objectives'),
            'additional_resources': merged.get('additional_resources'),
            'is_active': merged.get('is_active', True),
            'created_at': current['created_at'], 'updated_at': now_iso(),
            'GSI1PK': keys.challenge_gsi1pk(challenge_id), 'GSI1SK': 'METADATA',
        }
        new_item = {k: v for k, v in new_item.items() if v is not None}
        table.meta.client.transact_write_items(TransactItems=[
            {'Delete': {'TableName': table.table_name, 'Key': {'PK': raw['PK'], 'SK': raw['SK']}}},
            {'Put': {'TableName': table.table_name, 'Item': new_item}},
        ])
        return get_challenge(challenge_id)

    expr, names, values = build_update_expression(fields)
    table.update_item(
        Key={'PK': raw['PK'], 'SK': raw['SK']},
        UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
    )
    return get_challenge(challenge_id)
