# Spec: Etapa 4 Pitch — Full Galactic Redesign

**Date:** 2026-05-08  
**Scope:** Tablet Etapa 4 screens — full visual redesign to match "Fase 4 - Pitch (1).html"  
**Files:** `frontend/src/pages/tablets/etapa4/FormularioPitch.tsx`, `frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx`

---

## Context

The HTML file "Fase 4 - Pitch (1).html" defines the target galactic design for all 7 Etapa 4 tablet screens. The existing components use a blue-pink gradient style. This spec describes the full rebuild to match the HTML design while preserving all existing business logic (polling, auto-save, timers, API calls).

---

## Global Design Tokens

| Token | Value |
|---|---|
| Background | `#050818` |
| Font — headings | `Orbitron` (already in `index.html`) |
| Font — body | `Exo 2` (already in `index.html`) |
| Primary / magenta | `#c026d3`, `rgba(192,38,211,*)` |
| Blue | `#3b82f6`, `#093c92` |
| Green | `#10b981` |
| Amber | `#f59e0b`, `#fbbf24` |
| Orange | `#f97316` |
| Red | `#ef4444` |
| Starfield | `<StarField />` from `../etapa2/StarField` |

Box accent colors by field:
- dolor → `#ef4444`
- rescate → `#3b82f6`
- diferencia → `#c026d3`
- futuro → `#10b981`
- cierre → `#f59e0b`

---

## FormularioPitch.tsx — Full Rebuild

### New state
```ts
const [personaName, setPersonaName] = useState<string | null>(null);
const [prototypeName, setPrototypeName] = useState<string | null>(null);
```

### Data loading — `loadPersonaAndPrototype(teamId, gameSessionId)`
Called once inside `loadGameState` after session stages are fetched.

**Persona name:**
1. Find stage 2 from session stages
2. `teamActivityProgressAPI.list({ team: teamId, session_stage: stage2.id })`
3. If `progress[0].selected_challenge` exists → `challengesAPI.getChallengeById(id)` → `challenge.persona_name`

**Prototype name:**
1. Find stage 3 from session stages
2. `teamActivityProgressAPI.list({ team: teamId, session_stage: stage3.id })`
3. `progress[0].response_data?.product_name`

Failures are silent (pills show a fallback `—` string).

### Layout structure

```
div#root (bg: #050818, min-h-screen, font-family: Exo 2)
├── StarField (fixed, z-0)
├── .b-topbar (sticky, z-80, dark gradient, blur)
│   ├── phase-badge "Fase 4 · Pitch" (Orbitron)
│   ├── ref-pill (persona, magenta border)
│   ├── ref-pill (prototype, blue border)
│   └── timer-block (Orbitron, magenta glow)
├── .content (relative z-10, px padding, pb for footer)
│   ├── phase-title + phase-sub (Orbitron, centered)
│   └── 5× .box (dark glassmorphism, colored left border)
│       ├── .box-num (emoji + number)
│       ├── .box-head (tag + title + helper + example)
│       └── .box-area (textarea + footer: done dot + char counter)
└── .b-footer (fixed bottom, dark gradient)
    ├── progress dots (5, green when field filled)
    └── btn-primary "Ver pitch completo →" (disabled until all 5 filled)
```

### Preview screen (`view === 'preview'`)
Replaces content area (top bar stays):
```
div (dark, z-10, centered)
├── back-mini "← Editar"
├── phase-badge
├── phase-title "Su Pitch"
├── .pitch-card (glassmorphism, magenta/blue gradient)
│   ├── .pitch-head (product thumb + name + "Para [persona]" badge)
│   └── 5× .pitch-section (icon + Orbitron tag + Exo body text)
└── .pv-actions
    ├── btn-ghost "← Cambiar algo"
    └── btn-primary "Entregar pitch →"
```

---

## PresentacionPitch.tsx — Full Rebuild

Shared layout wrapper for all states:
```
div (bg: #050818, min-h-screen, font-family: Exo 2)
├── StarField (fixed, z-0)
└── div.content (relative z-10, centered, flex-col)
    └── [state-specific content]
```

The existing white header card (team name + tokens) is removed. Each screen has its own phase badge + title in the galactic style.

### State: `not_started`
Simple centered card: phase badge "⏳ En espera", message text. No changes to logic.

### State: `preparing` + `isMyTurn` → `#screen-callstage`
- Phase badge: "⚠ Llamado urgente" with `phPulse` opacity animation
- Mic stack (140×140): orange radial glow + 🎤 emoji with `micFloat` animation
- Orbitron title: "Llamado a Escenario"  
- Exo 2 sub: team name in `<b>`
- btn-primary: "Tomar el escenario →"
- Orange text-shadow: `rgba(249,115,22,0.6)`

### State: `preparing` + `!isMyTurn` → `#screen-waiting`
- Phase badge: "⏳ En espera"
- Hourglass stack (120×120): blue radial glow + ⏳ emoji with `hgFloat` rotation animation
- Orbitron title: "Esperando tu Turno"
- Exo 2 sub: presenting team name
- `.presenter-card` (blue-tinted glassmorphism):
  - "PRESENTANDO AHORA" label
  - Row: prototype thumb (72×72) + name + tag + team badge
  - `.presenter-status`: live dot + "En vivo en el escenario"

### State: `presenting` + `isMyTurn` → `#screen-presenting`
- Phase badge: green "● Presentación en curso"
- Green Orbitron title: "Su Pitch en Vivo"
- Timer block: orange-tinted, `#fbbf24` label
- `.present-grid` (2 columns, 1 col on mobile):
  - Left card: "🖼 Prototipo del Equipo" — proto-display (dark bg, prototype image or emoji placeholder)
  - Right card: "📋 Tu Guión de Pitch" — script-stack (5 script-items, each with colored left border + Orbitron tag + Exo text)

### State: `presenting` + `!isMyTurn` → `#screen-waiting` (with timer)
Same as `preparing + !isMyTurn` but also shows the timer block below the presenter card.

### State: `evaluating` + `!isMyTurn` → `#screen-analysis`
- Phase badge: amber "⭐ Análisis de competencia"
- Amber Orbitron title: "Análisis de Competencia"
- Exo 2 sub: "¿Invertirías en la Start-up [NAME]?"
- `.analysis-card` (amber-tinted glassmorphism):
  - Compact presenter row (54×54 thumb)
  - 3× `.rate-row`:
    - "Relevancia del Dolor (El Problema)"
    - "Potencial de la Solución (El MVP)"
    - "Poder de Convicción (El Pitch)"
  - Each row: 10 `.rate-pip` buttons (Orbitron, 1–10), selected = amber gradient, below-selected = amber tint
  - Textarea: "Consejo Estratégico (Opcional)", Exo 2, dark bg
  - btn-primary: "[ Registrar Valoración ]"
- **Removes** the current `<input type="number">` fields
- Rating state: `evaluationScores.clarity/solution/presentation` (already exists, just driven by pips now)

### State: `evaluating` + `isMyTurn` + not all done → `Esperando Evaluaciones`
Keep existing content. Apply dark/galactic styling (dark cards, Orbitron labels, green progress bar).

### State: `evaluating` + `isMyTurn` + all done → `#screen-complete`
Already implemented. Update styling to match HTML:
- `cmp-badge` "Misión Completada · Fase 4"
- Large 🎤 emoji
- Orbitron title "¡Pitch Entregado!"
- Score block: magenta glassmorphism, Orbitron score number

---

## Animations (inline `<style>` tag)

```css
@keyframes micPulse { 0%,100%{opacity:.5;transform:scale(.94)} 50%{opacity:.95;transform:scale(1.05)} }
@keyframes micFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes hgFloat  { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(180deg)} }
@keyframes livePulse{ 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.85)} }
@keyframes phPulse  { 0%,100%{opacity:1} 50%{opacity:.55} }
```

Injected via `<style>{CSS_STRING}</style>` at top of component (same pattern as `PrototipoV2.tsx`).

---

## What does NOT change

- All API calls, polling intervals, redirect logic
- `handleFieldChange`, `handleFieldBlur`, `handleFieldFocus` (auto-save)
- `handleSubmitEvaluation`, `checkExistingEvaluation`
- Timer sync logic in both files
- U-Bot modals (removed from the galactic design — not in the HTML spec)
- Routes in `App.tsx`

---

## Verification

1. `npm run build` inside `frontend/` — no new TypeScript errors in the two modified files
2. `FormularioPitch.tsx` — manually verify:
   - Starfield renders, dark background
   - Persona pill shows name from Etapa 2 (or `—` if not found)
   - Prototype pill shows product name from Etapa 3 (or `—` if not found)
   - All 5 pitch boxes render with correct colors
   - Progress dots in footer update as fields are filled
   - "Ver pitch completo →" only enables when all 5 filled
   - Preview card shows all 5 sections in dark glassmorphism style
3. `PresentacionPitch.tsx` — manually verify each state:
   - `preparing`/isMyTurn: orange mic glow, "Tomar el escenario"
   - `preparing`/!isMyTurn: blue hourglass, presenter card
   - `presenting`/isMyTurn: green badge, two-column grid, script stack
   - `presenting`/!isMyTurn: blue hourglass + timer
   - `evaluating`/!isMyTurn: amber card, rating pips clickable, submit works
   - `evaluating`/isMyTurn/all done: "¡Pitch Entregado!" with score
