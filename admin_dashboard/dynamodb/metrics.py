"""Repository functions for admin_dashboard's metric-cache items in
ContentTable, keyed by the content they describe (see
docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md).
"""
from decimal import Decimal

from boto3.dynamodb.conditions import Key

from admin_dashboard.dynamodb.client import get_table, now_iso


def _to_dynamo(value):
    return Decimal(str(value)) if isinstance(value, float) else value


def _set_expression(fields):
    """Plain `SET a = :a, b = :b, ...` builder, no auto-added timestamp --
    unlike build_update_expression, these metric items don't share one
    common timestamp field name (last_updated / last_selected_at)."""
    names, values, clauses = {}, {}, []
    for i, (field_name, value) in enumerate(fields.items()):
        name_placeholder, value_placeholder = f'#f{i}', f':v{i}'
        clauses.append(f'{name_placeholder} = {value_placeholder}')
        names[name_placeholder] = field_name
        values[value_placeholder] = _to_dynamo(value)
    return 'SET ' + ', '.join(clauses), names, values


def _activity_metric_key(activity_id):
    return {'PK': f'ACTIVITY#{activity_id}', 'SK': 'METRIC#DURATION'}


def _stage_metric_key(stage_id):
    return {'PK': f'STAGE#{stage_id}', 'SK': 'METRIC#DURATION'}


def _topic_metric_key(topic_id):
    return {'PK': f'TOPIC#{topic_id}', 'SK': 'METRIC#SELECTION'}


def _challenge_metric_key(topic_id, challenge_id):
    return {'PK': f'TOPIC#{topic_id}', 'SK': f'CHALLENGE#{challenge_id}#METRIC#SELECTION'}


def _to_activity_metric(raw):
    return {
        'activity_id': raw['activity_id'], 'stage_id': raw['stage_id'],
        'total_completions': int(raw.get('total_completions', 0)),
        'total_duration_seconds': float(raw.get('total_duration_seconds', 0)),
        'avg_duration_seconds': float(raw.get('avg_duration_seconds', 0)),
        'min_duration_seconds': float(raw['min_duration_seconds']) if raw.get('min_duration_seconds') is not None else None,
        'max_duration_seconds': float(raw['max_duration_seconds']) if raw.get('max_duration_seconds') is not None else None,
        'last_updated': raw.get('last_updated'),
    }


def get_activity_duration_metric(activity_id):
    resp = get_table().get_item(Key=_activity_metric_key(activity_id))
    item = resp.get('Item')
    return _to_activity_metric(item) if item else None


def get_or_create_activity_duration_metric(activity_id, stage_id):
    existing = get_activity_duration_metric(activity_id)
    if existing:
        return existing, False
    now = now_iso()
    item = {
        **_activity_metric_key(activity_id), 'type': 'ActivityDurationMetric',
        'activity_id': str(activity_id), 'stage_id': str(stage_id),
        'total_completions': 0, 'total_duration_seconds': 0, 'avg_duration_seconds': 0,
        'last_updated': now,
    }
    get_table().put_item(Item=item)
    return _to_activity_metric(item), True


def save_activity_duration_metric(activity_id, fields):
    fields = {**fields, 'last_updated': now_iso()}
    expr, names, values = _set_expression(fields)
    get_table().update_item(Key=_activity_metric_key(activity_id), UpdateExpression=expr,
                             ExpressionAttributeNames=names, ExpressionAttributeValues=values)
    return get_activity_duration_metric(activity_id)


def _to_stage_metric(raw):
    return {
        'stage_id': raw['stage_id'],
        'total_completions': int(raw.get('total_completions', 0)),
        'total_duration_seconds': float(raw.get('total_duration_seconds', 0)),
        'avg_duration_seconds': float(raw.get('avg_duration_seconds', 0)),
        'last_updated': raw.get('last_updated'),
    }


def get_stage_duration_metric(stage_id):
    resp = get_table().get_item(Key=_stage_metric_key(stage_id))
    item = resp.get('Item')
    return _to_stage_metric(item) if item else None


def get_or_create_stage_duration_metric(stage_id):
    existing = get_stage_duration_metric(stage_id)
    if existing:
        return existing, False
    now = now_iso()
    item = {
        **_stage_metric_key(stage_id), 'type': 'StageDurationMetric',
        'stage_id': str(stage_id), 'total_completions': 0, 'total_duration_seconds': 0,
        'avg_duration_seconds': 0, 'last_updated': now,
    }
    get_table().put_item(Item=item)
    return _to_stage_metric(item), True


def save_stage_duration_metric(stage_id, fields):
    fields = {**fields, 'last_updated': now_iso()}
    expr, names, values = _set_expression(fields)
    get_table().update_item(Key=_stage_metric_key(stage_id), UpdateExpression=expr,
                             ExpressionAttributeNames=names, ExpressionAttributeValues=values)
    return get_stage_duration_metric(stage_id)


def _to_topic_metric(raw):
    return {
        'topic_id': raw['topic_id'], 'selection_count': int(raw.get('selection_count', 0)),
        'last_selected_at': raw.get('last_selected_at'),
    }


def get_topic_selection_metric(topic_id):
    resp = get_table().get_item(Key=_topic_metric_key(topic_id))
    item = resp.get('Item')
    return _to_topic_metric(item) if item else None


def get_topic_selection_metrics_for_topics(topic_ids):
    table = get_table()
    keys_batch = [_topic_metric_key(tid) for tid in topic_ids]
    result = {}
    for i in range(0, len(keys_batch), 100):
        chunk = keys_batch[i:i + 100]
        if not chunk:
            continue
        resp = table.meta.client.batch_get_item(RequestItems={table.table_name: {'Keys': chunk}})
        for item in resp['Responses'].get(table.table_name, []):
            fields = _to_topic_metric(item)
            result[fields['topic_id']] = fields
    return result


def get_or_create_topic_selection_metric(topic_id):
    existing = get_topic_selection_metric(topic_id)
    if existing:
        return existing, False
    item = {
        **_topic_metric_key(topic_id), 'type': 'TopicSelectionMetric',
        'topic_id': str(topic_id), 'selection_count': 0,
    }
    get_table().put_item(Item=item)
    return _to_topic_metric(item), True


def save_topic_selection_metric(topic_id, fields):
    expr, names, values = _set_expression(fields)
    get_table().update_item(Key=_topic_metric_key(topic_id), UpdateExpression=expr,
                             ExpressionAttributeNames=names, ExpressionAttributeValues=values)
    return get_topic_selection_metric(topic_id)


def _to_challenge_metric(raw):
    return {
        'challenge_id': raw['challenge_id'], 'topic_id': raw['topic_id'],
        'selection_count': int(raw.get('selection_count', 0)),
        'avg_tokens_earned': float(raw.get('avg_tokens_earned', 0)),
        'last_selected_at': raw.get('last_selected_at'),
    }


def get_challenge_selection_metric(topic_id, challenge_id):
    resp = get_table().get_item(Key=_challenge_metric_key(topic_id, challenge_id))
    item = resp.get('Item')
    return _to_challenge_metric(item) if item else None


def get_challenge_selection_metrics_for_challenges(challenges):
    """challenges: iterable of (challenge_id, topic_id) pairs."""
    table = get_table()
    keys_batch = [_challenge_metric_key(topic_id, challenge_id) for challenge_id, topic_id in challenges]
    result = {}
    for i in range(0, len(keys_batch), 100):
        chunk = keys_batch[i:i + 100]
        if not chunk:
            continue
        resp = table.meta.client.batch_get_item(RequestItems={table.table_name: {'Keys': chunk}})
        for item in resp['Responses'].get(table.table_name, []):
            fields = _to_challenge_metric(item)
            result[fields['challenge_id']] = fields
    return result


def get_or_create_challenge_selection_metric(challenge_id, topic_id):
    existing = get_challenge_selection_metric(topic_id, challenge_id)
    if existing:
        return existing, False
    item = {
        **_challenge_metric_key(topic_id, challenge_id), 'type': 'ChallengeSelectionMetric',
        'challenge_id': str(challenge_id), 'topic_id': str(topic_id),
        'selection_count': 0, 'avg_tokens_earned': 0,
        'GSI1PK': f'CHALLENGE#{challenge_id}', 'GSI1SK': 'METRIC',
    }
    get_table().put_item(Item=item)
    return _to_challenge_metric(item), True


def save_challenge_selection_metric(topic_id, challenge_id, fields):
    expr, names, values = _set_expression(fields)
    get_table().update_item(Key=_challenge_metric_key(topic_id, challenge_id), UpdateExpression=expr,
                             ExpressionAttributeNames=names, ExpressionAttributeValues=values)
    return get_challenge_selection_metric(topic_id, challenge_id)


def _to_snapshot(raw):
    return {
        'date': raw['date'], 'games_completed': int(raw.get('games_completed', 0)),
        'new_professors': int(raw.get('new_professors', 0)), 'new_students': int(raw.get('new_students', 0)),
        'total_sessions': int(raw.get('total_sessions', 0)), 'created_at': raw.get('created_at'),
    }


def get_daily_snapshot(date_iso):
    resp = get_table().get_item(Key={'PK': f'SNAPSHOT#{date_iso}', 'SK': 'METADATA'})
    item = resp.get('Item')
    return _to_snapshot(item) if item else None


def list_daily_snapshots():
    table = get_table()
    resp = table.query(IndexName='GSI1', KeyConditionExpression=Key('GSI1PK').eq('SNAPSHOT#ALL'))
    return [_to_snapshot(i) for i in resp['Items']]


def create_daily_snapshot(*, date_iso, games_completed=0, new_professors=0, new_students=0, total_sessions=0):
    item = {
        'PK': f'SNAPSHOT#{date_iso}', 'SK': 'METADATA', 'type': 'DailyMetricsSnapshot',
        'date': date_iso, 'games_completed': games_completed, 'new_professors': new_professors,
        'new_students': new_students, 'total_sessions': total_sessions, 'created_at': now_iso(),
        'GSI1PK': 'SNAPSHOT#ALL', 'GSI1SK': date_iso,
    }
    get_table().put_item(Item=item)
    return _to_snapshot(item)
