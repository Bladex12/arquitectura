"""PeerEvaluation and ReflectionEvaluation repository."""
import uuid

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import build_update_expression, get_table, now_iso


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
        'submitted_at': now_iso(),
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
        ConsistentRead=True,
    )
    return response['Items']


def get_peer_evaluation(room_code, evaluator_team_id, evaluated_team_id):
    """Returns the PeerEvaluation item dict for one (evaluator, evaluated)
    pair in a room, or None if it doesn't exist. Used by
    PeerEvaluationViewSet.create to decide create vs. re-submission
    (matching the Django model's unique_together get-or-update flow),
    and by retrieve()."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.peer_eval_sk(evaluator_team_id, evaluated_team_id)},
        ConsistentRead=True,
    )
    return response.get('Item')


def update_peer_evaluation(room_code, evaluator_team_id, evaluated_team_id, criteria_scores,
                            total_score, tokens_awarded, feedback):
    """Overwrites the mutable fields of an already-submitted PeerEvaluation
    (a team re-submitting its evaluation of another team). submitted_at is
    deliberately never touched here -- mirrors the Django model's
    submitted_at = DateTimeField(auto_now_add=True), which a second
    .save() on an existing row never re-triggers. Returns None if the
    item doesn't exist (guarded so update_item's default upsert behavior
    can't create a ghost item missing `type`)."""
    table = get_table()
    update_expression, names, values = build_update_expression({
        'criteria_scores': criteria_scores,
        'total_score': total_score,
        'tokens_awarded': tokens_awarded,
        'feedback': feedback,
    })
    try:
        response = table.update_item(
            Key={'PK': keys.session_pk(room_code), 'SK': keys.peer_eval_sk(evaluator_team_id, evaluated_team_id)},
            UpdateExpression=update_expression,
            ConditionExpression='attribute_exists(PK)',
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues='ALL_NEW',
        )
        return response['Attributes']
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise


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
        'created_at': now_iso(),
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def scan_all_reflections():
    """Returns ReflectionEvaluation items across every room. Needed by
    admin_dashboard's cross-room evaluation endpoints, which report on
    all reflections regardless of session scoping."""
    table = get_table()
    response = table.scan(FilterExpression=Attr('type').eq('ReflectionEvaluation'))
    return response['Items']
