# Reflexión Galactic Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blue-pink gradient style on both Reflexión screens with the same dark galactic aesthetic used by every other screen in the game.

**Architecture:** Pure visual swap — `GalacticPage` + inline styles + `galactic.css` classes replace `framer-motion` particles, shadcn cards, and the old gradient background. All business logic (API calls, polling, state) is preserved verbatim. The professor screen gets a new mini bar-chart podium (top 3 animated bars + compact rest list) instead of the old medal card grid.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, `galactic.css` (`.glass-card`, `.galactic-label`, `.btn-galactic-secondary`), `GalacticPage` component, `framer-motion` removed from both files.

---

## Files

| Action | Path |
|---|---|
| Modify | `frontend/src/pages/profesor/Reflexion.tsx` |
| Modify | `frontend/src/pages/tablets/Reflexion.tsx` |

---

### Task 1: Redesign `ProfesorReflexion`

**File:** `frontend/src/pages/profesor/Reflexion.tsx`

- [ ] **Step 1: Replace the file contents**

Keep every line of state, hooks, and handler functions **exactly as-is**. Only the `return` block and imports change.

Replace the entire file with:

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { GalacticPage } from '@/components/GalacticPage';
import { CancelSessionModal } from '@/components/CancelSessionModal';
import { sessionsAPI, reflectionEvaluationsAPI } from '@/services';
import { toast } from 'sonner';

interface GameSession {
  id: number;
  room_code: string;
  status: string;
}

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total?: number;
}

const BAR_HEIGHTS = [120, 80, 58]; // index 0 = 1st place, 1 = 2nd, 2 = 3rd
const BAR_STYLES: React.CSSProperties[] = [
  { background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 16px rgba(251,191,36,0.2)' },
  { background: 'rgba(156,163,175,0.2)',  border: '1px solid rgba(156,163,175,0.3)' },
  { background: 'rgba(249,115,22,0.15)',  border: '1px solid rgba(249,115,22,0.25)' },
];
const MEDALS = ['🥇', '🥈', '🥉'];

function PodiumBar({ team, rank }: { team: Team; rank: 1 | 2 | 3 }) {
  const idx = rank - 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: team.color || '#667eea',
        border: rank === 1 ? '2px solid rgba(251,191,36,0.6)' : '2px solid rgba(255,255,255,0.25)',
        boxShadow: rank === 1 ? '0 0 14px rgba(251,191,36,0.35)' : undefined,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: "'Orbitron', monospace",
      }}>
        {team.name.slice(0, 2).toUpperCase()}
      </div>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{MEDALS[idx]}</span>
      <div style={{
        ...BAR_STYLES[idx],
        height: BAR_HEIGHTS[idx], width: 70,
        borderRadius: '8px 8px 0 0',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 7,
      }}>
        <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 10, fontWeight: 700, color: rank === 1 ? '#fbbf24' : 'rgba(255,255,255,0.9)' }}>
          {team.tokens_total ?? 0}
        </span>
      </div>
      <span style={{ fontSize: 9, color: rank === 1 ? '#fbbf24' : 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: 78, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {team.name}
      </span>
    </div>
  );
}

const SURVEY_QUESTIONS = [
  '¿Qué tan efectiva fue la comunicación en tu equipo?',
  '¿Qué tan creativa fue la solución propuesta?',
  '¿Cómo calificarías el trabajo en equipo?',
  '¿Qué tan empático fue tu equipo con el problema?',
  '¿Qué tan bien se organizaron las tareas?',
  '¿Qué tan satisfecho estás con el resultado final?',
];

export function ProfesorReflexion() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [totalEstudiantes, setTotalEstudiantes] = useState(0);
  const [estudiantesRespondidos, setEstudiantesRespondidos] = useState(0);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [evaluationUrl, setEvaluationUrl] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [completedStages, setCompletedStages] = useState<any[]>([]);

  useEffect(() => {
    if (sessionId) {
      loadSessionData();
      const interval = setInterval(() => { loadProgress(); }, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionId]);

  const loadSessionData = async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      const lobbyData = await sessionsAPI.getLobby(sessionId);
      const sessionData = lobbyData.game_session;
      setGameSession(sessionData);
      const teamsData = Array.isArray(lobbyData.teams) ? lobbyData.teams : [];
      setTeams(teamsData);
      const total = teamsData.reduce((sum: number, team: any) => {
        const count = team.students_count ?? team.students?.length ?? 0;
        return sum + count;
      }, 0);
      setTotalEstudiantes(total);
      loadProgress();
      loadCompletedStages();
      loadReflectionQR();
    } catch (error: any) {
      console.error('Error loading session data:', error);
      toast.error('Error al cargar la información de la sesión');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!sessionId || !gameSession?.room_code) return;
    try {
      const evaluationsData = await reflectionEvaluationsAPI.byRoom(gameSession.room_code);
      if (evaluationsData && typeof evaluationsData === 'object') {
        if ('count' in evaluationsData) {
          setEstudiantesRespondidos(evaluationsData.count || 0);
          if ('total_students' in evaluationsData && evaluationsData.total_students !== undefined && evaluationsData.total_students > 0) {
            setTotalEstudiantes(evaluationsData.total_students);
          }
        } else {
          const arr = Array.isArray(evaluationsData) ? evaluationsData : (evaluationsData.results || []);
          setEstudiantesRespondidos(arr.length);
        }
      } else {
        setEstudiantesRespondidos(Array.isArray(evaluationsData) ? evaluationsData.length : 0);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const loadCompletedStages = async () => {
    if (!sessionId) return;
    try {
      const stagesData = await sessionsAPI.getSessionStages(Number(sessionId));
      const stagesArray = Array.isArray(stagesData) ? stagesData : [stagesData];
      const completed = stagesArray
        .filter((stage: any) => stage.status === 'completed')
        .sort((a: any, b: any) => {
          const numA = a?.stage?.number ?? a?.stage_number ?? 0;
          const numB = b?.stage?.number ?? b?.stage_number ?? 0;
          return numA - numB;
        });
      setCompletedStages(completed);
    } catch (error) {
      console.error('Error loading completed stages:', error);
    }
  };

  const loadReflectionQR = async () => {
    if (!sessionId) return;
    try {
      const qrData = await sessionsAPI.getReflectionQR(sessionId);
      if (qrData?.qr_code) {
        setQrCode(qrData.qr_code);
        setEvaluationUrl(qrData.evaluation_url);
      } else {
        toast.error('No se pudo generar el código QR');
      }
    } catch (error: any) {
      toast.error('Error al cargar el código QR: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleFinalizeSession = async () => {
    if (!sessionId) return;
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async (reason: string, reasonOther?: string) => {
    if (!sessionId) return;
    setFinalizing(true);
    try {
      await sessionsAPI.finish(Number(sessionId), reason, reasonOther || 'Sesión completada después de reflexión');
      toast.success('Sesión finalizada correctamente. Las tablets permanecerán en reflexión.');
      if (gameSession) setGameSession({ ...gameSession, status: 'completed' });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al finalizar la sesión');
    } finally {
      setFinalizing(false);
      setCancelModalOpen(false);
    }
  };

  const porcentajeCompletado = totalEstudiantes > 0
    ? (estudiantesRespondidos / totalEstudiantes) * 100
    : 0;

  if (loading) {
    return (
      <GalacticPage>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      </GalacticPage>
    );
  }

  const teamsOrdered = [...teams].sort((a, b) => (b.tokens_total ?? 0) - (a.tokens_total ?? 0));
  const isFinished = gameSession?.status === 'completed' || gameSession?.status === 'cancelled';

  return (
    <GalacticPage padding="p-4">
      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Top bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="galactic-label" style={{ marginBottom: 4, fontSize: 10, letterSpacing: 3 }}>
              Control de Misión · Reflexión Final
            </p>
            <h1 style={{ fontFamily: "'Orbitron', monospace", fontSize: 22, fontWeight: 700 }}>
              Reflexión Final
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              background: 'rgba(192,38,211,0.15)', border: '1px solid rgba(192,38,211,0.4)',
              borderRadius: 8, padding: '6px 14px',
              fontFamily: "'Orbitron', monospace", fontSize: 14, color: '#c026d3', letterSpacing: 2,
            }}>
              {gameSession?.room_code}
            </span>
            {isFinished && (
              <span style={{
                background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)',
                borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#34d399', fontWeight: 600,
              }}>
                ✓ Sesión Finalizada
              </span>
            )}
            {!isFinished && (
              <button
                onClick={handleFinalizeSession}
                disabled={finalizing}
                className="btn-galactic-secondary"
                style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444', fontSize: 12, padding: '7px 14px', letterSpacing: 1 }}
              >
                {finalizing
                  ? <><Loader2 className="w-3 h-3 inline animate-spin" style={{ marginRight: 4 }} />Finalizando...</>
                  : 'Finalizar Sesión'}
              </button>
            )}
            <button
              onClick={() => navigate('/profesor/panel')}
              className="btn-galactic-secondary"
              style={{ fontSize: 12, padding: '7px 14px', letterSpacing: 1 }}
            >
              ← Volver al Panel
            </button>
          </div>
        </div>

        {/* ── Podium ── */}
        <div className="glass-card" style={{ padding: 20, borderColor: 'rgba(251,191,36,0.2)' }}>
          <p className="galactic-label" style={{ marginBottom: 14, fontSize: 10, letterSpacing: 3 }}>
            🏆 Clasificación Final
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'flex-end' }}>
            {/* Bar chart: 2nd | 1st | 3rd */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 22, height: 150 }}>
              {teamsOrdered[1] && <PodiumBar team={teamsOrdered[1]} rank={2} />}
              {teamsOrdered[0] && <PodiumBar team={teamsOrdered[0]} rank={1} />}
              {teamsOrdered[2] && <PodiumBar team={teamsOrdered[2]} rank={3} />}
            </div>
            {/* Rest list */}
            {teamsOrdered.length > 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p className="galactic-label" style={{ marginBottom: 4, fontSize: 9, letterSpacing: 2 }}>
                  Resto de equipos
                </p>
                {teamsOrdered.slice(3).map((team, i) => (
                  <div key={team.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 8,
                  }}>
                    <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 9, color: 'rgba(255,255,255,0.3)', width: 16 }}>
                      {i + 4}°
                    </span>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: team.color || '#667eea', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', flex: 1 }}>{team.name}</span>
                    <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 9, color: 'rgba(251,191,36,0.8)' }}>
                      ★ {team.tokens_total ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── QR + Questions ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* QR card */}
          <div className="glass-card" style={{ padding: 20 }}>
            <p className="galactic-label" style={{ marginBottom: 14, fontSize: 10, letterSpacing: 3 }}>
              Encuesta de Reflexión
            </p>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontFamily: "'Orbitron', monospace", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
                Escanea el Código QR
              </h2>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 14 }}>
                Los estudiantes deben escanear este código con sus teléfonos móviles
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                {qrCode ? (
                  <img
                    src={qrCode}
                    alt="QR Code Evaluación"
                    style={{ width: 130, height: 130, border: '2px solid rgba(192,38,211,0.4)', borderRadius: 12, boxShadow: '0 0 18px rgba(192,38,211,0.15)' }}
                  />
                ) : (
                  <div style={{ width: 130, height: 130, border: '2px solid rgba(192,38,211,0.4)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)' }}>
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              {/* Steps */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
                {['Abre la cámara de tu teléfono', 'Escanea el código QR', 'Completa la encuesta'].map((text, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 5px', textAlign: 'center' }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #093c92, #c026d3)',
                      boxShadow: '0 0 6px rgba(192,38,211,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, margin: '0 auto 4px',
                    }}>
                      {i + 1}
                    </div>
                    <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>{text}</p>
                  </div>
                ))}
              </div>
              {/* Progress */}
              <div style={{ background: 'rgba(192,38,211,0.08)', border: '1px solid rgba(192,38,211,0.2)', borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>✓ Progreso de respuestas</span>
                  <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, color: '#c026d3' }}>
                    {estudiantesRespondidos} / {totalEstudiantes}
                  </span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #093c92, #c026d3)', borderRadius: 3, width: `${porcentajeCompletado}%`, boxShadow: '0 0 6px rgba(192,38,211,0.5)', transition: 'width 0.5s ease' }} />
                </div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'right' }}>
                  {porcentajeCompletado.toFixed(0)}% completado
                </p>
              </div>
            </div>
          </div>

          {/* Survey questions card */}
          <div className="glass-card" style={{ padding: 20 }}>
            <p className="galactic-label" style={{ marginBottom: 14, fontSize: 10, letterSpacing: 3 }}>
              Preguntas de la Encuesta
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {SURVEY_QUESTIONS.map((q, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 9px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
                  <div style={{
                    width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #093c92, #c026d3)',
                    boxShadow: '0 0 5px rgba(192,38,211,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700,
                  }}>
                    {i + 1}
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{q}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <CancelSessionModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        currentStage={gameSession?.current_stage_name}
        currentActivity={gameSession?.current_activity_name}
        roomCode={gameSession?.room_code}
      />
    </GalacticPage>
  );
}
```

- [ ] **Step 2: Run TypeScript build check**

```bash
cd frontend && npm run build 2>&1 | tail -30
```

Expected: no errors in `Reflexion.tsx`. Warnings about unused variables are OK; errors are not.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/profesor/Reflexion.tsx
git commit -m "feat: apply galactic design to professor Reflexion screen"
```

---

### Task 2: Redesign `TabletReflexion`

**File:** `frontend/src/pages/tablets/Reflexion.tsx`

- [ ] **Step 1: Replace the file contents**

Keep all state, hooks, and handler functions verbatim. Only imports and the `return` block change.

```tsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { GalacticPage } from '@/components/GalacticPage';
import { sessionsAPI, reflectionEvaluationsAPI, tabletConnectionsAPI } from '@/services';
import { toast } from 'sonner';

export function TabletReflexion() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalEstudiantes, setTotalEstudiantes] = useState(0);
  const [estudiantesRespondidos, setEstudiantesRespondidos] = useState(0);
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) {
      navigate('/tablet/join');
      return;
    }
    setConnectionId(connId);
    loadSessionData(connId);
    const interval = setInterval(() => { loadProgress(); }, 5000);
    return () => clearInterval(interval);
  }, [searchParams, navigate]);

  const loadSessionData = async (connId: string) => {
    try {
      setLoading(true);
      let statusData;
      try {
        statusData = await tabletConnectionsAPI.getStatus(connId);
      } catch (error: any) {
        if (error.response?.status === 404) {
          toast.error('Conexión no encontrada, pero permaneciendo en reflexión');
          return;
        }
        throw error;
      }
      const sessionId = statusData.game_session.id;
      setGameSessionId(sessionId);
      if (sessionId) loadReflectionQR(sessionId);
      setTimeout(() => { loadProgress(); }, 100);
    } catch (error: any) {
      console.error('Error loading session data:', error);
      toast.error('Error al cargar la información');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!gameSessionId) return;
    try {
      const lobbyData = await sessionsAPI.getLobby(gameSessionId);
      const roomCode = lobbyData.game_session.room_code;
      const evaluationsData = await reflectionEvaluationsAPI.byRoom(roomCode);
      if (evaluationsData && typeof evaluationsData === 'object') {
        if ('count' in evaluationsData) {
          setEstudiantesRespondidos(evaluationsData.count || 0);
          let calculatedTotal = 0;
          if (lobbyData.teams && Array.isArray(lobbyData.teams)) {
            calculatedTotal = lobbyData.teams.reduce((sum: number, team: any) => {
              return sum + (team.students_count ?? team.students?.length ?? 0);
            }, 0);
          }
          if ('total_students' in evaluationsData && evaluationsData.total_students > 0) {
            setTotalEstudiantes(evaluationsData.total_students);
          } else if (calculatedTotal > 0) {
            setTotalEstudiantes(calculatedTotal);
          }
        } else {
          const arr = Array.isArray(evaluationsData) ? evaluationsData : (evaluationsData.results || []);
          setEstudiantesRespondidos(arr.length);
        }
      } else {
        setEstudiantesRespondidos(Array.isArray(evaluationsData) ? evaluationsData.length : 0);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const loadReflectionQR = async (sessionId: number) => {
    try {
      const qrData = await sessionsAPI.getReflectionQR(sessionId);
      if (qrData?.qr_code) setQrCode(qrData.qr_code);
    } catch (error: any) {
      console.error('Error loading QR:', error);
    }
  };

  const porcentajeCompletado = totalEstudiantes > 0
    ? (estudiantesRespondidos / totalEstudiantes) * 100
    : 0;

  if (loading) {
    return (
      <GalacticPage>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      </GalacticPage>
    );
  }

  return (
    <GalacticPage>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(192,38,211,0.15)',
            border: '1px solid rgba(192,38,211,0.4)',
            borderRadius: 999, padding: '5px 18px', marginBottom: 12,
          }}>
            <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, fontWeight: 600, color: '#c026d3', letterSpacing: 2, textTransform: 'uppercase' }}>
              Reflexión Final
            </p>
          </div>
          <h1 style={{ fontFamily: "'Orbitron', monospace", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Encuesta de Reflexión
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
            Escanea el código QR con tu teléfono para completar la encuesta
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: 24, width: '100%', maxWidth: 480 }}>
          <h2 style={{ fontFamily: "'Orbitron', monospace", fontSize: 14, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
            Escanea el Código QR
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 16 }}>
            Usa la cámara de tu teléfono móvil para escanear
          </p>

          {/* QR */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            {qrCode ? (
              <img
                src={qrCode}
                alt="QR Code Evaluación"
                style={{ width: 130, height: 130, border: '2px solid rgba(192,38,211,0.4)', borderRadius: 12, boxShadow: '0 0 18px rgba(192,38,211,0.15)' }}
              />
            ) : (
              <div style={{ width: 130, height: 130, border: '2px solid rgba(192,38,211,0.4)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)' }}>
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Steps */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 16 }}>
            {['Abre la cámara de tu teléfono', 'Escanea el código QR', 'Completa la encuesta'].map((text, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 5px', textAlign: 'center' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #093c92, #c026d3)',
                  boxShadow: '0 0 6px rgba(192,38,211,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, margin: '0 auto 5px',
                }}>
                  {i + 1}
                </div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>{text}</p>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div style={{ background: 'rgba(192,38,211,0.08)', border: '1px solid rgba(192,38,211,0.2)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>✓ Progreso de respuestas</span>
              <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, color: '#c026d3' }}>
                {totalEstudiantes > 0 ? `${estudiantesRespondidos} / ${totalEstudiantes}` : 'Cargando...'}
              </span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #093c92, #c026d3)', borderRadius: 3, width: `${porcentajeCompletado}%`, boxShadow: '0 0 6px rgba(192,38,211,0.5)', transition: 'width 0.5s ease' }} />
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'right' }}>
              {totalEstudiantes > 0 ? `${porcentajeCompletado.toFixed(0)}% completado` : 'Cargando...'}
            </p>
          </div>
        </div>

      </div>
    </GalacticPage>
  );
}
```

- [ ] **Step 2: Run TypeScript build check**

```bash
cd frontend && npm run build 2>&1 | tail -30
```

Expected: no errors in `tablets/Reflexion.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/tablets/Reflexion.tsx
git commit -m "feat: apply galactic design to tablet Reflexion screen"
```

---

## Verification

After both tasks:

1. Start the dev server: `docker-compose up`
2. Log in as professor, complete a game session, navigate to Reflexión (`/profesor/reflexion/:id`)
   - Dark starfield visible, no gradient
   - Podium shows 3 bars (2nd | 1st | 3rd), gold glow on 1st
   - Teams with rank 4+ appear in the right column (only if `teams.length > 3`)
   - QR image loads with magenta glow border
   - Progress bar updates every 5 s
   - "Finalizar Sesión" button hidden after session is finalized
3. On a tablet, navigate to `/tablet/reflexion`
   - Centered galactic layout, "Reflexión Final" pill, Orbitron title
   - Same QR card, same progress logic
4. Confirm no regressions: navigate through Etapa 1–4 professor and tablet screens, verify they render normally
