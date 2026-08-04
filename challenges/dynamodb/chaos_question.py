"""Repository functions for ChaosQuestion items in ContentTable. Flat
catalog -- all-active scan, same shape as anagram_word.py."""
import uuid

from challenges.dynamodb.client import get_table, now_iso, build_update_expression
from challenges.dynamodb import keys


def _to_item_fields(raw):
    return {
        'id': raw['id'], 'question': raw['question'], 'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'], 'updated_at': raw['updated_at'],
    }


def get_chaos_question(question_id):
    resp = get_table().get_item(Key={'PK': keys.chaos_question_pk(question_id), 'SK': keys.metadata_sk()})
    item = resp.get('Item')
    return _to_item_fields(item) if item else None


def list_chaos_questions(active_only=None):
    table = get_table()
    items = []
    resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                       ExpressionAttributeValues={':type': 'ChaosQuestion'})
    items.extend(resp['Items'])
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(
            FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
            ExpressionAttributeValues={':type': 'ChaosQuestion'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
        )
        items.extend(resp['Items'])
    items = [_to_item_fields(i) for i in items]
    if active_only:
        items = [i for i in items if i['is_active']]
    items.sort(key=lambda i: i['created_at'], reverse=True)
    return items


def create_chaos_question(*, question, is_active=True):
    question_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.chaos_question_pk(question_id), 'SK': keys.metadata_sk(), 'type': 'ChaosQuestion',
        'id': question_id, 'question': question, 'is_active': is_active,
        'created_at': now, 'updated_at': now,
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return get_chaos_question(question_id)


def update_chaos_question(question_id, fields):
    table = get_table()
    expr, names, values = build_update_expression(fields)
    table.update_item(
        Key={'PK': keys.chaos_question_pk(question_id), 'SK': keys.metadata_sk()},
        UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
    )
    return get_chaos_question(question_id)
