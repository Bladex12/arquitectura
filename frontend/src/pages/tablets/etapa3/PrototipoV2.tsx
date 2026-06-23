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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const SUG_LEFT = ['Eco', 'Mente', 'Raíz', 'Co', 'Lumi', 'Aqua', 'Sana', 'Nido', 'Vida', 'Pulso', 'Tierra', 'Aula'];
const SUG_RIGHT = ['Up', 'Lab', 'Link', 'Vivo', 'Tech', 'Mente', 'Fy', 'One', 'Cast', 'Click', 'Red', 'Más'];

function makeSuggestions(): string[] {
  const used = new Set<string>();
  const result: string[] = [];
  while (result.length < 6) {
    const s =
      SUG_LEFT[Math.floor(Math.random() * SUG_LEFT.length)] +
      SUG_RIGHT[Math.floor(Math.random() * SUG_RIGHT.length)];
    if (!used.has(s)) {
      used.add(s);
      result.push(s);
    }
  }
  return result;
}

const LEGO_CSS = `
@keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
.lego-b1{animation:floatB 3s ease-in-out infinite}
.lego-b2{animation:floatB 3s ease-in-out infinite 0.4s}
.lego-b3{animation:floatB 3s ease-in-out infinite 0.8s}
@keyframes cfall{0%{opacity:1;transform:translate(0,0) rotate(0deg)}100%{opacity:0;transform:translate(var(--tx),var(--ty)) rotate(var(--rot))}}
.conf-p{position:fixed;pointer-events:none;z-index:400;width:8px;height:8px;border-radius:2px;animation:cfall var(--dur) ease-in forwards}
`;

// ─── LegoBrick component ──────────────────────────────────────────────────────

function LegoBrick({ color, width, cls }: { color: string; width: number; cls: string }) {
  const studLeft = 22;
  const studRight = width - 40;
  return (
    <div
      className={cls}
      style={{
        width,
        height: 36,
        borderRadius: 5,
        background: color,
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.25), 0 4px 14px rgba(0,0,0,0.4)',
        position: 'relative',
        marginTop: -4,
      }}
    >
      {[studLeft, studRight].map((left, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: -6,
            left,
            width: 18,
            height: 11,
            borderRadius: '50%',
            background: color,
            boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.25)',
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TabletPrototipoV2() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Game state
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setGameSessionId] = useState<number | null>(null);
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

  // Confetti
  const [confettiPieces, setConfettiPieces] = useState<React.CSSProperties[]>([]);

  // Refs
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartTimeRef = useRef<number | null>(null);
  const timerDurationRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionStageIdRef = useRef<number | null>(null);
  const personaLoadedRef = useRef(false);
  const gameSessionIdRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);

  // ─── Game state loading ──────────────────────────────────────────────────────

  useEffect(() => {
    const connId =
      searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) {
      navigate('/tablet/join');
      return;
    }
    loadGameState(connId);
    intervalRef.current = setInterval(() => loadGameState(connId), 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (timerSyncIntervalRef.current) clearInterval(timerSyncIntervalRef.current);
    };
  }, []);

  const loadGameState = async (connId: string) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
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
      gameSessionIdRef.current = statusData.game_session.id;

      const lobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
      const gameData = lobbyData.game_session;

      const resultsUrl = getResultsRedirectUrl(gameData, connId);
      if (resultsUrl) {
        window.location.href = resultsUrl;
        return;
      }

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
        const destBase =
          stageNum === 4
            ? actName.includes('presentaci')
              ? '/tablet/etapa4/presentacion-pitch/'
              : '/tablet/etapa4/formulario-pitch/'
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
        if (!personaLoadedRef.current) {
          const stage2 = stages.find((s: any) => s.stage_number === 2);
          if (stage2) {
            personaLoadedRef.current = true;
            loadPersona(statusData.team.id, stage2.id);
          }
        }
      }

      if (actId && sessionStageIdRef.current) {
        startTimerSync(statusData.game_session.id);
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading game state:', error);
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  };

  // ─── Persona fetch ────────────────────────────────────────────────────────────

  const loadPersona = async (teamId: number, stage2Id: number) => {
    try {
      const progressList = await teamActivityProgressAPI.list({
        team: teamId,
        session_stage: stage2Id,
      });
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
      /* persona is optional */
    }
  };

  // ─── Timer sync ───────────────────────────────────────────────────────────────

  const syncTimer = async (gsId: number) => {
    try {
      const data = await sessionsAPI.getActivityTimer(gsId);
      if (data.started_at && data.timer_duration) {
        timerStartTimeRef.current = new Date(data.started_at).getTime();
        timerDurationRef.current = data.timer_duration;
      }
    } catch {
      /* ignore */
    }
  };

  const startTimerSync = (gsId: number) => {
    if (timerSyncIntervalRef.current) return;
    syncTimer(gsId);
    timerSyncIntervalRef.current = setInterval(() => syncTimer(gsId), 5000);
    const tick = () => {
      if (!timerStartTimeRef.current || !timerDurationRef.current) return;
      const remaining = Math.max(
        0,
        timerDurationRef.current -
          Math.floor((Date.now() - timerStartTimeRef.current) / 1000),
      );
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      setTimerDisplay(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      setTimerState(remaining <= 15 ? 'danger' : remaining <= 60 ? 'warn' : 'normal');
      if (remaining === 0 && timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        if (gameSessionIdRef.current) void advanceActivityOnTimerExpiration(gameSessionIdRef.current);
      }
    };
    tick();
    timerIntervalRef.current = setInterval(tick, 1000);
  };

  // ─── Confetti effect ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (screen !== 'complete') return;
    const cols = ['#c026d3', '#093c92', '#f97316', '#fbbf24', '#10b981', '#818cf8', '#ef4444'];
    const pieces = Array.from({ length: 60 }, () => ({
      left: `${Math.random() * 100}vw`,
      top: '-10px',
      background: cols[Math.floor(Math.random() * cols.length)],
      '--dur': `${(1.6 + Math.random() * 1.6).toFixed(2)}s`,
      '--tx': `${(Math.random() * 240 - 120).toFixed(0)}px`,
      '--ty': `${(
        window.innerHeight * 0.55 +
        Math.random() * window.innerHeight * 0.45
      ).toFixed(0)}px`,
      '--rot': `${(Math.random() * 720 - 360).toFixed(0)}deg`,
      animationDelay: `${(Math.random() * 0.7).toFixed(2)}s`,
    } as React.CSSProperties));
    setConfettiPieces(pieces);
    const t = setTimeout(() => setConfettiPieces([]), 3500);
    return () => clearTimeout(t);
  }, [screen]);

  // ─── Click-outside for persona panel ─────────────────────────────────────────

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-persona-pill]')) setPersonaPanelOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // ─── Derived state & handlers ─────────────────────────────────────────────────

  const photoReady = !!uploadedDataURL || photoSkipped;
  const nameReady = productName.trim().length >= 2;
  const canSubmit = photoReady && nameReady;
  const score =
    600 +
    (uploadedDataURL ? 100 : 0) +
    (productName.trim().length >= 2 ? 80 : 0) +
    (productTagline.trim().length >= 10 ? 60 : 0);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor sube una imagen.');
      return;
    }
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
    if (next) {
      setUploadedFile(null);
      setUploadedDataURL(null);
    }
  };

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
      toast.error(
        'Error al entregar prototipo: ' +
          (error.response?.data?.error || error.message || 'Error desconocido'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────────

  const timerColor =
    timerState === 'danger' ? '#ef4444' : timerState === 'warn' ? '#f97316' : '#ffffff';

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading || !team) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050818',
        }}
      >
        <StarField />
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            color: '#fff',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 14,
            letterSpacing: 3,
          }}
        >
          CARGANDO...
        </div>
      </div>
    );
  }

  // ─── Upload Screen ────────────────────────────────────────────────────────────

  const UploadScreen = (
    <div style={{ padding: '16px 16px 32px', maxWidth: 860, margin: '0 auto' }}>
      {/* Top header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {/* Persona pill */}
        <div style={{ position: 'relative' }} data-persona-pill>
          <button
            data-persona-pill
            onClick={() => setPersonaPanelOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(192,38,211,0.15)',
              border: '1px solid rgba(192,38,211,0.5)',
              borderRadius: 24,
              padding: '8px 16px',
              color: '#fff',
              fontFamily: "'Exo 2', sans-serif",
              fontSize: 13,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span style={{ fontSize: 18 }}>🧑</span>
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>
              {persona ? persona.name : 'Su persona'}
            </span>
            <span style={{ color: 'rgba(192,38,211,0.9)', fontSize: 11 }}>
              {personaPanelOpen ? '▲' : '▼'}
            </span>
          </button>
          {personaPanelOpen && (
            <div
              data-persona-pill
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                zIndex: 50,
                background: 'rgba(5,8,24,0.96)',
                border: '1px solid rgba(192,38,211,0.4)',
                borderRadius: 12,
                padding: 16,
                minWidth: 260,
                maxWidth: 320,
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <p
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 13,
                  color: '#c026d3',
                  marginBottom: 4,
                  letterSpacing: 1,
                }}
              >
                PERSONA OBJETIVO
              </p>
              {persona ? (
                <>
                  <p
                    style={{
                      fontFamily: "'Exo 2', sans-serif",
                      fontWeight: 700,
                      fontSize: 16,
                      color: '#fff',
                      marginBottom: 4,
                    }}
                  >
                    {persona.name}
                    {persona.age ? `, ${persona.age} años` : ''}
                  </p>
                  {persona.story && (
                    <p
                      style={{
                        fontFamily: "'Exo 2', sans-serif",
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.65)',
                        lineHeight: 1.5,
                        marginBottom: 8,
                      }}
                    >
                      {persona.story}
                    </p>
                  )}
                  <p
                    style={{
                      fontSize: 11,
                      color: 'rgba(192,38,211,0.8)',
                      fontStyle: 'italic',
                      fontFamily: "'Exo 2', sans-serif",
                    }}
                  >
                    Construyan pensando en esta persona
                  </p>
                </>
              ) : (
                <p
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.5)',
                    fontFamily: "'Exo 2', sans-serif",
                  }}
                >
                  No hay persona registrada aún.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Big timer */}
        <div
          style={{
            background: 'rgba(192,38,211,0.08)',
            border: '1px solid rgba(192,38,211,0.3)',
            borderRadius: 12,
            padding: '10px 20px',
            textAlign: 'center',
            minWidth: 120,
          }}
        >
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 900,
              color: timerColor,
              lineHeight: 1,
              transition: 'color 0.3s',
            }}
          >
            {timerDisplay}
          </div>
          <div
            style={{
              fontFamily: "'Exo 2', sans-serif",
              fontSize: 10,
              color: 'rgba(255,255,255,0.4)',
              marginTop: 4,
              letterSpacing: 2,
            }}
          >
            TIEMPO
          </div>
        </div>
      </div>

      {/* Phase badge + LEGO bricks */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #093c92, #c026d3)',
              borderRadius: 20,
              padding: '6px 16px',
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>🧱</span>
            <span
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: 2,
              }}
            >
              FASE 3 · PROTOTIPO
            </span>
          </div>
          <h1
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(18px, 3vw, 28px)',
              fontWeight: 900,
              color: '#fff',
              margin: 0,
            }}
          >
            Construyan su solución
          </h1>
        </div>
        {/* LEGO brick stack */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <LegoBrick color="#c026d3" width={120} cls="lego-b1" />
          <LegoBrick color="#093c92" width={100} cls="lego-b2" />
          <LegoBrick color="#f59e0b" width={140} cls="lego-b3" />
        </div>
      </div>

      {/* 3-step instruction pills */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        {[
          {
            n: 1,
            label: (
              <>
                <strong style={{ color: '#fff', fontWeight: 600 }}>Construyan</strong>{' '}
                el prototipo con los Legos
              </>
            ),
          },
          {
            n: 2,
            label: (
              <>
                <strong style={{ color: '#fff', fontWeight: 600 }}>Saquen una foto</strong>{' '}
                cenital y con luz
              </>
            ),
          },
          {
            n: 3,
            label: (
              <>
                <strong style={{ color: '#fff', fontWeight: 600 }}>Pónganle un nombre</strong>{' '}
                a su solución
              </>
            ),
          },
        ].map(({ n, label }) => (
          <div
            key={n}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 24,
              padding: '8px 14px',
              flex: '1 1 200px',
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #093c92, #c026d3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {n}
            </div>
            <span
              style={{
                fontFamily: "'Exo 2', sans-serif",
                fontSize: 13,
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* 2-column card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Photo card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: uploadedDataURL
              ? '1.5px solid #c026d3'
              : photoSkipped
              ? '1.5px solid #10b981'
              : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 20,
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 10,
              color: 'rgba(192,38,211,0.85)',
              letterSpacing: 2,
              marginBottom: 6,
            }}
          >
            PASO 1 · FOTO
          </div>
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 6,
            }}
          >
            Su prototipo en imagen
          </div>
          <div
            style={{
              fontFamily: "'Exo 2', sans-serif",
              fontSize: 12,
              color: 'rgba(255,255,255,0.45)',
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            Foto cenital, fondo limpio. Que se entienda qué construyeron.
          </div>

          {/* Dropzone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onClick={() => {
              if (!photoSkipped) fileInputRef.current?.click();
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 160,
              borderRadius: 12,
              border: photoSkipped
                ? '1.5px solid #10b981'
                : uploadedDataURL
                ? '1.5px solid #c026d3'
                : '1.5px dashed rgba(255,255,255,0.2)',
              background: photoSkipped
                ? 'rgba(16,185,129,0.08)'
                : uploadedDataURL
                ? 'rgba(192,38,211,0.06)'
                : 'rgba(255,255,255,0.03)',
              cursor: photoSkipped ? 'default' : 'pointer',
              padding: 12,
              marginBottom: 12,
              transition: 'border 0.2s, background 0.2s',
            }}
          >
            {photoSkipped ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div
                  style={{
                    fontFamily: "'Exo 2', sans-serif",
                    fontSize: 13,
                    color: '#10b981',
                    fontWeight: 600,
                  }}
                >
                  Paso saltado
                </div>
              </>
            ) : uploadedDataURL ? (
              <img
                src={uploadedDataURL}
                alt="Vista previa"
                style={{
                  maxHeight: 140,
                  maxWidth: '100%',
                  borderRadius: 8,
                  objectFit: 'contain',
                }}
              />
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
                <div
                  style={{
                    fontFamily: "'Exo 2', sans-serif",
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  Toca para subir o arrastra aquí
                </div>
              </>
            )}
          </label>

          {/* Skip checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={photoSkipped}
              onChange={toggleSkipPhoto}
              style={{ marginTop: 2, accentColor: '#10b981' }}
            />
            <span
              style={{
                fontFamily: "'Exo 2', sans-serif",
                fontSize: 11,
                color: 'rgba(255,255,255,0.45)',
                lineHeight: 1.4,
              }}
            >
              No es posible subir una foto en este momento — saltar este paso.
            </span>
          </label>
        </div>

        {/* Naming card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: nameReady
              ? '1.5px solid #c026d3'
              : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 20,
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 10,
              color: 'rgba(192,38,211,0.85)',
              letterSpacing: 2,
              marginBottom: 6,
            }}
          >
            PASO 2 · NOMBRE
          </div>
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 6,
            }}
          >
            Bauticen su solución
          </div>
          <div
            style={{
              fontFamily: "'Exo 2', sans-serif",
              fontSize: 12,
              color: 'rgba(255,255,255,0.45)',
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            Un nombre corto, memorable. Como si fuera el de una startup real.
          </div>

          {/* Product name input */}
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value.slice(0, 28))}
            placeholder="Ej: AmaranTo, Mentea, RaízUp…"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.06)',
              border: nameReady
                ? '1.5px solid #c026d3'
                : '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              padding: '12px 14px',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              outline: 'none',
              marginBottom: 10,
              boxSizing: 'border-box',
              transition: 'border 0.2s',
            }}
          />

          {/* Tagline textarea */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <textarea
              value={productTagline}
              onChange={(e) => setProductTagline(e.target.value.slice(0, 120))}
              placeholder="Frase que describe qué hace… (opcional)"
              rows={2}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '10px 14px',
                fontFamily: "'Exo 2', sans-serif",
                fontSize: 13,
                color: '#fff',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 6,
                right: 10,
                fontFamily: "'Exo 2', sans-serif",
                fontSize: 10,
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              {productTagline.length}/120
            </div>
          </div>

          {/* Suggestion chips */}
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 9,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            SUGERENCIAS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setProductName(s)}
                style={{
                  background: 'rgba(192,38,211,0.1)',
                  border: '1px solid rgba(192,38,211,0.3)',
                  borderRadius: 20,
                  padding: '4px 12px',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background =
                    'rgba(192,38,211,0.25)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background =
                    'rgba(192,38,211,0.1)')
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 16,
                color: photoReady ? '#10b981' : 'rgba(255,255,255,0.3)',
              }}
            >
              {photoReady ? '●' : '○'}
            </span>
            <span
              style={{
                fontFamily: "'Exo 2', sans-serif",
                fontSize: 12,
                color: photoReady ? '#10b981' : 'rgba(255,255,255,0.4)',
              }}
            >
              {uploadedDataURL ? 'Foto lista' : photoSkipped ? 'Foto saltada' : 'Foto pendiente'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 16,
                color: nameReady ? '#10b981' : 'rgba(255,255,255,0.3)',
              }}
            >
              {nameReady ? '●' : '○'}
            </span>
            <span
              style={{
                fontFamily: "'Exo 2', sans-serif",
                fontSize: 12,
                color: nameReady ? '#10b981' : 'rgba(255,255,255,0.4)',
              }}
            >
              {nameReady ? 'Nombre listo' : 'Nombre pendiente'}
            </span>
          </div>
        </div>

        {/* Preview button */}
        <button
          disabled={!canSubmit}
          onClick={() => setScreen('preview')}
          style={{
            background: canSubmit
              ? 'linear-gradient(135deg, #093c92, #c026d3)'
              : 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: 24,
            padding: '12px 28px',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 13,
            fontWeight: 700,
            color: canSubmit ? '#fff' : 'rgba(255,255,255,0.3)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            letterSpacing: 1,
            transition: 'opacity 0.2s',
          }}
        >
          Ver vista previa →
        </button>
      </div>
    </div>
  );

  // ─── Preview Screen ───────────────────────────────────────────────────────────

  const PreviewScreen = (
    <div style={{ padding: '16px 16px 32px', maxWidth: 560, margin: '0 auto' }}>
      {/* Back button */}
      <button
        onClick={() => setScreen('upload')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 20,
          padding: '8px 16px',
          fontFamily: "'Exo 2', sans-serif",
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer',
          marginBottom: 20,
        }}
      >
        ← Cambiar algo
      </button>

      {/* Phase badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(9,60,146,0.3)',
          border: '1px solid rgba(9,60,146,0.5)',
          borderRadius: 20,
          padding: '5px 14px',
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 10,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: 2,
          }}
        >
          VISTA PREVIA
        </span>
      </div>

      {/* Card */}
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          overflow: 'hidden',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* 4:3 photo area */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            paddingTop: '75%',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          {uploadedDataURL ? (
            <img
              src={uploadedDataURL}
              alt="Prototipo"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 64,
              }}
            >
              🧱
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: 20 }}>
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(18px, 4vw, 26px)',
              fontWeight: 900,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: 2,
              marginBottom: 6,
            }}
          >
            {productName || '(Sin nombre)'}
          </div>
          {productTagline && (
            <p
              style={{
                fontFamily: "'Exo 2', sans-serif",
                fontSize: 14,
                color: 'rgba(255,255,255,0.65)',
                fontStyle: 'italic',
                marginBottom: 12,
              }}
            >
              {productTagline}
            </p>
          )}
          {persona && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(192,38,211,0.12)',
                border: '1px solid rgba(192,38,211,0.3)',
                borderRadius: 20,
                padding: '5px 12px',
                marginBottom: 16,
              }}
            >
              <span>🧑</span>
              <span
                style={{
                  fontFamily: "'Exo 2', sans-serif",
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                Construido para {persona.name}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => setScreen('upload')}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                padding: '12px 16px',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 12,
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                letterSpacing: 1,
              }}
            >
              ← Cambiar algo
            </button>
            <button
              disabled={submitting}
              onClick={deliver}
              style={{
                flex: 2,
                background: submitting
                  ? 'rgba(255,255,255,0.08)'
                  : 'linear-gradient(135deg, #093c92, #c026d3)',
                border: 'none',
                borderRadius: 12,
                padding: '12px 16px',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                color: submitting ? 'rgba(255,255,255,0.4)' : '#fff',
                cursor: submitting ? 'not-allowed' : 'pointer',
                letterSpacing: 1,
              }}
            >
              {submitting ? 'Enviando...' : 'Entregar prototipo →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Complete Screen ──────────────────────────────────────────────────────────

  const CompleteScreen = (
    <div
      style={{
        padding: '40px 16px',
        maxWidth: 520,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {/* Confetti */}
      {confettiPieces.map((style, i) => (
        <div key={i} className="conf-p" style={style} />
      ))}

      {/* Mission badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'linear-gradient(135deg, #093c92, #c026d3)',
          borderRadius: 20,
          padding: '6px 18px',
          marginBottom: 20,
        }}
      >
        <span
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: 2,
          }}
        >
          MISIÓN COMPLETADA · FASE 3
        </span>
      </div>

      {/* Brick icon */}
      <div style={{ fontSize: 64, marginBottom: 16 }}>🧱</div>

      {/* Title */}
      <h1
        style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 'clamp(22px, 5vw, 36px)',
          fontWeight: 900,
          color: '#fff',
          marginBottom: 12,
        }}
      >
        ¡Prototipo Entregado!
      </h1>

      {/* Description */}
      <p
        style={{
          fontFamily: "'Exo 2', sans-serif",
          fontSize: 15,
          color: 'rgba(255,255,255,0.7)',
          lineHeight: 1.6,
          marginBottom: 28,
          maxWidth: 420,
          margin: '0 auto 28px',
        }}
      >
        {productName.trim() ? `"${productName.trim()}"` : 'Su prototipo'} ya existe en el mundo
        físico. Han dado el paso más importante: pasar de la idea a la acción.
      </p>

      {/* Product mini-card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          padding: 14,
          marginBottom: 24,
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 10,
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.08)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}
        >
          {uploadedDataURL ? (
            <img
              src={uploadedDataURL}
              alt="thumb"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            '🧱'
          )}
        </div>
        <div>
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 4,
            }}
          >
            {productName.trim() || 'Sin nombre'}
          </div>
          <div
            style={{
              fontFamily: "'Exo 2', sans-serif",
              fontSize: 12,
              color: 'rgba(255,255,255,0.55)',
              fontStyle: 'italic',
            }}
          >
            {productTagline.trim() || `para ${persona?.name || 'su persona'}`}
          </div>
        </div>
      </div>

      {/* Score block */}
      <div
        style={{
          background: 'rgba(192,38,211,0.08)',
          border: '1px solid rgba(192,38,211,0.25)',
          borderRadius: 16,
          padding: '20px 24px',
          marginBottom: 28,
        }}
      >
        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 'clamp(40px, 8vw, 64px)',
            fontWeight: 900,
            color: '#c026d3',
            lineHeight: 1,
            marginBottom: 6,
          }}
        >
          {score}
        </div>
        <div
          style={{
            fontFamily: "'Exo 2', sans-serif",
            fontSize: 13,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: 2,
          }}
        >
          PUNTOS OBTENIDOS
        </div>
      </div>

      <div
        style={{
          fontFamily: "'Exo 2', sans-serif",
          fontSize: 13,
          color: 'rgba(255,255,255,0.35)',
          marginTop: 16,
          letterSpacing: 1,
          textAlign: 'center',
        }}
      >
        El juego continuará cuando el profesor avance la misión
      </div>
    </div>
  );

  // ─── Main render ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050818',
        color: '#fff',
        fontFamily: "'Exo 2', sans-serif",
        overflowX: 'hidden',
      }}
    >
      <style>{LEGO_CSS}</style>
      <StarField />
      <div style={{ position: 'relative', zIndex: 10 }}>
        {screen === 'upload' && UploadScreen}
        {screen === 'preview' && PreviewScreen}
        {screen === 'complete' && CompleteScreen}
      </div>
    </div>
  );
}
