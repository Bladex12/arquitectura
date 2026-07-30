# Users → DynamoDB Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Django `users` app (Professor/Administrator/Student/ProfessorAccessCode + JWT login) off RDS MySQL onto a new DynamoDB `UsersTable`, so account creation and login have no VPC/RDS network dependency.

**Architecture:** New `users/dynamodb/` repository layer (mirrors `game_sessions/dynamodb/`'s `client.py`/`keys.py`/`testing.py` pattern) backs a **compatibility shim** in `users/models.py`: `Professor`, `Administrator`, `Student`, `ProfessorAccessCode` become plain Python classes with a `.objects`-style interface (`.get()`, `.filter()`, `.create()`, `.count()`, etc.) instead of Django ORM models. This keeps every existing call site — `game_sessions/views.py`, `game_sessions/serializers.py`, `admin_dashboard/views.py`, and ~15 `game_sessions/test_*.py` fixture files — working **completely unmodified**. A custom `JWTAuthentication` subclass (`users/auth.py`) authenticates against DynamoDB instead of `django.contrib.auth`'s ORM-backed `User`. Django's own `auth.User` table and the `/admin/` site stay on RDS, untouched — they're a separate, unrelated concept used only by `academic`/`challenges` content maintainers.

**Tech Stack:** Django 5, DRF, `rest_framework_simplejwt`, boto3, `moto` (test mocking), AWS SAM/CloudFormation.

## Global Constraints

- No data migration/backfill — prod `professors`/`professor_access_codes` tables are empty (verified: registration validation reached the DB and returned "invalid code," not a missing-table error).
- Zero changes to `academic`, `challenges`, or the Django `/admin/` site.
- Zero changes to `game_sessions/views.py`, `game_sessions/serializers.py`, or any `game_sessions/test_*.py` / `admin_dashboard/tests.py` fixture code — the shim must be call-compatible with their exact existing usage (see spec revision section and Task 8 below for the exact call shapes audited).
- Ids are UUID4 strings, not ints (matches the `game_sessions` cutover precedent).
- Spec: `docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md` (including its "Revision — 2026-07-29" section) is the source of truth for schema/key decisions; this plan implements it.

---

### Task 1: `UsersTable` CloudFormation resource

**Files:**
- Modify: `template.yaml` (add resource after `GameSessionTable`, ~line 315; add env var to `DjangoFunction`'s `Environment.Variables`, ~line 191; add `UsersTableName` output alongside the other table-name outputs)

**Interfaces:**
- Produces: CFN resource `UsersTable` (table name available to the Lambda via env var `USERS_TABLE`, matching how `GAME_SESSIONS_TABLE` already works).

- [ ] **Step 1: Add the table resource**

Insert after the `GameSessionTable` resource block (after line 314, before the `ConnectionsTable` comment block):

```yaml
  # ==========================================================
  # DynamoDB: users (professors/administrators/students/access codes)
  # ==========================================================
  # See docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md.
  # Separate from GameSessionTable - a different bounded context (auth)
  # with its own access patterns (login by username/email), not the
  # game-runtime hot path.

  UsersTable:
    Type: AWS::DynamoDB::Table
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
        - AttributeName: GSI1PK
          AttributeType: S
        - AttributeName: GSI1SK
          AttributeType: S
        - AttributeName: GSI2PK
          AttributeType: S
        - AttributeName: GSI2SK
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: GSI1
          KeySchema:
            - AttributeName: GSI1PK
              KeyType: HASH
            - AttributeName: GSI1SK
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
        - IndexName: GSI2
          KeySchema:
            - AttributeName: GSI2PK
              KeyType: HASH
            - AttributeName: GSI2SK
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
```

- [ ] **Step 2: Wire the env var to `DjangoFunction`**

In the `DjangoFunction`'s `Environment.Variables` block, add a line right after `GAME_SESSIONS_TABLE: !Ref GameSessionTable`:

```yaml
          USERS_TABLE: !Ref UsersTable
```

- [ ] **Step 3: Add a stack output**

Find the `Outputs:` section (has `GameSessionTableName` already) and add:

```yaml
  UsersTableName:
    Value: !Ref UsersTable
```

- [ ] **Step 4: Validate the template**

Run: `sam validate --lint`
Expected: no errors (warnings about unrelated pre-existing findings are fine — check the output doesn't mention `UsersTable`).

- [ ] **Step 5: Commit**

```bash
git add template.yaml
git commit -m "infra: add UsersTable for the users-app DynamoDB migration"
```

---

### Task 2: `users/dynamodb/keys.py` + `client.py`

**Files:**
- Create: `users/dynamodb/__init__.py` (empty)
- Create: `users/dynamodb/keys.py`
- Create: `users/dynamodb/client.py`
- Test: `users/dynamodb/test_keys.py`

**Interfaces:**
- Produces: `keys.user_pk(user_id)`, `keys.metadata_sk()`, `keys.username_gsi1pk(username)`, `keys.email_gsi2pk(email)`, `keys.access_code_pk(code)`, `keys.access_code_email_gsi2pk(email)`, `keys.student_pk(student_id)`, `keys.student_email_gsi2pk(email)`; `client.get_table()`, `client.now_iso()`, `client.build_update_expression(fields)`.

- [ ] **Step 1: Write the failing test**

```python
# users/dynamodb/test_keys.py
from users.dynamodb import keys


def test_user_pk():
    assert keys.user_pk('abc-123') == 'USER#abc-123'


def test_metadata_sk():
    assert keys.metadata_sk() == 'METADATA'


def test_username_gsi1pk():
    assert keys.username_gsi1pk('jdoe') == 'USERNAME#jdoe'


def test_email_gsi2pk_lowercases():
    assert keys.email_gsi2pk('Jdoe@UDD.cl') == 'EMAIL#jdoe@udd.cl'


def test_access_code_pk():
    assert keys.access_code_pk('123456') == 'ACCESSCODE#123456'


def test_access_code_email_gsi2pk():
    assert keys.access_code_email_gsi2pk('a@udd.cl') == 'ACCESSCODEEMAIL#a@udd.cl'


def test_student_pk():
    assert keys.student_pk('s-1') == 'STUDENT#s-1'


def test_student_email_gsi2pk():
    assert keys.student_email_gsi2pk('S@UDD.cl') == 'STUDENTEMAIL#s@udd.cl'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest users/dynamodb/test_keys.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'users.dynamodb'`

- [ ] **Step 3: Write the implementation**

```python
# users/dynamodb/__init__.py
```

```python
# users/dynamodb/keys.py
"""Pure key-building functions for the users DynamoDB schema. See
docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md.
No AWS calls here - kept separate so the key format lives in one place.
"""


def user_pk(user_id):
    return f'USER#{user_id}'


def metadata_sk():
    return 'METADATA'


def username_gsi1pk(username):
    return f'USERNAME#{username}'


def email_gsi2pk(email):
    return f'EMAIL#{email.lower()}'


def access_code_pk(code):
    return f'ACCESSCODE#{code}'


def access_code_email_gsi2pk(email):
    return f'ACCESSCODEEMAIL#{email.lower()}'


def student_pk(student_id):
    return f'STUDENT#{student_id}'


def student_email_gsi2pk(email):
    return f'STUDENTEMAIL#{email.lower()}'
```

```python
# users/dynamodb/client.py
"""boto3 DynamoDB table accessor and shared update-expression builder
for the users single-table schema. Mirrors game_sessions/dynamodb/client.py.
"""
import os
from datetime import datetime, timezone

import boto3


def get_table():
    """Returns the boto3 DynamoDB Table resource for users data. Reads
    the table name from USERS_TABLE, which template.yaml sets on
    DjangoFunction via `!Ref UsersTable`."""
    dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
    return dynamodb.Table(os.environ['USERS_TABLE'])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def build_update_expression(fields):
    """Builds a DynamoDB UpdateExpression + ExpressionAttributeNames +
    ExpressionAttributeValues from a dict of {field_name: new_value},
    always also setting updated_at. Returns
    (update_expression, expression_attribute_names, expression_attribute_values).
    """
    now = now_iso()
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest users/dynamodb/test_keys.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add users/dynamodb/__init__.py users/dynamodb/keys.py users/dynamodb/client.py users/dynamodb/test_keys.py
git commit -m "feat(users): add DynamoDB key builders and table client"
```

---

### Task 3: `users/dynamodb/testing.py` (moto helper)

**Files:**
- Create: `users/dynamodb/testing.py`

**Interfaces:**
- Consumes: nothing (pure test infra).
- Produces: `testing.create_test_table(table_name='test-users', region_name='us-east-1')`, `testing.DynamoDBTestCase` (subclass for repository tests — sets up/tears down a moto-mocked `USERS_TABLE`).

- [ ] **Step 1: Write the implementation directly**

(No failing-test step here — this *is* test infrastructure, verified by Task 4 actually using it.)

```python
# users/dynamodb/testing.py
"""Shared moto test helpers for the users DynamoDB schema. Mirrors
game_sessions/dynamodb/testing.py. Only imported from tests, never from
application code.
"""
import os
from unittest import TestCase

import boto3
from moto import mock_aws


def create_test_table(table_name='test-users', region_name='us-east-1'):
    """Creates the UsersTable schema (PK/SK + GSI1 + GSI2) against the
    active moto mock. Must be called inside an active @mock_aws context."""
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
            {'AttributeName': 'GSI2PK', 'AttributeType': 'S'},
            {'AttributeName': 'GSI2SK', 'AttributeType': 'S'},
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
            {
                'IndexName': 'GSI2',
                'KeySchema': [
                    {'AttributeName': 'GSI2PK', 'KeyType': 'HASH'},
                    {'AttributeName': 'GSI2SK', 'KeyType': 'RANGE'},
                ],
                'Projection': {'ProjectionType': 'ALL'},
            },
        ],
        BillingMode='PAY_PER_REQUEST',
    )
    table.wait_until_exists()
    return table


class DynamoDBTestCase(TestCase):
    """Base class for users repository tests: starts a moto mock, sets
    USERS_TABLE, creates the schema - all torn down after each test."""

    def setUp(self):
        self.mock = mock_aws()
        self.mock.start()
        os.environ['USERS_TABLE'] = 'test-users'
        os.environ['AWS_REGION'] = 'us-east-1'
        create_test_table('test-users')

    def tearDown(self):
        self.mock.stop()
```

- [ ] **Step 2: Commit**

```bash
git add users/dynamodb/testing.py
git commit -m "test(users): add moto-backed DynamoDB test harness"
```

---

### Task 4: `users/dynamodb/user.py`

**Files:**
- Create: `users/dynamodb/user.py`
- Test: `users/dynamodb/test_user.py`

**Interfaces:**
- Consumes: `client.get_table`, `client.now_iso`, `client.build_update_expression`, `keys.*` (Task 2); `testing.DynamoDBTestCase` (Task 3).
- Produces: `create_user(*, username, email, password=None, password_hash=None, first_name='', last_name='', is_administrator=False, is_super_admin=False, professor_access_code=None) -> dict` (raises `ValueError` on duplicate username); `get_user_by_id(user_id) -> dict | None`; `get_user_by_username(username) -> dict | None`; `get_user_by_email(email) -> dict | None`; `get_users_by_ids(user_ids: list) -> dict[str, dict]`; `list_users() -> list[dict]`; `count_users() -> int`; `update_user(user_id, fields: dict) -> None`; `delete_user(user_id) -> None`; `check_user_password(user_item: dict, raw_password: str) -> bool`.

- [ ] **Step 1: Write the failing tests**

```python
# users/dynamodb/test_user.py
from users.dynamodb import user as user_repo
from users.dynamodb.testing import DynamoDBTestCase


class CreateAndGetUserTest(DynamoDBTestCase):
    def test_create_then_get_by_id(self):
        created = user_repo.create_user(username='jdoe', email='jdoe@udd.cl', password='pw12345!')
        fetched = user_repo.get_user_by_id(created['id'])
        assert fetched['username'] == 'jdoe'
        assert fetched['email'] == 'jdoe@udd.cl'
        assert fetched['is_administrator'] is False
        assert fetched['password_hash'] != 'pw12345!'  # hashed, not plaintext

    def test_get_by_id_missing_returns_none(self):
        assert user_repo.get_user_by_id('does-not-exist') is None

    def test_duplicate_username_raises(self):
        user_repo.create_user(username='jdoe', email='a@udd.cl', password='pw12345!')
        try:
            user_repo.create_user(username='jdoe', email='b@udd.cl', password='pw12345!')
            assert False, 'expected ValueError'
        except ValueError:
            pass

    def test_get_by_username(self):
        user_repo.create_user(username='msmith', email='msmith@udd.cl', password='pw12345!')
        found = user_repo.get_user_by_username('msmith')
        assert found['email'] == 'msmith@udd.cl'

    def test_get_by_username_missing_returns_none(self):
        assert user_repo.get_user_by_username('nobody') is None

    def test_get_by_email(self):
        user_repo.create_user(username='asmith', email='asmith@udd.cl', password='pw12345!')
        found = user_repo.get_user_by_email('asmith@udd.cl')
        assert found['username'] == 'asmith'

    def test_get_by_email_case_insensitive(self):
        user_repo.create_user(username='bsmith', email='bsmith@udd.cl', password='pw12345!')
        found = user_repo.get_user_by_email('BSmith@UDD.cl')
        assert found['username'] == 'bsmith'

    def test_password_hash_passthrough(self):
        created = user_repo.create_user(username='csmith', email='c@udd.cl', password_hash='pbkdf2_sha256$prehashed')
        assert created['password_hash'] == 'pbkdf2_sha256$prehashed'

    def test_check_user_password(self):
        created = user_repo.create_user(username='dsmith', email='d@udd.cl', password='correct-horse')
        assert user_repo.check_user_password(created, 'correct-horse') is True
        assert user_repo.check_user_password(created, 'wrong') is False

    def test_get_users_by_ids(self):
        u1 = user_repo.create_user(username='u1', email='u1@udd.cl', password='pw12345!')
        u2 = user_repo.create_user(username='u2', email='u2@udd.cl', password='pw12345!')
        result = user_repo.get_users_by_ids([u1['id'], u2['id'], 'missing-id'])
        assert set(result.keys()) == {u1['id'], u2['id']}

    def test_get_users_by_ids_empty_list(self):
        assert user_repo.get_users_by_ids([]) == {}

    def test_list_users_and_count(self):
        user_repo.create_user(username='e1', email='e1@udd.cl', password='pw12345!')
        user_repo.create_user(username='e2', email='e2@udd.cl', password='pw12345!')
        assert user_repo.count_users() == 2
        usernames = {u['username'] for u in user_repo.list_users()}
        assert usernames == {'e1', 'e2'}

    def test_update_user(self):
        created = user_repo.create_user(username='f1', email='f1@udd.cl', password='pw12345!')
        user_repo.update_user(created['id'], {'first_name': 'Frank', 'is_administrator': True})
        fetched = user_repo.get_user_by_id(created['id'])
        assert fetched['first_name'] == 'Frank'
        assert fetched['is_administrator'] is True

    def test_delete_user(self):
        created = user_repo.create_user(username='g1', email='g1@udd.cl', password='pw12345!')
        user_repo.delete_user(created['id'])
        assert user_repo.get_user_by_id(created['id']) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest users/dynamodb/test_user.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'users.dynamodb.user'`

- [ ] **Step 3: Write the implementation**

```python
# users/dynamodb/user.py
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
    try:
        table.put_item(Item=item, ConditionExpression='attribute_not_exists(PK)')
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValueError(f'username "{username}" already exists')
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest users/dynamodb/test_user.py -v`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add users/dynamodb/user.py users/dynamodb/test_user.py
git commit -m "feat(users): add DynamoDB User repository"
```

---

### Task 5: `users/dynamodb/access_code.py`

**Files:**
- Create: `users/dynamodb/access_code.py`
- Test: `users/dynamodb/test_access_code.py`

**Interfaces:**
- Consumes: Task 2/3 infra.
- Produces: `create_access_code(email, code) -> dict` (raises `ValueError` if the code already exists); `get_access_code(code) -> dict | None`; `get_pending_access_code_by_email(email) -> dict | None` (only unused codes); `mark_access_code_used(code) -> None`; `list_access_codes() -> list[dict]` (newest first).

- [ ] **Step 1: Write the failing tests**

```python
# users/dynamodb/test_access_code.py
from users.dynamodb import access_code as access_code_repo
from users.dynamodb.testing import DynamoDBTestCase


class AccessCodeTest(DynamoDBTestCase):
    def test_create_then_get(self):
        access_code_repo.create_access_code('prof@udd.cl', '111111')
        fetched = access_code_repo.get_access_code('111111')
        assert fetched['email'] == 'prof@udd.cl'
        assert fetched['is_used'] is False

    def test_get_missing_returns_none(self):
        assert access_code_repo.get_access_code('999999') is None

    def test_duplicate_code_raises(self):
        access_code_repo.create_access_code('a@udd.cl', '222222')
        try:
            access_code_repo.create_access_code('b@udd.cl', '222222')
            assert False, 'expected ValueError'
        except ValueError:
            pass

    def test_pending_by_email_found(self):
        access_code_repo.create_access_code('c@udd.cl', '333333')
        found = access_code_repo.get_pending_access_code_by_email('c@udd.cl')
        assert found['access_code'] == '333333'

    def test_pending_by_email_ignores_used(self):
        access_code_repo.create_access_code('d@udd.cl', '444444')
        access_code_repo.mark_access_code_used('444444')
        assert access_code_repo.get_pending_access_code_by_email('d@udd.cl') is None

    def test_pending_by_email_none_found(self):
        assert access_code_repo.get_pending_access_code_by_email('nobody@udd.cl') is None

    def test_mark_used(self):
        access_code_repo.create_access_code('e@udd.cl', '555555')
        access_code_repo.mark_access_code_used('555555')
        fetched = access_code_repo.get_access_code('555555')
        assert fetched['is_used'] is True
        assert fetched['used_at'] is not None

    def test_list_access_codes_newest_first(self):
        access_code_repo.create_access_code('f@udd.cl', '666666')
        access_code_repo.create_access_code('g@udd.cl', '777777')
        codes = access_code_repo.list_access_codes()
        assert [c['access_code'] for c in codes] == ['777777', '666666']
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest users/dynamodb/test_access_code.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

```python
# users/dynamodb/access_code.py
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest users/dynamodb/test_access_code.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add users/dynamodb/access_code.py users/dynamodb/test_access_code.py
git commit -m "feat(users): add DynamoDB ProfessorAccessCode repository"
```

---

### Task 6: `users/dynamodb/student.py`

**Files:**
- Create: `users/dynamodb/student.py`
- Test: `users/dynamodb/test_student.py`

**Interfaces:**
- Consumes: Task 2/3 infra.
- Produces: `create_student(*, full_name, email, rut) -> dict`; `get_student(student_id) -> dict | None`; `get_students_by_ids(student_ids: list) -> dict[str, dict]`; `student_exists(student_id) -> bool`; `get_student_by_email(email) -> dict | None`; `get_or_create_student(*, email, full_name, rut) -> (dict, bool)`; `update_or_create_student(*, email, full_name, rut) -> (dict, bool)`; `update_student(student_id, fields) -> None`; `list_students() -> list[dict]`.

- [ ] **Step 1: Write the failing tests**

```python
# users/dynamodb/test_student.py
from users.dynamodb import student as student_repo
from users.dynamodb.testing import DynamoDBTestCase


class StudentTest(DynamoDBTestCase):
    def test_create_then_get(self):
        created = student_repo.create_student(full_name='Ana Perez', email='ana@udd.cl', rut='11.111.111-1')
        fetched = student_repo.get_student(created['id'])
        assert fetched['full_name'] == 'Ana Perez'
        assert fetched['rut'] == '11.111.111-1'

    def test_get_missing_returns_none(self):
        assert student_repo.get_student('missing') is None

    def test_student_exists(self):
        created = student_repo.create_student(full_name='Bruno Diaz', email='bruno@udd.cl', rut='2-2')
        assert student_repo.student_exists(created['id']) is True
        assert student_repo.student_exists('missing') is False

    def test_get_by_email(self):
        student_repo.create_student(full_name='Carla Soto', email='carla@udd.cl', rut='3-3')
        found = student_repo.get_student_by_email('carla@udd.cl')
        assert found['full_name'] == 'Carla Soto'

    def test_get_students_by_ids(self):
        s1 = student_repo.create_student(full_name='D1', email='d1@udd.cl', rut='4-4')
        s2 = student_repo.create_student(full_name='D2', email='d2@udd.cl', rut='5-5')
        result = student_repo.get_students_by_ids([s1['id'], s2['id'], 'missing'])
        assert set(result.keys()) == {s1['id'], s2['id']}

    def test_get_or_create_creates_when_missing(self):
        student, created = student_repo.get_or_create_student(email='e@udd.cl', full_name='E One', rut='6-6')
        assert created is True
        assert student['full_name'] == 'E One'

    def test_get_or_create_returns_existing(self):
        student_repo.create_student(full_name='F One', email='f@udd.cl', rut='7-7')
        student, created = student_repo.get_or_create_student(email='f@udd.cl', full_name='ignored', rut='ignored')
        assert created is False
        assert student['full_name'] == 'F One'

    def test_update_or_create_creates_when_missing(self):
        student, created = student_repo.update_or_create_student(email='g@udd.cl', full_name='G One', rut='8-8')
        assert created is True
        assert student['full_name'] == 'G One'

    def test_update_or_create_updates_existing(self):
        student_repo.create_student(full_name='Old Name', email='h@udd.cl', rut='9-9')
        student, created = student_repo.update_or_create_student(email='h@udd.cl', full_name='New Name', rut='10-10')
        assert created is False
        assert student['full_name'] == 'New Name'
        assert student['rut'] == '10-10'

    def test_list_students(self):
        student_repo.create_student(full_name='I1', email='i1@udd.cl', rut='11-11')
        student_repo.create_student(full_name='I2', email='i2@udd.cl', rut='12-12')
        names = {s['full_name'] for s in student_repo.list_students()}
        assert names == {'I1', 'I2'}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest users/dynamodb/test_student.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

```python
# users/dynamodb/student.py
"""Repository functions for Student items. No auth - students never log
in, this is roster data referenced by game_sessions team rosters."""
import os
import uuid

import boto3
from boto3.dynamodb.conditions import Attr, Key

from .client import build_update_expression, get_table, now_iso
from .keys import metadata_sk, student_email_gsi2pk, student_pk


def create_student(*, full_name, email, rut):
    table = get_table()
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
    table.put_item(Item=item)
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
    return items[0] if items else None


def get_students_by_ids(student_ids):
    unique_ids = list({sid for sid in student_ids if sid})
    if not unique_ids:
        return {}
    dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
    table_name = os.environ['USERS_TABLE']
    keys = [{'PK': student_pk(sid), 'SK': metadata_sk()} for sid in unique_ids]
    resp = dynamodb.batch_get_item(RequestItems={table_name: {'Keys': keys}})
    items = resp['Responses'].get(table_name, [])
    return {item['id']: item for item in items}


def update_student(student_id, fields):
    expr, names, values = build_update_expression(fields)
    get_table().update_item(
        Key={'PK': student_pk(student_id), 'SK': metadata_sk()},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def get_or_create_student(*, email, full_name, rut):
    existing = get_student_by_email(email)
    if existing:
        return existing, False
    return create_student(full_name=full_name, email=email, rut=rut), True


def update_or_create_student(*, email, full_name, rut):
    existing = get_student_by_email(email)
    if existing:
        update_student(existing['id'], {'full_name': full_name, 'rut': rut})
        return get_student(existing['id']), False
    return create_student(full_name=full_name, email=email, rut=rut), True


def list_students():
    resp = get_table().scan(FilterExpression=Attr('type').eq('Student'))
    return resp.get('Items', [])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest users/dynamodb/test_student.py -v`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add users/dynamodb/student.py users/dynamodb/test_student.py
git commit -m "feat(users): add DynamoDB Student repository"
```

---

### Task 7: `users/models.py` compatibility shim

**Files:**
- Modify: `users/models.py` (full rewrite — was Django ORM models, becomes plain wrapper classes)
- Test: `users/test_models_shim.py`

**Interfaces:**
- Consumes: `users/dynamodb/user.py`, `student.py`, `access_code.py` (Tasks 4-6).
- Produces: `Professor` (with `.objects.get(id)`, `.objects.filter(id__in=...)`, `.objects.select_related(...)` [no-op, returns `.objects`], `.objects.create(user=<throwaway django User> | username=..., email=..., password=..., ...)`, `.objects.count()`, instance `.id`, `.access_code`, `.user` (nested proxy with `.id`/`.username`/`.email`/`.get_full_name()`), `.get_unique_students_count()`, `Professor.DoesNotExist`); `Administrator` (`.objects.create(user=..., is_super_admin=False)`, instance `.id`/`.is_super_admin`/`.user`, `Administrator.DoesNotExist`); `Student` (`.objects.create(full_name=, email=, rut=)`, `.objects.get(id)`, `.objects.filter(id=... | id__in=...)` returning a list-like object supporting `.exists()`/`.values_list(field, flat=True)`, `.objects.get_or_create(email=, defaults=)`, `.objects.update_or_create(email=, defaults=)`, instance `.id`/`.full_name`/`.email`/`.rut`, `Student.DoesNotExist`); `ProfessorAccessCode` (`.objects.create(email=, access_code=)`, `.objects.filter(access_code=... , is_used=..., email__iexact=... | email=...)` returning a list-like object with `.first()`/`.exists()`, `.objects.all()`, instance `.email`/`.access_code`/`.is_used`/`.created_at`/`.used_at`, `.save(update_fields=...)` marks used when `.is_used` is `True`).

This is the highest-risk file in the migration — every existing call site across `game_sessions` and `admin_dashboard` depends on these exact shapes staying compatible. The test below exercises every call shape actually found via a full-codebase audit (grep for `Professor.objects`, `Student.objects`, `Administrator.objects`, `ProfessorAccessCode.objects`, `hasattr(request.user, ...)`).

- [ ] **Step 1: Write the failing test**

```python
# users/test_models_shim.py
from django.contrib.auth.models import User as DjangoUser
from django.test import TestCase

from users.dynamodb.testing import DynamoDBTestCase
from users.models import Administrator, Professor, ProfessorAccessCode, Student


class ProfessorShimTest(DynamoDBTestCase, TestCase):
    def test_create_from_django_user_then_get_by_id(self):
        """Matches game_sessions/test_*.py fixture shape:
        User.objects.create_user(...) then Professor.objects.create(user=user)."""
        django_user = DjangoUser.objects.create_user(username='prof_abc123', password='pass')
        professor = Professor.objects.create(user=django_user)
        fetched = Professor.objects.get(id=professor.id)
        assert fetched.user.username == 'prof_abc123'

    def test_create_with_access_code(self):
        django_user = DjangoUser.objects.create_user(username='prof_xyz', password='pass')
        professor = Professor.objects.create(user=django_user, access_code='1111')
        assert professor.access_code == '1111'

    def test_get_missing_raises_does_not_exist(self):
        try:
            Professor.objects.get(id='missing')
            assert False, 'expected DoesNotExist'
        except Professor.DoesNotExist:
            pass

    def test_filter_id_in_with_select_related_chain(self):
        """Matches game_sessions/views.py:156:
        Professor.objects.select_related('user').filter(id__in=professor_ids)"""
        u1 = DjangoUser.objects.create_user(username='p1', password='pass')
        u2 = DjangoUser.objects.create_user(username='p2', password='pass')
        prof1 = Professor.objects.create(user=u1)
        Professor.objects.create(user=u2)
        results = Professor.objects.select_related('user').filter(id__in=[prof1.id])
        assert len(results) == 1
        assert results[0].user.get_full_name() == 'p1'  # no first/last name set

    def test_registration_create_with_explicit_fields(self):
        """Matches the real registration path (ProfessorCreateSerializer)."""
        professor = Professor.objects.create(
            username='newprof', email='newprof@udd.cl', password='pw12345!',
            first_name='New', last_name='Prof', access_code='222222',
        )
        assert professor.user.username == 'newprof'
        assert professor.user.email == 'newprof@udd.cl'

    def test_count(self):
        DjangoUser and None  # no-op to keep import used
        Professor.objects.create(username='c1', email='c1@udd.cl', password='pw12345!')
        Professor.objects.create(username='c2', email='c2@udd.cl', password='pw12345!')
        assert Professor.objects.count() == 2


class AdministratorShimTest(DynamoDBTestCase, TestCase):
    def test_create_from_existing_professor(self):
        """Matches game_sessions/test_game_session_viewset.py:105:
        Administrator.objects.create(user=prof_a.user)"""
        django_user = DjangoUser.objects.create_user(username='profa', password='pass')
        professor = Professor.objects.create(user=django_user)
        Administrator.objects.create(user=professor.user)
        # Same account should now also read back as administrator
        fetched_professor = Professor.objects.get(id=professor.id)
        assert fetched_professor.user.username == 'profa'

    def test_create_from_raw_django_user_without_prior_professor(self):
        """Matches game_sessions/test_game_session_viewset.py:134:
        admin_user = User.objects.create_user(...); Administrator.objects.create(user=admin_user)
        - no Professor.objects.create() call first."""
        django_user = DjangoUser.objects.create_user(username='rawadmin', password='pass')
        admin = Administrator.objects.create(user=django_user)
        assert admin.user.username == 'rawadmin'
        # It's also fetchable as a Professor (admins are auto-professors)
        as_professor = Professor.objects.get(id=admin.id)
        assert as_professor.user.username == 'rawadmin'


class StudentShimTest(DynamoDBTestCase, TestCase):
    def test_create_then_get(self):
        student = Student.objects.create(full_name='Ana', email='ana@udd.cl', rut='1-1')
        fetched = Student.objects.get(id=student.id)
        assert fetched.full_name == 'Ana'

    def test_get_missing_raises_does_not_exist(self):
        try:
            Student.objects.get(id='missing')
            assert False, 'expected DoesNotExist'
        except Student.DoesNotExist:
            pass

    def test_filter_id_exists(self):
        """Matches game_sessions/views.py:1007:
        Student.objects.filter(id=student_id).exists()"""
        student = Student.objects.create(full_name='Bea', email='bea@udd.cl', rut='2-2')
        assert Student.objects.filter(id=student.id).exists() is True
        assert Student.objects.filter(id='missing').exists() is False

    def test_filter_id_in_values_list(self):
        """Matches game_sessions/serializers.py:178:
        set(Student.objects.filter(id__in=value).values_list('id', flat=True))"""
        s1 = Student.objects.create(full_name='C1', email='c1@udd.cl', rut='3-3')
        s2 = Student.objects.create(full_name='C2', email='c2@udd.cl', rut='4-4')
        ids = set(Student.objects.filter(id__in=[s1.id, s2.id]).values_list('id', flat=True))
        assert ids == {s1.id, s2.id}

    def test_get_or_create(self):
        """Matches game_sessions/views.py:488."""
        student, created = Student.objects.get_or_create(
            email='dd@udd.cl', defaults={'full_name': 'D D', 'rut': '5-5'},
        )
        assert created is True
        student2, created2 = Student.objects.get_or_create(
            email='dd@udd.cl', defaults={'full_name': 'ignored', 'rut': 'ignored'},
        )
        assert created2 is False
        assert student2.id == student.id


class ProfessorAccessCodeShimTest(DynamoDBTestCase, TestCase):
    def test_create_and_filter_by_code_used_email(self):
        """Matches users/serializers.py's validate_access_code:
        ProfessorAccessCode.objects.filter(access_code=..., is_used=False, email__iexact=...).first()"""
        ProfessorAccessCode.objects.create(email='p@udd.cl', access_code='999999')
        found = ProfessorAccessCode.objects.filter(
            access_code='999999', is_used=False, email__iexact='P@UDD.cl',
        ).first()
        assert found is not None
        assert found.email == 'p@udd.cl'

    def test_filter_by_code_only(self):
        """Matches users/views.py's create_with_code uniqueness check:
        ProfessorAccessCode.objects.filter(access_code=access_code).exists()"""
        ProfessorAccessCode.objects.create(email='q@udd.cl', access_code='888888')
        assert ProfessorAccessCode.objects.filter(access_code='888888').exists() is True
        assert ProfessorAccessCode.objects.filter(access_code='000000').exists() is False

    def test_filter_by_email_pending_only(self):
        """Matches users/views.py's create_with_code pending check:
        ProfessorAccessCode.objects.filter(email=email, is_used=False).first()"""
        ProfessorAccessCode.objects.create(email='r@udd.cl', access_code='777777')
        found = ProfessorAccessCode.objects.filter(email='r@udd.cl', is_used=False).first()
        assert found.access_code == '777777'

    def test_save_marks_used(self):
        ProfessorAccessCode.objects.create(email='s@udd.cl', access_code='666666')
        code = ProfessorAccessCode.objects.filter(access_code='666666').first()
        code.is_used = True
        code.save(update_fields=['is_used', 'used_at'])
        refetched = ProfessorAccessCode.objects.filter(access_code='666666').first()
        assert refetched.is_used is True

    def test_all_ordered_newest_first(self):
        ProfessorAccessCode.objects.create(email='t@udd.cl', access_code='555555')
        ProfessorAccessCode.objects.create(email='u@udd.cl', access_code='444444')
        codes = list(ProfessorAccessCode.objects.all())
        assert [c.access_code for c in codes] == ['444444', '555555']
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest users/test_models_shim.py -v`
Expected: FAIL (old `users/models.py` still defines Django ORM models with a different `.objects.create` signature — e.g. `test_create_from_django_user_then_get_by_id` fails because `Professor.objects.get(id=...)` on the real ORM manager works differently, and none of the DynamoDB-backed assertions hold).

- [ ] **Step 3: Write the implementation**

```python
# users/models.py
"""
Compatibility shim: Professor/Administrator/Student/ProfessorAccessCode
used to be Django ORM models (OneToOneField'd to django.contrib.auth's
User). They're now plain Python classes backed by DynamoDB (see
users/dynamodb/ and
docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md).

This shim exists so every existing call site (game_sessions/views.py,
game_sessions/serializers.py, admin_dashboard/views.py, and the
game_sessions/test_*.py fixtures that build throwaway
django.contrib.auth.models.User rows) keeps working completely
unmodified - `.objects.get(id=...)`, `.objects.filter(id__in=...)`,
`hasattr(request.user, 'professor')`, etc.

Django's own `django.contrib.auth.models.User` table is untouched and
unrelated - it still exists (for the `/admin/` site, used by
academic/challenges content maintainers) and, as a convenience, test
fixtures may still construct one and pass it to `Professor.objects.create(user=...)`
/ `Administrator.objects.create(user=...)` - only its username/email/
already-hashed password get copied into the new DynamoDB User item;
nothing links back to it.
"""
from django.core.exceptions import ObjectDoesNotExist

from users.dynamodb import access_code as access_code_repo
from users.dynamodb import student as student_repo
from users.dynamodb import user as user_repo


class _UserProxy:
    """Stands in for the old `professor.user` / `administrator.user`
    OneToOneField accessor."""

    def __init__(self, item):
        self.id = item['id']
        self.username = item['username']
        self.email = item['email']
        self.first_name = item.get('first_name', '')
        self.last_name = item.get('last_name', '')
        self.is_active = item.get('is_active', True)

    def get_full_name(self):
        full = f'{self.first_name} {self.last_name}'.strip()
        return full or self.username


class _ListResult(list):
    """list subclass adding the QuerySet-ish methods actual call sites
    use: .exists(), .values_list(field, flat=True), .first()."""

    def exists(self):
        return len(self) > 0

    def first(self):
        return self[0] if self else None

    def values_list(self, field, flat=False):
        return [getattr(obj, field) for obj in self]


def _user_item_to_professor_fields(item):
    return {
        'id': item['id'],
        'access_code': item.get('professor_access_code'),
        'created_at': item['created_at'],
        'updated_at': item['updated_at'],
        'user': _UserProxy(item),
    }


class Professor:
    class DoesNotExist(ObjectDoesNotExist, AttributeError):
        pass

    class _Manager:
        def get(self, id):
            item = user_repo.get_user_by_id(id)
            if item is None:
                raise Professor.DoesNotExist(f'Professor {id} does not exist')
            return Professor(item)

        def filter(self, id__in=None):
            if id__in is not None:
                items = user_repo.get_users_by_ids(id__in)
                return _ListResult(Professor(item) for item in items.values())
            return _ListResult(Professor(item) for item in user_repo.list_users())

        def select_related(self, *_args, **_kwargs):
            # No-op: the DynamoDB item already carries every field a SQL
            # join would have fetched (no separate `user` row to join).
            return self

        def create(self, *, user=None, username=None, email=None, password=None,
                    first_name='', last_name='', access_code=None):
            if user is not None:
                # Test-fixture convenience: `user` is a throwaway
                # django.contrib.auth.models.User (or a _UserProxy from
                # an already-created Professor/Administrator).
                item = user_repo.create_user(
                    username=user.username,
                    email=user.email or f'{user.username}@example.udd.cl',
                    password_hash=getattr(user, 'password', None) or user_repo.make_password_placeholder(),
                    first_name=getattr(user, 'first_name', ''),
                    last_name=getattr(user, 'last_name', ''),
                    professor_access_code=access_code,
                )
            else:
                item = user_repo.create_user(
                    username=username, email=email, password=password,
                    first_name=first_name, last_name=last_name,
                    professor_access_code=access_code,
                )
            return Professor(item)

        def count(self):
            return user_repo.count_users()

    objects = _Manager()

    def __init__(self, item):
        fields = _user_item_to_professor_fields(item)
        self.id = fields['id']
        self.access_code = fields['access_code']
        self.created_at = fields['created_at']
        self.updated_at = fields['updated_at']
        self.user = fields['user']

    def get_unique_students_count(self):
        """Unchanged from the pre-migration version (game_sessions cutover,
        Task 6): rosters live embedded in each Team's student_ids."""
        from game_sessions.dynamodb.game_session import list_sessions_for_professor
        from game_sessions.dynamodb.team import list_teams

        unique_student_ids = set()
        for session in list_sessions_for_professor(self.id, status='completed'):
            for team in list_teams(session['room_code']):
                unique_student_ids.update(team['student_ids'])
        return len(unique_student_ids)


class Administrator:
    class DoesNotExist(ObjectDoesNotExist, AttributeError):
        pass

    class _Manager:
        def create(self, *, user, is_super_admin=False):
            existing = None
            if isinstance(user, _UserProxy):
                existing = user_repo.get_user_by_id(user.id)
            else:
                existing = user_repo.get_user_by_username(user.username)

            if existing:
                user_repo.update_user(existing['id'], {
                    'is_administrator': True,
                    'is_super_admin': is_super_admin,
                })
                item = user_repo.get_user_by_id(existing['id'])
            else:
                item = user_repo.create_user(
                    username=user.username,
                    email=user.email or f'{user.username}@example.udd.cl',
                    password_hash=getattr(user, 'password', None) or user_repo.make_password_placeholder(),
                    first_name=getattr(user, 'first_name', ''),
                    last_name=getattr(user, 'last_name', ''),
                    is_administrator=True,
                    is_super_admin=is_super_admin,
                )
            return Administrator(item)

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.is_super_admin = item.get('is_super_admin', False)
        self.created_at = item['created_at']
        self.updated_at = item['updated_at']
        self.user = _UserProxy(item)


class Student:
    class DoesNotExist(ObjectDoesNotExist, AttributeError):
        pass

    class _Manager:
        def create(self, *, full_name, email, rut):
            return Student(student_repo.create_student(full_name=full_name, email=email, rut=rut))

        def get(self, id):
            item = student_repo.get_student(id)
            if item is None:
                raise Student.DoesNotExist(f'Student {id} does not exist')
            return Student(item)

        def filter(self, id=None, id__in=None):
            if id__in is not None:
                items = student_repo.get_students_by_ids(id__in)
                return _ListResult(Student(item) for item in items.values())
            if id is not None:
                item = student_repo.get_student(id)
                return _ListResult([Student(item)] if item else [])
            return _ListResult(Student(item) for item in student_repo.list_students())

        def get_or_create(self, *, email, defaults):
            item, created = student_repo.get_or_create_student(
                email=email, full_name=defaults['full_name'], rut=defaults['rut'],
            )
            return Student(item), created

        def update_or_create(self, *, email, defaults):
            item, created = student_repo.update_or_create_student(
                email=email, full_name=defaults['full_name'], rut=defaults['rut'],
            )
            return Student(item), created

    objects = _Manager()

    def __init__(self, item):
        self.id = item['id']
        self.full_name = item['full_name']
        self.email = item['email']
        self.rut = item['rut']
        self.created_at = item['created_at']
        self.updated_at = item['updated_at']


class ProfessorAccessCode:
    class _Manager:
        def create(self, *, email, access_code):
            return ProfessorAccessCode(access_code_repo.create_access_code(email, access_code))

        def filter(self, access_code=None, is_used=None, email=None, email__iexact=None):
            target_email = email or email__iexact
            if access_code is not None:
                item = access_code_repo.get_access_code(access_code)
                items = [item] if item else []
            elif target_email is not None:
                pending = access_code_repo.get_pending_access_code_by_email(target_email)
                items = [pending] if pending else []
                if is_used is False:
                    pass  # get_pending_access_code_by_email already filters to unused
                elif pending is not None and is_used is not None and pending['is_used'] != is_used:
                    items = []
            else:
                items = access_code_repo.list_access_codes()

            if access_code is not None and is_used is not None:
                items = [i for i in items if i['is_used'] == is_used]
            if access_code is not None and target_email is not None:
                items = [i for i in items if i['email'] == target_email.lower()]

            return _ListResult(ProfessorAccessCode(i) for i in items)

        def all(self):
            return _ListResult(ProfessorAccessCode(i) for i in access_code_repo.list_access_codes())

    objects = _Manager()

    def __init__(self, item):
        self._code = item['access_code']
        self.email = item['email']
        self.access_code = item['access_code']
        self.is_used = item['is_used']
        self.created_at = item['created_at']
        self.used_at = item.get('used_at')

    def save(self, update_fields=None):
        if self.is_used:
            access_code_repo.mark_access_code_used(self._code)
```

- [ ] **Step 4: Add the small `make_password_placeholder` helper it relies on**

Add to `users/dynamodb/user.py` (next to `create_user`):

```python
def make_password_placeholder():
    """Used only when the shim wraps a throwaway Django auth.User whose
    .password happens to be empty (shouldn't normally happen -
    create_user always hashes something) - an unusable hash, never a
    valid password match."""
    return '!'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest users/test_models_shim.py -v`
Expected: PASS (19 tests)

- [ ] **Step 6: Commit**

```bash
git add users/models.py users/test_models_shim.py users/dynamodb/user.py
git commit -m "feat(users): replace Django ORM models with DynamoDB-backed compatibility shim"
```

---

### Task 8: `users/auth.py` (DynamoUser + custom JWTAuthentication)

**Files:**
- Create: `users/auth.py`
- Test: `users/test_auth.py`

**Interfaces:**
- Consumes: `users/dynamodb/user.py` (Task 4), `users/models.py`'s `Administrator`/`Administrator.DoesNotExist` (Task 7).
- Produces: `DynamoUser` (constructed from a User item; exposes `.id`, `.pk`, `.username`, `.email`, `.first_name`, `.last_name`, `.is_active`, `.is_administrator`, `.is_super_admin`, `.is_staff`, `.is_authenticated = True`, `.is_anonymous = False`, `.get_full_name()`, `.professor` property (always present), `.administrator` property (raises `Administrator.DoesNotExist` when not an admin, so `hasattr()` returns `False`)); `DynamoJWTAuthentication` (subclass of `rest_framework_simplejwt.authentication.JWTAuthentication`, overrides `get_user()`).

- [ ] **Step 1: Write the failing test**

```python
# users/test_auth.py
from django.test import TestCase
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from users.auth import DynamoJWTAuthentication, DynamoUser
from users.dynamodb import user as user_repo
from users.dynamodb.testing import DynamoDBTestCase
from users.models import Administrator


class DynamoUserTest(DynamoDBTestCase, TestCase):
    def test_basic_fields(self):
        item = user_repo.create_user(username='jdoe', email='jdoe@udd.cl', password='pw12345!',
                                       first_name='J', last_name='Doe')
        du = DynamoUser(item)
        assert du.username == 'jdoe'
        assert du.is_authenticated is True
        assert du.is_anonymous is False
        assert du.is_staff is False
        assert du.get_full_name() == 'J Doe'

    def test_professor_always_present(self):
        item = user_repo.create_user(username='jdoe2', email='jdoe2@udd.cl', password='pw12345!')
        du = DynamoUser(item)
        assert hasattr(du, 'professor')
        assert du.professor.id == du.id

    def test_administrator_absent_when_not_admin(self):
        item = user_repo.create_user(username='jdoe3', email='jdoe3@udd.cl', password='pw12345!')
        du = DynamoUser(item)
        assert hasattr(du, 'administrator') is False

    def test_administrator_present_when_admin(self):
        item = user_repo.create_user(username='jdoe4', email='jdoe4@udd.cl', password='pw12345!',
                                       is_administrator=True)
        du = DynamoUser(item)
        assert hasattr(du, 'administrator') is True
        assert du.is_staff is True

    def test_administrator_raises_does_not_exist_when_accessed_directly(self):
        item = user_repo.create_user(username='jdoe5', email='jdoe5@udd.cl', password='pw12345!')
        du = DynamoUser(item)
        try:
            du.administrator
            assert False, 'expected Administrator.DoesNotExist'
        except Administrator.DoesNotExist:
            pass


class DynamoJWTAuthenticationTest(DynamoDBTestCase, TestCase):
    def test_get_user_returns_dynamo_user(self):
        item = user_repo.create_user(username='auth1', email='auth1@udd.cl', password='pw12345!')
        auth = DynamoJWTAuthentication()
        user = auth.get_user({'user_id': item['id']})
        assert isinstance(user, DynamoUser)
        assert user.username == 'auth1'

    def test_get_user_missing_raises_authentication_failed(self):
        auth = DynamoJWTAuthentication()
        try:
            auth.get_user({'user_id': 'missing-id'})
            assert False, 'expected AuthenticationFailed'
        except AuthenticationFailed:
            pass

    def test_get_user_inactive_raises_authentication_failed(self):
        item = user_repo.create_user(username='auth2', email='auth2@udd.cl', password='pw12345!')
        user_repo.update_user(item['id'], {'is_active': False})
        auth = DynamoJWTAuthentication()
        try:
            auth.get_user({'user_id': item['id']})
            assert False, 'expected AuthenticationFailed'
        except AuthenticationFailed:
            pass
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest users/test_auth.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'users.auth'`

- [ ] **Step 3: Write the implementation**

```python
# users/auth.py
"""Custom JWT auth backed by DynamoDB instead of django.contrib.auth's
ORM-backed User. See
docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from users.dynamodb import user as user_repo
from users.models import Administrator


class _ProfessorProxy:
    def __init__(self, user_id):
        self.id = user_id


class DynamoUser:
    """Duck-typed stand-in for django.contrib.auth.models.User. Every
    professor/administrator account in the app is one of these - backed
    by a UsersTable item, never a real Django ORM row."""

    def __init__(self, item):
        self._item = item
        self.id = item['id']
        self.pk = item['id']
        self.username = item['username']
        self.email = item['email']
        self.first_name = item.get('first_name', '')
        self.last_name = item.get('last_name', '')
        self.is_active = item.get('is_active', True)
        self.is_administrator = item.get('is_administrator', False)
        self.is_super_admin = item.get('is_super_admin', False)
        self.is_staff = self.is_administrator
        self.is_authenticated = True
        self.is_anonymous = False

    def get_full_name(self):
        full = f'{self.first_name} {self.last_name}'.strip()
        return full or self.username

    def check_password(self, raw_password):
        return user_repo.check_user_password(self._item, raw_password)

    @property
    def professor(self):
        return _ProfessorProxy(self.id)

    @property
    def administrator(self):
        if not self.is_administrator:
            raise Administrator.DoesNotExist(f'User {self.id} is not an administrator')
        return Administrator(self._item)


class DynamoJWTAuthentication(JWTAuthentication):
    """Overrides get_user() to fetch the account from DynamoDB instead of
    the ORM (default implementation does get_user_model().objects.get(id=...))."""

    def get_user(self, validated_token):
        user_id = validated_token.get('user_id')
        if user_id is None:
            raise AuthenticationFailed('Token contained no recognizable user identification')
        item = user_repo.get_user_by_id(str(user_id))
        if item is None:
            raise AuthenticationFailed('User not found', code='user_not_found')
        if not item.get('is_active', True):
            raise AuthenticationFailed('User is inactive', code='user_inactive')
        return DynamoUser(item)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest users/test_auth.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add users/auth.py users/test_auth.py
git commit -m "feat(users): add DynamoDB-backed JWT authentication"
```

---

### Task 9: Rewrite `users/custom_jwt.py`

**Files:**
- Modify: `users/custom_jwt.py` (full rewrite)
- Test: `users/test_custom_jwt.py`

**Interfaces:**
- Consumes: `users/dynamodb/user.py` (Task 4), `users/auth.DynamoUser` (Task 8).
- Produces: `CustomTokenObtainPairSerializer`, `CustomTokenObtainPairView` (same names/behavior as before — login by username or email, same error message strings, since the frontend doesn't inspect them but keeping them avoids an unrelated UX change).

- [ ] **Step 1: Write the failing test**

```python
# users/test_custom_jwt.py
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from users.custom_jwt import CustomTokenObtainPairSerializer
from users.dynamodb import user as user_repo
from users.dynamodb.testing import DynamoDBTestCase


class CustomTokenObtainPairSerializerTest(DynamoDBTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.factory = APIRequestFactory()
        user_repo.create_user(username='loginuser', email='login@udd.cl', password='correct-pw')

    def test_login_by_username(self):
        serializer = CustomTokenObtainPairSerializer(data={'username': 'loginuser', 'password': 'correct-pw'})
        assert serializer.is_valid(), serializer.errors
        assert 'access' in serializer.validated_data
        assert 'refresh' in serializer.validated_data

    def test_login_by_email(self):
        serializer = CustomTokenObtainPairSerializer(data={'username': 'login@udd.cl', 'password': 'correct-pw'})
        assert serializer.is_valid(), serializer.errors

    def test_login_wrong_password(self):
        serializer = CustomTokenObtainPairSerializer(data={'username': 'loginuser', 'password': 'wrong'})
        assert serializer.is_valid() is False

    def test_login_unknown_user(self):
        serializer = CustomTokenObtainPairSerializer(data={'username': 'nobody', 'password': 'whatever'})
        assert serializer.is_valid() is False

    def test_login_inactive_user(self):
        item = user_repo.get_user_by_username('loginuser')
        user_repo.update_user(item['id'], {'is_active': False})
        serializer = CustomTokenObtainPairSerializer(data={'username': 'loginuser', 'password': 'correct-pw'})
        assert serializer.is_valid() is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest users/test_custom_jwt.py -v`
Expected: FAIL (old serializer queries `django.contrib.auth.models.User`, which has no `loginuser` row)

- [ ] **Step 3: Write the implementation**

```python
# users/custom_jwt.py
"""Vista personalizada para JWT que permite autenticación por email o
username - ahora contra DynamoDB en lugar del ORM. Ver
docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md.
"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from users.auth import DynamoUser
from users.dynamodb import user as user_repo


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Serializer personalizado que permite autenticación por username o email"""

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if not username or not password:
            raise serializers.ValidationError(
                {'non_field_errors': ['Debe incluir "username" y "password".']}
            )

        item = user_repo.get_user_by_username(username) or user_repo.get_user_by_email(username)

        if not item:
            raise serializers.ValidationError(
                {'non_field_errors': ['No se encontró una cuenta de usuario activa para las credenciales provistas']}
            )

        if not item.get('is_active', True):
            raise serializers.ValidationError(
                {'non_field_errors': ['Esta cuenta de usuario está desactivada']}
            )

        if not user_repo.check_user_password(item, password):
            raise serializers.ValidationError(
                {'non_field_errors': ['No se encontró una cuenta de usuario activa para las credenciales provistas']}
            )

        user = DynamoUser(item)
        refresh = self.get_token(user)
        return {'refresh': str(refresh), 'access': str(refresh.access_token)}


class CustomTokenObtainPairView(TokenObtainPairView):
    """Vista personalizada para obtener tokens JWT con autenticación por email o username"""
    serializer_class = CustomTokenObtainPairSerializer
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest users/test_custom_jwt.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add users/custom_jwt.py users/test_custom_jwt.py
git commit -m "feat(users): rewrite JWT login serializer against DynamoDB"
```

---

### Task 10: Rewrite `users/serializers.py` and `users/views.py`

**Files:**
- Modify: `users/serializers.py` (full rewrite)
- Modify: `users/views.py` (full rewrite)
- Test: `users/test_views.py`

**Interfaces:**
- Consumes: `users/models.py` (Task 7), `users/dynamodb/access_code.py` (Task 5).
- Produces: same URL surface as before (`users/urls.py` is unchanged — same router registrations, same `path('token/', ...)` etc.), same JSON response shapes for `/auth/professors/me/`, `/auth/professors/stats/`, `/auth/administrators/me/`, `/auth/professors/` (list), `/auth/professors/access_codes/`, `/auth/professors/create_with_code/`, `POST /auth/professors/` (registration).

- [ ] **Step 1: Write the failing tests**

```python
# users/test_views.py
from django.test import TestCase
from rest_framework.test import APIClient

from users.dynamodb import access_code as access_code_repo
from users.dynamodb import user as user_repo
from users.dynamodb.testing import DynamoDBTestCase


class RegistrationTest(DynamoDBTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        access_code_repo.create_access_code('newprof@udd.cl', '123456')

    def test_register_with_valid_code(self):
        response = self.client.post('/api/auth/professors/', {
            'username': 'newprof', 'email': 'newprof@udd.cl', 'password': 'pw12345!x',
            'first_name': 'New', 'last_name': 'Prof', 'access_code': '123456',
        })
        assert response.status_code == 201, response.data
        assert user_repo.get_user_by_username('newprof') is not None
        code = access_code_repo.get_access_code('123456')
        assert code['is_used'] is True

    def test_register_with_invalid_code_rejected(self):
        response = self.client.post('/api/auth/professors/', {
            'username': 'newprof2', 'email': 'other@udd.cl', 'password': 'pw12345!x',
            'access_code': 'wrong-code',
        })
        assert response.status_code == 400

    def test_register_with_mismatched_email_rejected(self):
        response = self.client.post('/api/auth/professors/', {
            'username': 'newprof3', 'email': 'different@udd.cl', 'password': 'pw12345!x',
            'access_code': '123456',
        })
        assert response.status_code == 400


class LoginAndMeTest(DynamoDBTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.item = user_repo.create_user(
            username='meprof', email='meprof@udd.cl', password='pw12345!x',
            first_name='Me', last_name='Prof',
        )

    def _login(self):
        response = self.client.post('/api/auth/token/', {'username': 'meprof', 'password': 'pw12345!x'})
        assert response.status_code == 200, response.data
        return response.data['access']

    def test_login_then_me(self):
        access = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = self.client.get('/api/auth/professors/me/')
        assert response.status_code == 200
        assert response.data['user']['username'] == 'meprof'
        assert response.data['is_administrator'] is False

    def test_administrator_me_forbidden_for_non_admin(self):
        access = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = self.client.get('/api/auth/administrators/me/')
        assert response.status_code == 403

    def test_administrator_me_ok_for_admin(self):
        user_repo.update_user(self.item['id'], {'is_administrator': True})
        access = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = self.client.get('/api/auth/administrators/me/')
        assert response.status_code == 200

    def test_me_requires_auth(self):
        response = self.client.get('/api/auth/professors/me/')
        assert response.status_code == 401


class AdminManageProfessorsTest(DynamoDBTestCase, TestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        admin_item = user_repo.create_user(
            username='admin1', email='admin1@udd.cl', password='pw12345!x', is_administrator=True,
        )
        login = self.client.post('/api/auth/token/', {'username': 'admin1', 'password': 'pw12345!x'})
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        user_repo.create_user(username='listedprof', email='listed@udd.cl', password='pw12345!x')

    def test_list_professors(self):
        response = self.client.get('/api/auth/professors/')
        assert response.status_code == 200
        usernames = {p['user']['username'] for p in response.data}
        assert 'listedprof' in usernames
        assert 'admin1' in usernames  # admins are auto-professors too

    def test_create_with_code(self):
        response = self.client.post('/api/auth/professors/create_with_code/', {'email': 'invitee@udd.cl'})
        assert response.status_code == 201, response.data
        assert 'access_code' in response.data

    def test_create_with_code_rejects_non_udd_email(self):
        response = self.client.post('/api/auth/professors/create_with_code/', {'email': 'invitee@gmail.com'})
        assert response.status_code == 400

    def test_access_codes_list(self):
        self.client.post('/api/auth/professors/create_with_code/', {'email': 'invitee2@udd.cl'})
        response = self.client.get('/api/auth/professors/access_codes/')
        assert response.status_code == 200
        assert any(c['email'] == 'invitee2@udd.cl' for c in response.data)

    def test_create_with_code_requires_admin(self):
        user_repo.create_user(username='plainprof', email='plainprof@udd.cl', password='pw12345!x')
        login = self.client.post('/api/auth/token/', {'username': 'plainprof', 'password': 'pw12345!x'})
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = client.post('/api/auth/professors/create_with_code/', {'email': 'x@udd.cl'})
        assert response.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest users/test_views.py -v`
Expected: FAIL (old `ProfessorViewSet`/serializers are still ORM-`ModelViewSet`-based and error out against the new non-ORM `Professor`/`ProfessorAccessCode` shim from Task 7)

- [ ] **Step 3: Write `users/serializers.py`**

```python
# users/serializers.py
"""
Serializers para la app users. Professor/Administrator/Student/
ProfessorAccessCode are no longer Django models (see users/models.py),
so these are plain serializers.Serializer subclasses doing manual
validation/dict-shaping instead of ModelSerializer.
"""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import ProfessorAccessCode


def serialize_user_proxy(user_proxy):
    return {
        'id': user_proxy.id,
        'username': user_proxy.username,
        'email': user_proxy.email,
        'first_name': user_proxy.first_name,
        'last_name': user_proxy.last_name,
    }


def serialize_professor(professor):
    return {
        'id': professor.id,
        'user': serialize_user_proxy(professor.user),
        'access_code': professor.access_code,
        'full_name': professor.user.get_full_name(),
        'created_at': professor.created_at,
        'updated_at': professor.updated_at,
    }


def serialize_administrator(administrator):
    return {
        'id': administrator.id,
        'user': serialize_user_proxy(administrator.user),
        'is_super_admin': administrator.is_super_admin,
        'created_at': administrator.created_at,
        'updated_at': administrator.updated_at,
    }


def serialize_access_code(code):
    return {
        'email': code.email,
        'access_code': code.access_code,
        'is_used': code.is_used,
        'created_at': code.created_at,
        'used_at': code.used_at,
    }


class ProfessorCreateSerializer(serializers.Serializer):
    """Serializer para crear un Profesor con User - Requiere código de acceso"""
    username = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(validators=[validate_password])
    first_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name = serializers.CharField(required=False, allow_blank=True, default='')
    access_code = serializers.CharField(required=True, allow_blank=False, allow_null=False)

    def validate_access_code(self, value):
        access_code_clean = value.strip()
        email = self.initial_data.get('email', '').strip().lower()

        if not email:
            raise serializers.ValidationError('El correo electrónico es requerido')

        matching = ProfessorAccessCode.objects.filter(
            access_code=access_code_clean, is_used=False, email__iexact=email,
        ).first()

        if not matching:
            existing_code = ProfessorAccessCode.objects.filter(access_code=access_code_clean).first()
            if existing_code:
                if existing_code.is_used:
                    raise serializers.ValidationError(
                        'El código de acceso ya fue utilizado. Contacta al administrador para obtener un nuevo código.'
                    )
                raise serializers.ValidationError(
                    'El código de acceso no corresponde a este correo electrónico. Verifica que el correo sea el mismo al que se envió el código.'
                )
            raise serializers.ValidationError(
                'El código de acceso no es válido. Contacta al administrador para obtener un código válido.'
            )
        return access_code_clean

    def validate_email(self, value):
        from users.dynamodb import user as user_repo
        email_lower = value.strip().lower()
        if user_repo.get_user_by_email(email_lower) is not None:
            raise serializers.ValidationError('Ya existe un usuario registrado con este correo electrónico')
        return email_lower

    def create(self, validated_data):
        from django.utils import timezone

        from .models import Professor

        access_code = validated_data.pop('access_code')
        professor = Professor.objects.create(**validated_data, access_code=access_code)

        code_obj = ProfessorAccessCode.objects.filter(
            access_code=access_code, is_used=False, email__iexact=professor.user.email,
        ).first()
        code_obj.is_used = True
        code_obj.save(update_fields=['is_used', 'used_at'])

        return professor


class StudentSerializer(serializers.Serializer):
    """Serializer para Estudiante"""
    full_name = serializers.CharField()
    email = serializers.EmailField()
    rut = serializers.CharField()


class StudentBulkCreateSerializer(serializers.Serializer):
    """Serializer para crear múltiples estudiantes desde un Excel"""
    students = StudentSerializer(many=True)

    def create(self, validated_data):
        from .models import Student

        students = []
        for student_data in validated_data['students']:
            student, _created = Student.objects.get_or_create(
                email=student_data['email'], defaults=student_data,
            )
            students.append(student)
        return {'students': students}
```

- [ ] **Step 4: Write `users/views.py`**

```python
# users/views.py
"""
Views para la app users. Professor/Administrator/Student are no longer
Django ORM models (see users/models.py), so these are plain
viewsets.ViewSet subclasses instead of ModelViewSet - list responses
are plain arrays (confirmed safe: the frontend already reads
`response.data.results || response.data`).
"""
import pandas as pd
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import Administrator, Professor, ProfessorAccessCode, Student
from .serializers import (
    ProfessorCreateSerializer, StudentBulkCreateSerializer, StudentSerializer,
    serialize_access_code, serialize_administrator, serialize_professor,
)


class AdministratorViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def me(self, request):
        try:
            administrator = request.user.administrator
        except Administrator.DoesNotExist:
            return Response({'error': 'El usuario no es un administrador'}, status=status.HTTP_403_FORBIDDEN)
        return Response(serialize_administrator(administrator))


class ProfessorViewSet(viewsets.ViewSet):

    def get_permissions(self):
        if self.action == 'create':
            permission_classes = []
        elif self.action in ['create_with_code', 'access_codes']:
            permission_classes = [IsAdminUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_authenticators(self):
        # Registration (create) is public - no Authorization header
        # expected, so don't even try to parse one.
        if getattr(self, 'action', None) == 'create':
            return []
        return super().get_authenticators()

    def create(self, request):
        serializer = ProfessorCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        professor = serializer.save()
        return Response(serialize_professor(professor), status=status.HTTP_201_CREATED)

    def list(self, request):
        return Response([serialize_professor(p) for p in Professor.objects.filter()])

    @action(detail=False, methods=['get'])
    def me(self, request):
        try:
            professor = request.user.professor
            professor = Professor.objects.get(id=professor.id)
        except Professor.DoesNotExist:
            return Response({'error': 'El usuario no es un profesor'}, status=status.HTTP_404_NOT_FOUND)
        data = serialize_professor(professor)
        data['is_administrator'] = hasattr(request.user, 'administrator')
        return Response(data)

    @action(detail=False, methods=['get'])
    def access_codes(self, request):
        return Response([serialize_access_code(c) for c in ProfessorAccessCode.objects.all()])

    @action(detail=False, methods=['get'])
    def stats(self, request):
        try:
            professor = Professor.objects.get(id=request.user.professor.id)
        except Professor.DoesNotExist:
            return Response({'error': 'El usuario no es un profesor'}, status=status.HTTP_404_NOT_FOUND)

        from game_sessions.dynamodb.game_session import list_sessions_for_professor
        completed_sessions_count = len(list_sessions_for_professor(professor.id, status='completed'))
        unique_students_count = professor.get_unique_students_count()

        return Response({'sessions': completed_sessions_count, 'students': unique_students_count})

    @action(detail=False, methods=['post'])
    def create_with_code(self, request):
        import random
        import string
        from urllib.parse import quote

        from django.conf import settings

        from users.dynamodb import user as user_repo

        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'El correo electrónico es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        if not email.endswith('@udd.cl'):
            return Response({'error': 'El correo debe ser de la universidad (@udd.cl)'}, status=status.HTTP_400_BAD_REQUEST)

        if ProfessorAccessCode.objects.filter(email=email, is_used=False).first():
            return Response({'error': 'Ya existe un código de acceso pendiente para este correo'}, status=status.HTTP_400_BAD_REQUEST)

        if user_repo.get_user_by_email(email) is not None:
            return Response({'error': 'Ya existe un usuario registrado con este correo electrónico'}, status=status.HTTP_400_BAD_REQUEST)

        max_attempts = 100
        access_code = None
        for _ in range(max_attempts):
            candidate = ''.join(random.choices(string.digits, k=6))
            if not ProfessorAccessCode.objects.filter(access_code=candidate).exists():
                access_code = candidate
                break

        if access_code is None:
            return Response({'error': 'No se pudo generar un código único. Intente nuevamente.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        ProfessorAccessCode.objects.create(email=email, access_code=access_code)

        app_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        register_url = f'{app_url}/profesor/registro'
        first_name = request.data.get('first_name', '').strip()
        greeting = f'Hola {first_name},' if first_name else 'Hola,'
        subject = 'Código de Acceso - Misión Emprende UDD'
        body_plain = (
            f'{greeting}\n\nHas sido invitado a registrarte como profesor en Misión Emprende UDD.\n\n'
            f'Tu código de acceso es: {access_code}\n\nPara completar tu registro:\n'
            f'1. Visita: {register_url}\n2. Ingresa tu correo: {email}\n'
            f'3. Ingresa el código de acceso: {access_code}\n4. Completa el formulario de registro\n\n'
            f'Este código es único y solo puede ser usado una vez.\n\n¡Bienvenido!\nEquipo Misión Emprende UDD'
        )
        mailto_link = f'mailto:{email}?subject={quote(subject)}&body={quote(body_plain)}'

        return Response({
            'success': True,
            'access_code': access_code,
            'email': email,
            'mailto_link': mailto_link,
            'subject': subject,
            'body': body_plain,
            'message': 'Código de acceso generado exitosamente. Abre tu cliente de correo para enviarlo.',
        }, status=status.HTTP_201_CREATED)


class StudentViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def list(self, request):
        return Response([
            {'id': s.id, 'full_name': s.full_name, 'email': s.email, 'rut': s.rut}
            for s in Student.objects.filter()
        ])

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        serializer = StudentBulkCreateSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.save()
            return Response(
                {'students': [{'id': s.id, 'full_name': s.full_name, 'email': s.email, 'rut': s.rut} for s in result['students']]},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def upload_excel(self, request):
        """Subir archivo Excel y crear estudiantes automáticamente."""
        if 'file' not in request.FILES:
            return Response({'error': 'No se proporcionó ningún archivo'}, status=status.HTTP_400_BAD_REQUEST)

        excel_file = request.FILES['file']
        if not excel_file.name.endswith(('.xlsx', '.xls')):
            return Response({'error': 'El archivo debe ser un Excel (.xlsx o .xls)'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(excel_file)
            required_columns = ['Correo', 'RUT', 'Nombre', 'Apellido Paterno', 'Apellido Materno']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                return Response({
                    'error': f'Faltan las siguientes columnas en el Excel: {", ".join(missing_columns)}',
                    'columnas_requeridas': required_columns,
                    'columnas_encontradas': df.columns.tolist(),
                }, status=status.HTTP_400_BAD_REQUEST)

            students_created, students_updated, errors = [], [], []
            for index, row in df.iterrows():
                try:
                    nombre = str(row['Nombre']).strip() if pd.notna(row['Nombre']) else ''
                    apellido_paterno = str(row['Apellido Paterno']).strip() if pd.notna(row['Apellido Paterno']) else ''
                    apellido_materno = str(row['Apellido Materno']).strip() if pd.notna(row['Apellido Materno']) else ''
                    full_name = ' '.join(p for p in [nombre, apellido_paterno, apellido_materno] if p)
                    email = str(row['Correo']).strip() if pd.notna(row['Correo']) else ''
                    rut = str(row['RUT']).strip() if pd.notna(row['RUT']) else ''

                    if not email:
                        errors.append(f'Fila {index + 2}: Correo vacío')
                        continue
                    if not rut:
                        errors.append(f'Fila {index + 2}: RUT vacío')
                        continue
                    if not full_name:
                        errors.append(f'Fila {index + 2}: Nombre completo vacío')
                        continue

                    student, created = Student.objects.update_or_create(
                        email=email, defaults={'full_name': full_name, 'rut': rut},
                    )
                    entry = {'id': student.id, 'full_name': student.full_name, 'email': student.email, 'rut': student.rut}
                    (students_created if created else students_updated).append(entry)
                except Exception as e:
                    errors.append(f'Fila {index + 2}: {str(e)}')

            response_data = {
                'total_filas': len(df),
                'estudiantes_creados': len(students_created),
                'estudiantes_actualizados': len(students_updated),
                'errores': len(errors),
                'detalle_errores': errors[:10],
                'mensaje': (
                    f'Se procesaron {len(df)} filas. {len(students_created)} creados, '
                    f'{len(students_updated)} actualizados, {len(errors)} errores.'
                    if errors else
                    f'Se procesaron {len(df)} filas correctamente. {len(students_created)} creados, '
                    f'{len(students_updated)} actualizados.'
                ),
            }
            status_code = status.HTTP_201_CREATED if (students_created or students_updated) else status.HTTP_400_BAD_REQUEST
            return Response(response_data, status=status_code)
        except pd.errors.EmptyDataError:
            return Response({'error': 'El archivo Excel está vacío'}, status=status.HTTP_400_BAD_REQUEST)
        except pd.errors.ParserError as e:
            return Response({'error': f'Error al leer el archivo Excel: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Error inesperado al procesar el archivo: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

- [ ] **Step 5: Update `users/urls.py`**

Remove the now-deleted `UserViewSet` registration (no frontend caller, and it wrapped `django.contrib.auth.models.User` directly — dropping it rather than reimplementing an unused endpoint):

```python
# users/urls.py
"""
URLs para la app users (autenticación y usuarios)
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)
from .views import AdministratorViewSet, ProfessorViewSet, StudentViewSet
from .custom_jwt import CustomTokenObtainPairView

router = DefaultRouter()
router.register(r'administrators', AdministratorViewSet, basename='administrator')
router.register(r'professors', ProfessorViewSet, basename='professor')
router.register(r'students', StudentViewSet, basename='student')

urlpatterns = [
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('', include(router.urls)),
]
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest users/test_views.py -v`
Expected: PASS (14 tests)

- [ ] **Step 7: Commit**

```bash
git add users/serializers.py users/views.py users/urls.py users/test_views.py
git commit -m "feat(users): rewrite serializers/views/urls against the DynamoDB shim"
```

---

### Task 11: Settings cleanup (drop axes, swap auth class) and `users/admin.py`

**Files:**
- Modify: `mision_emprende_backend/settings.py`
- Modify: `users/admin.py`

**Interfaces:**
- Consumes: `users.auth.DynamoJWTAuthentication` (Task 8).
- Produces: no new interfaces — this task removes dead config, nothing downstream depends on it.

- [ ] **Step 1: Remove django-axes**

In `mision_emprende_backend/settings.py`:
- Remove `'axes',` from `INSTALLED_APPS` (line 55).
- Remove `'axes.middleware.AxesMiddleware',  # ...` from `MIDDLEWARE` (line 88).
- Remove `'axes.backends.AxesStandaloneBackend',  # ...` from `AUTHENTICATION_BACKENDS` (line 163) — leave `'django.contrib.auth.backends.ModelBackend'` (still needed for the `/admin/` site).
- Remove the whole `# DJANGO AXES (Brute Force Protection)` block (`AXES_FAILURE_LIMIT` through `AXES_LOCKOUT_BY_COMBINATION_USER_AND_IP`, lines ~359-368).

- [ ] **Step 2: Swap the JWT authentication class**

In `REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']`, replace:

```python
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',  # Para admin
    ),
```

with:

```python
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'users.auth.DynamoJWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',  # Para /admin/ (academic/challenges)
    ),
```

- [ ] **Step 3: Remove `django-axes` from `requirements.txt`**

Delete the `django-axes` (or `django_axes`) line.

- [ ] **Step 4: Clean up `users/admin.py`**

`Administrator`/`Professor`/`ProfessorAccessCode`/`Student` are no longer Django ORM models, so `admin.ModelAdmin`/`admin.register` against them breaks Django's admin app loading. Replace the file:

```python
# users/admin.py
"""
Admin para la app users.

Professor/Administrator/Student/ProfessorAccessCode moved to DynamoDB
(see users/models.py) and are no longer registerable Django ORM models
- there is nothing to register here. django.contrib.auth's own User
model keeps its default admin registration automatically; this file
intentionally has none of its own.
"""
```

- [ ] **Step 5: Run the full test suite to check for regressions from the settings change**

Run: `pytest users/ -v`
Expected: PASS (all tests from Tasks 4-10 still pass with axes gone and the new auth class wired in)

- [ ] **Step 6: Commit**

```bash
git add mision_emprende_backend/settings.py requirements.txt users/admin.py
git commit -m "chore(users): drop django-axes, wire DynamoJWTAuthentication, clean up admin.py"
```

---

### Task 12: Full regression pass across `game_sessions`/`admin_dashboard`

**Files:**
- No production code changes expected. If any test in this run fails, that specific file needs a small compatibility fix in `users/models.py` (Task 7) — this task is verification, not a rewrite.

**Interfaces:**
- Consumes: everything from Tasks 1-11.

- [ ] **Step 1: Run the entire pre-existing test suite unmodified**

Run: `pytest game_sessions/ admin_dashboard/ -v`
Expected: PASS. These files were never touched by this migration (per the Global Constraints) — they exercise the `users/models.py` shim indirectly through their existing `User.objects.create_user(...)` / `Professor.objects.create(user=user)` / `Administrator.objects.create(user=...)` / `Student.objects.get_or_create(...)` fixture and application code.

- [ ] **Step 2: If anything fails, diagnose against the shim, not the test**

Per the Global Constraints, `game_sessions`/`admin_dashboard` files don't get modified — if a test fails here, it means `users/models.py`'s shim doesn't cover a call shape that wasn't caught by the Task 7 audit. Fix `users/models.py` (or the relevant `users/dynamodb/*.py` repository function) to match the existing call site, re-run, repeat until green.

- [ ] **Step 3: Run the complete test suite once more, from the repo root**

Run: `pytest`
Expected: PASS across every app (confirms nothing outside `game_sessions`/`admin_dashboard`/`users` broke either).

- [ ] **Step 4: Commit (only if Step 2 required fixes)**

```bash
git add users/models.py users/dynamodb/
git commit -m "fix(users): cover a call shape the shim audit missed"
```
(Skip this step entirely if Step 1 passed clean on the first try.)

---

### Task 13: Deploy and verify end-to-end

**Files:**
- No file changes — this is a deploy + manual verification task.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Build**

Run: `cd frontend && npm run build` (or `npx vite build` if pre-existing unrelated TS errors block `tsc`, per the earlier session's precedent), then from the repo root: `sam build`

- [ ] **Step 2: Deploy**

Run: `sam deploy`
Expected: changeset applies cleanly; stack outputs include `UsersTableName` (new).

- [ ] **Step 3: Create the first professor account through the public API (the original unblocking goal)**

```bash
curl -X POST https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/api/auth/professors/ \
  -H "Content-Type: application/json" \
  -d '{"username": "...", "email": "...", "password": "...", "access_code": "..."}'
```

This requires an access code to exist first. Since `create_with_code` needs `IsAdminUser` (chicken-and-egg for the very first account), create the first `ProfessorAccessCode` + `is_administrator=True` User directly via a one-off script using `boto3`/the `users/dynamodb` repository functions against the deployed `UsersTable` (this table has no VPC restriction — it's reachable directly from any machine with the right AWS credentials, unlike RDS. This is the concrete unblock: no security-group tunnel needed).

- [ ] **Step 4: Verify login end-to-end**

`POST /api/auth/token/` with the new account's username/password → confirm `200` with `access`/`refresh` tokens. `GET /api/auth/professors/me/` with the token → confirm `200` with the expected profile shape.

- [ ] **Step 5: Confirm no regression on the existing deployed frontend**

Load `https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/profesor/login` and log in with the new credentials through the actual UI.
