# DynamoDB Migration for `academic` + `challenges` + `admin_dashboard`

Status: Approved
Date: 2026-08-03

## Context

`users` and `game_sessions` are already off RDS MySQL (see
`2026-07-19-dynamodb-single-table-design.md` and
`2026-07-29-users-dynamodb-migration-design.md`). What remains on RDS is
`academic` (Faculty/Career/Course), `challenges` (Stage/ActivityType/
Activity/WordSearchOption/Topic/Challenge/RouletteChallenge/Minigame/
LearningObjective/AnagramWord/ChaosQuestion/GeneralKnowledgeQuestion),
`admin_dashboard` (five metric-cache models with FKs into `challenges`),
and Django's built-in `auth.User` (used only for the `/admin/` site
login).

Trigger: RDS is the one component of the stack that isn't serverless — a
provisioned `db.t3.micro` sitting in a VPC 24/7 (manually stopped between
work sessions to control AWS Academy Learner Lab cost), which also forces
`DjangoFunction` into a VPC and everything that comes with that (security
groups, subnet group, `DynamoDBVpcEndpoint`/`S3VpcEndpoint` so Lambda ENIs
in private subnets can reach DynamoDB/S3, a `LambdaVpcEndpoint` so
`DjangoFunction` can invoke `BroadcastFunction`). Removing RDS entirely
makes the backend fully serverless and lets all of that VPC plumbing be
deleted from `template.yaml`.

Decision (confirmed with the project owner): Django's `/admin/` site is
being deleted in the same pass (see "Admin site" below), so `auth.User`
does not need a replacement datastore — this migration is a genuine full
RDS retirement, not a partial one like the `users` migration was.

## Goals / non-goals

- Goal: `academic`, `challenges`, and `admin_dashboard` read/write
  entirely through DynamoDB, with zero RDS dependency anywhere in the
  stack.
- Goal: existing `game_sessions`/`users` DynamoDB items that already
  reference `academic`/`challenges` ids (`course_id`, `current_stage_id`,
  `current_activity_id`, etc.) keep resolving correctly — no orphaned
  references.
- Goal: seed management commands (`create_initial_data`, `create_stage3`,
  `create_stage4`, `create_minigame_data`, `create_video_institucional`,
  `update_challenges`) keep working against the new shim with no changes,
  or only mechanical ones.
- Non-goal: preserving Django's `/admin/` site. It's being deleted
  (separate task, same branch) — confirmed via `logs/django.log` showing
  only occasional debug-browsing hits and zero content-editing
  customization in `academic/admin.py`/`challenges/admin.py` since the
  initial commit; the React CMS at `/admin/*` already owns real content
  and professor management.
- Non-goal: dual-write / zero-downtime cutover. This is a scheduled
  maintenance-window big-bang cutover — low-traffic student app on a
  Learner Lab account, no 24/7 SLA, and the `users`/`game_sessions`
  precedent used the same approach.
- Non-goal: rebuilding django-axes-style login throttling — irrelevant
  here, `/admin/` (the only session-authenticated surface) is being
  removed.

## Key scheme

New table `ContentTable` (own `AWS::DynamoDB::Table` resource in
`template.yaml`, `PAY_PER_REQUEST`, same style as `GameSessionTable`/
`UsersTable`), shared by `academic`, `challenges`, and `admin_dashboard`'s
metric-cache models — the first table in this codebase shared across
apps. Justified because these are small, tightly-coupled catalog
entities (course content, not runtime game state) that don't warrant 3
separate CFN tables. `PK`/`SK` + one GSI (`GSI1`) — no second GSI needed,
unlike `UsersTable`.

**Ids are the existing RDS auto-increment integers, stringified — not
fresh UUIDs.** This is a deliberate deviation from the `users`/
`game_sessions` UUID4 convention: `GameSessionTable` items already store
`academic`/`challenges` integer ids as plain attributes (`course_id` at
`game_sessions/views.py:150-170`, `current_stage_id`/`current_activity_id`
at `game_sessions/views.py:411-430,591-609,698,725`). Minting new ids at
migration time would silently orphan every existing and in-flight
`GameSession`/`TeamActivityProgress` item. The backfill script is the one
place this constraint is enforced (see the implementation plan).

| Entity | PK | SK | GSI1PK | GSI1SK | Notes |
|---|---|---|---|---|---|
| Faculty | `FACULTY#<id>` | `METADATA` | `FACULTY#ACTIVE` (only if `is_active`) | `<name>` | GSI1 serves "list active faculties by name" without a scan+filter |
| Career | `CAREER#<id>` | `METADATA` | `FACULTY#<faculty_id>` | `CAREER#<name>` | "careers for a faculty" (`academic/views.py`) |
| Course | `COURSE#<id>` | `METADATA` | `CAREER#<career_id>` | `COURSE#<name>` | "courses for a career". Also stores denormalized `faculty_id` (copied from the parent Career at write time) so `admin_dashboard`'s `Course.objects.filter(id__in=...).values_list('id','career__faculty_id')` cross-join becomes a single attribute read |
| Stage | `STAGE#<id>` | `METADATA` | `STAGE#ALL` | `<zero-padded number>` | GSI1 replaces `Stage.objects.all().order_by('number')` |
| ActivityType | `ACTIVITYTYPE#<id>` | `METADATA` | — | — | Tiny catalog (few rows) — filtered `scan` is fine, no GSI |
| Activity | `STAGE#<stage_id>` | `ACTIVITY#<order_number padded>#<id>` | `ACTIVITY#<id>` | `METADATA` | Parented under its Stage (not a top-level PK) — dominant read is "activities for a stage, in order" (`Meta.ordering=['stage','order_number']`); a single `Query(PK=STAGE#<id>, begins_with(SK,'ACTIVITY#'))` returns them pre-sorted since the SK is zero-padded. GSI1 covers direct-by-id lookups (`admin_dashboard/services.py`, `game_sessions` reads of `current_activity_id`) |
| WordSearchOption | `STAGE#<stage_id>` | `ACTIVITY#<order_number>#<activity_id>#WSOPTION#<id>` | `WSOPTION#ACTIVITY#<activity_id>` | `<name>` | GSI1 serves "options for an activity" (`Activity.word_search_options.filter(is_active=True)`). Co-located with its Activity's partition; repo layer must explicitly delete children on Activity delete (no cascade in DynamoDB, unlike today's `on_delete=CASCADE`) |
| Topic | `TOPIC#<id>` | `METADATA` | `TOPIC#ACTIVE` (only if active) | `<name>` | Faculty M2M handled by a separate join item, below |
| TopicFaculty (join) | `TOPIC#<topic_id>` | `FACULTY#<faculty_id>` | `FACULTY#<faculty_id>` | `TOPIC#<topic_id>` | Replaces the `topics_faculties` M2M table — the one pattern with no 1:1 ORM equivalent. `Topic.objects.prefetch_related('faculties').filter(faculties__id=faculty_id)` becomes: `Query(GSI1PK=FACULTY#<id>)` → topic ids → `BatchGetItem` the Topic items. Reverse (Topic → its Faculties) is `Query(PK=TOPIC#<id>, begins_with(SK,'FACULTY#'))` |
| Challenge | `TOPIC#<topic_id>` | `CHALLENGE#<id>` | `CHALLENGE#<id>` | `METADATA` | Parented under Topic (dominant read: `Challenge.objects.filter(topic=...)`, matches today's `on_delete=RESTRICT`). GSI1 for direct-by-id (`admin_dashboard`) |
| RouletteChallenge | `ROULETTE#<id>` | `METADATA` | — | — | No FK in the ORM, flat catalog — scan-and-filter, same scale justification as `game_sessions`' `list_tablets` |
| Minigame | `MINIGAME#<id>` | `METADATA` | — | — | Flat catalog |
| LearningObjective | `STAGE#<stage_id or 'NONE'>` | `LEARNINGOBJ#<id>` | `LEARNINGOBJ#<id>` | `METADATA` | `stage` is `SET_NULL` today — model the null case as a literal `STAGE#NONE` bucket |
| AnagramWord | `ANAGRAMWORD#<id>` | `METADATA` | — | — | `get_anagram_data()` needs *all* active words to `random.sample()` from — filtered `scan`, small table |
| ChaosQuestion | `CHAOSQ#<id>` | `METADATA` | — | — | Same — all-active scan |
| GeneralKnowledgeQuestion | `GKQ#<id>` | `METADATA` | — | — | Same |
| ActivityDurationMetric (admin_dashboard) | `ACTIVITY#<activity_id>` | `METRIC#DURATION` | — | — | 1:1 aggregate cache keyed by the content it describes — atomic `ADD` increments via `update_item` |
| StageDurationMetric (admin_dashboard) | `STAGE#<stage_id>` | `METRIC#DURATION` | — | — | |
| TopicSelectionMetric (admin_dashboard) | `TOPIC#<topic_id>` | `METRIC#SELECTION` | — | — | |
| ChallengeSelectionMetric (admin_dashboard) | `TOPIC#<topic_id>` | `CHALLENGE#<challenge_id>#METRIC#SELECTION` | `CHALLENGE#<challenge_id>` | `METRIC` | Needs both "by challenge" and co-location under its Topic |
| DailyMetricsSnapshot (admin_dashboard) | `SNAPSHOT#<date>` | `METADATA` | `SNAPSHOT#ALL` | `<date>` | No FK dependency on academic/challenges content |

Every item carries a `type` attribute (`'Faculty'`, `'Activity'`,
`'ActivityDurationMetric'`, ...) so scans/GSI queries sharing a partition
prefix can be discriminated in application code — same convention as
`GameSessionTable`/`UsersTable`.

## Access patterns

| Pattern | How it's served |
|---|---|
| Faculty/Career/Course list (active, by name) | `Query(GSI1PK=FACULTY#ACTIVE)` / `Query(GSI1PK=FACULTY#<id>)` / `Query(GSI1PK=CAREER#<id>)` |
| Course → its Faculty (for admin_dashboard cross-join) | Read `faculty_id` directly off the Course item (denormalized at write time) |
| Stage list, ordered | `Query(GSI1PK=STAGE#ALL)` |
| Activities for a Stage, ordered | `Query(PK=STAGE#<id>, begins_with(SK,'ACTIVITY#'))` |
| Activity by id | `Query(GSI1PK=ACTIVITY#<id>)` then read the item |
| WordSearchOptions for an Activity | `Query(GSI1PK=WSOPTION#ACTIVITY#<activity_id>)` |
| Topics for a Faculty | `Query(GSI1PK=FACULTY#<id>)` on the TopicFaculty join items → `BatchGetItem` |
| Faculties for a Topic | `Query(PK=TOPIC#<id>, begins_with(SK,'FACULTY#'))` |
| Challenges for a Topic | `Query(PK=TOPIC#<topic_id>, begins_with(SK,'CHALLENGE#'))` |
| Challenge by id | `Query(GSI1PK=CHALLENGE#<id>)` |
| "Random N active" (AnagramWord/ChaosQuestion/GeneralKnowledgeQuestion/roulette `.random`) | Filtered `Scan` for all-active, then `random.sample()` in Python — unifies with the deterministic-seed logic these methods already use internally, no new technique |
| Metric increment on activity/stage completion | `update_item` with `ADD total_completions :one, total_duration_seconds :dur` — atomic, fixes a read-modify-write race the current `.save()` pattern has |
| `avg_duration_seconds` | Computed on read (`total_duration_seconds / total_completions`), not stored — DynamoDB can't atomically maintain a running average |

## Serializer / shim implications

Every `serializers.ModelSerializer` in `academic/serializers.py` and
`challenges/serializers.py` becomes a plain `serializers.Serializer` with
explicit fields — `ModelSerializer` introspects `Meta.model._meta`, which
a non-ORM shim class doesn't have. This is the largest mechanical diff in
the implementation.

`academic/models.py` and `challenges/models.py` become compatibility
shims (plain classes, `.objects`-style manager with `.get/.filter/.create/
.get_or_create/...`), mirroring `users/models.py`'s `_Manager`/
`_ListResult` pattern, so most view/serializer/management-command code
keeps working. `get_or_create()` must signature-match Django's exactly
(`defaults=` dict, `created` boolean return) since ~15+ seed-command call
sites across the six management commands depend on it.

`Challenge.persona_image` stays on S3 via `django-storages` regardless of
this migration (`STORAGES['default']` already targets
`STATIC_MEDIA_BUCKET`) — the DynamoDB item stores the S3 key as a plain
string (`personas/foo.jpg`), and the serializer builds the URL manually
instead of relying on `ImageField.url`.

`.order_by('?')[:count]` (MySQL `RAND()`, used in `challenges/views.py`'s
`generate_preview`/`random` actions) has no DynamoDB equivalent — becomes
scan-all-active + `random.sample()`, matching the pattern
`get_anagram_data`/`get_general_knowledge_data` already use.

## Admin site

`django.contrib.admin` (`/admin/`) is deleted entirely: removed from
`INSTALLED_APPS`, its URL removed from `mision_emprende_backend/urls.py`,
`academic/admin.py`/`challenges/admin.py`/`admin_dashboard/admin.py`
deleted, `SessionAuthentication` removed from
`DEFAULT_AUTHENTICATION_CLASSES` (its only cited purpose). `django.contrib.
auth`/`sessions`/`messages` stay installed — `users/models.py`'s test
fixtures still construct `django.contrib.auth.models.User` as a throwaway
credential source, and none of the three apps require RDS to exist.

## Error handling

- `RESTRICT`-equivalent enforcement (Career→Faculty, Course→Career,
  Activity→Stage/ActivityType, Challenge→Topic) has no DynamoDB-native
  form — the repo layer's `delete_x()` functions must explicitly check
  for existing children first and raise, matching today's
  `ProtectedError` behavior.
- `CASCADE`-equivalent (WordSearchOption→Activity) — repo layer's
  `delete_activity()` explicitly deletes child WordSearchOptions first;
  no automatic cascade in DynamoDB.
- Duplicate-name/code uniqueness (`Faculty.name`, `*.code` fields marked
  `unique=True`) — conditional `PutItem` with
  `attribute_not_exists(PK)` isn't sufficient here since uniqueness is on
  a non-key attribute; repo layer does an explicit existence check via
  the relevant GSI query before create (best-effort, matches this app's
  low-concurrency content-editing usage — not a hard guarantee under
  a race, same tradeoff already accepted for `users`' username
  uniqueness at a higher-traffic surface).

## Testing

- `academic/dynamodb/testing.py`, `challenges/dynamodb/testing.py` —
  moto-backed, mirror `users/dynamodb/testing.py` / `game_sessions/
  dynamodb/testing.py`.
- Shim compatibility tests (`academic/test_models_shim.py`,
  `challenges/test_models_shim.py`) verifying exact call shapes found via
  a grep audit of `academic/views.py`, `challenges/views.py`,
  `admin_dashboard/views.py`, `admin_dashboard/services.py`, and the six
  seed management commands.
- Local dev (`docker-compose up`) needs a `CONTENT_TABLE` env var
  pointing at a local/moto-backed table, same as `USERS_TABLE`/
  `GAME_SESSIONS_TABLE`.

## Retention

No TTL — catalog content and metrics persist indefinitely, same as the
other two tables.

## Open items for the implementation plan

- The `academic/dynamodb/` and `challenges/dynamodb/` repository layers
  themselves (client/keys/one-module-per-entity) are real, non-trivial
  work — this spec defines the schema and access patterns they target,
  not the layers themselves.
- Whether `academic`/`challenges` share a single `client.py`
  (`mision_emprende_backend/dynamodb_client.py`) given they now share one
  table for the first time, vs. duplicating the small boilerplate per app
  — a judgment call for whoever implements it, not schema-affecting.
- Exact backfill script behavior (dry-run/verify modes, idempotency) is
  specified in the implementation plan, not here.
