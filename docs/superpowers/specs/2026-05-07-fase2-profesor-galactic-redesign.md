# Spec: Fase 2 — Professor Screens Galactic Redesign

**Date:** 2026-05-07
**Status:** Approved
**Scope:** Visual redesign only — no logic, routing, or API changes on two existing professor screens

---

## Context

The Fase 2 tablet screens were already updated to the V2 galactic theme (`SeleccionarTemaDesafioV2.tsx`, `BubbleMapV2.tsx`). The two professor monitoring screens for Etapa 2 still use the old blue-to-pink gradient style. This spec applies the same "Mission Control dashboard" galactic aesthetic used by all Phase 1 professor screens (`GalacticPage`, `TimerBlock`, glass cards, Orbitron/Exo 2 fonts) to both Fase 2 professor screens.

---

## Files

### Modified
| File | Change |
|---|---|
| `frontend/src/pages/profesor/etapa2/SeleccionarTema.tsx` | Full visual redesign — galactic theme; no routing or API changes |
| `frontend/src/pages/profesor/etapa2/BubbleMap.tsx` | Full visual redesign — galactic theme + V2 bubble map rendering + token transaction fetch for completion detection |

### Left untouched
- All routing, API calls, polling intervals, state management, and redirect logic
- `frontend/src/pages/profesor/etapa2/SeleccionarDesafio.tsx` (unused route)
- `frontend/src/pages/profesor/etapa2/SeleccionarTemaDesafio.tsx` (unused route)
- `frontend/src/pages/profesor/etapa2/MapaDeEmpatia.tsx` (unused route)

### Reused (no changes needed)
| Component | Path | Purpose |
|---|---|---|
| `GalacticPage` | `frontend/src/components/GalacticPage.tsx` | Dark starfield wrapper |
| `TimerBlock` | `frontend/src/components/TimerBlock.tsx` | Centered countdown display |
| `galactic.css` | `frontend/src/styles/galactic.css` | `.glass-card`, `.galactic-label`, `.btn-galactic-primary`, `.btn-galactic-secondary`, `.galactic-badge` |

---

## Design System (same as Phase 1)

| Token | Value | Usage |
|---|---|---|
| Background | `#050818` | Page background (via `GalacticPage`) |
| Accent magenta | `#c026d3` / `#d946ef` | Buttons, glows, badges |
| Accent blue | `#093c92` | Gradient partner |
| Success | `#10b981` / `#34d399` | Completed state |
| Warn | `#f97316` | Timer ≤30s |
| Danger | `#ef4444` | Timer ≤10s |

Typography: `Orbitron` for headings/timers/values, `Exo 2` for body/labels/status.

---

## Screen 1 — SeleccionarTema.tsx

### Layout (top to bottom)

**Top bar**
- Left: mission tag `"Control de Misión · Etapa 2"` (Exo 2, 11px, uppercase, 4px letter-spacing, `rgba(255,255,255,0.55)`) + phase title `"Empatía"` (Orbitron 24px 700, white, magenta text-shadow)
- Right: activity badge (`.galactic-badge`) showing `gameSession.current_activity_name || "Seleccionar Tema"`

**TimerBlock**
- `TimerBlock` component stays unchanged (it renders a centered label + countdown + sublabel).
- Wrap it in a flex container to achieve the 3-column layout:
  ```tsx
  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }} className="glass-card" style={{ padding: '20px 24px', marginBottom: 14 }}>
    {/* Left: sala code */}
    <div style={{ minWidth: 100 }}>
      <div className="galactic-label" style={{ fontSize: 11, marginBottom: 4 }}>Sala</div>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize: 22, fontWeight: 700, color:'#c026d3', letterSpacing: 4 }}>
        {gameSession?.room_code ?? '--'}
      </div>
    </div>
    {/* Center: timer */}
    <TimerBlock timerRemaining={timerRemaining} activityName="Selección de Tema y Desafío" />
    {/* Right: empty spacer to keep timer truly centered */}
    <div style={{ minWidth: 100 }} />
  </div>
  ```
  `TimerBlock` itself is not modified.

**3-column glass stats row** (`.glass-card` each)
1. `"Temas Seleccionados"` — `X / N` (Orbitron 32px)
2. `"Desafíos Seleccionados"` — `X / N` (Orbitron 32px, color `#34d399` when any selected)
3. `"Actividad Actual"` — activity name string (Orbitron 18px, `#d946ef`)

**Section label** — `"Estado de los equipos"` (`.galactic-label`)

**Team status grid** — `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`, `gap: 20px`

Each team card (`.glass-card`, green border `rgba(16,185,129,0.5)` + green tint when `isCompleted`):
- Header row: color dot (12px circle, team color) + team name (Exo 2 16px 700) + status pill (right)
  - Status pills: `"✓ Completo"` (green), `"⏳ En progreso"` (amber), `"⏳ Pendiente"` (amber)
- Progress bar (4px, `linear-gradient(90deg, #7c3aed, #c026d3)`)
  - Fill: 0% if no topic, 50% if topic selected, 100% if both selected
- Topic row (glass inner panel `rgba(255,255,255,0.04)`):
  - Label: `"🌍 Tema"` + checkmark or dots on right
  - Value: topic name, or italic `"Sin seleccionar"` (muted)
- Challenge row (same style):
  - Label: `"🎯 Desafío"` + checkmark or dots
  - Value: `"{persona_emoji} {persona_name}, {persona_age} · {challenge.title}"`, or italic placeholder

**Actions row** (centered, `gap: 14px`)
- `"Cancelar Sesión"` → `.btn-galactic-secondary` → `navigate('/profesor/panel')`
- `"Avanzar a Bubble Map ▶"` → `.btn-galactic-primary` → `handleNextActivity(false)`, **only rendered when `allTopicsSelected && allChallengesSelected`**; disabled + `opacity: 0.35` otherwise
- Dev button (orange, only in `isDevMode()`) → `handleNextActivity(true)`

**No logic changes:** `loadGameControl`, `loadTeamsProgress`, `startTimer`, `handleNextActivity` — unchanged.

---

## Screen 2 — BubbleMap.tsx

### Layout (top to bottom)

Same top bar + timer structure as Screen 1 (`"Mapa de Empatía"` as activity label).

**3-column glass stats row**
1. `"Completados"` — `X / N` (color `#34d399`)
2. `"Ideas Totales"` — sum of all ideas across all teams and nodes
3. `"Actividad Actual"` — `"Bubble Map"` (Orbitron 18px, `#d946ef`)

**Team status grid** — same `minmax(240px, 1fr)`, `gap: 20px`

Each team card:
- Header: color dot + team name + persona subtitle (`"{emoji} {personName} · {topicName}"`, 10px muted) + status pill
- Progress bar: fill based on `totalIdeas / 10 * 100%` capped at 100%
- **If map exists (any ideas):** node count grid + "Ver Mapa" button
- **If no map yet:** centered italic placeholder `"Esperando inicio del mapa..."`

**Node count grid** (inside team card, replaces old `renderBubbleMap` preview):
```
display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
```
Iterate `[...nodes, ...customNodes]` — each tile:
- Background: `rgba({node.rgb}, 0.15)`, border: `rgba({node.rgb}, 0.4)`
- Icon (14px) + node label (8px uppercase, node color) + idea count (Orbitron 16px) + `"ideas"` (7px muted)
- Tiles with 0 ideas: reduced opacity (icon 35%, border/bg at 12% opacity) to visually distinguish

**"Ver Mapa Completo →" button** — always a separate full-width row **below** the node grid, never inside it:
```tsx
<div className="node-grid">{/* tiles */}</div>
<button className="ver-mapa-btn" onClick={() => setPreviewMap(...)}>
  {isCompleted ? 'Ver Mapa Completo →' : 'Ver Mapa Parcial →'}
</button>
```

**V2 data detection:**
```typescript
const isV2 = mapData?.version === 2;
const nodes: NodeData[] = isV2 ? mapData.nodes ?? [] : [];
const customNodes: NodeData[] = isV2 ? mapData.customNodes ?? [] : [];
const allNodes = [...nodes, ...customNodes];
const totalIdeas = allNodes.reduce((sum, n) => sum + (n.ideas?.length ?? 0), 0);
```

**Completion detection for V2** — `TeamBubbleMap` has no `is_finalized` field. Detection uses token transactions: when `finalize_bubble_map` is called by the tablet, a `TokenTransaction` is created with `source_type='activity'` and `source_id=bubbleMap.id`. Add a per-team fetch inside `loadBubbleMaps`:
```typescript
// New call added inside the per-team Promise.all in loadBubbleMaps
const txList = await tokenTransactionsAPI.list({ team: team.id, session_stage: sessionStageId });
const txArray = Array.isArray(txList) ? txList : [txList];
const isFinalized = bubbleMap
  ? txArray.some((tx: any) => tx.source_type === 'activity' && tx.source_id === bubbleMap.id)
  : false;
```
If `isV2 && !isCompleted && totalIdeas > 0` → `"En Progreso"`.
If `isV2 && isCompleted` → `"Completado"`.
If `!isV2` → keep existing `getBubbleMapStatus` logic for old format compatibility.

**Preview modal (dark galactic)** — replaces the current white modal:
- Background: `rgba(5,8,24,0.97)` with `backdrop-filter: blur(20px)`, border `rgba(255,255,255,0.12)`
- Header: team color dot + team name (Orbitron) + persona name + close button
- Body: full node list, same 3-column tile grid but larger tiles showing idea text chips below each node
  - Idea chips: `background: rgba({node.rgb}, 0.2)`, `color: {node.color}`, rounded pill, 11px text
- Footer: total ideas count badge

---

## Bubble Map V2 Node Colors Reference

| Node ID | Color | RGB |
|---|---|---|
| `perfil` | `#c026d3` (purple) | `192,38,211` |
| `entorno` | `#0284c7` (blue) | `2,132,199` |
| `emociones` | `#ea580c` (orange) | `234,88,12` |
| `necesidades` | `#10b981` (green) | `16,185,129` |
| `limitaciones` | `#ef4444` (red) | `239,68,68` |
| `motivaciones` | `#f59e0b` (amber) | `245,158,11` |
| custom nodes | stored in `node.color` / `node.rgb` | from `node.rgb` field |

---

## Verification

1. Start dev server: `docker-compose up`
2. Log in as professor, open a session in Etapa 2
3. Navigate to `/profesor/etapa2/seleccionar-tema/{id}`:
   - Starfield renders, timer centered, sala code on left
   - Team cards show topic/challenge rows with correct status pills
   - "Avanzar a Bubble Map" button only appears once all teams have both selected
4. Navigate to `/profesor/etapa2/bubble-map/{id}`:
   - Node count grid renders for teams with V2 maps (iterate `nodes + customNodes`)
   - Custom nodes (✦) appear as extra tiles, grid wraps to new row naturally
   - "Ver Mapa" button is always below the grid, not inside it
   - Completion: finalized teams show green border + `"✓ Listo"` pill
   - Modal opens with dark galactic style + idea chips per node
5. `npm run build` in `frontend/` — no TypeScript errors
