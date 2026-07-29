# DynamoDB Migration for `users`

Status: Approved
Date: 2026-07-29

## Context

`users` (Django's built-in `auth.User` extended via `OneToOneField` by
`Professor` and `Administrator`, plus standalone `ProfessorAccessCode` and
`Student`) is the last authentication-critical app still on RDS MySQL.
`game_sessions` completed an equivalent cutover on 2026-07-19 (see
`2026-07-19-dynamodb-single-table-design.md`); that spec explicitly left
`users` on RDS as "a deliberate polyglot-persistence split." This spec
revises that decision for `users` specifically.

Trigger: RDS is deployed `PubliclyAccessible: false` (VPC-only, no
bastion). The Lambda reaches it fine at runtime, but there was no way for
a human to create the first professor/administrator account — self
registration requires an admin-issued `ProfessorAccessCode`, and no admin
exists yet in the fresh prod database. Chicken-and-egg, blocked on
network access, not application logic. Moving `users` off RDS removes
the network dependency entirely: accounts get created by hitting the
public API, same as any other write.

`academic` and `challenges` stay on RDS MySQL for now (separate task,
deliberately out of scope here) — this is a partial migration, not a
full RDS retirement.

## Goals / non-goals

- Goal: professor/administrator login (JWT) and registration work with
  no RDS dependency at all.
- Goal: zero changes to call sites in `game_sessions/views.py` and
  `admin_dashboard/views.py` that read `request.user.professor` /
  `request.user.administrator` / `hasattr(request.user, ...)`.
- Goal: Django's built-in `/admin/` site (used by `academic`/`challenges`
  content maintainers, via `academic/admin.py` and `challenges/admin.py`)
  keeps working, completely unaffected by this migration.
- Non-goal: touching `academic`/`challenges` storage.
- Non-goal: data migration/backfill. Prod `professors` and
  `professor_access_codes` tables are empty — confirmed while diagnosing
  the original blocker (self-registration validation reached the DB and
  returned "no valid code", not a missing-table error, meaning migrations
  ran but no rows exist).
- Non-goal: rebuilding django-axes (login throttling) against DynamoDB —
  dropped for now; revisit later if brute-force protection is needed
  (e.g. API Gateway throttling/WAF).

## Key scheme

New table `UsersTable` (own `AWS::DynamoDB::Table` resource in
`template.yaml`, `PAY_PER_REQUEST`, same style as `GameSessionTable`),
**separate from** `GameSessionTable` — keeps the auth bounded context
independent from game-runtime data and its already-busy `GSI1`.

| Entity | PK | SK | GSI1PK | GSI1SK |
|---|---|---|---|---|
| User (merged Professor + Administrator) | `USER#<username>` | `METADATA` | `EMAIL#<email>` | `METADATA` |
| ProfessorAccessCode | `ACCESSCODE#<code>` | `METADATA` | — | — |
| Student | `STUDENT#<uuid>` | `METADATA` | — | — |

**User item fields**: `id` (UUID4 — the stable identifier referenced
elsewhere as `professor_id`, e.g. `GameSessionTable`'s
`GSI1PK=PROFESSOR#<id>`), `username`, `email`, `password_hash` (Django's
`make_password()` output — the hasher functions work standalone, no ORM
required), `first_name`, `last_name`, `is_active`, `is_administrator`,
`is_super_admin`, `professor_access_code` (the code used at registration,
informational), `created_at`, `updated_at`.

**Merged, not split**: today's `Administrator`/`Professor` are separate
tables `OneToOneField`'d to `User` (an admin is automatically also a
professor). In Dynamo this collapses into one item per human account —
one `GetItem`/`PutItem` for the whole account, no join, no risk of the
pieces drifting out of sync. The 1:1 split only existed because
relational schemas separate concerns into tables; Dynamo doesn't need
that.

**Fully decoupled from Django's built-in auth.User**: the merged item is
*not* `OneToOneField`'d to anything — it owns its own username/password
and authenticates via a custom JWT path (see below), with zero
dependency on `django.contrib.auth.models.User`. Django's own `auth_user`
table stays on RDS, completely separate, used only by
`academic`/`challenges` maintainers logging into `/admin/`.

**Ids**: UUID4 strings, not MySQL auto-increment ints — matches the
`game_sessions` cutover precedent. `professor_id`/`student_id` already
flow through `game_sessions` as opaque values, so this is a value-format
change only, no referential-integrity break.

## Access patterns

| Pattern | How it's served |
|---|---|
| Login by username | `GetItem(PK=USER#<username>, SK=METADATA)` |
| Login by email (current behavior tries username then email) | `Query(GSI1PK=EMAIL#<email>)` |
| Access-code validation at registration | `GetItem(PK=ACCESSCODE#<code>)`, then check `email` (case-insensitive) and `is_used` in application code — same logic as today's `.filter(access_code=..., is_used=False, email__iexact=...)`, just one item instead of a queryset |
| Fetch a student by id (game_sessions team rosters) | `GetItem(PK=STUDENT#<uuid>)` |
| Registration (create account) | Conditional `PutItem` on `USER#<username>` with `attribute_not_exists(PK)` — rejects duplicate usernames without a separate existence check |

## Auth integration

- `custom_jwt.py`: `User.objects.get(username=...)` / `.get(email=...)`
  ORM calls become `get_user_by_username()` / `get_user_by_email()`
  Dynamo lookups. Password check stays
  `django.contrib.auth.hashers.check_password()` (storage-agnostic).
- New `JWTAuthentication` subclass overrides `get_user(validated_token)`
  to fetch the Dynamo item by the `user_id` claim and wrap it in a
  `DynamoUser` shim exposing: `id`, `username`, `email`, `is_active`,
  `is_authenticated = True`, `is_staff` (← `is_administrator`), and
  duck-typed `.professor` / `.administrator` properties — return a tiny
  object carrying `.id` when applicable, else raise `AttributeError` so
  existing `hasattr(request.user, 'professor')` checks keep working
  unmodified.
- `IsAuthenticated` / `IsAdminUser` DRF permission classes need no
  changes — they only duck-type `is_authenticated` / `is_staff`.
- `ProfessorViewSet.create` / `create_with_code` / `access_codes`: ORM
  writes become Dynamo `put_item` / conditional-write calls.
- `django.contrib.auth`, `django.contrib.admin` stay in
  `INSTALLED_APPS` — still needed for the password hashers, DRF's
  `IsAdminUser`/`SessionAuthentication` machinery in general, and the
  `/admin/` site itself (unrelated `auth_user` table, RDS, untouched).
- `users/admin.py`'s `Administrator`/`Professor`/`ProfessorAccessCode`/
  `Student` `ModelAdmin` registrations are removed (those models no
  longer exist as Django ORM models). `academic/admin.py` and
  `challenges/admin.py` are untouched.
- django-axes removed from `INSTALLED_APPS` / `MIDDLEWARE`.

## Error handling

- `GetItem` miss on login → same "no account found" validation error
  surfaced today.
- Duplicate username at registration → conditional `PutItem` failure →
  same validation error shape as today's `IntegrityError` path.
- `validate_password` (Django's built-in password strength validator)
  is unchanged — it's storage-agnostic already.

## Testing

- `users/dynamodb/testing.py`, moto-backed, mirrors
  `game_sessions/dynamodb/testing.py`.
- **Real blast radius**: ~15 `game_sessions/test_*.py` files plus
  `admin_dashboard/tests.py` construct fixtures via
  `User.objects.create(...)` / `Professor.objects.create(...)` directly.
  Rewriting each test body is wasted effort — `users/dynamodb/testing.py`
  exposes helpers (`create_test_professor(...)`, etc.) returning the same
  shape these tests already expect, so each test file swaps only its
  fixture-creation call.
- Local dev (`docker-compose up`): needs a `USERS_TABLE` env var pointing
  at a local/moto-backed table, same as `GAME_SESSIONS_TABLE`, so local
  dev doesn't require real AWS DynamoDB access.

## Retention

No TTL — accounts and access codes persist indefinitely, same as
`GameSessionTable`'s session data.

## Open items for the implementation plan

- The `users/dynamodb/` repository layer itself (mirroring
  `game_sessions/dynamodb/`'s `client.py`/`keys.py` pattern) is real,
  non-trivial work — this spec defines the schema and integration points
  it targets, not the layer itself.
- Exact shape of the `DynamoUser` auth shim (which attributes/properties
  it needs) should be finalized against a full audit of
  `request.user.*` usage across `game_sessions/views.py` and
  `admin_dashboard/views.py` during implementation, not guessed upfront.
