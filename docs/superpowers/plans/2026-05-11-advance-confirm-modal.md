# Advance Confirm Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser-native `confirm()` dialogs in professor pages with a reusable `AdvanceConfirmModal` component styled to match the galactic design system.

**Architecture:** Create a single `AdvanceConfirmModal` component that renders a dark glass card modal with an Orbitron title, Exo 2 body text, ghost cancel button, and gradient confirm button — all matching the existing galactic CSS tokens already imported globally in `main.tsx`. Each of the 4 professor pages that call `confirm()` gets refactored to use state-driven modal display instead of the synchronous browser dialog.

**Tech Stack:** React 18, TypeScript, Framer Motion (already installed), Tailwind CSS, `galactic.css` (globally imported)

---

## File Map

| Action | File |
|--------|------|
| Create | `frontend/src/components/AdvanceConfirmModal.tsx` |
| Modify | `frontend/src/pages/profesor/etapa1/Personalizacion.tsx` |
| Modify | `frontend/src/pages/profesor/etapa1/Presentacion.tsx` |
| Modify | `frontend/src/pages/profesor/etapa3/Prototipo.tsx` |
| Modify | `frontend/src/pages/profesor/etapa1/Resultados.tsx` |

---

## Task 1: Create AdvanceConfirmModal component

**Files:**
- Create: `frontend/src/components/AdvanceConfirmModal.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { motion, AnimatePresence } from 'framer-motion';

interface AdvanceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export function AdvanceConfirmModal({ isOpen, onClose, onConfirm, title, message }: AdvanceConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card pointer-events-auto max-w-sm w-full"
              style={{ padding: '24px 20px 20px' }}
            >
              <h2 style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '2px',
                color: '#fff',
                textTransform: 'uppercase' as const,
                marginBottom: '8px',
              }}>
                {title}
              </h2>
              <p style={{
                fontFamily: "'Exo 2', sans-serif",
                fontSize: '13px',
                color: 'rgba(255,255,255,0.55)',
                lineHeight: 1.5,
                marginBottom: '20px',
              }}>
                {message}
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1,
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase' as const,
                    color: 'rgba(255,255,255,0.7)',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '7px',
                    padding: '10px 0',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={onConfirm}
                  style={{
                    flex: 1.3,
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase' as const,
                    color: '#fff',
                    background: 'linear-gradient(135deg, #093c92, #c026d3)',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '10px 0',
                    cursor: 'pointer',
                    boxShadow: '0 0 18px rgba(192,38,211,0.4)',
                  }}
                >
                  Avanzar
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: no errors in `AdvanceConfirmModal.tsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AdvanceConfirmModal.tsx
git commit -m "feat: add galactic AdvanceConfirmModal component"
```

---

## Task 2: Update Personalizacion.tsx

**Files:**
- Modify: `frontend/src/pages/profesor/etapa1/Personalizacion.tsx`

Context: `handleNextActivity` (line 231) calls `confirm()` when `skipRequirements` is false. The logic after the confirm check needs to be extracted into a separate `doAdvance` function so the modal's `onConfirm` can call it.

- [ ] **Step 1: Add import**

Find the existing import block at the top of the file. After the line:
```typescript
import { GalacticPage } from '@/components/GalacticPage';
```
Add:
```typescript
import { AdvanceConfirmModal } from '@/components/AdvanceConfirmModal';
```

- [ ] **Step 2: Add modal state**

After the existing state declaration:
```typescript
const [showEtapaIntro, setShowEtapaIntro] = useState(false);
```
Add:
```typescript
const [showConfirmModal, setShowConfirmModal] = useState(false);
```

- [ ] **Step 3: Replace handleNextActivity with the split version**

Find and replace the entire function (lines 231–267):

**Old:**
```typescript
  const handleNextActivity = async (skipRequirements: boolean = false) => {
    if (!sessionId) return;

    if (!skipRequirements && !confirm('¿Avanzar a la siguiente actividad? Todos los equipos deben haber completado la actividad actual.')) {
      return;
    }

    setAdvancing(true);

    try {
      const data = await sessionsAPI.nextActivity(sessionId);

      if (data.stage_completed) {
        toast.success(`¡${data.message}!`);
        setTimeout(() => {
          window.location.href = `/profesor/resultados/${sessionId}/?stage_id=${data.stage_id}`;
        }, 1500);
      } else {
        const nextActivityName = data.current_activity_name;
        toast.success(`¡Avanzando a ${nextActivityName}!`);

        if (nextActivityName === 'Presentación' || nextActivityName.toLowerCase().includes('presentacion')) {
          setTimeout(() => {
            window.location.href = `/profesor/etapa1/presentacion/${sessionId}/`;
          }, 1500);
        } else {
          setTimeout(() => {
            setAdvancing(false);
            determineAndRedirect(data);
          }, 1500);
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al avanzar a la siguiente actividad');
      setAdvancing(false);
    }
  };
```

**New:**
```typescript
  const doAdvance = async () => {
    if (!sessionId) return;
    setAdvancing(true);
    try {
      const data = await sessionsAPI.nextActivity(sessionId);
      if (data.stage_completed) {
        toast.success(`¡${data.message}!`);
        setTimeout(() => {
          window.location.href = `/profesor/resultados/${sessionId}/?stage_id=${data.stage_id}`;
        }, 1500);
      } else {
        const nextActivityName = data.current_activity_name;
        toast.success(`¡Avanzando a ${nextActivityName}!`);
        if (nextActivityName === 'Presentación' || nextActivityName.toLowerCase().includes('presentacion')) {
          setTimeout(() => {
            window.location.href = `/profesor/etapa1/presentacion/${sessionId}/`;
          }, 1500);
        } else {
          setTimeout(() => {
            setAdvancing(false);
            determineAndRedirect(data);
          }, 1500);
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al avanzar a la siguiente actividad');
      setAdvancing(false);
    }
  };

  const handleNextActivity = (skipRequirements: boolean = false) => {
    if (!sessionId) return;
    if (!skipRequirements) { setShowConfirmModal(true); return; }
    doAdvance();
  };
```

- [ ] **Step 4: Add modal to JSX**

Find the closing of the main return (near the end of the file):
```tsx
    </GalacticPage>
  );
}
```

Replace with:
```tsx
    </GalacticPage>
    <AdvanceConfirmModal
      isOpen={showConfirmModal}
      onClose={() => setShowConfirmModal(false)}
      onConfirm={() => { setShowConfirmModal(false); doAdvance(); }}
      title="Avanzar Actividad"
      message="Todos los equipos deben haber completado la actividad actual antes de continuar."
    />
  </>
  );
}
```

Also wrap the outer `return (` to use a fragment. Find:
```tsx
  return (
    <GalacticPage
```
Replace with:
```tsx
  return (
    <>
    <GalacticPage
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/profesor/etapa1/Personalizacion.tsx
git commit -m "feat: replace confirm() with AdvanceConfirmModal in Personalizacion"
```

---

## Task 3: Update Presentacion.tsx

**Files:**
- Modify: `frontend/src/pages/profesor/etapa1/Presentacion.tsx`

Context: `handleNextActivity` at line 298 follows the same `skipRequirements` pattern as Personalizacion.

- [ ] **Step 1: Add import**

After the existing line:
```typescript
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
```
Add:
```typescript
import { AdvanceConfirmModal } from '@/components/AdvanceConfirmModal';
```

- [ ] **Step 2: Add modal state**

Find the existing state block (look for `const [advancing, setAdvancing]`). After the last `useState` declaration in the block, add:
```typescript
  const [showConfirmModal, setShowConfirmModal] = useState(false);
```

- [ ] **Step 3: Replace handleNextActivity**

Find and replace the entire function (lines 298–325):

**Old:**
```typescript
  const handleNextActivity = async (skipRequirements: boolean = false) => {
    if (!sessionId) return;
    if (!skipRequirements && !confirm('¿Avanzar a la siguiente actividad? Todos los equipos deben haber completado la actividad actual.')) {
      return;
    }

    setAdvancing(true);
    try {
      const data = await sessionsAPI.nextActivity(sessionId);

      if (data.stage_completed) {
        toast.success(`¡${data.message}`, { duration: 2000 });
        setTimeout(() => {
          window.location.replace(`/profesor/resultados/${sessionId}/?stage_id=${data.stage_id}`);
        }, 1500);
      } else {
        const nextActivityName = data.current_activity_name?.toLowerCase() || '';
        toast.success(`¡Avanzando a la actividad de ${nextActivityName}!`, { duration: 2000 });
        setTimeout(() => {
          determineAndRedirect(data);
        }, 1500);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al avanzar a la siguiente actividad');
    } finally {
      setAdvancing(false);
    }
  };
```

**New:**
```typescript
  const doAdvance = async () => {
    if (!sessionId) return;
    setAdvancing(true);
    try {
      const data = await sessionsAPI.nextActivity(sessionId);
      if (data.stage_completed) {
        toast.success(`¡${data.message}`, { duration: 2000 });
        setTimeout(() => {
          window.location.replace(`/profesor/resultados/${sessionId}/?stage_id=${data.stage_id}`);
        }, 1500);
      } else {
        const nextActivityName = data.current_activity_name?.toLowerCase() || '';
        toast.success(`¡Avanzando a la actividad de ${nextActivityName}!`, { duration: 2000 });
        setTimeout(() => {
          determineAndRedirect(data);
        }, 1500);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al avanzar a la siguiente actividad');
    } finally {
      setAdvancing(false);
    }
  };

  const handleNextActivity = (skipRequirements: boolean = false) => {
    if (!sessionId) return;
    if (!skipRequirements) { setShowConfirmModal(true); return; }
    doAdvance();
  };
```

- [ ] **Step 4: Add modal to JSX**

Find (near end of file):
```tsx
    </GalacticPage>
  );
}
```
Replace with:
```tsx
    </GalacticPage>
    <AdvanceConfirmModal
      isOpen={showConfirmModal}
      onClose={() => setShowConfirmModal(false)}
      onConfirm={() => { setShowConfirmModal(false); doAdvance(); }}
      title="Avanzar Actividad"
      message="Todos los equipos deben haber completado la actividad actual antes de continuar."
    />
  </>
  );
}
```

Wrap the outer return to use a fragment. Find:
```tsx
  return (
    <GalacticPage
```
Replace with:
```tsx
  return (
    <>
    <GalacticPage
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/profesor/etapa1/Presentacion.tsx
git commit -m "feat: replace confirm() with AdvanceConfirmModal in Presentacion"
```

---

## Task 4: Update Prototipo.tsx

**Files:**
- Modify: `frontend/src/pages/profesor/etapa3/Prototipo.tsx`

Context: `handleNextActivity` at line 285 follows the same `skipRequirements` pattern.

- [ ] **Step 1: Add import**

After:
```typescript
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
```
Add:
```typescript
import { AdvanceConfirmModal } from '@/components/AdvanceConfirmModal';
```

- [ ] **Step 2: Add modal state**

After the last `useState` declaration in the state block, add:
```typescript
  const [showConfirmModal, setShowConfirmModal] = useState(false);
```

- [ ] **Step 3: Replace handleNextActivity**

Find and replace the entire function (lines 285–306):

**Old:**
```typescript
  const handleNextActivity = async (skipRequirements: boolean = false) => {
    if (!sessionId) return;

    if (!skipRequirements && !confirm('¿Avanzar a la siguiente actividad? Todos los equipos deben haber completado la actividad actual.')) {
      return;
    }

    setAdvancing(true);
    try {
      const response = await sessionsAPI.nextActivity(sessionId);

      if (response.stage_completed) {
        navigate(`/profesor/resultados/${sessionId}/?stage_id=${response.stage_id}`);
      } else {
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error advancing activity:', error);
      toast.error('Error al avanzar: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
      setAdvancing(false);
    }
  };
```

**New:**
```typescript
  const doAdvance = async () => {
    if (!sessionId) return;
    setAdvancing(true);
    try {
      const response = await sessionsAPI.nextActivity(sessionId);
      if (response.stage_completed) {
        navigate(`/profesor/resultados/${sessionId}/?stage_id=${response.stage_id}`);
      } else {
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error advancing activity:', error);
      toast.error('Error al avanzar: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
      setAdvancing(false);
    }
  };

  const handleNextActivity = (skipRequirements: boolean = false) => {
    if (!sessionId) return;
    if (!skipRequirements) { setShowConfirmModal(true); return; }
    doAdvance();
  };
```

- [ ] **Step 4: Add modal to JSX**

Find (near end of file):
```tsx
    </GalacticPage>
  );
}
```
Replace with:
```tsx
    </GalacticPage>
    <AdvanceConfirmModal
      isOpen={showConfirmModal}
      onClose={() => setShowConfirmModal(false)}
      onConfirm={() => { setShowConfirmModal(false); doAdvance(); }}
      title="Avanzar Actividad"
      message="Todos los equipos deben haber completado la actividad actual antes de continuar."
    />
  </>
  );
}
```

Wrap the outer return to use a fragment. Find:
```tsx
  return (
    <GalacticPage
```
Replace with:
```tsx
  return (
    <>
    <GalacticPage
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/profesor/etapa3/Prototipo.tsx
git commit -m "feat: replace confirm() with AdvanceConfirmModal in Prototipo"
```

---

## Task 5: Update Resultados.tsx

**Files:**
- Modify: `frontend/src/pages/profesor/etapa1/Resultados.tsx`

Context: `handleNextStage` (line 125) has two paths — stage 4 goes directly to reflexión (no confirmation needed), all other stages use `confirm()`. The file already uses a `<>...</>` fragment wrapper so no wrapping change is needed.

- [ ] **Step 1: Add import**

After:
```typescript
import { CancelSessionModal } from '@/components/CancelSessionModal';
```
Add:
```typescript
import { AdvanceConfirmModal } from '@/components/AdvanceConfirmModal';
```

- [ ] **Step 2: Add modal state**

After:
```typescript
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
```
Add:
```typescript
  const [showConfirmModal, setShowConfirmModal] = useState(false);
```

- [ ] **Step 3: Replace handleNextStage with split version**

Find and replace the entire function (lines 125–167):

**Old:**
```typescript
  const handleNextStage = async () => {
    if (!sessionId || !results) return;

    if (results.stage_number === 4) {
      setAdvancing(true);
      try {
        sessionsAPI.showResults(sessionId, 0).catch(() => {});
        await sessionsAPI.startReflection(sessionId);
        toast.success('Redirigiendo a reflexión...');
        navigate(`/profesor/reflexion/${sessionId}`);
      } catch (error: any) {
        console.error('Error iniciando reflexión:', error);
        toast.error('Error al iniciar reflexión. Redirigiendo de todas formas...');
        navigate(`/profesor/reflexion/${sessionId}`);
      } finally {
        setAdvancing(false);
      }
      return;
    }

    if (!confirm('¿Avanzar a la siguiente etapa? Esto iniciará la siguiente etapa del juego.')) return;

    setAdvancing(true);
    try {
      sessionsAPI.showResults(sessionId, 0).catch(() => {});
      const data = await sessionsAPI.nextStage(sessionId);
      toast.success(`¡Avanzando a ${data.message}!`, { duration: 2000 });
      setTimeout(() => {
        const nextStage = data.next_stage_number || 2;
        if (nextStage === 2) {
          window.location.replace(`/profesor/etapa2/seleccionar-tema/${sessionId}/`);
        } else if (nextStage === 3) {
          window.location.replace(`/profesor/etapa3/prototipo/${sessionId}/`);
        } else if (nextStage === 4) {
          window.location.replace(`/profesor/etapa4/formulario-pitch/${sessionId}/`);
        }
      }, 1500);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al avanzar a la siguiente etapa');
    } finally {
      setAdvancing(false);
    }
  };
```

**New:**
```typescript
  const doAdvanceStage = async () => {
    if (!sessionId) return;
    setAdvancing(true);
    try {
      sessionsAPI.showResults(sessionId, 0).catch(() => {});
      const data = await sessionsAPI.nextStage(sessionId);
      toast.success(`¡Avanzando a ${data.message}!`, { duration: 2000 });
      setTimeout(() => {
        const nextStage = data.next_stage_number || 2;
        if (nextStage === 2) {
          window.location.replace(`/profesor/etapa2/seleccionar-tema/${sessionId}/`);
        } else if (nextStage === 3) {
          window.location.replace(`/profesor/etapa3/prototipo/${sessionId}/`);
        } else if (nextStage === 4) {
          window.location.replace(`/profesor/etapa4/formulario-pitch/${sessionId}/`);
        }
      }, 1500);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al avanzar a la siguiente etapa');
    } finally {
      setAdvancing(false);
    }
  };

  const handleNextStage = async () => {
    if (!sessionId || !results) return;

    if (results.stage_number === 4) {
      setAdvancing(true);
      try {
        sessionsAPI.showResults(sessionId, 0).catch(() => {});
        await sessionsAPI.startReflection(sessionId);
        toast.success('Redirigiendo a reflexión...');
        navigate(`/profesor/reflexion/${sessionId}`);
      } catch (error: any) {
        console.error('Error iniciando reflexión:', error);
        toast.error('Error al iniciar reflexión. Redirigiendo de todas formas...');
        navigate(`/profesor/reflexion/${sessionId}`);
      } finally {
        setAdvancing(false);
      }
      return;
    }

    setShowConfirmModal(true);
  };
```

- [ ] **Step 4: Add modal to JSX**

Find inside the existing fragment (the last modal already in the file):
```tsx
      />
    </>
  );
}
```
Replace with:
```tsx
      />
      <AdvanceConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => { setShowConfirmModal(false); doAdvanceStage(); }}
        title="Avanzar Etapa"
        message="Esto iniciará la siguiente etapa del juego."
      />
    </>
  );
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/profesor/etapa1/Resultados.tsx
git commit -m "feat: replace confirm() with AdvanceConfirmModal in Resultados"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run full build**

```bash
cd frontend && npm run build
```
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Manual smoke test**

Start dev server: `npm run dev`

Test each flow:
1. Log in as professor, open an active session
2. Go to Etapa 1 → Personalización → click "Avanzar" button → galactic dark modal appears
3. Click "Cancelar" → modal closes, page unchanged
4. Click "Avanzar" again → click "Avanzar" in modal → activity advances
5. Repeat for Presentación (Etapa 1), Prototipo (Etapa 3)
6. Go to Resultados (Etapa 1 end screen) → click advance button → galactic modal appears with "Avanzar Etapa" title
7. Verify stage 4 → Reflexión path still works without a modal (direct navigation)
