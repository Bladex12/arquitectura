"""Deliberately NOT deployed inside DjangoFunction's VPC (see template.yaml's
BroadcastFunction/LambdaVpcEndpoint comments) -- DjangoFunction async-invokes
this Lambda instead of calling ConnectionsTable/apigatewaymanagementapi
directly, because a Lambda-in-VPC has no working path to the WebSocket
Management API's PostToConnection call (execute-api's Interface VPC endpoint
only supports PRIVATE REST APIs, confirmed via a real deploy that returns
ForbiddenException for a WebSocket API). Plain (non-VPC) Lambda networking
reaches it fine.

Invoked with payload {"room_code": "..."} by game_sessions/broadcast.py.
"""
import json
import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    room_code = event.get('room_code')
    if not room_code:
        return

    table = boto3.resource('dynamodb').Table(os.environ['CONNECTIONS_TABLE'])

    try:
        connections = table.query(
            IndexName='RoomCodeIndex',
            KeyConditionExpression='room_code = :room_code',
            ExpressionAttributeValues={':room_code': room_code},
        ).get('Items', [])
    except Exception:
        logger.exception('broadcast: failed to query connections for room %s', room_code)
        return

    if not connections:
        return

    client = boto3.client('apigatewaymanagementapi', endpoint_url=f'https://{os.environ["WS_API_ENDPOINT"]}')
    payload = json.dumps({'type': 'state_changed', 'room_code': room_code}).encode('utf-8')

    for connection in connections:
        connection_id = connection['connectionId']
        try:
            client.post_to_connection(ConnectionId=connection_id, Data=payload)
        except client.exceptions.GoneException:
            try:
                table.delete_item(Key={'connectionId': connection_id})
            except Exception:
                logger.exception('broadcast: failed to clean up stale connection %s', connection_id)
        except Exception:
            logger.exception('broadcast: post_to_connection failed for %s', connection_id)
