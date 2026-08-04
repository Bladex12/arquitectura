"""Root pytest configuration.

The `users` app is no longer Django-ORM-backed (see
docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md):
`Professor` / `Administrator` / `Student` / `ProfessorAccessCode` are a
compatibility shim over DynamoDB. That makes a provisioned UsersTable a
prerequisite for *any* test that builds one of those fixtures - not just
the tests that deliberately opt into moto. Django's test runner
provisions the SQL test database for every test automatically; the
fixtures below are the DynamoDB equivalent for the users table, so that
existing test files (game_sessions/, admin_dashboard/) keep working
without being modified.

The same is true of `academic`/`challenges`/`admin_dashboard`'s metric
models since the 2026-08-03 migration (see
docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md):
`Faculty`/`Career`/`Course`/`Stage`/`Activity`/etc. are now backed by
ContentTable, and dozens of existing game_sessions/test_*.py fixture
helpers (e.g. `make_course()`) call `Faculty.objects.create(...)`
directly - so ContentTable gets the identical class-scoped
provision-and-restore treatment below.

Isolation semantics deliberately mirror Django's own TestCase:

* the moto mock + table live for the duration of a *class*, so items
  written by `setUpTestData()` / `setUpClass()` are visible to every test
  method in that class (Django keeps those rows in an outer atomic block
  for the same reason);
* everything an individual test method writes is rolled back afterwards
  by restoring the table to the post-setUpTestData baseline (Django rolls
  back the per-test transaction for the same reason).

Note the mock is *class*-scoped, so any `mock_aws()` a test starts in its
own `setUp()` is a nested mock. moto reference-counts these and only
resets its backends when the outermost one stops, which is why both
`game_sessions/dynamodb/testing.py` and `users/dynamodb/testing.py`
drop-then-create their tables instead of assuming a fresh backend.
"""
import os

import boto3
import pytest
from moto import mock_aws

USERS_TEST_TABLE = 'test-users'
CONTENT_TEST_TABLE = 'test-content'
TEST_REGION = 'us-east-1'


def _scan_all(table):
    items, kwargs = [], {}
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get('Items', []))
        last = resp.get('LastEvaluatedKey')
        if not last:
            return items
        kwargs['ExclusiveStartKey'] = last


def _restore(table, baseline):
    """Wipes the table and re-puts `baseline`, i.e. undoes whatever the
    test just wrote while keeping the class-level fixtures intact."""
    current = _scan_all(table)
    # Two separate batches on purpose: BatchWriteItem gives no ordering
    # guarantee *within* a request, so a delete and a put of the same key
    # in one batch can resolve delete-last and silently drop the item.
    with table.batch_writer() as batch:
        for item in current:
            batch.delete_item(Key={'PK': item['PK'], 'SK': item['SK']})
    with table.batch_writer() as batch:
        for item in baseline:
            batch.put_item(Item=item)


@pytest.fixture(scope='class', autouse=True)
def users_dynamodb_table():
    """Starts a moto mock and provisions the UsersTable for the class."""
    from users.dynamodb.testing import create_test_table

    mock = mock_aws()
    mock.start()
    # Provisioning must be inside the guard too: if create_test_table()
    # raises (schema drift, a moto upgrade, a credentials problem) after
    # start() but before the yield, an un-stopped mock leaves botocore
    # patched for the REST OF THE PYTEST PROCESS - every downstream test
    # then fails for reasons that have nothing to do with it.
    try:
        os.environ['USERS_TABLE'] = USERS_TEST_TABLE
        os.environ['AWS_REGION'] = TEST_REGION
        create_test_table(USERS_TEST_TABLE, region_name=TEST_REGION)
        yield {}
    finally:
        mock.stop()


@pytest.fixture(autouse=True)
def users_dynamodb_isolation(users_dynamodb_table):
    """Per-test rollback for the users table (see module docstring).

    Depends on `users_dynamodb_table` purely for ordering: that fixture
    (and therefore `setUpTestData`, which pytest runs from a class-scoped
    fixture too) is guaranteed to have finished before the first snapshot
    is taken here.
    """
    table = boto3.resource('dynamodb', region_name=TEST_REGION).Table(USERS_TEST_TABLE)
    if 'baseline' not in users_dynamodb_table:
        users_dynamodb_table['baseline'] = _scan_all(table)
    try:
        yield
    finally:
        _restore(table, users_dynamodb_table['baseline'])


@pytest.fixture(scope='class', autouse=True)
def content_dynamodb_table():
    """Starts a moto mock and provisions ContentTable for the class (see
    module docstring). Independent of users_dynamodb_table's mock -
    moto's mock_aws() contexts stack/reference-count correctly."""
    from academic.dynamodb.testing import create_test_table

    mock = mock_aws()
    mock.start()
    try:
        os.environ['CONTENT_TABLE'] = CONTENT_TEST_TABLE
        os.environ['AWS_REGION'] = TEST_REGION
        create_test_table(CONTENT_TEST_TABLE, region_name=TEST_REGION)
        yield {}
    finally:
        mock.stop()


@pytest.fixture(autouse=True)
def content_dynamodb_isolation(content_dynamodb_table):
    """Per-test rollback for ContentTable (see module docstring)."""
    table = boto3.resource('dynamodb', region_name=TEST_REGION).Table(CONTENT_TEST_TABLE)
    if 'baseline' not in content_dynamodb_table:
        content_dynamodb_table['baseline'] = _scan_all(table)
    try:
        yield
    finally:
        _restore(table, content_dynamodb_table['baseline'])
