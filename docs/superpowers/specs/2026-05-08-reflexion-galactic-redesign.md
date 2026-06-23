# Spec: Reflexión — Galactic Redesign

**Date:** 2026-05-08  
**Scope:** Visual redesign only — no logic, routing, or API changes  
**Files:**
- `frontend/src/pages/profesor/Reflexion.tsx`
- `frontend/src/pages/tablets/Reflexion.tsx`

---

## Context

The two Reflexión screens are the last screens of the game (after Etapa 4). All other screens have been redesigned with the galactic dark theme. This spec applies the same treatment to both Reflexión screens and replaces the old medal-list ranking with a mini bar-chart podium.

---

## Design Tokens (same as all other galactic screens)

| Token | Value |
|---|---|
| Background | `GalacticPage` (`#050818` + `StarfieldBackground`) |
| Headings | `Orbitron` |
| Body | `Exo 2` |
| Magenta | `#c026d3` |
| Blue | `#093c92` |
| Gold | `#fbbf24` |
| Green | `#34d399` |
| Red | `#ef4444` |

CSS classes from `galactic.css`: `.galactic-label`, `.glass-card`, `.btn-galactic-primary`, `.btn-galactic-secondary`

---

## ProfesorReflexion — Full Redesign

### Imports to add
```ts
import { GalacticPage } from '@/components/GalacticPage';
```

### Imports to remove
`motion` from `framer-motion`, `Button`/`Card`/`Badge`/`Progress` from UI components, all `lucide-react` icons except `Loader2`

### Layout (top → bottom)

#### Top bar
- Left: `.galactic-label` "Control de Misión · Reflexión Final" + Orbitron `<h1>` "Reflexión Final"
- Right: room code badge (magenta border, Orbitron, `#c026d3`), session status badge (green when completed/cancelled, else hidden), "Finalizar Sesión" button (`.btn-galactic-secondary` with red border `rgba(239,68,68,0.3)` + red text, hidden when session completed/cancelled), "← Volver al Panel" `.btn-galactic-secondary`

#### Row 1 — Podium (full width, `glass-card` with gold accent border `rgba(251,191,36,0.2)`)

`.galactic-label` "🏆 Clasificación Final"

Inner grid: `grid-template-columns: 2fr 1fr` — podium bars take 2/3, rest list takes 1/3.

**Left — bar chart (top 3):**
- Flex row, items aligned to bottom, gap 22px, height 150px
- Order: 2nd | 1st | 3rd (Kahoot order)
- Each column: avatar circle (team color bg, Orbitron initials) → medal emoji → bar → team name
  - 1st: bar height 120px, `rgba(251,191,36,0.18)` bg, gold border + glow, avatar gold border glow, name in `#fbbf24`, token count in `#fbbf24`
  - 2nd: bar height 80px, `rgba(156,163,175,0.2)` bg, grey border
  - 3rd: bar height 58px, `rgba(249,115,22,0.15)` bg, orange border
  - Bar width: 70px, `border-radius: 8px 8px 0 0`
  - Token count inside bar top: Orbitron 10px

**Right — rest list:**
- `.galactic-label` "Resto de equipos"
- One row per team (4th place onward): rank (Orbitron, faded) + team color dot + team name (Exo 2) + token count (`#fbbf24`, Orbitron 9px, `★ N`)
- Row bg: `rgba(255,255,255,0.03)`, border `rgba(255,255,255,0.07)`, `border-radius: 8px`, padding `7px 10px`
- Only rendered when `teamsOrdered.length > 3`

#### Row 2 — two columns (`grid-template-columns: 1fr 1fr`, gap 14px)

**Left — QR card (`glass-card`):**
- `.galactic-label` "Encuesta de Reflexión"
- Orbitron section heading "Escanea el Código QR"
- QR image: 130×130px, magenta border `rgba(192,38,211,0.4)`, `border-radius: 12px`, `box-shadow: 0 0 18px rgba(192,38,211,0.15)`. Spinner (`Loader2`) shown while loading.
- 3-step grid (`grid-template-columns: repeat(3,1fr)`): each step has a numbered circle (gradient `#093c92 → #c026d3`, magenta glow) + text label
- Progress block: `rgba(192,38,211,0.08)` bg, magenta border, progress bar with gradient fill `#093c92 → #c026d3`, Orbitron fraction badge

**Right — Survey questions card (`glass-card`):**
- `.galactic-label` "Preguntas de la Encuesta"
- 6 question rows: numbered circle (same gradient as steps) + question text (Exo 2, `rgba(255,255,255,0.65)`, 10px)
- Row bg: `rgba(255,255,255,0.03)`, `border: 1px solid rgba(255,255,255,0.07)`, `border-radius: 8px`

### Loading state
Replace current loading screen with `GalacticPage` + centered `Loader2` (white, animate-spin).

### What does NOT change
- All API calls, polling intervals, `loadSessionData`, `loadProgress`, `loadCompletedStages`, `loadReflectionQR`
- `handleFinalizeSession`, `handleConfirmCancel`
- `CancelSessionModal` usage
- `porcentajeCompletado` calculation
- `teamsOrdered` sort logic
- Routes in `App.tsx`

---

## TabletReflexion — Full Redesign

### Imports to add
```ts
import { GalacticPage } from '@/components/GalacticPage';
```

### Imports to remove
`motion` from `framer-motion`, `Card`/`Badge`/`Progress` from UI components, `Brain`/`CheckCircle2` from lucide-react (keep `Loader2`)

### Layout

Centered single-column layout inside `GalacticPage`: `flex flex-col items-center justify-center min-h-screen px-4`.

**Header block (above card):**
- `.galactic-label` pill: `rgba(192,38,211,0.15)` bg, magenta border, text "Reflexión Final"
- Orbitron `<h1>` "Encuesta de Reflexión" (24px, white)
- Exo 2 subtitle: "Escanea el código QR con tu teléfono para completar la encuesta" (`rgba(255,255,255,0.6)`, 13px)

**Glass card (`glass-card`, max-width 480px, full width on mobile):**
- Orbitron section heading "Escanea el Código QR"
- QR image: same styling as professor (130×130, magenta border + glow). Spinner while loading.
- 3-step grid: same as professor
- Progress block: same as professor. Shows "Cargando..." text when `totalEstudiantes === 0`.

### Loading state
`GalacticPage` + centered `Loader2`.

### What does NOT change
- All API calls, polling intervals, `loadSessionData`, `loadProgress`, `loadReflectionQR`
- `porcentajeCompletado` calculation
- Routes in `App.tsx`

---

## Verification

1. `npm run build` inside `frontend/` — no new TypeScript errors
2. Professor screen:
   - Dark starfield visible, Orbitron "Reflexión Final" title
   - Podium shows top 3 as bars (2nd | 1st | 3rd order), gold glow on 1st place
   - Remaining teams listed to the right of the bars
   - QR card shows code with magenta glow; steps and progress bar visible
   - Survey questions card shows 6 questions
   - "Finalizar Sesión" hidden when session is completed/cancelled
3. Tablet screen:
   - Dark starfield, centered layout
   - QR card with magenta glow, 3 steps, progress bar
   - "Cargando..." shown until `totalEstudiantes > 0`
4. No regressions on other pages
