import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Clock, Loader2, CheckCircle2, XCircle, Gamepad2, Coins, Hand, UserPlus, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UBotPersonalizacionModal } from '@/components/UBotPersonalizacionModal';
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';
import { toast } from 'sonner';
import { tabletConnectionsAPI, sessionsAPI, teamPersonalizationsAPI } from '@/services';
import { advanceActivityOnTimerExpiration } from '@/utils/timerAutoAdvance';
import { getResultsRedirectUrl } from '@/utils/tabletResultsRedirect';

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total?: number;
}

interface Personalization {
  id?: number;
  team_name?: string;
  team_members_know_each_other?: boolean;
}

export function TabletPersonalizacion() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [personalization, setPersonalization] = useState<Personalization | null>(null);
  const [teamName, setTeamName] = useState('');
  const [knowEachOther, setKnowEachOther] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<number | null>(null);
  const [showUBotModal, setShowUBotModal] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeExpiredRef = useRef<boolean>(false);
  const activityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) {
      navigate('/tablet/join');
      return;
    }
    setConnectionId(connId);
    
    const loadInitialData = async () => {
      try {
        const statusData = await tabletConnectionsAPI.getStatus(connId);
        if (!statusData || !statusData.team || !statusData.game_session) {
          toast.error('Conexión no válida');
          navigate('/tablet/join');
          return;
        }

        setTeam(statusData.team);
        // Usar lobby en lugar de getById para evitar problemas de autenticación
        const lobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
        const gameData = lobbyData.game_session;
        const sessionId = statusData.game_session.id;
        setGameSessionId(sessionId);

        // Guardar valores iniciales para comparación (COMO EN ETAPA 2)
        const initialActivityId = gameData.current_activity;
        const initialActivityName = gameData.current_activity_name || '';
        const initialSessionStageId = gameData.current_session_stage;
        const initialStageNumber = gameData.current_stage_number;

        // Mostrar U-Bot directamente si no se ha visto
        if (gameData.current_stage_number === 1) {
          const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
          if (connId) {
            const hasSeenUBot = localStorage.getItem(`ubot_modal_personalizacion_${connId}`);
            if (!hasSeenUBot) {
              setTimeout(() => {
                setShowUBotModal(true);
                localStorage.setItem(`ubot_modal_personalizacion_${connId}`, 'true');
              }, 500);
            }
          }
        }

        // Verificar si el juego ha finalizado o está en lobby
        if (gameData.status === 'finished' || gameData.status === 'completed') {
          toast.info('El juego ha finalizado. Redirigiendo...');
          setTimeout(() => {
            navigate('/tablet/join');
          }, 2000);
          return;
        }

        if (gameData.status === 'lobby') {
          toast.info('El juego no ha iniciado. Redirigiendo al lobby...');
          setTimeout(() => {
            navigate(`/tablet/lobby?connection_id=${connId}`);
          }, 2000);
          return;
        }

        // Verificar actividad actual
        const currentActivityName = gameData.current_activity_name?.toLowerCase() || '';
        const currentStageNumber = gameData.current_stage_number;

        // Si no es personalización, redirigir
        if (currentStageNumber !== 1 || !currentActivityName.includes('personaliz')) {
          if (currentStageNumber === 1 && currentActivityName.includes('presentaci')) {
            try {
              const persList = await teamPersonalizationsAPI.list({ team: statusData.team.id });
              const persResults = Array.isArray(persList) ? persList : [persList];
              if (persResults.length > 0) {
                const personalization = persResults[0];
                const knowsEachOther = personalization.team_members_know_each_other;
                if (knowsEachOther === true) {
                  window.location.href = `/tablet/etapa1/minijuego/?connection_id=${connId}`;
                } else {
                  window.location.href = `/tablet/etapa1/presentacion/?connection_id=${connId}`;
                }
              } else {
                window.location.href = `/tablet/etapa1/presentacion/?connection_id=${connId}`;
              }
            } catch (error) {
              window.location.href = `/tablet/etapa1/presentacion/?connection_id=${connId}`;
            }
          } else if (currentActivityName.includes('instructivo') || currentActivityName.includes('instrucciones') || currentActivityName.includes('video')) {
            window.location.href = `/tablet/etapa1/instructivo/?connection_id=${connId}`;
          } else {
            window.location.href = `/tablet/lobby?connection_id=${connId}`;
          }
          return;
        }

        setCurrentActivityId(initialActivityId);

        // Cargar datos de personalización
        try {
          const persList = await teamPersonalizationsAPI.list({ team: statusData.team.id });
          const persResults = Array.isArray(persList) ? persList : [persList];
          if (persResults.length > 0) {
            const existingPers = persResults[0];
            setPersonalization(existingPers);
            setTeamName(existingPers.team_name || '');
            setKnowEachOther(existingPers.team_members_know_each_other);
            setSubmitted(true);
          }
        } catch (error) {
          console.error('Error loading personalization:', error);
        }

        // Verificar si se debe mostrar el modal de U-Bot
        // Solo si ya se vio el modal de Etapa 1 antes pero no se ha visto U-Bot
        const hasSeenEtapaIntro = gameSessionId 
          ? localStorage.getItem(`tablet_etapa_intro_${gameSessionId}_1`)
          : null;
        const hasSeenUBot = localStorage.getItem(`ubot_modal_personalizacion_${connId}`);
        
        if (hasSeenEtapaIntro && !hasSeenUBot && statusData.team) {
          setTimeout(() => {
            setShowUBotModal(true);
            localStorage.setItem(`ubot_modal_personalizacion_${connId}`, 'true');
          }, 500);
        }

        // Iniciar timer si hay actividad
        if (initialActivityId) {
          await startTimer(initialActivityId, statusData.game_session.id);
        }

        // Verificar actividad y etapa periódicamente (COMO EN ETAPA 2)
        activityCheckIntervalRef.current = setInterval(async () => {
          try {
            // Usar lobby en lugar de getById para evitar problemas de autenticación
            const updatedLobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
            const updatedSession = updatedLobbyData.game_session;

            const resultsUrl = getResultsRedirectUrl(updatedSession, connId);
            if (resultsUrl) { window.location.href = resultsUrl; return; }

            // Verificar si cambió la actividad o el nombre de la actividad
            const activityChanged = updatedSession.current_activity !== initialActivityId || 
                                   (updatedSession.current_activity_name || '') !== initialActivityName;
            const stageChanged = updatedSession.current_stage_number !== initialStageNumber;
            
            if (activityChanged || stageChanged) {
              // Limpiar intervalos
              if (activityCheckIntervalRef.current) {
                clearInterval(activityCheckIntervalRef.current);
                activityCheckIntervalRef.current = null;
              }
              if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
              }
              
              // Verificar a qué actividad redirigir
              const newActivityName = (updatedSession.current_activity_name || '').toLowerCase();
              const newStageNumber = updatedSession.current_stage_number;
              
              // Si la etapa cambió o se completó, redirigir a resultados o siguiente etapa
              if (stageChanged || (!updatedSession.current_activity && !updatedSession.current_activity_name)) {
                if (newStageNumber === 1 && !updatedSession.current_activity) {
                  window.location.href = `/tablet/etapa1/resultados/?connection_id=${connId}`;
                  return;
                } else if (newStageNumber === 2) {
                  window.location.href = `/tablet/etapa2/seleccionar-tema/?connection_id=${connId}`;
                  return;
                } else {
                  window.location.href = `/tablet/lobby?connection_id=${connId}`;
                  return;
                }
              }
              
              // Si cambió la actividad pero sigue siendo etapa 1
              if (newActivityName.includes('presentaci')) {
                // Verificar si se conocen para redirigir a presentación o minijuego
                try {
                  const persList = await teamPersonalizationsAPI.list({ team: statusData.team.id });
                  const persResults = Array.isArray(persList) ? persList : [persList];
                  if (persResults.length > 0) {
                    const personalization = persResults[0];
                    const knowsEachOther = personalization.team_members_know_each_other;
                    if (knowsEachOther === true) {
                      window.location.href = `/tablet/etapa1/minijuego/?connection_id=${connId}`;
                    } else {
                      window.location.href = `/tablet/etapa1/presentacion/?connection_id=${connId}`;
                    }
                  } else {
                    window.location.href = `/tablet/etapa1/presentacion/?connection_id=${connId}`;
                  }
                } catch (error) {
                  window.location.href = `/tablet/etapa1/presentacion/?connection_id=${connId}`;
                }
                return;
              } else if (newActivityName.includes('personaliz')) {
                // Ya estamos en personalización, no redirigir
                return;
              } else if (newActivityName.includes('instructivo') || newActivityName.includes('instrucciones') || newActivityName.includes('video')) {
                window.location.href = `/tablet/etapa1/instructivo/?connection_id=${connId}`;
                return;
              } else {
                window.location.href = `/tablet/lobby?connection_id=${connId}`;
                return;
              }
            }
          } catch (error) {
            console.error('Error verificando actividad:', error);
          }
        }, 3000); // Verificar cada 3 segundos

        setLoading(false);
      } catch (error: any) {
        toast.error('Error al cargar datos: ' + (error.response?.data?.error || error.message));
        setLoading(false);
      }
    };

    loadInitialData();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (activityCheckIntervalRef.current) {
        clearInterval(activityCheckIntervalRef.current);
      }
    };
  }, [searchParams, navigate]);

  // Reset timeExpired cuando cambia la actividad
  useEffect(() => {
    timeExpiredRef.current = false;
  }, [currentActivityId]);

  const startTimer = async (activityId: number, gameSessionId: number) => {
    // Si ya hay un intervalo corriendo, no iniciar otro
    if (timerIntervalRef.current) {
      return;
    }

    try {
      const timerData = await sessionsAPI.getActivityTimer(gameSessionId);
      if (timerData.error || !timerData.timer_duration) return;

      const timerDuration = timerData.timer_duration;
      const startTime = timerData.started_at 
        ? new Date(timerData.started_at).getTime()
        : new Date(timerData.current_time).getTime();

      // Verificar si el tiempo ya expiró antes de iniciar el intervalo
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, timerDuration - elapsed);

      if (remaining <= 0) {
        setTimerRemaining('00:00');
        timeExpiredRef.current = true;
        void advanceActivityOnTimerExpiration(gameSessionId);
        return; // No iniciar el intervalo si ya expiró
      }

      const updateTimer = () => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, timerDuration - elapsed);

        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        setTimerRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

        if (remaining <= 0) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          setTimerRemaining('00:00');
          if (!timeExpiredRef.current) {
            timeExpiredRef.current = true;
            void advanceActivityOnTimerExpiration(gameSessionId);
          }
        }
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const handleSubmit = async () => {
    if (!teamName.trim()) {
      toast.error('Por favor ingresa un nombre para el equipo');
      return;
    }

    if (knowEachOther === null) {
      toast.error('Por favor selecciona el estado operativo de tu tripulación');
      return;
    }

    if (!team || !connectionId) return;

    setSubmitting(true);

    try {
      const result = await teamPersonalizationsAPI.createOrUpdate({
        team: team.id,
        team_name: teamName.trim(),
        team_members_know_each_other: knowEachOther,
      });

      // Actualizar el estado local con la personalización guardada
      setPersonalization({
        id: result.id,
        team_name: teamName.trim(),
        team_members_know_each_other: knowEachOther,
      });

      toast.success('✓ Personalización guardada exitosamente');
      setSubmitted(true);
    } catch (error: any) {
      toast.error('Error: ' + (error.message || 'Error desconocido'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <GalacticPage className="items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
      </GalacticPage>
    );
  }

  if (!team) {
    return (
      <GalacticPage className="items-center justify-center">
        <div style={{ color: '#fff', textAlign: 'center' }}>
          <p style={{ fontSize: 20, marginBottom: 16 }}>Error al cargar información de la nave</p>
          <Button onClick={() => navigate('/tablet/join')}>Volver a Conectar</Button>
        </div>
      </GalacticPage>
    );
  }

  return (
    <GalacticPage>
      {/* Header row: team badge + tokens + timer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, width: '100%', padding: '0 8px' }}>
        
        {/* Nuevo Team Badge estilo HUD Espacial */}
        <div className="glass-card" style={{ 
          padding: '8px 20px', 
          display: 'flex', 
          alignItems: 'center', 
          borderLeft: `3px solid ${team?.color || '#c026d3'}` 
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              Nombre del Escuadrón 
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                width: 10, height: 10, borderRadius: '50%', 
                background: team?.color || '#c026d3', 
                boxShadow: `0 0 10px ${team?.color || '#c026d3'}` 
              }} />
              <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>
                {team?.name || 'Mi Equipo'}
              </span>
            </div>
          </div>
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
      <GlassCard style={{ maxWidth: 640, margin: '0 auto', width: '100%', padding: '32px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="galactic-label" style={{ marginBottom: 8, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            Personalización
          </div>
          <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 'clamp(20px,4vw,32px)', fontWeight: 700, color: '#fff', textShadow: '0 0 20px rgba(192,38,211,0.5)', lineHeight: 1.2 }}>
            Registro de Nave y Tripulación
          </h2>
          <p style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 12, lineHeight: 1.6, maxWidth: 480, margin: '12px auto 0' }}>
            Antes de que su nave despegue, el sistema de control de misión necesita registrar su nombre operativo y verificar el estado de su crew.
          </p>
        </div>

        {/* Startup name input */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 10, fontWeight: 600 }}>
            Nombre de la Nave (Start-up)
          </label>
          <input
            type="text"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            maxLength={100}
            placeholder="Ej: Rocket Labs, Alpha Solutions..."
            disabled={submitted || submitting}
            style={{
              width: '100%', padding: '16px 20px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 12, color: '#fff', fontSize: 16,
              fontFamily: "'Exo 2',sans-serif", outline: 'none',
              transition: 'border-color 0.3s, background 0.3s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#c026d3'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
          />
        </div>

        {/* Know each other Cards (NUEVO DISEÑO GALÁCTICO) */}
        <div style={{ marginBottom: 32 }}>
          <label style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 16, fontWeight: 600 }}>
            Estado Operativo de la Tripulación
          </label>
          
          <div className="choice-row">
            {/* Tarjeta 1: Ya se conocen */}
            <div 
              className={`choice-card veteran ${knowEachOther === true ? 'selected' : ''}`}
              onClick={() => !submitted && !submitting && setKnowEachOther(true)}
              style={{ opacity: (submitted || submitting) && knowEachOther !== true ? 0.5 : 1, cursor: (submitted || submitting) ? 'default' : 'pointer' }}
            >
              <span className="choice-icon">🛸</span>
              <div className="choice-name">Equipo Veterano</div>
              <div className="choice-desc">Ya hemos operado juntos y nos conocemos bien como tripulación.</div>
              <span className="choice-tag">Ya nos conocemos</span>
            </div>

            {/* Tarjeta 2: No se conocen */}
            <div 
              className={`choice-card newteam ${knowEachOther === false ? 'selected' : ''}`}
              onClick={() => !submitted && !submitting && setKnowEachOther(false)}
              style={{ opacity: (submitted || submitting) && knowEachOther !== false ? 0.5 : 1, cursor: (submitted || submitting) ? 'default' : 'pointer' }}
            >
              <span className="choice-icon">🌌</span>
              <div className="choice-name">Primera Misión</div>
              <div className="choice-desc">Somos nuevos tripulantes — este es nuestro primer vuelo juntos.</div>
              <span className="choice-tag">No nos conocemos</span>
            </div>
          </div>
        </div>

        {/* Submit button */}
        <button
          className="btn-galactic-primary"
          style={{ width: '100%', fontSize: 15, padding: '18px 0', letterSpacing: 4 }}
          onClick={handleSubmit}
          disabled={submitted || submitting || !teamName.trim() || knowEachOther === null}
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" style={{ display: 'inline', marginRight: 8 }} />
              INICIANDO SECUENCIA...
            </>
          ) : submitted ? '✓ TRIPULACIÓN REGISTRADA' : 'CONFIRMAR REGISTRO'}
        </button>
      </GlassCard>

      {/* U-Bot modal */}
      {team && (
        <UBotPersonalizacionModal
          isOpen={showUBotModal}
          onClose={() => setShowUBotModal(false)}
          onIniciar={() => {
            setShowUBotModal(false);
          }}
          teamColor={team.color}
        />
      )}
    </GalacticPage>
  );
}