# Etapa 4 Pitch — Full Galactic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully redesign `FormularioPitch.tsx` and `PresentacionPitch.tsx` to match the galactic visual spec from "Fase 4 - Pitch (1).html" — dark `#050818` background, Orbitron/Exo 2 fonts, glassmorphism cards, animated icons — while preserving all existing business logic.

**Architecture:** Both files keep all existing state, polling, timer, auto-save, and redirect logic unchanged. Only the JSX/styling is replaced. `FormularioPitch.tsx` gains a sticky galactic top bar (persona + prototype pills, timer) and 5 pitch boxes with colored left borders. `PresentacionPitch.tsx` replaces the persistent white header with per-state full-screen layouts matching the HTML spec.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (utility classes mixed with inline styles for font families), Framer Motion (loading/error only), `StarField` component from `../etapa2/StarField`, Orbitron + Exo 2 (already loaded in `index.html`).

---

## Files Modified

| File | Change |
|---|---|
| `frontend/src/pages/tablets/etapa4/FormularioPitch.tsx` | Full JSX rewrite — imports, constants, state, loading fn, return |
| `frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx` | Full JSX rewrite — imports, constants, per-state screens |

---

## Task 1: FormularioPitch — Update Imports and Add Constants

**Files:**
- Modify: `frontend/src/pages/tablets/etapa4/FormularioPitch.tsx:1-12`

- [ ] **Step 1: Replace the import block (lines 1–12) with the following**

```tsx
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { UBotFormularioPitchModal } from '@/components/UBotFormularioPitchModal';
import StarField from '../etapa2/StarField';
import {
  sessionsAPI, tabletConnectionsAPI, teamActivityProgressAPI, challengesAPI,
} from '@/services';
import { getResultsRedirectUrl } from '@/utils/tabletResultsRedirect';
import { advanceActivityOnTimerExpiration } from '@/utils/timerAutoAdvance';
import { toast } from 'sonner';
```

- [ ] **Step 2: After the last import line, add the CSS constant and BOX_CONFIG**

```tsx
const GALACTIC_CSS = `
@keyframes phPulse{0%,100%{opacity:1}50%{opacity:.55}}
`;

const BOX_CONFIG = [
  {
    key: 'dolor', field: 'intro_problem' as const, emoji: '💥', n: '01',
    tag: 'MOVIMIENTO 1', title: 'El Dolor', color: '#ef4444',
    helper: 'Describe el problema desde la perspectiva de tu persona.',
    example: 'Ej: "Martina pasa horas buscando comida saludable pero solo encuentra opciones caras."',
  },
  {
    key: 'rescate', field: 'solution' as const, emoji: '🚀', n: '02',
    tag: 'MOVIMIENTO 2', title: 'El Rescate', color: '#3b82f6',
    helper: 'Explica tu solución y cómo funciona.',
    example: 'Ej: "Creamos una app que conecta comedores saludables en 3 clics."',
  },
  {
    key: 'diferencia', field: 'value' as const, emoji: '✨', n: '03',
    tag: 'MOVIMIENTO 3', title: 'Diferencia', color: '#c026d3',
    helper: '¿Qué hace única a tu solución frente a lo que existe?',
    example: 'Ej: "A diferencia de UberEats, filtramos solo por criterios de salud certificados."',
  },
  {
    key: 'futuro', field: 'impact' as const, emoji: '🌅', n: '04',
    tag: 'MOVIMIENTO 4', title: 'El Futuro', color: '#10b981',
    helper: 'Impacto y escalabilidad de tu propuesta.',
    example: 'Ej: "En 2 años, podemos llegar a 50.000 usuarios en 5 ciudades."',
  },
  {
    key: 'cierre', field: 'closing' as const, emoji: '🎯', n: '05',
    tag: 'MOVIMIENTO 5', title: 'Golpe Final', color: '#f59e0b',
    helper: 'Un cierre memorable que quede grabado en la mente.',
    example: 'Ej: "Porque la salud no debería ser un privilegio. ¿Nos acompañan?"',
  },
] as const;
```

- [ ] **Step 3: Run build to verify no TypeScript errors from import changes**

```bash
cd frontend && npm run build 2>&1 | grep "FormularioPitch"
```

Expected: no lines mentioning `FormularioPitch.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/tablets/etapa4/FormularioPitch.tsx
git commit -m "refactor(etapa4): update imports and add galactic constants to FormularioPitch"
```

---

## Task 2: FormularioPitch — Persona/Prototype State and Loading Function

**Files:**
- Modify: `frontend/src/pages/tablets/etapa4/FormularioPitch.tsx`

- [ ] **Step 1: After the line `const [view, setView] = useState<'builder' | 'preview'>('builder');`, add two new state variables**

```tsx
const [personaName, setPersonaName] = useState<string | null>(null);
const [prototypeName, setPrototypeName] = useState<string | null>(null);
```

- [ ] **Step 2: Add the loading function. Place it just before the `startTimer` function**

```tsx
const loadPersonaAndPrototype = async (teamId: number, sessionId: number) => {
  try {
    const stages = await sessionsAPI.getSessionStages(sessionId);
    const stagesArray = Array.isArray(stages) ? stages : [];

    const stage2 = stagesArray.find((s: any) => s.stage_number === 2);
    if (stage2) {
      const prog = await teamActivityProgressAPI.list({ team: teamId, session_stage: stage2.id });
      const progArray = Array.isArray(prog) ? prog : [];
      const challengeId = progArray[0]?.selected_challenge;
      if (challengeId) {
        const challenge = await challengesAPI.getChallengeById(challengeId);
        if (challenge?.persona_name) setPersonaName(challenge.persona_name);
      }
    }

    const stage3 = stagesArray.find((s: any) => s.stage_number === 3);
    if (stage3) {
      const prog = await teamActivityProgressAPI.list({ team: teamId, session_stage: stage3.id });
      const progArray = Array.isArray(prog) ? prog : [];
      const productName = progArray[0]?.response_data?.product_name;
      if (productName) setPrototypeName(productName);
    }
  } catch {
    // Silently fail — pills show '—' as fallback
  }
};
```

- [ ] **Step 3: In `loadGameState`, after `setLoading(false)` is called (near the end of the try block, after `startTimer`), add the call**

Find this line:
```tsx
setLoading(false);
```

Immediately after it add:
```tsx
void loadPersonaAndPrototype(teamData.id, statusData.game_session.id);
```

- [ ] **Step 4: Run build check**

```bash
cd frontend && npm run build 2>&1 | grep "FormularioPitch"
```

Expected: no errors in FormularioPitch.tsx.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/tablets/etapa4/FormularioPitch.tsx
git commit -m "feat(etapa4): add persona and prototype name loading to FormularioPitch"
```

---

## Task 3: FormularioPitch — Rebuild the Return Statement (Builder View)

**Files:**
- Modify: `frontend/src/pages/tablets/etapa4/FormularioPitch.tsx`

Replace everything from `if (loading) {` down to the final `}` closing of the exported function with the following complete block. The loading, team-missing, and main return are all included.

- [ ] **Step 1: Remove all JSX from `if (loading)` to end of component and replace with**

```tsx
  if (loading) {
    return (
      <div style={{ background: '#050818', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!team) {
    return (
      <div style={{ background: '#050818', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#fff', textAlign: 'center' }}>
          <p style={{ marginBottom: 16, fontFamily: "'Exo 2', sans-serif" }}>No se encontró el equipo</p>
          <button
            onClick={() => navigate('/tablet/join')}
            style={{ fontFamily: 'Orbitron, sans-serif', background: 'linear-gradient(135deg,#093c92,#c026d3)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', cursor: 'pointer' }}
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const fieldsCompleted = [pitchIntroProblem, pitchSolution, pitchValue, pitchImpact, pitchClosing].filter(v => v.trim()).length;
  const isComplete = fieldsCompleted === 5;
  const fieldValues: Record<string, string> = {
    intro_problem: pitchIntroProblem,
    solution: pitchSolution,
    value: pitchValue,
    impact: pitchImpact,
    closing: pitchClosing,
  };

  return (
    <div style={{ background: '#050818', minHeight: '100vh', fontFamily: "'Exo 2', sans-serif", position: 'relative' }}>
      <style>{GALACTIC_CSS}</style>
      <StarField />

      {/* ── Sticky top bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        padding: '10px 20px',
        background: 'linear-gradient(180deg,rgba(5,8,24,0.98) 0%,transparent 100%)',
        backdropFilter: 'blur(8px)',
      }}>
        {/* Phase badge */}
        <div style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5,
          color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.09)', borderRadius: 50, padding: '6px 18px',
          textTransform: 'uppercase',
        }}>
          Fase 4 · Pitch
        </div>

        {/* Pills + timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Persona pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 14px 6px 6px', borderRadius: 50,
            border: '1.5px solid rgba(192,38,211,0.4)', background: 'rgba(192,38,211,0.1)',
            backdropFilter: 'blur(16px)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(192,38,211,0.18)', border: '1.5px solid rgba(192,38,211,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>👤</div>
            <div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: 2.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Persona</div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, color: '#fff' }}>{personaName ?? '—'}</div>
            </div>
          </div>

          {/* Prototype pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 14px 6px 6px', borderRadius: 50,
            border: '1.5px solid rgba(59,130,246,0.4)', background: 'rgba(9,60,146,0.15)',
            backdropFilter: 'blur(16px)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(59,130,246,0.15)', border: '1.5px solid rgba(59,130,246,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>🚀</div>
            <div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: 2.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Prototipo</div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, color: '#fff' }}>{prototypeName ?? '—'}</div>
            </div>
          </div>

          {/* Timer */}
          {timerRemaining !== '--:--' && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              padding: '6px 18px', borderRadius: 16,
              background: 'rgba(192,38,211,0.06)', border: '1px solid rgba(192,38,211,0.25)',
              backdropFilter: 'blur(12px)',
            }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>TIEMPO</div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 22, fontWeight: 900, letterSpacing: 3, color: '#fff', textShadow: '0 0 40px rgba(192,38,211,0.55)', lineHeight: 1 }}>{timerRemaining}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ position: 'relative', zIndex: 10, padding: '20px 20px 130px', maxWidth: 1140, margin: '0 auto' }}>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(20px,3.2vw,30px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(192,38,211,0.5)', margin: 0 }}>
            Construyan su Pitch
          </h1>
          <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
            Completen los 5 movimientos de su presentación
          </p>
        </div>

        {/* ── Builder view ── */}
        {view === 'builder' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {BOX_CONFIG.map((box) => {
              const value = fieldValues[box.field] ?? '';
              const isDone = !!value.trim();
              const isFocused = focusedField === box.field;

              return (
                <div key={box.key} style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '16px 20px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid rgba(255,255,255,0.1)`,
                  borderLeft: `4px solid ${box.color}`,
                  borderRadius: 22, backdropFilter: 'blur(16px)', padding: '20px 22px',
                }}>
                  {/* Number cell */}
                  <div style={{
                    width: 60, height: 60, borderRadius: 16, flexShrink: 0,
                    background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${box.color}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  }}>
                    <span style={{ fontSize: 24 }}>{box.emoji}</span>
                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 900, letterSpacing: 2, color: box.color }}>{box.n}</span>
                  </div>

                  {/* Head */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: box.color }}>{box.tag}</div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(15px,2vw,20px)', fontWeight: 900, color: '#fff', letterSpacing: 1 }}>{box.title}</div>
                    <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                      {box.helper}
                      <div style={{ fontStyle: 'italic', fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>{box.example}</div>
                    </div>
                  </div>

                  {/* Textarea + foot (span column 2) */}
                  <div style={{ gridColumn: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <textarea
                      value={value}
                      onChange={(e) => handleFieldChange(box.field, e.target.value)}
                      onFocus={() => handleFieldFocus(box.field)}
                      onBlur={handleFieldBlur}
                      rows={4}
                      placeholder={box.example}
                      style={{
                        width: '100%', minHeight: 90, boxSizing: 'border-box',
                        background: 'rgba(0,0,0,0.25)', borderRadius: 14, color: '#fff',
                        fontFamily: "'Exo 2', sans-serif", fontSize: 14, fontWeight: 400,
                        padding: '12px 14px', lineHeight: 1.6, resize: 'vertical', outline: 'none',
                        border: `1.5px solid ${isFocused ? box.color : 'rgba(255,255,255,0.12)'}`,
                        boxShadow: isFocused ? `0 0 0 4px ${box.color}20` : 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: isDone ? '#10b981' : 'rgba(255,255,255,0.18)',
                          boxShadow: isDone ? '0 0 10px rgba(16,185,129,0.6)' : 'none',
                          transition: 'all 0.3s',
                        }} />
                        <span style={{ color: isDone ? '#10b981' : 'rgba(255,255,255,0.35)' }}>
                          {isDone ? 'Completado' : 'Pendiente'}
                        </span>
                      </div>
                      <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, letterSpacing: 1 }}>{value.length} car.</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Preview view ── */}
        {view === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 760, margin: '0 auto' }}>
            <button
              onClick={() => setView('builder')}
              style={{
                alignSelf: 'flex-start', display: 'inline-flex', gap: 6, fontSize: 12,
                color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Exo 2', sans-serif",
              }}
            >
              ← Editar
            </button>

            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 50, padding: '6px 20px' }}>
              Vista Previa
            </div>

            {/* Pitch card */}
            <div style={{
              width: '100%', background: 'linear-gradient(180deg,rgba(192,38,211,0.06),rgba(9,60,146,0.04))',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 26, backdropFilter: 'blur(20px)',
              padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 18,
              boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 80px rgba(192,38,211,0.12)',
            }}>
              {/* Product head */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 14, background: '#0a0e2a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>🚀</div>
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: 1.5 }}>{prototypeName ?? 'Su Prototipo'}</div>
                    <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Pitch de la Start-up</div>
                  </div>
                </div>
                {personaName && (
                  <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontFamily: "'Exo 2', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 50, padding: '6px 14px' }}>
                    👤 <span>Para {personaName}</span>
                  </div>
                )}
              </div>

              {/* 5 sections */}
              {BOX_CONFIG.map((box) => {
                const text = fieldValues[box.field] ?? '';
                return (
                  <div key={box.key} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${box.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {box.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: box.color, marginBottom: 2 }}>{box.tag}</div>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 0.5, marginBottom: 5 }}>{box.title}</div>
                      <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 14, fontWeight: 300, color: text ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.3)', lineHeight: 1.7, fontStyle: text ? 'normal' : 'italic', whiteSpace: 'pre-wrap' }}>
                        {text || 'Sin contenido'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
              <button
                onClick={() => setView('builder')}
                style={{
                  flex: 1, minWidth: 160, fontFamily: "'Exo 2', sans-serif", fontSize: 14, fontWeight: 600,
                  color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '14px 24px',
                  cursor: 'pointer',
                }}
              >
                ← Cambiar algo
              </button>
              <button
                onClick={handleSavePitch}
                disabled={saving}
                style={{
                  flex: 1, minWidth: 160, fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700,
                  letterSpacing: 3, textTransform: 'uppercase', color: '#fff',
                  background: 'linear-gradient(135deg,#093c92,#c026d3)', border: 'none', borderRadius: 12,
                  padding: '14px 24px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                  boxShadow: '0 4px 22px rgba(192,38,211,0.3)',
                }}
              >
                {saving ? 'Guardando…' : 'Entregar pitch →'}
              </button>
            </div>

            {hasSaved && (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 14, padding: '12px 24px', color: '#10b981', fontFamily: "'Exo 2', sans-serif", fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                ✓ Pitch entregado exitosamente
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Floating footer (builder only) ── */}
      {view === 'builder' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
          padding: '12px 24px 16px',
          background: 'linear-gradient(0deg,rgba(5,8,24,0.98) 0%,rgba(5,8,24,0.85) 60%,transparent 100%)',
          pointerEvents: 'none',
        }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'all' }}>
            {[pitchIntroProblem, pitchSolution, pitchValue, pitchImpact, pitchClosing].map((v, i) => (
              <div key={i} style={{
                width: 9, height: 9, borderRadius: '50%',
                background: v.trim() ? '#10b981' : 'rgba(255,255,255,0.15)',
                boxShadow: v.trim() ? '0 0 10px rgba(16,185,129,0.6)' : 'none',
                transition: 'all 0.3s',
              }} />
            ))}
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginLeft: 6 }}>
              {fieldsCompleted}/5
            </span>
          </div>

          {/* Submit button */}
          <button
            onClick={async () => { await savePitch(false); setView('preview'); }}
            disabled={!isComplete || saving}
            style={{
              pointerEvents: 'all',
              fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700,
              letterSpacing: 3, textTransform: 'uppercase', color: '#fff',
              background: 'linear-gradient(135deg,#093c92,#c026d3)',
              border: 'none', borderRadius: 12, padding: '13px 28px',
              boxShadow: '0 4px 22px rgba(192,38,211,0.3)',
              cursor: isComplete && !saving ? 'pointer' : 'not-allowed',
              opacity: isComplete && !saving ? 1 : 0.4,
              transition: 'opacity 0.2s',
            }}
          >
            {saving ? 'Guardando…' : 'Ver pitch completo →'}
          </button>
        </div>
      )}

      {/* U-Bot Modal */}
      {team && (
        <UBotFormularioPitchModal
          isOpen={showUBotModal}
          onClose={() => setShowUBotModal(false)}
          onContinuar={() => setShowUBotModal(false)}
          teamColor={team.color}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run full build check**

```bash
cd frontend && npm run build 2>&1 | grep "FormularioPitch"
```

Expected: no errors in FormularioPitch.tsx.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/tablets/etapa4/FormularioPitch.tsx
git commit -m "feat(etapa4): full galactic redesign of FormularioPitch builder and preview screens"
```

---

## Task 4: PresentacionPitch — Update Imports and Add CSS Constant

**Files:**
- Modify: `frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx:1-17`

- [ ] **Step 1: Replace the import block (lines 1–17) with**

```tsx
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Coins } from 'lucide-react';
import { UBotPresentacionPitchModal } from '@/components/UBotPresentacionPitchModal';
import StarField from '../etapa2/StarField';
import {
  sessionsAPI,
  sessionStagesAPI,
  peerEvaluationsAPI,
  tabletConnectionsAPI,
  teamPersonalizationsAPI,
} from '@/services';
import { toast } from 'sonner';
```

- [ ] **Step 2: After the last import, add the CSS constant**

```tsx
const GALACTIC_CSS = `
@keyframes micPulse{0%,100%{opacity:.5;transform:scale(.94)}50%{opacity:.95;transform:scale(1.05)}}
@keyframes micFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes hgFloat{0%,100%{transform:rotate(0deg)}50%{transform:rotate(180deg)}}
@keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}
@keyframes phPulse{0%,100%{opacity:1}50%{opacity:.55}}
`;
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | grep "PresentacionPitch"
```

Expected: no errors in PresentacionPitch.tsx.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx
git commit -m "refactor(etapa4): update imports and add galactic CSS to PresentacionPitch"
```

---

## Task 5: PresentacionPitch — Replace Background Wrapper and Loading Screens

**Files:**
- Modify: `frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx`

The goal of this task is to: (a) replace the `if (loading)` and `if (!team || !presentationStatus)` screens with the dark galactic style, and (b) replace the outer `return (...)` wrapper div (currently `<div className="relative min-h-screen overflow-hidden">` with gradient) with the dark galactic wrapper including StarField.

- [ ] **Step 1: Replace the `if (loading)` block**

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
      <div style={{ background: '#050818', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }
```

- [ ] **Step 2: Replace the `if (!team || !presentationStatus)` block**

Find:
```tsx
  if (!team || !presentationStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Cargando información de presentación...</p>
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      </div>
    );
  }
```

Replace with:
```tsx
  if (!team || !presentationStatus) {
    return (
      <div style={{ background: '#050818', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#fff', textAlign: 'center', fontFamily: "'Exo 2', sans-serif" }}>
          <p style={{ fontSize: 18, marginBottom: 16 }}>Cargando información de presentación...</p>
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Replace the outer return wrapper**

Find:
```tsx
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Fondo animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <motion.div
          animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
          transition={{ duration: 20, repeat: Infinity, repeatType: 'reverse' }}
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '50px 50px' }}
        />
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-30"
              initial={{ x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920), y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080) }}
              animate={{ y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080)], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
            />
          ))}
        </div>
      </div>


      <div className="relative z-10 p-3 sm:p-4">
      <div className="max-w-6xl mx-auto">
```

Replace with:
```tsx
  return (
    <div style={{ background: '#050818', minHeight: '100vh', fontFamily: "'Exo 2', sans-serif", position: 'relative' }}>
      <style>{GALACTIC_CSS}</style>
      <StarField />
      <div style={{ position: 'relative', zIndex: 10, padding: '24px 20px', maxWidth: 860, margin: '0 auto' }}>
```

Also find and remove the existing header card block that follows (the white card with team name and tokens):

```tsx
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 mb-4 sm:mb-6 flex items-center justify-between flex-wrap gap-4"
        >
```

Delete from that `<motion.div>` all the way to its closing `</motion.div>` (the entire white header card). The state-specific content begins immediately after.

- [ ] **Step 4: Fix the closing tags at the end of the return**

The current file ends with:
```tsx
        </div>
      </div>

      {/* Modal de U-Bot */}
      {team && (
        <UBotPresentacionPitchModal ...
```

After the header card removal, ensure the structure is:
```tsx
      </div>  {/* closes max-width div */}

      {team && (
        <UBotPresentacionPitchModal
          isOpen={showUBotModal}
          onClose={() => setShowUBotModal(false)}
          onContinuar={() => setShowUBotModal(false)}
          teamColor={team.color}
        />
      )}
    </div>  {/* closes root div */}
  );
```

- [ ] **Step 5: Build check**

```bash
cd frontend && npm run build 2>&1 | grep "PresentacionPitch"
```

Expected: no errors in PresentacionPitch.tsx.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx
git commit -m "refactor(etapa4): replace gradient background with galactic dark + StarField in PresentacionPitch"
```

---

## Task 6: PresentacionPitch — Callstage Screen (`isPreparing && isMyTurn`)

**Files:**
- Modify: `frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx`

- [ ] **Step 1: Find the `{/* Estado: Preparación */}` block and replace it entirely**

Find:
```tsx
        {/* Estado: Preparación */}
        {isPreparing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-[#093c92] via-[#764ba2] to-[#093c92] rounded-xl shadow-xl p-8 sm:p-12 md:p-16 text-center text-white relative overflow-hidden min-h-[400px] sm:min-h-[500px] flex items-center justify-center"
          >
            ...entire block...
          </motion.div>
        )}
```

Replace with:
```tsx
        {/* Estado: Llamado a Escenario */}
        {isPreparing && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 24, textAlign: 'center' }}>
            {/* Badge */}
            <div style={{
              fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5,
              color: '#f97316', background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.3)', borderRadius: 50, padding: '6px 20px',
              textTransform: 'uppercase', animation: 'phPulse 1.4s ease-in-out infinite',
            }}>
              ⚠ Llamado urgente
            </div>

            {/* Mic animation */}
            <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'radial-gradient(circle,rgba(249,115,22,0.5) 0%,transparent 65%)',
                filter: 'blur(18px)', animation: 'micPulse 2.4s ease-in-out infinite',
              }} />
              <div style={{ fontSize: 84, filter: 'drop-shadow(0 0 28px rgba(249,115,22,0.8))', animation: 'micFloat 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}>🎤</div>
            </div>

            {/* Title */}
            <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(28px,5vw,46px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(249,115,22,0.6)', margin: 0, lineHeight: 1.1 }}>
              Llamado a<br />Escenario
            </h1>

            {/* Sub */}
            <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 'clamp(14px,1.8vw,16px)', fontWeight: 300, color: 'rgba(255,255,255,0.6)', maxWidth: 560, lineHeight: 1.7, margin: 0 }}>
              Start-up <b style={{ color: '#fff' }}>{getTeamDisplayName().toUpperCase()}</b> requerida en el Centro de Comando.<br />
              Diríjanse al frente inmediatamente.
            </p>

            {/* CTA button */}
            <button
              style={{
                fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
                color: '#fff', background: 'linear-gradient(135deg,#d97706,#f97316)',
                border: 'none', borderRadius: 14, padding: '16px 36px',
                boxShadow: '0 4px 24px rgba(249,115,22,0.4)', cursor: 'default',
              }}
            >
              Tomar el escenario →
            </button>

            {/* U-Bot button */}
            <button
              onClick={() => setShowUBotModal(true)}
              style={{
                fontFamily: "'Exo 2', sans-serif", fontSize: 13, fontWeight: 600,
                color: 'rgba(255,255,255,0.5)', background: 'none', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 50, padding: '8px 20px', cursor: 'pointer', marginTop: -8,
              }}
            >
              🤖 U-Bot
            </button>
          </div>
        )}
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build 2>&1 | grep "PresentacionPitch"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx
git commit -m "feat(etapa4): galactic callstage screen for PresentacionPitch"
```

---

## Task 7: PresentacionPitch — Waiting Screens (Preparing !isMyTurn + Presenting !isMyTurn)

**Files:**
- Modify: `frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx`

Both "Esperando tu Turno" situations (while another team prepares, and while another team presents) share the same hourglass layout. The presenting-!isMyTurn version also shows the timer.

- [ ] **Step 1: Find and replace the `{/* Estado: Esperando Turno */}` block (presenting + !isMyTurn)**

Find:
```tsx
        {/* Estado: Esperando Turno */}
        {isWaiting && presentationState === 'presenting' && (() => {
```

Replace the entire IIFE block with:
```tsx
        {/* Estado: Esperando Turno (otro equipo presentando) */}
        {isWaiting && presentationState === 'presenting' && (() => {
          const presentingTeam = presentationStatus?.teams.find(t => t.id === presentationStatus.current_presentation_team_id);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', minHeight: '70vh', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(96,165,250,0.95)', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 50, padding: '6px 20px' }}>
                ⏳ En espera
              </div>

              {/* Hourglass */}
              <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.4) 0%,transparent 65%)', filter: 'blur(16px)' }} />
                <div style={{ fontSize: 68, filter: 'drop-shadow(0 0 24px rgba(59,130,246,0.8))', animation: 'hgFloat 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}>⏳</div>
              </div>

              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(24px,4.4vw,40px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(59,130,246,0.5)', margin: 0, lineHeight: 1.1 }}>
                Esperando<br />tu Turno
              </h1>

              {/* Timer */}
              {timerRemaining !== '01:30' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 28px', borderRadius: 16, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.4)', backdropFilter: 'blur(12px)' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#fbbf24' }}>⏱ TIEMPO RESTANTE</div>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: 3, textShadow: '0 0 40px rgba(249,115,22,0.55)' }}>{timerRemaining}</div>
                </div>
              )}

              {/* Presenter card */}
              {presentingTeam && (
                <div style={{
                  background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 22, backdropFilter: 'blur(16px)', padding: '20px 24px',
                  maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', gap: 12,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 60px rgba(59,130,246,0.12)',
                }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(96,165,250,0.95)', textAlign: 'center' }}>PRESENTANDO AHORA</div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    {prototypeUrl ? (
                      <img src={prototypeUrl} alt="Prototipo" style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: 16, background: '#0a0e2a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>🚀</div>
                    )}
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 1, marginBottom: 4 }}>
                        {getTeamName(presentingTeam).toUpperCase()}
                      </div>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                        🟢 Equipo {presentingTeam.color}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '7px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 50, fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#10b981' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 12px #10b981', animation: 'livePulse 1.2s ease-in-out infinite' }} />
                      En vivo en el escenario
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
```

- [ ] **Step 2: Find and replace the `{/* Estado: Esperando turno (cuando otro equipo se está preparando) */}` block**

Find:
```tsx
        {/* Estado: Esperando turno (cuando otro equipo se está preparando) */}
        {presentationState === 'preparing' && !isMyTurn && (() => {
```

Replace the entire IIFE with:
```tsx
        {/* Estado: Esperando turno (otro equipo preparándose) */}
        {presentationState === 'preparing' && !isMyTurn && (() => {
          const preparingTeam = presentationStatus?.teams.find(t => t.id === presentationStatus.current_presentation_team_id);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', minHeight: '70vh', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(96,165,250,0.95)', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 50, padding: '6px 20px' }}>
                ⏳ En espera
              </div>

              <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.4) 0%,transparent 65%)', filter: 'blur(16px)' }} />
                <div style={{ fontSize: 68, filter: 'drop-shadow(0 0 24px rgba(59,130,246,0.8))', animation: 'hgFloat 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}>⏳</div>
              </div>

              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(24px,4.4vw,40px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(59,130,246,0.5)', margin: 0, lineHeight: 1.1 }}>
                Esperando<br />tu Turno
              </h1>

              <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.6)', maxWidth: 560, lineHeight: 1.7, margin: 0 }}>
                La Start-up <b style={{ color: '#fff' }}>{preparingTeam ? getTeamName(preparingTeam).toUpperCase() : '…'}</b> está tomando posición en el escenario.
              </p>

              {preparingTeam && (
                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 22, backdropFilter: 'blur(16px)', padding: '20px 24px', maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(96,165,250,0.95)', textAlign: 'center' }}>PRESENTANDO AHORA</div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ width: 72, height: 72, borderRadius: 16, background: '#0a0e2a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>🚀</div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 1, marginBottom: 4 }}>{getTeamName(preparingTeam).toUpperCase()}</div>
                      <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>🟢 Equipo {preparingTeam.color}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '7px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 50, fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#10b981' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 12px #10b981', animation: 'livePulse 1.2s ease-in-out infinite' }} />
                      En vivo en el escenario
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
```

- [ ] **Step 3: Also style the `not_started` state**

Find:
```tsx
        {/* Estado: Esperando Orden */}
        {presentationState === 'not_started' && (
          <motion.div
```

Replace the entire block with:
```tsx
        {/* Estado: Esperando Orden */}
        {presentationState === 'not_started' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 60 }}>⏳</div>
            <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(18px,3vw,26px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>Esperando Orden de Presentación</h2>
            <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.5)', maxWidth: 500, lineHeight: 1.7, margin: 0 }}>
              El profesor está configurando el orden de presentación. Espera a que se inicien las presentaciones.
            </p>
          </div>
        )}
```

- [ ] **Step 4: Build check**

```bash
cd frontend && npm run build 2>&1 | grep "PresentacionPitch"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx
git commit -m "feat(etapa4): galactic waiting and not_started screens for PresentacionPitch"
```

---

## Task 8: PresentacionPitch — Presenting Screen (`isPresenting`)

**Files:**
- Modify: `frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx`

- [ ] **Step 1: Find the `{/* Estado: Presentando */}` block and replace it entirely**

Find:
```tsx
        {/* Estado: Presentando */}
        {isPresenting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl p-4 sm:p-6"
          >
```

Replace the entire block (from `{isPresenting && (` to its closing `)}`) with:

```tsx
        {/* Estado: Presentando */}
        {isPresenting && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 8 }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', color: '#10b981', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 50, padding: '6px 20px' }}>
                ● Presentación en curso
              </div>
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(20px,3.2vw,30px)', fontWeight: 900, color: '#10b981', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(16,185,129,0.5)', margin: 0, textAlign: 'center' }}>
                Su Pitch en Vivo
              </h1>
            </div>

            {/* Timer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 32px', borderRadius: 16, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.4)', backdropFilter: 'blur(12px)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#fbbf24' }}>⏱ TIEMPO RESTANTE</div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 36, fontWeight: 900, letterSpacing: 3, color: '#fff', textShadow: '0 0 40px rgba(249,115,22,0.55)' }}>{timerRemaining}</div>
            </div>

            {/* Two-column grid */}
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              {/* Prototype card */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, backdropFilter: 'blur(16px)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🖼</span> Prototipo del Equipo
                </div>
                <div style={{ flex: 1, minHeight: 220, background: '#0a0e2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  {prototypeUrl ? (
                    <img src={prototypeUrl} alt="Prototipo" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 10 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{ fontSize: 64, filter: 'drop-shadow(0 0 24px rgba(192,38,211,0.55))' }}>🚀</div>
                  )}
                </div>
              </div>

              {/* Script card */}
              {presentationStatus.current_team_pitch && (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, backdropFilter: 'blur(16px)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📋</span> Tu Guión de Pitch
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                    {[
                      { key: 'dolor', color: '#ef4444', tag: 'EL DOLOR', text: presentationStatus.current_team_pitch.intro_problem },
                      { key: 'rescate', color: '#3b82f6', tag: 'EL RESCATE', text: presentationStatus.current_team_pitch.solution },
                      { key: 'diferencia', color: '#c026d3', tag: 'DIFERENCIA', text: presentationStatus.current_team_pitch.value },
                      { key: 'futuro', color: '#10b981', tag: 'EL FUTURO', text: presentationStatus.current_team_pitch.impact },
                      { key: 'cierre', color: '#f59e0b', tag: 'GOLPE FINAL', text: presentationStatus.current_team_pitch.closing },
                    ].filter(s => s.text).map(s => (
                      <div key={s.key} style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.25)', borderLeft: `3px solid ${s.color}` }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: s.color, marginBottom: 4 }}>{s.tag}</div>
                        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
              El equipo tiene 1:30 minutos para presentar su pitch
            </p>
          </div>
        )}
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build 2>&1 | grep "PresentacionPitch"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx
git commit -m "feat(etapa4): galactic presenting screen for PresentacionPitch"
```

---

## Task 9: PresentacionPitch — Analysis Screen with Rating Pips (`isEvaluating`)

**Files:**
- Modify: `frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx`

This task replaces the `<input type="number">` fields with 10 clickable pip buttons per criterion, and applies the amber galactic theme.

- [ ] **Step 1: Find the `{/* Estado: Evaluación */}` block and replace it entirely**

Find:
```tsx
        {/* Estado: Evaluación */}
        {isEvaluating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl p-4 sm:p-6"
          >
```

Replace the entire block (from `{isEvaluating && (` to its closing `)}`) with:

```tsx
        {/* Estado: Análisis de Competencia */}
        {isEvaluating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 16 }}>
            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', color: '#fbbf24', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 50, padding: '6px 20px', marginBottom: 12, display: 'inline-block' }}>
                ⭐ Análisis de competencia
              </div>
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(22px,3.6vw,34px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(251,191,36,0.5)', margin: 0, lineHeight: 1.1 }}>
                Análisis de<br />Competencia
              </h1>
              <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.6)', marginTop: 10, lineHeight: 1.7 }}>
                ¿Invertirías en la Start-up <b style={{ color: '#fff' }}>{getEvaluatedTeamName().toUpperCase()}</b>? Valora su potencial.
              </p>
            </div>

            {isCheckingEvaluation ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 22, maxWidth: 680, width: '100%' }}>
                <Loader2 style={{ width: 40, height: 40, color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontFamily: "'Exo 2', sans-serif", color: 'rgba(255,255,255,0.7)', margin: 0 }}>Verificando evaluación…</p>
              </div>
            ) : evaluationSubmitted ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 22, maxWidth: 680, width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: 48 }}>✅</div>
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, fontWeight: 700, color: '#10b981', margin: 0 }}>Evaluación enviada exitosamente</p>
                <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Espera a que el profesor avance al siguiente turno</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitEvaluation} style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 22, backdropFilter: 'blur(16px)', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 60px rgba(251,191,36,0.08)' }}>
                  {/* Compact presenter row */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ width: 54, height: 54, borderRadius: 14, background: '#0a0e2a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🚀</div>
                    <div>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: 0.5 }}>{getEvaluatedTeamName().toUpperCase()}</div>
                      <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Start-up en evaluación</div>
                    </div>
                  </div>

                  {/* Rating rows */}
                  {[
                    { label: 'Relevancia del Dolor', sub: 'El Problema', key: 'clarity' as const },
                    { label: 'Potencial de la Solución', sub: 'El MVP', key: 'solution' as const },
                    { label: 'Poder de Convicción', sub: 'El Pitch', key: 'presentation' as const },
                  ].map(({ label, sub, key }) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff' }}>
                        {label} <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5, marginLeft: 4 }}>{sub}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => {
                          const selected = evaluationScores[key] === n;
                          const below = evaluationScores[key] > n;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setEvaluationScores({ ...evaluationScores, [key]: n })}
                              style={{
                                flex: 1, minWidth: 32, height: 42, borderRadius: 10,
                                fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                border: selected ? '1.5px solid #fbbf24' : below ? '1.5px solid rgba(251,191,36,0.55)' : '1.5px solid rgba(255,255,255,0.1)',
                                background: selected ? 'linear-gradient(135deg,#d97706,#fbbf24)' : below ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.05)',
                                color: selected ? '#0a0e2a' : below ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                                boxShadow: selected ? '0 0 18px rgba(251,191,36,0.45)' : 'none',
                                transition: 'all 0.15s',
                              }}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Strategy textarea */}
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff', marginBottom: 8 }}>
                      Consejo Estratégico <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 }}>Opcional</span>
                    </div>
                    <textarea
                      value={evaluationScores.feedback}
                      onChange={(e) => setEvaluationScores({ ...evaluationScores, feedback: e.target.value })}
                      rows={3}
                      maxLength={400}
                      placeholder="Escriban su consejo estratégico aquí…"
                      style={{
                        width: '100%', boxSizing: 'border-box', minHeight: 80,
                        background: 'rgba(0,0,0,0.25)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 14,
                        color: '#fff', fontFamily: "'Exo 2', sans-serif", fontSize: 14, fontWeight: 400,
                        padding: '12px 14px', lineHeight: 1.6, resize: 'vertical', outline: 'none',
                      }}
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmittingEvaluation}
                    style={{
                      fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
                      color: isSubmittingEvaluation ? 'rgba(255,255,255,0.5)' : '#fff',
                      background: isSubmittingEvaluation ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#093c92,#c026d3)',
                      border: 'none', borderRadius: 12, padding: '14px 24px',
                      cursor: isSubmittingEvaluation ? 'not-allowed' : 'pointer',
                      boxShadow: isSubmittingEvaluation ? 'none' : '0 4px 22px rgba(192,38,211,0.3)',
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {isSubmittingEvaluation ? (
                      <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Enviando…</>
                    ) : (
                      '[ Registrar Valoración ]'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build 2>&1 | grep "PresentacionPitch"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx
git commit -m "feat(etapa4): galactic analysis screen with rating pips for PresentacionPitch"
```

---

## Task 10: PresentacionPitch — Style Esperando Evaluaciones and Pitch Entregado

**Files:**
- Modify: `frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx`

Both states are inside the IIFE block `{presentationState === 'evaluating' && isMyTurn && (() => { ... })()}`.

- [ ] **Step 1: Replace the "Esperando Evaluaciones" return (the existing `return (` after the `allEvaluationsReceived` check)**

Find the second `return (` inside the IIFE (the Esperando Evaluaciones block) and replace its `<motion.div>` opener and all the content until the closing of the IIFE with:

```tsx
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 8, width: '100%' }}>
              {/* Header */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>⏳</div>
                <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(20px,3vw,28px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>Esperando Evaluaciones</h2>
                <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>La competencia está decidiendo el valor de su propuesta.</p>
              </div>

              {/* Progress bar */}
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 22, padding: '18px 22px', maxWidth: 680, width: '100%' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  👥 Estado de la Ronda de Inversión
                </div>
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 999, height: 12, marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: '#10b981', boxShadow: '0 0 10px rgba(16,185,129,0.5)', transition: 'width 0.4s', width: `${evaluationProgress.total > 0 ? (evaluationProgress.completed / evaluationProgress.total) * 100 : 0}%` }} />
                </div>
                <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
                  {evaluationProgress.completed} de {evaluationProgress.total} Start-ups han emitido su voto
                </p>
              </div>

              {/* Score stats */}
              {count > 0 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, maxWidth: 680, width: '100%' }}>
                    {[
                      { label: 'Total Claridad', value: totalClarity, avg: totalClarity / count, color: '#3b82f6' },
                      { label: 'Total Solución', value: totalSolution, avg: totalSolution / count, color: '#10b981' },
                      { label: 'Total Presentación', value: totalPresentation, avg: totalPresentation / count, color: '#c026d3' },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${stat.color}40`, borderRadius: 18, padding: '14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: stat.color, fontFamily: 'Orbitron, sans-serif', marginBottom: 4 }}>{stat.value}</div>
                        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{stat.label}</div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: stat.color }}>Prom: {stat.avg.toFixed(1)}/10</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'linear-gradient(135deg,rgba(9,60,146,0.4),rgba(192,38,211,0.3))', border: '1px solid rgba(192,38,211,0.3)', borderRadius: 18, padding: '16px 24px', maxWidth: 680, width: '100%', display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap', textAlign: 'center' }}>
                    <div><div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Puntuación Total</div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 900, color: '#fff' }}>{totalScore}</div></div>
                    <div><div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Tokens Recibidos</div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}><Coins style={{ width: 22, height: 22 }} />{totalTokens}</div></div>
                    <div><div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Promedio</div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 900, color: '#fff' }}>{(totalScore / count).toFixed(1)}/30</div></div>
                  </div>
                </>
              )}

              {/* Panel de inversionistas */}
              <div style={{ maxWidth: 680, width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>👥 Panel de Inversionistas</div>
                {otherTeams.map((ot) => {
                  const ev = receivedEvaluations.find((e: any) => e.evaluator_team === ot.id || e.evaluator_team_id === ot.id);
                  return (
                    <div key={ot.id} style={{ background: ev ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.04)', border: ev ? '1.5px solid rgba(16,185,129,0.3)' : '1.5px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {(() => { const m = ot.name?.match(/^Equipo\s+(.+)$/i); return `Start-up ${m ? m[1] : ot.name}`; })()}
                      </div>
                      {ev ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {[{l:'Claridad',v:ev.criteria_scores?.clarity},{l:'Solución',v:ev.criteria_scores?.solution},{l:'Pitch',v:ev.criteria_scores?.presentation}].map(s => (
                            <div key={s.l} style={{ textAlign: 'center' }}>
                              <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{s.l}</div>
                              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 700, color: '#10b981' }}>{s.v ?? 0}/10</div>
                            </div>
                          ))}
                          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}><Coins style={{ width: 14, height: 14 }} />{ev.tokens_awarded}</div>
                        </div>
                      ) : (
                        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(251,191,36,0.7)' }}>⏳ Deliberando…</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                Espera a que el profesor avance al siguiente turno
              </p>
            </div>
          );
        })()}
```

- [ ] **Step 2: Update the "Pitch Entregado" return (the `allEvaluationsReceived` branch)**

Find inside the same IIFE, the `if (allEvaluationsReceived) { return (` block and replace the `<motion.div>` content with:

```tsx
          if (allEvaluationsReceived) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', paddingTop: 24 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 50, padding: '6px 20px' }}>
                  Misión Completada · Fase 4
                </div>

                <div style={{ fontSize: 'clamp(48px,8vw,68px)', lineHeight: 1 }}>🎤</div>

                <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(28px,5.5vw,50px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(192,38,211,0.55)', margin: 0, lineHeight: 1.1 }}>
                  ¡Pitch<br />Entregado!
                </h1>

                <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 'clamp(13px,1.7vw,15px)', fontWeight: 300, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, maxWidth: 480, margin: 0 }}>
                  Pasaron de la idea al prototipo, y del prototipo a la historia.<br />Eso es lo que hace que una solución viaje más lejos que su creador.
                </p>

                {/* Score block */}
                <div style={{ background: 'rgba(192,38,211,0.08)', border: '1px solid rgba(192,38,211,0.2)', borderRadius: 18, padding: '18px 40px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(40px,8vw,64px)', fontWeight: 900, color: '#c026d3', textShadow: '0 0 30px rgba(192,38,211,0.55)', lineHeight: 1 }}>{totalScore}</div>
                  <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginTop: 6 }}>puntos obtenidos</div>
                </div>

                {count > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, maxWidth: 480, width: '100%' }}>
                    {[
                      { l: 'Dolor', v: (totalClarity / count).toFixed(1), c: '#3b82f6' },
                      { l: 'Solución', v: (totalSolution / count).toFixed(1), c: '#10b981' },
                      { l: 'Convicción', v: (totalPresentation / count).toFixed(1), c: '#c026d3' },
                    ].map(s => (
                      <div key={s.l} style={{ background: `${s.c}18`, border: `1.5px solid ${s.c}40`, borderRadius: 16, padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11, color: s.c, fontWeight: 600, marginBottom: 4 }}>{s.l}</div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, fontWeight: 900, color: '#fff' }}>{s.v}/10</div>
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  El profesor avanzará cuando todas las start-ups hayan presentado.
                </p>
              </div>
            );
          }
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | grep "PresentacionPitch"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx
git commit -m "feat(etapa4): galactic esperando-evaluaciones and pitch-entregado screens"
```

---

## Task 11: Full Build Verification

**Files:** No changes — verification only.

- [ ] **Step 1: Run the full TypeScript build**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: Build completes. The only errors should be pre-existing ones in OTHER files (Dashboard, UpdateGame*, etc.) — NOT in `FormularioPitch.tsx` or `PresentacionPitch.tsx`.

- [ ] **Step 2: Verify no regressions in the two modified files**

```bash
cd frontend && npm run build 2>&1 | grep -E "FormularioPitch|PresentacionPitch"
```

Expected: zero lines of output (no errors in either file).

- [ ] **Step 3: Final commit tagging redesign complete**

```bash
git add frontend/src/pages/tablets/etapa4/FormularioPitch.tsx frontend/src/pages/tablets/etapa4/PresentacionPitch.tsx
git commit -m "feat(etapa4): full galactic redesign of Etapa 4 tablet screens complete"
```
