# DynamoDB game_sessions Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and unit-test the DynamoDB data-access layer for all 14 `game_sessions` entities, per the approved schema in `docs/superpowers/specs/2026-07-19-dynamodb-single-table-design.md`.

**Architecture:** A new `game_sessions/dynamodb/` package with one module per entity group (mirroring `docs/superpowers/specs/2026-07-19-dynamodb-single-table-design.md`'s entity table), each exposing plain functions that take/return plain `dict`s — no dataclasses or ORM-style wrapper classes, since boto3's `Table` resource already speaks dicts natively and there's no validation logic needed yet (that lands later when this layer gets wired into DRF serializers). Every module is unit-tested against `moto`'s mocked DynamoDB, with a shared test-table-creation helper mirroring the real `GameSessionTable` schema from `template.yaml`.

**Tech Stack:** Python 3.11 (worktree's committed `.venv`, which ships Python 3.12 and already has Django/mysqlclient/boto3/django-storages installed — run `pip install -r requirements.txt` once to pick up anything added since it was last synced), boto3, moto (test-only), Django's `manage.py test` runner (matches existing `game_sessions/tests.py` convention — no pytest.ini exists in this repo despite pytest being a dependency, so tests use `django.test.TestCase`/`unittest.TestCase` run via `manage.py test`, not bare `pytest`).

## Global Constraints

- No Django ORM models, migrations, or `models.py` changes — this layer is a parallel data-access path, not a Django app extension.
- No changes to `template.yaml` — `GameSessionTable` (base `PK`/`SK` + `GSI1PK`/`GSI1SK`) is already deployed; this plan only writes code against it.
- No wiring into views/serializers/URLs — that's a separate future task (the ORM cutover). This plan's deliverable is a fully tested, standalone repository layer.
- Any attribute name that's a DynamoDB reserved word (`status`, `name`, `data`, etc. — see the full list in AWS's docs) needs an `ExpressionAttributeNames` placeholder when it appears in a hand-written `UpdateExpression` string, or the request fails at runtime with a syntax error. This doesn't apply to `FilterExpression`/`KeyConditionExpression`/`ConditionExpression` built via `boto3.dynamodb.conditions.Attr`/`Key` (e.g. `Attr('type').eq(...)`) — those builders alias reserved words automatically. Attribute names that aren't reserved (`updated_at`, `last_seen`, `tokens_total`, etc.) don't need manual aliasing either way — don't add placeholders reflexively, just where a real collision exists.
- Test file naming: `game_sessions/test_dynamodb_<module>.py` (sibling files to the existing `game_sessions/tests.py`, not a `tests/` package — Python doesn't allow both `tests.py` and `tests/` in the same directory, and Django's default test discovery pattern `test*.py` picks up both naming styles fine).
- Run tests via: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_<module>` — run from the worktree root. `DATABASE_HOST` must be overridden because the project's root `.env` (auto-loaded into every shell in this repo) sets it to `host.docker.internal`, which only resolves from inside a Docker container, not from the host running `.venv`'s local Python. Every other `.env` default (`DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`) already matches this repo's local dev MySQL, so nothing else needs overriding. Do NOT use `docker exec mision_emprende_backend ...` — that execs into a container bind-mounting the *original* checkout's directory (`.:/app` in docker-compose.yml), not this worktree, so it would never see any file created here.

---

### Task 1: DynamoDB client, shared update-expression helper, and moto test infrastructure

**Files:**
- Create: `game_sessions/dynamodb/__init__.py`
- Create: `game_sessions/dynamodb/client.py`
- Create: `game_sessions/dynamodb/testing.py`
- Modify: `requirements.txt` (add `moto` to the TESTING section, after line 74 `pytest==8.3.3`)
- Test: `game_sessions/test_dynamodb_client.py`

**Interfaces:**
- Produces: `game_sessions.dynamodb.client.get_table() -> boto3.resource('dynamodb').Table`; `game_sessions.dynamodb.client.build_update_expression(fields: dict) -> tuple[str, dict, dict]` (returns `update_expression, expression_attribute_names, expression_attribute_values`); `game_sessions.dynamodb.testing.create_test_table(table_name='test-game-sessions', region_name='us-east-1') -> Table` (test-only, must be called inside an active `moto.mock_aws`); `game_sessions.dynamodb.testing.DynamoDBTestCase` (test-only `unittest.TestCase` subclass — every later task's repository test file subclasses this instead of repeating moto setUp/tearDown boilerplate).

- [x] **Step 1: Add moto to requirements.txt**

Edit `requirements.txt`, after the `pytest==8.3.3` line in the `TESTING` section:

```
pytest==8.3.3  # Versión estable compatible con Python 3.11
moto[dynamodb]==5.0.20  # Mocked AWS backend for DynamoDB repository tests
```

- [x] **Step 2: Install it into the worktree's venv**

Run: `.venv/Scripts/python.exe -m pip install -q moto[dynamodb]==5.0.20`
Expected: no output (quiet install) and exit code 0. Verify with: `.venv/Scripts/python.exe -c "import moto; print(moto.__version__)"` — expect `5.0.20`.

- [x] **Step 3: Create the package**

Create `game_sessions/dynamodb/__init__.py` (empty file).

- [x] **Step 4: Write the failing test for `get_table`**

Create `game_sessions/test_dynamodb_client.py`:

```python
import os
from unittest import TestCase
from unittest.mock import patch

from moto import mock_aws

from game_sessions.dynamodb.testing import create_test_table


class GetTableTest(TestCase):
    @mock_aws
    @patch.dict(os.environ, {'GAME_SESSIONS_TABLE': 'test-game-sessions', 'AWS_REGION': 'us-east-1'})
    def test_get_table_returns_usable_table(self):
        from game_sessions.dynamodb.client import get_table

        create_test_table('test-game-sessions')
        table = get_table()

        self.assertEqual(table.table_name, 'test-game-sessions')
        table.put_item(Item={'PK': 'TEST#1', 'SK': 'METADATA'})
        response = table.get_item(Key={'PK': 'TEST#1', 'SK': 'METADATA'})
        self.assertEqual(response['Item']['SK'], 'METADATA')


class BuildUpdateExpressionTest(TestCase):
    def test_builds_set_clause_with_name_placeholders(self):
        from game_sessions.dynamodb.client import build_update_expression

        expression, names, values = build_update_expression({'status': 'running', 'name': 'Team A'})

        self.assertTrue(expression.startswith('SET updated_at = :updated_at, '))
        self.assertEqual(names, {'#f0': 'status', '#f1': 'name'})
        self.assertEqual(values[':v0'], 'running')
        self.assertEqual(values[':v1'], 'Team A')
        self.assertIn(':updated_at', values)

    def test_empty_fields_still_sets_updated_at(self):
        from game_sessions.dynamodb.client import build_update_expression

        expression, names, values = build_update_expression({})

        self.assertEqual(expression, 'SET updated_at = :updated_at')
        self.assertEqual(names, {})
        self.assertIn(':updated_at', values)
```

- [x] **Step 5: Run tests to verify they fail**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_client -v 2`
Expected: `ModuleNotFoundError: No module named 'game_sessions.dynamodb.testing'` (and `client`)

- [x] **Step 6: Write `game_sessions/dynamodb/testing.py`**

```python
"""Shared moto test helpers for the game_sessions DynamoDB schema.

Only imported from tests, never from application code. Mirrors the
GameSessionTable schema deployed via template.yaml (base PK/SK + GSI1)
so tests exercise the real key structure, not a simplified stand-in.
"""
import os
from unittest import TestCase

import boto3
from moto import mock_aws


def create_test_table(table_name='test-game-sessions', region_name='us-east-1'):
    """Creates the GameSessionTable schema against the active moto mock.
    Must be called inside an active @mock_aws context/decorator.
    """
    dynamodb = boto3.resource('dynamodb', region_name=region_name)
    table = dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {'AttributeName': 'PK', 'KeyType': 'HASH'},
            {'AttributeName': 'SK', 'KeyType': 'RANGE'},
        ],
        AttributeDefinitions=[
            {'AttributeName': 'PK', 'AttributeType': 'S'},
            {'AttributeName': 'SK', 'AttributeType': 'S'},
            {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},
            {'AttributeName': 'GSI1SK', 'AttributeType': 'S'},
        ],
        GlobalSecondaryIndexes=[
            {
                'IndexName': 'GSI1',
                'KeySchema': [
                    {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
                    {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'},
                ],
                'Projection': {'ProjectionType': 'ALL'},
            },
        ],
        BillingMode='PAY_PER_REQUEST',
    )
    table.wait_until_exists()
    return table


class DynamoDBTestCase(TestCase):
    """Base class for repository tests: starts a moto mock, sets the env
    vars client.get_table() reads, and creates the GameSessionTable
    schema - all torn down after each test. Subclass this instead of
    repeating the same setUp/tearDown in every repository test file."""

    def setUp(self):
        self.mock = mock_aws()
        self.mock.start()
        os.environ['GAME_SESSIONS_TABLE'] = 'test-game-sessions'
        os.environ['AWS_REGION'] = 'us-east-1'
        create_test_table('test-game-sessions')

    def tearDown(self):
        self.mock.stop()
```

- [x] **Step 7: Write `game_sessions/dynamodb/client.py`**

```python
"""boto3 DynamoDB table accessor and shared update-expression builder
for the game_sessions single-table schema."""
import os
from datetime import datetime, timezone

import boto3


def get_table():
    """Returns the boto3 DynamoDB Table resource for game_sessions data.

    Reads the table name from the GAME_SESSIONS_TABLE env var, which
    template.yaml sets on DjangoFunction via `!Ref GameSessionTable`.
    """
    dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
    return dynamodb.Table(os.environ['GAME_SESSIONS_TABLE'])


def build_update_expression(fields):
    """Builds a DynamoDB UpdateExpression + ExpressionAttributeNames +
    ExpressionAttributeValues from a dict of {field_name: new_value},
    always also setting updated_at. Uses attribute name placeholders
    throughout so reserved words (like 'status' or 'name') are safe.

    Returns (update_expression, expression_attribute_names, expression_attribute_values).
    """
    now = datetime.now(timezone.utc).isoformat()
    set_clauses = ['updated_at = :updated_at']
    names = {}
    values = {':updated_at': now}
    for i, (field_name, value) in enumerate(fields.items()):
        name_placeholder = f'#f{i}'
        value_placeholder = f':v{i}'
        set_clauses.append(f'{name_placeholder} = {value_placeholder}')
        names[name_placeholder] = field_name
        values[value_placeholder] = value
    return 'SET ' + ', '.join(set_clauses), names, values
```

- [x] **Step 8: Run tests to verify they pass**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_client -v 2`
Expected: `OK` (3 tests)

- [x] **Step 9: Commit**

```bash
git add requirements.txt game_sessions/dynamodb/__init__.py game_sessions/dynamodb/client.py game_sessions/dynamodb/testing.py game_sessions/test_dynamodb_client.py
git commit -m "feat: add DynamoDB client and moto test infrastructure for game_sessions"
```

---

### Task 2: Key-building functions

**Files:**
- Create: `game_sessions/dynamodb/keys.py`
- Test: `game_sessions/test_dynamodb_keys.py`

**Interfaces:**
- Consumes: nothing (pure functions, no dependency on Task 1)
- Produces: `session_pk`, `session_group_pk`, `tablet_pk`, `metadata_sk`, `team_sk`, `team_prefix`, `stage_sk`, `progress_sk`, `bubble_map_sk`, `tablet_connection_sk`, `roulette_sk`, `token_tx_sk_for_source`, `token_tx_sk_for_manual`, `peer_eval_sk`, `reflection_sk`, `professor_gsi1pk`, `session_gsi1sk` — all pure string-returning functions, used by every later task.

- [x] **Step 1: Write the failing tests**

Create `game_sessions/test_dynamodb_keys.py`:

```python
from unittest import TestCase

from game_sessions.dynamodb import keys


class KeysTest(TestCase):
    def test_session_pk(self):
        self.assertEqual(keys.session_pk('ABC123'), 'SESSION#ABC123')

    def test_session_group_pk(self):
        self.assertEqual(keys.session_group_pk('grp-1'), 'SESSIONGROUP#grp-1')

    def test_tablet_pk(self):
        self.assertEqual(keys.tablet_pk('T-01'), 'TABLET#T-01')

    def test_metadata_sk(self):
        self.assertEqual(keys.metadata_sk(), 'METADATA')

    def test_team_sk(self):
        self.assertEqual(keys.team_sk('team-1'), 'TEAM#team-1#METADATA')

    def test_team_prefix(self):
        self.assertEqual(keys.team_prefix('team-1'), 'TEAM#team-1#')
        self.assertTrue(keys.team_sk('team-1').startswith(keys.team_prefix('team-1')))
        self.assertTrue(keys.progress_sk('team-1', 'act-1').startswith(keys.team_prefix('team-1')))

    def test_stage_sk(self):
        self.assertEqual(keys.stage_sk(3), 'STAGE#3')

    def test_progress_sk(self):
        self.assertEqual(keys.progress_sk('team-1', 'act-1'), 'TEAM#team-1#PROGRESS#act-1')

    def test_bubble_map_sk(self):
        self.assertEqual(keys.bubble_map_sk('team-1', 2), 'TEAM#team-1#BUBBLEMAP#2')

    def test_tablet_connection_sk(self):
        self.assertEqual(keys.tablet_connection_sk('tok-1'), 'TABLETCONN#tok-1')

    def test_roulette_sk(self):
        self.assertEqual(keys.roulette_sk('team-1', 3), 'TEAM#team-1#ROULETTE#3')

    def test_token_tx_sk_for_source(self):
        self.assertEqual(
            keys.token_tx_sk_for_source('activity', 42),
            'TOKENTX#activity#42',
        )

    def test_token_tx_sk_for_manual(self):
        self.assertEqual(
            keys.token_tx_sk_for_manual('2026-07-19T10:00:00+00:00', 'uuid-1'),
            'TOKENTX#2026-07-19T10:00:00+00:00#uuid-1',
        )

    def test_peer_eval_sk(self):
        self.assertEqual(keys.peer_eval_sk('team-1', 'team-2'), 'PEEREVAL#team-1#team-2')

    def test_reflection_sk(self):
        self.assertEqual(keys.reflection_sk('uuid-1'), 'REFLECTION#uuid-1')

    def test_professor_gsi1pk(self):
        self.assertEqual(keys.professor_gsi1pk(7), 'PROFESSOR#7')

    def test_session_gsi1sk(self):
        self.assertEqual(
            keys.session_gsi1sk('lobby', '2026-07-19T10:00:00+00:00'),
            'lobby#2026-07-19T10:00:00+00:00',
        )
```

- [x] **Step 2: Run tests to verify they fail**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_keys -v 2`
Expected: `ModuleNotFoundError: No module named 'game_sessions.dynamodb.keys'`

- [x] **Step 3: Write `game_sessions/dynamodb/keys.py`**

```python
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
```

- [x] **Step 4: Run tests to verify they pass**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_keys -v 2`
Expected: `OK` (16 tests)

- [x] **Step 5: Commit**

```bash
git add game_sessions/dynamodb/keys.py game_sessions/test_dynamodb_keys.py
git commit -m "feat: add DynamoDB key-building functions for game_sessions schema"
```

---

### Task 3: GameSession repository + whole-room fetch

**Files:**
- Create: `game_sessions/dynamodb/game_session.py`
- Test: `game_sessions/test_dynamodb_game_session.py`

**Interfaces:**
- Consumes: `game_sessions.dynamodb.client.get_table`, `game_sessions.dynamodb.client.build_update_expression`, `game_sessions.dynamodb.keys.*`
- Produces: `create_session(room_code, professor_id, course_id, session_group_id=None) -> dict`; `get_session(room_code) -> dict | None`; `update_session_status(room_code, expected_status, new_status) -> bool`; `list_sessions_for_professor(professor_id, status=None) -> list[dict]`; `scan_active_sessions() -> list[dict]`; `get_room_items(room_code) -> list[dict]` — the last one is the dominant hot-path query every later real-time feature (WS hydration) will call.

- [x] **Step 1: Write the failing tests**

Create `game_sessions/test_dynamodb_game_session.py`:

```python
from game_sessions.dynamodb.testing import DynamoDBTestCase


class GameSessionRepositoryTest(DynamoDBTestCase):
    def test_create_and_get_session(self):
        from game_sessions.dynamodb.game_session import create_session, get_session

        created = create_session('ABC123', professor_id=1, course_id=2)

        self.assertEqual(created['room_code'], 'ABC123')
        self.assertEqual(created['status'], 'lobby')
        self.assertEqual(created['type'], 'GameSession')

        fetched = get_session('ABC123')
        self.assertEqual(fetched['room_code'], 'ABC123')
        self.assertEqual(fetched['professor_id'], 1)

    def test_get_session_returns_none_when_missing(self):
        from game_sessions.dynamodb.game_session import get_session

        self.assertIsNone(get_session('NOPE99'))

    def test_create_session_rejects_duplicate_room_code(self):
        from botocore.exceptions import ClientError

        from game_sessions.dynamodb.game_session import create_session

        create_session('ABC123', professor_id=1, course_id=2)

        with self.assertRaises(ClientError) as ctx:
            create_session('ABC123', professor_id=1, course_id=2)
        self.assertEqual(ctx.exception.response['Error']['Code'], 'ConditionalCheckFailedException')

    def test_update_session_status_succeeds_when_expected_matches(self):
        from game_sessions.dynamodb.game_session import create_session, get_session, update_session_status

        create_session('ABC123', professor_id=1, course_id=2)

        result = update_session_status('ABC123', expected_status='lobby', new_status='running')

        self.assertTrue(result)
        self.assertEqual(get_session('ABC123')['status'], 'running')

    def test_update_session_status_fails_when_expected_mismatches(self):
        from game_sessions.dynamodb.game_session import create_session, get_session, update_session_status

        create_session('ABC123', professor_id=1, course_id=2)
        update_session_status('ABC123', expected_status='lobby', new_status='running')

        result = update_session_status('ABC123', expected_status='lobby', new_status='cancelled')

        self.assertFalse(result)
        self.assertEqual(get_session('ABC123')['status'], 'running')

    def test_list_sessions_for_professor(self):
        from game_sessions.dynamodb.game_session import create_session, list_sessions_for_professor

        create_session('ROOM1', professor_id=9, course_id=1)
        create_session('ROOM2', professor_id=9, course_id=1)
        create_session('ROOM3', professor_id=99, course_id=1)

        results = list_sessions_for_professor(9)

        self.assertEqual({item['room_code'] for item in results}, {'ROOM1', 'ROOM2'})

    def test_list_sessions_for_professor_filtered_by_status(self):
        from game_sessions.dynamodb.game_session import (
            create_session,
            list_sessions_for_professor,
            update_session_status,
        )

        create_session('ROOM1', professor_id=9, course_id=1)
        create_session('ROOM2', professor_id=9, course_id=1)
        update_session_status('ROOM2', expected_status='lobby', new_status='running')

        lobby_only = list_sessions_for_professor(9, status='lobby')

        self.assertEqual([item['room_code'] for item in lobby_only], ['ROOM1'])

    def test_scan_active_sessions_excludes_cancelled_and_completed(self):
        from game_sessions.dynamodb.game_session import (
            create_session,
            scan_active_sessions,
            update_session_status,
        )

        create_session('ROOM1', professor_id=1, course_id=1)
        create_session('ROOM2', professor_id=2, course_id=1)
        update_session_status('ROOM2', expected_status='lobby', new_status='cancelled')

        active = scan_active_sessions()

        self.assertEqual([item['room_code'] for item in active], ['ROOM1'])

    def test_get_room_items_returns_everything_under_the_room(self):
        from game_sessions.dynamodb.client import get_table
        from game_sessions.dynamodb.game_session import create_session, get_room_items
        from game_sessions.dynamodb import keys

        create_session('ABC123', professor_id=1, course_id=2)
        table = get_table()
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.team_sk('team-1'),
            'type': 'Team',
            'name': 'Rojo',
        })

        items = get_room_items('ABC123')

        self.assertEqual(len(items), 2)
        self.assertEqual({item['type'] for item in items}, {'GameSession', 'Team'})

    def test_get_room_items_does_not_leak_across_rooms(self):
        from game_sessions.dynamodb.game_session import create_session, get_room_items

        create_session('ROOM1', professor_id=1, course_id=1)
        create_session('ROOM2', professor_id=1, course_id=1)

        items = get_room_items('ROOM1')

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['room_code'], 'ROOM1')
```

- [x] **Step 2: Run tests to verify they fail**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_game_session -v 2`
Expected: `ModuleNotFoundError: No module named 'game_sessions.dynamodb.game_session'`

- [x] **Step 3: Write `game_sessions/dynamodb/game_session.py`**

```python
"""GameSession repository - create/read/update sessions, and the
whole-room fetch that's the dominant hot path (see the spec's Access
patterns section)."""
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_session(room_code, professor_id, course_id, session_group_id=None):
    """Creates a new GameSession item in 'lobby' status. Raises
    botocore.exceptions.ClientError (ConditionalCheckFailedException) if
    room_code is already taken."""
    now = _now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.metadata_sk(),
        'type': 'GameSession',
        'room_code': room_code,
        'professor_id': professor_id,
        'course_id': course_id,
        'session_group_id': session_group_id,
        'qr_code': None,
        'status': 'lobby',
        'started_at': None,
        'ended_at': None,
        'cancellation_reason': None,
        'cancellation_reason_other': None,
        'current_stage_id': None,
        'current_activity_id': None,
        'show_results_stage': 0,
        'created_at': now,
        'updated_at': now,
        'GSI1PK': keys.professor_gsi1pk(professor_id),
        'GSI1SK': keys.session_gsi1sk('lobby', now),
    }
    table = get_table()
    table.put_item(
        Item=item,
        ConditionExpression='attribute_not_exists(PK)',
    )
    return item


def get_session(room_code):
    """Returns the GameSession item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.metadata_sk()},
    )
    return response.get('Item')


def update_session_status(room_code, expected_status, new_status):
    """Conditionally transitions status. Returns True if the transition
    happened, False if expected_status didn't match (someone else
    already transitioned it - e.g. a race between a professor action and
    a future expiry-check job)."""
    now = _now_iso()
    table = get_table()
    try:
        table.update_item(
            Key={'PK': keys.session_pk(room_code), 'SK': keys.metadata_sk()},
            UpdateExpression='SET #status = :new_status, updated_at = :now, GSI1SK = :gsi1sk',
            ConditionExpression='#status = :expected_status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':new_status': new_status,
                ':expected_status': expected_status,
                ':now': now,
                ':gsi1sk': keys.session_gsi1sk(new_status, now),
            },
        )
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return False
        raise


def list_sessions_for_professor(professor_id, status=None):
    """Returns GameSession items for a professor, newest-created first
    within whatever status filter is given. Pass status to filter to
    just that status (e.g. 'lobby')."""
    table = get_table()
    key_condition = Key('GSI1PK').eq(keys.professor_gsi1pk(professor_id))
    if status:
        key_condition &= Key('GSI1SK').begins_with(f'{status}#')
    response = table.query(
        IndexName='GSI1',
        KeyConditionExpression=key_condition,
        ScanIndexForward=False,
    )
    return [item for item in response['Items'] if item['type'] == 'GameSession']


def scan_active_sessions():
    """Returns all GameSession items currently in 'lobby' or 'running'
    status, across every professor. A filtered Scan, not a Query - see
    the spec's Access patterns section for why that's the right call
    here (low-frequency, small item count at course-project scale).

    Deciding *which* of these have actually expired (e.g. "2 hours since
    creation or start") is the caller's responsibility - out of scope
    here, see the separate cancel_expired_sessions -> EventBridge task.
    """
    table = get_table()
    response = table.scan(
        FilterExpression=Attr('type').eq('GameSession') & Attr('status').is_in(['lobby', 'running']),
    )
    return response['Items']


def get_room_items(room_code):
    """The dominant hot path: one Query returns every item belonging to
    a room (the GameSession itself, all teams, progress, connections,
    tokens, evaluations) in a single round trip."""
    table = get_table()
    response = table.query(
        KeyConditionExpression=Key('PK').eq(keys.session_pk(room_code)),
    )
    return response['Items']
```

- [x] **Step 4: Run tests to verify they pass**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_game_session -v 2`
Expected: `OK` (9 tests)

- [x] **Step 5: Commit**

```bash
git add game_sessions/dynamodb/game_session.py game_sessions/test_dynamodb_game_session.py
git commit -m "feat: add GameSession DynamoDB repository and whole-room query"
```

---

### Task 4: Team repository (with embedded personalization + roster)

**Files:**
- Create: `game_sessions/dynamodb/team.py`
- Test: `game_sessions/test_dynamodb_team.py`

**Interfaces:**
- Consumes: `game_sessions.dynamodb.client.get_table`, `game_sessions.dynamodb.keys.*`
- Produces: `create_team(room_code, name, color) -> dict`; `get_team(room_code, team_id) -> dict | None`; `list_teams(room_code) -> list[dict]`; `add_student(room_code, team_id, student_id) -> dict | None`; `update_tokens(room_code, team_id, delta) -> int`

- [x] **Step 1: Write the failing tests**

Create `game_sessions/test_dynamodb_team.py`:

```python
from game_sessions.dynamodb.testing import DynamoDBTestCase


class TeamRepositoryTest(DynamoDBTestCase):
    def test_create_and_get_team(self):
        from game_sessions.dynamodb.team import create_team, get_team

        created = create_team('ABC123', name='Rojo', color='red')

        self.assertEqual(created['name'], 'Rojo')
        self.assertEqual(created['tokens_total'], 0)
        self.assertEqual(created['student_ids'], [])
        self.assertEqual(created['type'], 'Team')

        fetched = get_team('ABC123', created['team_id'])
        self.assertEqual(fetched['name'], 'Rojo')

    def test_get_team_returns_none_when_missing(self):
        from game_sessions.dynamodb.team import get_team

        self.assertIsNone(get_team('ABC123', 'nope'))

    def test_list_teams_excludes_child_items(self):
        from game_sessions.dynamodb.client import get_table
        from game_sessions.dynamodb.team import create_team, list_teams
        from game_sessions.dynamodb import keys

        team = create_team('ABC123', name='Rojo', color='red')
        create_team('ABC123', name='Azul', color='blue')
        # A progress item under the same team, sharing the TEAM# prefix -
        # list_teams must not return this.
        table = get_table()
        table.put_item(Item={
            'PK': keys.session_pk('ABC123'),
            'SK': keys.progress_sk(team['team_id'], 'act-1'),
            'type': 'TeamActivityProgress',
        })

        teams = list_teams('ABC123')

        self.assertEqual(len(teams), 2)
        self.assertEqual({t['type'] for t in teams}, {'Team'})

    def test_add_student_appends_to_roster(self):
        from game_sessions.dynamodb.team import add_student, create_team, get_team

        team = create_team('ABC123', name='Rojo', color='red')

        result = add_student('ABC123', team['team_id'], student_id=101)

        self.assertEqual(result['student_ids'], [101])
        self.assertEqual(get_team('ABC123', team['team_id'])['student_ids'], [101])

    def test_add_student_is_idempotent(self):
        from game_sessions.dynamodb.team import add_student, create_team

        team = create_team('ABC123', name='Rojo', color='red')

        add_student('ABC123', team['team_id'], student_id=101)
        result = add_student('ABC123', team['team_id'], student_id=101)

        self.assertEqual(result['student_ids'], [101])

    def test_add_student_returns_none_when_team_missing(self):
        from game_sessions.dynamodb.team import add_student

        self.assertIsNone(add_student('ABC123', 'nope', student_id=1))

    def test_update_tokens_adds_delta(self):
        from game_sessions.dynamodb.team import create_team, get_team, update_tokens

        team = create_team('ABC123', name='Rojo', color='red')

        new_total = update_tokens('ABC123', team['team_id'], delta=10)

        self.assertEqual(new_total, 10)
        self.assertEqual(get_team('ABC123', team['team_id'])['tokens_total'], 10)

    def test_update_tokens_accumulates_across_calls(self):
        from game_sessions.dynamodb.team import create_team, update_tokens

        team = create_team('ABC123', name='Rojo', color='red')

        update_tokens('ABC123', team['team_id'], delta=10)
        second_total = update_tokens('ABC123', team['team_id'], delta=-3)

        self.assertEqual(second_total, 7)

    def test_update_tokens_can_go_negative(self):
        from game_sessions.dynamodb.team import create_team, update_tokens

        team = create_team('ABC123', name='Rojo', color='red')

        total = update_tokens('ABC123', team['team_id'], delta=-5)

        self.assertEqual(total, -5)
```

- [x] **Step 2: Run tests to verify they fail**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_team -v 2`
Expected: `ModuleNotFoundError: No module named 'game_sessions.dynamodb.team'`

- [x] **Step 3: Write `game_sessions/dynamodb/team.py`**

```python
"""Team repository - embeds TeamPersonalization and the student roster
as nested attributes (both 1:1/tiny and always fetched with the team)."""
import uuid
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_team(room_code, name, color):
    """Creates a new Team item with an empty roster and zero tokens."""
    team_id = str(uuid.uuid4())
    now = _now_iso()
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
        now = _now_iso()
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
    concurrent awards from different sources never lose an update."""
    table = get_table()
    response = table.update_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.team_sk(team_id)},
        UpdateExpression='ADD #tokens :delta SET updated_at = :now',
        ExpressionAttributeNames={'#tokens': 'tokens_total'},
        ExpressionAttributeValues={':delta': delta, ':now': _now_iso()},
        ReturnValues='UPDATED_NEW',
    )
    return int(response['Attributes']['tokens_total'])
```

- [x] **Step 4: Run tests to verify they pass**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_team -v 2`
Expected: `OK` (9 tests)

- [x] **Step 5: Commit**

```bash
git add game_sessions/dynamodb/team.py game_sessions/test_dynamodb_team.py
git commit -m "feat: add Team DynamoDB repository with roster and token operations"
```

---

### Task 5: SessionStage + TeamActivityProgress repository

**Files:**
- Create: `game_sessions/dynamodb/stage_progress.py`
- Test: `game_sessions/test_dynamodb_stage_progress.py`

**Interfaces:**
- Consumes: `game_sessions.dynamodb.client.get_table`, `game_sessions.dynamodb.client.build_update_expression`, `game_sessions.dynamodb.keys.*`
- Produces: `create_session_stage(room_code, stage_id) -> dict`; `get_session_stage(room_code, stage_id) -> dict | None`; `update_session_stage(room_code, stage_id, **fields) -> dict`; `upsert_progress(room_code, team_id, activity_id, **fields) -> dict`; `get_progress(room_code, team_id, activity_id) -> dict | None`

- [x] **Step 1: Write the failing tests**

Create `game_sessions/test_dynamodb_stage_progress.py`:

```python
from game_sessions.dynamodb.testing import DynamoDBTestCase


class StageProgressRepositoryTest(DynamoDBTestCase):
    def test_create_and_get_session_stage(self):
        from game_sessions.dynamodb.stage_progress import create_session_stage, get_session_stage

        created = create_session_stage('ABC123', stage_id=1)

        self.assertEqual(created['status'], 'pending')
        self.assertEqual(created['type'], 'SessionStage')

        fetched = get_session_stage('ABC123', stage_id=1)
        self.assertEqual(fetched['stage_id'], 1)

    def test_get_session_stage_returns_none_when_missing(self):
        from game_sessions.dynamodb.stage_progress import get_session_stage

        self.assertIsNone(get_session_stage('ABC123', stage_id=99))

    def test_update_session_stage_partial_update(self):
        from game_sessions.dynamodb.stage_progress import create_session_stage, update_session_stage

        create_session_stage('ABC123', stage_id=1)

        updated = update_session_stage('ABC123', stage_id=1, status='in_progress', started_at='2026-07-19T10:00:00+00:00')

        self.assertEqual(updated['status'], 'in_progress')
        self.assertEqual(updated['started_at'], '2026-07-19T10:00:00+00:00')

    def test_update_session_stage_handles_reserved_word_status(self):
        # 'status' is a DynamoDB reserved word - this test exists
        # specifically to catch a regression to a bare (unaliased)
        # attribute name in the UpdateExpression.
        from game_sessions.dynamodb.stage_progress import create_session_stage, update_session_stage

        create_session_stage('ABC123', stage_id=1)

        updated = update_session_stage('ABC123', stage_id=1, status='completed')

        self.assertEqual(updated['status'], 'completed')

    def test_upsert_and_get_progress(self):
        from game_sessions.dynamodb.stage_progress import get_progress, upsert_progress

        created = upsert_progress(
            'ABC123', team_id='team-1', activity_id='act-1',
            status='in_progress', progress_percentage=50,
        )

        self.assertEqual(created['status'], 'in_progress')
        self.assertEqual(created['progress_percentage'], 50)
        self.assertEqual(created['type'], 'TeamActivityProgress')

        fetched = get_progress('ABC123', team_id='team-1', activity_id='act-1')
        self.assertEqual(fetched['progress_percentage'], 50)

    def test_upsert_progress_overwrites_previous_value(self):
        from game_sessions.dynamodb.stage_progress import get_progress, upsert_progress

        upsert_progress('ABC123', team_id='team-1', activity_id='act-1', status='in_progress', progress_percentage=50)
        upsert_progress('ABC123', team_id='team-1', activity_id='act-1', status='completed', progress_percentage=100)

        fetched = get_progress('ABC123', team_id='team-1', activity_id='act-1')
        self.assertEqual(fetched['status'], 'completed')
        self.assertEqual(fetched['progress_percentage'], 100)

    def test_get_progress_returns_none_when_missing(self):
        from game_sessions.dynamodb.stage_progress import get_progress

        self.assertIsNone(get_progress('ABC123', team_id='nope', activity_id='nope'))
```

- [x] **Step 2: Run tests to verify they fail**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_stage_progress -v 2`
Expected: `ModuleNotFoundError: No module named 'game_sessions.dynamodb.stage_progress'`

- [x] **Step 3: Write `game_sessions/dynamodb/stage_progress.py`**

```python
"""SessionStage and TeamActivityProgress repository."""
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import build_update_expression, get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_session_stage(room_code, stage_id):
    """Creates a new SessionStage item in 'pending' status."""
    now = _now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.stage_sk(stage_id),
        'type': 'SessionStage',
        'stage_id': stage_id,
        'room_code': room_code,
        'status': 'pending',
        'started_at': None,
        'completed_at': None,
        'presentation_order': None,
        'current_presentation_team_id': None,
        'presentation_state': 'not_started',
        'presentation_timestamps': None,
        'created_at': now,
        'updated_at': now,
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_session_stage(room_code, stage_id):
    """Returns the SessionStage item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.stage_sk(stage_id)},
    )
    return response.get('Item')


def update_session_stage(room_code, stage_id, **fields):
    """Partial update - pass any subset of status/started_at/
    completed_at/presentation_order/current_presentation_team_id/
    presentation_state/presentation_timestamps as keyword arguments."""
    table = get_table()
    update_expression, names, values = build_update_expression(fields)
    response = table.update_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.stage_sk(stage_id)},
        UpdateExpression=update_expression,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues='ALL_NEW',
    )
    return response['Attributes']


def upsert_progress(room_code, team_id, activity_id, **fields):
    """Creates or fully overwrites a TeamActivityProgress item. Uses a
    full put (not a partial update) because progress fields are
    typically saved together as one unit, matching how the Django
    serializer currently sets response_data wholesale."""
    now = _now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.progress_sk(team_id, activity_id),
        'type': 'TeamActivityProgress',
        'team_id': team_id,
        'activity_id': activity_id,
        'room_code': room_code,
        'status': fields.get('status', 'pending'),
        'started_at': fields.get('started_at'),
        'completed_at': fields.get('completed_at'),
        'progress_percentage': fields.get('progress_percentage', 0),
        'response_data': fields.get('response_data'),
        'selected_topic_id': fields.get('selected_topic_id'),
        'selected_challenge_id': fields.get('selected_challenge_id'),
        'prototype_image_url': fields.get('prototype_image_url'),
        'pitch_intro_problem': fields.get('pitch_intro_problem'),
        'pitch_solution': fields.get('pitch_solution'),
        'pitch_value': fields.get('pitch_value'),
        'pitch_impact': fields.get('pitch_impact'),
        'pitch_closing': fields.get('pitch_closing'),
        'created_at': now,
        'updated_at': now,
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_progress(room_code, team_id, activity_id):
    """Returns the TeamActivityProgress item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.progress_sk(team_id, activity_id)},
    )
    return response.get('Item')
```

- [x] **Step 4: Run tests to verify they pass**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_stage_progress -v 2`
Expected: `OK` (7 tests)

- [x] **Step 5: Commit**

```bash
git add game_sessions/dynamodb/stage_progress.py game_sessions/test_dynamodb_stage_progress.py
git commit -m "feat: add SessionStage and TeamActivityProgress DynamoDB repository"
```

---

### Task 6: TeamBubbleMap + TeamRouletteAssignment repository

**Files:**
- Create: `game_sessions/dynamodb/bubble_roulette.py`
- Test: `game_sessions/test_dynamodb_bubble_roulette.py`

**Interfaces:**
- Consumes: `game_sessions.dynamodb.client.get_table`, `game_sessions.dynamodb.client.build_update_expression`, `game_sessions.dynamodb.keys.*`
- Produces: `upsert_bubble_map(room_code, team_id, stage_id, map_data) -> dict`; `get_bubble_map(room_code, team_id, stage_id) -> dict | None`; `create_roulette_assignment(room_code, team_id, stage_id, roulette_challenge_id, token_reward=0) -> dict`; `get_roulette_assignment(room_code, team_id, stage_id) -> dict | None`; `update_roulette_assignment(room_code, team_id, stage_id, **fields) -> dict`

- [x] **Step 1: Write the failing tests**

Create `game_sessions/test_dynamodb_bubble_roulette.py`:

```python
from game_sessions.dynamodb.testing import DynamoDBTestCase


class BubbleRouletteRepositoryTest(DynamoDBTestCase):
    def test_upsert_and_get_bubble_map(self):
        from game_sessions.dynamodb.bubble_roulette import get_bubble_map, upsert_bubble_map

        map_data = {'nodes': [{'id': 1, 'text': 'idea'}], 'edges': []}
        created = upsert_bubble_map('ABC123', team_id='team-1', stage_id=2, map_data=map_data)

        self.assertEqual(created['map_data'], map_data)
        self.assertEqual(created['type'], 'TeamBubbleMap')

        fetched = get_bubble_map('ABC123', team_id='team-1', stage_id=2)
        self.assertEqual(fetched['map_data'], map_data)

    def test_upsert_bubble_map_overwrites(self):
        from game_sessions.dynamodb.bubble_roulette import get_bubble_map, upsert_bubble_map

        upsert_bubble_map('ABC123', team_id='team-1', stage_id=2, map_data={'nodes': [], 'edges': []})
        upsert_bubble_map('ABC123', team_id='team-1', stage_id=2, map_data={'nodes': [{'id': 1}], 'edges': []})

        fetched = get_bubble_map('ABC123', team_id='team-1', stage_id=2)
        self.assertEqual(fetched['map_data'], {'nodes': [{'id': 1}], 'edges': []})

    def test_get_bubble_map_returns_none_when_missing(self):
        from game_sessions.dynamodb.bubble_roulette import get_bubble_map

        self.assertIsNone(get_bubble_map('ABC123', team_id='nope', stage_id=1))

    def test_create_and_get_roulette_assignment(self):
        from game_sessions.dynamodb.bubble_roulette import create_roulette_assignment, get_roulette_assignment

        created = create_roulette_assignment('ABC123', team_id='team-1', stage_id=3, roulette_challenge_id=5, token_reward=20)

        self.assertEqual(created['status'], 'assigned')
        self.assertEqual(created['token_reward'], 20)
        self.assertEqual(created['type'], 'TeamRouletteAssignment')

        fetched = get_roulette_assignment('ABC123', team_id='team-1', stage_id=3)
        self.assertEqual(fetched['roulette_challenge_id'], 5)

    def test_get_roulette_assignment_returns_none_when_missing(self):
        from game_sessions.dynamodb.bubble_roulette import get_roulette_assignment

        self.assertIsNone(get_roulette_assignment('ABC123', team_id='nope', stage_id=1))

    def test_update_roulette_assignment_partial_update(self):
        from game_sessions.dynamodb.bubble_roulette import create_roulette_assignment, update_roulette_assignment

        create_roulette_assignment('ABC123', team_id='team-1', stage_id=3, roulette_challenge_id=5)

        updated = update_roulette_assignment(
            'ABC123', team_id='team-1', stage_id=3,
            status='accepted', accepted_at='2026-07-19T10:00:00+00:00',
        )

        self.assertEqual(updated['status'], 'accepted')
        self.assertEqual(updated['accepted_at'], '2026-07-19T10:00:00+00:00')
```

- [x] **Step 2: Run tests to verify they fail**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_bubble_roulette -v 2`
Expected: `ModuleNotFoundError: No module named 'game_sessions.dynamodb.bubble_roulette'`

- [x] **Step 3: Write `game_sessions/dynamodb/bubble_roulette.py`**

```python
"""TeamBubbleMap and TeamRouletteAssignment repository."""
from datetime import datetime, timezone

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import build_update_expression, get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def upsert_bubble_map(room_code, team_id, stage_id, map_data):
    """Creates or fully overwrites a TeamBubbleMap item - the frontend
    always saves the whole map_data blob together, matching the current
    Django model's single JSONField."""
    now = _now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.bubble_map_sk(team_id, stage_id),
        'type': 'TeamBubbleMap',
        'team_id': team_id,
        'stage_id': stage_id,
        'room_code': room_code,
        'map_data': map_data,
        'created_at': now,
        'updated_at': now,
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_bubble_map(room_code, team_id, stage_id):
    """Returns the TeamBubbleMap item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.bubble_map_sk(team_id, stage_id)},
    )
    return response.get('Item')


def create_roulette_assignment(room_code, team_id, stage_id, roulette_challenge_id, token_reward=0):
    """Creates a new TeamRouletteAssignment item in 'assigned' status."""
    now = _now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.roulette_sk(team_id, stage_id),
        'type': 'TeamRouletteAssignment',
        'team_id': team_id,
        'stage_id': stage_id,
        'room_code': room_code,
        'roulette_challenge_id': roulette_challenge_id,
        'status': 'assigned',
        'token_reward': token_reward,
        'assigned_at': now,
        'accepted_at': None,
        'rejected_at': None,
        'completed_at': None,
        'validated_by_id': None,
        'created_at': now,
        'updated_at': now,
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_roulette_assignment(room_code, team_id, stage_id):
    """Returns the TeamRouletteAssignment item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.roulette_sk(team_id, stage_id)},
    )
    return response.get('Item')


def update_roulette_assignment(room_code, team_id, stage_id, **fields):
    """Partial update - pass any subset of status/token_reward/
    accepted_at/rejected_at/completed_at/validated_by_id as keyword
    arguments."""
    table = get_table()
    update_expression, names, values = build_update_expression(fields)
    response = table.update_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.roulette_sk(team_id, stage_id)},
        UpdateExpression=update_expression,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues='ALL_NEW',
    )
    return response['Attributes']
```

- [x] **Step 4: Run tests to verify they pass**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_bubble_roulette -v 2`
Expected: `OK` (6 tests)

- [x] **Step 5: Commit**

```bash
git add game_sessions/dynamodb/bubble_roulette.py game_sessions/test_dynamodb_bubble_roulette.py
git commit -m "feat: add TeamBubbleMap and TeamRouletteAssignment DynamoDB repository"
```

---

### Task 7: TabletConnection repository

**Files:**
- Create: `game_sessions/dynamodb/tablet_connection.py`
- Test: `game_sessions/test_dynamodb_tablet_connection.py`

**Interfaces:**
- Consumes: `game_sessions.dynamodb.client.get_table`, `game_sessions.dynamodb.keys.*`
- Produces: `create_connection(room_code, team_id, tablet_id=None) -> dict`; `get_connection(room_code, team_session_token) -> dict | None`; `update_heartbeat(room_code, team_session_token, current_screen=None) -> dict`; `disconnect(room_code, team_session_token) -> dict`; `list_connections(room_code) -> list[dict]`

- [x] **Step 1: Write the failing tests**

Create `game_sessions/test_dynamodb_tablet_connection.py`:

```python
from game_sessions.dynamodb.testing import DynamoDBTestCase


class TabletConnectionRepositoryTest(DynamoDBTestCase):
    def test_create_and_get_connection(self):
        from game_sessions.dynamodb.tablet_connection import create_connection, get_connection

        created = create_connection('ABC123', team_id='team-1', tablet_id='tablet-1')

        self.assertEqual(created['team_id'], 'team-1')
        self.assertEqual(created['current_screen'], '')
        self.assertIsNone(created['disconnected_at'])
        self.assertEqual(created['type'], 'TabletConnection')

        fetched = get_connection('ABC123', created['team_session_token'])
        self.assertEqual(fetched['team_id'], 'team-1')

    def test_get_connection_returns_none_when_missing(self):
        from game_sessions.dynamodb.tablet_connection import get_connection

        self.assertIsNone(get_connection('ABC123', 'nonexistent-token'))

    def test_update_heartbeat_updates_last_seen_and_screen(self):
        from game_sessions.dynamodb.tablet_connection import create_connection, update_heartbeat

        created = create_connection('ABC123', team_id='team-1')
        original_last_seen = created['last_seen']

        updated = update_heartbeat('ABC123', created['team_session_token'], current_screen='results_1')

        self.assertEqual(updated['current_screen'], 'results_1')
        self.assertGreaterEqual(updated['last_seen'], original_last_seen)

    def test_update_heartbeat_without_screen_keeps_existing_screen(self):
        from game_sessions.dynamodb.tablet_connection import (
            create_connection,
            get_connection,
            update_heartbeat,
        )

        created = create_connection('ABC123', team_id='team-1')
        update_heartbeat('ABC123', created['team_session_token'], current_screen='lobby')

        update_heartbeat('ABC123', created['team_session_token'])

        self.assertEqual(get_connection('ABC123', created['team_session_token'])['current_screen'], 'lobby')

    def test_disconnect_sets_disconnected_at(self):
        from game_sessions.dynamodb.tablet_connection import create_connection, disconnect

        created = create_connection('ABC123', team_id='team-1')

        updated = disconnect('ABC123', created['team_session_token'])

        self.assertIsNotNone(updated['disconnected_at'])

    def test_list_connections_returns_all_in_room(self):
        from game_sessions.dynamodb.tablet_connection import create_connection, list_connections

        create_connection('ABC123', team_id='team-1')
        create_connection('ABC123', team_id='team-2')

        connections = list_connections('ABC123')

        self.assertEqual(len(connections), 2)
```

- [x] **Step 2: Run tests to verify they fail**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_tablet_connection -v 2`
Expected: `ModuleNotFoundError: No module named 'game_sessions.dynamodb.tablet_connection'`

- [x] **Step 3: Write `game_sessions/dynamodb/tablet_connection.py`**

```python
"""TabletConnection repository - "this tablet is in this room/team right
now", distinct from the Tablet catalog entity (see catalog.py)."""
import uuid
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_connection(room_code, team_id, tablet_id=None):
    """Creates a new TabletConnection item. team_session_token is a
    fresh UUID4, matching the current Django field's default."""
    team_session_token = str(uuid.uuid4())
    now = _now_iso()
    item = {
        'PK': keys.session_pk(room_code),
        'SK': keys.tablet_connection_sk(team_session_token),
        'type': 'TabletConnection',
        'team_session_token': team_session_token,
        'team_id': team_id,
        'room_code': room_code,
        'tablet_id': tablet_id,
        'connected_at': now,
        'disconnected_at': None,
        'last_seen': now,
        'current_screen': '',
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_connection(room_code, team_session_token):
    """Returns the TabletConnection item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.tablet_connection_sk(team_session_token)},
    )
    return response.get('Item')


def update_heartbeat(room_code, team_session_token, current_screen=None):
    """Updates last_seen to now, and current_screen if given (keeps the
    existing value otherwise)."""
    table = get_table()
    now = _now_iso()
    if current_screen is not None:
        update_expression = 'SET last_seen = :now, current_screen = :screen'
        values = {':now': now, ':screen': current_screen}
    else:
        update_expression = 'SET last_seen = :now'
        values = {':now': now}
    response = table.update_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.tablet_connection_sk(team_session_token)},
        UpdateExpression=update_expression,
        ExpressionAttributeValues=values,
        ReturnValues='ALL_NEW',
    )
    return response['Attributes']


def disconnect(room_code, team_session_token):
    """Marks a connection as disconnected (sets disconnected_at)."""
    table = get_table()
    response = table.update_item(
        Key={'PK': keys.session_pk(room_code), 'SK': keys.tablet_connection_sk(team_session_token)},
        UpdateExpression='SET disconnected_at = :now',
        ExpressionAttributeValues={':now': _now_iso()},
        ReturnValues='ALL_NEW',
    )
    return response['Attributes']


def list_connections(room_code):
    """Returns every TabletConnection item in a room. TABLETCONN# is a
    prefix not shared with any other entity type, so no `type` filter
    is needed here (unlike TEAM#)."""
    table = get_table()
    response = table.query(
        KeyConditionExpression=Key('PK').eq(keys.session_pk(room_code)) & Key('SK').begins_with('TABLETCONN#'),
    )
    return response['Items']
```

- [x] **Step 4: Run tests to verify they pass**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_tablet_connection -v 2`
Expected: `OK` (6 tests)

- [x] **Step 5: Commit**

```bash
git add game_sessions/dynamodb/tablet_connection.py game_sessions/test_dynamodb_tablet_connection.py
git commit -m "feat: add TabletConnection DynamoDB repository"
```

---

### Task 8: TokenTransaction repository (idempotent ledger)

**Files:**
- Create: `game_sessions/dynamodb/token_transaction.py`
- Test: `game_sessions/test_dynamodb_token_transaction.py`

**Interfaces:**
- Consumes: `game_sessions.dynamodb.client.get_table`, `game_sessions.dynamodb.keys.*`
- Produces: `create_transaction(room_code, team_id, amount, source_type, source_id=None, session_stage_id=None, reason=None, awarded_by_id=None) -> dict | None`; `list_transactions(room_code) -> list[dict]`

- [x] **Step 1: Write the failing tests**

Create `game_sessions/test_dynamodb_token_transaction.py`:

```python
from game_sessions.dynamodb.testing import DynamoDBTestCase


class TokenTransactionRepositoryTest(DynamoDBTestCase):
    def test_create_transaction_with_source_id(self):
        from game_sessions.dynamodb.token_transaction import create_transaction

        created = create_transaction(
            'ABC123', team_id='team-1', amount=10,
            source_type='activity', source_id=42,
        )

        self.assertEqual(created['amount'], 10)
        self.assertEqual(created['source_type'], 'activity')
        self.assertEqual(created['type'], 'TokenTransaction')

    def test_create_transaction_is_idempotent_for_same_source(self):
        from game_sessions.dynamodb.token_transaction import create_transaction, list_transactions

        first = create_transaction('ABC123', team_id='team-1', amount=10, source_type='activity', source_id=42)
        second = create_transaction('ABC123', team_id='team-1', amount=10, source_type='activity', source_id=42)

        self.assertIsNotNone(first)
        self.assertIsNone(second)
        self.assertEqual(len(list_transactions('ABC123')), 1)

    def test_create_transaction_without_source_id_is_never_deduplicated(self):
        from game_sessions.dynamodb.token_transaction import create_transaction, list_transactions

        create_transaction('ABC123', team_id='team-1', amount=5, source_type='manual_adjustment')
        create_transaction('ABC123', team_id='team-1', amount=5, source_type='manual_adjustment')

        self.assertEqual(len(list_transactions('ABC123')), 2)

    def test_list_transactions_returns_all_in_room(self):
        from game_sessions.dynamodb.token_transaction import create_transaction, list_transactions

        create_transaction('ABC123', team_id='team-1', amount=10, source_type='activity', source_id=1)
        create_transaction('ABC123', team_id='team-2', amount=5, source_type='activity', source_id=2)

        transactions = list_transactions('ABC123')

        self.assertEqual(len(transactions), 2)
        self.assertEqual({t['team_id'] for t in transactions}, {'team-1', 'team-2'})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_token_transaction -v 2`
Expected: `ModuleNotFoundError: No module named 'game_sessions.dynamodb.token_transaction'`

- [x] **Step 3: Write `game_sessions/dynamodb/token_transaction.py`**

```python
"""TokenTransaction repository - an append-only ledger. Source-tied
transactions (source_id is not None) are idempotent: a retried write for
the same (source_type, source_id) is rejected instead of double-awarding
tokens. See the spec's Concurrency section."""
import uuid
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_transaction(room_code, team_id, amount, source_type, source_id=None,
                        session_stage_id=None, reason=None, awarded_by_id=None):
    """Creates a TokenTransaction item. Returns None instead of raising
    if this (source_type, source_id) pair was already recorded - that's
    the expected outcome of a retried write, not an error."""
    now = _now_iso()
    if source_id is not None:
        sk = keys.token_tx_sk_for_source(source_type, source_id)
    else:
        sk = keys.token_tx_sk_for_manual(now, str(uuid.uuid4()))

    item = {
        'PK': keys.session_pk(room_code),
        'SK': sk,
        'type': 'TokenTransaction',
        'room_code': room_code,
        'team_id': team_id,
        'session_stage_id': session_stage_id,
        'amount': amount,
        'source_type': source_type,
        'source_id': source_id,
        'reason': reason,
        'awarded_by_id': awarded_by_id,
        'created_at': now,
    }
    table = get_table()
    try:
        table.put_item(Item=item, ConditionExpression='attribute_not_exists(PK)')
        return item
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise


def list_transactions(room_code):
    """Returns every TokenTransaction item in a room. Not guaranteed
    chronologically ordered by SK (source-tied and manual entries use
    different SK shapes) - sort by created_at if order matters."""
    table = get_table()
    response = table.query(
        KeyConditionExpression=Key('PK').eq(keys.session_pk(room_code)) & Key('SK').begins_with('TOKENTX#'),
    )
    return response['Items']
```

- [x] **Step 4: Run tests to verify they pass**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_token_transaction -v 2`
Expected: `OK` (4 tests)

- [x] **Step 5: Commit**

```bash
git add game_sessions/dynamodb/token_transaction.py game_sessions/test_dynamodb_token_transaction.py
git commit -m "feat: add idempotent TokenTransaction DynamoDB repository"
```

---

### Task 9: PeerEvaluation + ReflectionEvaluation repository

**Files:**
- Create: `game_sessions/dynamodb/evaluations.py`
- Test: `game_sessions/test_dynamodb_evaluations.py`

**Interfaces:**
- Consumes: `game_sessions.dynamodb.client.get_table`, `game_sessions.dynamodb.keys.*`
- Produces: `create_peer_evaluation(room_code, evaluator_team_id, evaluated_team_id, criteria_scores, total_score, tokens_awarded=0, feedback=None) -> dict | None`; `list_peer_evaluations(room_code) -> list[dict]`; `create_reflection(room_code, student_name, student_email, value_areas=None, faculty=None, career=None, satisfaction=None, entrepreneurship_interest=None, comments=None) -> dict`

- [x] **Step 1: Write the failing tests**

Create `game_sessions/test_dynamodb_evaluations.py`:

```python
from game_sessions.dynamodb.testing import DynamoDBTestCase


class EvaluationsRepositoryTest(DynamoDBTestCase):
    def test_create_peer_evaluation(self):
        from game_sessions.dynamodb.evaluations import create_peer_evaluation

        created = create_peer_evaluation(
            'ABC123', evaluator_team_id='team-1', evaluated_team_id='team-2',
            criteria_scores={'teamwork': 5}, total_score=5,
        )

        self.assertEqual(created['total_score'], 5)
        self.assertEqual(created['type'], 'PeerEvaluation')

    def test_create_peer_evaluation_rejects_duplicate_pair(self):
        from game_sessions.dynamodb.evaluations import create_peer_evaluation

        create_peer_evaluation('ABC123', evaluator_team_id='team-1', evaluated_team_id='team-2', criteria_scores={}, total_score=5)
        result = create_peer_evaluation('ABC123', evaluator_team_id='team-1', evaluated_team_id='team-2', criteria_scores={}, total_score=3)

        self.assertIsNone(result)

    def test_list_peer_evaluations(self):
        from game_sessions.dynamodb.evaluations import create_peer_evaluation, list_peer_evaluations

        create_peer_evaluation('ABC123', evaluator_team_id='team-1', evaluated_team_id='team-2', criteria_scores={}, total_score=5)
        create_peer_evaluation('ABC123', evaluator_team_id='team-2', evaluated_team_id='team-1', criteria_scores={}, total_score=4)

        results = list_peer_evaluations('ABC123')

        self.assertEqual(len(results), 2)

    def test_create_reflection(self):
        from game_sessions.dynamodb.evaluations import create_reflection

        created = create_reflection(
            'ABC123', student_name='Ana Perez', student_email='ana@udd.cl',
            value_areas=['empatizar'], satisfaction='mucho',
        )

        self.assertEqual(created['student_email'], 'ana@udd.cl')
        self.assertEqual(created['value_areas'], ['empatizar'])
        self.assertEqual(created['type'], 'ReflectionEvaluation')

    def test_create_reflection_defaults_value_areas_to_empty_list(self):
        from game_sessions.dynamodb.evaluations import create_reflection

        created = create_reflection('ABC123', student_name='Ana Perez', student_email='ana@udd.cl')

        self.assertEqual(created['value_areas'], [])
```

- [x] **Step 2: Run tests to verify they fail**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_evaluations -v 2`
Expected: `ModuleNotFoundError: No module named 'game_sessions.dynamodb.evaluations'`

- [x] **Step 3: Write `game_sessions/dynamodb/evaluations.py`**

```python
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
```

- [x] **Step 4: Run tests to verify they pass**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_evaluations -v 2`
Expected: `OK` (5 tests)

- [x] **Step 5: Commit**

```bash
git add game_sessions/dynamodb/evaluations.py game_sessions/test_dynamodb_evaluations.py
git commit -m "feat: add PeerEvaluation and ReflectionEvaluation DynamoDB repository"
```

---

### Task 10: SessionGroup + Tablet repository

**Files:**
- Create: `game_sessions/dynamodb/catalog.py`
- Test: `game_sessions/test_dynamodb_catalog.py`

**Interfaces:**
- Consumes: `game_sessions.dynamodb.client.get_table`, `game_sessions.dynamodb.keys.*`
- Produces: `create_session_group(professor_id, course_id, total_students, number_of_sessions) -> dict`; `get_session_group(session_group_id) -> dict | None`; `list_session_groups_for_professor(professor_id) -> list[dict]`; `create_tablet(tablet_code) -> dict | None`; `get_tablet(tablet_code) -> dict | None`; `deactivate_tablet(tablet_code) -> dict`

- [x] **Step 1: Write the failing tests**

Create `game_sessions/test_dynamodb_catalog.py`:

```python
from game_sessions.dynamodb.testing import DynamoDBTestCase


class CatalogRepositoryTest(DynamoDBTestCase):
    def test_create_and_get_session_group(self):
        from game_sessions.dynamodb.catalog import create_session_group, get_session_group

        created = create_session_group(professor_id=1, course_id=2, total_students=30, number_of_sessions=4)

        self.assertEqual(created['total_students'], 30)
        self.assertEqual(created['type'], 'SessionGroup')

        fetched = get_session_group(created['session_group_id'])
        self.assertEqual(fetched['number_of_sessions'], 4)

    def test_get_session_group_returns_none_when_missing(self):
        from game_sessions.dynamodb.catalog import get_session_group

        self.assertIsNone(get_session_group('nonexistent'))

    def test_list_session_groups_for_professor(self):
        from game_sessions.dynamodb.catalog import create_session_group, list_session_groups_for_professor

        create_session_group(professor_id=1, course_id=2, total_students=30, number_of_sessions=4)
        create_session_group(professor_id=1, course_id=3, total_students=20, number_of_sessions=3)
        create_session_group(professor_id=2, course_id=2, total_students=10, number_of_sessions=1)

        results = list_session_groups_for_professor(1)

        self.assertEqual(len(results), 2)

    def test_create_and_get_tablet(self):
        from game_sessions.dynamodb.catalog import create_tablet, get_tablet

        created = create_tablet('TABLET-01')

        self.assertTrue(created['is_active'])
        self.assertEqual(created['type'], 'Tablet')

        fetched = get_tablet('TABLET-01')
        self.assertEqual(fetched['tablet_code'], 'TABLET-01')

    def test_create_tablet_rejects_duplicate_code(self):
        from game_sessions.dynamodb.catalog import create_tablet

        create_tablet('TABLET-01')
        result = create_tablet('TABLET-01')

        self.assertIsNone(result)

    def test_deactivate_tablet(self):
        from game_sessions.dynamodb.catalog import create_tablet, deactivate_tablet

        create_tablet('TABLET-01')

        updated = deactivate_tablet('TABLET-01')

        self.assertFalse(updated['is_active'])
```

- [x] **Step 2: Run tests to verify they fail**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_catalog -v 2`
Expected: `ModuleNotFoundError: No module named 'game_sessions.dynamodb.catalog'`

- [x] **Step 3: Write `game_sessions/dynamodb/catalog.py`**

```python
"""SessionGroup and Tablet repository - the two game_sessions entities
that don't belong to a single room's item collection (SessionGroup
spans multiple sessions, Tablet is reused across sessions over time)."""
import uuid
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from game_sessions.dynamodb import keys
from game_sessions.dynamodb.client import get_table


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_session_group(professor_id, course_id, total_students, number_of_sessions):
    """Creates a new SessionGroup item."""
    session_group_id = str(uuid.uuid4())
    now = _now_iso()
    item = {
        'PK': keys.session_group_pk(session_group_id),
        'SK': keys.metadata_sk(),
        'type': 'SessionGroup',
        'session_group_id': session_group_id,
        'professor_id': professor_id,
        'course_id': course_id,
        'total_students': total_students,
        'number_of_sessions': number_of_sessions,
        'created_at': now,
        'updated_at': now,
        'GSI1PK': keys.professor_gsi1pk(professor_id),
        'GSI1SK': now,
    }
    table = get_table()
    table.put_item(Item=item)
    return item


def get_session_group(session_group_id):
    """Returns the SessionGroup item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.session_group_pk(session_group_id), 'SK': keys.metadata_sk()},
    )
    return response.get('Item')


def list_session_groups_for_professor(professor_id):
    """Returns every SessionGroup item for a professor, via GSI1 - the
    same index GameSession uses, discriminated by the `type` attribute
    since both share the PROFESSOR#<id> partition."""
    table = get_table()
    response = table.query(
        IndexName='GSI1',
        KeyConditionExpression=Key('GSI1PK').eq(keys.professor_gsi1pk(professor_id)),
    )
    return [item for item in response['Items'] if item['type'] == 'SessionGroup']


def create_tablet(tablet_code):
    """Creates a new Tablet catalog item. Returns None instead of
    raising if tablet_code is already registered."""
    now = _now_iso()
    item = {
        'PK': keys.tablet_pk(tablet_code),
        'SK': keys.metadata_sk(),
        'type': 'Tablet',
        'tablet_code': tablet_code,
        'is_active': True,
        'created_at': now,
        'updated_at': now,
    }
    table = get_table()
    try:
        table.put_item(Item=item, ConditionExpression='attribute_not_exists(PK)')
        return item
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return None
        raise


def get_tablet(tablet_code):
    """Returns the Tablet item dict, or None if it doesn't exist."""
    table = get_table()
    response = table.get_item(
        Key={'PK': keys.tablet_pk(tablet_code), 'SK': keys.metadata_sk()},
    )
    return response.get('Item')


def deactivate_tablet(tablet_code):
    """Sets is_active to False for a tablet (soft-delete, matching the
    is_active convention used throughout the rest of this codebase)."""
    table = get_table()
    response = table.update_item(
        Key={'PK': keys.tablet_pk(tablet_code), 'SK': keys.metadata_sk()},
        UpdateExpression='SET is_active = :false, updated_at = :now',
        ExpressionAttributeValues={':false': False, ':now': _now_iso()},
        ReturnValues='ALL_NEW',
    )
    return response['Attributes']
```

- [x] **Step 4: Run tests to verify they pass**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_catalog -v 2`
Expected: `OK` (6 tests)

- [x] **Step 5: Commit**

```bash
git add game_sessions/dynamodb/catalog.py game_sessions/test_dynamodb_catalog.py
git commit -m "feat: add SessionGroup and Tablet DynamoDB repository"
```

---

### Task 11: Full test suite run and plan close-out

**Files:**
- None created/modified — verification only.

**Interfaces:**
- Consumes: every module from Tasks 1-10.
- Produces: nothing new — confirms the whole `game_sessions/dynamodb/` package works together.

- [x] **Step 1: Run the entire DynamoDB test suite together**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test game_sessions.test_dynamodb_client game_sessions.test_dynamodb_keys game_sessions.test_dynamodb_game_session game_sessions.test_dynamodb_team game_sessions.test_dynamodb_stage_progress game_sessions.test_dynamodb_bubble_roulette game_sessions.test_dynamodb_tablet_connection game_sessions.test_dynamodb_token_transaction game_sessions.test_dynamodb_evaluations game_sessions.test_dynamodb_catalog -v 2`
Expected: `OK` (61 tests total)

- [x] **Step 2: Run the full existing test suite to confirm no regressions**

Run: `DATABASE_HOST=127.0.0.1 .venv/Scripts/python.exe manage.py test`
Expected: `OK` — the new `game_sessions/dynamodb/` package and its tests are additive and don't touch any existing model/view/URL, so every pre-existing test should be unaffected.

- [x] **Step 3: Commit the plan's checked-off state**

```bash
git add docs/superpowers/plans/2026-07-19-dynamodb-game-sessions-repository.md
git commit -m "docs: mark DynamoDB game_sessions repository plan complete"
```
