import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { GalacticPage } from '@/components/GalacticPage';
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
import {
  sessionsAPI,
  sessionStagesAPI,
  teamPersonalizationsAPI,
  peerEvaluationsAPI
} from '@/services';
import { toast } from 'sonner';
import { useGameStateRedirect } from '@/hooks/useGameStateRedirect';
import { isDevMode } from '@/utils/devMode';

const ANIM_CSS = `
@keyframes badgePulse{0%,100%{opacity:1}50%{opacity:0.55}}
@keyframes rlGlow{0%,100%{box-shadow:0 0 12px rgba(34,211,238,0.3),0 0 28px rgba(34,211,238,0.12)}50%{box-shadow:0 0 22px rgba(34,211,238,0.6),0 0 50px rgba(34,211,238,0.25)}}
`;

const FIELD_COLORS = ['#ef4444', '#3b82f6', '#c026d3', '#10b981', '#f59e0b'];

interface Team {
  id: number;
  name: string;
  color: string;
}

interface SessionStage {
  id: number;
  presentation_order: number[] | null;
  current_presentation_team_id: number | null;
  presentation_state: string;
  presentation_timestamps?: Record<string, string>;
}

interface GameSession {
  id: number;
  room_code: string;
  current_stage_number?: number;
}

export function ProfesorPresentacionPitch() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  useGameStateRedirect();

  const [loading, setLoading] = useState(true);
  const [isAdvancingTurn, setIsAdvancingTurn] = useState(false);
  const [isStartingPitch, setIsStartingPitch] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [sessionStage, setSessionStage] = useState<SessionStage | null>(null);
  const [presentationOrder, setPresentationOrder] = useState<number[]>([]);
  const [currentPresentationTeamId, setCurrentPresentationTeamId] = useState<number | null>(null);
  const [presentationState, setPresentationState] = useState<string | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<string>('01:30');
  const [currentTeamPrototype, setCurrentTeamPrototype] = useState<string | null>(null);
  const [currentTeamPitch, setCurrentTeamPitch] = useState<{
    intro_problem: string;
    solution: string;
    value: string;
    impact: string;
    closing: string;
    product_name?: string;
  } | null>(null);
  const [evaluationProgress, setEvaluationProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [allEvaluations, setAllEvaluations] = useState<any[]>([]);
  const [showEvaluations, setShowEvaluations] = useState(false);
  const [showEtapaIntro, setShowEtapaIntro] = useState(false);
  const [personalizations, setPersonalizations] = useState<Record<number, { team_name?: string }>>({});

  // Roulette state
  const rlAngleRef = useRef(0);
  const rlSpinningRef = useRef(false);
  const rlCanvasRef = useRef<HTMLCanvasElement>(null);
  const [rouletteWinner, setRouletteWinner] = useState<Team | null>(null);
  const [visibleOrderCount, setVisibleOrderCount] = useState(0);
  const [showStartBtn, setShowStartBtn] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localTimerSecondsRef = useRef<number>(90);
  const presentationStateRef = useRef<string>('not_started');
  const syncCounterRef = useRef<number>(0);

  useEffect(() => {
    if (!sessionId) return;
    loadGameControl();

    const setupPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const pollInterval =
        presentationStateRef.current === 'presenting' || presentationStateRef.current === 'evaluating'
          ? 5000
          : 8000;
      intervalRef.current = setInterval(() => { loadGameControl(); }, pollInterval);
    };
    setupPolling();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !intervalRef.current) return;
    const pollInterval =
      presentationState === 'presenting' || presentationState === 'evaluating' ? 5000 : 8000;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => { loadGameControl(); }, pollInterval);
  }, [presentationState, sessionId]);

  // Initialize roulette canvas when entering not_started with teams loaded
  useEffect(() => {
    if (presentationState === 'not_started' && teams.length > 0 && rlCanvasRef.current) {
      const size = Math.min(260, Math.round(window.innerWidth * 0.28));
      rlCanvasRef.current.width = rlCanvasRef.current.height = size;
      rlAngleRef.current = 0;
      drawRouletteWheel(0, teams, personalizations);
      setVisibleOrderCount(0);
      setShowStartBtn(false);
      setRouletteWinner(null);
    }
  }, [presentationState, teams, personalizations]);

  const allPresentationsCompleted =
    presentationOrder.length > 0 &&
    !currentPresentationTeamId &&
    presentationState !== 'not_started';

  useEffect(() => {
    if (presentationState === 'evaluating' && currentPresentationTeamId && sessionStage?.id) {
      loadEvaluationProgress(currentPresentationTeamId);
      const progressInterval = setInterval(() => {
        loadEvaluationProgress(currentPresentationTeamId);
      }, 4000);
      return () => clearInterval(progressInterval);
    } else if (presentationState !== 'evaluating') {
      setEvaluationProgress({ completed: 0, total: 0 });
    }
  }, [presentationState, currentPresentationTeamId, sessionStage?.id]);

  useEffect(() => {
    if (allPresentationsCompleted && gameSession?.id && !showEvaluations) {
      loadAllEvaluations();
    }
  }, [allPresentationsCompleted, gameSession, showEvaluations]);

  const previousTeamIdRef = useRef<number | null>(null);
  const personalizationsLoadedRef = useRef<boolean>(false);

  const loadGameControl = async () => {
    if (!sessionId) return;

    try {
      const sessionData: GameSession = await sessionsAPI.getById(sessionId);
      setGameSession(sessionData);

      if (sessionData.current_stage_number === 4 && !showEtapaIntro) {
        const introKey = `etapa_intro_${sessionId}_4`;
        const hasSeenIntro = localStorage.getItem(introKey);
        if (!hasSeenIntro) setShowEtapaIntro(true);
      }

      const currentStageNumber = sessionData.current_stage_number || 1;
      if (currentStageNumber !== 4) {
        if (currentStageNumber === 3) {
          window.location.replace(`/profesor/etapa3/prototipo/${sessionId}/`);
        } else if (currentStageNumber === 2) {
          window.location.replace(`/profesor/etapa2/seleccionar-tema/${sessionId}/`);
        } else {
          window.location.replace(`/profesor/etapa1/personalizacion/${sessionId}/`);
        }
        return;
      }

      const stagesData = await sessionsAPI.getSessionStages(Number(sessionId));
      const stagesList = Array.isArray(stagesData) ? stagesData : [stagesData];
      const stage4 = stagesList.find((s: any) => s.stage_number === 4) || null;

      if (stage4) {
        setSessionStage(stage4);

        const basicState = stage4.presentation_state || 'not_started';
        setPresentationState(basicState);
        presentationStateRef.current = basicState;

        if (stage4.current_presentation_team_id) {
          setCurrentPresentationTeamId(stage4.current_presentation_team_id);
          previousTeamIdRef.current = stage4.current_presentation_team_id;
        }

        if (stage4.presentation_order && stage4.presentation_order.length > 0) {
          setPresentationOrder(stage4.presentation_order);
        }

        setLoading(false);

        Promise.all([
          sessionStagesAPI.getPresentationStatus(stage4.id).catch(() => null),
          teams.length === 0 ? sessionsAPI.getTeams(sessionId).catch(() => null) : Promise.resolve(null),
        ]).then(([statusData, teamsData]) => {
          if (statusData) {
            const presentationStateFromBackend = statusData.presentation_state || basicState;
            if (presentationStateFromBackend !== basicState) {
              setPresentationState(presentationStateFromBackend);
              presentationStateRef.current = presentationStateFromBackend;
            }

            if (stage4.current_presentation_team_id) {
              if (statusData.current_team_prototype) {
                let imageUrl = statusData.current_team_prototype;
                if (imageUrl.startsWith('/')) {
                  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
                  const baseUrl = apiBaseUrl.replace('/api', '');
                  imageUrl = `${baseUrl}${imageUrl}`;
                }
                setCurrentTeamPrototype(imageUrl);
              }
              if (statusData.current_team_pitch) {
                setCurrentTeamPitch(statusData.current_team_pitch);
              }
            }
          }

          if (teamsData && teams.length === 0) {
            const teamsArray = Array.isArray(teamsData) ? teamsData : [teamsData];
            setTeams(teamsArray);

            if (!personalizationsLoadedRef.current) {
              const persMap: Record<number, { team_name?: string }> = {};
              Promise.all(
                teamsArray.map(async (team: Team) => {
                  try {
                    const persList = await teamPersonalizationsAPI.list({ team: team.id });
                    const persResults = Array.isArray(persList) ? persList : [persList];
                    if (persResults.length > 0 && persResults[0].team_name) {
                      persMap[team.id] = { team_name: persResults[0].team_name };
                    }
                  } catch {
                    // silently fail
                  }
                })
              ).then(() => {
                setPersonalizations(persMap);
                personalizationsLoadedRef.current = true;
              });
            }
          }
        });

        if (
          basicState === 'not_started' &&
          (!stage4.presentation_order || stage4.presentation_order.length === 0)
        ) {
          sessionStagesAPI
            .generatePresentationOrder(stage4.id)
            .then((orderResponse) => {
              setPresentationOrder(orderResponse.presentation_order || []);
            })
            .catch(() => {});
        }

        if (basicState === 'presenting' && stage4.current_presentation_team_id) {
          startPresentationTimer(stage4).catch(() => {});
        }
      } else {
        setLoading(false);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        navigate('/profesor/login');
      } else {
        toast.error('Error al cargar la sesión');
      }
      setLoading(false);
    }
  };

  const loadEvaluationProgress = async (_presentingTeamId: number) => {
    try {
      if (!sessionStage?.id) return;
      const progressData = await sessionStagesAPI.getPresentationEvaluationProgress(sessionStage.id);
      setEvaluationProgress({
        completed: progressData.completed || 0,
        total: progressData.total || 0,
      });
    } catch {
      // silently fail
    }
  };

  const startPresentationTimer = async (stage: SessionStage) => {
    presentationStateRef.current = 'presenting';

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (!stage) return;
    const stageId = stage.id;
    let serverRemaining = 90;
    let isFinished = false;

    try {
      const timerData = await sessionStagesAPI.getPresentationTimer(stageId);
      if (timerData && !timerData.error) {
        isFinished = timerData.is_finished === true;
        serverRemaining = timerData.remaining_seconds ?? 90;
      }
    } catch {
      // silently fail
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
      if (presentationStateRef.current !== 'presenting') {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        return;
      }

      if (localTimerSecondsRef.current > 0) localTimerSecondsRef.current--;

      const mins = Math.floor(localTimerSecondsRef.current / 60);
      const secs = localTimerSecondsRef.current % 60;
      setTimerRemaining(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);

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
              const finished = timerData.is_finished === true;
              const remaining = timerData.remaining_seconds ?? 0;
              if (finished || remaining <= 0) {
                if (timerIntervalRef.current) {
                  clearInterval(timerIntervalRef.current);
                  timerIntervalRef.current = null;
                }
                localTimerSecondsRef.current = 0;
                setTimerRemaining('00:00');
                return;
              }
              if (Math.abs(localTimerSecondsRef.current - remaining) > 2) {
                localTimerSecondsRef.current = remaining;
                const m = Math.floor(localTimerSecondsRef.current / 60);
                const s = localTimerSecondsRef.current % 60;
                setTimerRemaining(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
              }
            }
          } catch {
            // silently fail
          }
        })();
      }
    }, 1000);
  };

  // ── Roulette logic ──────────────────────────────────────────────

  const drawRouletteWheel = (
    angle: number,
    teamList: Team[],
    pers: Record<number, { team_name?: string }> = {}
  ) => {
    const canvas = rlCanvasRef.current;
    if (!canvas || teamList.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const cx = size / 2, cy = size / 2, r = size / 2 - 6;
    const n = teamList.length;
    const arc = (Math.PI * 2) / n;
    ctx.clearRect(0, 0, size, size);

    teamList.forEach((team, i) => {
      const start = angle + i * arc - Math.PI / 2;
      const end = start + arc;
      const mid = start + arc / 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, end); ctx.closePath();
      ctx.fillStyle = getTeamColorHex(team.color); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * (r * 0.64), cy + Math.sin(mid) * (r * 0.64));
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(11, Math.round(size * 0.034))}px 'Exo 2',sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const displayName = pers[team.id]?.team_name || team.name;
      let lbl = displayName; if (lbl.length > 12) lbl = lbl.slice(0, 11) + '…';
      ctx.fillText(lbl, 0, 0);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = '#050818'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 3; ctx.stroke();

    // Outer ring
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(34,211,238,0.4)'; ctx.lineWidth = 4; ctx.stroke();
  };

  const handleSpinRoulette = () => {
    if (rlSpinningRef.current || teams.length === 0) return;
    rlSpinningRef.current = true;
    setRouletteWinner(null);
    setVisibleOrderCount(0);
    setShowStartBtn(false);

    const n = teams.length;
    const arc = (Math.PI * 2) / n;
    const winnerIdx = Math.floor(Math.random() * n);
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetAngle =
      rlAngleRef.current -
      (rlAngleRef.current % (Math.PI * 2)) -
      winnerIdx * arc -
      arc / 2 -
      extraSpins * Math.PI * 2;
    const startAngle = rlAngleRef.current;
    const delta = targetAngle - startAngle;
    const duration = 4200 + Math.random() * 800;
    let startTime: number | null = null;
    const snapshotTeams = [...teams];
    const snapshotPers = { ...personalizations };

    function easeOut(t: number) { return 1 - Math.pow(1 - t, 4); }

    function frame(ts: number) {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      rlAngleRef.current = startAngle + delta * easeOut(p);
      drawRouletteWheel(rlAngleRef.current, snapshotTeams, snapshotPers);
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        rlAngleRef.current = targetAngle;
        drawRouletteWheel(rlAngleRef.current, snapshotTeams, snapshotPers);
        rlSpinningRef.current = false;

        const winner = snapshotTeams[winnerIdx % snapshotTeams.length];
        setRouletteWinner(winner);

        if (!sessionStage) return;

        sessionStagesAPI
          .generatePresentationOrder(sessionStage.id)
          .then((orderResponse) => {
            const serverOrder: number[] = orderResponse.presentation_order || [];
            const newOrder = [winner.id, ...serverOrder.filter((id) => id !== winner.id)];
            return sessionStagesAPI
              .updatePresentationOrder(sessionStage.id, newOrder)
              .then(() => newOrder);
          })
          .then((newOrder) => {
            setPresentationOrder(newOrder);
            newOrder.forEach((_, idx) => {
              const delay = idx === 0 ? 0 : 180 + (idx - 1) * 280;
              setTimeout(() => {
                setVisibleOrderCount((c) => Math.max(c, idx + 1));
              }, delay);
            });
            const totalDelay = 180 + (newOrder.length - 1) * 280 + 400;
            setTimeout(() => setShowStartBtn(true), totalDelay);
          })
          .catch(() => {
            // silently fail — order stays as-is
          });
      }
    }

    requestAnimationFrame(frame);
  };

  // ── Other handlers ──────────────────────────────────────────────

  const handleStartPresentations = async () => {
    if (!sessionStage) return;
    try {
      await sessionStagesAPI.startPresentation(sessionStage.id);
      toast.success('Presentaciones iniciadas');
      loadGameControl();
    } catch (error: any) {
      toast.error('Error al iniciar: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleStartTeamPitch = async () => {
    if (!sessionStage || isStartingPitch) return;
    setIsStartingPitch(true);
    toast.info('Iniciando pitch...');

    try {
      await sessionStagesAPI.startTeamPitch(sessionStage.id);
      setPresentationState('presenting');
      toast.success('✅ Pitch iniciado. El cronómetro comenzó.');
      startPresentationTimer(sessionStage).catch(() => {});
      loadGameControl().finally(() => { setIsStartingPitch(false); });
    } catch (error: any) {
      setIsStartingPitch(false);
      toast.error('Error al iniciar presentación: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleFinishPresentation = async () => {
    if (!sessionStage) return;
    try {
      await sessionStagesAPI.finishTeamPresentation(sessionStage.id);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setTimerRemaining('01:30');
      localTimerSecondsRef.current = 90;
      toast.success('✅ Presentación finalizada. Los equipos pueden evaluar ahora.');
      loadGameControl();
    } catch (error: any) {
      toast.error('Error al finalizar: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleNextPresentation = async () => {
    if (!sessionStage || isAdvancingTurn) return;
    setIsAdvancingTurn(true);
    toast.info('Avanzando al siguiente turno...');

    try {
      const response = await sessionStagesAPI.nextPresentation(sessionStage.id);
      if (!response.current_presentation_team_id) {
        setCurrentPresentationTeamId(null);
        setPresentationState('not_started');
        toast.success('✅ Todas las presentaciones completadas');
      } else {
        setCurrentPresentationTeamId(response.current_presentation_team_id);
        setPresentationState('preparing');
        toast.success('✅ Siguiente turno iniciado');
      }
      if (response.presentation_order) setPresentationOrder(response.presentation_order);
      loadGameControl().finally(() => { setIsAdvancingTurn(false); });
    } catch (error: any) {
      setIsAdvancingTurn(false);
      toast.error('Error al avanzar: ' + (error.response?.data?.error || error.message));
    }
  };

  const loadAllEvaluations = async () => {
    if (!gameSession?.id) return;
    try {
      const evaluations = await peerEvaluationsAPI.forProfessor(gameSession.id);
      setAllEvaluations(evaluations);
      setShowEvaluations(true);
    } catch {
      // silently fail
    }
  };

  const handleCompleteStageAndRedirect = async () => {
    if (!gameSession?.id) { toast.error('No hay sesión activa'); return; }
    setLoading(true);
    try {
      await sessionsAPI.completeStage(gameSession.id, 4);
      toast.success('✅ Redirigiendo a resultados...');
      await new Promise((resolve) => setTimeout(resolve, 500));
      const stages = await sessionsAPI.getSessionStages(gameSession.id);
      const stagesArray = Array.isArray(stages) ? stages : [];
      const stage4 = stagesArray.find((s: any) => s.stage_number === 4);
      const stageId = stage4?.stage || '';
      window.location.href = `/profesor/resultados/${gameSession.id}/?stage_id=${stageId}`;
    } catch (error: any) {
      toast.error('Error al completar la etapa: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
      setLoading(false);
    }
  };

  const handleGoToReflection = async () => {
    if (!gameSession?.id) { toast.error('No hay sesión activa'); return; }
    setLoading(true);
    try {
      await sessionsAPI.startReflection(gameSession.id);
      toast.success('✅ Redirigiendo a reflexión...');
      await new Promise((resolve) => setTimeout(resolve, 500));
      window.location.href = `/profesor/reflexion/${gameSession.id}`;
    } catch (error: any) {
      toast.error('Error al iniciar reflexión: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
      setLoading(false);
    }
  };

  const getTeamColorHex = (color: string) => {
    const colorMap: Record<string, string> = {
      Verde: '#28a745', Azul: '#007bff', Rojo: '#dc3545', Amarillo: '#ffc107',
      Naranja: '#fd7e14', Morado: '#6f42c1', Rosa: '#e83e8c', Cian: '#17a2b8',
      Gris: '#6c757d', Marrón: '#795548',
    };
    return colorMap[color] || '#667eea';
  };

  const getTeamById = (teamId: number) => teams.find((t) => t.id === teamId);

  const currentTeam = currentPresentationTeamId ? getTeamById(currentPresentationTeamId) : null;
  const currentTeamIndex = presentationOrder.findIndex((id) => id === currentPresentationTeamId);
  const hasMorePresentations = currentTeamIndex >= 0 && currentTeamIndex < presentationOrder.length - 1;
  const isLastTeam = currentTeamIndex >= 0 && currentTeamIndex === presentationOrder.length - 1;

  const getTeamDisplayName = (team: Team | null): string => {
    if (!team) return '';
    const pers = personalizations[team.id];
    if (pers?.team_name) return pers.team_name;
    const match = team.name?.match(/^Equipo\s+(.+)$/i);
    return match ? match[1] : team.name || team.color;
  };

  const allEvaluationsCompletedForCurrentTeam =
    evaluationProgress.total > 0 && evaluationProgress.completed >= evaluationProgress.total;

  const shouldShowGoToResults =
    (isLastTeam && allEvaluationsCompletedForCurrentTeam) ||
    (allPresentationsCompleted &&
      evaluationProgress.total > 0 &&
      evaluationProgress.completed >= evaluationProgress.total);

  if (loading || presentationState === null) {
    return (
      <GalacticPage className="items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
      </GalacticPage>
    );
  }

  // ── Top bar shared by all states ──────────────────────────────────

  const topBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
      <div>
        <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 4</div>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 28, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
          Comunicación
        </div>
      </div>
      <div className="galactic-badge">{gameSession?.room_code || '---'}</div>
    </div>
  );

  return (
    <GalacticPage>
      <style>{ANIM_CSS}</style>

      {/* ── State: not_started (Roulette) ── */}
      {presentationState === 'not_started' && !currentPresentationTeamId && (
        <>
          {topBar}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
            {/* Left: Roulette wheel */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div className="galactic-label" style={{ marginBottom: 8 }}>Planeta Comunicación · Presentaciones</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 700, color: '#fff', textShadow: '0 0 20px rgba(34,211,238,0.5)', marginBottom: 20 }}>
                ¿Quién Habla Primero?
              </div>

              {/* Canvas wrapper with amber pointer */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                {/* Pointer */}
                <div style={{
                  position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  width: 0, height: 0, zIndex: 2,
                  borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
                  borderTop: '18px solid #f59e0b',
                  filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.8))',
                }} />
                <canvas
                  ref={rlCanvasRef}
                  style={{
                    borderRadius: '50%',
                    filter: 'drop-shadow(0 0 24px rgba(34,211,238,0.35)) drop-shadow(0 0 60px rgba(34,211,238,0.15))',
                    display: 'block',
                  }}
                />
              </div>

              {/* Winner reveal */}
              {rouletteWinner && (
                <div style={{ marginBottom: 16 }}>
                  <div className="galactic-label" style={{ fontSize: 11, marginBottom: 4 }}>🏆 Primer Presentador</div>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 700, color: '#f59e0b', textShadow: '0 0 16px rgba(245,158,11,0.5)' }}>
                    {getTeamDisplayName(rouletteWinner)}
                  </div>
                </div>
              )}

              {/* Spin button */}
              <button
                onClick={handleSpinRoulette}
                disabled={rlSpinningRef.current}
                style={{
                  fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700,
                  letterSpacing: '3px', textTransform: 'uppercase' as const,
                  padding: '12px 28px', color: 'rgba(34,211,238,0.9)',
                  background: 'rgba(34,211,238,0.08)',
                  border: '2px solid rgba(34,211,238,0.7)',
                  cursor: rlSpinningRef.current ? 'not-allowed' : 'pointer',
                  clipPath: 'polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)',
                  opacity: rlSpinningRef.current ? 0.5 : 1,
                  animation: 'rlGlow 2.2s infinite',
                }}
              >
                ▶ Girar
              </button>
            </div>

            {/* Right: Order list + actions */}
            <div>
              <div className="glass-card" style={{ padding: '20px 22px', marginBottom: 14, minHeight: 180 }}>
                <div className="galactic-label" style={{ fontSize: 11, marginBottom: 14 }}>Orden de Presentación</div>
                {presentationOrder.length === 0 ? (
                  <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                    Gira la ruleta para definir el orden...
                  </div>
                ) : (
                  <div>
                    {presentationOrder.map((teamId, idx) => {
                      const team = getTeamById(teamId);
                      if (!team) return null;
                      const isVisible = idx < visibleOrderCount;
                      const isFirst = idx === 0;
                      return (
                        <div
                          key={teamId}
                          style={{
                            opacity: isVisible ? 1 : 0,
                            transform: isVisible ? 'none' : 'translateX(-12px)',
                            transition: 'opacity 0.3s ease, transform 0.3s ease',
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', borderRadius: 8, marginBottom: 6,
                            background: isFirst && isVisible ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${isFirst && isVisible ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          }}
                        >
                          <div style={{
                            fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700,
                            color: isFirst && isVisible ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                            width: 22, flexShrink: 0,
                          }}>
                            {idx + 1}
                          </div>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: getTeamColorHex(team.color), flexShrink: 0 }} />
                          <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 14, fontWeight: 600, color: '#fff', flex: 1 }}>
                            {getTeamDisplayName(team)}
                          </span>
                          {isFirst && isVisible && (
                            <span style={{ fontSize: 14 }}>🏆</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Start button — appears after animation */}
              {showStartBtn && presentationOrder.length > 0 && (
                <button
                  className="btn-galactic-primary"
                  onClick={handleStartPresentations}
                  style={{ width: '100%', marginBottom: 10 }}
                >
                  Iniciar Presentaciones ▶
                </button>
              )}
              <button
                className="btn-galactic-secondary"
                onClick={() => navigate('/profesor/panel')}
                style={{ width: '100%' }}
              >
                Cancelar Sesión
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── State: preparing ── */}
      {presentationState === 'preparing' && currentTeam && (
        <>
          {topBar}
          <div
            className="glass-card"
            style={{
              padding: '28px 32px', maxWidth: 520, margin: '0 auto',
              borderColor: 'rgba(249,115,22,0.35)',
              background: 'rgba(249,115,22,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div
                className="galactic-badge"
                style={{ animation: 'badgePulse 1.6s infinite', background: 'rgba(249,115,22,0.2)', color: '#fb923c', borderColor: 'rgba(249,115,22,0.5)' }}
              >
                ⚠ Llamado urgente
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: getTeamColorHex(currentTeam.color), flexShrink: 0 }} />
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 700, color: '#fff' }}>
                {getTeamDisplayName(currentTeam)}
              </div>
            </div>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24 }}>
              El equipo debe prepararse para presentar
            </div>
            <button
              className="btn-galactic-primary"
              onClick={handleStartTeamPitch}
              disabled={isStartingPitch}
              style={{ width: '100%', opacity: isStartingPitch ? 0.6 : 1 }}
            >
              {isStartingPitch ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Loader2 size={16} className="animate-spin" /> Iniciando...
                </span>
              ) : (
                `▶ Iniciar Pitch — ${getTeamDisplayName(currentTeam)}`
              )}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button className="btn-galactic-secondary" onClick={() => navigate('/profesor/panel')}>
              Cancelar Sesión
            </button>
          </div>
        </>
      )}

      {/* ── State: presenting ── */}
      {presentationState === 'presenting' && currentTeam && (
        <>
          {topBar}

          {/* Compact centered timer */}
          <div
            className="glass-card"
            style={{
              maxWidth: 280, margin: '0 auto 24px',
              padding: '16px 24px', textAlign: 'center',
              borderColor: 'rgba(249,115,22,0.4)',
              background: 'rgba(249,115,22,0.06)',
            }}
          >
            <div className="galactic-label" style={{ fontSize: 10, color: '#f97316', marginBottom: 8 }}>Tiempo de Pitch</div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 52, fontWeight: 900, color: '#fbbf24', lineHeight: 1, textShadow: '0 0 20px rgba(251,191,36,0.5)' }}>
              {timerRemaining}
            </div>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
              Turno {currentTeamIndex + 1} de {presentationOrder.length}
            </div>
          </div>

          {/* 3fr 1fr grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Left: Prototype */}
            <div className="glass-card" style={{ padding: '20px 24px', textAlign: 'center' }}>
              <div className="galactic-label" style={{ fontSize: 11, marginBottom: 14 }}>🖼 Prototipo</div>
              {currentTeamPrototype ? (
                <img
                  src={currentTeamPrototype}
                  alt="Prototipo"
                  style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(124,58,237,0.3)', marginBottom: 14, display: 'block' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)', fontFamily: "'Exo 2',sans-serif", fontSize: 13, border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10, marginBottom: 14 }}>
                  Sin prototipo
                </div>
              )}
              {/* Product name centered */}
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8, textAlign: 'center' }}>
                {currentTeamPitch?.product_name || '—'}
              </div>
              {/* Team tag */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: getTeamColorHex(currentTeam.color) }} />
                <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  {getTeamDisplayName(currentTeam)}
                </span>
              </div>
            </div>

            {/* Right: Pitch script */}
            <div className="glass-card" style={{ padding: '16px 14px' }}>
              <div className="galactic-label" style={{ fontSize: 10, marginBottom: 12 }}>📋 Guión de Pitch</div>
              {currentTeamPitch ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Problema', color: FIELD_COLORS[0], value: currentTeamPitch.intro_problem },
                    { label: 'Solución', color: FIELD_COLORS[1], value: currentTeamPitch.solution },
                    { label: 'Valor', color: FIELD_COLORS[2], value: currentTeamPitch.value },
                    { label: 'Impacto', color: FIELD_COLORS[3], value: currentTeamPitch.impact },
                    { label: 'Cierre', color: FIELD_COLORS[4], value: currentTeamPitch.closing },
                  ].map(({ label, color, value }) => (
                    <div key={label} style={{ borderLeft: `2px solid ${color}`, paddingLeft: 8 }}>
                      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const, color, marginBottom: 3 }}>
                        {label}
                      </div>
                      <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 11, color: value ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)', fontStyle: value ? 'normal' : 'italic', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const }}>
                        {value || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'Exo 2',sans-serif", fontSize: 12, fontStyle: 'italic' }}>
                  Sin guión
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            <button className="btn-galactic-secondary" onClick={() => navigate('/profesor/panel')}>
              Cancelar Sesión
            </button>
            <button
              onClick={handleFinishPresentation}
              style={{
                fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700,
                letterSpacing: '2px', textTransform: 'uppercase' as const,
                padding: '10px 24px', borderRadius: 8,
                background: 'rgba(239,68,68,0.1)', color: '#f87171',
                border: '1px solid rgba(239,68,68,0.5)', cursor: 'pointer',
              }}
            >
              ✓ Finalizar Presentación
            </button>
          </div>
        </>
      )}

      {/* ── State: evaluating ── */}
      {presentationState === 'evaluating' && currentTeam && (
        <>
          {topBar}
          <div
            className="glass-card"
            style={{
              maxWidth: 520, margin: '0 auto',
              padding: '24px 28px',
              borderColor: 'rgba(245,158,11,0.35)',
              background: 'rgba(245,158,11,0.05)',
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <div
                className="galactic-badge"
                style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.5)' }}
              >
                ⭐ Evaluación en curso
              </div>
            </div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              {getTeamDisplayName(currentTeam)}
            </div>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 20 }}>
              Los otros equipos están evaluando al equipo que acaba de presentar
            </div>

            <div className="galactic-label" style={{ fontSize: 11, marginBottom: 10 }}>Progreso de Evaluaciones</div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', marginBottom: 8, overflow: 'hidden' }}>
              <div style={{
                width: `${evaluationProgress.total > 0 ? (evaluationProgress.completed / evaluationProgress.total) * 100 : 0}%`,
                height: '100%', background: '#34d399', transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>
              {evaluationProgress.completed} / {evaluationProgress.total}
            </div>

            {shouldShowGoToResults ? (
              <button
                className="btn-galactic-primary"
                onClick={handleCompleteStageAndRedirect}
                disabled={loading}
                style={{ width: '100%', opacity: loading ? 0.6 : 1 }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Loader2 size={16} className="animate-spin" /> Cargando...
                  </span>
                ) : 'Ver Resultados →'}
              </button>
            ) : allEvaluationsCompletedForCurrentTeam && hasMorePresentations ? (
              <button
                className="btn-galactic-primary"
                onClick={handleNextPresentation}
                disabled={isAdvancingTurn}
                style={{ width: '100%', opacity: isAdvancingTurn ? 0.6 : 1 }}
              >
                {isAdvancingTurn ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Loader2 size={16} className="animate-spin" /> Avanzando...
                  </span>
                ) : 'Siguiente Turno ▶'}
              </button>
            ) : (
              <div>
                <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
                  Esperando a que todos los equipos completen su evaluación...
                </div>
                {isDevMode() && !allPresentationsCompleted && (
                  <button
                    onClick={() => { isLastTeam ? handleGoToReflection() : handleNextPresentation(); }}
                    disabled={isAdvancingTurn || loading}
                    style={{
                      fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700,
                      letterSpacing: '2px', textTransform: 'uppercase' as const,
                      padding: '10px 20px', borderRadius: 50, background: '#f97316',
                      color: '#fff', border: 'none', cursor: (isAdvancingTurn || loading) ? 'not-allowed' : 'pointer',
                      opacity: (isAdvancingTurn || loading) ? 0.6 : 1, boxShadow: '0 0 12px rgba(249,115,22,0.35)',
                    }}
                  >
                    ⚡ {isLastTeam ? 'Dev - Reflexión' : 'Dev - Siguiente Turno'}
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button className="btn-galactic-secondary" onClick={() => navigate('/profesor/panel')}>
              Cancelar Sesión
            </button>
          </div>
        </>
      )}

      {/* ── State: all_completed ── */}
      {allPresentationsCompleted && (
        <>
          {topBar}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div
              className="glass-card"
              style={{
                maxWidth: 520, width: '100%', padding: '32px 36px', textAlign: 'center',
                borderColor: 'rgba(16,185,129,0.45)',
                background: 'rgba(16,185,129,0.07)',
              }}
            >
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <div
                className="galactic-badge"
                style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', borderColor: 'rgba(16,185,129,0.5)', marginBottom: 14 }}
              >
                Misión Completada · Fase 4
              </div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                ¡Todas las Presentaciones Completadas!
              </div>
              <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 24 }}>
                Todos los equipos han presentado y sido evaluados
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className="btn-galactic-secondary"
                  onClick={() => { if (!showEvaluations) { loadAllEvaluations(); } else { setShowEvaluations(false); } }}
                >
                  {showEvaluations ? 'Ocultar Evaluaciones' : 'Ver/Ocultar Evaluaciones'}
                </button>
                <button
                  className="btn-galactic-primary"
                  onClick={handleGoToReflection}
                  disabled={loading}
                  style={{ opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Loader2 size={16} className="animate-spin" /> Iniciando...
                    </span>
                  ) : '🏆 Ir a Reflexión →'}
                </button>
              </div>
            </div>

            {/* Evaluations list */}
            {showEvaluations && allEvaluations.length > 0 && (
              <div className="glass-card" style={{ maxWidth: 520, width: '100%', padding: '20px 24px' }}>
                <div className="galactic-label" style={{ marginBottom: 14 }}>Todas las Evaluaciones</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
                  {allEvaluations.map((evaluation, index) => (
                    <div
                      key={index}
                      className="glass-card"
                      style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)' }}
                    >
                      <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                        {evaluation.evaluator_team_name} → {evaluation.evaluated_team_name}
                      </div>
                      <div style={{ display: 'flex', gap: 14, marginBottom: 6 }}>
                        {[['Claridad', evaluation.criteria_scores?.clarity], ['Solución', evaluation.criteria_scores?.solution], ['Presentación', evaluation.criteria_scores?.presentation]].map(([label, score]) => (
                          <div key={label as string} style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>{label}</div>
                            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 700, color: '#34d399' }}>{score || 0}/10</div>
                          </div>
                        ))}
                      </div>
                      {evaluation.feedback && (
                        <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.55)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, marginTop: 4 }}>
                          {evaluation.feedback}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <EtapaIntroModal
        etapaNumero={4}
        isOpen={showEtapaIntro}
        onClose={() => {
          setShowEtapaIntro(false);
          if (sessionId) {
            localStorage.setItem(`etapa_intro_${sessionId}_4`, 'true');
          }
        }}
      />
    </GalacticPage>
  );
}
