import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Confetti } from '@/components/Confetti';
import { UBotResultadosModal } from '@/components/UBotResultadosModal';
import { StarfieldBackground } from '@/components/StarfieldBackground';
import { PodiumScreen } from '@/components/PodiumScreen';
import { sessionsAPI, tabletConnectionsAPI } from '@/services';
import { toast } from 'sonner';

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total?: number;
}

interface TeamResult {
  team_id: number;
  team_name: string;
  team_color: string;
  tokens_stage: number;
  tokens_total: number;
  activities_progress: Array<{
    activity_name: string;
    status: string;
  }>;
}

interface StageResults {
  stage_number: number;
  stage_name: string;
  teams_results: TeamResult[];
}

export function TabletResultadosEtapa1() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<StageResults | null>(null);
  const [myTeamResult, setMyTeamResult] = useState<TeamResult | null>(null);
  const [myRank, setMyRank] = useState<number>(0);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [showUBotModal, setShowUBotModal] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const ubotModalShownRef = useRef(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) {
      navigate('/tablet/join');
      return;
    }
    setConnectionId(connId);
    loadGameState(connId);

    intervalRef.current = setInterval(() => {
      loadGameState(connId);
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
      if (connId) {
        tabletConnectionsAPI.updateTabletScreen(connId, 'lobby').catch(() => {});
      }
    };
  }, [searchParams, navigate]);

  const loadGameState = async (connId: string) => {
    try {
      const statusData = await tabletConnectionsAPI.getStatus(connId);

      if (!statusData || !statusData.team) {
        toast.error('Conexión no encontrada. Por favor reconecta.');
        setTimeout(() => {
          navigate('/tablet/join');
        }, 3000);
        return;
      }

      setTeam(statusData.team);
      const sessionId = statusData.game_session.id;
      setGameSessionId(sessionId);

      const lobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
      const gameData = lobbyData.game_session;

      const currentActivityId = gameData.current_activity;
      const currentActivityName = gameData.current_activity_name?.toLowerCase() || '';
      const currentStageNumber = gameData.current_stage_number || 1;

      const currentPath = window.location.pathname;
      const isResultadosPage = currentPath.includes('/resultados');

      const stageIdParam = searchParams.get('stage_id');
      let targetStageNumber = currentStageNumber;

      const isStage4Results = isResultadosPage && (targetStageNumber === 4 || currentStageNumber === 4);

      if (gameData.status === 'finished' || gameData.status === 'completed') {
        if (isStage4Results) {
          try {
            const stagesData = await sessionsAPI.getSessionStages(statusData.game_session.id);
            if (Array.isArray(stagesData)) {
              const stage4 = stagesData.find((s: any) => s.stage_number === 4);
              if (stage4?.presentation_timestamps?._reflection === true) {
                window.location.href = `/tablet/reflexion/?connection_id=${connId}`;
                return;
              }
            }
          } catch (error) {
            console.warn('Error verificando reflexión, permaneciendo en resultados:', error);
          }
          return;
        }

        toast.info('El juego ha finalizado. Redirigiendo...');
        setTimeout(() => {
          navigate('/tablet/join');
        }, 2000);
        return;
      }

      if (gameData.status === 'lobby') {
        navigate(`/tablet/lobby?connection_id=${connId}`);
        return;
      }

      if (isResultadosPage) {
        if (stageIdParam) {
          targetStageNumber = parseInt(stageIdParam, 10) || currentStageNumber;
        } else if (currentPath.includes('/etapa2/resultados')) {
          targetStageNumber = 2;
        } else if (currentPath.includes('/etapa3/resultados')) {
          targetStageNumber = 3;
        } else if (currentPath.includes('/etapa4/resultados')) {
          targetStageNumber = 4;
        } else if (currentPath.includes('/etapa1/resultados')) {
          targetStageNumber = 1;
        } else if (currentPath === '/tablet/resultados' || currentPath.includes('/tablet/resultados')) {
          targetStageNumber = currentStageNumber;
        } else {
          targetStageNumber = 1;
        }
      }

      if (currentStageNumber > targetStageNumber && currentActivityId && currentActivityName) {
        if (hasLoadedRef.current) {
          // Live transition: tablet was on this results page → warp to new stage
          const destBase = buildTabletUrl(currentStageNumber, currentActivityName);
          if (destBase) {
            window.location.href = `/tablet/etapa-warp?stage=${currentStageNumber}&redirect=${encodeURIComponent(destBase)}&connection_id=${connId}`;
            return;
          }
        }
        // Reconnection (initial load, hasLoadedRef still false) → direct nav
        if (currentStageNumber === 3) {
          const normalizedName = currentActivityName;
          if (normalizedName.includes('prototipo') || normalizedName.includes('lego')) {
            window.location.href = `/tablet/etapa3/prototipo/?connection_id=${connId}`;
          } else {
            window.location.href = `/tablet/etapa3/resultados/?connection_id=${connId}`;
          }
        } else if (currentStageNumber === 4) {
          const normalizedName = currentActivityName;
          if (normalizedName.includes('formulario') || normalizedName.includes('pitch')) {
            window.location.href = `/tablet/etapa4/formulario-pitch/?connection_id=${connId}`;
          } else {
            window.location.href = `/tablet/lobby?connection_id=${connId}`;
          }
        } else {
          window.location.href = `/tablet/lobby?connection_id=${connId}`;
        }
        return;
      }

      if (currentActivityId && currentActivityName && !isResultadosPage) {
        if (currentStageNumber === 2) {
          if (currentActivityName.includes('tema') || currentActivityName.includes('seleccionar')) {
            window.location.href = `/tablet/etapa2/seleccionar-tema/?connection_id=${connId}`;
          } else if (currentActivityName.includes('bubble') || currentActivityName.includes('mapa')) {
            window.location.href = `/tablet/etapa2/bubble-map/?connection_id=${connId}`;
          } else {
            window.location.href = `/tablet/lobby?connection_id=${connId}`;
          }
        } else if (currentStageNumber === 3) {
          if (currentActivityName.includes('prototipo') || currentActivityName.includes('lego')) {
            window.location.href = `/tablet/etapa3/prototipo/?connection_id=${connId}`;
          } else {
            window.location.href = `/tablet/lobby?connection_id=${connId}`;
          }
        } else if (currentStageNumber === 4) {
          if (currentActivityName.includes('formulario') || currentActivityName.includes('pitch')) {
            window.location.href = `/tablet/etapa4/formulario-pitch/?connection_id=${connId}`;
          } else {
            window.location.href = `/tablet/lobby?connection_id=${connId}`;
          }
        } else {
          window.location.href = `/tablet/lobby?connection_id=${connId}`;
        }
        return;
      }

      if (isResultadosPage && currentActivityId && currentActivityName && currentStageNumber > targetStageNumber) {
        if (currentStageNumber === 3) {
          const normalizedName = currentActivityName;
          if (normalizedName.includes('prototipo') || normalizedName.includes('lego')) {
            window.location.href = `/tablet/etapa3/prototipo/?connection_id=${connId}`;
          } else {
            window.location.href = `/tablet/etapa3/resultados/?connection_id=${connId}`;
          }
        } else if (currentStageNumber === 4) {
          const normalizedName = currentActivityName;
          if (normalizedName.includes('formulario') || normalizedName.includes('pitch')) {
            window.location.href = `/tablet/etapa4/formulario-pitch/?connection_id=${connId}`;
          } else {
            window.location.href = `/tablet/lobby?connection_id=${connId}`;
          }
        } else {
          window.location.href = `/tablet/lobby?connection_id=${connId}`;
        }
        return;
      }

      if (isResultadosPage || !currentActivityId) {
        let stageId: number | undefined = undefined;

        console.log('📊 Tablet - Cargando resultados para etapa:', targetStageNumber);

        try {
          const stagesData = await sessionsAPI.getSessionStages(statusData.game_session.id);
          if (Array.isArray(stagesData)) {
            const targetStage = stagesData.find((s: any) => s.stage_number === targetStageNumber);
            if (targetStage && targetStage.stage) {
              stageId = typeof targetStage.stage === 'object' ? targetStage.stage.id : targetStage.stage;
              console.log('✅ Tablet - Stage ID encontrado:', stageId, 'para etapa', targetStageNumber);

              if (targetStageNumber === 4) {
                const presentationTimestamps = targetStage.presentation_timestamps || {};
                if (presentationTimestamps._reflection === true) {
                  console.log('✅ Tablet - Profesor inició reflexión, redirigiendo...');
                  window.location.href = `/tablet/reflexion/?connection_id=${connId}`;
                  return;
                }
              }
            } else {
              console.warn('⚠️ Tablet - No se encontró stage para etapa', targetStageNumber);
            }
          }
        } catch (error) {
          console.warn('⚠️ Tablet - No se pudo obtener el stage_id específico, intentando sin parámetro:', error);
        }

        console.log('📊 Tablet - Llamando a loadStageResults con:', {
          gameSessionId: statusData.game_session.id,
          stageId: stageId,
          targetStageNumber: targetStageNumber
        });
        await loadStageResults(statusData.game_session.id, stageId, statusData.team, targetStageNumber);
      }

      if (isResultadosPage) {
        const stageNum = targetStageNumber || currentStageNumber || 1;
        tabletConnectionsAPI.updateTabletScreen(connId, `results_${stageNum}`).catch(() => {});
      }
      hasLoadedRef.current = true;
      setLoading(false);
    } catch (error: any) {
      console.error('Error loading game state:', error);
      if (error.response?.status === 404) {
        toast.error('Conexión no encontrada. Por favor reconecta.');
        setTimeout(() => {
          navigate('/tablet/join');
        }, 3000);
      } else {
        toast.error('Error de conexión: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
      }
      setLoading(false);
    }
  };

  const buildTabletUrl = (stageNumber: number, activityName: string): string => {
    const n = activityName.toLowerCase().trim();
    if (stageNumber === 2) {
      if (n.includes('bubble') || n.includes('mapa')) return '/tablet/etapa2/bubble-map/';
      return '/tablet/etapa2/seleccionar-tema/';
    }
    if (stageNumber === 3) return '/tablet/etapa3/prototipo/';
    if (stageNumber === 4) {
      if (n.includes('presentaci')) return '/tablet/etapa4/presentacion-pitch/';
      return '/tablet/etapa4/formulario-pitch/';
    }
    return '';
  };

  const loadStageResults = async (gameSessionId: number, stageId: number | undefined, currentTeam: Team, stageNumber?: number) => {
    try {
      const validStageId = (stageId !== undefined && stageId !== null && !isNaN(Number(stageId)) && Number(stageId) > 0)
        ? stageId
        : undefined;

      const resultsData: StageResults = await sessionsAPI.getStageResults(gameSessionId, validStageId);

      if (stageNumber && resultsData.stage_number !== stageNumber) {
        console.warn(`Los resultados obtenidos son de la etapa ${resultsData.stage_number}, pero se esperaba la etapa ${stageNumber}`);
      }

      setResults(resultsData);

      const teamsOrdered = [...resultsData.teams_results].sort((a, b) => b.tokens_total - a.tokens_total);

      if (currentTeam) {
        const myTeam = teamsOrdered.find(t => t.team_id === currentTeam.id);
        const rank = teamsOrdered.findIndex(t => t.team_id === currentTeam.id) + 1;

        if (myTeam) {
          setMyTeamResult(myTeam);
          setMyRank(rank);

          const modalKey = `ubot_resultados_${gameSessionId}_${resultsData.stage_number}`;
          const hasSeenModal = localStorage.getItem(modalKey);

          if (!hasSeenModal && !ubotModalShownRef.current) {
            setTimeout(() => {
              setShowUBotModal(true);
              localStorage.setItem(modalKey, 'true');
              ubotModalShownRef.current = true;
            }, 500);
          }
        }
      }
    } catch (error: any) {
      console.error('Error cargando resultados:', error);
      toast.error('Error al cargar resultados: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
    }
  };

  // U-Bot modal trigger after results load
  useEffect(() => {
    if (results && myTeamResult && myRank > 0 && gameSessionId && !ubotModalShownRef.current) {
      const modalKey = `ubot_resultados_${gameSessionId}_${results.stage_number}`;
      const hasSeenModal = localStorage.getItem(modalKey);

      if (!hasSeenModal) {
        setTimeout(() => {
          setShowUBotModal(true);
          localStorage.setItem(modalKey, 'true');
          ubotModalShownRef.current = true;
        }, 300);
      } else {
        ubotModalShownRef.current = true;
      }
    }
  }, [results, myTeamResult, myRank, gameSessionId]);

  if (loading) {
    return (
      <StarfieldBackground>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
        </div>
      </StarfieldBackground>
    );
  }

  if (!team || !results || !myTeamResult) {
    return (
      <StarfieldBackground>
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 17, color: 'rgba(255,255,255,0.8)' }}>
            Cargando resultados...
          </p>
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      </StarfieldBackground>
    );
  }

  return (
    <>
      <Confetti active={results.stage_number === 4} />
      <PodiumScreen
        teams={results?.teams_results ?? []}
        stageName={results?.stage_name ?? 'Trabajo en Equipo'}
        onContinue={() => {
          if (connectionId) {
            navigate(`/tablet/lobby?connection_id=${connectionId}`);
          } else {
            navigate('/tablet/lobby');
          }
        }}
      />
      {team && (
        <UBotResultadosModal
          isOpen={showUBotModal}
          onClose={() => setShowUBotModal(false)}
          rank={myRank}
          teamColor={team.color}
          stageNumber={results?.stage_number || 1}
          tokensTotal={myTeamResult?.tokens_total || 0}
        />
      )}
    </>
  );
}
