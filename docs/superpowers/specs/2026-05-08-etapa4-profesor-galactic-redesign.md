# Spec: Etapa 4 Professor Views — Galactic Redesign + Roulette Order

**Date:** 2026-05-08
**Status:** Approved
**Mockup:** `.superpowers/brainstorm/mockup-etapa4/etapa4-profesor-design.html`

---

## Context

The professor control screens for Etapa 1, 2, and 3 have been redesigned with the galactic/space theme using `GalacticPage`, `TimerBlock`, glass cards, and the Orbitron + Exo 2 font system. The two Etapa 4 professor screens still use the old blue-pink gradient style with Framer Motion particles and white cards. This spec covers:

1. Applying the galactic design to both screens
2. Replacing the manual presentation order list with an animated roulette wheel

---

## Files to Modify

- `frontend/src/pages/profesor/etapa4/FormularioPitch.tsx`
- `frontend/src/pages/profesor/etapa4/PresentacionPitch.tsx`

---

## Reference

- `frontend/src/pages/profesor/etapa3/Prototipo.tsx` — primary galactic template
- `frontend/src/components/GalacticPage.tsx` — layout wrapper
- `frontend/src/components/TimerBlock.tsx` — timer component
- `Space Missions.html` (project root) — roulette wheel source (`drawRouletteWheel`, `spinRoulette` logic)

---

## Design Tokens (same as all other galactic screens)

| Token | Value |
|---|---|
| Background | `GalacticPage` (`#050818` + starfield) |
| Headings | `Orbitron` |
| Body | `Exo 2` |
| Magenta | `#c026d3` |
| Green | `#34d399` |
| Purple | `#a78bfa` |
| Amber | `#f59e0b` / `#fbbf24` |
| Orange | `#f97316` / `#fb923c` |
| Red | `#ef4444` |

CSS classes from `galactic.css`: `.galactic-label`, `.galactic-badge`, `.glass-card`, `.btn-galactic-primary`, `.btn-galactic-secondary`

---

## Screen 1: FormularioPitch.tsx

### Layout (top → bottom)

1. **Top bar** — left: `galactic-label` "Control de Misión · Etapa 4" + Orbitron "Comunicación"; right: `galactic-badge` with `room_code`
2. **`TimerBlock`** — centered, full width. `activityName="Formulario de Pitch"`, pass `timerRemaining`
3. **Stats row** — 3 `glass-card` blocks:
   - Equipos Totales (white)
   - Pitches Completados (green `#34d399`)
   - En Progreso (purple `#a78bfa`)
4. **`galactic-label`** "Estado de los equipos"
5. **Team grid** — `auto-fill, minmax(240px, 1fr)` — one `glass-card` per team:
   - Team color dot + name + ✓ (`#34d399`) when `status === 'completed'`
   - **5 field dots** row: filled = accent color per field, empty = `rgba(255,255,255,0.15)`
     - Problema → `#ef4444`, Solución → `#3b82f6`, Valor → `#c026d3`, Impacto → `#10b981`, Cierre → `#f59e0b`
     - A dot is "filled" when the corresponding `pitch_*` field is non-null and non-empty
   - **Progress bar** — glassmorphism track, green fill = `progress_percentage`
   - **Status pill** — Orbitron 9px uppercase:
     - `completed` → green `rgba(16,185,129,0.2)` / `#34d399`
     - `in_progress` → purple `rgba(124,58,237,0.2)` / `#a78bfa`
     - `pending` → grey
   - **"👁 Ver Pitch Completo"** ghost button — only when `progress !== null`
6. **Preview modal** — dark glassmorphism overlay (keep existing logic, restyle):
   - Dark `rgba(2,0,15,0.92)` backdrop + blur
   - `glass-card` content panel, max-w `640px`
   - 5 sections each with a 3px colored left border matching field accent colors above
   - Close with X button (`btn-galactic-secondary` style)
7. **Actions row** — `btn-galactic-secondary` "Cancelar Sesión" · orange dev-skip (isDevMode) · `btn-galactic-primary` "Continuar Misión ▶" (always visible, not gated on completion)

### Imports to add
```ts
import { GalacticPage } from '@/components/GalacticPage';
import { TimerBlock } from '@/components/TimerBlock';
```

### Imports to remove
`motion` from `framer-motion`, `Button`/`Badge` from `@/components/ui/`, `Clock`, `ArrowRight`, `XCircle`, `Target`, `Code` from lucide-react

### Behavioral change
Old design only showed "Continuar" when `allTeamsCompleted`. New design always shows `btn-galactic-primary` (matching Etapa 3 pattern).

---

## Screen 2: PresentacionPitch.tsx

### Global wrapper
Replace the manual gradient `div` + Framer Motion particles with `<GalacticPage>`. All states render inside this wrapper.

### State: `not_started` — Roulette Screen

**Layout:** two-column grid (`1fr 1fr`), aligned top

**Left column — wheel:**
- `galactic-label` "Planeta Comunicación · Presentaciones"
- Orbitron title "¿Quién Habla Primero?" (22px, cyan glow `rgba(34,211,238,0.5)`)
- Canvas roulette wheel with amber pointer arrow at top
- Winner reveal block (hidden until spin lands): `galactic-label` "🏆 Primer Presentador" + Orbitron team name in amber (`#f59e0b`, 20px)
- **"▶ Girar"** button — cyan border `rgba(34,211,238,0.7)`, clip-path hexagon, pulsing glow animation; disabled during spin

**Right column — order list + actions:**
- `glass-card` order list (always visible, shows placeholder text until spin)
- After spin: items animate in one by one — winner (slot 1) appears immediately, then slots 2, 3, … N each delayed **280ms** apart; each item slides in from left (`translateX(-12px)` → `none`, opacity 0 → 1, 300ms ease)
- **"Iniciar Presentaciones ▶"** `btn-galactic-primary` — appears after last item animates in (+400ms), full width
- **"Cancelar Sesión"** `btn-galactic-secondary` — full width, below start button

**Roulette canvas logic (ported from `Space Missions.html`):**
```ts
// State refs
const rlAngleRef = useRef(0);
const rlSpinningRef = useRef(false);
const rlCanvasRef = useRef<HTMLCanvasElement>(null);
```

`drawRouletteWheel(angle, teams)` — draws colored slices with `Exo 2` team name labels, dark center circle, cyan outer ring glow.

`handleSpinRoulette()`:
1. Picks `winnerIdx = Math.floor(Math.random() * teams.length)`
2. Animates wheel with `easeOut` over ~4.5s
3. On finish: sets winner state, calls `sessionStagesAPI.generatePresentationOrder(sessionStage.id)` to get server-generated random order
4. Moves winner to index 0 of returned order
5. Calls `sessionStagesAPI.updatePresentationOrder(sessionStage.id, newOrder)` to persist
6. Sets `presentationOrder` state → triggers the staggered list animation

Slice colors: use `getTeamColorHex(team.color)` (already defined in the file).

Canvas size: `Math.min(260, Math.round(window.innerWidth * 0.28))` — responsive.

### State: `preparing` — Team called to stage

`glass-card` with orange-tinted border (`rgba(249,115,22,0.35)`):
- `galactic-badge` "⚠ Llamado urgente" pulsing (`animation: badgePulse`)
- Team color dot + Orbitron team name (20px)
- Exo 2 sub: "El equipo debe prepararse para presentar"
- `btn-galactic-primary` "▶ Iniciar Pitch — [teamName]" (disabled + spinner while `isStartingPitch`)

### State: `presenting` — Live pitch

Top bar same as all states. Then:

1. **Compact timer** — `glass-card`, centered, `max-width: 280px`, `margin: 0 auto`, orange border:
   - `galactic-label` "Tiempo de Pitch" in orange
   - Orbitron clock `52px`, amber `#fbbf24`
   - Exo 2 sub "Turno N de M"
2. **`3fr 1fr` grid:**
   - Left `glass-card` (prototype) — `text-align: center`:
     - `galactic-label` "🖼 Prototipo"
     - Image `<img>` (240px tall) or dashed placeholder
     - **Prototype name** `Orbitron 18px` centered (`response_data.product_name` or `—`)
     - Team tag (name · color dot)
   - Right `glass-card` (pitch script, narrow) — 5 script items, each with colored left border tag + compact Exo 2 text (11px)
     - Tags: Problema `#ef4444`, Solución `#3b82f6`, Valor `#c026d3`, Impacto `#10b981`, Cierre `#f59e0b`
3. **Actions row** — `btn-galactic-secondary` "Cancelar Sesión" + red-border `glass-card` button "✓ Finalizar Presentación"

### State: `evaluating` — Peer scoring in progress

`glass-card` with amber border (`rgba(245,158,11,0.35)`):
- `galactic-badge` "⭐ Evaluación en curso" in amber
- Orbitron team name
- Exo 2 sub
- `galactic-label` "Progreso de Evaluaciones"
- Progress bar: glassmorphism track, green fill, Orbitron fraction `N / M`
- Conditional buttons:
  - Waiting: faded `btn-galactic-secondary` + dev-skip orange button (`isDevMode`)
  - All done + more teams: `btn-galactic-primary` "Siguiente Turno ▶" (disabled + spinner while `isAdvancingTurn`)
  - Last team + all done: `btn-galactic-primary` "Ver Resultados →" (disabled + spinner while `loading`)

### State: `all_completed` — All presentations done

`glass-card` with green border, centered:
- 🎉 56px emoji
- `galactic-badge` "Misión Completada · Fase 4" in green
- Orbitron "¡Todas las Presentaciones Completadas!" (22px)
- Exo 2 sub
- `btn-galactic-secondary` "Ver/Ocultar Evaluaciones"
- `btn-galactic-primary` "🏆 Ir a Reflexión →" (disabled + spinner while `loading`)

**Evaluations list** (expanded, below the card):
- `glass-card` per evaluation, `glass-card` rows:
  - Header: "Equipo A → Equipo B", score chips
  - 3 criteria scores (Claridad, Solución, Presentación)
  - Feedback text if present

---

## Animations

Both files inject a `<style>` tag (same pattern as `PrototipoV2.tsx`) for:

```css
@keyframes badgePulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
```

---

## What Does NOT Change

- All API calls, polling intervals, redirect logic in both files
- `loadGameControl`, `loadTeamsPitch`, `startTimer` / `syncTimer` logic
- `handleNextActivity`, `handleStartPresentations`, `handleStartTeamPitch`, `handleFinishPresentation`, `handleNextPresentation`, `handleCompleteStageAndRedirect`, `handleGoToReflection`
- `handlePreview` / `handleClosePreview` (modal open/close logic)
- `EtapaIntroModal` (etapa 4 intro, fires on first visit)
- Routes in `App.tsx`

---

## Verification

1. `npm run build` inside `frontend/` — no new TypeScript errors
2. Navigate to professor Etapa 4 FormularioPitch:
   - Dark starfield visible, Orbitron title "Comunicación"
   - Timer counts down centered
   - Team cards show field dots, progress bar, status pill
   - "Ver Pitch Completo" opens dark modal with 5 colored sections
   - "Continuar Misión" always visible
3. Navigate to professor Etapa 4 PresentacionPitch (`not_started`):
   - Two-column layout: roulette left, order list right
   - "▶ Girar" spins wheel; winner reveals; teams pop into list one by one
   - "Iniciar Presentaciones" appears after last team animates in
4. Advance to `preparing` state: orange card, "Iniciar Pitch" button
5. Advance to `presenting` state: centered timer (52px amber), 3/1 prototype/pitch grid, product name centered
6. Advance to `evaluating` state: amber card, green progress bar updates via polling
7. Advance to `all_completed` state: green card, evaluations expand/collapse
