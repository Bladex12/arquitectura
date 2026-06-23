# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Misión Emprende** is an educational game platform for UDD (Universidad del Desarrollo) students. Professors create game sessions where student teams progress through 4 entrepreneurship stages (Trabajo en equipo, Empatía, Creatividad, Comunicación). Students join via tablets using a room code/QR. The system uses real-time WebSocket communication managed by Django Channels + Redis.

## Running the Project

### Development (Docker)

```bash
# Start all services (backend on :8000, frontend on :5173)
docker-compose up --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Required `.env` file (root)

```
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

### Import database dump

```bash
mysql -u root -p mision_emprende2 < "Dump20251203 (1).sql"
```

### Seed game data

```bash
docker exec mision_emprende_backend python manage.py create_initial_data
docker exec mision_emprende_backend python manage.py create_stage3
docker exec mision_emprende_backend python manage.py create_stage4
docker exec mision_emprende_backend python manage.py create_minigame_data
```

(`create_minigame_data` seeds AnagramWord, ChaosQuestion, and GeneralKnowledgeQuestion records needed for Etapa 1.)

### Frontend (standalone)

```bash
cd frontend
npm install
npm run dev      # development server
npm run build    # TypeScript check + Vite build
```

### Backend Django commands (inside container)

```bash
docker exec mision_emprende_backend python manage.py migrate
docker exec mision_emprende_backend python manage.py createsuperuser
docker exec mision_emprende_backend python manage.py cancel_expired_sessions
```

## Architecture

### Backend (Django 5 + DRF + Channels)

Served via **Daphne** (ASGI) to support both HTTP and WebSockets.

Django apps:
- **`users`** — `User` (Django built-in) extended with `Professor`, `Student`, `Administrator`, `ProfessorAccessCode`. Students have no login — they exist only as data tied to game sessions.
- **`academic`** — `Faculty`, `Course` (academic structure for filtering).
- **`challenges`** — Game content: `Stage` → `Activity` (ordered by `order_number`) → `ActivityType` (minigame, presentation, etc.). Also: `Topic`, `Challenge` (user stories), `RouletteChallenge`, `WordSearchOption`, `AnagramWord`, `ChaosQuestion`, `GeneralKnowledgeQuestion`.
- **`game_sessions`** — Runtime state: `GameSession` (room with `room_code`), `SessionGroup` (multi-room), `Team`, `TeamStudent`, `TeamPersonalization`, `SessionStage`, `TeamActivityProgress`, `TeamBubbleMap`, `Tablet`, `TabletConnection`, `TokenTransaction`, `PeerEvaluation`, `ReflectionEvaluation`.
- **`admin_dashboard`** — Analytics and activity log.

**URL structure:**
- `POST /api/auth/` — JWT auth (simplejwt), professor registration
- `GET/POST /api/academic/` — Faculty/Course CRUD
- `GET/POST /api/sessions/` — GameSession, Team, TabletConnection, etc.
- `GET/POST /api/challenges/` — Stages, Activities, Topics, Challenges, etc.
- `GET/POST /api/admin/dashboard/` — Admin analytics

**Authentication:** JWT Bearer tokens. Tablet routes explicitly skip auth in `api.ts` interceptor — tablet endpoints use `AllowAny` permissions.

**Real-time:** Django Channels + Redis channel layers. WebSocket routes defined in `mision_emprende_backend/routing.py` (currently empty — consumers are set up per feature).

**Game content seeding:** Use management commands in `challenges/management/commands/` for initial data.

### Frontend (React 18 + TypeScript + Vite)

Located in `frontend/`. Uses Tailwind CSS, Framer Motion, Recharts, React Router v6, Axios.

**Three user types with separate route namespaces:**
- `/profesor/*` — Professor views: login, lobby management, per-stage control screens
- `/admin/*` — Administrator views: dashboard, game content management, professor management
- `/tablet/*` — Tablet/student views: join room, per-stage activity screens (no auth)
- `/evaluacion/:roomCode` — Peer evaluation form

**Per-stage page structure** mirrors game stages:
- `etapa1/` — Team personalization, instructional video, minigame (word search/anagram), presentation
- `etapa2/` — Topic/challenge selection, bubble map (empathy map)
- `etapa3/` — Prototype
- `etapa4/` — Pitch form, pitch presentation

**Services layer** (`frontend/src/services/`): Each file wraps API calls for a specific domain (`sessions.ts`, `teams.ts`, `challenges.ts`, etc.). All use the shared `api` axios instance in `services/api.ts`.

**API base URL:** In dev, Vite proxies `/api` to the backend. Controlled via `VITE_API_URL` env var.

## Key Conventions

- All Django models use `is_active` soft-delete pattern. Querysets filter `is_active=True` by default; pass `?include_inactive=true` to include all.
- Activity content (word search grids, anagram words, chaos questions) is selected **deterministically** per team using `seed = f"{team_id}_{session_stage_id}_{activity_id}"` so all tablets in a team see the same puzzle.
- Game config constants (team size, token rewards, room code length) live in `settings.GAME_CONFIG`.
- Language: codebase is bilingual — Python docstrings/comments in Spanish, code identifiers in English. Frontend labels in Spanish.
