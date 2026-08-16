"""Push a lightweight "something changed" signal to tablets connected to a
room, right after a game_sessions/views.py mutation commits.

No-ops immediately if BROADCAST_FUNCTION_NAME isn't set (true for every
existing test's setUp and for local/docker-compose dev, where there is no
WebSocket API) -- callers can call broadcast_room() unconditionally after a
mutation without needing to guard it themselves, and without any test
needing to mock this module.

DjangoFunction runs inside a VPC (for RDS access), which has no working path
to the WebSocket Management API's PostToConnection call -- confirmed via a
real deploy that execute-api's Interface VPC endpoint only supports PRIVATE
REST APIs, not a WebSocket API (ForbiddenException). So this module doesn't
touch ConnectionsTable/apigatewaymanagementapi itself; it just async-invokes
a separate, non-VPC `BroadcastFunction` Lambda (see template.yaml,
lambda/broadcast/handler.py) that does the actual fan-out, since plain
Lambda networking reaches the Management API fine.

The frontend does not receive a data payload here -- it just re-runs its
existing REST fetch on receipt, so this module never needs to know the shape
of any entity. A broadcast failure must never break the HTTP response for
the mutation that triggered it, so every failure mode below is caught and
logged, never raised.
"""
import json
import logging
import os

import boto3

logger = logging.getLogger(__name__)


def broadcast_room(room_code):
    """Notify every tablet connected to `room_code` that game state changed."""
    function_name = os.environ.get('BROADCAST_FUNCTION_NAME')
    if not function_name:
        return

    kwargs = {
        'FunctionName': function_name,
        'InvocationType': 'Event',
        'Payload': json.dumps({'room_code': room_code}).encode('utf-8'),
    }
    qualifier = os.environ.get('BROADCAST_FUNCTION_QUALIFIER')
    if qualifier:
        kwargs['Qualifier'] = qualifier

    try:
        boto3.client('lambda', region_name=os.environ.get('AWS_REGION', 'us-east-1')).invoke(**kwargs)
    except Exception:
        logger.exception('broadcast_room: failed to invoke broadcast function for room %s', room_code)
