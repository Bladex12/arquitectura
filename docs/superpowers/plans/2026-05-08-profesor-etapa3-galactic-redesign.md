# Profesor Etapa 3 Galactic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old gradient/white-card design in the professor's Etapa 3 control screen (`ProfesorPrototipo`) with the galactic space theme already used in Etapa 1 and Etapa 2 professor views.

**Architecture:** Single-file UI refactor of `frontend/src/pages/profesor/etapa3/Prototipo.tsx`. All game logic, polling, and timer sync stay unchanged. Replace the background, loading state, and full return JSX with the galactic design system (`GalacticPage`, `TimerBlock`, glass cards, Orbitron/Exo 2 fonts, `btn-galactic-*` classes). Reference template: `frontend/src/pages/profesor/etapa1/Personalizacion.tsx`.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS (minimal), inline styles following `galactic.css` conventions, Orbitron + Exo 2 fonts (already loaded in `index.html`).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/pages/profesor/etapa3/Prototipo.tsx` | Replace UI — imports, loading state, full JSX render |

---

## Task 1: Update imports and remove unused code

**Files:**
- Modify: `frontend/src/pages/profesor/etapa3/Prototipo.tsx`

- [ ] **Step 1: Replace the import block (lines 1–24)**

Find and replace the entire import section at the top of the file with:

```tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, ImageIcon } from 'lucide-react';
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
import { isDevMode } from '@/utils/devMode';
import { sessionsAPI, challengesAPI, teamActivityProgressAPI, teamPersonalizationsAPI } from '@/services';
import { toast } from 'sonner';
import { useGameStateRedirect } from '@/hooks/useGameStateRedirect';
import { GalacticPage } from '@/components/GalacticPage';
import { TimerBlock } from '@/components/TimerBlock';
```

Removed: `motion` (framer-motion), `Button`, `Badge` (ui components), `GroupBadge`, and all lucide icons except `Loader2`, `CheckCircle2`, `ImageIcon`.  
Added: `GalacticPage`, `TimerBlock`, `isDevMode`.

- [ ] **Step 2: Remove the `getStatusBadge` helper function**

Find and delete these lines (around line 332–345):

```tsx
  const getStatusBadge = (status: string | undefined) => {
    if (!status) {
      return { text: 'Pendiente', class: 'bg-yellow-100 text-yellow-800', status: 'pending' };
    }

    switch (status) {
      case 'completed':
        return { text: 'Completado', class: 'bg-green-100 text-green-800', status: 'completed' };
      case 'submitted':
        return { text: 'Prototipo subido', class: 'bg-blue-100 text-blue-800', status: 'submitted' };
      default:
        return { text: 'Pendiente', class: 'bg-yellow-100 text-yellow-800', status: 'pending' };
    }
  };
```

- [ ] **Step 3: Remove the `allTeamsCompleted` derived value**

Find and delete these lines (around line 347–349):

```tsx
  const allTeamsCompleted = teamsWithProgress.length > 0 && 
    teamsWithProgress.every(({ progress }) => progress?.status === 'completed' || progress?.status === 'submitted');
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: errors will appear because the return JSX still references removed imports. That's expected — proceed to Task 2 immediately to fix them.

---

## Task 2: Replace loading state and error states

**Files:**
- Modify: `frontend/src/pages/profesor/etapa3/Prototipo.tsx`

- [ ] **Step 1: Replace the loading state render (around line 350–356)**

Find:

```tsx
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }
```

Replace with:

```tsx
  if (loading) {
    return (
      <GalacticPage className="items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
      </GalacticPage>
    );
  }
```

- [ ] **Step 2: Replace the null session error state (around line 358–367)**

Find:

```tsx
  if (!gameSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Error al cargar la sesión.</p>
          <Button onClick={() => navigate('/profesor/panel')}>Volver al Panel</Button>
        </div>
      </div>
    );
  }
```

Replace with:

```tsx
  if (!gameSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="text-center bg-white rounded-3xl shadow-sm p-8 max-w-sm mx-4">
          <p className="text-lg font-semibold text-slate-700 mb-4">Error al cargar la sesión</p>
          <button
            onClick={() => navigate('/profesor/panel')}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
          >
            Volver al Panel
          </button>
        </div>
      </div>
    );
  }
```

---

## Task 3: Replace main return JSX with galactic layout

**Files:**
- Modify: `frontend/src/pages/profesor/etapa3/Prototipo.tsx`

- [ ] **Step 1: Replace the entire `return (...)` block**

Find everything from `return (` through the final closing `);` of the component (lines 369–674) and replace with:

```tsx
  return (
    <GalacticPage>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 3</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 30, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
            Creatividad
          </div>
        </div>
        <div className="galactic-badge">Actividad 1</div>
      </div>

      {/* Timer */}
      <TimerBlock timerRemaining={timerRemaining} activityName="Prototipos de Lego" />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 22 }}>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>Equipos Totales</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#fff' }}>
            {teamsWithProgress.length}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            en esta sesión
          </div>
        </div>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>Completados</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#34d399' }}>
            {teamsWithProgress.filter(({ progress }) => progress?.status === 'completed' || progress?.status === 'submitted').length}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            prototipos
          </div>
        </div>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>Fotos Subidas</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#a78bfa' }}>
            {teamsWithProgress.filter(({ progress }) => !!progress?.prototype_image_url?.trim()).length}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            imágenes
          </div>
        </div>
      </div>

      {/* Team grid */}
      <div style={{ marginTop: 22 }}>
        <div className="galactic-label" style={{ marginBottom: 12 }}>Estado de los equipos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
          {teamsWithProgress.map(({ team, progress }) => {
            const isCompleted = progress?.status === 'completed' || progress?.status === 'submitted';
            const hasImage = Boolean(progress?.prototype_image_url?.trim());
            const imageUrl = progress?.prototype_image_url || '';
            const teamColorHex = getTeamColorHex(team.color);
            const teamName = personalizations[team.id]?.team_name
              ? `Equipo ${personalizations[team.id].team_name}`
              : team.name;

            return (
              <div
                key={team.id}
                className="glass-card"
                style={{
                  padding: '16px 18px',
                  borderColor: isCompleted ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.12)',
                  background: isCompleted ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)',
                }}
              >
                {/* Team header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: teamColorHex, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {teamName}
                  </span>
                  {isCompleted && <CheckCircle2 size={16} style={{ color: '#34d399', flexShrink: 0 }} />}
                </div>

                {/* Prototype image */}
                {hasImage ? (
                  <img
                    src={imageUrl.startsWith('/') ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000'}${imageUrl}` : imageUrl}
                    alt={`Prototipo ${teamName}`}
                    style={{ width: '100%', height: 120, objectFit: 'contain', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.3)', marginBottom: 10, display: 'block' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div style={{ width: '100%', height: 80, border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: "'Exo 2',sans-serif", marginBottom: 10 }}>
                    <ImageIcon size={16} style={{ opacity: 0.4 }} />
                    Sin foto aún
                  </div>
                )}

                {/* Status pill */}
                <div style={{
                  display: 'inline-block',
                  fontFamily: "'Orbitron',sans-serif",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase' as const,
                  padding: '4px 10px',
                  borderRadius: 50,
                  ...(progress?.status === 'completed'
                    ? { background: 'rgba(16,185,129,0.2)', color: '#34d399' }
                    : progress?.status === 'submitted'
                    ? { background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }
                    : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }),
                }}>
                  {progress?.status === 'completed'
                    ? 'Completado'
                    : progress?.status === 'submitted'
                    ? 'Foto subida'
                    : 'Pendiente'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24, paddingBottom: 8 }}>
        <button className="btn-galactic-secondary" onClick={() => navigate('/profesor/panel')}>
          Cancelar Sesión
        </button>
        {isDevMode() && (
          <button
            onClick={() => handleNextActivity(true)}
            disabled={advancing}
            style={{
              fontFamily: "'Orbitron',sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '2px',
              textTransform: 'uppercase' as const,
              padding: '10px 20px',
              borderRadius: 50,
              background: '#f97316',
              color: '#fff',
              border: 'none',
              cursor: advancing ? 'not-allowed' : 'pointer',
              opacity: advancing ? 0.6 : 1,
              boxShadow: '0 0 12px rgba(249,115,22,0.35)',
            }}
          >
            ⚡ Dev Skip
          </button>
        )}
        <button
          className="btn-galactic-primary"
          onClick={() => handleNextActivity(false)}
          disabled={advancing}
        >
          {advancing ? 'Avanzando...' : 'Continuar Misión ▶'}
        </button>
      </div>

      <EtapaIntroModal
        etapaNumero={3}
        isOpen={showEtapaIntro}
        onClose={() => {
          setShowEtapaIntro(false);
          if (sessionId) {
            localStorage.setItem(`etapa_intro_${sessionId}_3`, 'true');
          }
        }}
      />
    </GalacticPage>
  );
```

---

## Task 4: TypeScript build check and commit

**Files:**
- Modify: `frontend/src/pages/profesor/etapa3/Prototipo.tsx`

- [ ] **Step 1: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors. If there are errors, common fixes:
- `textTransform: 'uppercase' as const` — already in the code above
- Any reference to removed `allTeamsCompleted` or `getStatusBadge` — search and remove

- [ ] **Step 2: Start the dev server and verify visually**

```bash
cd frontend && npm run dev
```

Navigate to a game session in Etapa 3 (`/profesor/etapa3/prototipo/<sessionId>/`). Verify:
- Dark starfield background visible (no gradient from old design)
- "Control de Misión · Etapa 3" label and "Creatividad" title in Orbitron font
- Timer block centered and counting down
- Stats row shows 3 glass cards (Equipos Totales, Completados, Fotos Subidas)
- Team cards show image placeholder (dashed border) or prototype photo when uploaded
- "Cancelar Sesión" (secondary) and "Continuar Misión ▶" (primary gradient) buttons visible at all times
- "⚡ Dev Skip" button visible only when `isDevMode()` is true (set `VITE_DEV_MODE=true` in `.env` or check `devMode.ts`)
- `EtapaIntroModal` fires on first visit to a session

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/profesor/etapa3/Prototipo.tsx
git commit -m "feat: apply galactic design to professor Etapa 3 control screen"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|-----------------|------|
| `GalacticPage` wrapper replaces gradient div | Task 2, 3 |
| Top bar: galactic-label + Orbitron title + galactic-badge | Task 3 |
| `TimerBlock` component (centered, large) | Task 3 |
| Stats row: 3 glass cards | Task 3 |
| Team cards: glass-card with image preview | Task 3 |
| Image placeholder (dashed, dark-themed) when no photo | Task 3 |
| Status pill: Pendiente / Foto subida / Completado | Task 3 |
| Green border/background on completed cards | Task 3 |
| "Cancelar Sesión" secondary button always visible | Task 3 |
| "Continuar Misión" primary button always visible | Task 3 |
| "⚡ Dev Skip" orange button only in `isDevMode()` | Task 3 |
| `EtapaIntroModal` preserved | Task 3 |
| Galactic loading state (`GalacticPage` + purple spinner) | Task 2 |
| Remove framer-motion, Button, Badge, GroupBadge | Task 1 |
| Remove unused lucide icons | Task 1 |
| Add `GalacticPage`, `TimerBlock`, `isDevMode` imports | Task 1 |
| TypeScript check passes | Task 4 |

All requirements covered. ✓

### Placeholder scan

No TBDs, TODOs, or incomplete code blocks. All steps include exact code. ✓

### Type consistency

- `progress?.status` checked as `'completed'` / `'submitted'` consistently in stats row and team card status pill ✓
- `getTeamColorHex(team.color)` kept unchanged from original ✓
- `handleNextActivity(true/false)` signature unchanged ✓
- `personalizations[team.id]?.team_name` pattern matches the existing state type `Record<number, { team_name?: string }>` ✓
