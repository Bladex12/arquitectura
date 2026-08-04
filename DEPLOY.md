# Deploy Guide — Misión Emprende

Two deploy paths exist in this repo. Pick the one that matches what you're doing:

| Path | Use case | Files involved |
|---|---|---|
| [Docker Compose](#1-docker-compose-devsimple-prod) | Local dev, or a simple single-VM production deploy | `docker-compose.yml`, `docker-compose.prod.yml` |
| [AWS SAM (serverless)](#2-aws-sam-serverless-deploy) | Real production target: AWS Academy Learner Lab | `template.yaml`, `Dockerfile.lambda`, `lambda/*` |

---

## 1. Docker Compose (dev/simple prod)

### 1a. Local development

**Requirements:** Docker Desktop.

Create `.env` in repo root:

```env
DATABASE_HOST=host.docker.internal
DATABASE_PORT=3306
DATABASE_NAME=mision_emprende2
DATABASE_USER=root
DATABASE_PASSWORD=1234
SECRET_KEY=tu-secret-key-aqui
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

Run:

```bash
docker-compose up --build
```

On container start, `docker-entrypoint.sh` automatically runs migrations, `collectstatic`, and seeds game data (`create_initial_data`, `create_video_institucional`, `create_stage3`, `create_stage4`, `update_challenges`). If you also need Etapa 1 minigame content, seed it manually once:

```bash
docker exec mision_emprende_backend python manage.py create_minigame_data
```

Optional: import an existing DB dump instead of seeding from scratch:

```bash
mysql -u root -p mision_emprende2 < "Dump20260416.sql"
```

Access:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000/api

### 1b. Simple production (single host, no AWS)

Create `.env.prod` in repo root:

```env
DATABASE_HOST=db
DATABASE_PORT=3306
DATABASE_NAME=mision_emprende_prod
DATABASE_USER=mision_user
DATABASE_PASSWORD=tu-password
MYSQL_ROOT_PASSWORD=root-password
SECRET_KEY=tu-secret-key-seguro
DEBUG=False
ALLOWED_HOSTS=tu-dominio.com,localhost
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis-password
CORS_ALLOWED_ORIGINS=https://tu-dominio.com
FRONTEND_URL=https://tu-dominio.com
```

Bring up the DB first and (optionally) load a dump:

```bash
docker-compose -f docker-compose.prod.yml up -d db
# wait 30-60s for MySQL to be healthy
docker exec -i mision_emprende_db_prod mysql -u root -p$MYSQL_ROOT_PASSWORD mision_emprende_prod < "Dump20260416.sql"
```

Then bring up everything:

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

This variant runs `gunicorn` directly (migrate/collectstatic already happened via the `db` step or must be run manually if skipping the dump — `docker exec mision_emprende_backend_prod python manage.py migrate`).

Access:
- Frontend: http://localhost (nginx, port 80)
- Backend: http://localhost:8000/api

Useful commands:

```bash
docker-compose logs -f          # tail logs
docker-compose down             # stop
docker-compose down -v          # stop + wipe volumes
```

---

## 2. AWS SAM (serverless) deploy

Real production target: **AWS Academy Learner Lab**. Stack: Django on Lambda (via Lambda Web Adapter, container image), DynamoDB for all persistence (`game_sessions`/`users`/`academic`/`challenges`/`admin_dashboard`), API Gateway (REST + WebSocket), S3 for static/media and frontend hosting, Firehose+Athena for analytics. No relational database anywhere — RDS MySQL (`users`/`academic`/`challenges`) was retired 2026-08-04 once those apps finished their DynamoDB cutover (see `docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md`). Fully serverless, no VPC.

Defined in `template.yaml`. WS handlers (`lambda/ws-*`) and the Firehose stream handler are stubs — functional but minimal.

### Requirements

- AWS CLI configured with Learner Lab credentials (`aws configure`, or paste the Lab's temporary credentials)
- AWS SAM CLI
- Docker (SAM builds `DjangoFunction` as a container image via `Dockerfile.lambda`)
- Node.js not required locally — `lambda/ws-*` and `lambda/stream-to-firehose` are plain Node 22 zip functions, built by SAM

### Why this template looks the way it does

AWS Academy Learner Lab imposes constraints that shape several design choices — don't "fix" these without re-reading the comments in `template.yaml`:

- **No IAM role creation.** Every Lambda is pinned to a pre-provisioned `LabRoleArn` parameter instead of letting SAM generate roles.
- **No CloudFront.** `cloudfront:CreateOriginAccessControl` and even `cloudfront:ListDistributions` are `AccessDenied` on this account. The frontend is hosted as a plain public S3 static website instead (HTTP only, no custom domain).
- **`BroadcastFunction` is deliberately NOT in the VPC** — historical: back when `DjangoFunction` ran inside a VPC (for RDS), it couldn't reach the WebSocket Management API directly (`execute-api` Interface endpoints only support REST APIs configured as PRIVATE, not WebSocket `PostToConnection`). `game_sessions/broadcast.py` still async-invokes `BroadcastFunction` rather than calling the Management API directly — harmless now that `DjangoFunction` isn't in a VPC either, just not worth unwinding.

### One-time setup: gather parameters

From the Learner Lab AWS console / CLI, collect:

- `LabRoleArn` — the Lab's execution role ARN (`arn:aws:iam::<account>:role/LabRole` typically)
- `DjangoSecretKey` — Django `SECRET_KEY` for prod

### Build and deploy

```bash
sam build
sam deploy --guided
```

`--guided` walks through the parameters above and saves them to `samconfig.toml` for future `sam deploy` runs.

Canary/`AutoPublishAlias` deployment preferences are intentionally left off every function until the base stack deploys cleanly once — don't add them prematurely.

### Post-deploy: read the Outputs

```bash
sam list stack-outputs --stack-name mision-emprende
```

Key outputs:
- `DjangoApiUrl` — REST API base URL (also serves the SPA, see below)
- `WebSocketUrl` — WebSocket endpoint
- `ContentTableName`, `UsersTableName`, `GameSessionTableName`, `ConnectionsTableName`
- `StaticMediaBucketName`, `AnalyticsBucketName`

### Seed game content into DynamoDB

The Lambda container does **not** run these on cold start (concurrent invocations could race). Run them out-of-band from any machine with valid AWS credentials for this account — DynamoDB isn't VPC-restricted, so unlike the old RDS setup this needs no bastion/tunnel, just `CONTENT_TABLE` pointed at the deployed table name (from `ContentTableName` above):

```bash
CONTENT_TABLE=<ContentTableName> AWS_REGION=us-east-1 python manage.py create_initial_data
CONTENT_TABLE=<ContentTableName> AWS_REGION=us-east-1 python manage.py create_stage3
CONTENT_TABLE=<ContentTableName> AWS_REGION=us-east-1 python manage.py create_stage4
CONTENT_TABLE=<ContentTableName> AWS_REGION=us-east-1 python manage.py create_minigame_data
```

### Deploy the frontend

The React build is baked into the same Docker image as the Django app (served by `DjangoFunction` itself, see `mision_emprende_backend/views_frontend.py`) — no separate S3 bucket / `aws s3 sync` step. Because of this, **any frontend-only change now requires a full `sam build && sam deploy`** — slower than a plain sync, but there's no faster path once the SPA lives in the Lambda image.

1. Point the frontend at the deployed API/WS endpoints. Edit `frontend/.env.production`:

   ```env
   VITE_WS_URL=wss://<WebSocketApi-id>.execute-api.<region>.amazonaws.com/prod
   VITE_API_URL=https://<DjangoApi-id>.execute-api.<region>.amazonaws.com/prod/api
   ```

   (Values come from the `WebSocketUrl` / `DjangoApiUrl` stack outputs above.)

2. Build the frontend **locally, before** `sam build` — the Docker image copies whatever is on disk in `frontend/dist/` at build time, there's no build step inside the Dockerfile itself:

   ```bash
   cd frontend
   npm install
   npm run build      # tsc + vite build -> frontend/dist
   cd ..
   ```

3. `sam build && sam deploy`

4. Open `DjangoApiUrl` from the stack outputs — the SPA now loads from the same HTTPS domain as the API.

### Updating an existing stack

After code changes, `sam build && sam deploy` again — SAM diffs against the deployed stack and only replaces what changed. Frontend-only changes also need `sam build && sam deploy` now (see above) — there's no lighter-weight sync path anymore.

### Cost control (Learner Lab has a spending cap)

- DynamoDB tables use `PAY_PER_REQUEST` billing — no idle cost, nothing to stop between sessions.
- No RDS, no NAT Gateway, no VPC endpoints, no other always-on billed resource in this stack.

### Known stubs / incomplete pieces

- `lambda/ws-connect`, `lambda/ws-disconnect`, `lambda/ws-default`, `lambda/stream-to-firehose` are minimal stubs, not fully-featured handlers — check `lambda/*/index.js` before assuming production-grade behavior.
