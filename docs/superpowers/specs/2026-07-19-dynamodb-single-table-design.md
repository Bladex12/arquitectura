# DynamoDB Single-Table Design for `game_sessions`

Status: Approved
Date: 2026-07-19

## Context

The serverless migration (see `template.yaml`) moves `game_sessions` runtime
data off RDS MySQL and into a single DynamoDB table (`GameSessionTable`,
already deployed with generic `PK`/`SK` base keys and one GSI,
`GSI1PK`/`GSI1SK`). `academic`, `challenges`, and `users` stay on RDS MySQL —
this is a deliberate polyglot-persistence split: DynamoDB items reference
RDS rows by id (e.g. `activity_id`, `stage_id`, `professor_id`) for
cross-app relations, but there is no cross-database join; the application
layer resolves those references.

This spec covers the key design for all 14 models currently in
`game_sessions/models.py`. It is the foundation the following remaining
migration tasks build on: the `game_sessions` ORM rewrite, real WS Lambda
logic (`$connect`/`$disconnect`/`$default`), and the frontend
polling-to-WebSocket swap. It does not cover those implementations —
only the schema they'll be built against.

## Goals / non-goals

- Goal: one `Query` fetches an entire game session's live state (all
  teams, progress, connections, tokens, evaluations) for WS-reconnect
  hydration and the professor's live dashboard — this is the dominant,
  latency-sensitive hot path.
- Goal: avoid write contention between tablets acting on different teams
  within the same room concurrently.
- Goal: fit the access patterns already confirmed against the existing
  Django routes and management commands (see "Access patterns" below).
- Non-goal: data migration/backfill from RDS. There is no production data
  yet — RDS `game_sessions` tables are dropped post-cutover, not migrated.
- Non-goal: WS Lambda implementation, frontend changes, admin_dashboard
  analytics. Separate specs.

## Key scheme

Single table `GameSessionTable` (already deployed):
- Base table: `PK` (hash), `SK` (range)
- `GSI1`: `GSI1PK` (hash), `GSI1SK` (range) — one secondary index

Room-scoped item collection: `PK = SESSION#<room_code>` for every entity
that belongs to exactly one game session. `room_code` (not the old
numeric session id) is the partition key, because tablets join and
reconnect by `room_code` far more frequently than professors navigate by
numeric `sessionId` — the higher-frequency, more latency-sensitive path
gets the direct key; the professor-side numeric id resolves via `GSI1`
instead (see below).

Two entities don't belong to a single room and get their own top-level
item collections instead of living inside a `SESSION#` partition:
- `SessionGroup` (a professor's label spanning multiple game sessions)
- `Tablet` (physical device inventory, reused across sessions over time)

## Entity → key mapping

| Entity | PK | SK | GSI1PK | GSI1SK | Notes |
|---|---|---|---|---|---|
| GameSession | `SESSION#<room_code>` | `METADATA` | `PROFESSOR#<professor_id>` | `<status>#<created_at_iso>` | `status` transitions use conditional writes (see Concurrency) |
| Team | `SESSION#<room_code>` | `TEAM#<team_id>#METADATA` | — | — | Embeds `TeamPersonalization` fields and the student roster (list of student ids) as nested attributes — both are 1:1/tiny and always fetched together with the team, never written independently. The `#METADATA` suffix (not bare `TEAM#<team_id>`) matters because `TeamActivityProgress`/`TeamBubbleMap`/`TeamRouletteAssignment` SKs also start with `TEAM#<team_id>#...` — without it, a `begins_with('TEAM#<team_id>')` query couldn't tell the team record apart from its children by key shape alone (use the `type` attribute, see below, to filter a broader `begins_with('TEAM#')` query down to just team records) |
| SessionStage | `SESSION#<room_code>` | `STAGE#<stage_id>` | — | — | `stage_id` is the RDS `challenges.Stage` id (stable int) |
| TeamActivityProgress | `SESSION#<room_code>` | `TEAM#<team_id>#PROGRESS#<activity_id>` | — | — | `activity_id` is the RDS `challenges.Activity` id |
| TeamBubbleMap | `SESSION#<room_code>` | `TEAM#<team_id>#BUBBLEMAP#<stage_id>` | — | — | |
| TabletConnection | `SESSION#<room_code>` | `TABLETCONN#<team_session_token>` | — | — | `team_session_token` is a UUID4, same as current field |
| TeamRouletteAssignment | `SESSION#<room_code>` | `TEAM#<team_id>#ROULETTE#<stage_id>` | — | — | |
| TokenTransaction | `SESSION#<room_code>` | `TOKENTX#<source_type>#<source_id>` when `source_id` is present; `TOKENTX#<iso_timestamp>#<uuid>` when it's not (`manual_adjustment`/`system` sources, which have no natural `source_id`) | — | — | Append-only ledger. The source-tied key form is what makes idempotency work (see Concurrency) — two writes for the same `(source_type, source_id)` collide on purpose. Listing a room's ledger via `begins_with('TOKENTX#')` returns both key shapes fine; sort by the `created_at` attribute client-side if chronological order matters, since SK is no longer guaranteed time-ordered once source-tied keys are mixed in |
| PeerEvaluation | `SESSION#<room_code>` | `PEEREVAL#<evaluator_team_id>#<evaluated_team_id>` | — | — | |
| ReflectionEvaluation | `SESSION#<room_code>` | `REFLECTION#<uuid>` | — | — | Also streamed to Firehose/S3 for analytics; rarely queried live |
| SessionGroup | `SESSIONGROUP#<uuid>` | `METADATA` | `PROFESSOR#<professor_id>` | `<created_at_iso>` | |
| Tablet | `TABLET#<tablet_code>` | `METADATA` | — | — | Catalog entity; `tablet_code` is already the natural unique key |

**Synthetic IDs**: every entity that currently relies on a Django
auto-increment integer `id` (Team, TokenTransaction, PeerEvaluation,
TeamRouletteAssignment, ReflectionEvaluation, SessionGroup) gets a UUID4
instead. Team `color`/`name` are not safe as natural keys — neither is
guaranteed unique (only `(game_session, name)` is unique together today)
nor immutable. **This means the frontend's `team.id` (and similar ids)
change from `number` to `string` — the biggest ripple effect of this
redesign, flagged for the implementation plan to account for.**

`Tablet` and `TabletConnection` are intentionally distinct: `Tablet` is
the physical device inventory (rarely changes), `TabletConnection` is
"this tablet is in this room/team right now" (per-session, high churn).

Every item carries a `type` attribute (e.g. `GameSession`, `Team`,
`TokenTransaction`) so consumers can discriminate item shape without
parsing `SK`/`GSI1PK` structure — this matters most on `GSI1`, where
`GameSession` and `SessionGroup` items share the same `PROFESSOR#<id>`
partition and are told apart by `type`, not by key shape alone.

## Access patterns

| Pattern | How it's served |
|---|---|
| Tablet joins by `room_code`; WS reconnect hydrates full room state | One `Query` on `PK=SESSION#<room_code>` returns GameSession + every team + all progress + connections + tokens + evaluations in a single call. This is the dominant hot path. |
| Professor's live view needs "all teams' progress for the current activity" | No extra query — filter the already-fetched room collection in-app by `activity_id`. |
| Professor's "my sessions" dashboard | `Query` on `GSI1PK=PROFESSOR#<professor_id>`, optionally `begins_with(GSI1SK, 'lobby')` / `'running'` to filter to active sessions, naturally sorted by status then recency |
| `cancel_expired_sessions` → EventBridge (system-wide, across all professors) | Periodic filtered `Scan` for `status IN (lobby, running)` AND `started_at` older than 2h. Deliberately not GSI-backed: low frequency (every few minutes), small item count at course-project scale, `PAY_PER_REQUEST` billing makes this a cents-level cost — not worth a second GSI. |
| Tablet reconnect by `team_session_token` | Happens within a known `room_code` (from the join URL), so it's `GetItem(PK=SESSION#<room_code>, SK=TABLETCONN#<token>)` — no cross-room index needed. |

## Concurrency & consistency

- **Team token totals**: atomic `UpdateItem` with `ADD tokens_total :amount`, not read-modify-write, so concurrent token awards from different sources never lose an update.
- **Session status transitions** (`lobby`→`running`→`completed`/`cancelled`): conditional writes (`ConditionExpression` checking the expected current `status`) so a race between a professor action and the expiry-check Lambda can't double-transition a session.
- **Room-collection reads**: strongly consistent `Query` on the base table for the live hot path (same partition, no extra cost for strong consistency). `GSI1`-served dashboard queries stay eventually consistent — GSIs can't be strongly consistent in DynamoDB, and "my sessions" isn't a real-time-critical view.
- **Token ledger idempotency**: when `source_id` is present, the SK itself is `TOKENTX#<source_type>#<source_id>` (see key mapping above), so a `PutItem` with `ConditionExpression=attribute_not_exists(PK)` naturally rejects a retried write for the same source event instead of double-awarding tokens. Sources with no natural `source_id` (`manual_adjustment`, `system`) use a timestamp+uuid SK instead and have no idempotency guarantee — they're one-off human/manual actions, not retryable automated events.

## Retention

No TTL on any session-scoped data (GameSession, Team, progress, tokens,
evaluations) — professors need `/profesor/historial/:sessionId` to work
indefinitely, and storage cost for small JSON items is negligible at this
scale. Ephemeral WS-layer state (the separate `ConnectionsTable`, tablet
heartbeat/`last_seen` staleness) keeps its own short TTL, unrelated to
this table.

## Testing

- Local unit tests use `moto` (mocked boto3 DynamoDB) against the new
  repository layer, consistent with the existing pytest setup.
- No data migration/backfill — see Non-goals.

## Open items for the implementation plan

- The repository/mapping layer replacing the Django ORM for these 14
  models is real, non-trivial work (task: "game_sessions ORM rewrite") —
  this spec defines the schema it targets, not the layer itself.
- Frontend TypeScript types referencing team/entity ids as `number` need
  auditing and updating to `string` (UUID4) as part of whichever task
  first writes to these new entities.
