"""TokenTransaction repository - an append-only ledger. Source-tied
transactions (source_id is not None) are idempotent: a retried write for
the same (source_type, source_id) is rejected instead of double-awarding
tokens. See the spec's Concurrency section."""
import uuid
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_transaction(room_code, team_id, amount, source_type, source_id=None,
                        session_stage_id=None, reason=None, awarded_by_id=None):
    """Creates a TokenTransaction item. Returns None instead of raising
    if this (source_type, source_id) pair was already recorded - that's
    the expected outcome of a retried write, not an error."""
    now = _now_iso()
    if source_id is not None:
        sk = keys.token_tx_sk_for_source(source_type, source_id)
    else:
        sk = keys.token_tx_sk_for_manual(now, str(uuid.uuid4()))

    item = {
        'PK': keys.session_pk(room_code),
        'SK': sk,
        'type': 'TokenTransaction',
        'room_code': room_code,
        'team_id': team_id,
        'session_stage_id': session_stage_id,
        'amount': amount,
        'source_type': source_type,
        'source_id': source_id,
        'reason': reason,
        'awarded_by_id': awarded_by_id,
        'created_at': now,
    }
    table = get_table()
    try:
        table.put_item(Item=item, ConditionExpression='attribute_not_exists(PK)')
        return item
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise


def list_transactions(room_code):
    """Returns every TokenTransaction item in a room. Not guaranteed
    chronologically ordered by SK (source-tied and manual entries use
    different SK shapes) - sort by created_at if order matters."""
    table = get_table()
    response = table.query(
        KeyConditionExpression=Key('PK').eq(keys.session_pk(room_code)) & Key('SK').begins_with('TOKENTX#'),
    )
    return response['Items']
