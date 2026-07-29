"""Repository functions for the User item (merged Professor +
Administrator - see the design spec). No Django ORM dependency."""
import uuid

import boto3
from boto3.dynamodb.conditions import Attr, Key
from django.contrib.auth.hashers import check_password, make_password

from .client import build_update_expression, get_table, now_iso
from .keys import email_gsi2pk, metadata_sk, user_pk, username_gsi1pk


def create_user(*, username, email, password=None, password_hash=None,
                 first_name='', last_name='', is_administrator=False,
                 is_super_admin=False, professor_access_code=None):
    """Creates a User item. Pass `password` to hash it here, or
    `password_hash` to store an already-hashed value directly (used by
    the users/models.py compatibility shim when wrapping a throwaway
    django.contrib.auth.models.User in tests). Raises ValueError if the
    username is already taken."""
    if password_hash is None:
        password_hash = make_password(password)

    # Check if username already exists
    if get_user_by_username(username) is not None:
        raise ValueError(f'username "{username}" already exists')

    table = get_table()
    user_id = str(uuid.uuid4())
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
        'is_administrator': is_administrator,
        'is_super_admin': is_super_admin,
        'professor_access_code': professor_access_code,
        'created_at': now,
        'updated_at': now,
    }
    table.put_item(Item=item)
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
    import os
    dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
    table_name = os.environ['USERS_TABLE']
    keys = [{'PK': user_pk(uid), 'SK': metadata_sk()} for uid in unique_ids]
    resp = dynamodb.batch_get_item(RequestItems={table_name: {'Keys': keys}})
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
    get_table().delete_item(Key={'PK': user_pk(user_id), 'SK': metadata_sk()})


def check_user_password(user_item, raw_password):
    return check_password(raw_password, user_item['password_hash'])
