# Fase 3 Prototipo Galactic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old white/blue `Prototipo.tsx` with a galactic dark-space redesign (`PrototipoV2.tsx`) featuring animated LEGO bricks, persona reminder pill, drag-drop photo upload, product naming with suggestions, a preview card, and a confetti completion screen.

**Architecture:** Single `PrototipoV2.tsx` file manages all state and renders one of three screens (`upload | preview | complete`) using a local string state. Game polling, timer sync, and file upload reuse exact patterns from the existing `Prototipo.tsx`. The `StarField` canvas component from `etapa2/StarField.tsx` is imported directly. A minor backend change makes `image` optional and saves `product_name`/`product_tagline` into `TeamActivityProgress.response_data`.

**Tech Stack:** React 18, TypeScript, Framer Motion, Tailwind CSS (minimal — primarily inline styles for pixel-perfect galactic theme), Orbitron + Exo 2 fonts (already in `index.html`). Django DRF on the backend.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `frontend/src/pages/tablets/etapa3/PrototipoV2.tsx` | All 3 galactic screens + game state |
| Modify | `frontend/src/App.tsx` | Replace `TabletPrototipo` import + route |
| Modify | `game_sessions/views.py:4591-4687` | Make `image` optional; save product_name/tagline |

---

## Task 1: Backend — make image optional + save product name/tagline

**Files:**
- Modify: `game_sessions/views.py:4568-4730`

- [ ] **Step 1: Locate the upload_prototype action** — open `game_sessions/views.py` at line 4568. The action starts with `@action(detail=False, methods=['post'], permission_classes=[], authentication_classes=[])` followed by `def upload_prototype(self, request):`.

- [ ] **Step 2: Replace the image-required guard** — currently lines 4591-4595 return a 400 if `image_file` is falsy. Replace that block so the endpoint accepts requests without an image:

```python
# lines 4591-4595 — REMOVE this block entirely:
# if not image_file:
#     return Response(
#         {'error': 'Se requiere un archivo de imagen'},
#         status=status.HTTP_400_BAD_REQUEST
#     )
```

- [ ] **Step 3: Wrap the entire image-processing block in an `if image_file:` guard** — currently lines 4632-4678 process and save the image unconditionally. Wrap them so they only run when a file was provided:

Find this comment (line 4632):
```python
            # Procesar y guardar imagen
            try:
```

Replace from that point through the `except Exception as img_error:` block (ending at line 4672) with:

```python
            # Procesar y guardar imagen (opcional si se saltó la foto)
            image_url = None
            if image_file:
                try:
                    # Abrir imagen con PIL para validar y optimizar
                    img = Image.open(image_file)
                    
                    # Convertir a RGB si es necesario (para JPEG)
                    if img.mode in ('RGBA', 'LA', 'P'):
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                        img = background
                    
                    # Redimensionar si es muy grande (máximo 1920x1920)
                    max_size = (1920, 1920)
                    if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
                        img.thumbnail(max_size, Image.Resampling.LANCZOS)
                    
                    # Guardar en buffer
                    from io import BytesIO
                    buffer = BytesIO()
                    img.save(buffer, format='JPEG', quality=85, optimize=True)
                    buffer.seek(0)
                    
                    # Generar nombre único para el archivo
                    import uuid
                    filename = f'prototypes/{team.id}_{session_stage.id}_{uuid.uuid4().hex[:8]}.jpg'
                    
                    # Guardar en el sistema de archivos
                    saved_path = default_storage.save(filename, ContentFile(buffer.read()))
                    image_url = f"{settings.MEDIA_URL}{saved_path}"
                    
                except Exception as img_error:
                    return Response(
                        {'error': f'Error al procesar imagen: {str(img_error)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
```

- [ ] **Step 4: Also wrap the "delete old image" block in `if image_file:` guard** — currently lines 4674-4678. Find:

```python
            # Si ya había una imagen, eliminar la anterior
            if progress.prototype_image_url and not created:
                old_path = progress.prototype_image_url.replace(settings.MEDIA_URL, '')
                if default_storage.exists(old_path):
                    default_storage.delete(old_path)
```

Replace with:

```python
            # Si ya había una imagen y se subió una nueva, eliminar la anterior
            if image_file and progress.prototype_image_url and not created:
                old_path = progress.prototype_image_url.replace(settings.MEDIA_URL, '')
                if default_storage.exists(old_path):
                    default_storage.delete(old_path)
```

- [ ] **Step 5: Update the progress fields block to save image conditionally + save product data** — currently lines 4680-4687. Find:

```python
            # Actualizar progreso
            progress.prototype_image_url = image_url
            progress.status = 'submitted'
            progress.progress_percentage = 100
            if not progress.started_at:
                progress.started_at = timezone.now()
            progress.completed_at = timezone.now()
            progress.save()
```

Replace with:

```python
            # Actualizar progreso
            if image_url:
                progress.prototype_image_url = image_url
            progress.status = 'submitted'
            progress.progress_percentage = 100
            if not progress.started_at:
                progress.started_at = timezone.now()
            progress.completed_at = timezone.now()
            
            # Guardar nombre y tagline del producto en response_data
            product_name = request.data.get('product_name', '').strip()
            product_tagline = request.data.get('product_tagline', '').strip()
            if product_name or product_tagline:
                existing = progress.response_data or {}
                existing.update({
                    'product_name': product_name,
                    'product_tagline': product_tagline,
                })
                progress.response_data = existing
            
            progress.save()
```

- [ ] **Step 6: Verify Django dev server still starts** — run `docker-compose up` and check for no import errors or syntax errors in `game_sessions/views.py`.

- [ ] **Step 7: Manual smoke test** — open Django shell or use curl to POST to `/api/sessions/team-activity-progress/upload_prototype/` with only `team`, `activity`, `session_stage`, `product_name=TestApp`, `product_tagline=Para todos`. Verify it returns 200 (not 400 "Se requiere imagen").

- [ ] **Step 8: Commit**

```bash
git add game_sessions/views.py
git commit -m "feat: make prototype image optional and save product_name/tagline to response_data"
```

---

## Task 2: Scaffold PrototipoV2 with game state + screen machine

**Files:**
- Create: `frontend/src/pages/tablets/etapa3/PrototipoV2.tsx`

- [ ] **Step 1: Create the file with all imports, types, and state**

```tsx
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import StarField from '../etapa2/StarField';
import {
  sessionsAPI,
  challengesAPI,
  teamActivityProgressAPI,
  tabletConnectionsAPI,
} from '@/services';
import { getResultsRedirectUrl } from '@/utils/tabletResultsRedirect';
import { advanceActivityOnTimerExpiration } from '@/utils/timerAutoAdvance';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total?: number;
}

interface PersonaData {
  name: string;
  age: number | null;
  story: string | null;
}

type Screen = 'upload' | 'preview' | 'complete';

// ── Constants ──────────────────────────────────────────────────────────────────
const SUG_LEFT = ['Eco','Mente','Raíz','Co','Lumi','Aqua','Sana','Nido','Vida','Pulso','Tierra','Aula'];
const SUG_RIGHT = ['Up','Lab','Link','Vivo','Tech','Mente','Fy','One','Cast','Click','Red','Más'];

function makeSuggestions(): string[] {
  const used = new Set<string>();
  const result: string[] = [];
  while (result.length < 6) {
    const s = SUG_LEFT[Math.floor(Math.random() * SUG_LEFT.length)] +
              SUG_RIGHT[Math.floor(Math.random() * SUG_RIGHT.length)];
    if (!used.has(s)) { used.add(s); result.push(s); }
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TabletPrototipoV2() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Game state
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<number | null>(null);
  const [currentSessionStageId, setCurrentSessionStageId] = useState<number | null>(null);

  // Screen
  const [screen, setScreen] = useState<Screen>('upload');

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedDataURL, setUploadedDataURL] = useState<string | null>(null);
  const [photoSkipped, setPhotoSkipped] = useState(false);
  const [productName, setProductName] = useState('');
  const [productTagline, setProductTagline] = useState('');
  const [suggestions] = useState<string[]>(makeSuggestions);
  const [submitting, setSubmitting] = useState(false);

  // Persona
  const [persona, setPersona] = useState<PersonaData | null>(null);
  const [personaPanelOpen, setPersonaPanelOpen] = useState(false);

  // Timer
  const [timerDisplay, setTimerDisplay] = useState('--:--');
  const [timerState, setTimerState] = useState<'normal' | 'warn' | 'danger'>('normal');

  // Refs
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartTimeRef = useRef<number | null>(null);
  const timerDurationRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionStageIdRef = useRef<number | null>(null);

  // ── Game state loading ─────────────────────────────────────────────────────
  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) { navigate('/tablet/join'); return; }
    setConnectionId(connId);
    loadGameState(connId);
    intervalRef.current = setInterval(() => loadGameState(connId), 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (timerSyncIntervalRef.current) clearInterval(timerSyncIntervalRef.current);
    };
  }, []);

  const loadGameState = async (connId: string) => {
    try {
      let statusData: any;
      try {
        statusData = await tabletConnectionsAPI.getStatus(connId);
      } catch (error: any) {
        if (error.response?.status === 404) {
          toast.error('Conexión no encontrada. Por favor reconecta.');
          setTimeout(() => navigate('/tablet/join'), 3000);
          return;
        }
        throw error;
      }
      setTeam(statusData.team);
      setGameSessionId(statusData.game_session.id);

      const lobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
      const gameData = lobbyData.game_session;

      const resultsUrl = getResultsRedirectUrl(gameData, connId);
      if (resultsUrl) { window.location.href = resultsUrl; return; }

      if (gameData.status === 'finished' || gameData.status === 'completed') {
        toast.info('El juego ha finalizado. Redirigiendo...');
        setTimeout(() => navigate('/tablet/join'), 2000);
        return;
      }
      if (gameData.status === 'lobby') {
        navigate(`/tablet/lobby?connection_id=${connId}`);
        return;
      }

      const actId = gameData.current_activity;
      const actName = (gameData.current_activity_name || '').toLowerCase();
      const stageNum = gameData.current_stage_number || 1;

      if (stageNum === 3 && (!actName || !actId)) {
        window.location.href = `/tablet/etapa3/resultados/?connection_id=${connId}`;
        return;
      }
      if (stageNum > 3) {
        const destBase = stageNum === 4
          ? (actName.includes('presentaci') ? '/tablet/etapa4/presentacion-pitch/' : '/tablet/etapa4/formulario-pitch/')
          : '';
        window.location.href = destBase
          ? `/tablet/etapa-warp?stage=${stageNum}&redirect=${encodeURIComponent(destBase)}&connection_id=${connId}`
          : `/tablet/lobby?connection_id=${connId}`;
        return;
      }
      if (stageNum === 3 && actName && !actName.includes('prototipo')) {
        window.location.href = `/tablet/etapa3/resultados/?connection_id=${connId}`;
        return;
      }

      setCurrentActivityId(actId);

      if (!sessionStageIdRef.current && actId) {
        const stagesData = await sessionsAPI.getSessionStages(statusData.game_session.id);
        const stages = Array.isArray(stagesData) ? stagesData : [stagesData];
        const stage3 = stages.find((s: any) => s.stage_number === 3);
        if (stage3) {
          setCurrentSessionStageId(stage3.id);
          sessionStageIdRef.current = stage3.id;
        }
        // Load persona from Etapa 2
        const stage2 = stages.find((s: any) => s.stage_number === 2);
        if (stage2) loadPersona(statusData.team.id, stage2.id);
      }

      if (actId && sessionStageIdRef.current) {
        startTimerSync(statusData.game_session.id);
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading game state:', error);
      setLoading(false);
    }
  };

  // ── Persona fetch ──────────────────────────────────────────────────────────
  const loadPersona = async (teamId: number, stage2Id: number) => {
    try {
      const progressList = await teamActivityProgressAPI.list({ team: teamId, session_stage: stage2Id });
      const arr = Array.isArray(progressList) ? progressList : [progressList];
      const withChallenge = arr.find((p: any) => p.selected_challenge);
      if (!withChallenge?.selected_challenge) return;
      const challenge = await challengesAPI.getChallengeById(withChallenge.selected_challenge);
      if (challenge?.persona_name) {
        setPersona({
          name: challenge.persona_name,
          age: challenge.persona_age ?? null,
          story: challenge.persona_story ?? null,
        });
      }
    } catch {
      // persona is optional — silently fail
    }
  };

  // ── Timer ──────────────────────────────────────────────────────────────────
  const syncTimer = async (gsId: number) => {
    try {
      const data = await sessionsAPI.getActivityTimer(gsId);
      if (data.started_at && data.timer_duration) {
        timerStartTimeRef.current = new Date(data.started_at).getTime();
        timerDurationRef.current = data.timer_duration;
      }
    } catch { /* ignore */ }
  };

  const startTimerSync = (gsId: number) => {
    if (timerSyncIntervalRef.current) return; // already running
    syncTimer(gsId);
    timerSyncIntervalRef.current = setInterval(() => syncTimer(gsId), 5000);

    const tick = () => {
      if (!timerStartTimeRef.current || !timerDurationRef.current) return;
      const remaining = Math.max(0, timerDurationRef.current - Math.floor((Date.now() - timerStartTimeRef.current) / 1000));
      const m = Math.floor(remaining / 60), s = remaining % 60;
      setTimerDisplay(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      setTimerState(remaining <= 15 ? 'danger' : remaining <= 60 ? 'warn' : 'normal');
      if (remaining === 0) {
        clearInterval(timerIntervalRef.current!);
        timerIntervalRef.current = null;
        void advanceActivityOnTimerExpiration(gameSessionId!);
      }
    };
    tick();
    timerIntervalRef.current = setInterval(tick, 1000);
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const photoReady = !!uploadedDataURL || photoSkipped;
  const nameReady = productName.trim().length >= 2;
  const canSubmit = photoReady && nameReady;

  // ── Handlers (placeholders — filled in later tasks) ────────────────────────
  const handleFile = (_file: File) => { /* Task 4 */ };
  const toggleSkipPhoto = () => { /* Task 4 */ };
  const goToPreview = () => setScreen('preview');
  const goBack = () => setScreen('upload');
  const deliver = async () => { /* Task 8 */ };

  // ── Loading guard ──────────────────────────────────────────────────────────
  if (loading || !team) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050818' }}>
        <StarField />
        <div style={{ color: '#fff', fontFamily: 'Orbitron, sans-serif', fontSize: 14, letterSpacing: 3 }}>CARGANDO...</div>
      </div>
    );
  }

  // ── Main render (screen switcher) ──────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#050818', color: '#fff', fontFamily: "'Exo 2', sans-serif", overflow: 'hidden auto' }}>
      <StarField />
      <div style={{ position: 'relative', zIndex: 10 }}>
        {screen === 'upload' && <div>UPLOAD SCREEN (Task 3–7)</div>}
        {screen === 'preview' && <div>PREVIEW SCREEN (Task 8)</div>}
        {screen === 'complete' && <div>COMPLETE SCREEN (Task 9)</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles** — run `cd frontend && npm run build`. Fix any import or type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/tablets/etapa3/PrototipoV2.tsx
git commit -m "feat: scaffold TabletPrototipoV2 with game state and screen machine"
```

---

## Task 3: Upload screen — core layout (header, LEGO, instructions, card grid shell)

**Files:**
- Modify: `frontend/src/pages/tablets/etapa3/PrototipoV2.tsx`

Replace the `{screen === 'upload' && <div>UPLOAD SCREEN (Task 3–7)</div>}` placeholder in the return with the full upload screen component. Do **not** fill in the photo/naming card internals yet — leave placeholders inside `.up-card` divs.

- [ ] **Step 1: Add the CSS keyframe animation string and LEGO stack renderer** — add this **above the component function**:

```tsx
const legoStyle = `
@keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
.lego-b1{animation:floatB 3s ease-in-out infinite}
.lego-b2{animation:floatB 3s ease-in-out infinite 0.4s}
.lego-b3{animation:floatB 3s ease-in-out infinite 0.8s}
@keyframes tpulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0.2)}}
`;

function LegoBrick({ color, width, cls }: { color: string; width: number; cls: string }) {
  return (
    <div className={cls} style={{
      width, height: 36, borderRadius: 5, background: color,
      boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.25), 0 4px 14px rgba(0,0,0,0.4)',
      position: 'relative', marginTop: -4,
    }}>
      {/* studs */}
      {[22, width - 40].map((left, i) => (
        <div key={i} style={{
          position: 'absolute', top: -6, left, width: 18, height: 11,
          borderRadius: '50%', background: color,
          boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.25)',
        }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Inject the keyframe styles** — add `<style>{legoStyle}</style>` as the first child of the `<div style={{ position: 'relative', zIndex: 10 }}>` wrapper.

- [ ] **Step 3: Replace the upload placeholder** — replace `{screen === 'upload' && <div>UPLOAD SCREEN (Task 3–7)</div>}` with:

```tsx
{screen === 'upload' && (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', minHeight: '100vh' }}>
    {/* ── Top header: persona pill + timer ── */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap', width: '100%', maxWidth: 920, marginBottom: 16 }}>
      {/* Persona pill — filled in Task 7 */}
      <div style={{ flex: 1 }}>PERSONA_PILL</div>
      {/* Big timer — filled in Task 6 */}
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(32px,5vw,56px)', fontWeight: 900, color: timerState === 'danger' ? '#ef4444' : timerState === 'warn' ? '#f97316' : '#fff', letterSpacing: 3, padding: '10px 28px', borderRadius: 18, background: 'rgba(192,38,211,0.06)', border: '1px solid rgba(192,38,211,0.25)' }}>
        {timerDisplay}
      </div>
    </div>

    {/* ── Phase badge + LEGO ── */}
    <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 50, padding: '6px 18px', marginBottom: 14 }}>
      Fase 3 · Prototipo
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16, perspective: 600 }}>
      <LegoBrick color="#c026d3" width={120} cls="lego-b1" />
      <LegoBrick color="#093c92" width={100} cls="lego-b2" />
      <LegoBrick color="#f59e0b" width={140} cls="lego-b3" />
    </div>

    {/* ── 3-step instruction strip ── */}
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, justifyContent: 'center', width: '100%', maxWidth: 920, marginBottom: 18 }}>
      {[
        { n: 1, text: <><b style={{ color: '#fff', fontWeight: 600 }}>Construyan</b> el prototipo con los Legos</> },
        { n: 2, text: <><b style={{ color: '#fff', fontWeight: 600 }}>Saquen una foto</b> cenital y con luz</> },
        { n: 3, text: <><b style={{ color: '#fff', fontWeight: 600 }}>Pónganle un nombre</b> a su solución</> },
      ].map(({ n, text }) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 50 }}>
          <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,#093c92,#c026d3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 900, color: '#fff' }}>{n}</div>
          <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.7)' }}>{text}</span>
        </div>
      ))}
    </div>

    {/* ── 2-column card grid ── */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, width: '100%', maxWidth: 920 }}>
      {/* Photo card — filled in Task 4 */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, backdropFilter: 'blur(16px)', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(192,38,211,0.85)' }}>Paso 1 · Foto</div>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>Su prototipo en imagen</div>
        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>Foto cenital, fondo limpio. Que se entienda qué construyeron.</div>
        <div>PHOTO_DROPZONE</div>
      </div>

      {/* Naming card — filled in Task 5 */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, backdropFilter: 'blur(16px)', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(192,38,211,0.85)' }}>Paso 2 · Nombre</div>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>Bauticen su solución</div>
        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>Un nombre corto, memorable. Como si fuera el de una startup real.</div>
        <div>NAMING_INPUTS</div>
      </div>
    </div>

    {/* ── Footer: progress dots + submit ── */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 920, marginTop: 24, flexWrap: 'wrap' as const, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: photoReady ? '#c026d3' : 'rgba(255,255,255,0.15)', boxShadow: photoReady ? '0 0 10px rgba(192,38,211,0.6)' : 'none' }} />
        <span>{uploadedDataURL ? 'Foto lista' : photoSkipped ? 'Sin foto (saltado)' : 'Foto pendiente'}</span>
        <span style={{ marginLeft: 12 }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: nameReady ? '#c026d3' : 'rgba(255,255,255,0.15)', boxShadow: nameReady ? '0 0 10px rgba(192,38,211,0.6)' : 'none' }} />
        <span>{nameReady ? 'Nombre listo' : 'Nombre pendiente'}</span>
      </div>
      <button
        onClick={goToPreview}
        disabled={!canSubmit}
        style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#fff', background: 'linear-gradient(135deg,#093c92,#c026d3)', border: 'none', borderRadius: 12, padding: '14px 32px', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.4, boxShadow: '0 4px 22px rgba(192,38,211,0.3)' }}
      >
        Ver vista previa →
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify in browser** — open the route. You should see the starfield, phase badge, animated LEGO bricks, instruction pills, and two card skeletons with placeholder text. Timer shows `--:--`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/tablets/etapa3/PrototipoV2.tsx
git commit -m "feat: upload screen core layout with LEGO animation and instruction strip"
```

---

## Task 4: Photo dropzone — drag-drop, preview, skip option

**Files:**
- Modify: `frontend/src/pages/tablets/etapa3/PrototipoV2.tsx`

- [ ] **Step 1: Implement `handleFile` and `toggleSkipPhoto`** — replace the placeholder handlers in the component body:

```tsx
const handleFile = (file: File) => {
  if (!file.type.startsWith('image/')) { toast.error('Por favor sube una imagen.'); return; }
  if (photoSkipped) setPhotoSkipped(false);
  const reader = new FileReader();
  reader.onload = (e) => {
    setUploadedFile(file);
    setUploadedDataURL(e.target?.result as string);
  };
  reader.readAsDataURL(file);
};

const toggleSkipPhoto = () => {
  const next = !photoSkipped;
  setPhotoSkipped(next);
  if (next) { setUploadedFile(null); setUploadedDataURL(null); }
};
```

- [ ] **Step 2: Replace the `PHOTO_DROPZONE` placeholder** with the dropzone component inline. Find the string `<div>PHOTO_DROPZONE</div>` and replace with:

```tsx
<>
  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
  <label
    htmlFor="dzInput"
    onClick={e => { e.preventDefault(); if (!photoSkipped) fileInputRef.current?.click(); }}
    onDragOver={e => { e.preventDefault(); }}
    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
    style={{
      position: 'relative', flex: 1, minHeight: 200,
      border: photoSkipped ? '2px solid rgba(16,185,129,0.5)' : '2px dashed rgba(192,38,211,0.45)',
      borderRadius: 18,
      background: photoSkipped ? 'rgba(16,185,129,0.06)' : uploadedDataURL ? 'transparent' : 'rgba(192,38,211,0.04)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, cursor: photoSkipped ? 'default' : 'pointer', overflow: 'hidden',
      textAlign: 'center', padding: 18,
    }}
  >
    {photoSkipped ? (
      <>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(16,185,129,0.18)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#10b981' }}>✓</div>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#10b981' }}>Paso saltado</div>
        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11.5, fontWeight: 300, color: 'rgba(255,255,255,0.55)', maxWidth: 240, lineHeight: 1.5 }}>Pueden continuar sin foto.</div>
      </>
    ) : uploadedDataURL ? (
      <>
        <img src={uploadedDataURL} alt="prototipo" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: 14, background: 'linear-gradient(to top,rgba(5,8,24,0.92) 0%,rgba(5,8,24,0.4) 50%,transparent 100%)', borderRadius: 16 }}>
          <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 50, padding: '6px 14px', backdropFilter: 'blur(8px)' }}>↻ Reemplazar foto</span>
        </div>
      </>
    ) : (
      <>
        <span style={{ fontSize: 46, filter: 'drop-shadow(0 0 14px rgba(192,38,211,0.5))' }}>📦</span>
        <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff' }}>Subir foto del Lego</span>
        <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11.5, fontWeight: 300, color: 'rgba(255,255,255,0.45)' }}>Arrastra aquí o toca para explorar</span>
        <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10.5, color: 'rgba(255,255,255,0.3)' }}>JPG · PNG · HEIC · hasta 10 MB</span>
      </>
    )}
  </label>

  {/* Skip checkbox */}
  <div
    onClick={toggleSkipPhoto}
    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: `1px dashed ${photoSkipped ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.14)'}`, borderRadius: 10, cursor: 'pointer', userSelect: 'none' }}
  >
    <div style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${photoSkipped ? '#c026d3' : 'rgba(255,255,255,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: photoSkipped ? 'linear-gradient(135deg,#093c92,#c026d3)' : 'rgba(255,255,255,0.04)' }}>
      {photoSkipped && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
    </div>
    <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11.5, fontWeight: 400, color: photoSkipped ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)', lineHeight: 1.4, flex: 1 }}>No es posible subir una foto en este momento — saltar este paso.</span>
  </div>
</>
```

- [ ] **Step 3: Test in browser** — photo dropzone should show the box icon, accept a file when clicked, show a preview, and allow toggling the skip checkbox.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/tablets/etapa3/PrototipoV2.tsx
git commit -m "feat: photo dropzone with drag-drop, preview, and skip option"
```

---

## Task 5: Naming card — inputs, suggestions, progress footer

**Files:**
- Modify: `frontend/src/pages/tablets/etapa3/PrototipoV2.tsx`

- [ ] **Step 1: Replace the `NAMING_INPUTS` placeholder** with:

```tsx
<>
  <div>
    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>Nombre del producto</div>
    <input
      type="text"
      value={productName}
      maxLength={28}
      placeholder="Ej: AmaranTo, Mentea, RaízUp…"
      onChange={e => setProductName(e.target.value)}
      style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: `1.5px solid ${nameReady ? '#c026d3' : 'rgba(255,255,255,0.14)'}`, borderRadius: 12, color: '#fff', fontFamily: 'Orbitron, sans-serif', fontSize: 18, fontWeight: 700, padding: '14px 16px', letterSpacing: 1, outline: 'none', transition: 'border-color 0.2s' }}
      onFocus={e => { e.target.style.borderColor = '#c026d3'; e.target.style.boxShadow = '0 0 0 4px rgba(192,38,211,0.15)'; }}
      onBlur={e => { e.target.style.borderColor = nameReady ? '#c026d3' : 'rgba(255,255,255,0.14)'; e.target.style.boxShadow = 'none'; }}
    />
  </div>

  <div>
    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>Frase descriptiva (opcional)</div>
    <textarea
      value={productTagline}
      maxLength={120}
      placeholder="En una frase: ¿qué hace su solución?"
      onChange={e => setProductTagline(e.target.value)}
      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff', fontFamily: "'Exo 2', sans-serif", fontSize: 14, fontWeight: 400, padding: '12px 14px', lineHeight: 1.5, resize: 'none', minHeight: 80, outline: 'none' }}
      onFocus={e => { e.target.style.borderColor = '#c026d3'; }}
      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
    />
    <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 4 }}>{productTagline.length} / 120</div>
  </div>

  <div>
    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>¿Sin ideas? Combinen palabras</div>
    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
      {suggestions.map(s => (
        <span
          key={s}
          onClick={() => setProductName(s)}
          style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 50, padding: '5px 11px', cursor: 'pointer' }}
        >{s}</span>
      ))}
    </div>
  </div>
</>
```

- [ ] **Step 2: Verify in browser** — name input, tagline textarea, char counter, and suggestion chips should all work. The footer "Ver vista previa" button should enable once name has ≥ 2 chars AND photo/skip is done.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/tablets/etapa3/PrototipoV2.tsx
git commit -m "feat: naming card with inputs, char counter, and suggestion chips"
```

---

## Task 6: Persona pill — expandable with Etapa 2 challenge data

**Files:**
- Modify: `frontend/src/pages/tablets/etapa3/PrototipoV2.tsx`

- [ ] **Step 1: Replace the `PERSONA_PILL` placeholder** (the `<div style={{ flex: 1 }}>PERSONA_PILL</div>` in the top header) with:

```tsx
<div style={{ flex: 1, position: 'relative' }}>
  {/* Dropdown panel */}
  {personaPanelOpen && (
    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 55, width: 'min(440px, calc(100vw - 36px))', background: 'rgba(5,8,24,0.94)', border: '1px solid rgba(192,38,211,0.35)', borderRadius: 20, backdropFilter: 'blur(28px)', padding: '24px 26px', boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 60px rgba(192,38,211,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(192,38,211,0.2)', border: '2px solid rgba(192,38,211,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>🧑</div>
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 0.5, marginBottom: 3 }}>{persona?.name || 'Su persona objetivo'}</div>
          {persona?.age && <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{persona.age} años</div>}
        </div>
      </div>
      {persona?.story && (
        <>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(192,38,211,0.85)', marginBottom: 8 }}>Su historia</div>
          <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,0.7)', lineHeight: 1.75 }}>{persona.story}</div>
        </>
      )}
      <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(192,38,211,0.08)', borderLeft: '2.5px solid #c026d3', borderRadius: 6, fontFamily: "'Exo 2', sans-serif", fontSize: 11.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontStyle: 'italic' }}>
        💡 Antes de subir la foto, pregúntense: ¿esto resuelve algo real para ella?
      </div>
    </div>
  )}

  {/* Pill trigger */}
  <div
    onClick={() => setPersonaPanelOpen(p => !p)}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '10px 18px 10px 10px', background: 'rgba(192,38,211,0.12)', border: '1.5px solid rgba(192,38,211,0.45)', borderRadius: 50, backdropFilter: 'blur(16px)', boxShadow: '0 0 30px rgba(192,38,211,0.25)', cursor: 'pointer' }}
  >
    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(192,38,211,0.25)', border: '2px solid rgba(192,38,211,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🧑</div>
    <div style={{ lineHeight: 1.1, textAlign: 'left' }}>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.55)', marginBottom: 3 }}>Su solución es para</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>{persona?.name || 'Su persona'}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', transform: personaPanelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s', display: 'inline-block' }}>▼</span>
      </div>
      <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Toca para releer el problema</div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Close panel when clicking outside** — add this `useEffect` inside the component (after the other useEffects):

```tsx
useEffect(() => {
  const close = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-persona-pill]')) setPersonaPanelOpen(false);
  };
  document.addEventListener('mousedown', close);
  return () => document.removeEventListener('mousedown', close);
}, []);
```

Add `data-persona-pill="true"` attribute to both the pill trigger div and the dropdown panel div.

- [ ] **Step 3: Verify** — if the team has a selected_challenge from Etapa 2, the persona name should appear. Otherwise "Su persona" shows. Clicking the pill opens/closes the panel.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/tablets/etapa3/PrototipoV2.tsx
git commit -m "feat: persona reminder pill with Etapa 2 challenge data"
```

---

## Task 7: Preview screen

**Files:**
- Modify: `frontend/src/pages/tablets/etapa3/PrototipoV2.tsx`

- [ ] **Step 1: Implement `deliver` function** — replace the `deliver` placeholder in the component body:

```tsx
const deliver = async () => {
  if (!team || !currentActivityId || !currentSessionStageId) return;
  setSubmitting(true);
  try {
    const formData = new FormData();
    formData.append('team', team.id.toString());
    formData.append('activity', currentActivityId.toString());
    formData.append('session_stage', currentSessionStageId.toString());
    if (uploadedFile) formData.append('image', uploadedFile);
    formData.append('product_name', productName.trim());
    formData.append('product_tagline', productTagline.trim());
    await teamActivityProgressAPI.uploadPrototype(formData);
    setScreen('complete');
  } catch (error: any) {
    toast.error('Error al entregar prototipo: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
  } finally {
    setSubmitting(false);
  }
};
```

- [ ] **Step 2: Replace the preview screen placeholder** `{screen === 'preview' && <div>PREVIEW SCREEN (Task 8)</div>}` with:

```tsx
{screen === 'preview' && (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px', minHeight: '100vh', gap: 0 }}>
    <button
      onClick={goBack}
      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontFamily: "'Exo 2', sans-serif", fontSize: 12, cursor: 'pointer', marginBottom: 18, alignSelf: 'flex-start' }}
    >← Editar</button>

    <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 50, padding: '6px 18px', marginBottom: 24 }}>Vista previa</div>

    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(16px)', padding: 28, maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Photo */}
      <div style={{ aspectRatio: '4/3', borderRadius: 16, overflow: 'hidden', background: '#0a0e2a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {uploadedDataURL
          ? <img src={uploadedDataURL} alt="Prototipo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)', fontFamily: "'Exo 2', sans-serif", fontSize: 13 }}><span style={{ fontSize: 42 }}>🧱</span><span>Sin foto</span></div>
        }
      </div>

      {/* Meta */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(192,38,211,0.85)', marginBottom: 6 }}>Su solución</div>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(22px,4vw,30px)', fontWeight: 900, color: '#fff', letterSpacing: 1.5, lineHeight: 1.15 }}>{productName.trim().toUpperCase()}</div>
        {productTagline.trim() && <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginTop: 8, fontStyle: 'italic' }}>{productTagline.trim()}</div>}
      </div>

      {/* Persona attribution */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Exo 2', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 50, padding: '6px 14px', margin: '0 auto' }}>
        <span>🧑</span> Construido para <b style={{ color: '#fff', marginLeft: 2 }}>{persona?.name || 'su persona'}</b>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
        <button onClick={goBack} style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 22px', cursor: 'pointer' }}>← Cambiar algo</button>
        <button
          onClick={deliver}
          disabled={submitting}
          style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#fff', background: 'linear-gradient(135deg,#093c92,#c026d3)', border: 'none', borderRadius: 12, padding: '14px 32px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, boxShadow: '0 4px 22px rgba(192,38,211,0.3)' }}
        >{submitting ? 'Enviando...' : 'Entregar prototipo →'}</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Test the flow** — fill in a name, click "Ver vista previa", verify the product card shows correctly. Click "← Cambiar algo" to go back. Click "Entregar prototipo" and check the network tab that the POST fires with `product_name` in FormData.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/tablets/etapa3/PrototipoV2.tsx
git commit -m "feat: preview screen with product card and delivery action"
```

---

## Task 8: Complete screen with confetti

**Files:**
- Modify: `frontend/src/pages/tablets/etapa3/PrototipoV2.tsx`

- [ ] **Step 1: Add confetti keyframe** — append to the `legoStyle` constant string:

```
@keyframes cfall{0%{opacity:1;transform:translate(0,0) rotate(0deg)}100%{opacity:0;transform:translate(var(--tx),var(--ty)) rotate(var(--rot))}}
.conf-p{position:fixed;pointer-events:none;z-index:400;width:8px;height:8px;border-radius:2px;animation:cfall var(--dur) ease-in forwards}
```

- [ ] **Step 2: Add confetti state and spawn effect** — add these after the `submitting` state declaration:

```tsx
const [confettiPieces, setConfettiPieces] = useState<React.CSSProperties[]>([]);

useEffect(() => {
  if (screen !== 'complete') return;
  const cols = ['#c026d3','#093c92','#f97316','#fbbf24','#10b981','#818cf8','#ef4444'];
  const pieces = Array.from({ length: 60 }, () => ({
    left: `${Math.random() * 100}vw`,
    top: '-10px',
    background: cols[Math.floor(Math.random() * cols.length)],
    '--dur': `${(1.6 + Math.random() * 1.6).toFixed(2)}s`,
    '--tx': `${(Math.random() * 240 - 120).toFixed(0)}px`,
    '--ty': `${(window.innerHeight * 0.55 + Math.random() * window.innerHeight * 0.45).toFixed(0)}px`,
    '--rot': `${(Math.random() * 720 - 360).toFixed(0)}deg`,
    animationDelay: `${(Math.random() * 0.7).toFixed(2)}s`,
  } as React.CSSProperties));
  setConfettiPieces(pieces);
  const t = setTimeout(() => setConfettiPieces([]), 3000);
  return () => clearTimeout(t);
}, [screen]);
```

- [ ] **Step 3: Calculate score** — add this derived value after the `canSubmit` declaration:

```tsx
const score = 600
  + (uploadedDataURL ? 100 : 0)
  + (productName.trim().length >= 2 ? 80 : 0)
  + (productTagline.trim().length >= 10 ? 60 : 0);
```

- [ ] **Step 4: Replace the complete screen placeholder** `{screen === 'complete' && <div>COMPLETE SCREEN (Task 9)</div>}` with:

```tsx
{screen === 'complete' && (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '28px 24px', gap: 18, textAlign: 'center' }}>
    {/* Confetti */}
    {confettiPieces.map((style, i) => (
      <div key={i} className="conf-p" style={style} />
    ))}

    <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 50, padding: '6px 20px' }}>Misión Completada · Fase 3</div>

    <div style={{ fontSize: 'clamp(48px,8vw,68px)' }}>🧱</div>

    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(28px,5.5vw,54px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase' as const, textShadow: '0 0 50px rgba(192,38,211,0.55)', lineHeight: 1.1 }}>¡Prototipo<br/>Entregado!</div>

    <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 'clamp(13px,1.7vw,15px)', fontWeight: 300, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, maxWidth: 440 }}>
      "{productName.trim()}" ya existe en el mundo físico. Construyeron algo real para alguien real — eso es lo que hace una verdadera startup.
    </p>

    {/* Product mini-card */}
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, background: 'rgba(192,38,211,0.08)', border: '1px solid rgba(192,38,211,0.3)', borderRadius: 18, padding: '14px 22px' }}>
      <div style={{ width: 64, height: 64, borderRadius: 12, background: '#0a0e2a', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
        {uploadedDataURL ? <img src={uploadedDataURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧱'}
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>{productName.trim().toUpperCase()}</div>
        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
          {productTagline.trim() || `para ${persona?.name || 'su persona'}`}
        </div>
      </div>
    </div>

    {/* Score */}
    <div style={{ background: 'rgba(192,38,211,0.08)', border: '1px solid rgba(192,38,211,0.2)', borderRadius: 18, padding: '18px 40px' }}>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(40px,8vw,70px)', fontWeight: 900, color: '#c026d3', textShadow: '0 0 30px rgba(192,38,211,0.55)', lineHeight: 1 }}>{score}</div>
      <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.28)', marginTop: 4 }}>puntos obtenidos</div>
    </div>

    <button
      onClick={() => console.log('Fase 3 completada — pendiente de integración con Fase 4')}
      style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#fff', background: 'linear-gradient(135deg,#093c92,#c026d3)', border: 'none', borderRadius: 12, padding: '14px 32px', cursor: 'pointer', boxShadow: '0 4px 22px rgba(192,38,211,0.3)' }}
    >Continuar Misión →</button>
  </div>
)}
```

- [ ] **Step 5: Test the complete flow** — deliver a prototype from the preview screen and verify confetti fires, the score displays correctly, and the product card shows the right name and photo.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/tablets/etapa3/PrototipoV2.tsx
git commit -m "feat: complete screen with confetti burst and score display"
```

---

## Task 9: Wire PrototipoV2 into the router

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update the import** — find this line in `App.tsx` (around line 43):

```tsx
import { TabletPrototipo } from './pages/tablets/etapa3/Prototipo';
```

Add the V2 import below it:

```tsx
import { TabletPrototipoV2 } from './pages/tablets/etapa3/PrototipoV2';
```

- [ ] **Step 2: Update the route** — find this route (around line 121):

```tsx
<Route path="/tablet/etapa3/prototipo" element={<TabletPrototipo />} />
```

Replace with:

```tsx
<Route path="/tablet/etapa3/prototipo" element={<TabletPrototipoV2 />} />
```

- [ ] **Step 3: Verify TypeScript build** — run `cd frontend && npm run build`. Zero errors expected.

- [ ] **Step 4: End-to-end test in browser:**
  - Start docker: `docker-compose up`
  - Create a session, advance to Etapa 3 Prototipo
  - Open `/tablet/etapa3/prototipo?connection_id=<id>`
  - Verify starfield, LEGO bricks, instruction pills render
  - Upload a photo, enter name, submit — check network tab for POST with `product_name`
  - Verify complete screen shows confetti and score
  - In Django admin → TeamActivityProgress → check `response_data` has `product_name` and `prototype_image_url`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: activate TabletPrototipoV2 galactic screen for etapa3 route"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|-----------------|------|
| Galactic theme (dark bg, Orbitron, starfield) | Task 2, 3 |
| LEGO animation merged into upload screen | Task 3 |
| 3-step instruction strip | Task 3 |
| Big countdown timer with warn/danger | Task 2 (timer sync), Task 3 (display) |
| Persona pill with Etapa 2 challenge data | Task 6 |
| Persona panel expandable | Task 6 |
| Photo dropzone (drag-drop + preview) | Task 4 |
| Skip photo option | Task 4 |
| Product naming + tagline + suggestions | Task 5 |
| Progress dots + submit enable/disable | Task 3, 5 |
| Preview card (4:3 photo, name, tagline, persona) | Task 7 |
| Delivery POST with product_name/tagline | Task 7 |
| Complete screen with confetti | Task 8 |
| Score calculation (600+100+80+60) | Task 8 |
| Backend: image optional | Task 1 |
| Backend: save product_name/tagline → response_data | Task 1 |
| PrototipoV2.tsx new file | Task 2 |
| App.tsx route update | Task 9 |

All spec requirements covered. ✓

### Placeholder scan

No "TBD", "TODO", or "similar to Task N" patterns. All code blocks are complete. ✓

### Type consistency

- `PersonaData.name/age/story` used consistently in Tasks 2, 6, 7, 8 ✓
- `screen` typed as `'upload' | 'preview' | 'complete'` used consistently ✓
- `photoReady`, `nameReady`, `canSubmit` derived consistently ✓
- `deliver` defined in Task 7, referenced via button onClick in Task 7 ✓
- `handleFile`, `toggleSkipPhoto` defined in Task 4, used in Task 4 ✓
