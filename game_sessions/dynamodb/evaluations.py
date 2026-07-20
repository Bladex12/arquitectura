"""PeerEvaluation and ReflectionEvaluation repository."""
import uuid
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_peer_evaluation(room_code, evaluator_team_id, evaluated_team_id, criteria_scores,
                            total_score, tokens_awarded=0, feedback=None):
    """Creates a PeerEvaluation item. Returns None if this
    (evaluator_team_id, evaluated_team_id) pair already submitted an
    evaluation for this room, matching the Django model's
    unique_together constraint."""
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.peer_eval_sk(evaluator_team_id, evaluated_team_id),
        'type': 'PeerEvaluation',
        'room_code': room_code,
        'evaluator_team_id': evaluator_team_id,
        'evaluated_team_id': evaluated_team_id,
        'criteria_scores': criteria_scores,
        'total_score': total_score,
        'tokens_awarded': tokens_awarded,
        'feedback': feedback,
        'submitted_at': _now_iso(),
    }
    table = get_table()
    try:
        table.put_item(Item=item, ConditionExpression='attribute_not_exists(PK)')
        return item
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise


def list_peer_evaluations(room_code):
    """Returns every PeerEvaluation item in a room."""
    table = get_table()
    response = table.query(
        KeyConditionExpression=Key('PK').eq(keys.session_pk(room_code)) & Key('SK').begins_with('PEEREVAL#'),
    )
    return response['Items']


def create_reflection(room_code, student_name, student_email, value_areas=None, faculty=None,
                       career=None, satisfaction=None, entrepreneurship_interest=None, comments=None):
    """Creates a ReflectionEvaluation item. Also intended to be streamed
    to Firehose/S3 for analytics (separate task) - rarely queried live."""
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.reflection_sk(str(uuid.uuid4())),
        'type': 'ReflectionEvaluation',
        'room_code': room_code,
        'student_name': student_name,
        'student_email': student_email,
        'faculty': faculty,
        'career': career,
        'value_areas': value_areas if value_areas is not None else [],
        'satisfaction': satisfaction,
        'entrepreneurship_interest': entrepreneurship_interest,
        'comments': comments,
        'created_at': _now_iso(),
    }
    table = get_table()
    table.put_item(Item=item)
    return item
