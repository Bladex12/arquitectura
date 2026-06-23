# Spec: Resultados Podium Redesign + Tablet Auto-Sync

**Date:** 2026-05-01  
**Status:** Approved

---

## Goal

Replace the professor's flat leaderboard `Resultados` screen with the same animated podium used on tablets. Add automatic tablet navigation to the podium when a stage ends, and show per-team sync badges on the professor's view so they can confirm all tablets are showing the results.

---

## Problem

1. **Visual inconsistency:** Tablets show the Space Missions–style animated podium (`PodiumScreen` component). The professor's `Resultados` page uses a static `GlassCard` list — no animation, no visual impact.
2. **No auto-sync:** When a stage ends and the professor is redirected to Resultados, tablets do not automatically navigate to their podium. They stay on whatever screen they were on.
3. **No sync visibility:** The professor has no way to know whether students are actually looking at the results.

---

## Solution: Approach B — Backend flag + screen reporting

### Backend changes (Django)

**`game_sessions/models.py`**

- `GameSession.show_results_stage` — `PositiveSmallIntegerField(default=0)`: 0 = off, 1–4 = professor is showing results for that stage number.
- `TabletConnection.current_screen` — `CharField(max_length=50, default='', blank=True)`: tablet self-reports its current screen identifier (e.g. `'results_1'`, `'activity'`, `'lobby'`).

**New migration:** `game_sessions/migrations/XXXX_add_show_results_stage_and_current_screen.py`

**API endpoints (in `game_sessions/views.py` or new viewset):**

| Method | URL | Who calls it | Purpose |
|--------|-----|--------------|---------|
| `POST` | `/api/sessions/{id}/show-results/` | Professor frontend | Sets `show_results_stage = N` on the session |
| `PATCH` | `/api/sessions/tablet-connections/{id}/screen/` | Tablet frontend | Updates `current_screen` on the connection |

`show-results` endpoint: requires professor JWT auth, accepts `{"stage": N}`. Sets `show_results_stage = N`. Returns `200 OK`. Setting `stage: 0` clears the flag. The existing `next-stage` endpoint should also reset `show_results_stage = 0` as part of its logic so tablets stop showing results when the professor advances.

`tablet-connections/{id}/screen/` endpoint: `AllowAny` (tablets have no auth), accepts `{"screen": "results_1"}`. Returns `200 OK`.

`show_results_stage` must be included in the `GameSession` serializer so it appears in the lobby GET response (`/api/sessions/{id}/lobby/`) that tablets already poll every 5 s. Also add `current_screen` to the `TabletConnection` serializer so the professor's polling can read it.

---

### Frontend — Tablets

**Files to update:** `frontend/src/pages/tablets/etapa1/Resultados.tsx` (shared for all stages), `frontend/src/pages/tablets/Lobby.tsx`, and other activity pages that poll game state.

**Logic change in tablet polling:**

In every tablet page's `loadGameState` polling callback, after fetching `lobbyData`:

```
if (gameData.show_results_stage > 0 && !isOnResultsPage) {
  → navigate to /tablet/etapa{N}/resultados/?connection_id=...
}
```

**Screen reporting:** When a tablet's Resultados page mounts (or after results are loaded), it calls `PATCH /api/sessions/tablet-connections/{connectionId}/screen/` with `{"screen": "results_{N}"}`. When it unmounts or navigates away, it calls with `{"screen": "lobby"}` or `{"screen": "activity"}`.

---

### Frontend — Professor Resultados

**File:** `frontend/src/pages/profesor/etapa1/Resultados.tsx`

Replace the current `GlassCard` leaderboard with `<PodiumScreen>`, adding two new props:

```tsx
interface PodiumScreenProps {
  teams: TeamResult[];
  stageName: string;
  onContinue: () => void;
  // New:
  syncStatus?: Record<number, boolean>;  // team_id → is tablet on results screen
  actionButtons?: React.ReactNode;       // replaces the default Continuar button
}
```

The professor's Resultados page:
1. On mount, calls `POST /api/sessions/{id}/show-results/` with `{stage: N}` to set the flag.
2. Polls `GET /api/sessions/{id}/` every 5 s to read updated `TabletConnection.current_screen` values.
3. Builds `syncStatus` map: `team_id → current_screen === 'results_{N}'`.
4. Renders `<PodiumScreen>` with `syncStatus` and `actionButtons` (`Cancelar Sala` + `Ir a Etapa N+1`).

**Sync badge rendering in `PodiumScreen`:** For each team column (top-3 and lower items), if `syncStatus` prop is provided, render a badge between the score and the bar:
- Green pulse + "tablet OK" → `syncStatus[team_id] === true`
- Grey dots + "esperando" → `syncStatus[team_id] === false` or undefined

---

## Data flow

```
Stage ends (current_activity → null)
  ↓
Professor auto-redirected to /profesor/resultados/{id}/?stage_id=N
  ↓
Profesor page mounts → POST /api/sessions/{id}/show-results/ {stage: N}
  ↓
Tablets poll every 5 s → detect show_results_stage = N
  ↓
Tablets navigate to /tablet/etapa{N}/resultados/?connection_id=...
  ↓
Tablet Resultados mounts → PATCH /api/sessions/tablet-connections/{cid}/screen/ {screen: "results_N"}
  ↓
Professor polls → reads current_screen per connection → updates sync badges
```

---

## What does NOT change

- The `PodiumScreen` animation sequence (bars grow, avatars pop, confetti).
- The `onContinue` callback on the tablet side (navigates back to lobby).
- The professor's `handleNextStage` / `handleFinalizeSession` logic.
- All existing routing for activities and lobby.

---

## Out of scope

- Roulette wheel (Stage 4 special activity) — separate feature.
- WebSocket push — polling is sufficient and consistent with existing architecture.
- Any other game screens beyond Resultados.
