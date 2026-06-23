# Etapa 4 Professor Galactic Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply galactic design system to both Etapa 4 professor screens and replace manual presentation order with an animated roulette wheel.

**Architecture:** Full JSX rewrite of `FormularioPitch.tsx` and `PresentacionPitch.tsx`, keeping all business logic (API calls, timers, polling) unchanged. New design uses `GalacticPage`, `TimerBlock`, `.glass-card`, `.galactic-label`, `.galactic-badge`, `.btn-galactic-primary`, `.btn-galactic-secondary`. Roulette ported from `Space Missions.html` using `useRef` canvas + `requestAnimationFrame`.

**Tech Stack:** React 18, TypeScript, CSS-in-JS inline styles, Canvas 2D API

---

## Status: COMPLETED

Both files have been implemented and verified with `npx tsc --noEmit` — no new TypeScript errors introduced.

### Task 1: FormularioPitch.tsx ✅

- [x] Remove: `motion`, `Button`, `Badge`, `GroupBadge`, `challengesAPI`, lucide icons except `Loader2`, `CheckCircle2`
- [x] Add: `GalacticPage`, `TimerBlock`
- [x] Fix `NodeJS.Timeout` → `ReturnType<typeof setInterval>`
- [x] Add `current_stage_number` to `GameSession` interface
- [x] Loading state → `GalacticPage` + purple `Loader2`
- [x] Top bar: "Control de Misión · Etapa 4" + "Comunicación" Orbitron title + room_code badge
- [x] `TimerBlock` centered
- [x] Stats row: 3 `glass-card` (white/green/purple)
- [x] Team grid: field dots (5 colors), progress bar, status pill, "👁 Ver Pitch Completo" ghost button
- [x] Preview modal: `rgba(2,0,15,0.92)` backdrop + `glass-card`, 5 sections with colored left borders
- [x] Actions row: "Cancelar Sesión" + dev skip + "Continuar Misión ▶" (always visible)

### Task 2: PresentacionPitch.tsx ✅

- [x] Wrap all states in `<GalacticPage>`
- [x] Shared top bar component
- [x] `not_started` state: two-column roulette wheel + staggered order list
  - [x] Canvas roulette with `drawRouletteWheel()` using `getTeamColorHex()` slice colors
  - [x] `handleSpinRoulette()`: easeOut ~4.5s animation, winner reveal, generatePresentationOrder + updatePresentationOrder
  - [x] Staggered list: winner at 0ms, each team 280ms apart, "Iniciar Presentaciones" button after all animate in
  - [x] Amber pointer at top of wheel
- [x] `preparing` state: orange-tinted `glass-card`, pulsing badge, "Iniciar Pitch" button
- [x] `presenting` state: compact centered timer (52px amber, 280px max-width) + `3fr 1fr` grid (prototype/pitch)
  - [x] Product name centered `Orbitron 18px`
  - [x] Right column: 5 script items with colored left borders at 11px
- [x] `evaluating` state: amber `glass-card`, green progress bar, conditional buttons
  - [x] `shouldShowGoToResults` → `handleCompleteStageAndRedirect` "Ver Resultados →"
  - [x] Dev skip button
- [x] `all_completed` state: green `glass-card`, 🎉, evaluations list, "Ir a Reflexión →"
