# Arquitectura — Misión Emprende

## 1. Contexto del Sistema

```mermaid
C4Context
  title Sistema Misión Emprende — Contexto

  Person(profesor, "Profesor", "Crea sesiones, controla etapas")
  Person(tablet, "Equipo / Tablet", "Juega sin login")
  Person(admin, "Administrador UDD", "Gestiona contenido y métricas")

  System(mision, "Misión Emprende", "Plataforma educativa de emprendimiento para UDD")

  Rel(profesor, mision, "Gestiona sesión")
  Rel(tablet, mision, "Participa en juego")
  Rel(admin, mision, "Administra contenido")
```

---

## 2. Contenedores (Infraestructura Docker)

```mermaid
C4Container
  title Contenedores — Docker Compose

  Person(users, "Profesores / Tablets / Admins")

  Container(nginx, "Nginx", "Reverse Proxy :80", "Enruta / y /api")
  Container(frontend, "React + Vite", "Node :5173", "SPA — 3 roles de usuario")
  Container(backend, "Django + Gunicorn", "Python :8000", "API REST — 5 apps Django")
  ContainerDb(mysql, "MySQL", ":3306", "Datos persistentes del juego")
  ContainerDb(redis, "Redis", ":6379", "Cache de sesiones y tokens")

  Rel(users, nginx, "HTTPS")
  Rel(nginx, frontend, "GET / → SPA assets")
  Rel(nginx, backend, "GET/POST /api/*")
  Rel(backend, mysql, "ORM — mysqlclient")
  Rel(backend, redis, "django-redis cache")
```

---

## 3. Estructura de Directorios — Backend

```mermaid
graph TD
  ROOT["📁 / (raíz)"]

  ROOT --> BE["📁 Backend (Django apps)"]
  ROOT --> FE["📁 frontend/"]
  ROOT --> CONFIG["📄 Configuración"]

  BE --> users["📁 users/"]
  BE --> academic["📁 academic/"]
  BE --> challenges["📁 challenges/"]
  BE --> game_sessions["📁 game_sessions/"]
  BE --> admin_dashboard["📁 admin_dashboard/"]
  BE --> project["📁 mision_emprende_backend/"]

  users --> u1["models.py\nUser · Professor · Student · ProfessorAccessCode"]
  users --> u2["views.py → serializers.py → urls.py"]
  users --> u3["signals.py ← 🔔 Observer Pattern\nauto-crea Professor/Admin al crear User"]
  users --> u4["custom_jwt.py\nJWT personalizado"]

  academic --> ac1["models.py\nFaculty · Career · Course"]
  academic --> ac2["views.py → serializers.py → urls.py"]

  challenges --> c1["models.py\n13 modelos: Stage · Activity · Topic\nChallenge · Minigame · AnagramWord..."]
  challenges --> c2["views.py → serializers.py → urls.py"]
  challenges --> c3["services.py ← ✅ Service Layer\ngeneración de sopas de letras"]
  challenges --> c4["management/commands/\n6 comandos de seeding ← 🔨 Command Pattern"]

  game_sessions --> g1["models.py\n14 modelos: GameSession · Team\nSessionStage · TeamActivityProgress..."]
  game_sessions --> g2["views.py ⚠️ 271KB\n¡Mezcla HTTP + lógica de negocio!\nRefactorizar en task futura"]
  game_sessions --> g3["signals.py ← 🔔 Observer Pattern\ncleanup al eliminar SessionGroup"]
  game_sessions --> g4["management/commands/\ncancel_expired_sessions · create_tablets"]

  admin_dashboard --> a1["models.py\n5 modelos de métricas"]
  admin_dashboard --> a2["views.py — solo lectura (analytics)"]
  admin_dashboard --> a3["signals.py ← 🔔 Observer Pattern\nactualiza métricas al completar actividades"]

  project --> p1["settings.py · urls.py\nwsgi.py · asgi.py"]
```

---

## 4. Estructura de Directorios — Frontend

```mermaid
graph TD
  SRC["📁 src/"]

  SRC --> APP["App.tsx\n57 rutas definidas"]
  SRC --> PAGES["📁 pages/"]
  SRC --> COMP["📁 components/"]
  SRC --> SVC["📁 services/"]
  SRC --> HOOKS["📁 hooks/ + config/"]
  SRC --> UTILS["📁 utils/"]

  PAGES --> PROF["📁 profesor/\n/profesor/*"]
  PAGES --> TAB["📁 tablets/\n/tablet/*"]
  PAGES --> ADM["📁 admin/\n/admin/*"]
  PAGES --> EVAL["📁 evaluacion/\n/evaluacion/:roomCode"]

  PROF --> PE1["etapa1/ VideoInstitucional · Instructivo\nPersonalizacion · Presentacion · Resultados"]
  PROF --> PE2["etapa2/ SeleccionarTema · BubbleMap"]
  PROF --> PE3["etapa3/ Prototipo"]
  PROF --> PE4["etapa4/ FormularioPitch · PresentacionPitch"]

  TAB --> TE1["etapa1/ VideoInstitucional · Instructivo\nPersonalizacion · Minijuego · Presentacion"]
  TAB --> TE2["etapa2/ SeleccionarTemaDesafioV2\nBubbleMapV2"]
  TAB --> TE3["etapa3/ PrototipoV2"]
  TAB --> TE4["etapa4/ FormularioPitch · PresentacionPitch"]

  COMP --> UI["📁 ui/ — shadcn/ui\nbadge · button · card · input..."]
  COMP --> MINI["📁 minigames/\nAnagramGame · WordSearchGame\nGeneralKnowledgeQuiz · MinigameSelector"]
  COMP --> ADMCOMP["📁 admin/\nDashboard · ManageProfessors · UpdateGame*"]
  COMP --> SHARED["Componentes compartidos\nLeaderboard · TimerBlock · GalacticPage\nConfetti · StarfieldBackground\nUBot*Modal x10"]

  SVC --> APIBASE["api.ts — Axios base\nJWT interceptor · tablet skip-auth"]
  SVC --> SVCS["16 archivos de servicio\nsessions · challenges · teams\ntokenTransactions · peerEvaluations\nreflectionEvaluations · academic..."]

  HOOKS --> H1["useGameStateRedirect.ts\nredirige según estado del juego"]
  HOOKS --> H2["useStarfield.ts\nanimación canvas de estrellas"]

  UTILS --> UT["devMode · timerAutoAdvance\ntabletResultsRedirect · textEncoding · toast"]
```

---

## 5. Patrones de Diseño Aplicados

```mermaid
graph LR
  subgraph "✅ Implementados"
    subgraph "Backend"
      P1["🔷 ViewSet/Router\n(DRF)\nTodos los endpoints REST\n5 apps, ~40 ViewSets"]
      P2["🔔 Observer/Signal\nusers/signals.py\ngame_sessions/signals.py\nadmin_dashboard/signals.py"]
      P3["⚙️ Service Layer\nchallenges/services.py\ngeneración puzzle determinístico"]
      P4["🔨 Command Pattern\n8 management commands\nseeding + mantenimiento"]
      P5["🗑️ Soft Delete\nis_active en todos los modelos\nquerysets filtran por default"]
      P6["🎲 Deterministic Seed\nseed = team_id + session_stage_id + activity_id\ntodos los tablets ven mismo puzzle"]
    end

    subgraph "Frontend"
      P7["🛣️ Role-based Routing\n/profesor/* /tablet/* /admin/*\nApp.tsx — 57 rutas"]
      P8["⚙️ Service Layer\n16 archivos en services/\ntoda lógica HTTP abstraída"]
      P9["🪝 Custom Hooks\nuseGameStateRedirect\nuseStarfield"]
      P10["🧩 Component Composition\nUBot*Modal x10\nMinigameSelector → AnagramGame/WordSearch/Quiz"]
    end
  end

  subgraph "⚠️ Incompletos / Deuda Técnica"
    D1["game_sessions/views.py 271KB\nNecesita Service Layer\n+ split por dominio"]
    D2["Prefijo 'V2' en componentes activos\nBubbleMapV2 · PrototipoV2\nRenombrar tras completar migración"]
  end
```

---

## 6. Flujo de una Solicitud HTTP (Game Session)

```mermaid
sequenceDiagram
  participant Browser as Tablet Browser
  participant Nginx as Nginx
  participant Gunicorn as Gunicorn (4 workers)
  participant View as game_sessions/views.py
  participant Model as Django ORM
  participant MySQL as MySQL
  participant Redis as Redis Cache

  Browser->>Nginx: POST /api/sessions/tablet-connections/
  Nginx->>Gunicorn: Proxy HTTP
  Gunicorn->>View: TabletConnectionViewSet.create()
  Note over View: AllowAny permission (sin JWT)
  View->>Redis: Cache lookup (django-redis)
  Redis-->>View: miss
  View->>Model: TabletConnection.objects.create(...)
  Model->>MySQL: INSERT
  MySQL-->>Model: OK
  Model-->>View: TabletConnection instance
  View->>Redis: Cache set
  View-->>Gunicorn: 201 JSON
  Gunicorn-->>Nginx: Response
  Nginx-->>Browser: 201 JSON
```

---

## 7. Flujo de Estado del Juego (Etapas)

```mermaid
stateDiagram-v2
  [*] --> Lobby: Profesor crea sala (room_code)
  Lobby --> Etapa1: Profesor avanza
  
  state Etapa1 {
    [*] --> VideoInstitucional
    VideoInstitucional --> Instructivo
    Instructivo --> Personalizacion
    Personalizacion --> Minijuego
    Minijuego --> Presentacion
    Presentacion --> Resultados
  }

  Etapa1 --> Etapa2: Profesor avanza
  
  state Etapa2 {
    [*] --> SeleccionarTema
    SeleccionarTema --> BubbleMap
    BubbleMap --> [*]
  }

  Etapa2 --> Etapa3: Profesor avanza

  state Etapa3 {
    [*] --> Prototipo
  }

  Etapa3 --> Etapa4: Profesor avanza

  state Etapa4 {
    [*] --> FormularioPitch
    FormularioPitch --> PresentacionPitch
  }

  Etapa4 --> Reflexion: Sesión finaliza
  Reflexion --> [*]
```

---

## 8. Qué Patrones Aplicar en Refactoring Futuro

```mermaid
graph TD
  AHORA["Estado Actual"]
  FUTURO["Objetivo"]

  AHORA -->|"game_sessions/views.py 271KB"| SPLIT["Split por dominio"]
  SPLIT --> SV["session_views.py\nCRUD de sesiones"]
  SPLIT --> TV["team_views.py\nCRUD de equipos"]
  SPLIT --> TabV["tablet_views.py\nTablet endpoints - AllowAny"]
  SPLIT --> PV["progress_views.py\nTeamActivityProgress"]
  SPLIT --> EV["evaluation_views.py\nPeerEvaluation + Reflection"]

  AHORA -->|"lógica en views"| SERVICES["Service Layer en game_sessions"]
  SERVICES --> GS["game_sessions/services.py\nvalidar avance · calcular tokens\ngestionar estado de sesión"]

  AHORA -->|"V2 suffix en componentes activos"| RENAME["Renombrar componentes"]
  RENAME --> R1["BubbleMapV2 → BubbleMap"]
  RENAME --> R2["PrototipoV2 → Prototipo"]
  RENAME --> R3["SeleccionarTemaDesafioV2 → SeleccionarTemaDesafio"]
```
