"""Repository functions for Activity items in ContentTable.

Activity is parented under its Stage's partition (PK=STAGE#<stage_id>,
SK=ACTIVITY#<order_number padded>#<id>) so "activities for a stage, in
order" is a single Query with no application-side sort. That means
changing an Activity's stage or order_number changes its DynamoDB key --
update_activity() below handles that as a delete-old/put-new pair.
"""
import uuid
from boto3.dynamodb.conditions import Key

from challenges.dynamodb.client import get_table, now_iso, build_update_expression
from challenges.dynamodb import keys


def _to_item_fields(raw):
    return {
        'id': raw['id'], 'stage_id': raw['stage_id'], 'activity_type_id': raw['activity_type_id'],
        'name': raw['name'], 'description': raw.get('description'),
        'order_number': int(raw['order_number']), 'timer_duration': raw.get('timer_duration'),
        'config_data': raw.get('config_data'), 'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'], 'updated_at': raw['updated_at'],
    }


def _get_raw_by_id(activity_id):
    table = get_table()
    resp = table.query(IndexName='GSI1', KeyConditionExpression=Key('GSI1PK').eq(keys.activity_gsi1pk(activity_id)))
    items = resp['Items']
    return items[0] if items else None


def get_activity(activity_id):
    raw = _get_raw_by_id(activity_id)
    return _to_item_fields(raw) if raw else None


def get_activities_by_ids(ids):
    result = {}
    for i in ids:
        item = get_activity(str(i))
        if item:
            result[item['id']] = item
    return result


def list_activities_for_stage(stage_id, active_only=None):
    table = get_table()
    resp = table.query(
        KeyConditionExpression=Key('PK').eq(keys.stage_pk(stage_id)) & Key('SK').begins_with('ACTIVITY#'),
        FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
        ExpressionAttributeValues={':type': 'Activity'},
    )
    items = [_to_item_fields(i) for i in resp['Items']]
    if active_only:
        items = [i for i in items if i['is_active']]
    return items


def list_activities(active_only=None):
    """All activities across every stage -- filtered scan, acceptable at
    this app's scale (same justification as game_sessions' list_tablets)."""
    table = get_table()
    items = []
    resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                       ExpressionAttributeValues={':type': 'Activity'})
    items.extend(resp['Items'])
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(
            FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
            ExpressionAttributeValues={':type': 'Activity'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
        )
        items.extend(resp['Items'])
    items = [_to_item_fields(i) for i in items]
    if active_only:
        items = [i for i in items if i['is_active']]
    return items


def find_activity(stage_id, order_number):
    for a in list_activities_for_stage(stage_id):
        if a['order_number'] == order_number:
            return a
    return None


def _build_item(activity_id, stage_id, order_number, fields, created_at):
    now = now_iso()
    item = {
        'PK': keys.stage_pk(stage_id), 'SK': keys.activity_sk(order_number, activity_id), 'type': 'Activity',
        'id': activity_id, 'stage_id': str(stage_id), 'activity_type_id': str(fields['activity_type_id']),
        'name': fields['name'], 'description': fields.get('description'), 'order_number': order_number,
        'timer_duration': fields.get('timer_duration'), 'config_data': fields.get('config_data'),
        'is_active': fields.get('is_active', True), 'created_at': created_at, 'updated_at': now,
        'GSI1PK': keys.activity_gsi1pk(activity_id), 'GSI1SK': 'METADATA',
    }
    return {k: v for k, v in item.items() if v is not None}


def create_activity(*, stage_id, activity_type_id, name, order_number, description=None,
                     timer_duration=None, config_data=None, is_active=True):
    activity_id = str(uuid.uuid4())
    now = now_iso()
    item = _build_item(activity_id, stage_id, order_number, {
        'activity_type_id': activity_type_id, 'name': name, 'description': description,
        'timer_duration': timer_duration, 'config_data': config_data, 'is_active': is_active,
    }, now)
    get_table().put_item(Item=item)
    return get_activity(activity_id)


def update_activity(activity_id, fields):
    table = get_table()
    raw = _get_raw_by_id(activity_id)
    if raw is None:
        raise ValueError(f'Activity {activity_id} does not exist')
    current = _to_item_fields(raw)
    merged = {**current, **fields}
    new_stage_id = str(merged['stage_id'])
    new_order_number = int(merged['order_number'])
    moved = new_stage_id != current['stage_id'] or new_order_number != current['order_number']

    if not moved:
        update_fields = dict(fields)
        expr, names, values = build_update_expression(update_fields)
        table.update_item(
            Key={'PK': raw['PK'], 'SK': raw['SK']},
            UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
        )
        return get_activity(activity_id)

    new_item = _build_item(activity_id, new_stage_id, new_order_number, merged, current['created_at'])
    table.meta.client.transact_write_items(TransactItems=[
        {'Delete': {'TableName': table.table_name, 'Key': {'PK': raw['PK'], 'SK': raw['SK']}}},
        {'Put': {'TableName': table.table_name, 'Item': new_item}},
    ])
    return get_activity(activity_id)


def delete_activity(activity_id):
    from challenges.dynamodb import word_search_option as wso_repo
    raw = _get_raw_by_id(activity_id)
    if raw is None:
        return
    # No cascade in DynamoDB -- explicitly delete WordSearchOption children
    # first (today's on_delete=CASCADE equivalent).
    for option in wso_repo.list_word_search_options_for_activity(activity_id):
        wso_repo.delete_word_search_option(option['id'], stage_id=raw['stage_id'],
                                            order_number=int(raw['order_number']), activity_id=activity_id)
    get_table().delete_item(Key={'PK': raw['PK'], 'SK': raw['SK']})
