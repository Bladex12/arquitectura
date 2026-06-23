# Spec: Fase 2 Empatía — Galactic Redesign

**Date:** 2026-05-05  
**Status:** Approved  
**Scope:** Frontend only — two new React screen files + one shared component

---

## Context

A new HTML prototype (`Fase 2 - Empatia.html`) was dropped into the repo root. It defines a complete galactic/space-themed redesign for the Empatía phase (Etapa 2) of the tablet experience. The redesign covers:

1. A category + challenge selection flow with 3 sector cards and persona-based challenge cards
2. A fundamentally different bubble map interaction: 6 category nodes (Perfil, Entorno, Emociones, Necesidades, Limitaciones, Motivaciones) arranged in a circle, with draggable idea-card bubbles and a side panel per node

The existing `SeleccionarTemaDesafio.tsx` and `BubbleMap.tsx` remain in place (Option B). Two new V2 files are created and the routes are updated to point at them.

---

## Files

### Created
| File | Purpose |
|---|---|
| `frontend/src/pages/tablets/etapa2/StarField.tsx` | Shared canvas star-field background component |
| `frontend/src/pages/tablets/etapa2/SeleccionarTemaDesafioV2.tsx` | New category + challenge selection screen |
| `frontend/src/pages/tablets/etapa2/BubbleMapV2.tsx` | New 6-node bubble map screen |

### Modified
| File | Change |
|---|---|
| `frontend/src/App.tsx` | Update etapa2 routes to import V2 components |
| `frontend/index.html` | Add Orbitron + Exo 2 Google Fonts `<link>` |

### Left untouched
- `frontend/src/pages/tablets/etapa2/SeleccionarTemaDesafio.tsx`
- `frontend/src/pages/tablets/etapa2/BubbleMap.tsx`
- `frontend/src/pages/tablets/etapa2/MapaDeEmpatia.tsx`

---

## Screen 1 — SeleccionarTemaDesafioV2

### Visual design
Dark space background (star field canvas). Two steps rendered in the same component, toggled by local state:

**Step 1 — Sector selection**
- Phase badge: "Fase 2 · Empatía"
- Title: "Elige tu Sector de Impacto" (Orbitron font, large)
- 3 topic cards side by side (health=purple, sustain=green, edu=amber), each with an icon, name, and description
- Hover: card lifts + glow matching topic color

**Step 2 — Challenge selection**
- Back arrow (returns to step 1)
- Title = selected topic name
- 3 challenge cards, each showing:
  - Persona avatar emoji + name + age/occupation
  - Challenge title (color-coded per topic)
  - Short description
  - "Ver contexto completo" toggle (expands full `persona_story`)
  - "Elegir este desafío →" footer link (hover reveals)

### Data flow
```
mount → tabletConnectionsAPI.getStatus(connectionId)
      → sessionsAPI.getLobby(gameSessionId)
      → challengesAPI.getTopics({ faculty: facultyId })

topic click → challengesAPI.getChallenges({ topic: topicId })
            → show step 2

challenge click → teamActivityProgressAPI.selectChallenge(FormData)
               → navigate to /tablet/etapa2/bubble-map
```
Reuses the same `useGameStateRedirect` hook and timer-sync pattern from the existing file. The 3 topic card color schemes (`health` → purple `#c026d3`, `sustain` → green `#10b981`, `edu` → amber `#f59e0b`) are determined by matching the topic's `name` field (case-insensitive) against: `"salud"` → health, `"sustentabilidad"` → sustain, `"educación"` / `"educacion"` → edu. Any topic name that does not match falls back to the health (purple) color.

### Timer
Timer pill in top-right area shows activity countdown. Uses existing `sessionsAPI.getActivityTimer` + local interval pattern.

---

## Screen 2 — BubbleMapV2

### Visual design
Full-screen dark canvas. Three sub-views managed by a `view` state variable: `'map' | 'complete'`.

**Map view**
- Top bar (fixed, full width):
  - Left: persona pill — shows challenge emoji + first name + "Leer problema ▼". Click toggles dropdown showing full `persona_story`.
  - Center: ─ (nothing)
  - Right: timer pill + "Finalizar →" ghost button
- Map area (fills remaining height):
  - SVG layer (pointer-events:none) rendering dashed lines: center→nodes, nodes→idea-bubbles
  - Center bubble (80px circle): persona emoji + first name
  - 6 node bubbles positioned by angle at radius = min(W,H)×0.3:
    - Perfil (−90°, purple), Entorno (−30°, blue), Emociones (30°, orange), Necesidades (90°, green), Limitaciones (150°, red), Motivaciones (−150°, amber)
  - Idea-card bubbles (pill shape): positioned absolutely, draggable via pointer events
  - Drag handle icon on left of each idea card, delete ✕ on right
- Bottom bar: "＋ Añadir categoría propia" button (centered, fixed to bottom)
- Settings gear (top-left fixed): opens panel to adjust bubble map timer duration

**Side panel** (right drawer, 300px wide, slides in on node click):
- Header: node icon + node label + ✕ close button
- "Preguntas Guía" section: 4 guiding questions (hardcoded per node ID — see QUESTIONS mapping below)
- "Ideas del equipo" section: scrollable list of added ideas with delete button
- Input + "＋" button at bottom to add new ideas

**QUESTIONS mapping** (hardcoded in component, matches HTML prototype):
```
perfil: ¿Cuántos años tiene?, ¿Nivel educativo?, ¿Dónde vive?, ¿Qué tecnología usa?
entorno: ¿Cómo es su entorno?, ¿Qué personas lo rodean?, ¿Qué recursos tiene?, ¿Qué barreras físicas?
emociones: ¿Cómo se siente frente al problema?, ¿Qué le frustra?, ¿Qué le da esperanza?, ¿Cómo afecta su bienestar?
necesidades: ¿Qué necesita resolver?, ¿Qué le haría la vida más fácil?, ¿Qué servicio le falta?, ¿Cuál es su necesidad más profunda?
limitaciones: ¿Qué le impide resolverlo solo?, ¿Limitaciones económicas?, ¿Qué intentó antes?, ¿Qué soluciones no puede usar?
motivaciones: ¿Qué lo impulsa?, ¿Cuáles son sus metas?, ¿Qué valora?, ¿Qué cambio concreto quisiera ver?
```

**Custom node modal** (fullscreen overlay):
- Name input (max 20 chars)
- 6 color swatches
- Cancel / Añadir buttons
- Max 3 custom nodes; new nodes get a free angle from candidates list

**Complete view** (replaces map view after finalize):
- Confetti burst (55 particles, same algorithm as HTML)
- "Misión Completada · Fase 2" badge
- 🧠 emoji + "¡Empatía Activada!" title
- Description: total ideas count about persona name
- Score block: `min(1000, 300 + totalIdeas × 50)` pts
- "Continuar Misión →" button → navigates to next activity per `useGameStateRedirect`

### Data flow
```
mount → tabletConnectionsAPI.getStatus(connectionId)
      → sessionsAPI.getLobby(gameSessionId)
      → teamActivityProgressAPI.list({ team, session_stage })  ← get selected_challenge.id
      → challengesAPI.getChallengeById(selectedChallengeId)  ← load persona emoji + name
      → teamBubbleMapsAPI.list({ team, session_stage })
      → if existing map with version:2, load nodes/ideas from map_data
      → tokenTransactionsAPI.list({ team, session_stage })  ← if tokens awarded, lock editing

node click → open side panel for that node
add idea → update local state → trigger auto-save (1s debounce)
delete idea → update local state → trigger auto-save
drag idea → update x,y in local state → renderLines() on pointermove
finalize → teamBubbleMapsAPI.finalize(teamId, sessionStageId) → show complete view
```

### Data format saved to backend
```json
{
  "version": 2,
  "central": {
    "personName": "Martina",
    "emoji": "👩‍🏫"
  },
  "nodes": [
    {
      "id": "perfil",
      "label": "Perfil",
      "icon": "👤",
      "color": "#c026d3",
      "rgb": "192,38,211",
      "angle": -90,
      "ideas": [
        { "id": "idea-1746123456789", "text": "Profesora rural", "x": 220, "y": 130 }
      ]
    }
    // ... remaining 5 default nodes
  ],
  "customNodes": [
    {
      "id": "custom-1746123456789",
      "label": "Cultura",
      "icon": "✦",
      "color": "#818cf8",
      "rgb": "129,140,248",
      "angle": -60,
      "ideas": []
    }
  ]
}
```

`version: 2` distinguishes this from old format data. The backend's `TeamBubbleMap.map_data` JSONField stores this as-is — no backend changes needed.

### Auto-save
1-second debounce (identical to current BubbleMap.tsx pattern). SVG re-renders on every `pointermove` during drag via `renderLines()` (direct DOM manipulation, not React state, to avoid re-render jank).

---

## Shared Component — StarField

```tsx
// frontend/src/pages/tablets/etapa2/StarField.tsx
// Canvas element fixed-positioned behind all content.
// Props: none. Handles resize via window resize event.
// Renders 260 stars + two radial glow gradients (blue + purple).
// Animation: requestAnimationFrame loop with per-star twinkle phase.
```

---

## Fonts

Add to `frontend/index.html` `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Exo+2:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

`font-family: 'Orbitron'` used for: titles, node labels, timer pill, buttons  
`font-family: 'Exo 2'` used for: body text, descriptions, side panel content

---

## Styling approach

No new Tailwind utility classes are needed that don't exist. The HTML's CSS is translated to:
- Inline `style` props for dynamic values (colors from node config, positioning)
- Tailwind for layout/spacing/transitions where utilities map cleanly
- CSS variables (`--nc`, `--nrgb`, `--sp-color`, `--sp-rgb`) set as inline styles on container elements, consumed by descendant styled elements

---

## Verification

1. Start dev server: `docker-compose up`
2. Navigate to `/tablet/etapa2/seleccionar-tema?connection=<id>` — verify:
   - Star field renders and animates
   - 3 sector cards load from API (or fallback color if category unknown)
   - Clicking a sector shows challenge cards with correct persona info
   - "Ver contexto completo" toggle expands full story
   - Selecting a challenge calls `select_challenge` API and navigates to bubble map
3. Navigate to `/tablet/etapa2/bubble-map?connection=<id>` — verify:
   - Persona pill shows correct person from selected challenge
   - 6 nodes render in a circle with correct colors and positions
   - Clicking a node opens the side panel with correct guiding questions
   - Adding ideas appears as draggable bubbles; dragging updates position and SVG lines
   - "Añadir categoría propia" creates a custom node (max 3)
   - Timer counts down; "Finalizar" calls finalize API and shows complete screen
   - Score formula: `min(1000, 300 + totalIdeas × 50)`
   - "Continuar Misión" navigates correctly per game state
4. Check TypeScript: `npm run build` in `frontend/` — no type errors
