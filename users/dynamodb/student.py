"""Repository functions for Student items. No auth - students never log
in, this is roster data referenced by game_sessions team rosters."""
import os
import uuid

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr, Key
from boto3.dynamodb.types import TypeSerializer

from .client import build_update_expression, get_client, get_table, now_iso
from .keys import metadata_sk, student_email_gsi2pk, student_pk


def create_student(*, full_name, email, rut):
    """Creates a Student item. Raises ValueError if the email is already
    taken (enforced via transactional write with email-reservation item)."""
    student_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': student_pk(student_id),
        'SK': metadata_sk(),
        'GSI2PK': student_email_gsi2pk(email),
        'GSI2SK': metadata_sk(),
        'type': 'Student',
        'id': student_id,
        'full_name': full_name,
        'email': email.lower(),
        'rut': rut,
        'created_at': now,
        'updated_at': now,
    }

    # Create an email-reservation item to ensure uniqueness transactionally
    reservation_item = {
        'PK': student_email_gsi2pk(email),
        'SK': 'RESERVATION',
        'type': 'StudentEmailReservation',
        'student_id': student_id,
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
            raise ValueError(f'a student with email "{email}" already exists')
        raise

    return item


def get_student(student_id):
    resp = get_table().get_item(Key={'PK': student_pk(student_id), 'SK': metadata_sk()})
    return resp.get('Item')


def student_exists(student_id):
    return get_student(student_id) is not None


def get_student_by_email(email):
    resp = get_table().query(
        IndexName='GSI2',
        KeyConditionExpression=Key('GSI2PK').eq(student_email_gsi2pk(email)),
    )
    items = resp.get('Items', [])
    # Filter out reservation items, return only Student items
    for item in items:
        if item.get('type') == 'Student':
            return item
    return None


def get_students_by_ids(student_ids):
    """Batch fetch. Returns {id: item}, silently skipping ids that don't
    exist and filtering out reservation items."""
    unique_ids = list({sid for sid in student_ids if sid})
    if not unique_ids:
        return {}
    table = get_table()
    table_name = os.environ['USERS_TABLE']
    keys = [{'PK': student_pk(sid), 'SK': metadata_sk()} for sid in unique_ids]
    resp = table.meta.client.batch_get_item(RequestItems={table_name: {'Keys': keys}})
    items = resp['Responses'].get(table_name, [])
    # Filter out reservation items (only return Student type)
    return {item['id']: item for item in items if item.get('type') == 'Student'}


def update_student(student_id, fields):
    expr, names, values = build_update_expression(fields)
    get_table().update_item(
        Key={'PK': student_pk(student_id), 'SK': metadata_sk()},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def get_or_create_student(*, email, full_name, rut):
    """Get or create a student by email. If another thread/process creates
    the student concurrently (race condition), catches the error and
    re-fetches the created student, returning (student, False)."""
    existing = get_student_by_email(email)
    if existing:
        return existing, False
    try:
        return create_student(full_name=full_name, email=email, rut=rut), True
    except ValueError:
        # Another concurrent call won the race - re-fetch the student that was created
        student = get_student_by_email(email)
        return student, False


def update_or_create_student(*, email, full_name, rut):
    """Update or create a student by email. If the student exists, updates
    full_name and rut. If another thread/process creates the student
    concurrently (race condition), catches the error, re-fetches, updates,
    and returns (updated_student, False)."""
    existing = get_student_by_email(email)
    if existing:
        update_student(existing['id'], {'full_name': full_name, 'rut': rut})
        return get_student(existing['id']), False
    try:
        return create_student(full_name=full_name, email=email, rut=rut), True
    except ValueError:
        # Another concurrent call won the race - re-fetch, update, and return
        student = get_student_by_email(email)
        update_student(student['id'], {'full_name': full_name, 'rut': rut})
        return get_student(student['id']), False


def list_students():
    """Scan for all Student items, filtering out reservation items."""
    resp = get_table().scan(FilterExpression=Attr('type').eq('Student'))
    return resp.get('Items', [])
