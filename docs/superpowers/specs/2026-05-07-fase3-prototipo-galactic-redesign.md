# Spec: Fase 3 — Prototipo Galactic Redesign

**Date:** 2026-05-07  
**Status:** Approved

---

## Context

The Etapa 3 tablet screen (`Prototipo.tsx`) uses the old white/blue card theme. A new HTML mockup (`Fase 3 - Prototipo.html`) defines a galactic dark-space redesign consistent with the Etapa 2 V2 screens (BubbleMapV2, SeleccionarTemaDesafioV2). The redesign introduces a richer 3-screen flow: combined upload + instructions screen → preview card → mission-complete with confetti.

Product name and tagline are now captured and persisted to the backend via the existing `response_data` JSONField (no migration needed).

---

## Goals

- Apply galactic theme (Orbitron + Exo 2 fonts, `#050818` background, starfield canvas, magenta/blue gradients)
- Merge intro elements (LEGO animation, 3-step instructions) directly into the upload screen — no separate intro screen
- Add product naming (name + optional tagline) with suggestion chips
- Add preview card before final submission
- Add confetti completion screen with score display
- Fetch team's Etapa 2 persona (Challenge `persona_name`, `persona_age`, `persona_story`) for the persona reminder pill
- Persist `product_name` + `product_tagline` to `TeamActivityProgress.response_data` via the existing upload endpoint

---

## Files

| Action | File | Notes |
|--------|------|-------|
| **Create** | `frontend/src/pages/tablets/etapa3/PrototipoV2.tsx` | New galactic component |
| **Update** | `frontend/src/App.tsx` | Replace `TabletPrototipo` import + route with V2 |
| **Update** | `game_sessions/views.py` | `upload_prototype` action: read optional `product_name`/`product_tagline` from FormData, merge into `response_data` |

---

## Screen Flow

```
upload  →  preview  →  complete
```

### Screen 1 — Upload (merged intro)

**Layout top-to-bottom:**
1. Fixed gear icon (top-left, future use, optional)
2. Top header bar: persona pill (expandable, center-left) + big countdown timer (right)
3. Phase badge + animated LEGO brick stack (decorative, small)
4. 3-step instruction strip (horizontal numbered pills): "Construyan · Saquen foto · Bauticen"
5. 2-column card grid (collapses to 1-col on narrow screens):
   - **Left — Photo card** (`up-card`): drag-drop dropzone with 📦 icon, file input, image preview overlay, "skip photo" checkbox option
   - **Right — Naming card** (`up-card`): product name input (Orbitron, max 28 chars), optional tagline textarea (max 120 chars, char counter), 6 random name-suggestion chips
6. Footer: progress dots (photo ●/○, name ●/○) + "Ver vista previa →" button (disabled until photo-or-skip AND name ≥ 2 chars)

**Persona pill** (expandable dropdown panel):
- Fetch Etapa 2 `TeamActivityProgress` for team → get `selected_challenge` ID → call `challengesAPI.getChallengeById()` → read `persona_name`, `persona_age`, `persona_story`
- If unavailable: show generic "Su persona objetivo" text

**Timer:**
- Syncs with `sessionsAPI.getActivityTimer()` every 5 s
- Displays `MM:SS`; turns orange at ≤ 60 s, pulses red at ≤ 15 s

### Screen 2 — Preview

- Phase badge "Vista previa"
- Product card (max-width 520 px):
  - 4:3 photo area (shows image or 🧱 placeholder)
  - Product name in Orbitron/900
  - Tagline italic (if provided)
  - "Construido para [persona_name]" attribution pill
- Two buttons: "← Cambiar algo" (back to upload) | "Entregar prototipo →" (triggers delivery)

**Delivery action:**
1. Build `FormData`: `team`, `activity`, `session_stage`, `image` (File if uploaded), `product_name`, `product_tagline`
2. POST to `/sessions/team-activity-progress/upload_prototype/`
3. On success → navigate to `complete` screen

### Screen 3 — Complete

- 60-particle confetti burst on mount
- "🧱 ¡Prototipo Entregado!" heading
- `cmp-product` mini-card: photo thumb + product name + tagline/persona attribution
- Score block: base 600 + photo 100 + name 80 + tagline (≥ 10 chars) 60 = max 840
- "Continuar Misión →" button (no-op log for now)

---

## Backend Change — `game_sessions/views.py`

In the `upload_prototype` custom action (around line 4569), after saving the image URL and before `progress.save()`, add:

```python
product_name = request.data.get('product_name', '').strip()
product_tagline = request.data.get('product_tagline', '').strip()
if product_name or product_tagline:
    existing = progress.response_data or {}
    existing.update({'product_name': product_name, 'product_tagline': product_tagline})
    progress.response_data = existing
```

No serializer change needed — `response_data` is already in the serializer.

---

## Reused Code / Assets

| Resource | Path | Usage |
|----------|------|-------|
| `StarField` component | `frontend/src/pages/tablets/etapa2/StarField.tsx` | Full-screen canvas background |
| `challengesAPI.getChallengeById` | `frontend/src/services/challenges.ts:19` | Fetch persona data |
| `teamActivityProgressAPI.uploadPrototype` | `frontend/src/services/teamActivityProgress.ts:9` | Photo + name/tagline upload |
| `sessionsAPI.getActivityTimer` | `frontend/src/services/sessions.ts` | Timer sync |
| `tabletConnectionsAPI.getStatus` | `frontend/src/services/` | Load team + session |
| `sessionsAPI.getLobby` | `frontend/src/services/` | Game state polling |
| Timer logic | `Prototipo.tsx:224-272` | Copy refs + interval pattern |
| `getResultsRedirectUrl` | `frontend/src/utils/tabletResultsRedirect.ts` | Redirect on stage end |
| `advanceActivityOnTimerExpiration` | `frontend/src/utils/timerAutoAdvance.ts` | Auto-advance on timer zero |

---

## Fonts

Add to `frontend/index.html` if not already present:
```html
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Exo+2:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

---

## Verification

1. Run `docker-compose up --build`
2. Create game session, advance to Etapa 3 Prototipo activity
3. Open tablet at `/tablet/etapa3/prototipo?connection_id=...`
4. Verify: starfield renders, persona pill shows (or generic), timer counts down
5. Upload a photo → dropzone shows preview; skip checkbox works
6. Enter product name → "Ver vista previa" enables
7. Preview screen shows correct photo/name/tagline/persona
8. Click "Entregar" → network tab confirms POST with `product_name` in FormData
9. Complete screen shows confetti + correct score
10. Check `TeamActivityProgress` in Django admin: `response_data` contains `product_name` and `product_tagline`; `prototype_image_url` is set
