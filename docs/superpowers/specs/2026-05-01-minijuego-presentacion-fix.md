# Fix: Actividad 1 Split Path — Word Search & Chaos Questions Never Appear

**Date:** 2026-05-01  
**Status:** Approved

## Problem

In Etapa 1 there is a split path after Personalización:
- Teams that know each other → **Minijuego** (word search → anagram → general knowledge)
- Teams that don't know each other → **Presentación** (intro → chaos questions → general knowledge)

Both `TabletMinijuego.tsx` and `TabletPresentacion.tsx` exist with correct routing, but students on tablets never see the word search or chaos question screens. Instead, `TabletMinijuego` shows a "Cargando minijuego..." spinner forever.

## Root Causes

### 1. `ActivityViewSet` requires authentication — tablets get 401
`ActivityViewSet` has `permission_classes = [IsAuthenticated]`. `TabletMinijuego` and `TabletPresentacion` both call `GET /challenges/activities/{id}/` via raw `fetch()` (no auth token). The 401 response causes `loadMinijuegoActivity` and `loadPresentacionActivity` to throw, so `minigameData` is never set.

### 2. Permanent failure lock in `loadMinijuegoActivity`
`minigameDataLoadedRef.current = true` is set **before** the try block. When the fetch fails, the catch resets `loadingMinijuegoRef` but not `minigameDataLoadedRef`. Every subsequent polling call sees `minigameDataLoadedRef.current = true` and skips the load entirely — the failure is permanent until page reload.

### 3. `generate_word_search` raises `ValueError` for 'creatividad' (11 chars)
`create_initial_data.py` puts `'creatividad'` in `config_data.words` as a fallback word for the word search. `generate_word_search()` in `services.py` raises `ValueError` for any word > 10 chars, causing the activity endpoint to return 500 even if auth was fixed.

### 4. `SessionStageViewSet` list also requires authentication
`TabletMinijuego` fetches `/sessions/session-stages/` via raw `fetch()` to get `sessionStageId`. This endpoint also requires `IsAuthenticated`, so `sessionStageId` is never obtained — word search selection becomes non-deterministic.

### 5. No seed data for AnagramWord, ChaosQuestion, GeneralKnowledgeQuestion
`create_initial_data.py` does not create records for these models. Without them:
- `get_anagram_data()` returns `None` → anagram phase fails
- `ChaosQuestion.random` endpoint returns 404 → chaos questions button fails
- `get_general_knowledge_data()` returns `None` → general knowledge quiz fails

## Design

### Backend

#### Fix 1: Allow unauthenticated `retrieve` on `ActivityViewSet`
Add `get_permissions` and `get_authenticators` overrides so only `retrieve` is open to tablets. All write/admin actions remain behind `IsAuthenticated`.

```python
def get_permissions(self):
    if self.action == 'retrieve':
        return []
    return super().get_permissions()

def get_authenticators(self):
    if hasattr(self, 'action') and self.action == 'retrieve':
        return []
    return super().get_authenticators()
```

#### Fix 2: Allow unauthenticated `list` on `SessionStageViewSet`
Same pattern, `list` action only.

#### Fix 3: Fix `generate_word_search` — filter long words, don't raise
In `challenges/services.py`, replace the `ValueError` raise with silent filtering plus a non-empty fallback:

```python
# Filter words > 10 chars silently
palabras_filtradas = [w.upper() for w in words if w and len(w) <= 10]

# Ensure we never pass an empty list
if not palabras_filtradas:
    palabras_filtradas = ['EQUIPO', 'MISION', 'IDEAS']
```

#### Fix 4: Replace 'creatividad' in `create_initial_data.py`
Change `words_list` to `['emprender', 'innovacion', 'creativos']` so the config fallback never hits the 10-char limit even before the service fix.

#### Fix 5: New management command `create_minigame_data`
Creates seed records for all three models. Safe to run multiple times (uses `get_or_create`).

**AnagramWord** (~15 words):  
`empresa, cliente, proyecto, mercado, producto, impacto, usuario, capital, equipo, startup, liderazgo, recursos, prototipo, negocio, problema`  
Each record stores `word` + `scrambled_word` (pre-shuffled).

**ChaosQuestion** (~20 questions):  
Random icebreaker questions, e.g.:
- "¿Cuál sería tu superpoder si pudieras elegir uno?"
- "¿Qué harías si tuvieras un día libre sin límites?"
- "Si pudieras vivir en cualquier época histórica, ¿cuál elegirías y por qué?"
- "¿Qué habilidad te gustaría aprender en una semana?"
- (+ 16 more)

**GeneralKnowledgeQuestion** (~10 questions):  
Multiple-choice entrepreneurship knowledge questions, each with 4 options and a correct answer index (0–3), e.g.:
- "¿Qué significa MVP en emprendimiento?" → A) Minimum Viable Product ✓
- "¿Qué es el Design Thinking?" → A) Metodología centrada en el usuario ✓
- (+ 8 more)

### Frontend

#### Fix 6: Reset retry lock in `TabletMinijuego.tsx`
Move `minigameDataLoadedRef.current = true` to inside the try block (after successful data load). In the catch block, reset it to `false` so the next polling cycle can retry:

```typescript
} catch (error) {
  // ...
  minigameDataLoadedRef.current = false;  // allow retry
}
```

#### Fix 7: Use `gameData.current_session_stage` instead of fetching session-stages
In `loadMinijuegoActivity`, pass `sessionStageId` from the caller (`loadGameState` already has `gameData.current_session_stage` from the lobby API) instead of making a separate unauthenticated fetch to `/sessions/session-stages/`. Same change in `TabletPresentacion.tsx` for `loadPresentacionActivity`.

Concretely:
- Add `sessionStageId?: number | null` parameter to `loadMinijuegoActivity` and `loadPresentacionActivity`
- In `loadGameState`, pass `gameData.current_session_stage` as the argument
- Remove the internal `/sessions/session-stages/` fetch from both functions

## Build Sequence

1. `challenges/services.py` — fix `generate_word_search` (no dependencies)
2. `challenges/management/commands/create_initial_data.py` — fix 'creatividad'
3. `challenges/views.py` — add AllowAny overrides to `ActivityViewSet` and `SessionStageViewSet`
4. `challenges/management/commands/create_minigame_data.py` — new command
5. `frontend/src/pages/tablets/etapa1/Minijuego.tsx` — retry lock + session_stage param
6. `frontend/src/pages/tablets/etapa1/Presentacion.tsx` — session_stage param
7. Update `CLAUDE.md` — add `create_minigame_data` to seed commands

## Testing

- After backend changes: `GET /challenges/activities/{id}/` without auth token returns 200
- After backend changes: `GET /sessions/session-stages/?game_session={id}` without auth returns 200
- After seed command: `GET /challenges/chaos-questions/random/` returns a question
- After all changes: student tablet plays through full Minijuego (word search → anagram → general knowledge) without errors
- After all changes: student tablet plays through full Presentación (intro → chaos questions → general knowledge) without errors
