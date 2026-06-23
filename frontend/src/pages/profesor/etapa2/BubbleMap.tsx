import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
import { GalacticPage } from '@/components/GalacticPage';
import { TimerBlock } from '@/components/TimerBlock';
import { sessionsAPI, challengesAPI, teamBubbleMapsAPI, teamPersonalizationsAPI, teamActivityProgressAPI, tokenTransactionsAPI } from '@/services';
import { toast } from 'sonner';
import { isDevMode } from '@/utils/devMode';
import { useGameStateRedirect } from '@/hooks/useGameStateRedirect';

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total: number;
}

// Nueva estructura de datos basada en Figma
interface Answer {
  id: number;
  text: string;
}

interface Question {
  id: number;
  question: string;
  answers: Answer[];
  isOptional: boolean;
}

interface BubbleMapData {
  central: {
    personName: string;
    profileImage?: string;
  };
  questions: Question[];
}

interface BubbleMap {
  id: number;
  team: number;
  map_data: BubbleMapData | {
    // Compatibilidad con estructura antigua
    nodes?: any[];
    edges?: any[];
  };
  created_at: string;
  updated_at: string;
}

interface V2Idea {
  id: string;
  text: string;
  x?: number;
  y?: number;
}

interface V2NodeData {
  id: string;
  label: string;
  icon: string;
  color: string;
  rgb: string;
  angle: number;
  ideas: V2Idea[];
}

interface TeamWithMap {
  team: Team;
  bubbleMap: BubbleMap | null;
}

export function ProfesorBubbleMap() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Redirigir automáticamente si el juego está en otro estado
  useGameStateRedirect();
  
  const [loading, setLoading] = useState(true);
  const [teamsWithMaps, setTeamsWithMaps] = useState<TeamWithMap[]>([]);
  const [gameSession, setGameSession] = useState<any>(null);
  const [currentActivity, setCurrentActivity] = useState<any>(null);
  const [currentSessionStage, setCurrentSessionStage] = useState<any>(null);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [allTeamsCompleted, setAllTeamsCompleted] = useState(false);
  const [previewMap, setPreviewMap] = useState<{ team: Team; bubbleMap: BubbleMap } | null>(null);
  const [showEtapaIntro, setShowEtapaIntro] = useState(false);
  const [personalizations, setPersonalizations] = useState<Record<number, { team_name?: string }>>({});
  const [teamChallenges, setTeamChallenges] = useState<Record<number, { persona_name?: string; persona_image_url?: string }>>({});
  const [teamFinalizedMap, setTeamFinalizedMap] = useState<Record<number, boolean>>({});

  // Tamaño fijo para el bubble map (sin zoom)
  const BUBBLE_MAP_SIZE = { width: 1000, height: 1000 };

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartTimeRef = useRef<number | null>(null);
  const timerDurationRef = useRef<number | null>(null);

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
      if (timerSyncIntervalRef.current) clearInterval(timerSyncIntervalRef.current);
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
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/profesor/login');
        return;
      }

      const sessionData = await sessionsAPI.getById(sessionId);
      setGameSession(sessionData);

      // Verificar si debemos mostrar la intro de la etapa
      if (sessionData.current_stage_number === 2) {
        const introKey = `etapa_intro_${sessionId}_2`;
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
        setTimeout(() => navigate(`/profesor/lobby/${sessionId}`), 2000);
        return;
      }

      const currentStageNumber = sessionData.current_stage_number;
      const currentActivityId = sessionData.current_activity;
      const currentActivityName = sessionData.current_activity_name?.toLowerCase() || '';

      // Redirection logic if not in Stage 2 or not bubble map activity
      if (currentStageNumber !== 2) {
        toast.info('El juego no está en la Etapa 2. Redirigiendo...');
        setTimeout(() => navigate(`/profesor/panel`), 2000);
        return;
      }

      const isBubbleMapActivity = currentActivityName.includes('bubble') || 
        currentActivityName.includes('mapa') || 
        currentActivityName.includes('mapa mental');

      if (!isBubbleMapActivity && currentActivityId) {
        // Not bubble map activity, redirect based on activity name
        if (currentActivityName.includes('tema') || currentActivityName.includes('seleccionar')) {
          setTimeout(() => navigate(`/profesor/etapa2/seleccionar-tema/${sessionId}`), 2000);
        }
        setLoading(false);
        return;
      }

      // If no current activity in Stage 2, it means stage is completed, redirect to results
      if (!currentActivityId && currentStageNumber === 2) {
        toast.info('Etapa 2 completada. Redirigiendo a resultados...');
        setTimeout(() => navigate(`/profesor/resultados/${sessionId}`), 2000);
        setLoading(false);
        return;
      }

      // Si no hay actividad actual pero estamos en etapa 2, puede ser que aún no se haya iniciado
      if (!currentActivityId) {
        setLoading(false);
        return;
      }

      // Fetch current activity details
      if (currentActivityId) {
        const activityData = await challengesAPI.getActivityById(currentActivityId);
        setCurrentActivity(activityData);
      }

      // Fetch current session stage
      const stages = await sessionsAPI.getSessionStages(Number(sessionId));
      const stagesList = Array.isArray(stages) ? stages : [stages];
      const stage2 = stagesList.find((s: any) => s.stage_number === 2);
      setCurrentSessionStage(stage2);

      if (stage2) {
        await loadBubbleMaps(stage2.id);
      }

      // Start timer
      if (currentActivityId) {
        startTimer(currentActivityId, parseInt(sessionId));
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading game control:', error);
      toast.error('Error al cargar el control del juego: ' + (error.response?.data?.error || error.message));
      setLoading(false);
    }
  };

  const loadBubbleMaps = async (sessionStageId: number) => {
    try {
      const token = localStorage.getItem('authToken');
      
      // Fetch teams
      const teams = await sessionsAPI.getTeams(sessionId);
      const teamsArray: Team[] = Array.isArray(teams) ? teams : [teams];

      // Fetch personalizations for all teams
      const persMap: Record<number, { team_name?: string }> = {};
      for (const team of teamsArray) {
        try {
          const persList = await teamPersonalizationsAPI.list({ team: team.id });
          const persResults = Array.isArray(persList) ? persList : [persList];
          if (persResults.length > 0 && persResults[0].team_name) {
            persMap[team.id] = { team_name: persResults[0].team_name };
          }
        } catch (error) {
          console.error(`Error loading personalization for team ${team.id}:`, error);
        }
      }
      setPersonalizations(persMap);

      // Fetch bubble maps and challenges for each team
      const teamsWithMapsPromises = teamsArray.map(async (team) => {
        try {
          const mapList = await teamBubbleMapsAPI.list({
            team: team.id,
            session_stage: sessionStageId
          });
          const mapArray = Array.isArray(mapList) ? mapList : [mapList];
          const bubbleMap = mapArray[0] || null;

          // Load selected challenge for persona name
          try {
            const progressList = await teamActivityProgressAPI.list({
              team: team.id,
              session_stage: sessionStageId
            });
            const progressArray = Array.isArray(progressList) ? progressList : [progressList];
            const progress = progressArray[0];

            if (progress?.selected_challenge) {
              let challenge = typeof progress.selected_challenge === 'object'
                ? progress.selected_challenge
                : { id: progress.selected_challenge };

              if (!challenge.persona_name || !challenge.persona_image_url) {
                challenge = await challengesAPI.getChallengeById(challenge.id);
              }

              setTeamChallenges(prev => ({
                ...prev,
                [team.id]: {
                  persona_name: challenge.persona_name,
                  persona_image_url: challenge.persona_image_url
                }
              }));
            }
          } catch (error) {
            console.error(`Error loading challenge for team ${team.id}:`, error);
          }

          // Detect V2 finalization via token transactions
          if (bubbleMap) {
            try {
              const txList = await tokenTransactionsAPI.list({
                team: team.id,
                session_stage: sessionStageId
              });
              const txArray = Array.isArray(txList) ? txList : [txList];
              const isFinalized = txArray.some(
                (tx: any) => tx.source_type === 'activity' && tx.source_id === bubbleMap.id
              );
              setTeamFinalizedMap(prev => ({ ...prev, [team.id]: isFinalized }));
            } catch (error) {
              console.error(`Error loading token transactions for team ${team.id}:`, error);
            }
          }

          return { team, bubbleMap };
        } catch (error) {
          console.error(`Error loading bubble map for team ${team.id}:`, error);
          return { team, bubbleMap: null };
        }
      });

      const teamsWithMaps = await Promise.all(teamsWithMapsPromises);
      setTeamsWithMaps(teamsWithMaps);

      // Check if all teams have completed
      const allCompleted = teamsWithMaps.every(({ team, bubbleMap }) => {
        const status = getBubbleMapStatus(bubbleMap, team.id);
        return status.status === 'completed';
      });
      setAllTeamsCompleted(allCompleted);
    } catch (error) {
      console.error('Error loading bubble maps:', error);
    }
  };

  const syncTimer = async (gameSessionId: number) => {
    try {
      const timerData = await sessionsAPI.getActivityTimer(gameSessionId);

      if (timerData.error || !timerData.timer_duration) {
        setTimerRemaining('--:--');
        return;
      }

      const timerDuration = timerData.timer_duration;
      const startTime = timerData.started_at
        ? new Date(timerData.started_at).getTime()
        : new Date(timerData.current_time).getTime();

      // Actualizar referencias
      timerStartTimeRef.current = startTime;
      timerDurationRef.current = timerDuration;
      
      // Actualizar display inmediatamente
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, timerDuration - elapsed);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      setTimerRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    } catch (error) {
      console.error('Error syncing timer:', error);
      setTimerRemaining('--:--');
    }
  };

  const startTimer = async (activityId: number, gameSessionId: number) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (timerSyncIntervalRef.current) {
      clearInterval(timerSyncIntervalRef.current);
      timerSyncIntervalRef.current = null;
    }

    try {
      // Sincronizar inicialmente
      await syncTimer(gameSessionId);

      if (!timerStartTimeRef.current || !timerDurationRef.current) {
        return;
      }

      const updateTimer = () => {
        if (!timerStartTimeRef.current || !timerDurationRef.current) return;

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
        }
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);

      // Sincronizar periódicamente cada 5 segundos
      timerSyncIntervalRef.current = setInterval(() => {
        syncTimer(gameSessionId);
      }, 5000);
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const handleNextActivity = async (skipRequirements: boolean = false) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await sessionsAPI.nextActivity(sessionId);

      if (data.stage_completed) {
        toast.success('¡Etapa 2 completada! Redirigiendo a resultados...');
        setTimeout(() => navigate(`/profesor/resultados/${sessionId}`), 1500);
      } else {
        toast.success('¡Avanzando a la siguiente actividad!');
        // Redirect based on the next activity name
        const nextActivityName = data.current_activity_name?.toLowerCase() || '';
        if (nextActivityName.includes('tema') || nextActivityName.includes('seleccionar')) {
          setTimeout(() => navigate(`/profesor/etapa2/seleccionar-tema/${sessionId}`), 1500);
        } else {
          // Fallback, reload current page
          setTimeout(() => loadGameControl(), 1500);
        }
      }
    } catch (error: any) {
      toast.error('Error al avanzar a la siguiente actividad: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getBubbleMapStatus = (bubbleMap: BubbleMap | null, teamId: number) => {
    if (!bubbleMap) {
      return { text: 'Pendiente', status: 'pending' };
    }

    const mapData = bubbleMap.map_data as any;

    // V2 format
    if (mapData?.version === 2) {
      const nodes: V2NodeData[] = [...(mapData.nodes ?? []), ...(mapData.customNodes ?? [])];
      const totalIdeas = nodes.reduce((sum, n) => sum + (n.ideas?.length ?? 0), 0);
      if (teamFinalizedMap[teamId]) {
        return { text: 'Completado', status: 'completed' };
      }
      if (totalIdeas > 0) {
        return { text: 'En Progreso', status: 'in_progress' };
      }
      return { text: 'Pendiente', status: 'pending' };
    }

    // Old questions format (kept for backwards compat)
    if ('questions' in (mapData || {})) {
      const questions = (mapData as BubbleMapData).questions || [];
      const mandatory = questions.filter((q: any) => !q.isOptional);
      const hasMinimum = mandatory.length >= 5 && mandatory.every((q: any) => q.answers.length >= 2);
      if (hasMinimum) return { text: 'Completado', status: 'completed' };
      if (questions.length > 0) return { text: 'En Progreso', status: 'in_progress' };
      return { text: 'Pendiente', status: 'pending' };
    }

    return { text: 'Pendiente', status: 'pending' };
  };

  const getV2TotalIdeas = (mapData: any): number => {
    if (!mapData || mapData.version !== 2) return 0;
    const nodes: V2NodeData[] = [...(mapData.nodes ?? []), ...(mapData.customNodes ?? [])];
    return nodes.reduce((sum, n) => sum + (n.ideas?.length ?? 0), 0);
  };

  const renderNodeGrid = (mapData: any) => {
    const nodes: V2NodeData[] = mapData?.nodes ?? [];
    const customNodes: V2NodeData[] = mapData?.customNodes ?? [];
    const allNodes = [...nodes, ...customNodes];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
        {allNodes.map((node) => {
          const ideaCount = node.ideas?.length ?? 0;
          const isEmpty = ideaCount === 0;
          const rgb = node.rgb || '192,38,211';
          return (
            <div
              key={node.id}
              style={{
                background: `rgba(${rgb},${isEmpty ? 0.04 : 0.15})`,
                border: `1px solid rgba(${rgb},${isEmpty ? 0.12 : 0.4})`,
                borderRadius: 8,
                padding: '8px 6px',
                textAlign: 'center',
                opacity: isEmpty ? 0.55 : 1,
              }}
            >
              <div style={{ fontSize: 14, marginBottom: 2 }}>{node.icon || '✦'}</div>
              <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, color: node.color || '#fff', marginBottom: 4 }}>
                {node.label}
              </div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {ideaCount}
              </div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>ideas</div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderModalContent = (mapData: any) => {
    if (!mapData || mapData.version !== 2) {
      return (
        <div style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: 40, fontStyle: 'italic' }}>
          Formato no compatible con esta vista
        </div>
      );
    }
    const allNodes: V2NodeData[] = [...(mapData.nodes ?? []), ...(mapData.customNodes ?? [])];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
        {allNodes.map((node) => {
          const rgb = node.rgb || '192,38,211';
          return (
            <div key={node.id} style={{ background: `rgba(${rgb},0.1)`, border: `1px solid rgba(${rgb},0.3)`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{node.icon || '✦'}</span>
                <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, fontWeight: 700, color: node.color || '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {node.label}
                </span>
              </div>
              {(node.ideas?.length ?? 0) === 0 ? (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Sin ideas</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {node.ideas.map((idea, i) => (
                    <span
                      key={idea.id || i}
                      style={{ background: `rgba(${rgb},0.2)`, color: node.color || '#fff', border: `1px solid rgba(${rgb},0.3)`, borderRadius: 10, padding: '3px 8px', fontSize: 11, fontFamily: "'Exo 2',sans-serif" }}
                    >
                      {idea.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading && teamsWithMaps.length === 0) {
    return (
      <GalacticPage>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
        </div>
      </GalacticPage>
    );
  }

  const totalIdeas = teamsWithMaps.reduce((sum, { bubbleMap }) => {
    if (!bubbleMap) return sum;
    const md = bubbleMap.map_data as any;
    if (md?.version === 2) return sum + getV2TotalIdeas(md);
    if ('questions' in (md || {})) {
      return sum + ((md.questions || []) as any[]).reduce((s: number, q: any) => s + q.answers.length, 0);
    }
    return sum;
  }, 0);

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
        <div className="galactic-badge">{currentActivity?.name || 'Bubble Map'}</div>
      </div>

      {/* Timer with sala code */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', marginBottom: 14 }}>
        <div style={{ minWidth: 110 }}>
          <div className="galactic-label" style={{ fontSize: 11, marginBottom: 4 }}>Sala</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 700, color: '#c026d3', letterSpacing: 4 }}>
            {gameSession?.room_code ?? '--'}
          </div>
        </div>
        <TimerBlock timerRemaining={timerRemaining} activityName="Mapa de Empatía" />
        <div style={{ minWidth: 110 }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
        {([
          { label: 'Completados', value: `${teamsWithMaps.filter(({ team, bubbleMap }) => getBubbleMapStatus(bubbleMap, team.id).status === 'completed').length} / ${teamsWithMaps.length}`, sub: 'mapas finalizados', valueStyle: { color: '#34d399' } },
          { label: 'Ideas Totales', value: String(totalIdeas), sub: 'entre todos los equipos', valueStyle: {} },
          { label: 'Actividad Actual', value: currentActivity?.name || 'Bubble Map', sub: 'mapa de empatía V2', valueStyle: { fontSize: 18, color: '#d946ef' } },
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
        {teamsWithMaps.map(({ team, bubbleMap }) => {
          const teamColor = getTeamColorHex(team.color);
          const status = getBubbleMapStatus(bubbleMap, team.id);
          const isCompleted = status.status === 'completed';
          const isInProgress = status.status === 'in_progress';
          const mapData = bubbleMap?.map_data as any;
          const isV2 = mapData?.version === 2;
          const teamIdeas = isV2 ? getV2TotalIdeas(mapData) : 0;
          const progressPct = isCompleted ? 100 : Math.min(90, (teamIdeas / 10) * 100);
          const personaName = teamChallenges[team.id]?.persona_name;
          const teamPersonaName = isV2 && mapData?.central?.personName ? mapData.central.personName : personaName;
          const teamPersonaEmoji = isV2 && mapData?.central?.emoji ? mapData.central.emoji : '';

          return (
            <div
              key={team.id}
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
                    {personalizations[team.id]?.team_name ? `Equipo ${personalizations[team.id].team_name}` : team.name}
                  </div>
                  {teamPersonaName && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      {teamPersonaEmoji} {teamPersonaName}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap' as const, flexShrink: 0,
                  ...(isCompleted
                    ? { background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.4)' }
                    : isInProgress
                    ? { background: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }
                    : { background: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)' }),
                }}>
                  {isCompleted ? '✓ Listo' : isInProgress ? '⏳ En progreso' : '⏳ Pendiente'}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#7c3aed,#c026d3)', borderRadius: 2, transition: 'width 0.5s' }} />
              </div>

              {/* Node grid or placeholder */}
              {isV2 && bubbleMap ? (
                <>
                  {renderNodeGrid(mapData)}
                  <button
                    onClick={() => setPreviewMap({ team, bubbleMap })}
                    style={{ width: '100%', background: 'rgba(192,38,211,0.12)', border: '1px solid rgba(192,38,211,0.35)', color: '#d946ef', fontSize: 11, fontFamily: "'Exo 2',sans-serif", fontWeight: 600, padding: '7px 0', borderRadius: 8, cursor: 'pointer', letterSpacing: 1 }}
                  >
                    {isCompleted ? 'Ver Mapa Completo →' : 'Ver Mapa Parcial →'}
                  </button>
                </>
              ) : (
                <div style={{ padding: '18px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                  Esperando inicio del mapa...
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24, paddingBottom: 8 }}>
        <button className="btn-galactic-secondary" onClick={() => navigate('/profesor/panel')}>
          Cancelar Sesión
        </button>
        {allTeamsCompleted && (
          <button className="btn-galactic-primary" onClick={() => handleNextActivity(false)} disabled={loading}>
            {loading ? 'Avanzando...' : 'Continuar ▶'}
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

      {/* Preview modal — dark galactic */}
      {previewMap && (
        <>
          <div
            onClick={() => setPreviewMap(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 40 }}
          />
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div
              className="glass-card"
              style={{ maxWidth: 700, width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'rgba(5,8,24,0.97)', borderColor: 'rgba(255,255,255,0.12)' }}
            >
              {/* Modal header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: getTeamColorHex(previewMap.team.color) }} />
                  <div>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>
                      {personalizations[previewMap.team.id]?.team_name
                        ? `Equipo ${personalizations[previewMap.team.id].team_name}`
                        : previewMap.team.name}
                    </div>
                    {(previewMap.bubbleMap.map_data as any)?.central && (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                        {(previewMap.bubbleMap.map_data as any).central.emoji} {(previewMap.bubbleMap.map_data as any).central.personName}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setPreviewMap(null)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              </div>

              {/* Modal body */}
              <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
                {renderModalContent(previewMap.bubbleMap.map_data)}
              </div>

              {/* Modal footer */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ background: 'rgba(192,38,211,0.15)', border: '1px solid rgba(192,38,211,0.3)', borderRadius: 20, padding: '6px 20px', fontSize: 13, color: '#d946ef', fontFamily: "'Exo 2',sans-serif" }}>
                  {getV2TotalIdeas(previewMap.bubbleMap.map_data)} ideas totales
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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

