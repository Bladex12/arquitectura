"""Repository functions for LearningObjective items in ContentTable.
Parented under its Stage's partition, with a literal STAGE#NONE bucket
for the SET_NULL case."""
import uuid
from boto3.dynamodb.conditions import Key

from challenges.dynamodb.client import get_table, now_iso, build_update_expression
from challenges.dynamodb import keys


def _to_item_fields(raw):
    return {
        'id': raw['id'], 'stage_id': raw.get('stage_id'), 'title': raw['title'],
        'description': raw.get('description'), 'evaluation_criteria': raw.get('evaluation_criteria'),
        'pedagogical_recommendations': raw.get('pedagogical_recommendations'),
        'estimated_time': raw.get('estimated_time'), 'associated_resources': raw.get('associated_resources'),
        'is_active': raw.get('is_active', True),
        'created_at': raw['created_at'], 'updated_at': raw['updated_at'],
    }


def _get_raw_by_id(objective_id):
    table = get_table()
    resp = table.query(
        IndexName='GSI1', KeyConditionExpression=Key('GSI1PK').eq(keys.learning_objective_gsi1pk(objective_id)),
    )
    items = resp['Items']
    return items[0] if items else None


def get_learning_objective(objective_id):
    raw = _get_raw_by_id(objective_id)
    return _to_item_fields(raw) if raw else None


def list_learning_objectives_for_stage(stage_id, active_only=None):
    table = get_table()
    resp = table.query(
        KeyConditionExpression=Key('PK').eq(keys.learning_objective_stage_pk(stage_id))
        & Key('SK').begins_with('LEARNINGOBJ#'),
    )
    items = [_to_item_fields(i) for i in resp['Items']]
    if active_only:
        items = [i for i in items if i['is_active']]
    return items


def list_learning_objectives(active_only=None):
    table = get_table()
    items = []
    resp = table.scan(FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
                       ExpressionAttributeValues={':type': 'LearningObjective'})
    items.extend(resp['Items'])
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(
            FilterExpression='#t = :type', ExpressionAttributeNames={'#t': 'type'},
            ExpressionAttributeValues={':type': 'LearningObjective'}, ExclusiveStartKey=resp['LastEvaluatedKey'],
        )
        items.extend(resp['Items'])
    items = [_to_item_fields(i) for i in items]
    if active_only:
        items = [i for i in items if i['is_active']]
    return items


def create_learning_objective(*, stage_id=None, title, description=None, evaluation_criteria=None,
                               pedagogical_recommendations=None, estimated_time=None,
                               associated_resources=None, is_active=True):
    objective_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.learning_objective_stage_pk(stage_id), 'SK': keys.learning_objective_sk(objective_id),
        'type': 'LearningObjective',
        'id': objective_id, 'stage_id': str(stage_id) if stage_id else None, 'title': title,
        'description': description, 'evaluation_criteria': evaluation_criteria,
        'pedagogical_recommendations': pedagogical_recommendations, 'estimated_time': estimated_time,
        'associated_resources': associated_resources, 'is_active': is_active,
        'created_at': now, 'updated_at': now,
        'GSI1PK': keys.learning_objective_gsi1pk(objective_id), 'GSI1SK': 'METADATA',
    }
    get_table().put_item(Item={k: v for k, v in item.items() if v is not None})
    return get_learning_objective(objective_id)


def update_learning_objective(objective_id, fields):
    table = get_table()
    raw = _get_raw_by_id(objective_id)
    if raw is None:
        raise ValueError(f'LearningObjective {objective_id} does not exist')

    if 'stage_id' in fields and str(fields.get('stage_id')) != raw.get('stage_id'):
        current = _to_item_fields(raw)
        merged = {**current, **fields}
        new_item = {
            'PK': keys.learning_objective_stage_pk(merged['stage_id']),
            'SK': keys.learning_objective_sk(objective_id), 'type': 'LearningObjective',
            'id': objective_id, 'stage_id': str(merged['stage_id']) if merged['stage_id'] else None,
            'title': merged['title'], 'description': merged.get('description'),
            'evaluation_criteria': merged.get('evaluation_criteria'),
            'pedagogical_recommendations': merged.get('pedagogical_recommendations'),
            'estimated_time': merged.get('estimated_time'),
            'associated_resources': merged.get('associated_resources'),
            'is_active': merged.get('is_active', True),
            'created_at': current['created_at'], 'updated_at': now_iso(),
            'GSI1PK': keys.learning_objective_gsi1pk(objective_id), 'GSI1SK': 'METADATA',
        }
        new_item = {k: v for k, v in new_item.items() if v is not None}
        table.meta.client.transact_write_items(TransactItems=[
            {'Delete': {'TableName': table.table_name, 'Key': {'PK': raw['PK'], 'SK': raw['SK']}}},
            {'Put': {'TableName': table.table_name, 'Item': new_item}},
        ])
        return get_learning_objective(objective_id)

    expr, names, values = build_update_expression(fields)
    table.update_item(
        Key={'PK': raw['PK'], 'SK': raw['SK']},
        UpdateExpression=expr, ExpressionAttributeNames=names, ExpressionAttributeValues=values,
    )
    return get_learning_objective(objective_id)
