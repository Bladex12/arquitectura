"""Team repository - embeds TeamPersonalization and the student roster
as nested attributes (both 1:1/tiny and always fetched with the team)."""
import uuid

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table, now_iso


def create_team(room_code, name, color):
    """Creates a new Team item with an empty roster and zero tokens."""
    team_id = str(uuid.uuid4())
    now = now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.team_sk(team_id),
        'type': 'Team',
        'team_id': team_id,
        'room_code': room_code,
        'name': name,
        'color': color,
        'tokens_total': 0,
        'student_ids': [],
        'personalization_team_name': None,
        'personalization_members_know_each_other': None,
        'created_at': now,
        'updated_at': now,
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_team(room_code, team_id):
    """Returns the Team item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.team_sk(team_id)},
        ConsistentRead=True,
    )
    return response.get('Item')


def list_teams(room_code):
    """Returns every Team item in a room (not its children - progress,
    bubble maps, roulette assignments all share the TEAM# prefix, so
    this filters on `type` to exclude them)."""
    table = get_table()
    response = table.query(
        KeyConditionExpression=Key('PK').eq(keys.session_pk(room_code)) & Key('SK').begins_with('TEAM#'),
        FilterExpression=Attr('type').eq('Team'),
        ConsistentRead=True,
    )
    return response['Items']


def add_student(room_code, team_id, student_id):
    """Adds a student to the team's roster if not already present.
    Retries on concurrent modification (optimistic locking via
    updated_at) since multiple students often join the same team within
    seconds of each other during the lobby. Returns the updated team
    item, or None if the team doesn't exist."""
    table = get_table()
    for _ in range(5):
        item = get_team(room_code, team_id)
        if item is None:
            return None
        if student_id in item['student_ids']:
            return item
        new_roster = item['student_ids'] + [student_id]
        now = now_iso()
        try:
            table.update_item(
                Key={'PK': keys.session_pk(room_code), 'SK': keys.team_sk(team_id)},
                UpdateExpression='SET #roster = :roster, updated_at = :now',
                ConditionExpression='updated_at = :expected_updated_at',
                ExpressionAttributeNames={'#roster': 'student_ids'},
                ExpressionAttributeValues={
                    ':roster': new_roster,
                    ':now': now,
                    ':expected_updated_at': item['updated_at'],
                },
            )
            item['student_ids'] = new_roster
            item['updated_at'] = now
            return item
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                continue
            raise
    raise RuntimeError(f'add_student: too much contention on team {team_id} after 5 retries')


def update_tokens(room_code, team_id, delta):
    """Atomically adds delta (can be negative) to tokens_total and
    returns the new total. Uses ADD, not read-modify-write, so
    concurrent awards from different sources never lose an update.
    Returns None if the team doesn't exist (guarded so update_item's
    default upsert behavior can't create a ghost item missing `type`)."""
    table = get_table()
    try:
        response = table.update_item(
            Key={'PK': keys.session_pk(room_code), 'SK': keys.team_sk(team_id)},
            UpdateExpression='ADD #tokens :delta SET updated_at = :now',
            ConditionExpression='attribute_exists(PK)',
            ExpressionAttributeNames={'#tokens': 'tokens_total'},
            ExpressionAttributeValues={':delta': delta, ':now': now_iso()},
            ReturnValues='UPDATED_NEW',
        )
        return int(response['Attributes']['tokens_total'])
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise
