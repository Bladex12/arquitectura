import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
import { GalacticPage } from '@/components/GalacticPage';
import { TimerBlock } from '@/components/TimerBlock';
import { sessionsAPI, teamActivityProgressAPI } from '@/services';
import { toast } from 'sonner';
import { isDevMode } from '@/utils/devMode';
import { useGameStateRedirect } from '@/hooks/useGameStateRedirect';

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total: number;
  faculty?: number;
}

interface Topic {
  id: number;
  name: string;
  description: string;
  icon_name?: string;
}


interface Challenge {
  id: number;
  title: string;
  icon?: string;
  persona_name?: string;
  persona_age?: number;
  persona_story?: string;
  difficulty_level: string;
}

interface TeamProgress {
  team: Team;
  topic?: Topic;
  challenge?: Challenge;
  topicStatus: 'completed' | 'pending';
  challengeStatus: 'completed' | 'pending';
}

export function ProfesorSeleccionarTema() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Redirigir automáticamente si el juego está en otro estado
  useGameStateRedirect();
  
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsProgress, setTeamsProgress] = useState<TeamProgress[]>([]);
  const [gameSession, setGameSession] = useState<any>(null);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [allTopicsSelected, setAllTopicsSelected] = useState(false);
  const [showEtapaIntro, setShowEtapaIntro] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);
  const lastActivityIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) {
      navigate('/profesor/panel');
      return;
    }

    loadGameControl();
    intervalRef.current = setInterval(loadGameControl, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [sessionId, navigate]);

  const getTeamColorHex = (color: string) => {
    const colorMap: Record<string, string> = {
      Verde: '#28a745',
      Azul: '#007bff',
      Rojo: '#dc3545',
      Amarillo: '#ffc107',
      Naranja: '#fd7e14',
      Morado: '#6f42c1',
      Rosa: '#e83e8c',
      Cian: '#17a2b8',
      Gris: '#6c757d',
      Marrón: '#795548',
    };
    return colorMap[color] || '#667eea';
  };

  const loadGameControl = async () => {
    if (!sessionId) {
      navigate('/profesor/panel');
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const ensuredSessionId = sessionId;

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/profesor/login');
        return;
      }

      const sessionData = await sessionsAPI.getById(ensuredSessionId);
      setGameSession(sessionData);

      // Verificar si debemos mostrar la intro de la etapa
      if (sessionData.current_stage_number === 2) {
        const introKey = `etapa_intro_${ensuredSessionId}_2`;
        const hasSeenIntro = localStorage.getItem(introKey);
        if (!hasSeenIntro) {
          setShowEtapaIntro(true);
        }
      }

      if (sessionData.status === 'finished' || sessionData.status === 'completed') {
        toast.info('El juego ha finalizado. Redirigiendo al panel...');
        setTimeout(() => navigate('/profesor/panel'), 2000);
        return;
      }

      if (sessionData.status === 'lobby') {
        toast.info('El juego está en el lobby. Redirigiendo...');
        setTimeout(() => navigate(`/profesor/lobby/${ensuredSessionId}`), 2000);
        return;
      }

      const currentStageNumber = sessionData.current_stage_number;
      const currentActivityId = sessionData.current_activity;
      const currentActivityName = sessionData.current_activity_name?.toLowerCase() || '';

      // Redirection logic if not in Stage 2 or not topic selection activity
      if (currentStageNumber !== 2) {
        toast.info('El juego no está en la Etapa 2. Redirigiendo...');
        setTimeout(() => navigate(`/profesor/panel`), 2000);
        return;
      }

      // La actividad de tema/desafío es la misma ahora
      const isTopicActivity = currentActivityName.includes('tema') || 
        currentActivityName.includes('desafio') || 
        currentActivityName.includes('desafío') ||
        (currentActivityName.includes('seleccionar'));

      if (!isTopicActivity && currentActivityId) {
        // Not topic/challenge activity, redirect based on activity name
        if (currentActivityName.includes('bubble') || currentActivityName.includes('mapa')) {
        setTimeout(() => navigate(`/profesor/etapa2/bubble-map/${ensuredSessionId}`), 1500);
        }
        return;
      }

      // If no current activity in Stage 2, it means stage is completed, redirect to results
      if (!currentActivityId && currentStageNumber === 2) {
        toast.info('Etapa 2 completada. Redirigiendo a resultados...');
        setTimeout(() => navigate(`/profesor/resultados/${ensuredSessionId}`), 2000);
        return;
      }

      // El nombre de la actividad ya viene del backend en sessionData.current_activity_name
      // No necesitamos hacer llamadas adicionales

      const gameSessionId = parseInt(ensuredSessionId);

      const [stages, fetchedTeams] = await Promise.all([
        sessionsAPI.getSessionStages(gameSessionId),
        sessionsAPI.getTeams(ensuredSessionId),
      ]);

      setTeams(fetchedTeams);

      const stage2 = Array.isArray(stages) ? stages.find((s: any) => s.stage_number === 2) : null;

      if (stage2 && currentActivityId) {
        await loadTeamsProgress(fetchedTeams, currentActivityId, stage2.id);
      }

      if (currentActivityId) {
        if (lastActivityIdRef.current !== currentActivityId) {
          lastActivityIdRef.current = currentActivityId;
          startTimer(gameSessionId);
        }
      } else if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        lastActivityIdRef.current = null;
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading game control:', error);
      toast.error('Error al cargar el control del juego: ' + (error.response?.data?.error || error.message));
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  };

  const loadTeamsProgress = async (teamsList: Team[], activityId: number, stageId: number) => {
    try {
      // Obtener el progreso de todos los equipos en una sola llamada
      const progressList = await teamActivityProgressAPI.list({
        activity: activityId,
        session_stage: stageId,
      });
      const progressArray = Array.isArray(progressList) ? progressList : [progressList];
      const progressMap = new Map<number, any>();
      progressArray.forEach((p: any) => {
        if (p?.team != null) {
          progressMap.set(p.team, p);
        }
      });
      
      const teamsProgressList: TeamProgress[] = teamsList.map((team) => {
        const progress = progressMap.get(team.id);
        
        if (progress) {
          // El backend ya devuelve los objetos completos en selected_topic y selected_challenge
          const topic = progress.selected_topic ? (progress.selected_topic as Topic) : undefined;
          const challenge = progress.selected_challenge ? (progress.selected_challenge as Challenge) : undefined;
          
          // Determinar el estado según el progreso del backend
          const topicStatus: 'completed' | 'pending' = progress.selected_topic ? 'completed' : 'pending';
          const challengeStatus: 'completed' | 'pending' = progress.status === 'completed' ? 'completed' : 'pending';
          
          return {
            team,
            topic,
            challenge,
            topicStatus,
            challengeStatus,
          } as TeamProgress;
        }
        
        // Si no hay progreso, equipo está pendiente
        return {
          team,
          topic: undefined,
          challenge: undefined,
          topicStatus: 'pending',
          challengeStatus: 'pending',
        } as TeamProgress;
      });

      setTeamsProgress(teamsProgressList);

      // Verificar si todos los equipos han seleccionado tema y desafío
      const allTopicsSelected = teamsProgressList.every((tp) => tp.topicStatus === 'completed');
      const allChallengesSelected = teamsProgressList.every((tp) => tp.challengeStatus === 'completed');
      setAllTopicsSelected(allTopicsSelected && allChallengesSelected);
    } catch (error) {
      console.error('Error loading teams progress:', error);
    }
  };

  const startTimer = async (gameSessionId: number) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    try {
      const timerData = await sessionsAPI.getActivityTimer(gameSessionId);

      if (timerData.error || !timerData.timer_duration) {
        console.error('Error al obtener información del temporizador:', timerData.error);
        return;
      }

      const timerDuration = timerData.timer_duration;
      const startTime = timerData.started_at
        ? new Date(timerData.started_at).getTime()
        : new Date(timerData.current_time).getTime();

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
        }
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const handleNextActivity = async (skipRequirements: boolean = false) => {
    if (!sessionId) return;
    setLoading(true);
    
    // Detener el polling mientras se avanza
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    try {
      const data = await sessionsAPI.nextActivity(sessionId);


      if (data.stage_completed) {
        toast.success('¡Etapa 2 completada! Redirigiendo a resultados...');
        setLoading(false);
        setTimeout(() => navigate(`/profesor/resultados/${sessionId}`), 1500);
      } else {
        // Verificar el nombre de la actividad para redirigir correctamente
        const nextActivityName = data.current_activity_name?.toLowerCase() || '';
        const currentOrder = data.current_activity_order_number || 0;
        
        
        // Siempre ir directo a bubble map (saltando ver-desafio)
        // En Etapa 2: orden 1 = Seleccionar Tema, orden 2 = Ver Desafío (se salta), orden 3 = Bubble Map
        const isBubbleMap = currentOrder === 3 || 
                           nextActivityName.includes('bubble') || 
                           nextActivityName.includes('mapa') ||
                           nextActivityName.includes('mapa mental') ||
                           nextActivityName.includes('bubblemap');
        
        if (isBubbleMap) {
          toast.success('¡Avanzando a Bubble Map!');
          setLoading(false);
          // Redirigir inmediatamente sin delay
          navigate(`/profesor/etapa2/bubble-map/${sessionId}`);
        } else {
          // Si por alguna razón no es bubble map, mostrar error y recargar
          toast.warning(`La actividad no cambió correctamente. Actividad actual: ${nextActivityName}. Recargando...`);
          setLoading(false);
          setTimeout(() => {
            loadGameControl();
          }, 1000);
        }
      }
    } catch (error: any) {
      toast.error('Error al avanzar a la siguiente actividad: ' + (error.response?.data?.error || error.message));
      // Reanudar polling en caso de error
      intervalRef.current = setInterval(loadGameControl, 5000);
      setLoading(false);
    }
  };

  if (loading && teamsProgress.length === 0) {
    return (
      <GalacticPage>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
        </div>
      </GalacticPage>
    );
  }

  return (
    <GalacticPage>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 2</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 30, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
            Empatía
          </div>
        </div>
        <div className="galactic-badge">{gameSession?.current_activity_name || 'Seleccionar Tema'}</div>
      </div>

      {/* Timer with sala code */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', marginBottom: 14 }}>
        <div style={{ minWidth: 110 }}>
          <div className="galactic-label" style={{ fontSize: 11, marginBottom: 4 }}>Sala</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 700, color: '#c026d3', letterSpacing: 4 }}>
            {gameSession?.room_code ?? '--'}
          </div>
        </div>
        <TimerBlock timerRemaining={timerRemaining} activityName="Selección de Tema y Desafío" />
        <div style={{ minWidth: 110 }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
        {([
          { label: 'Temas Seleccionados', value: `${teamsProgress.filter(tp => tp.topicStatus === 'completed').length} / ${teams.length}`, sub: 'equipos con tema elegido', valueStyle: {} },
          { label: 'Desafíos Seleccionados', value: `${teamsProgress.filter(tp => tp.challengeStatus === 'completed').length} / ${teams.length}`, sub: 'equipos con desafío elegido', valueStyle: { color: '#34d399' } },
          { label: 'Actividad Actual', value: gameSession?.current_activity_name || 'Seleccionar Tema', sub: 'sector + persona', valueStyle: { fontSize: 18, color: '#d946ef' } },
        ] as const).map(card => (
          <div key={card.label} className="glass-card" style={{ padding: '20px 24px' }}>
            <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>{card.label}</div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1, ...card.valueStyle }}>
              {card.value}
            </div>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Team status grid */}
      <div className="galactic-label" style={{ marginBottom: 12 }}>Estado de los equipos</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 20 }}>
        {teamsProgress.map((teamProgress) => {
          const teamColor = getTeamColorHex(teamProgress.team.color);
          const isCompleted = teamProgress.topicStatus === 'completed' && teamProgress.challengeStatus === 'completed';
          const progressPct = teamProgress.challengeStatus === 'completed' ? 100 : teamProgress.topicStatus === 'completed' ? 50 : 0;

          return (
            <div
              key={teamProgress.team.id}
              className="glass-card"
              style={{
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                borderColor: isCompleted ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.12)',
                background: isCompleted ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.05)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: teamColor, flexShrink: 0, marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 16, fontWeight: 700, color: '#fff' }}>
                    {teamProgress.team.name}
                  </div>
                </div>
                <div style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap' as const, flexShrink: 0,
                  ...(isCompleted
                    ? { background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.4)' }
                    : { background: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)' }),
                }}>
                  {isCompleted ? '✓ Completo' : teamProgress.topicStatus === 'completed' ? '⏳ En progreso' : '⏳ Pendiente'}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#7c3aed,#c026d3)', borderRadius: 2, transition: 'width 0.5s' }} />
              </div>

              {/* Topic row */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 2, color: 'rgba(255,255,255,0.45)', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <span>🌍 Tema</span>
                  <span style={{ color: teamProgress.topicStatus === 'completed' ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                    {teamProgress.topicStatus === 'completed' ? '✓' : '•••'}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: teamProgress.topic ? '#fff' : 'rgba(255,255,255,0.3)', fontStyle: teamProgress.topic ? 'normal' : 'italic' }}>
                  {teamProgress.topic?.name || 'Sin seleccionar'}
                </div>
              </div>

              {/* Challenge row */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 2, color: 'rgba(255,255,255,0.45)', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <span>🎯 Desafío</span>
                  <span style={{ color: teamProgress.challengeStatus === 'completed' ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                    {teamProgress.challengeStatus === 'completed' ? '✓' : '•••'}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: teamProgress.challenge ? '#fff' : 'rgba(255,255,255,0.3)', fontStyle: teamProgress.challenge ? 'normal' : 'italic' }}>
                  {teamProgress.challenge
                    ? `${teamProgress.challenge.persona_name || ''} · ${teamProgress.challenge.title}`
                    : 'Sin seleccionar'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24, paddingBottom: 8 }}>
        <button className="btn-galactic-secondary" onClick={() => navigate('/profesor/panel')}>
          Cancelar Sesión
        </button>
        {(allTopicsSelected && teamsProgress.every(tp => tp.challengeStatus === 'completed')) && (
          <button className="btn-galactic-primary" onClick={() => handleNextActivity(false)} disabled={loading}>
            {loading ? 'Avanzando...' : 'Avanzar a Bubble Map ▶'}
          </button>
        )}
        {isDevMode() && (
          <button
            onClick={() => handleNextActivity(true)}
            disabled={loading}
            style={{ background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.5)', color: '#fb923c', fontSize: 12, padding: '10px 18px', borderRadius: 8, cursor: 'pointer' }}
          >
            Dev ⚙
          </button>
        )}
      </div>

      <EtapaIntroModal
        etapaNumero={2}
        isOpen={showEtapaIntro}
        onClose={() => {
          setShowEtapaIntro(false);
          if (sessionId) {
            localStorage.setItem(`etapa_intro_${sessionId}_2`, 'true');
          }
        }}
      />
    </GalacticPage>
  );
}







