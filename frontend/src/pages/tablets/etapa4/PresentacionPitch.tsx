import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Coins } from 'lucide-react';
import { UBotPresentacionPitchModal } from '@/components/UBotPresentacionPitchModal';
import StarField from '../etapa2/StarField';
import {
  sessionsAPI,
  sessionStagesAPI,
  peerEvaluationsAPI,
  tabletConnectionsAPI,
  teamPersonalizationsAPI,
} from '@/services';
import { toast } from 'sonner';

const GALACTIC_CSS = `
@keyframes micPulse{0%,100%{opacity:.5;transform:scale(.94)}50%{opacity:.95;transform:scale(1.05)}}
@keyframes micFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes hgFloat{0%,100%{transform:rotate(0deg)}50%{transform:rotate(180deg)}}
@keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}
@keyframes phPulse{0%,100%{opacity:1}50%{opacity:.55}}
`;

interface Team {
  id: number;
  name: string;
  color: string;
  tokens?: number;
  tokens_total?: number;
}

interface PresentationStatus {
  presentation_order: number[];
  current_presentation_team_id: number | null;
  teams: Team[];
  order_confirmed: boolean;
  completed_team_ids: number[];
  presentation_state: string;
  current_team_prototype: string | null;
  current_team_pitch: {
    intro_problem: string;
    solution: string;
    value: string;
    impact: string;
    closing: string;
  } | null;
}

interface GameSession {
  id: number;
  current_stage_number?: number;
  status?: string;
  current_activity_name?: string | null;
  current_activity?: number | null;
}

export function TabletPresentacionPitch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [personalization, setPersonalization] = useState<{ team_name?: string } | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [showUBotModal, setShowUBotModal] = useState(false);
  const [presentationStatus, setPresentationStatus] = useState<PresentationStatus | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<string>('01:30');
  const [evaluationSubmitted, setEvaluationSubmitted] = useState(false);
  const [isSubmittingEvaluation, setIsSubmittingEvaluation] = useState(false);
  const [isCheckingEvaluation, setIsCheckingEvaluation] = useState(false);
  const [evaluationScores, setEvaluationScores] = useState({
    clarity: 5,
    solution: 5,
    presentation: 5,
    feedback: '',
  });
  const [receivedEvaluations, setReceivedEvaluations] = useState<any[]>([]);
  const [evaluationProgress, setEvaluationProgress] = useState<{
    completed: number;
    total: number;
  }>({ completed: 0, total: 0 });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousPresentationStateRef = useRef<string | null>(null);
  const previousPresentationTeamIdRef = useRef<number | null>(null);
  const localTimerSecondsRef = useRef<number>(90);
  const syncCounterRef = useRef<number>(0);
  const previousEvaluatedTeamIdRef = useRef<number | null>(null);
  const evalIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkingEvaluationRef = useRef<boolean>(false);
  const lastCheckedTeamIdRef = useRef<number | null>(null);

  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) {
      navigate('/tablet/join');
      return;
    }
    setConnectionId(connId);

    loadGameState(connId);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      loadGameState(connId);
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (evalIntervalRef.current) clearInterval(evalIntervalRef.current);
    };
  }, [searchParams, navigate]);

  // CRÍTICO: Verificar evaluación existente cuando estamos evaluando a otro equipo
  useEffect(() => {
    if (!team || !gameSessionId || !presentationStatus) {
      return;
    }

    const currentState = presentationStatus.presentation_state || 'not_started';
    const currentEvaluatedTeamId = presentationStatus.current_presentation_team_id;
    const isEvaluatingOtherTeam = currentState === 'evaluating' &&
                                   currentEvaluatedTeamId &&
                                   currentEvaluatedTeamId !== team.id;

    if (isEvaluatingOtherTeam) {
      if (previousEvaluatedTeamIdRef.current !== currentEvaluatedTeamId ||
          lastCheckedTeamIdRef.current !== currentEvaluatedTeamId) {
        checkExistingEvaluation(currentEvaluatedTeamId).catch(() => {});
      }
    } else if (currentState !== 'evaluating') {
      setEvaluationSubmitted(false);
      lastCheckedTeamIdRef.current = null;
      checkingEvaluationRef.current = false;
    }
  }, [team?.id, gameSessionId, presentationStatus?.presentation_state, presentationStatus?.current_presentation_team_id]);

  // Mostrar modal de U-Bot solo cuando el equipo está preparándose
  useEffect(() => {
    if (!team || !presentationStatus) return;

    const isMyTurn = presentationStatus.current_presentation_team_id === team.id;
    const presentationState = presentationStatus.presentation_state || 'not_started';
    const isPreparing = presentationState === 'preparing' && isMyTurn;

    if (isPreparing && gameSessionId && team) {
      const ubotKey = `ubot_presentacion_pitch_${gameSessionId}_${team.id}`;
      const hasSeenUBot = localStorage.getItem(ubotKey);
      if (!hasSeenUBot) {
        setTimeout(() => {
          setShowUBotModal(true);
          localStorage.setItem(ubotKey, 'true');
        }, 500);
      }
    }
  }, [presentationStatus, gameSessionId, team]);

  // Cargar evaluaciones automáticamente cuando el equipo está esperando evaluaciones
  useEffect(() => {
    if (!team || !gameSessionId || !presentationStatus) {
      if (evalIntervalRef.current) {
        clearInterval(evalIntervalRef.current);
        evalIntervalRef.current = null;
      }
      return;
    }

    const currentState = presentationStatus.presentation_state || 'not_started';
    const currentIsMyTurn = presentationStatus.current_presentation_team_id === team.id;

    if (currentState === 'evaluating' && currentIsMyTurn) {
      loadMyEvaluations();

      if (evalIntervalRef.current) {
        clearInterval(evalIntervalRef.current);
      }

      evalIntervalRef.current = setInterval(() => {
        loadMyEvaluations();
      }, 2000);

      return () => {
        if (evalIntervalRef.current) {
          clearInterval(evalIntervalRef.current);
          evalIntervalRef.current = null;
        }
      };
    } else {
      if (evalIntervalRef.current) {
        clearInterval(evalIntervalRef.current);
        evalIntervalRef.current = null;
      }
    }
  }, [team?.id, gameSessionId, presentationStatus?.presentation_state, presentationStatus?.current_presentation_team_id]);

  const loadGameState = async (connId: string) => {
    try {
      let statusData;
      try {
        statusData = await tabletConnectionsAPI.getStatus(connId);
      } catch (error: any) {
        if (error.response?.status === 404) {
          toast.error('Conexión no encontrada. Por favor reconecta.');
          setTimeout(() => {
            navigate('/tablet/join');
          }, 2000);
          return;
        }
        throw error;
      }
      const teamData: Team = statusData.team;
      setTeam(teamData);
      setGameSessionId(statusData.game_session.id);

      try {
        const persList = await teamPersonalizationsAPI.list({ team: teamData.id }) as any[];
        const persArray = Array.isArray(persList) ? persList : [];
        if (persArray.length > 0) {
          setPersonalization(persArray[0]);
        }
      } catch (error) {
        console.error('Error cargando personalización:', error);
      }

      const lobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
      const gameData: GameSession = lobbyData.game_session;

      if (gameData.status === 'finished' || gameData.status === 'completed') {
        toast.info('La sesión ha finalizado. Redirigiendo...');
        setTimeout(() => navigate('/tablet/join'), 2000);
        return;
      }

      const currentStageNumber = gameData.current_stage_number || 1;
      const currentActivityName = gameData.current_activity_name?.toLowerCase() || '';
      const currentActivityId = gameData.current_activity;

      if (currentStageNumber !== 4) {
        if (currentStageNumber === 3) {
          const normalizedName = currentActivityName;
          if (normalizedName.includes('prototipo') || normalizedName.includes('lego')) {
            window.location.href = `/tablet/etapa3/prototipo/?connection_id=${connId}`;
          } else {
            window.location.href = `/tablet/etapa3/resultados/?connection_id=${connId}`;
          }
        } else if (currentStageNumber > 4 || (!currentActivityName && currentStageNumber === 4)) {
          window.location.href = `/tablet/resultados/?connection_id=${connId}&stage_id=4`;
          return;
        } else {
          window.location.href = `/tablet/lobby?connection_id=${connId}`;
        }
        return;
      }

      if (currentStageNumber === 4 && (!currentActivityName || !currentActivityId)) {
        window.location.href = `/tablet/resultados/?connection_id=${connId}&stage_id=4`;
        return;
      }

      const stagesData = await sessionsAPI.getSessionStages(statusData.game_session.id);
      const stagesList = Array.isArray(stagesData) ? stagesData : [stagesData];
      const stage4 = stagesList.find((s: any) => s.stage_number === 4) || null;

      if (stage4 && stage4.status === 'completed') {
        window.location.href = `/tablet/resultados/?connection_id=${connId}&stage_id=4`;
        return;
      }

      if (stage4) {
        const allPresentationsCompleted =
          !stage4.current_presentation_team_id &&
          stage4.presentation_state !== 'not_started' &&
          stage4.presentation_order &&
          stage4.presentation_order.length > 0;

        const noCurrentActivity = !currentActivityName || currentActivityName.trim() === '';

        if (allPresentationsCompleted || noCurrentActivity) {
          window.location.href = `/tablet/resultados/?connection_id=${connId}&stage_id=4`;
          return;
        }

        if (stage4.presentation_state === 'evaluating' &&
            stage4.current_presentation_team_id &&
            stage4.current_presentation_team_id !== teamData.id) {
          previousEvaluatedTeamIdRef.current = stage4.current_presentation_team_id;
        }

        loadPresentationStatus(stage4.id, connId).catch(() => {});
      } else {
        if (currentStageNumber === 4 && (!currentActivityName || !currentActivityId)) {
          window.location.href = `/tablet/resultados/?connection_id=${connId}&stage_id=4`;
          return;
        }
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading game state:', error);
      toast.error('Error de conexión: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
      setLoading(false);
    }
  };

  const loadPresentationStatus = async (stageId: number, connId?: string) => {
    try {
      const status: PresentationStatus = await sessionStagesAPI.getPresentationStatus(stageId);

      const stateChanged = previousPresentationStateRef.current !== status.presentation_state;
      const wasPreparing = previousPresentationStateRef.current === 'preparing';
      const isNowPresenting = status.presentation_state === 'presenting';
      const wasNotPresenting = previousPresentationStateRef.current !== 'presenting';

      setPresentationStatus(status);

      previousPresentationStateRef.current = status.presentation_state;
      previousPresentationTeamIdRef.current = status.current_presentation_team_id || null;

      if (!intervalRef.current) {
        const currentConnId = connId || connectionId;
        if (currentConnId) {
          const pollInterval = status.presentation_state === 'preparing' ? 2000 :
                              status.presentation_state === 'evaluating' ? 3000 : 3000;
          intervalRef.current = setInterval(() => {
            loadGameState(currentConnId);
          }, pollInterval);
        }
      }

      const evaluatedTeamChanged =
        status.presentation_state === 'evaluating' &&
        status.current_presentation_team_id &&
        previousEvaluatedTeamIdRef.current !== null &&
        previousEvaluatedTeamIdRef.current !== status.current_presentation_team_id;

      if (evaluatedTeamChanged) {
        setEvaluationSubmitted(false);
        setEvaluationScores({
          clarity: 5,
          solution: 5,
          presentation: 5,
          feedback: '',
        });
        previousEvaluatedTeamIdRef.current = status.current_presentation_team_id;
        lastCheckedTeamIdRef.current = null;
        checkingEvaluationRef.current = false;
        if (status.current_presentation_team_id) {
          checkExistingEvaluation(status.current_presentation_team_id).catch(() => {});
        }
      } else if (status.presentation_state === 'evaluating' &&
          status.current_presentation_team_id &&
          status.current_presentation_team_id !== team?.id) {
        if (previousEvaluatedTeamIdRef.current !== status.current_presentation_team_id) {
          previousEvaluatedTeamIdRef.current = status.current_presentation_team_id;
          lastCheckedTeamIdRef.current = null;
        }
      } else if (status.presentation_state !== 'evaluating') {
        if (previousEvaluatedTeamIdRef.current !== null) {
          previousEvaluatedTeamIdRef.current = null;
          lastCheckedTeamIdRef.current = null;
          checkingEvaluationRef.current = false;
          setEvaluationSubmitted(false);
        }
      } else if (status.presentation_state === 'evaluating' && !previousEvaluatedTeamIdRef.current && status.current_presentation_team_id) {
        previousEvaluatedTeamIdRef.current = status.current_presentation_team_id;
      }

      if (status.presentation_state === 'evaluating' && status.current_presentation_team_id === team?.id) {
        if (team && gameSessionId) {
          loadMyEvaluations();
        }
      }

      if (isNowPresenting && status.current_presentation_team_id) {
        if (!timerIntervalRef.current || stateChanged || wasPreparing || (isNowPresenting && wasNotPresenting)) {
          startPresentationTimer(stageId).catch(() => {});
        }
      } else {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        if (status.presentation_state !== 'presenting' && status.presentation_state !== 'preparing') {
          setTimerRemaining('01:30');
          localTimerSecondsRef.current = 90;
        }
      }
    } catch (error) {
      // Silently fail
    }
  };

  const checkExistingEvaluation = async (evaluatedTeamId: number) => {
    const currentTeam = team;
    const currentGameSessionId = gameSessionId;

    if (!currentTeam || !currentGameSessionId) {
      return;
    }

    if (checkingEvaluationRef.current && lastCheckedTeamIdRef.current === evaluatedTeamId) {
      return;
    }

    checkingEvaluationRef.current = true;
    lastCheckedTeamIdRef.current = evaluatedTeamId;
    setIsCheckingEvaluation(true);

    try {
      const evaluations = await peerEvaluationsAPI.list({
        evaluator_team: currentTeam.id,
        evaluated_team: evaluatedTeamId,
        game_session: currentGameSessionId
      });
      const evaluationsList = Array.isArray(evaluations) ? evaluations : [evaluations];

      if (evaluationsList.length > 0) {
        const evaluation = evaluationsList[0];
        setEvaluationSubmitted(true);
        setEvaluationScores({
          clarity: evaluation.criteria_scores?.clarity || 5,
          solution: evaluation.criteria_scores?.solution || 5,
          presentation: evaluation.criteria_scores?.presentation || 5,
          feedback: evaluation.feedback || '',
        });
      } else {
        setEvaluationSubmitted(false);
      }
    } catch (error: any) {
      setEvaluationSubmitted(false);
    } finally {
      setIsCheckingEvaluation(false);
      checkingEvaluationRef.current = false;
    }
  };

  const startPresentationTimer = async (stageId: number) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    let serverRemaining = 90;
    let isFinished = false;

    try {
      const timerData = await sessionStagesAPI.getPresentationTimer(stageId);

      if (timerData && !timerData.error) {
        isFinished = timerData.is_finished === true;
        serverRemaining = timerData.remaining_seconds ?? 90;
      }
    } catch (error) {
      // Silently fail
    }

    if (isFinished || serverRemaining <= 0) {
      localTimerSecondsRef.current = 0;
      setTimerRemaining('00:00');
      return;
    }

    localTimerSecondsRef.current = serverRemaining;

    const minutes = Math.floor(localTimerSecondsRef.current / 60);
    const seconds = localTimerSecondsRef.current % 60;
    setTimerRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

    const stageIdForTimer = stageId;
    syncCounterRef.current = 0;

    timerIntervalRef.current = setInterval(() => {
      if (localTimerSecondsRef.current > 0) {
        localTimerSecondsRef.current--;
      }

      const minutes = Math.floor(localTimerSecondsRef.current / 60);
      const seconds = localTimerSecondsRef.current % 60;
      setTimerRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

      if (localTimerSecondsRef.current <= 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setTimerRemaining('00:00');
        return;
      }

      syncCounterRef.current++;

      if (syncCounterRef.current % 5 === 0 && localTimerSecondsRef.current > 0) {
        (async () => {
          try {
            const timerData = await sessionStagesAPI.getPresentationTimer(stageIdForTimer);
            if (timerData && !timerData.error) {
              const isFinished = timerData.is_finished === true;
              const serverRemaining = timerData.remaining_seconds ?? 0;

              if (isFinished || serverRemaining <= 0) {
                if (timerIntervalRef.current) {
                  clearInterval(timerIntervalRef.current);
                  timerIntervalRef.current = null;
                }
                localTimerSecondsRef.current = 0;
                setTimerRemaining('00:00');
                return;
              }

              if (Math.abs(localTimerSecondsRef.current - serverRemaining) > 2) {
                localTimerSecondsRef.current = serverRemaining;
                const minutes = Math.floor(localTimerSecondsRef.current / 60);
                const seconds = localTimerSecondsRef.current % 60;
                setTimerRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
              }
            }
          } catch (error) {
            // Silently fail
          }
        })();
      }
    }, 1000);
  };

  const loadMyEvaluations = async () => {
    if (!team || !gameSessionId) return;

    try {
      const evaluations = await peerEvaluationsAPI.forTeam(team.id, gameSessionId);
      const evaluationsList = Array.isArray(evaluations) ? evaluations : [evaluations];

      setReceivedEvaluations(evaluationsList);

      setPresentationStatus((prevStatus) => {
        if (prevStatus) {
          const otherTeams = prevStatus.teams.filter(t => t.id !== team.id);
          const evaluatorTeamIds = new Set(evaluationsList.map((e: any) => e.evaluator_team || e.evaluator_team_id));
          const completed = evaluatorTeamIds.size;
          const total = otherTeams.length;

          setEvaluationProgress({ completed, total });
        }
        return prevStatus;
      });
    } catch (error: any) {
      // Silently fail
    }
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !gameSessionId || !presentationStatus?.current_presentation_team_id || isSubmittingEvaluation) return;

    const evaluatedTeamId = presentationStatus.current_presentation_team_id;

    setIsSubmittingEvaluation(true);

    const checkExisting = peerEvaluationsAPI.list({
      evaluator_team: team.id,
      evaluated_team: evaluatedTeamId,
      game_session: gameSessionId
    }).catch(() => null);

    try {
      await peerEvaluationsAPI.create({
        evaluator_team_id: team.id,
        evaluated_team_id: evaluatedTeamId,
        game_session_id: gameSessionId,
        criteria_scores: {
          clarity: evaluationScores.clarity,
          solution: evaluationScores.solution,
          presentation: evaluationScores.presentation,
        },
        feedback: evaluationScores.feedback,
      });

      setEvaluationSubmitted(true);
      setIsSubmittingEvaluation(false);
      toast.success('✓ Evaluación enviada exitosamente');

      const existingEvaluations = await checkExisting;
      if (existingEvaluations) {
        const existingList = Array.isArray(existingEvaluations) ? existingEvaluations : [existingEvaluations];
        if (existingList.length > 0) {
          const evaluation = existingList[0];
          setEvaluationScores({
            clarity: evaluation.criteria_scores?.clarity || 5,
            solution: evaluation.criteria_scores?.solution || 5,
            presentation: evaluation.criteria_scores?.presentation || 5,
            feedback: evaluation.feedback || '',
          });
        }
      }

      if (connectionId) {
        tabletConnectionsAPI.getStatus(connectionId)
          .then((statusData) => {
            if (statusData.team) {
              setTeam(statusData.team);
            }
          })
          .catch(() => {});
      }
    } catch (error: any) {
      setIsSubmittingEvaluation(false);

      if (error.response?.status === 400 || error.response?.data?.error?.includes('ya existe')) {
        setEvaluationSubmitted(true);
        await checkExistingEvaluation(evaluatedTeamId);
        toast.warning('Ya habías enviado esta evaluación');
      } else {
        toast.error('Error al enviar evaluación: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const getEvaluatedTeamName = () => {
    if (!presentationStatus?.current_presentation_team_id) return '';
    const evaluatedTeam = presentationStatus.teams.find(
      t => t.id === presentationStatus.current_presentation_team_id
    );
    return getTeamName(evaluatedTeam);
  };

  if (loading) {
    return (
      <div style={{ background: '#050818', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!team || !presentationStatus) {
    return (
      <div style={{ background: '#050818', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#fff', textAlign: 'center', fontFamily: "'Exo 2', sans-serif" }}>
          <p style={{ fontSize: 18, marginBottom: 16 }}>Cargando información de presentación...</p>
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  const isMyTurn = presentationStatus.current_presentation_team_id === team.id;
  const presentationState = presentationStatus.presentation_state || 'not_started';

  const getTeamDisplayName = (): string => {
    if (!team) return '';
    if (personalization?.team_name) {
      return personalization.team_name;
    }
    const match = team.name?.match(/^Equipo\s+(.+)$/i);
    return match ? match[1] : (team.name || team.color);
  };

  const getTeamName = (teamData: Team | null | undefined): string => {
    if (!teamData) return '';
    const match = teamData.name?.match(/^Equipo\s+(.+)$/i);
    return match ? match[1] : (teamData.name || teamData.color);
  };

  const isEvaluating = presentationState === 'evaluating' && !isMyTurn;
  const isPresenting = presentationState === 'presenting' && isMyTurn;
  const isPreparing = presentationState === 'preparing' && isMyTurn;
  const isWaiting = !isMyTurn && presentationState !== 'evaluating';

  let prototypeUrl = presentationStatus.current_team_prototype;
  if (prototypeUrl && prototypeUrl.startsWith('/')) {
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const baseUrl = apiBaseUrl.replace('/api', '');
    prototypeUrl = `${baseUrl}${prototypeUrl}`;
  }

  return (
    <div style={{ background: '#050818', minHeight: '100vh', fontFamily: "'Exo 2', sans-serif", position: 'relative' }}>
      <style>{GALACTIC_CSS}</style>
      <StarField />
      <div style={{ position: 'relative', zIndex: 10, padding: '24px 20px', maxWidth: 860, margin: '0 auto' }}>

        {/* Estado: Esperando Orden */}
        {presentationState === 'not_started' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 60 }}>⏳</div>
            <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(18px,3vw,26px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>Esperando Orden de Presentación</h2>
            <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.5)', maxWidth: 500, lineHeight: 1.7, margin: 0 }}>
              El profesor está configurando el orden de presentación. Espera a que se inicien las presentaciones.
            </p>
          </div>
        )}

        {/* Estado: Llamado a Escenario */}
        {isPreparing && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 24, textAlign: 'center' }}>
            {/* Badge */}
            <div style={{
              fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5,
              color: '#f97316', background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.3)', borderRadius: 50, padding: '6px 20px',
              textTransform: 'uppercase', animation: 'phPulse 1.4s ease-in-out infinite',
            }}>
              ⚠ Llamado urgente
            </div>

            {/* Mic animation */}
            <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'radial-gradient(circle,rgba(249,115,22,0.5) 0%,transparent 65%)',
                filter: 'blur(18px)', animation: 'micPulse 2.4s ease-in-out infinite',
              }} />
              <div style={{ fontSize: 84, filter: 'drop-shadow(0 0 28px rgba(249,115,22,0.8))', animation: 'micFloat 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}>🎤</div>
            </div>

            {/* Title */}
            <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(28px,5vw,46px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(249,115,22,0.6)', margin: 0, lineHeight: 1.1 }}>
              Llamado a<br />Escenario
            </h1>

            {/* Sub */}
            <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 'clamp(14px,1.8vw,16px)', fontWeight: 300, color: 'rgba(255,255,255,0.6)', maxWidth: 560, lineHeight: 1.7, margin: 0 }}>
              Start-up <b style={{ color: '#fff' }}>{getTeamDisplayName().toUpperCase()}</b> requerida en el Centro de Comando.<br />
              Diríjanse al frente inmediatamente.
            </p>

            {/* CTA button */}
            <button
              style={{
                fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
                color: '#fff', background: 'linear-gradient(135deg,#d97706,#f97316)',
                border: 'none', borderRadius: 14, padding: '16px 36px',
                boxShadow: '0 4px 24px rgba(249,115,22,0.4)', cursor: 'default',
              }}
            >
              Tomar el escenario →
            </button>

            {/* U-Bot button */}
            <button
              onClick={() => setShowUBotModal(true)}
              style={{
                fontFamily: "'Exo 2', sans-serif", fontSize: 13, fontWeight: 600,
                color: 'rgba(255,255,255,0.5)', background: 'none', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 50, padding: '8px 20px', cursor: 'pointer', marginTop: -8,
              }}
            >
              🤖 U-Bot
            </button>
          </div>
        )}

        {/* Estado: Presentando */}
        {isPresenting && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 8 }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', color: '#10b981', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 50, padding: '6px 20px' }}>
                ● Presentación en curso
              </div>
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(20px,3.2vw,30px)', fontWeight: 900, color: '#10b981', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(16,185,129,0.5)', margin: 0, textAlign: 'center' }}>
                Su Pitch en Vivo
              </h1>
            </div>

            {/* Timer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 32px', borderRadius: 16, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.4)', backdropFilter: 'blur(12px)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#fbbf24' }}>⏱ TIEMPO RESTANTE</div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 36, fontWeight: 900, letterSpacing: 3, color: '#fff', textShadow: '0 0 40px rgba(249,115,22,0.55)' }}>{timerRemaining}</div>
            </div>

            {/* Two-column grid */}
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              {/* Prototype card */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, backdropFilter: 'blur(16px)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🖼</span> Prototipo del Equipo
                </div>
                <div style={{ flex: 1, minHeight: 220, background: '#0a0e2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  {prototypeUrl ? (
                    <img src={prototypeUrl} alt="Prototipo" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 10 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{ fontSize: 64, filter: 'drop-shadow(0 0 24px rgba(192,38,211,0.55))' }}>🚀</div>
                  )}
                </div>
              </div>

              {/* Script card */}
              {presentationStatus.current_team_pitch && (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, backdropFilter: 'blur(16px)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📋</span> Tu Guión de Pitch
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                    {[
                      { key: 'dolor', color: '#ef4444', tag: 'EL DOLOR', text: presentationStatus.current_team_pitch.intro_problem },
                      { key: 'rescate', color: '#3b82f6', tag: 'EL RESCATE', text: presentationStatus.current_team_pitch.solution },
                      { key: 'diferencia', color: '#c026d3', tag: 'DIFERENCIA', text: presentationStatus.current_team_pitch.value },
                      { key: 'futuro', color: '#10b981', tag: 'EL FUTURO', text: presentationStatus.current_team_pitch.impact },
                      { key: 'cierre', color: '#f59e0b', tag: 'GOLPE FINAL', text: presentationStatus.current_team_pitch.closing },
                    ].filter(s => s.text).map(s => (
                      <div key={s.key} style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.25)', borderLeft: `3px solid ${s.color}` }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: s.color, marginBottom: 4 }}>{s.tag}</div>
                        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
              El equipo tiene 1:30 minutos para presentar su pitch
            </p>
          </div>
        )}

        {/* Estado: Esperando Turno (otro equipo presentando) */}
        {isWaiting && presentationState === 'presenting' && (() => {
          const presentingTeam = presentationStatus?.teams.find(t => t.id === presentationStatus.current_presentation_team_id);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', minHeight: '70vh', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(96,165,250,0.95)', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 50, padding: '6px 20px' }}>
                ⏳ En espera
              </div>

              {/* Hourglass */}
              <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.4) 0%,transparent 65%)', filter: 'blur(16px)' }} />
                <div style={{ fontSize: 68, filter: 'drop-shadow(0 0 24px rgba(59,130,246,0.8))', animation: 'hgFloat 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}>⏳</div>
              </div>

              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(24px,4.4vw,40px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(59,130,246,0.5)', margin: 0, lineHeight: 1.1 }}>
                Esperando<br />tu Turno
              </h1>

              {/* Timer */}
              {timerRemaining !== '01:30' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 28px', borderRadius: 16, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.4)', backdropFilter: 'blur(12px)' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#fbbf24' }}>⏱ TIEMPO RESTANTE</div>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: 3, textShadow: '0 0 40px rgba(249,115,22,0.55)' }}>{timerRemaining}</div>
                </div>
              )}

              {/* Presenter card */}
              {presentingTeam && (
                <div style={{
                  background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 22, backdropFilter: 'blur(16px)', padding: '20px 24px',
                  maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', gap: 12,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 60px rgba(59,130,246,0.12)',
                }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(96,165,250,0.95)', textAlign: 'center' }}>PRESENTANDO AHORA</div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    {prototypeUrl ? (
                      <img src={prototypeUrl} alt="Prototipo" style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: 16, background: '#0a0e2a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>🚀</div>
                    )}
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 1, marginBottom: 4 }}>
                        {getTeamName(presentingTeam).toUpperCase()}
                      </div>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                        🟢 Equipo {presentingTeam.color}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '7px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 50, fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#10b981' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 12px #10b981', animation: 'livePulse 1.2s ease-in-out infinite' }} />
                      En vivo en el escenario
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Estado: Análisis de Competencia */}
        {isEvaluating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 16 }}>
            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', color: '#fbbf24', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 50, padding: '6px 20px', marginBottom: 12, display: 'inline-block' }}>
                ⭐ Análisis de competencia
              </div>
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(22px,3.6vw,34px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(251,191,36,0.5)', margin: 0, lineHeight: 1.1 }}>
                Análisis de<br />Competencia
              </h1>
              <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.6)', marginTop: 10, lineHeight: 1.7 }}>
                ¿Invertirías en la Start-up <b style={{ color: '#fff' }}>{getEvaluatedTeamName().toUpperCase()}</b>? Valora su potencial.
              </p>
            </div>

            {isCheckingEvaluation ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 22, maxWidth: 680, width: '100%' }}>
                <Loader2 style={{ width: 40, height: 40, color: '#3b82f6' }} className="animate-spin" />
                <p style={{ fontFamily: "'Exo 2', sans-serif", color: 'rgba(255,255,255,0.7)', margin: 0 }}>Verificando evaluación…</p>
              </div>
            ) : evaluationSubmitted ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 22, maxWidth: 680, width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: 48 }}>✅</div>
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, fontWeight: 700, color: '#10b981', margin: 0 }}>Evaluación enviada exitosamente</p>
                <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Espera a que el profesor avance al siguiente turno</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitEvaluation} style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 22, backdropFilter: 'blur(16px)', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 60px rgba(251,191,36,0.08)' }}>
                  {/* Compact presenter row */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ width: 54, height: 54, borderRadius: 14, background: '#0a0e2a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🚀</div>
                    <div>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: 0.5 }}>{getEvaluatedTeamName().toUpperCase()}</div>
                      <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Start-up en evaluación</div>
                    </div>
                  </div>

                  {/* Rating rows */}
                  {[
                    { label: 'Relevancia del Dolor', sub: 'El Problema', key: 'clarity' as const },
                    { label: 'Potencial de la Solución', sub: 'El MVP', key: 'solution' as const },
                    { label: 'Poder de Convicción', sub: 'El Pitch', key: 'presentation' as const },
                  ].map(({ label, sub, key }) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff' }}>
                        {label} <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5, marginLeft: 4 }}>{sub}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => {
                          const selected = evaluationScores[key] === n;
                          const below = evaluationScores[key] > n;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setEvaluationScores({ ...evaluationScores, [key]: n })}
                              style={{
                                flex: 1, minWidth: 32, height: 42, borderRadius: 10,
                                fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                border: selected ? '1.5px solid #fbbf24' : below ? '1.5px solid rgba(251,191,36,0.55)' : '1.5px solid rgba(255,255,255,0.1)',
                                background: selected ? 'linear-gradient(135deg,#d97706,#fbbf24)' : below ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.05)',
                                color: selected ? '#0a0e2a' : below ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                                boxShadow: selected ? '0 0 18px rgba(251,191,36,0.45)' : 'none',
                                transition: 'all 0.15s',
                              }}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Strategy textarea */}
                  <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff', marginBottom: 8 }}>
                      Consejo Estratégico <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 }}>Opcional</span>
                    </div>
                    <textarea
                      value={evaluationScores.feedback}
                      onChange={(e) => setEvaluationScores({ ...evaluationScores, feedback: e.target.value })}
                      rows={3}
                      maxLength={400}
                      placeholder="Escriban su consejo estratégico aquí…"
                      style={{
                        width: '100%', boxSizing: 'border-box', minHeight: 80,
                        background: 'rgba(0,0,0,0.25)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 14,
                        color: '#fff', fontFamily: "'Exo 2', sans-serif", fontSize: 14, fontWeight: 400,
                        padding: '12px 14px', lineHeight: 1.6, resize: 'vertical', outline: 'none',
                      }}
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmittingEvaluation}
                    style={{
                      fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
                      color: isSubmittingEvaluation ? 'rgba(255,255,255,0.5)' : '#fff',
                      background: isSubmittingEvaluation ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#093c92,#c026d3)',
                      border: 'none', borderRadius: 12, padding: '14px 24px',
                      cursor: isSubmittingEvaluation ? 'not-allowed' : 'pointer',
                      boxShadow: isSubmittingEvaluation ? 'none' : '0 4px 22px rgba(192,38,211,0.3)',
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {isSubmittingEvaluation ? (
                      <><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> Enviando…</>
                    ) : (
                      '[ Registrar Valoración ]'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Estado: Equipo que presentó esperando */}
        {presentationState === 'evaluating' && isMyTurn && (() => {
          const otherTeams = presentationStatus?.teams.filter(t => t.id !== team.id) || [];

          const totalClarity = receivedEvaluations.reduce((sum: number, e: any) => sum + (e.criteria_scores?.clarity || 0), 0);
          const totalSolution = receivedEvaluations.reduce((sum: number, e: any) => sum + (e.criteria_scores?.solution || 0), 0);
          const totalPresentation = receivedEvaluations.reduce((sum: number, e: any) => sum + (e.criteria_scores?.presentation || 0), 0);
          const totalScore = receivedEvaluations.reduce((sum: number, e: any) => sum + (e.total_score || 0), 0);
          const totalTokens = receivedEvaluations.reduce((sum: number, e: any) => sum + (e.tokens_awarded || 0), 0);
          const count = receivedEvaluations.length;

          const allEvaluationsReceived = evaluationProgress.completed >= evaluationProgress.total && evaluationProgress.total > 0;

          if (allEvaluationsReceived) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', paddingTop: 24 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 50, padding: '6px 20px' }}>
                  Misión Completada · Fase 4
                </div>

                <div style={{ fontSize: 'clamp(48px,8vw,68px)', lineHeight: 1 }}>🎤</div>

                <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(28px,5.5vw,50px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(192,38,211,0.55)', margin: 0, lineHeight: 1.1 }}>
                  ¡Pitch<br />Entregado!
                </h1>

                <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 'clamp(13px,1.7vw,15px)', fontWeight: 300, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, maxWidth: 480, margin: 0 }}>
                  Pasaron de la idea al prototipo, y del prototipo a la historia.<br />Eso es lo que hace que una solución viaje más lejos que su creador.
                </p>

                {/* Score block */}
                <div style={{ background: 'rgba(192,38,211,0.08)', border: '1px solid rgba(192,38,211,0.2)', borderRadius: 18, padding: '18px 40px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(40px,8vw,64px)', fontWeight: 900, color: '#c026d3', textShadow: '0 0 30px rgba(192,38,211,0.55)', lineHeight: 1 }}>{totalScore}</div>
                  <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginTop: 6 }}>puntos obtenidos</div>
                </div>

                {count > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, maxWidth: 480, width: '100%' }}>
                    {[
                      { l: 'Dolor', v: (totalClarity / count).toFixed(1), c: '#3b82f6' },
                      { l: 'Solución', v: (totalSolution / count).toFixed(1), c: '#10b981' },
                      { l: 'Convicción', v: (totalPresentation / count).toFixed(1), c: '#c026d3' },
                    ].map(s => (
                      <div key={s.l} style={{ background: `${s.c}18`, border: `1.5px solid ${s.c}40`, borderRadius: 16, padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11, color: s.c, fontWeight: 600, marginBottom: 4 }}>{s.l}</div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, fontWeight: 900, color: '#fff' }}>{s.v}/10</div>
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  El profesor avanzará cuando todas las start-ups hayan presentado.
                </p>
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 8, width: '100%' }}>
              {/* Header */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>⏳</div>
                <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(20px,3vw,28px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>Esperando Evaluaciones</h2>
                <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>La competencia está decidiendo el valor de su propuesta.</p>
              </div>

              {/* Progress bar */}
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 22, padding: '18px 22px', maxWidth: 680, width: '100%' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  👥 Estado de la Ronda de Inversión
                </div>
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 999, height: 12, marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: '#10b981', boxShadow: '0 0 10px rgba(16,185,129,0.5)', transition: 'width 0.4s', width: `${evaluationProgress.total > 0 ? (evaluationProgress.completed / evaluationProgress.total) * 100 : 0}%` }} />
                </div>
                <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
                  {evaluationProgress.completed} de {evaluationProgress.total} Start-ups han emitido su voto
                </p>
              </div>

              {/* Score stats */}
              {count > 0 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, maxWidth: 680, width: '100%' }}>
                    {[
                      { label: 'Total Claridad', value: totalClarity, avg: totalClarity / count, color: '#3b82f6' },
                      { label: 'Total Solución', value: totalSolution, avg: totalSolution / count, color: '#10b981' },
                      { label: 'Total Presentación', value: totalPresentation, avg: totalPresentation / count, color: '#c026d3' },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${stat.color}40`, borderRadius: 18, padding: '14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: stat.color, fontFamily: 'Orbitron, sans-serif', marginBottom: 4 }}>{stat.value}</div>
                        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{stat.label}</div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: stat.color }}>Prom: {stat.avg.toFixed(1)}/10</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'linear-gradient(135deg,rgba(9,60,146,0.4),rgba(192,38,211,0.3))', border: '1px solid rgba(192,38,211,0.3)', borderRadius: 18, padding: '16px 24px', maxWidth: 680, width: '100%', display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap', textAlign: 'center' }}>
                    <div><div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Puntuación Total</div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 900, color: '#fff' }}>{totalScore}</div></div>
                    <div><div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Tokens Recibidos</div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}><Coins style={{ width: 22, height: 22 }} />{totalTokens}</div></div>
                    <div><div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Promedio</div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 900, color: '#fff' }}>{(totalScore / count).toFixed(1)}/30</div></div>
                  </div>
                </>
              )}

              {/* Panel de inversionistas */}
              <div style={{ maxWidth: 680, width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>👥 Panel de Inversionistas</div>
                {otherTeams.map((ot) => {
                  const ev = receivedEvaluations.find((e: any) => e.evaluator_team === ot.id || e.evaluator_team_id === ot.id);
                  return (
                    <div key={ot.id} style={{ background: ev ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.04)', border: ev ? '1.5px solid rgba(16,185,129,0.3)' : '1.5px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {(() => { const m = ot.name?.match(/^Equipo\s+(.+)$/i); return `Start-up ${m ? m[1] : ot.name}`; })()}
                      </div>
                      {ev ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {[{l:'Claridad',v:ev.criteria_scores?.clarity},{l:'Solución',v:ev.criteria_scores?.solution},{l:'Pitch',v:ev.criteria_scores?.presentation}].map(s => (
                            <div key={s.l} style={{ textAlign: 'center' }}>
                              <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{s.l}</div>
                              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 700, color: '#10b981' }}>{s.v ?? 0}/10</div>
                            </div>
                          ))}
                          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}><Coins style={{ width: 14, height: 14 }} />{ev.tokens_awarded}</div>
                        </div>
                      ) : (
                        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(251,191,36,0.7)' }}>⏳ Deliberando…</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                Espera a que el profesor avance al siguiente turno
              </p>
            </div>
          );
        })()}

        {/* Estado: Esperando turno (otro equipo preparándose) */}
        {presentationState === 'preparing' && !isMyTurn && (() => {
          const preparingTeam = presentationStatus?.teams.find(t => t.id === presentationStatus.current_presentation_team_id);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', minHeight: '70vh', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(96,165,250,0.95)', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 50, padding: '6px 20px' }}>
                ⏳ En espera
              </div>

              <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,0.4) 0%,transparent 65%)', filter: 'blur(16px)' }} />
                <div style={{ fontSize: 68, filter: 'drop-shadow(0 0 24px rgba(59,130,246,0.8))', animation: 'hgFloat 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}>⏳</div>
              </div>

              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(24px,4.4vw,40px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 50px rgba(59,130,246,0.5)', margin: 0, lineHeight: 1.1 }}>
                Esperando<br />tu Turno
              </h1>

              <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.6)', maxWidth: 560, lineHeight: 1.7, margin: 0 }}>
                La Start-up <b style={{ color: '#fff' }}>{preparingTeam ? getTeamName(preparingTeam).toUpperCase() : '…'}</b> está tomando posición en el escenario.
              </p>

              {preparingTeam && (
                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 22, backdropFilter: 'blur(16px)', padding: '20px 24px', maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(96,165,250,0.95)', textAlign: 'center' }}>PRESENTANDO AHORA</div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ width: 72, height: 72, borderRadius: 16, background: '#0a0e2a', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>🚀</div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 1, marginBottom: 4 }}>{getTeamName(preparingTeam).toUpperCase()}</div>
                      <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>🟢 Equipo {preparingTeam.color}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '7px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 50, fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#10b981' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 12px #10b981', animation: 'livePulse 1.2s ease-in-out infinite' }} />
                      En vivo en el escenario
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      </div>

      {team && (
        <UBotPresentacionPitchModal
          isOpen={showUBotModal}
          onClose={() => setShowUBotModal(false)}
          onContinuar={() => setShowUBotModal(false)}
          teamColor={team.color}
        />
      )}
    </div>
  );
}
