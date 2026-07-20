"""Pure key-building functions for the game_sessions single-table schema.

Every function returns a plain string per
docs/superpowers/specs/2026-07-19-dynamodb-single-table-design.md.
No AWS calls happen here - these are pure string formatters, kept
separate so the key format is defined in exactly one place.
"""


def session_pk(room_code):
    return f'SESSION#{room_code}'


def session_group_pk(session_group_id):
    return f'SESSIONGROUP#{session_group_id}'


def tablet_pk(tablet_code):
    return f'TABLET#{tablet_code}'


def metadata_sk():
    return 'METADATA'


def team_sk(team_id):
    return f'TEAM#{team_id}#METADATA'


def team_prefix(team_id):
    """SK prefix shared by a team's own record and all its child items
    (progress, bubble map, roulette assignment). Use with begins_with,
    then filter on the `type` attribute to narrow to one kind."""
    return f'TEAM#{team_id}#'


def stage_sk(stage_id):
    return f'STAGE#{stage_id}'


def progress_sk(team_id, activity_id):
    return f'TEAM#{team_id}#PROGRESS#{activity_id}'


def bubble_map_sk(team_id, stage_id):
    return f'TEAM#{team_id}#BUBBLEMAP#{stage_id}'


def tablet_connection_sk(team_session_token):
    return f'TABLETCONN#{team_session_token}'


def roulette_sk(team_id, stage_id):
    return f'TEAM#{team_id}#ROULETTE#{stage_id}'


def token_tx_sk_for_source(source_type, source_id):
    """Deterministic SK for source-tied transactions - collides on retry
    for idempotency. Only valid when source_id is not None."""
    return f'TOKENTX#{source_type}#{source_id}'


def token_tx_sk_for_manual(iso_timestamp, tx_id):
    """SK for manual_adjustment/system transactions, which have no
    natural source_id and therefore no idempotency guarantee."""
    return f'TOKENTX#{iso_timestamp}#{tx_id}'


def peer_eval_sk(evaluator_team_id, evaluated_team_id):
    return f'PEEREVAL#{evaluator_team_id}#{evaluated_team_id}'


def reflection_sk(reflection_id):
    return f'REFLECTION#{reflection_id}'


def professor_gsi1pk(professor_id):
    return f'PROFESSOR#{professor_id}'


def session_gsi1sk(status, created_at_iso):
    return f'{status}#{created_at_iso}'
