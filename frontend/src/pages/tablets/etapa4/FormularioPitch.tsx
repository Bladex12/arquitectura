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

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total?: number;
}

interface GameSession {
  id: number;
  current_activity: number | null;
  current_activity_name: string | null;
  current_stage_number?: number;
  show_results_stage?: number;
}

export function TabletFormularioPitch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<number | null>(null);
  const [currentSessionStageId, setCurrentSessionStageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [showUBotModal, setShowUBotModal] = useState(false);

  const [pitchIntroProblem, setPitchIntroProblem] = useState('');
  const [pitchSolution, setPitchSolution] = useState('');
  const [pitchValue, setPitchValue] = useState('');
  const [pitchImpact, setPitchImpact] = useState('');
  const [pitchClosing, setPitchClosing] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [view, setView] = useState<'builder' | 'preview'>('builder');
  const [personaName, setPersonaName] = useState<string | null>(null);
  const [prototypeName, setPrototypeName] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUpdatingFromServerRef = useRef<boolean>(false);
  const isTypingRef = useRef<boolean>(false);
  const focusedFieldRef = useRef<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartTimeRef = useRef<number | null>(null);
  const timerDurationRef = useRef<number | null>(null);

  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) {
      navigate('/tablet/join');
      return;
    }
    loadGameState(connId);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (timerSyncIntervalRef.current) clearInterval(timerSyncIntervalRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [searchParams, navigate]);

  const loadGameState = async (connId: string) => {
    try {
      const statusData = await tabletConnectionsAPI.getStatus(connId);

      if (!statusData || !statusData.team) {
        toast.error('Conexión no encontrada. Por favor reconecta.');
        setTimeout(() => {
          navigate('/tablet/join');
        }, 2000);
        return;
      }

      const teamData: Team = statusData.team;
      setTeam(teamData);

      const lobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
      const gameData: GameSession = lobbyData.game_session;
      const sessionId = statusData.game_session.id;

      const resultsUrl = getResultsRedirectUrl(gameData, connId);
      if (resultsUrl) { window.location.href = resultsUrl; return; }

      if (gameData.current_stage_number === 4) {
        const ubotKey = `ubot_formulario_pitch_${sessionId}`;
        const hasSeenUBot = localStorage.getItem(ubotKey);
        if (!hasSeenUBot) {
          setTimeout(() => {
            setShowUBotModal(true);
            localStorage.setItem(ubotKey, 'true');
          }, 500);
        }
      }

      const currentStageNumber = gameData.current_stage_number || 1;
      const currentActivityName = gameData.current_activity_name?.toLowerCase() || '';

      if (currentStageNumber !== 4) {
        if (currentStageNumber === 3) {
          const normalizedName = currentActivityName;
          if (normalizedName.includes('prototipo') || normalizedName.includes('lego')) {
            window.location.href = `/tablet/etapa3/prototipo/?connection_id=${connId}`;
          } else {
            window.location.href = `/tablet/etapa3/resultados/?connection_id=${connId}`;
          }
        } else {
          window.location.href = `/tablet/lobby?connection_id=${connId}`;
        }
        return;
      }

      if (currentActivityName && (currentActivityName.includes('presentacion') || currentActivityName.includes('presentación'))) {
        window.location.href = `/tablet/etapa4/presentacion-pitch/?connection_id=${connId}`;
        return;
      }

      if (!gameData.current_activity) {
        window.location.href = `/tablet/etapa4/resultados/?connection_id=${connId}`;
        return;
      }

      if (currentActivityId && gameData.current_activity !== currentActivityId && !currentActivityName.includes('formulario')) {
        window.location.href = `/tablet/lobby?connection_id=${connId}`;
        return;
      }

      setCurrentActivityId(gameData.current_activity);

      const stages = await sessionsAPI.getSessionStages(statusData.game_session.id);
      const stagesArray = Array.isArray(stages) ? stages : [];
      const sessionStage = stagesArray.find((s: any) => s.stage_number === 4) || null;

      if (sessionStage) {
        setCurrentSessionStageId(sessionStage.id);
        if (!isTypingRef.current && !focusedFieldRef.current) {
          await loadPitchStatus(teamData.id, gameData.current_activity, sessionStage.id);
        }
        startTimer(statusData.game_session.id);
      }

      setLoading(false);
      void loadPersonaAndPrototype(teamData.id, statusData.game_session.id);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        if (!isTypingRef.current && !focusedFieldRef.current && !isUpdatingFromServerRef.current) {
          loadGameState(connId);
        }
      }, 5000);
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.message === 'Request aborted') {
        return;
      }
      console.error('Error loading game state:', error);
      if (error.code !== 'ECONNABORTED' && error.message !== 'Request aborted') {
        toast.error('Error de conexión: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
      }
      setLoading(false);
    }
  };

  const loadPitchStatus = async (teamId: number, activityId: number, sessionStageId: number) => {
    if (isTypingRef.current || focusedFieldRef.current || isUpdatingFromServerRef.current) {
      return;
    }

    try {
      const progressList = await teamActivityProgressAPI.list({
        team: teamId,
        activity: activityId,
        session_stage: sessionStageId,
      });
      const progressArray = Array.isArray(progressList) ? progressList : [];
      const progress = progressArray[0];

      if (progress) {
        const serverIntro = progress.pitch_intro_problem || '';
        const serverSolution = progress.pitch_solution || '';
        const serverValue = progress.pitch_value || '';
        const serverImpact = progress.pitch_impact || '';
        const serverClosing = progress.pitch_closing || '';

        if (isTypingRef.current || focusedFieldRef.current || isUpdatingFromServerRef.current) {
          return;
        }

        isUpdatingFromServerRef.current = true;

        if (focusedFieldRef.current !== 'intro_problem' && serverIntro !== pitchIntroProblem) {
          setPitchIntroProblem(serverIntro);
        }
        if (focusedFieldRef.current !== 'solution' && serverSolution !== pitchSolution) {
          setPitchSolution(serverSolution);
        }
        if (focusedFieldRef.current !== 'value' && serverValue !== pitchValue) {
          setPitchValue(serverValue);
        }
        if (focusedFieldRef.current !== 'impact' && serverImpact !== pitchImpact) {
          setPitchImpact(serverImpact);
        }
        if (focusedFieldRef.current !== 'closing' && serverClosing !== pitchClosing) {
          setPitchClosing(serverClosing);
        }

        setHasSaved(progress.status === 'completed');

        setTimeout(() => {
          isUpdatingFromServerRef.current = false;
        }, 100);
      }
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.message === 'Request aborted') {
        return;
      }
      if (error.code !== 'ECONNABORTED' && error.message !== 'Request aborted') {
        console.error('Error loading pitch status:', error);
      }
      isUpdatingFromServerRef.current = false;
    }
  };

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

  const startTimer = async (gameSessionId: number) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (timerSyncIntervalRef.current) {
      clearInterval(timerSyncIntervalRef.current);
      timerSyncIntervalRef.current = null;
    }

    try {
      const timerData = await sessionsAPI.getActivityTimer(gameSessionId);

      if (timerData.error || !timerData.timer_duration) {
        return;
      }

      timerDurationRef.current = timerData.timer_duration;
      timerStartTimeRef.current = timerData.started_at
        ? new Date(timerData.started_at).getTime()
        : new Date(timerData.current_time).getTime();

      const updateTimer = () => {
        if (timerStartTimeRef.current && timerDurationRef.current) {
          const now = Date.now();
          const elapsed = Math.floor((now - timerStartTimeRef.current) / 1000);
          const remaining = Math.max(0, timerDurationRef.current - elapsed);

          const minutes = Math.floor(remaining / 60);
          const seconds = remaining % 60;
          setTimerRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

          if (remaining <= 0) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            setTimerRemaining('00:00');
            void advanceActivityOnTimerExpiration(gameSessionId);
          }
        }
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);

      if (timerSyncIntervalRef.current) {
        clearInterval(timerSyncIntervalRef.current);
      }

      timerSyncIntervalRef.current = setInterval(async () => {
        try {
          const syncData = await sessionsAPI.getActivityTimer(gameSessionId);
          if (syncData.started_at && syncData.timer_duration) {
            timerStartTimeRef.current = new Date(syncData.started_at).getTime();
            timerDurationRef.current = syncData.timer_duration;
          }
        } catch (error: any) {
          if (error.code !== 'ECONNABORTED' && error.message !== 'Request aborted') {
            console.error('Error syncing timer:', error);
          }
        }
      }, 5000);
    } catch (error: any) {
      if (error.code !== 'ECONNABORTED' && error.message !== 'Request aborted') {
        console.error('Error starting timer:', error);
      }
    }
  };

  const savePitch = async (showToast = true) => {
    if (!team || !currentActivityId || !currentSessionStageId) {
      if (showToast) toast.error('Faltan datos necesarios');
      return;
    }

    try {
      await teamActivityProgressAPI.savePitch({
        team_id: team.id,
        activity_id: currentActivityId,
        session_stage_id: currentSessionStageId,
        pitch_intro_problem: pitchIntroProblem,
        pitch_solution: pitchSolution,
        pitch_value: pitchValue,
        pitch_impact: pitchImpact,
        pitch_closing: pitchClosing,
      });

      const fieldsCompleted = [pitchIntroProblem, pitchSolution, pitchValue, pitchImpact, pitchClosing].filter(Boolean).length;

      if (fieldsCompleted === 5) {
        setHasSaved(true);
        if (showToast) toast.success('✓ Pitch guardado exitosamente');
      } else {
        if (showToast) toast.success(`Pitch guardado (${Math.floor((fieldsCompleted / 5) * 100)}% completado)`);
      }
    } catch (error: any) {
      console.error('Error saving pitch:', error);
      if (showToast) toast.error('Error al guardar: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
    }
  };

  const handleSavePitch = async () => {
    setSaving(true);
    await savePitch(true);
    setSaving(false);
  };

  const handleFieldChange = (field: 'intro_problem' | 'solution' | 'value' | 'impact' | 'closing', value: string) => {
    if (isUpdatingFromServerRef.current) {
      return;
    }

    isTypingRef.current = true;

    if (field === 'intro_problem') {
      setPitchIntroProblem(value);
    } else if (field === 'solution') {
      setPitchSolution(value);
    } else if (field === 'value') {
      setPitchValue(value);
    } else if (field === 'impact') {
      setPitchImpact(value);
    } else if (field === 'closing') {
      setPitchClosing(value);
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      savePitch(false);
    }, 2000);
  };

  const handleFieldFocus = (field: 'intro_problem' | 'solution' | 'value' | 'impact' | 'closing') => {
    setFocusedField(field);
    focusedFieldRef.current = field;
    isTypingRef.current = true;
  };

  const handleFieldBlur = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    savePitch(false);

    setTimeout(() => {
      setFocusedField(null);
      focusedFieldRef.current = null;
      isTypingRef.current = false;
    }, 500);
  };

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
                  border: '1px solid rgba(255,255,255,0.1)',
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

                  {/* Textarea + footer (span column 2) */}
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

            <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(20px,3.2vw,28px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(192,38,211,0.5)', margin: 0 }}>
              Su Pitch
            </h2>

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
