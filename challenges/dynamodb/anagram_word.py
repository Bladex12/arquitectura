"""Repository functions for AnagramWord items in ContentTable. Flat
catalog -- get_anagram_data() needs *all* active words to random.sample()
from, so a filtered scan is the right shape here, not a niche fallback."""
import random
import uuid

from challenges.dynamodb.client import get_table, now_iso, build_update_expression
from challenges.dynamodb import keys


def _scramble_word(word):
    letters = list(word.upper())
    random.shuffle(letters)
    return ''.join(letters)


def _to_item_fields(raw):
    return {
        'id': raw['id'], 'word': raw['word'], 'scrambled_word': raw.get('scrambled_word'),
        'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'], 'updated_at': raw['updated_at'],
    }


def get_anagram_word(word_id):
    resp = get_table().get_item(Key={'PK': keys.anagram_word_pk(word_id), 'SK': keys.metadata_sk()})
    item = resp.get('Item')
    return _to_item_fields(item) if item else None


def list_anagram_words(active_only=None):
    table = get_table()
    items = []
    resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                       ExpressionAttributeValues={':type': 'AnagramWord'})
    items.extend(resp['Items'])
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(
            FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
            ExpressionAttributeValues={':type': 'AnagramWord'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
        )
        items.extend(resp['Items'])
    items = [_to_item_fields(i) for i in items]
    if active_only:
        items = [i for i in items if i['is_active']]
    items.sort(key=lambda i: i['word'])
    return items


def create_anagram_word(*, word, is_active=True):
    word_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.anagram_word_pk(word_id), 'SK': keys.metadata_sk(), 'type': 'AnagramWord',
        'id': word_id, 'word': word, 'scrambled_word': _scramble_word(word), 'is_active': is_active,
        'created_at': now, 'updated_at': now,
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return get_anagram_word(word_id)


def update_anagram_word(word_id, fields):
    table = get_table()
    update_fields = dict(fields)
    if 'word' in update_fields:
        current = get_anagram_word(word_id)
        if not current or current['word'] != update_fields['word']:
            update_fields['scrambled_word'] = _scramble_word(update_fields['word'])
    expr, names, values = build_update_expression(update_fields)
    table.update_item(
        Key={'PK': keys.anagram_word_pk(word_id), 'SK': keys.metadata_sk()},
        UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
    )
    return get_anagram_word(word_id)
