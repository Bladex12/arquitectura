# Phase 1 Galactic Aesthetic Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all Phase 1 tablet and professor pages with the dark galactic aesthetic (starfield, glass morphism, Orbitron/Exo 2 fonts, neon glow) from the reference HTML files — zero logic changes.

**Architecture:** Four shared components (`GalacticPage`, `GlassCard`, `TimerBlock`, `PodiumScreen`) plus a `galactic.css` file provide the design system. Each page replaces its existing JSX wrapper and UI blocks with the galactic equivalents while leaving all state, API calls, routing, and event handlers completely untouched.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, Orbitron + Exo 2 (already loaded in `index.html`), existing `StarfieldBackground.tsx` component.

---

## File Map

**Create:**
- `frontend/src/styles/galactic.css` — CSS variables, keyframes, timer block states, glass card, buttons, labels
- `frontend/src/components/GalacticPage.tsx` — page wrapper around `StarfieldBackground`
- `frontend/src/components/GlassCard.tsx` — frosted glass card container
- `frontend/src/components/TimerBlock.tsx` — large countdown with warn/danger states
- `frontend/src/components/PodiumScreen.tsx` — animated ranked podium for results

**Modify:**
- `frontend/tailwind.config.js` — add `fontFamily.orbitron` and `fontFamily.exo`
- `frontend/src/main.tsx` — import `galactic.css`
- `frontend/src/pages/tablets/etapa1/VideoInstitucional.tsx`
- `frontend/src/pages/tablets/etapa1/Instructivo.tsx`
- `frontend/src/pages/tablets/etapa1/Personalizacion.tsx`
- `frontend/src/pages/tablets/etapa1/Minijuego.tsx`
- `frontend/src/pages/tablets/etapa1/Presentacion.tsx`
- `frontend/src/pages/tablets/etapa1/Resultados.tsx`
- `frontend/src/pages/profesor/etapa1/VideoInstitucional.tsx`
- `frontend/src/pages/profesor/etapa1/Instructivo.tsx`
- `frontend/src/pages/profesor/etapa1/Personalizacion.tsx`
- `frontend/src/pages/profesor/etapa1/Presentacion.tsx`
- `frontend/src/pages/profesor/etapa1/Resultados.tsx`

---

## Task 1: Add galactic.css and extend Tailwind config

**Files:**
- Create: `frontend/src/styles/galactic.css`
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create `frontend/src/styles/galactic.css`**

```css
/* ── Timer Block ── */
.timer-block {
  text-align: center;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 20px;
  padding: 20px 24px 16px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: border-color 0.4s, background 0.4s;
}
.timer-block .timer-label {
  font-family: 'Exo 2', sans-serif;
  font-size: 16px;
  letter-spacing: 5px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.75);
  margin-bottom: 6px;
}
.timer-block .timer-display {
  font-family: 'Orbitron', sans-serif;
  font-size: clamp(72px, 12vw, 120px);
  font-weight: 900;
  letter-spacing: 10px;
  color: #fff;
  line-height: 1;
  transition: color 0.4s, text-shadow 0.4s;
}
.timer-block .timer-sublabel {
  font-family: 'Exo 2', sans-serif;
  font-size: 17px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
  margin-top: 10px;
}

/* Warn ≤30s */
.timer-block.timer-warn {
  border-color: rgba(249,115,22,0.6);
  background: rgba(249,115,22,0.07);
}
.timer-block.timer-warn .timer-display {
  color: #f97316;
  text-shadow: 0 0 40px rgba(249,115,22,0.8);
  animation: galactic-twinkle 1s ease-in-out infinite;
}
.timer-block.timer-warn .timer-label,
.timer-block.timer-warn .timer-sublabel { color: rgba(249,115,22,0.95); }

/* Danger ≤10s */
.timer-block.timer-danger {
  border-color: rgba(239,68,68,0.7);
  background: rgba(239,68,68,0.09);
}
.timer-block.timer-danger .timer-display {
  color: #ef4444;
  text-shadow: 0 0 60px rgba(239,68,68,1), 0 0 120px rgba(239,68,68,0.5);
  animation: galactic-pulse-danger 0.28s ease-in-out infinite;
}
.timer-block.timer-danger .timer-label,
.timer-block.timer-danger .timer-sublabel { color: rgba(239,68,68,1); }

@keyframes galactic-twinkle {
  0%,100% { opacity:1; transform:scale(1); }
  50% { opacity:0.6; transform:scale(0.97); }
}
@keyframes galactic-pulse-danger {
  0%,100% { opacity:1; transform:scale(1); }
  50% { opacity:0.4; transform:scale(0.94); }
}

/* ── Glass card ── */
.glass-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* ── Buttons ── */
.btn-galactic-primary {
  font-family: 'Orbitron', sans-serif;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #fff;
  background: linear-gradient(135deg, #093c92, #c026d3);
  border: none;
  padding: 16px 40px;
  cursor: pointer;
  clip-path: polygon(14px 0%, 100% 0%, calc(100% - 14px) 100%, 0% 100%);
  box-shadow: 0 0 28px rgba(192,38,211,0.45);
  transition: box-shadow 0.2s;
}
.btn-galactic-primary:hover { box-shadow: 0 0 48px rgba(192,38,211,0.75); }
.btn-galactic-primary:disabled { opacity: 0.5; cursor: default; }

.btn-galactic-secondary {
  font-family: 'Orbitron', sans-serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  color: rgba(255,255,255,0.85);
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.3);
  padding: 16px 28px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}
.btn-galactic-secondary:hover { color: #fff; border-color: rgba(255,255,255,0.6); }

/* ── Misc ── */
.galactic-badge {
  background: linear-gradient(135deg, #c026d3, #7c3aed);
  font-family: 'Orbitron', sans-serif;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 3px;
  padding: 10px 24px;
  border-radius: 999px;
  text-transform: uppercase;
  color: #fff;
  display: inline-block;
}
.galactic-label {
  font-family: 'Exo 2', sans-serif;
  font-size: 14px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.75);
}

/* ── Podium ── */
.pd-bar {
  width: 100%;
  border-radius: 8px 8px 0 0;
  height: 0;
  transition: height 1s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 10px;
}
.pd-bar.bar-1 { background: linear-gradient(180deg,#fbbf24 0%,#d97706 100%); box-shadow: 0 0 30px rgba(251,191,36,0.4); }
.pd-bar.bar-2 { background: linear-gradient(180deg,#cbd5e1 0%,#64748b 100%); box-shadow: 0 0 20px rgba(203,213,225,0.25); }
.pd-bar.bar-3 { background: linear-gradient(180deg,#d97706 0%,#92400e 100%); box-shadow: 0 0 20px rgba(217,119,6,0.25); }

@keyframes confetti-fall {
  0% { opacity:1; transform:translate(0,0) rotate(0deg); }
  100% { opacity:0; transform:translate(var(--tx),var(--ty)) rotate(var(--rot)); }
}
```

- [ ] **Step 2: Add font families to `frontend/tailwind.config.js`**

In the `theme.extend` block, add:
```js
fontFamily: {
  orbitron: ['Orbitron', 'sans-serif'],
  exo: ['"Exo 2"', 'sans-serif'],
},
```

- [ ] **Step 3: Import galactic.css in `frontend/src/main.tsx`**

Add this import at the top of the file (after existing imports):
```ts
import './styles/galactic.css';
```

- [ ] **Step 4: Start dev server and confirm no build errors**

```bash
cd frontend && npm run dev
```
Expected: server starts at `http://localhost:5173` with no TypeScript or CSS errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/galactic.css frontend/tailwind.config.js frontend/src/main.tsx
git commit -m "feat: add galactic design system CSS and tailwind font config"
```

---

## Task 2: Create GalacticPage and GlassCard components

**Files:**
- Create: `frontend/src/components/GalacticPage.tsx`
- Create: `frontend/src/components/GlassCard.tsx`

- [ ] **Step 1: Create `frontend/src/components/GalacticPage.tsx`**

```tsx
import { StarfieldBackground } from './StarfieldBackground';

interface GalacticPageProps {
  children: React.ReactNode;
  className?: string;
  nebTarget?: [number, number, number];
  padding?: string;
}

export function GalacticPage({
  children,
  className = '',
  nebTarget,
  padding = 'p-6 md:p-8',
}: GalacticPageProps) {
  return (
    <StarfieldBackground nebTarget={nebTarget}>
      <div
        className={`min-h-screen flex flex-col ${padding} ${className}`}
        style={{ fontFamily: "'Exo 2', sans-serif", color: '#fff' }}
      >
        {children}
      </div>
    </StarfieldBackground>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/GlassCard.tsx`**

```tsx
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function GlassCard({ children, className = '', style }: GlassCardProps) {
  return (
    <div className={`glass-card ${className}`} style={style}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/GalacticPage.tsx frontend/src/components/GlassCard.tsx
git commit -m "feat: add GalacticPage and GlassCard shared components"
```

---

## Task 3: Create TimerBlock component

**Files:**
- Create: `frontend/src/components/TimerBlock.tsx`

The professor pages store the timer as a formatted string like `"3:42"` or `"--:--"`. `TimerBlock` parses this to determine warn/danger state.

- [ ] **Step 1: Create `frontend/src/components/TimerBlock.tsx`**

```tsx
interface TimerBlockProps {
  timerRemaining: string;          // formatted "M:SS" or "--:--"
  label?: string;
  activityName?: string;
}

function parseSeconds(timeStr: string): number | null {
  const match = timeStr.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function TimerBlock({
  timerRemaining,
  label = 'Tiempo Restante',
  activityName,
}: TimerBlockProps) {
  const seconds = parseSeconds(timerRemaining);
  const isDanger = seconds !== null && seconds <= 10;
  const isWarn   = seconds !== null && seconds > 10 && seconds <= 30;

  const stateClass = isDanger ? 'timer-danger' : isWarn ? 'timer-warn' : '';

  const sublabel = isDanger
    ? '¡Tiempo casi agotado!'
    : isWarn
    ? 'Tiempo casi agotado...'
    : activityName ?? '';

  return (
    <div className={`timer-block ${stateClass}`}>
      <div className="timer-label">{label}</div>
      <div className="timer-display">{timerRemaining}</div>
      {sublabel && <div className="timer-sublabel">{sublabel}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/TimerBlock.tsx
git commit -m "feat: add TimerBlock component with warn/danger countdown states"
```

---

## Task 4: Create PodiumScreen component

**Files:**
- Create: `frontend/src/components/PodiumScreen.tsx`

Ported from the `#podiumScreen` section of `Space Missions.html`. Accepts a sorted list of teams and reveals them with a timed animation sequence.

- [ ] **Step 1: Create `frontend/src/components/PodiumScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { StarfieldBackground } from './StarfieldBackground';

interface TeamResult {
  team_id: number;
  team_name: string;
  team_color: string;
  tokens_stage: number;
  tokens_total: number;
}

interface PodiumScreenProps {
  teams: TeamResult[];          // unsorted — component sorts by tokens_total desc
  stageName: string;            // e.g. "Trabajo en Equipo"
  onContinue: () => void;
}

const STAGE_HEIGHT_PCT = [0.90, 0.60, 0.44]; // 1st, 2nd, 3rd bar heights

function spawnConfetti() {
  const colors = ['#f59e0b', '#818cf8', '#f472b6', '#22d3ee', '#34d399', '#fb923c'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    const dur = (1.8 + Math.random() * 1.4).toFixed(2);
    const tx = (Math.random() * 200 - 100).toFixed(0);
    const ty = (window.innerHeight * 0.6 + Math.random() * window.innerHeight * 0.4).toFixed(0);
    const rot = (Math.random() * 720 - 360).toFixed(0);
    const delay = (Math.random() * 0.8).toFixed(2);
    el.style.cssText = `
      position:fixed;pointer-events:none;z-index:200;
      width:8px;height:8px;border-radius:2px;
      left:${Math.random() * window.innerWidth}px;top:-10px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      --tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;
      animation:confetti-fall ${dur}s ease-in ${delay}s forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), (parseFloat(dur) + parseFloat(delay) + 0.5) * 1000);
  }
}

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

export function PodiumScreen({ teams, stageName, onContinue }: PodiumScreenProps) {
  const sorted = [...teams].sort((a, b) => b.tokens_total - a.tokens_total);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  // reveal states
  const [showLower, setShowLower]       = useState<boolean[]>(rest.map(() => false));
  const [barHeights, setBarHeights]     = useState([0, 0, 0]);
  const [showAvatars, setShowAvatars]   = useState([false, false, false]);
  const [showContinue, setShowContinue] = useState(false);

  const stageH = Math.round(window.innerHeight * 0.38);

  useEffect(() => {
    let cancelled = false;
    async function reveal() {
      // 4th and 5th (rest in reverse: 5th first, then 4th)
      for (let i = rest.length - 1; i >= 0; i--) {
        await delay(700);
        if (cancelled) return;
        setShowLower(prev => { const n = [...prev]; n[i] = true; return n; });
      }

      // 3rd bar
      await delay(900);
      if (cancelled) return;
      setBarHeights(prev => { const n = [...prev]; n[2] = Math.round(stageH * STAGE_HEIGHT_PCT[2]); return n; });
      await delay(500);
      if (cancelled) return;
      setShowAvatars(prev => { const n = [...prev]; n[2] = true; return n; });

      // 2nd bar
      await delay(1000);
      if (cancelled) return;
      setBarHeights(prev => { const n = [...prev]; n[1] = Math.round(stageH * STAGE_HEIGHT_PCT[1]); return n; });
      await delay(500);
      if (cancelled) return;
      setShowAvatars(prev => { const n = [...prev]; n[1] = true; return n; });

      // 1st bar + confetti
      await delay(1100);
      if (cancelled) return;
      setBarHeights(prev => { const n = [...prev]; n[0] = Math.round(stageH * STAGE_HEIGHT_PCT[0]); return n; });
      spawnConfetti();
      await delay(600);
      if (cancelled) return;
      setShowAvatars(prev => { const n = [...prev]; n[0] = true; return n; });

      await delay(800);
      if (!cancelled) setShowContinue(true);
    }
    reveal();
    return () => { cancelled = true; };
  }, []);

  // Layout: 2nd left, 1st center, 3rd right (Kahoot style)
  const layoutOrder = [
    { idx: 1, barClass: 'bar-2', heightIdx: 1 },
    { idx: 0, barClass: 'bar-1', heightIdx: 0 },
    { idx: 2, barClass: 'bar-3', heightIdx: 2 },
  ];

  return (
    <StarfieldBackground nebTarget={[20, 10, 55]}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', padding: 'clamp(16px,3vh,32px) 24px clamp(8px,1.5vh,16px)' }}>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
            Después de
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, color: '#fff' }}>
            {stageName}
          </div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 'clamp(28px,5vw,60px)', fontWeight: 900, color: '#fff', letterSpacing: 3, textTransform: 'uppercase', textShadow: '0 0 40px rgba(192,38,211,0.6),0 0 80px rgba(124,58,237,0.3)' }}>
            Clasifi<span style={{ color: '#f59e0b' }}>cación</span>
          </div>
        </div>

        {/* 4th and 5th */}
        {rest.length > 0 && (
          <div style={{ display: 'flex', gap: 10, padding: '0 24px', marginBottom: 'clamp(8px,1.5vh,16px)', flexWrap: 'wrap', justifyContent: 'center' }}>
            {rest.map((t, i) => (
              <div key={t.team_id} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
                padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 180,
                opacity: showLower[i] ? 1 : 0,
                transform: showLower[i] ? 'none' : 'translateX(40px)',
                transition: 'opacity 0.55s ease, transform 0.55s cubic-bezier(0.22,1,0.36,1)',
              }}>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900, color: 'rgba(255,255,255,0.25)', width: 24, textAlign: 'center' }}>
                  {i + 4}
                </div>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.team_color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 14, fontWeight: 600, color: '#fff' }}>{t.team_name}</div>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{t.tokens_total.toLocaleString()} pts</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Podium bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', flex: 1, width: '100%', padding: '0 clamp(16px,4vw,60px)', gap: 'clamp(4px,1vw,12px)' }}>
          {layoutOrder.map(({ idx, barClass, heightIdx }) => {
            const t = top3[idx];
            if (!t) return null;
            const rank = idx + 1;
            return (
              <div key={t.team_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 'clamp(100px,22vw,200px)' }}>
                {rank === 1 && (
                  <div style={{ fontSize: 'clamp(16px,2.5vw,26px)', marginBottom: 2, opacity: showAvatars[idx] ? 1 : 0, transform: showAvatars[idx] ? 'none' : 'translateY(8px) scale(0.5)', transition: 'opacity 0.5s ease, transform 0.6s cubic-bezier(0.34,1.8,0.64,1)' }}>
                    👑
                  </div>
                )}
                <div style={{
                  width: 'clamp(50px,7vw,72px)', height: 'clamp(50px,7vw,72px)', borderRadius: '50%',
                  background: t.team_color, border: '3px solid rgba(255,255,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'clamp(20px,3vw,30px)', marginBottom: 6,
                  opacity: showAvatars[idx] ? 1 : 0,
                  transform: showAvatars[idx] ? 'none' : 'translateY(24px) scale(0.7)',
                  transition: 'opacity 0.6s ease, transform 0.7s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  🚀
                </div>
                <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 'clamp(11px,1.1vw,14px)', fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 2, whiteSpace: 'nowrap', opacity: showAvatars[idx] ? 1 : 0, transition: 'opacity 0.4s ease' }}>
                  {t.team_name}
                </div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 'clamp(10px,1vw,12px)', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6, opacity: showAvatars[idx] ? 1 : 0, transition: 'opacity 0.4s ease 0.1s' }}>
                  {t.tokens_total.toLocaleString()} pts
                </div>
                <div className={`pd-bar ${barClass}`} style={{ height: barHeights[heightIdx] }}>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 'clamp(22px,3.5vw,40px)', fontWeight: 900, color: 'rgba(255,255,255,0.25)' }}>
                    {rank}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Continue button */}
        <div style={{ position: 'relative', zIndex: 2, margin: 'clamp(10px,2vh,20px) 0 clamp(16px,3vh,30px)' }}>
          <button
            className="btn-galactic-primary"
            onClick={onContinue}
            style={{
              opacity: showContinue ? 1 : 0,
              transform: showContinue ? 'none' : 'translateY(16px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
              pointerEvents: showContinue ? 'all' : 'none',
            }}
          >
            Continuar →
          </button>
        </div>

      </div>
    </StarfieldBackground>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/PodiumScreen.tsx
git commit -m "feat: add animated PodiumScreen component for stage results"
```

---

## Task 5: Restyle TabletVideoInstitucional

**Files:**
- Modify: `frontend/src/pages/tablets/etapa1/VideoInstitucional.tsx`

Replace the JSX return (lines 154–208). All logic above the `return` stays identical.

- [ ] **Step 1: Add imports at top of file**

After the existing imports, add:
```tsx
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';
```

- [ ] **Step 2: Replace the loading state JSX**

Find:
```tsx
if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
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

- [ ] **Step 3: Replace the main return JSX**

Find and replace the entire `return (...)` block (from `return (` to the final `);`):
```tsx
return (
  <GalacticPage>
    {/* Title */}
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div className="galactic-label" style={{ marginBottom: 8 }}>Planeta 1 · Etapa Inicial</div>
      <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(20px,3vw,32px)', fontWeight: 700, color: '#fff', letterSpacing: 2, textShadow: '0 0 20px rgba(192,38,211,0.5)' }}>
        Como la UDD apoya el emprendimiento
      </h1>
    </div>

    {/* Video card */}
    <GlassCard className="flex-1 flex flex-col overflow-hidden" style={{ maxWidth: 900, margin: '0 auto', width: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 300, overflow: 'hidden', borderRadius: 12, background: '#000' }}>
        <iframe
          src={`${selectedVideo}?autoplay=0&mute=0&controls=1&rel=0&modestbranding=1`}
          title="Video Institucional UDD"
          style={{ width: '100%', height: '100%', minHeight: 300 }}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </GlassCard>

    {/* Waiting message */}
    <div style={{ textAlign: 'center', marginTop: 24 }}>
      <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, animation: 'pulse 2s ease-in-out infinite' }}>
        Esperando a que el profesor inicie la Etapa 1...
      </p>
    </div>
  </GalacticPage>
);
```

- [ ] **Step 4: Open `http://localhost:5173` and join as a tablet — verify VideoInstitucional renders the galactic theme**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/tablets/etapa1/VideoInstitucional.tsx
git commit -m "feat: restyle TabletVideoInstitucional with galactic theme"
```

---

## Task 6: Restyle TabletInstructivo

**Files:**
- Modify: `frontend/src/pages/tablets/etapa1/Instructivo.tsx`

Same pattern as VideoInstitucional — replace wrapper and UI blocks, keep all logic.

- [ ] **Step 1: Add imports**

```tsx
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';
```

- [ ] **Step 2: Replace loading state**

```tsx
if (loading) {
  return (
    <GalacticPage className="items-center justify-center">
      <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
    </GalacticPage>
  );
}
```

- [ ] **Step 3: Replace main return**

```tsx
return (
  <GalacticPage>
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div className="galactic-label" style={{ marginBottom: 8 }}>Planeta 1 · Instrucciones</div>
      <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(20px,3vw,32px)', fontWeight: 700, color: '#fff', letterSpacing: 2, textShadow: '0 0 20px rgba(192,38,211,0.5)' }}>
        Instructivo del Juego
      </h1>
    </div>

    <GlassCard className="flex-1 flex flex-col overflow-hidden" style={{ maxWidth: 900, margin: '0 auto', width: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 300, overflow: 'hidden', borderRadius: 12, background: '#000' }}>
        {videoUrl ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoUrl}?autoplay=0&controls=1&rel=0`}
            title="Instructivo del Juego"
            style={{ width: '100%', height: '100%', minHeight: 300 }}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, color: 'rgba(255,255,255,0.4)', fontFamily: "'Exo 2',sans-serif", fontSize: 16 }}>
            Video próximamente
          </div>
        )}
      </div>
    </GlassCard>

    <div style={{ textAlign: 'center', marginTop: 24 }}>
      <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, animation: 'pulse 2s ease-in-out infinite' }}>
        Esperando a que el profesor inicie la Etapa 1...
      </p>
    </div>
  </GalacticPage>
);
```

- [ ] **Step 4: Verify in browser**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/tablets/etapa1/Instructivo.tsx
git commit -m "feat: restyle TabletInstructivo with galactic theme"
```

---

## Task 7: Restyle TabletPersonalizacion

**Files:**
- Modify: `frontend/src/pages/tablets/etapa1/Personalizacion.tsx`

This page has a `from-[#093c92] via-blue-600 to-[#f757ac]` gradient background. Replace with `GalacticPage`. The form inputs and toggle buttons need galactic styling.

- [ ] **Step 1: Add imports**

```tsx
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';
```

- [ ] **Step 2: Replace loading state — find and replace**

Find the loading state `return` (which uses the gradient background) and replace with:
```tsx
if (loading) {
  return (
    <GalacticPage className="items-center justify-center">
      <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
    </GalacticPage>
  );
}
```

- [ ] **Step 3: Replace the outer wrapper**

Find the outermost div that sets the gradient background (e.g., `className="min-h-screen bg-gradient-to-b from-[#093c92]..."`) and replace the entire return with:

```tsx
return (
  <GalacticPage>
    {/* Header row: team badge + tokens + timer */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: team?.color || '#c026d3' }} />
        <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>
          {team?.name || 'Mi Equipo'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="glass-card" style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: '#fbbf24' }}>
            ⭐ {team?.tokens_total ?? 0}
          </span>
        </div>
        {timerRemaining !== '--:--' && (
          <div className="glass-card" style={{ padding: '6px 16px' }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 14, color: '#fff' }}>
              ⏱ {timerRemaining}
            </span>
          </div>
        )}
      </div>
    </div>

    {/* Main form card */}
    <GlassCard style={{ maxWidth: 560, margin: '0 auto', width: '100%', padding: '28px 28px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div className="galactic-label" style={{ marginBottom: 8 }}>Personalización</div>
        <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 'clamp(18px,3vw,26px)', fontWeight: 700, color: '#fff', textShadow: '0 0 20px rgba(192,38,211,0.5)' }}>
          Funda tu Start-up
        </h2>
      </div>

      {/* Startup name input */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 8 }}>
          Nombre de la Start-up
        </label>
        <input
          type="text"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          maxLength={100}
          placeholder="Rocket Labs, Alpha Solutions..."
          disabled={submitted}
          style={{
            width: '100%', padding: '14px 16px',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 10, color: '#fff', fontSize: 16,
            fontFamily: "'Exo 2',sans-serif", outline: 'none',
          }}
        />
      </div>

      {/* Know each other toggle */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 12 }}>
          ¿El equipo ya se conoce?
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { value: true, label: '✋ Ya nos conocemos' },
            { value: false, label: '👋 No nos conocemos' },
          ].map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => !submitted && setKnowEachOther(opt.value)}
              disabled={submitted}
              style={{
                flex: 1, padding: '12px 8px',
                fontFamily: "'Exo 2',sans-serif", fontSize: 14, fontWeight: 600,
                border: `2px solid ${knowEachOther === opt.value ? '#c026d3' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: 10, cursor: submitted ? 'default' : 'pointer',
                background: knowEachOther === opt.value ? 'rgba(192,38,211,0.15)' : 'rgba(255,255,255,0.05)',
                color: knowEachOther === opt.value ? '#fff' : 'rgba(255,255,255,0.6)',
                transition: 'all 0.2s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit button */}
      <button
        className="btn-galactic-primary"
        style={{ width: '100%', fontSize: 14 }}
        onClick={handleSubmit}
        disabled={submitted || !teamName.trim() || knowEachOther === null}
      >
        {submitted ? '✓ Entregado' : 'FUNDAR STARTUP'}
      </button>
    </GlassCard>

    {/* Keep existing UBot modal unchanged */}
    {showUBotModal && <UBotPersonalizacionModal onClose={() => setShowUBotModal(false)} />}
  </GalacticPage>
);
```

> **Note:** Keep all existing state variables (`teamName`, `knowEachOther`, `submitted`, `timerRemaining`, `team`, `showUBotModal`) and all handlers (`handleSubmit`, etc.) exactly as they are. Only the JSX return changes.

- [ ] **Step 4: Verify the form renders and submits correctly in browser**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/tablets/etapa1/Personalizacion.tsx
git commit -m "feat: restyle TabletPersonalizacion with galactic theme"
```

---

## Task 8: Restyle TabletMinijuego

**Files:**
- Modify: `frontend/src/pages/tablets/etapa1/Minijuego.tsx`

This page renders `WordSearchGame`, `AnagramGame`, and `GeneralKnowledgeQuiz` based on `currentPart` state. Only the outer wrapper and header change; the game subcomponents are wrapped in galactic containers.

- [ ] **Step 1: Add imports**

```tsx
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';
```

- [ ] **Step 2: Replace loading state**

```tsx
if (loading) {
  return (
    <GalacticPage className="items-center justify-center">
      <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
    </GalacticPage>
  );
}
```

- [ ] **Step 3: Replace the outermost return wrapper**

Find the outermost `<div className="min-h-screen bg-gradient-to-b ...">` wrapper and replace the entire outer structure, keeping the subcomponent renders (`<WordSearchGame .../>`, `<AnagramGame .../>`, `<GeneralKnowledgeQuiz .../>`) in place:

```tsx
return (
  <GalacticPage padding="p-4 md:p-6">
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: team?.color || '#c026d3' }} />
        <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 16, fontWeight: 700, color: '#fff' }}>
          {personalization?.team_name || team?.name || 'Mi Equipo'}
        </span>
      </div>
      <div className="glass-card" style={{ padding: '6px 14px' }}>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: '#fbbf24' }}>
          ⭐ {team?.tokens_total ?? 0}
        </span>
      </div>
    </div>

    {/* Activity label */}
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <div className="galactic-label" style={{ marginBottom: 4 }}>
        {currentPart === 'word_search' ? 'Sopa de Letras' : currentPart === 'anagram' ? 'Anagrama' : 'Conocimiento General'}
      </div>
    </div>

    {/* Game content — keep existing subcomponent renders unchanged */}
    <GlassCard style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
      {currentPart === 'word_search' && (
        <WordSearchGame {/* ...keep all existing props */} />
      )}
      {currentPart === 'anagram' && (
        <AnagramGame {/* ...keep all existing props */} />
      )}
      {currentPart === 'general_knowledge' && (
        <GeneralKnowledgeQuiz {/* ...keep all existing props */} />
      )}
    </GlassCard>

    {/* Keep existing UBot modal unchanged */}
    {showUBotModal && <UBotMinijuegoModal onClose={() => setShowUBotModal(false)} />}
  </GalacticPage>
);
```

> **Note:** Do not change any props passed to `WordSearchGame`, `AnagramGame`, or `GeneralKnowledgeQuiz`. Do not change any state or handlers. Only the wrapper structure changes.

- [ ] **Step 4: Verify the minigame renders and all three parts work correctly in browser**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/tablets/etapa1/Minijuego.tsx
git commit -m "feat: restyle TabletMinijuego with galactic theme"
```

---

## Task 9: Restyle TabletPresentacion

**Files:**
- Modify: `frontend/src/pages/tablets/etapa1/Presentacion.tsx`

Same structural approach as Minijuego — replace the outer wrapper, keep all subcomponent renders and logic intact. This file has three parts: `presentation`, `chaos`, and `general_knowledge`.

- [ ] **Step 1: Add imports**

```tsx
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';
```

- [ ] **Step 2: Replace loading state**

```tsx
if (loading) {
  return (
    <GalacticPage className="items-center justify-center">
      <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
    </GalacticPage>
  );
}
```

- [ ] **Step 3: Replace outer wrapper — wrap the existing content structure**

Find the outermost `<div className="min-h-screen bg-gradient-to-b ...">` and its direct children structure. Replace the outer wrapper and header section only:

```tsx
return (
  <GalacticPage padding="p-4 md:p-6">
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: team?.color || '#c026d3' }} />
        <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 16, fontWeight: 700, color: '#fff' }}>
          {personalization?.team_name || team?.name || 'Mi Equipo'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div className="glass-card" style={{ padding: '6px 14px' }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: '#fbbf24' }}>
            ⭐ {team?.tokens_total ?? 0}
          </span>
        </div>
        {timerRemaining !== '--:--' && (
          <div className="glass-card" style={{ padding: '6px 14px' }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: '#fff' }}>
              ⏱ {timerRemaining}
            </span>
          </div>
        )}
      </div>
    </div>

    {/* Activity subtitle */}
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <div className="galactic-label" style={{ marginBottom: 4 }}>
        {currentPart === 'presentation' ? 'Registro de Socios' : currentPart === 'chaos' ? 'Preguntas del Caos' : 'Conocimiento General'}
      </div>
    </div>

    {/* Part content wrapped in glass card */}
    <GlassCard style={{ flex: 1, padding: 20 }}>
      {/* Keep ALL existing part rendering JSX here exactly as-is */}
      {currentPart === 'presentation' && (
        /* existing presentation JSX unchanged */
      )}
      {currentPart === 'chaos' && (
        /* existing chaos JSX unchanged */
      )}
      {currentPart === 'general_knowledge' && (
        <GeneralKnowledgeQuiz {/* ...keep all existing props */} />
      )}
    </GlassCard>

    {showUBotModal && <UBotPresentacionModal onClose={() => setShowUBotModal(false)} />}
  </GalacticPage>
);
```

> **Note:** The inner JSX for each `currentPart` block stays completely unchanged. Only the outermost wrapper and the shared header/subtitle are replaced.

- [ ] **Step 4: Verify all three presentation parts render correctly in browser**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/tablets/etapa1/Presentacion.tsx
git commit -m "feat: restyle TabletPresentacion with galactic theme"
```

---

## Task 10: Restyle TabletResultados with PodiumScreen

**Files:**
- Modify: `frontend/src/pages/tablets/etapa1/Resultados.tsx`

The current page uses `StarfieldBackground` already but renders a basic leaderboard. Replace it with `PodiumScreen` once data is loaded.

- [ ] **Step 1: Add import**

```tsx
import { PodiumScreen } from '@/components/PodiumScreen';
```

Remove the import of `Leaderboard` if present (it is replaced by PodiumScreen).

- [ ] **Step 2: Replace loading state**

```tsx
if (loading) {
  return (
    <StarfieldBackground>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
      </div>
    </StarfieldBackground>
  );
}
```

- [ ] **Step 3: Replace main return**

Find the main `return (...)` and replace with:

```tsx
return (
  <>
    <Confetti />
    <PodiumScreen
      teams={results?.teams_results ?? []}
      stageName={results?.stage_name ?? 'Trabajo en Equipo'}
      onContinue={() => {
        /* existing navigation logic — e.g. navigate to next stage or lobby */
        /* keep whatever navigate/redirect logic was already here */
      }}
    />
    {showUBotModal && <UBotResultadosModal onClose={() => setShowUBotModal(false)} />}
  </>
);
```

> **Note:** The `onContinue` callback should contain whatever navigation or redirect was previously triggered by the "continue" button in the old results page. Keep that logic exactly the same.

- [ ] **Step 4: Verify podium animates correctly with real team data in browser**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/tablets/etapa1/Resultados.tsx
git commit -m "feat: replace TabletResultados leaderboard with animated PodiumScreen"
```

---

## Task 11: Restyle ProfesorVideoInstitucional

**Files:**
- Modify: `frontend/src/pages/profesor/etapa1/VideoInstitucional.tsx`

Mission control layout: top bar + video card + advance button. All logic unchanged.

- [ ] **Step 1: Add imports**

```tsx
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';
```

- [ ] **Step 2: Replace loading state**

```tsx
if (loading) {
  return (
    <GalacticPage className="items-center justify-center">
      <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
    </GalacticPage>
  );
}
```

- [ ] **Step 3: Replace main return**

```tsx
return (
  <GalacticPage>
    {/* Top bar */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div>
        <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 1</div>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 28, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
          Trabajo en Equipo
        </div>
      </div>
      <div className="galactic-badge" style={{ fontSize: 13 }}>Video Institucional</div>
    </div>

    {/* Video */}
    <GlassCard style={{ flex: 1, padding: 16, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', background: '#000', minHeight: 320 }}>
        <iframe
          src={`${selectedVideo}?autoplay=0&controls=1&rel=0&modestbranding=1`}
          title="Video Institucional"
          style={{ width: '100%', height: '100%', minHeight: 320 }}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </GlassCard>

    {/* Actions */}
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
      <button className="btn-galactic-primary" onClick={handleAdvance} disabled={advancing}>
        {advancing ? 'Avanzando...' : 'Avanzar Actividad ▶'}
      </button>
    </div>
  </GalacticPage>
);
```

> **Note:** `selectedVideo`, `handleAdvance`, `advancing` are existing state/handlers — keep them as-is.

- [ ] **Step 4: Verify in browser as professor**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/profesor/etapa1/VideoInstitucional.tsx
git commit -m "feat: restyle ProfesorVideoInstitucional with mission control theme"
```

---

## Task 12: Restyle ProfesorInstructivo

**Files:**
- Modify: `frontend/src/pages/profesor/etapa1/Instructivo.tsx`

Same structure as ProfesorVideoInstitucional.

- [ ] **Step 1: Add imports**

```tsx
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';
```

- [ ] **Step 2: Replace loading state** (identical pattern to Task 11 Step 2)

- [ ] **Step 3: Replace main return**

```tsx
return (
  <GalacticPage>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div>
        <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 1</div>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 28, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
          Trabajo en Equipo
        </div>
      </div>
      <div className="galactic-badge" style={{ fontSize: 13 }}>Instructivo</div>
    </div>

    <GlassCard style={{ flex: 1, padding: 16, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', background: '#000', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {videoUrl ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoUrl}?autoplay=0&controls=1&rel=0`}
            title="Instructivo del Juego"
            style={{ width: '100%', height: '100%', minHeight: 320 }}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <p style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>
            Video próximamente
          </p>
        )}
      </div>
    </GlassCard>

    <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
      <button className="btn-galactic-primary" onClick={handleAdvance} disabled={advancing}>
        {advancing ? 'Avanzando...' : 'Avanzar Actividad ▶'}
      </button>
    </div>
  </GalacticPage>
);
```

- [ ] **Step 4: Verify in browser**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/profesor/etapa1/Instructivo.tsx
git commit -m "feat: restyle ProfesorInstructivo with mission control theme"
```

---

## Task 13: Restyle ProfesorPersonalizacion (full mission control)

**Files:**
- Modify: `frontend/src/pages/profesor/etapa1/Personalizacion.tsx`

This is the main mission control layout matching the approved mockup (v4). It shows the big timer, stats, and team status grid.

- [ ] **Step 1: Add imports**

```tsx
import { GalacticPage } from '@/components/GalacticPage';
import { TimerBlock } from '@/components/TimerBlock';
```

- [ ] **Step 2: Replace loading state**

```tsx
if (loading) {
  return (
    <GalacticPage className="items-center justify-center">
      <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
    </GalacticPage>
  );
}
```

- [ ] **Step 3: Replace main return**

```tsx
const submittedCount = Object.values(personalizations).filter(p => p.team_name).length;

return (
  <GalacticPage>
    {/* Top bar */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
      <div>
        <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 1</div>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 30, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
          Trabajo en Equipo
        </div>
      </div>
      <div className="galactic-badge">Actividad 1</div>
    </div>

    {/* Big timer */}
    <TimerBlock timerRemaining={timerRemaining} activityName="Personalización de Equipo" />

    {/* Stats row */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 22 }}>
      {[
        { label: 'Equipos Listos', value: `${submittedCount} / ${teams.length}`, sub: 'han enviado nombre' },
        { label: 'Actividad Actual', value: 'Personalización', sub: 'nombre + relación del equipo', valueStyle: { fontSize: 20, color: '#d946ef' } },
        { label: 'Código de Sala', value: gameSession?.room_code ?? '--', sub: 'para unirse', valueStyle: { fontSize: 28, letterSpacing: 4 } },
      ].map(card => (
        <div key={card.label} className="glass-card" style={{ padding: '20px 24px' }}>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>{card.label}</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#fff', ...card.valueStyle }}>
            {card.value}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            {card.sub}
          </div>
        </div>
      ))}
    </div>

    {/* Team status grid */}
    <div style={{ marginTop: 22 }}>
      <div className="galactic-label" style={{ marginBottom: 12 }}>Estado de los equipos</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
        {teams.map(team => {
          const p = personalizations[team.id];
          const done = Boolean(p?.team_name);
          return (
            <div key={team.id} className="glass-card" style={{ padding: '16px 18px', borderColor: done ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.12)', background: done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', flex: 1 }}>
                  {p?.team_name || team.name}
                </span>
                <span style={{ fontSize: 18 }}>{done ? '✅' : ''}</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: done ? '100%' : '0%', background: 'linear-gradient(90deg,#7c3aed,#c026d3)', borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 600, color: done ? '#34d399' : 'rgba(255,255,255,0.5)' }}>
                {done
                  ? `Entregado · ${p.team_members_know_each_other ? 'Ya se conocen' : 'No se conocen'}`
                  : 'Esperando...'}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Actions */}
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24, paddingBottom: 8 }}>
      <button className="btn-galactic-secondary" onClick={() => { /* existing cancel logic */ }}>
        Cancelar Sesión
      </button>
      <button className="btn-galactic-primary" onClick={handleAdvance} disabled={advancing}>
        {advancing ? 'Avanzando...' : 'Avanzar Actividad ▶'}
      </button>
    </div>

    {showEtapaIntro && <EtapaIntroModal onClose={() => { /* existing close logic */ }} />}
  </GalacticPage>
);
```

> **Note:** `timerRemaining`, `teams`, `personalizations`, `gameSession`, `advancing`, `handleAdvance`, `showEtapaIntro` are all existing state — keep every declaration and handler exactly as-is.

- [ ] **Step 4: Verify all team cards update in real time in browser**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/profesor/etapa1/Personalizacion.tsx
git commit -m "feat: restyle ProfesorPersonalizacion with mission control dashboard"
```

---

## Task 14: Restyle ProfesorPresentacion

**Files:**
- Modify: `frontend/src/pages/profesor/etapa1/Presentacion.tsx`

Same mission control layout — top bar, timer, stats, team progress, actions.

- [ ] **Step 1: Add imports**

```tsx
import { GalacticPage } from '@/components/GalacticPage';
import { TimerBlock } from '@/components/TimerBlock';
```

- [ ] **Step 2: Replace loading state** (same pattern as Task 13 Step 2)

- [ ] **Step 3: Replace main return**

```tsx
const completedCount = teams.filter(t => {
  const p = teamActivityProgress[t.id];
  return p?.status === 'completed' || p?.status === 'submitted';
}).length;

return (
  <GalacticPage>
    {/* Top bar */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
      <div>
        <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 1</div>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 30, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
          Trabajo en Equipo
        </div>
      </div>
      <div className="galactic-badge">Actividad 2</div>
    </div>

    <TimerBlock timerRemaining={timerRemaining} activityName="Presentación de Equipo" />

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 22 }}>
      {[
        { label: 'Equipos Listos', value: `${completedCount} / ${teams.length}`, sub: 'han completado' },
        { label: 'Actividad Actual', value: 'Presentación', sub: 'presentación + preguntas', valueStyle: { fontSize: 20, color: '#d946ef' } },
        { label: 'Código de Sala', value: gameSession?.room_code ?? '--', sub: 'para unirse', valueStyle: { letterSpacing: 4 } },
      ].map(card => (
        <div key={card.label} className="glass-card" style={{ padding: '20px 24px' }}>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>{card.label}</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#fff', ...card.valueStyle }}>
            {card.value}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            {card.sub}
          </div>
        </div>
      ))}
    </div>

    <div style={{ marginTop: 22 }}>
      <div className="galactic-label" style={{ marginBottom: 12 }}>Progreso de equipos</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
        {teams.map(team => {
          const prog = teamActivityProgress[team.id];
          const done = prog?.status === 'completed' || prog?.status === 'submitted';
          const pct = prog?.progress_percentage ?? 0;
          const p = personalizations[team.id];
          return (
            <div key={team.id} className="glass-card" style={{ padding: '16px 18px', borderColor: done ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.12)', background: done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', flex: 1 }}>
                  {p?.team_name || team.name}
                </span>
                {done && <span style={{ fontSize: 18 }}>✅</span>}
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#7c3aed,#c026d3)', borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 600, color: done ? '#34d399' : 'rgba(255,255,255,0.5)' }}>
                {done ? 'Completado' : `${pct}% completado`}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24, paddingBottom: 8 }}>
      <button className="btn-galactic-secondary" onClick={() => { /* existing cancel logic */ }}>
        Cancelar Sesión
      </button>
      <button className="btn-galactic-primary" onClick={handleAdvance} disabled={advancing}>
        {advancing ? 'Avanzando...' : 'Avanzar Actividad ▶'}
      </button>
    </div>
  </GalacticPage>
);
```

- [ ] **Step 4: Verify in browser — team progress bars update as tablets complete activities**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/profesor/etapa1/Presentacion.tsx
git commit -m "feat: restyle ProfesorPresentacion with mission control dashboard"
```

---

## Task 15: Restyle ProfesorResultados

**Files:**
- Modify: `frontend/src/pages/profesor/etapa1/Resultados.tsx`

Mission control results view — shows the stage summary and a "go to next stage" button.

- [ ] **Step 1: Add imports**

```tsx
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';
import { Confetti } from '@/components/Confetti';
```

- [ ] **Step 2: Replace loading state**

```tsx
if (loading) {
  return (
    <GalacticPage className="items-center justify-center">
      <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
    </GalacticPage>
  );
}
```

- [ ] **Step 3: Replace main return**

```tsx
const sorted = [...(results?.teams_results ?? [])].sort((a, b) => b.tokens_total - a.tokens_total);

return (
  <GalacticPage>
    <Confetti />

    {/* Top bar */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
      <div>
        <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Fin de Etapa 1</div>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 28, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
          Resultados · Trabajo en Equipo
        </div>
      </div>
      <div className="galactic-badge">Clasificación</div>
    </div>

    {/* Leaderboard */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
      {sorted.map((t, i) => (
        <GlassCard key={t.team_id} style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 24, fontWeight: 900, color: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#d97706' : 'rgba(255,255,255,0.25)', width: 36, textAlign: 'center' }}>
            {i + 1}
          </div>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.team_color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>{t.team_name}</div>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
              {t.tokens_stage} pts esta etapa
            </div>
          </div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 700, color: '#fbbf24' }}>
            {t.tokens_total.toLocaleString()}
          </div>
        </GlassCard>
      ))}
    </div>

    {/* Actions */}
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, paddingBottom: 8 }}>
      <button className="btn-galactic-secondary" onClick={() => { /* existing cancel logic */ }}>
        Cancelar Sesión
      </button>
      <button className="btn-galactic-primary" onClick={handleAdvance} disabled={advancing}>
        {advancing ? 'Avanzando...' : 'Ir a Etapa 2 ▶'}
      </button>
    </div>
  </GalacticPage>
);
```

- [ ] **Step 4: Walk through the full Phase 1 flow in browser from start to results and verify all pages**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/profesor/etapa1/Resultados.tsx
git commit -m "feat: restyle ProfesorResultados with mission control theme"
```

---

## Verification Checklist

- [ ] Run `npm run build` from `frontend/` — zero TypeScript errors
- [ ] Walk tablet flow: Join → VideoInstitucional → Instructivo → Personalizacion → Minijuego or Presentacion → Resultados (podium animates)
- [ ] Walk professor flow: VideoInstitucional → Instructivo → Personalizacion → Presentacion → Resultados
- [ ] Timer warn state (orange twinkle) triggers at ≤30s on professor views
- [ ] Timer danger state (red rapid pulse) triggers at ≤10s on professor views
- [ ] Podium bars grow in correct order (5th → 4th → 3rd → 2nd → 1st) with confetti on 1st
- [ ] All API calls, routing, and polling work identically to before the redesign
- [ ] Phases 2–4 pages are visually unchanged (spot-check one page from each)
