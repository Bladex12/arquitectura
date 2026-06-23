# Advance Confirm Modal — Galactic Design

**Date:** 2026-05-11

## Problem

Professor views use the browser's native `confirm()` dialog when advancing between activities or stages. This is a plain OS-level popup that breaks the galactic visual theme already applied to all professor screens.

## Goal

Replace the 4 native `confirm()` calls in professor pages with a reusable `AdvanceConfirmModal` component styled to match the existing galactic design system.

---

## Design

### Visual Style: Minimal Glass (Option A)

- **Backdrop:** `fixed inset-0 bg-black/60 backdrop-blur-sm` — darkens and blurs the page behind the modal
- **Card:** dark glass — `background: rgba(6,13,31,0.88)`, `border: 1px solid rgba(255,255,255,0.14)`, `border-radius: 14px`, `backdrop-filter: blur(16px)`
- **Title:** `font-family: 'Orbitron'`, uppercase, `letter-spacing: 2px`, white
- **Message:** `font-family: 'Exo 2'`, `color: rgba(255,255,255,0.55)`, `font-size: 14px`, line-height 1.5
- **Cancel button:** ghost — transparent bg, `border: 1px solid rgba(255,255,255,0.2)`, `border-radius: 7px`, Orbitron, muted white
- **Confirm button:** gradient — `background: linear-gradient(135deg, #093c92, #c026d3)`, `border-radius: 7px`, `box-shadow: 0 0 18px rgba(192,38,211,0.4)`, Orbitron, white
- **Animation:** Framer Motion scale 0.95→1 + opacity 0→1 on enter, reverse on exit

### Component API

```typescript
interface AdvanceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}
```

### Component Location

`frontend/src/components/AdvanceConfirmModal.tsx`

---

## Pages to Update

Each of these files uses a synchronous `confirm()` that needs to be replaced with modal state:

| File | Line | Current message |
|------|------|-----------------|
| `frontend/src/pages/profesor/etapa1/Personalizacion.tsx` | 234 | ¿Avanzar a la siguiente actividad?… |
| `frontend/src/pages/profesor/etapa1/Presentacion.tsx` | 300 | ¿Avanzar a la siguiente actividad?… |
| `frontend/src/pages/profesor/etapa3/Prototipo.tsx` | 288 | ¿Avanzar a la siguiente actividad?… |
| `frontend/src/pages/profesor/etapa1/Resultados.tsx` | 145 | ¿Avanzar a la siguiente etapa?… |

### Refactor Pattern

**Before (Personalizacion, Presentacion, Prototipo):**
```typescript
const handleAdvance = async (skipRequirements = false) => {
  if (!skipRequirements && !confirm('¿Avanzar...?')) return;
  // advance logic...
};
```

**After:**
```typescript
const [showConfirmModal, setShowConfirmModal] = useState(false);

const handleAdvance = (skipRequirements = false) => {
  if (!skipRequirements) { setShowConfirmModal(true); return; }
  doAdvance();
};

const doAdvance = async () => {
  // existing advance logic...
};

// In JSX:
<AdvanceConfirmModal
  isOpen={showConfirmModal}
  onClose={() => setShowConfirmModal(false)}
  onConfirm={() => { setShowConfirmModal(false); doAdvance(); }}
  title="Avanzar Actividad"
  message="Todos los equipos deben haber completado la actividad actual antes de continuar."
/>
```

**Before (Resultados):**
```typescript
const handleAdvance = async () => {
  if (!confirm('¿Avanzar a la siguiente etapa?…')) return;
  // advance logic...
};
```

**After:**
```typescript
const [showConfirmModal, setShowConfirmModal] = useState(false);

const handleAdvance = () => setShowConfirmModal(true);

const doAdvance = async () => {
  // existing advance logic...
};

<AdvanceConfirmModal
  isOpen={showConfirmModal}
  onClose={() => setShowConfirmModal(false)}
  onConfirm={() => { setShowConfirmModal(false); doAdvance(); }}
  title="Avanzar Etapa"
  message="Esto iniciará la siguiente etapa del juego."
/>
```

---

## Verification

1. Run `npm run dev` inside `frontend/`
2. Log in as a professor and open a session
3. Navigate to Etapa 1 → Personalización — click advance, confirm the galactic modal appears and functions correctly (cancel stays, confirm advances)
4. Repeat for Presentación (Etapa 1), Prototipo (Etapa 3), and Resultados (Etapa 1 stage advance)
5. Verify no TypeScript errors: `npm run build`
