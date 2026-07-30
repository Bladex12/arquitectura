"""Repository functions for ProfessorAccessCode items."""
from boto3.dynamodb.conditions import Attr, Key

from .client import get_table, now_iso
from .keys import access_code_email_gsi2pk, access_code_pk, metadata_sk


def create_access_code(email, code):
    table = get_table()
    now = now_iso()
    item = {
        'PK': access_code_pk(code),
        'SK': metadata_sk(),
        'GSI2PK': access_code_email_gsi2pk(email),
        'GSI2SK': metadata_sk(),
        'type': 'ProfessorAccessCode',
        'email': email.lower(),
        'access_code': code,
        'is_used': False,
        'created_at': now,
        'used_at': None,
    }
    try:
        table.put_item(Item=item, ConditionExpression='attribute_not_exists(PK)')
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValueError(f'access code "{code}" already exists')
    return item


def get_access_code(code):
    resp = get_table().get_item(Key={'PK': access_code_pk(code), 'SK': metadata_sk()})
    return resp.get('Item')


def get_pending_access_code_by_email(email):
    resp = get_table().query(
        IndexName='GSI2',
        KeyConditionExpression=Key('GSI2PK').eq(access_code_email_gsi2pk(email)),
    )
    for item in resp.get('Items', []):
        if not item['is_used']:
            return item
    return None


def mark_access_code_used(code):
    get_table().update_item(
        Key={'PK': access_code_pk(code), 'SK': metadata_sk()},
        UpdateExpression='SET is_used = :true, used_at = :now',
        ExpressionAttributeValues={':true': True, ':now': now_iso()},
    )


def list_access_codes():
    resp = get_table().scan(FilterExpression=Attr('type').eq('ProfessorAccessCode'))
    return sorted(resp.get('Items', []), key=lambda c: c['created_at'], reverse=True)
