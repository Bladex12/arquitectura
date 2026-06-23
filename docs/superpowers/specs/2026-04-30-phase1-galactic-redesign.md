# Phase 1 Galactic Aesthetic Redesign

**Date:** 2026-04-30  
**Scope:** Visual redesign only — no logic, routing, or API changes  
**Reference files:** `Fase 1 - Trabajo en Equipo.html`, `Space Missions.html`

---

## Context

The game currently uses a mix of light beige and blue-to-pink gradient styles across Phase 1 screens. This redesign applies a unified dark galactic aesthetic (deep space, starfield, glass morphism, neon glow) to all Phase 1 pages — both tablet-facing and professor-facing — matching the reference HTML files provided by the client.

---

## Design System

### Palette
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#050818` | Page background |
| `--accent-magenta` | `#c026d3` | Primary accent, glow, buttons |
| `--accent-blue` | `#093c92` | Gradient partner |
| `--accent-violet` | `#7c3aed` | Badge gradients |
| `--warn` | `#f97316` | Timer at ≤30s |
| `--danger` | `#ef4444` | Timer at ≤10s |
| `--success` | `#10b981` / `#34d399` | Submitted/done states |
| `--gold` | `#fbbf24` | Tokens, 1st place |

### Typography
- **Headings, labels, timers:** `Orbitron` (700, 900) — loaded via Google Fonts in `index.html`
- **Body, descriptions, status:** `Exo 2` (400, 500, 600) — loaded via Google Fonts in `index.html`

### Shared visual patterns
- **Starfield background:** Reuse existing `StarfieldBackground.tsx` component (already built)
- **Glass card:** `background: rgba(255,255,255,0.05)`, `border: 1px solid rgba(255,255,255,0.12)`, `border-radius: 14–20px`, `backdrop-filter: blur(12–18px)`
- **Primary button:** `clip-path: polygon(12px 0%, 100% 0%, calc(100%-12px) 100%, 0% 100%)`, linear gradient `#093c92 → #c026d3`, neon box-shadow
- **Section labels:** 12–14px, `letter-spacing: 4px`, `text-transform: uppercase`, `Exo 2`, `rgba(255,255,255,0.75)`

---

## Shared Components to Create

### 1. `GalacticPage.tsx`
Wrapper used by all Phase 1 pages. Renders `StarfieldBackground` behind a scrollable content area. Accepts optional `className` for padding overrides.

### 2. `TimerBlock.tsx`
Prominent countdown display used on profesor views.
- Props: `secondsRemaining: number`, `label?: string`, `sublabel?: string`
- States: **normal** (white) → **warn** ≤30s (orange twinkle 1s) → **danger** ≤10s (red rapid pulse 0.28s)
- Font: Orbitron 900, `clamp(72px, 12vw, 120px)`

### 3. `GlassCard.tsx`
Reusable frosted glass container. Props: `className`, `children`.

### 4. `PodiumScreen.tsx`
Animated results podium for `TabletResultadosEtapa1`. Ported from `Space Missions.html` `#podiumScreen` section.
- Shows top 3 as animated growing bars (2nd left, 1st center, 3rd right — Kahoot order)
- Shows 4th and 5th as slide-in rows above
- Reveal sequence: 5th → 4th → 3rd bar → 2nd bar → 1st bar + confetti
- Props: `teams: TeamResult[]`, `stageName: string`, `onContinue: () => void`
- Uses existing `team_color` data from API for avatar backgrounds

---

## Pages to Redesign

### Tablet Pages (`/tablet/etapa1/`)

| Page | File | Key changes |
|---|---|---|
| Video Institucional | `TabletVideoInstitucional.tsx` | Replace beige bg with `GalacticPage`, glass card for video embed, Orbitron title |
| Instructivo | `TabletInstructivo.tsx` | Same treatment as Video Institucional |
| Personalización | `TabletPersonalizacion.tsx` | Replace gradient bg with `GalacticPage`, restyle form inputs and toggle buttons with glass + galactic palette |
| Minijuego | `TabletMinijuego.tsx` | Replace gradient bg with `GalacticPage`, restyle `WordSearchGame`, `AnagramGame`, `GeneralKnowledgeQuiz` subcomponents |
| Presentación | `TabletPresentacion.tsx` | Same treatment as Minijuego |
| Resultados | `TabletResultadosEtapa1.tsx` | Replace current leaderboard with new `PodiumScreen` component |

### Profesor Pages (`/profesor/etapa1/`)

All use the **Mission Control dashboard** layout (approved in mockup v4):
- Top bar: mission tag + phase title (Orbitron 30px) + activity badge (right)
- Large `TimerBlock` as focal point
- 3-column stats row (glass cards, Orbitron 36px values)
- Team status grid (team name 18px bold, progress bar, status text 15px)
- Centered action buttons (primary + secondary)

| Page | File |
|---|---|
| Video Institucional | `ProfesorVideoInstitucional.tsx` |
| Instructivo | `ProfesorInstructivo.tsx` |
| Personalización | `ProfesorPersonalizacion.tsx` |
| Presentación | `ProfesorPresentacion.tsx` |
| Resultados | `ProfesorResultados.tsx` |

---

## Implementation Notes

- **No logic changes:** All API calls, routing, polling intervals, and state management stay untouched. Only JSX/CSS changes.
- **Fonts:** Add Orbitron + Exo 2 Google Fonts `<link>` to `frontend/index.html`. Add `fontFamily` entries to `tailwind.config.js`.
- **StarfieldBackground:** Already exists at `frontend/src/components/StarfieldBackground.tsx`. Use as-is.
- **RocketSVG:** Already exists at `frontend/src/components/RocketSVG.tsx`. May be used in transition screens.
- **Existing components inside Minijuego/Presentacion:** `WordSearchGame`, `AnagramGame`, `GeneralKnowledgeQuiz` live inside or alongside these pages — restyle their wrapper containers and text elements while keeping game logic intact.
- **CSS approach:** Use Tailwind for layout/spacing as usual. Add a `frontend/src/styles/galactic.css` file for effects Tailwind can't express cleanly — `backdrop-filter`, `clip-path` angled buttons, `text-shadow` neon glows, and keyframe animations. Import it once in `main.tsx`.
- **Existing game subcomponents:** `WordSearchGame` and `AnagramGame` are rendered inside `TabletMinijuego.tsx`. `GeneralKnowledgeQuiz` is used in both `TabletMinijuego.tsx` and `TabletPresentacion.tsx`. Restyle their wrapper `div` containers and text elements; do not touch game logic props or handlers.

---

## Verification

1. Start dev server: `docker-compose up` and open `http://localhost:5173`
2. Log in as professor, create a session, and walk through each Phase 1 screen
3. Join as a tablet and verify all 6 tablet screens render the new aesthetic
4. Test timer warn (≤30s) and danger (≤10s) states on profesor screens
5. Complete a stage and verify the Podium reveal animation plays correctly on TabletResultados
6. Confirm no regressions in other phases (etapa2/3/4 pages untouched)
