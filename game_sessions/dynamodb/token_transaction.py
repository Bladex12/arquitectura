"""TokenTransaction repository - an append-only ledger. Source-tied
transactions (source_id is not None) are idempotent: a retried write for
the same (source_type, source_id) is rejected instead of double-awarding
tokens. See the spec's Concurrency section."""
import uuid

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table, now_iso


def create_transaction(room_code, team_id, amount, source_type, source_id=None,
                        session_stage_id=None, reason=None, awarded_by_id=None):
    """Creates a TokenTransaction item. Returns None instead of raising
    if this (source_type, source_id) pair was already recorded - that's
    the expected outcome of a retried write, not an error."""
    now = now_iso()
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
        ConsistentRead=True,
    )
    return response['Items']


def get_transaction(room_code, source_type, source_id):
    """Returns the TokenTransaction item dict for one deterministic
    (source_type, source_id) pair, or None if it doesn't exist. Only
    valid for source-tied transactions (source_id is not None) - manual/
    system transactions have no deterministic SK to look up by."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.token_tx_sk_for_source(source_type, source_id)},
        ConsistentRead=True,
    )
    return response.get('Item')


def adjust_transaction_amount(room_code, source_type, source_id, new_amount):
    """Changes an already-recorded source-tied transaction's amount (e.g.
    a PeerEvaluation resubmitted with a different total_score changes how
    many tokens the earlier award should have been). Returns
    (updated_item, delta) where delta = new_amount - old_amount, so the
    caller can apply the same delta to the team's tokens_total via
    team.update_tokens (atomic ADD, not a fresh award). Returns (None, 0)
    if no transaction exists for this (source_type, source_id) - this
    function only adjusts an existing award, it never creates one (that's
    create_transaction's job). Also returns (item, 0) as a no-op, without
    writing, when new_amount already matches the stored amount."""
    existing = get_transaction(room_code, source_type, source_id)
    if existing is None:
        return None, 0
    delta = new_amount - existing['amount']
    if delta == 0:
        return existing, 0
    table = get_table()
    response = table.update_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.token_tx_sk_for_source(source_type, source_id)},
        UpdateExpression='SET #amount = :amount',
        ExpressionAttributeNames={'#amount': 'amount'},
        ExpressionAttributeValues={':amount': new_amount},
        ReturnValues='ALL_NEW',
    )
    return response['Attributes'], delta
