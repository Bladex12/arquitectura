"""Repository functions for WordSearchOption items in ContentTable.
Co-located under its parent Activity's Stage partition; keyed off the
Activity's stage_id/order_number at creation time."""
import uuid
from boto3.dynamodb.conditions import Key

from challenges.dynamodb.client import get_table, now_iso, build_update_expression
from challenges.dynamodb import keys


def _to_item_fields(raw):
    return {
        'id': raw['id'], 'activity_id': raw['activity_id'], 'name': raw['name'],
        'words': raw.get('words'), 'grid': raw.get('grid'), 'word_positions': raw.get('word_positions'),
        'seed': raw.get('seed'), 'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'], 'updated_at': raw['updated_at'],
    }


def list_word_search_options_for_activity(activity_id, active_only=None):
    table = get_table()
    resp = table.query(
        IndexName='GSI1',
        KeyConditionExpression=Key('GSI1PK').eq(keys.word_search_option_activity_gsi1pk(activity_id)),
    )
    items = [_to_item_fields(i) for i in resp['Items']]
    if active_only:
        items = [i for i in items if i['is_active']]
    return items


def get_word_search_option(option_id, activity_id):
    for o in list_word_search_options_for_activity(activity_id):
        if o['id'] == option_id:
            return o
    return None


def create_word_search_option(*, activity_id, name, words, grid=None, word_positions=None,
                               seed=None, is_active=True):
    from challenges.dynamodb.activity import _get_raw_by_id
    activity_raw = _get_raw_by_id(activity_id)
    if activity_raw is None:
        raise ValueError(f'Activity {activity_id} does not exist')
    stage_id = activity_raw['stage_id']
    order_number = int(activity_raw['order_number'])

    option_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.stage_pk(stage_id),
        'SK': keys.word_search_option_sk(order_number, activity_id, option_id),
        'type': 'WordSearchOption',
        'id': option_id, 'activity_id': str(activity_id), 'name': name, 'words': words,
        'grid': grid, 'word_positions': word_positions, 'seed': seed, 'is_active': is_active,
        'created_at': now, 'updated_at': now,
        'GSI1PK': keys.word_search_option_activity_gsi1pk(activity_id), 'GSI1SK': name,
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return get_word_search_option(option_id, activity_id)


def delete_word_search_option(option_id, *, stage_id, order_number, activity_id):
    sk = keys.word_search_option_sk(order_number, activity_id, option_id)
    get_table().delete_item(Key={'PK': keys.stage_pk(stage_id), 'SK': sk})
