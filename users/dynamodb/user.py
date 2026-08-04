"""Repository functions for the User item (merged Professor +
Administrator - see the design spec). No Django ORM dependency."""
import os
import uuid

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr, Key
from boto3.dynamodb.types import TypeSerializer
from django.contrib.auth.hashers import check_password, make_password

from .client import build_update_expression, get_client, get_table, now_iso
from .keys import email_gsi2pk, metadata_sk, user_pk, username_gsi1pk


def create_user(*, username, email, password=None, password_hash=None,
                 first_name='', last_name='', is_administrator=False,
                 is_super_admin=False, professor_access_code=None,
                 user_id=None, is_professor=True):
    """Creates a User item. Pass `password` to hash it here, or
    `password_hash` to store an already-hashed value directly (used by
    the users/models.py compatibility shim when wrapping a throwaway
    django.contrib.auth.models.User in tests). Raises ValueError if the
    username is already taken.

    `user_id` overrides the generated identifier. This exists solely for
    the shim's test-fixture-convenience path (`Professor.objects.create(
    user=<django auth.User>)`), which must adopt the Django row's pk so
    that a JWT minted with `RefreshToken.for_user(<that django user>)`
    resolves back to this item. Real registration never passes it - it
    keeps getting a true UUID4."""
    if password_hash is None:
        password_hash = make_password(password)

    table = get_table()
    user_id = str(user_id) if user_id is not None else str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': user_pk(user_id),
        'SK': metadata_sk(),
        'GSI1PK': username_gsi1pk(username),
        'GSI1SK': metadata_sk(),
        'GSI2PK': email_gsi2pk(email),
        'GSI2SK': metadata_sk(),
        'type': 'User',
        'id': user_id,
        'username': username,
        'email': email.lower(),
        'password_hash': password_hash,
        'first_name': first_name,
        'last_name': last_name,
        'is_active': True,
        # Roles are flags on the one merged item. `is_professor` defaults
        # True (registration always creates a professor) but is False for
        # the administrator-only accounts `Administrator.objects.create()`
        # builds from an identity that has no professor profile - the old
        # ORM expressed that as "an administrators row with no professors
        # row", and call sites still branch on it via `.professor` /
        # `hasattr(user, 'professor')`.
        'is_professor': is_professor,
        'is_administrator': is_administrator,
        'is_super_admin': is_super_admin,
        'professor_access_code': professor_access_code,
        'created_at': now,
        'updated_at': now,
    }

    # Create a username-reservation item to ensure uniqueness transactionally
    reservation_item = {
        'PK': username_gsi1pk(username),
        'SK': 'RESERVATION',
        'type': 'UsernameReservation',
        'user_id': user_id,
    }

    # Write both items transactionally using low-level client API
    dynamodb = get_client()
    table_name = os.environ['USERS_TABLE']
    serializer = TypeSerializer()

    try:
        dynamodb.transact_write_items(
            TransactItems=[
                {
                    'Put': {
                        'TableName': table_name,
                        'Item': {k: serializer.serialize(v) for k, v in reservation_item.items()},
                        'ConditionExpression': 'attribute_not_exists(PK)',
                    }
                },
                {
                    'Put': {
                        'TableName': table_name,
                        'Item': {k: serializer.serialize(v) for k, v in item.items()},
                    }
                },
            ]
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'TransactionCanceledException':
            raise ValueError(f'username "{username}" already exists')
        raise

    return item


def get_user_by_id(user_id):
    resp = get_table().get_item(Key={'PK': user_pk(user_id), 'SK': metadata_sk()})
    return resp.get('Item')


def get_user_by_username(username):
    resp = get_table().query(
        IndexName='GSI1',
        KeyConditionExpression=Key('GSI1PK').eq(username_gsi1pk(username)),
    )
    items = resp.get('Items', [])
    return items[0] if items else None


def get_user_by_email(email):
    resp = get_table().query(
        IndexName='GSI2',
        KeyConditionExpression=Key('GSI2PK').eq(email_gsi2pk(email)),
    )
    items = resp.get('Items', [])
    return items[0] if items else None


def get_users_by_ids(user_ids):
    """Batch fetch. Returns {id: item}, silently skipping ids that don't
    exist. BatchGetItem caps at 100 keys per call, chunk if ever needed
    at that scale (not expected at course-project size)."""
    unique_ids = list({uid for uid in user_ids if uid})
    if not unique_ids:
        return {}
    table = get_table()
    table_name = os.environ['USERS_TABLE']
    keys = [{'PK': user_pk(uid), 'SK': metadata_sk()} for uid in unique_ids]
    resp = table.meta.client.batch_get_item(RequestItems={table_name: {'Keys': keys}})
    items = resp['Responses'].get(table_name, [])
    return {item['id']: item for item in items}


def list_users():
    """Scan for all User items. Course-project scale - acceptable per
    the same justification as game_sessions' cancel_expired_sessions."""
    resp = get_table().scan(FilterExpression=Attr('type').eq('User'))
    return resp.get('Items', [])


def count_users():
    return len(list_users())


def update_user(user_id, fields):
    expr, names, values = build_update_expression(fields)
    get_table().update_item(
        Key={'PK': user_pk(user_id), 'SK': metadata_sk()},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def delete_user(user_id):
    """Delete both the user item and its username-reservation item.
    Must fetch the user first to retrieve the username for the reservation.
    Uses batch_write_item (non-atomic) rather than transact_write_items,
    acceptable at course-project scale per same justification as Scan-based operations."""
    user_item = get_user_by_id(user_id)
    if not user_item:
        return

    # Delete both the user item and the reservation item
    dynamodb = get_client()
    table_name = os.environ['USERS_TABLE']

    dynamodb.batch_write_item(
        RequestItems={
            table_name: [
                {
                    'DeleteRequest': {
                        'Key': {
                            'PK': {'S': user_pk(user_id)},
                            'SK': {'S': metadata_sk()},
                        }
                    }
                },
                {
                    'DeleteRequest': {
                        'Key': {
                            'PK': {'S': username_gsi1pk(user_item['username'])},
                            'SK': {'S': 'RESERVATION'},
                        }
                    }
                },
            ]
        }
    )


def check_user_password(user_item, raw_password):
    return check_password(raw_password, user_item['password_hash'])


def make_password_placeholder():
    """Used only when the shim wraps a throwaway Django auth.User whose
    .password happens to be empty (shouldn't normally happen -
    create_user always hashes something) - an unusable hash, never a
    valid password match."""
    return '!'
