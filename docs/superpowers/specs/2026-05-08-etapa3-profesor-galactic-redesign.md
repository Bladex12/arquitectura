# Spec: Etapa 3 Professor View — Galactic Redesign

**Date:** 2026-05-08  
**Status:** Approved

## Context

The professor control screens for Etapa 1 (Personalización, Presentación) and Etapa 2 (SeleccionarTema, BubbleMap) have been redesigned with the galactic/space theme using `GalacticPage`, `TimerBlock`, glass cards, and the Orbitron + Exo 2 font system. The Etapa 3 professor screen (`frontend/src/pages/profesor/etapa3/Prototipo.tsx`) still uses the old design (gradient background, white cards, Framer Motion particles). This spec covers applying the galactic design to that page.

## File to Modify

- `frontend/src/pages/profesor/etapa3/Prototipo.tsx` (676 lines → ~400 after cleanup)

## Reference

- `frontend/src/pages/profesor/etapa1/Personalizacion.tsx` — primary template for galactic layout pattern

## Design

### Layout Structure (top → bottom)

1. **`GalacticPage` wrapper** — replaces manual `div` background + Framer Motion particles
2. **Top bar** — left: `galactic-label` "Control de Misión · Etapa 3" + Orbitron title "Creatividad"; right: `galactic-badge` "Actividad 1"
3. **`TimerBlock` component** — centered, large (existing component handles sizing, warn/danger states). Pass `timerRemaining` and `activityName="Prototipos de Lego"`
4. **Stats row** — 3 `glass-card` blocks: Equipos Totales, Prototipos Completados, Fotos Subidas
5. **Team grid** — `glass-card` per team, each showing:
   - Team dot (color) + team name + ✅ when done
   - Prototype image area: actual `<img>` when uploaded, dashed placeholder when not
   - Status pill: Pendiente / Foto subida / Completado
6. **Actions bar** — three buttons centered:
   - `btn-galactic-secondary` → "Cancelar Sesión" (navigate to `/profesor/panel`)
   - Orange dev button (only in `isDevMode()`) → "⚡ Dev Skip" (calls `handleNextActivity(true)`)
   - `btn-galactic-primary` → "Continuar Misión ▶" (calls `handleNextActivity(false)`); always visible (not gated on all-complete), but disable when `advancing`

### Key Behavioral Changes from Old Design

- **"Continuar" button**: old design only showed it when `allTeamsCompleted`. New design always shows the primary action button (matching Etapa 1/2 pattern) — professor can advance at any time.
- **Dev button**: old design showed only when `allTeamsCompleted` is false and `isDevMode()`. New design always shows in dev mode regardless of completion state.
- **Loading state**: use `GalacticPage` + `Loader2` spinner (purple, `color: '#c026d3'`) instead of gradient div.
- **Error/null session state**: keep current fallback divs (non-galactic plain white) as-is — these are edge cases.

### Components to Import (new)

```ts
import { GalacticPage } from '@/components/GalacticPage';
import { TimerBlock } from '@/components/TimerBlock';
import { isDevMode } from '@/utils/devMode';
```

### Components/Imports to Remove

- `motion` from `framer-motion` (no longer needed — GalacticPage handles background)
- `Button`, `Badge` from `@/components/ui/` (replaced by CSS classes)
- `GroupBadge` from `@/components/GroupBadge`
- Lucide icons no longer needed: `ArrowRight`, `Clock`, `XCircle`, `Target`, `Code`, `Box`, `Upload`
- Keep: `Loader2`, `CheckCircle2`, `ImageIcon`, `Users`

### Timer Logic

Keep the existing `startTimer` / `syncTimer` / `timerStartTimeRef` / `timerDurationRef` logic unchanged. Only change how `timerRemaining` is rendered (pass to `TimerBlock` instead of inline JSX).

### Prototype Image Display

```tsx
{hasImage ? (
  <img
    src={/* existing URL resolution logic */}
    className="w-full h-32 object-contain rounded-lg"
    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.3)' }}
    onError={...}
  />
) : (
  <div style={{ /* dashed placeholder, dark-themed */ height: 80, borderRadius: 10, border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: "'Exo 2',sans-serif" }}>
    Sin foto aún
  </div>
)}
```

### CSS Classes Used

From `galactic.css`:
- `.galactic-label` — section labels
- `.galactic-badge` — "Actividad 1" pill
- `.glass-card` — frosted glass containers
- `.btn-galactic-primary` — primary action button
- `.btn-galactic-secondary` — cancel button

## Verification

1. Run `docker-compose up` (or `npm run dev` in `frontend/`)
2. Start a game session and navigate to professor Etapa 3 view
3. Confirm: dark starfield background visible, timer displays and counts down
4. Confirm: stats update as teams submit prototypes
5. Confirm: team cards show placeholder then real image after upload
6. Confirm: dev button only appears when `isDevMode()` returns true
7. Confirm: "Continuar Misión" button visible at all times, advances stage on click
8. Confirm: `EtapaIntroModal` still fires on first visit
