import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Loader2, CheckCircle2, Coins, Bot, User, GraduationCap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UBotPresentacionModal } from '@/components/UBotPresentacionModal';
import { toast } from 'sonner';
import { tabletConnectionsAPI, sessionsAPI, teamPersonalizationsAPI, teamActivityProgressAPI, challengesAPI } from '@/services';
import { advanceActivityOnTimerExpiration } from '@/utils/timerAutoAdvance';
import { getResultsRedirectUrl } from '@/utils/tabletResultsRedirect';
import { GeneralKnowledgeQuiz } from '@/components/minigames/GeneralKnowledgeQuiz';
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total?: number;
}

export function TabletPresentacion() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<number | null>(null);
  const [currentSessionStageId, setCurrentSessionStageId] = useState<number | null>(null);
  const [showUBotModal, setShowUBotModal] = useState(false);
  const [personalization, setPersonalization] = useState<{ team_name?: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeExpiredRef = useRef<boolean>(false);
  
  // Estados para las partes de presentación
  const [currentPart, setCurrentPart] = useState<'presentation' | 'chaos' | 'general_knowledge'>('chaos');
  const [chaosQuestion, setChaosQuestion] = useState<string | null>(null);
  // currentQuestionId se mantiene para consistencia con el backend aunque no se lee directamente
  // Se usa setCurrentQuestionId para guardar el ID en el progreso
  const [_currentQuestionId, setCurrentQuestionId] = useState<number | null>(null); // ID de la pregunta del caos actual
  const [loadingChaosQuestion, setLoadingChaosQuestion] = useState(false);
  const [chaosQuestionsAnswered, setChaosQuestionsAnswered] = useState<Set<number>>(new Set());
  const [shownQuestionIds, setShownQuestionIds] = useState<number[]>([]); // IDs de preguntas del caos ya mostradas
  const [chaosCompleted, setChaosCompleted] = useState(false);
  const [generalKnowledgeQuestions, setGeneralKnowledgeQuestions] = useState<any[]>([]);
  const [loadingGeneralKnowledge, setLoadingGeneralKnowledge] = useState(false);
  const [generalKnowledgeCompleted, setGeneralKnowledgeCompleted] = useState(false);
  const [generalKnowledgeCurrentIndex, setGeneralKnowledgeCurrentIndex] = useState(0);
  const [generalKnowledgeSelectedAnswers, setGeneralKnowledgeSelectedAnswers] = useState<Map<number, number>>(new Map());
  const [progressData, setProgressData] = useState<{
    part1_completed?: boolean;
    chaos_completed?: boolean;
    general_knowledge_completed?: boolean;
    chaos_questions_answered?: number;
    general_knowledge_answers_count?: number;
    general_knowledge_correct_count?: number;
  } | null>(null);
  const loadingPresentacionRef = useRef(false);
  const progressCheckedRef = useRef(false);

  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) {
      navigate('/tablet/join');
      return;
    }
    setConnectionId(connId);
    loadGameState(connId);

    // Polling cada 5 segundos
    intervalRef.current = setInterval(() => {
      loadGameState(connId);
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [searchParams, navigate]);

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
          }, 3000);
        }
        return;
      }
      
      setTeam(statusData.team);
      setGameSessionId(statusData.game_session.id);

      // Cargar personalización del equipo
      let knowsEachOther: boolean | null = null;
      try {
        const persList = await teamPersonalizationsAPI.list({ team: statusData.team.id });
        const persResults = Array.isArray(persList) ? persList : [persList];
        if (persResults.length > 0) {
          const personalization = persResults[0];
          if (personalization.team_name) {
            setPersonalization({ team_name: personalization.team_name });
          }
          knowsEachOther = personalization.team_members_know_each_other ?? null;
        } else {
          setPersonalization(null);
        }
      } catch (error) {
        console.error('Error loading personalization:', error);
        setPersonalization(null);
      }

      // Verificar estado del juego (usar lobby en lugar de getById para evitar problemas de autenticación)
      const lobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
      const gameData = lobbyData.game_session;
      const sessionId = statusData.game_session.id;

      const resultsUrl = getResultsRedirectUrl(gameData, connId);
      if (resultsUrl) { window.location.href = resultsUrl; return; }

      // Verificar si el juego ha finalizado o está en lobby
      if (gameData.status === 'finished' || gameData.status === 'completed') {
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

      // Verificar actividad actual
      const currentActivityName = gameData.current_activity_name?.toLowerCase() || '';
      const currentStageNumber = gameData.current_stage_number;

      if (currentStageNumber !== 1 || !currentActivityName.includes('presentacion') && !currentActivityName.includes('presentación')) {
        // Redirigir según la actividad actual
        if (currentStageNumber === 1 && currentActivityName.includes('personaliz')) {
          window.location.href = `/tablet/etapa1/personalizacion/?connection_id=${connId}`;
        } else if (currentStageNumber === 1 && !currentActivityName) {
          window.location.href = `/tablet/etapa1/resultados/?connection_id=${connId}`;
        } else {
          window.location.href = `/tablet/lobby?connection_id=${connId}`;
        }
        return;
      }

      // IMPORTANTE: Verificar si el equipo debería estar en Minijuego o Presentacion
      // Si la actividad es "presentacion" pero el equipo SÍ se conoce, redirigir a Minijuego
      // Si el equipo NO se conoce, quedarse en Presentacion (esta página)
      if (currentActivityName.includes('presentacion') || currentActivityName.includes('presentación')) {
        if (knowsEachOther === true) {
          // El equipo se conoce, debe ir a Minijuego
          window.location.href = `/tablet/etapa1/minijuego/?connection_id=${connId}`;
          return;
        }
        // Si knowsEachOther === false o null, el equipo se queda en Presentacion (esta página)
      }

      setCurrentActivityId(gameData.current_activity);

      // Obtener session_stage desde lobby data (ya disponible, sin fetch extra)
      let sessionStageIdToUse = currentSessionStageId;
      if (!sessionStageIdToUse && gameData.current_session_stage) {
        sessionStageIdToUse = gameData.current_session_stage;
        setCurrentSessionStageId(sessionStageIdToUse);
      }

      console.log('[loadGameState] Datos para verificar progreso:', {
        currentActivityId: gameData.current_activity,
        sessionStageIdToUse,
        teamId: statusData.team?.id
      });

      // Cargar actividad de presentación con todos los datos del backend (solo si no se está cargando)
      if (gameData.current_activity && sessionStageIdToUse && statusData.team?.id && !loadingPresentacionRef.current) {
        await loadPresentacionActivity(gameData.current_activity, statusData.team.id, sessionStageIdToUse);
      }

      // Mostrar modal de U-Bot automáticamente si no se ha visto
      if (gameData.current_stage_number === 1 && statusData.team) {
        const ubotKey = `ubot_modal_presentacion_${connId}`;
        const hasSeenUBot = localStorage.getItem(ubotKey);
        if (!hasSeenUBot) {
          setTimeout(() => {
            setShowUBotModal(true);
            localStorage.setItem(ubotKey, 'true');
          }, 500);
        }
      }

      // Verificar progreso existente (similar a Minijuego) - Solo la primera vez o cuando se actualiza la página
      // No verificar en cada polling para evitar sobrescribir el estado actual
      if (gameData.current_activity && sessionStageIdToUse && statusData.team.id && !progressCheckedRef.current) {
        console.log('[loadGameState] ✅ Primera vez, llamando a checkExistingProgress para restaurar estado...');
        await checkExistingProgress(statusData.team.id, gameData.current_activity, sessionStageIdToUse);
        progressCheckedRef.current = true;
      }

      // Iniciar temporizador
      if (gameData.current_activity && !timerIntervalRef.current) {
        startTimer(gameData.current_activity, statusData.game_session.id);
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading game state:', error);
      toast.error('Error de conexión: ' + (error.message || 'Error desconocido'));
      setLoading(false);
    }
  };

  const checkExistingProgress = async (teamId: number, activityId: number, sessionStageId: number) => {
    try {
      console.log('[checkExistingProgress] 🔍 Iniciando verificación de progreso...', { teamId, activityId, sessionStageId });
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/?team=${teamId}&activity=${activityId}&session_stage=${sessionStageId}`
      );

      if (response.ok) {
        const data = await response.json();
        const results = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
        
        console.log('[checkExistingProgress] 📦 Respuesta del servidor:', { resultsCount: results.length });
        
        if (results.length > 0) {
          const progress = results[0];
          const responseData = progress.response_data || {};
          
          console.log('[checkExistingProgress] ✅ Progreso encontrado:', {
            progressId: progress.id,
            status: progress.status,
            part1_completed: responseData.part1_completed,
            chaos_completed: responseData.chaos?.completed,
            general_knowledge_completed: responseData.general_knowledge?.completed
          });
          
          // Guardar datos de progreso para mostrar
          setProgressData({
            part1_completed: responseData.part1_completed || false,
            chaos_completed: responseData.chaos?.completed || false,
            general_knowledge_completed: responseData.general_knowledge?.completed || false,
            chaos_questions_answered: responseData.chaos?.questions_answered || 0,
            general_knowledge_answers_count: responseData.general_knowledge?.answers?.length || 0,
            general_knowledge_correct_count: responseData.general_knowledge?.correct_count || 0,
          });
          
          // Restaurar estado desde el progreso (solo la primera vez)
          if (responseData.part1_completed) {
            console.log('[checkExistingProgress] ✅ Parte 1 completada, restaurando estado...');
        setCompleted(true);
            
            // Si parte 1 completada, verificar parte 2
            if (responseData.chaos?.completed) {
              console.log('[checkExistingProgress] ✅ Caos completado, avanzando a parte 3...');
              setChaosCompleted(true);
              // Si parte 2 completada, avanzar a parte 3
              if (responseData.general_knowledge?.completed) {
                console.log('[checkExistingProgress] ✅ Conocimiento general completado');
                setGeneralKnowledgeCompleted(true);
                setCurrentPart('general_knowledge');
                // Restaurar preguntas desde el progreso si están guardadas
                if (responseData.general_knowledge?.questions_data && responseData.general_knowledge.questions_data.length > 0) {
                  console.log('[checkExistingProgress] 📚 Restaurando preguntas de conocimiento general:', responseData.general_knowledge.questions_data.length);
                  setGeneralKnowledgeQuestions(responseData.general_knowledge.questions_data);
                }
                // IMPORTANTE: Restaurar respuestas DESPUÉS de establecer las preguntas
                if (responseData.general_knowledge?.answers && Array.isArray(responseData.general_knowledge.answers)) {
                  const answersCount = responseData.general_knowledge.answers.length;
                  const totalQuestions = responseData.general_knowledge.questions_data?.length || 0;
                  console.log('[checkExistingProgress] 📝 Conocimiento general: ya se respondieron', answersCount, 'preguntas de', totalQuestions);
                  // El índice actual es la cantidad de respuestas (mostrar la siguiente)
                  // Usar setTimeout para asegurar que las preguntas se establezcan primero
                  setTimeout(() => {
                    setGeneralKnowledgeCurrentIndex(answersCount);
                  }, 100);
                  const answersMap = new Map<number, number>();
                  responseData.general_knowledge.answers.forEach((a: any) => {
                    if (a.question_id !== undefined && a.selected !== undefined) {
                      answersMap.set(a.question_id, a.selected);
                    }
                  });
                  setGeneralKnowledgeSelectedAnswers(answersMap);
                }
              } else {
                // Caos completado pero parte 3 no, avanzar a parte 3
                console.log('[checkExistingProgress] ⏭️ Caos completado pero parte 3 no, avanzando a parte 3...');
                setCurrentPart('general_knowledge');
                // IMPORTANTE: Restaurar preguntas PRIMERO, luego el índice
                if (responseData.general_knowledge?.questions_data && responseData.general_knowledge.questions_data.length > 0) {
                  console.log('[checkExistingProgress] 📚 Restaurando preguntas de conocimiento general:', responseData.general_knowledge.questions_data.length);
                  setGeneralKnowledgeQuestions(responseData.general_knowledge.questions_data);
                  
                  // Restaurar respuestas DESPUÉS de establecer las preguntas
                  if (responseData.general_knowledge?.answers && Array.isArray(responseData.general_knowledge.answers)) {
                    const answersCount = responseData.general_knowledge.answers.length;
                    console.log('[checkExistingProgress] 📝 Conocimiento general: ya se respondieron', answersCount, 'preguntas de', responseData.general_knowledge.questions_data.length);
                    // El índice actual es la cantidad de respuestas (mostrar la siguiente)
                    // Usar setTimeout para asegurar que las preguntas se establezcan primero
                    setTimeout(() => {
                      setGeneralKnowledgeCurrentIndex(answersCount);
                    }, 100);
                    const answersMap = new Map<number, number>();
                    responseData.general_knowledge.answers.forEach((a: any) => {
                      if (a.question_id !== undefined && a.selected !== undefined) {
                        answersMap.set(a.question_id, a.selected);
                      }
                    });
                    setGeneralKnowledgeSelectedAnswers(answersMap);
                  }
                }
              }
            } else {
              // Parte 1 completada pero parte 2 no, quedarse en parte 2
              console.log('[checkExistingProgress] ⏸️ Parte 1 completada pero parte 2 no, quedándose en parte 2 (chaos)');
              setCurrentPart('chaos');
              // Restaurar cuántas veces se presionó el botón del caos
              const answeredCount = responseData.chaos?.questions_answered || 0;
              const shownIds = responseData.chaos?.shown_question_ids || [];
              console.log('[checkExistingProgress] 📊 Caos: se presionó el botón', answeredCount, 'veces, preguntas mostradas:', shownIds.length);
              setChaosQuestionsAnswered(new Set(Array(answeredCount).fill(0).map((_, i) => i)));
              // Restaurar la pregunta actual si existe (la que se mostró la última vez)
              if (responseData.chaos?.current_question_text) {
                console.log('[checkExistingProgress] 📝 Restaurando pregunta del caos:', responseData.chaos.current_question_text);
                setChaosQuestion(responseData.chaos.current_question_text);
                if (responseData.chaos?.current_question_id) {
                  setCurrentQuestionId(responseData.chaos.current_question_id);
                  // Asegurar que el ID de la pregunta actual esté en shownQuestionIds
                  const finalShownIds = shownIds.includes(responseData.chaos.current_question_id) 
                    ? shownIds 
                    : [...shownIds, responseData.chaos.current_question_id];
                  setShownQuestionIds(finalShownIds);
                } else {
                  setShownQuestionIds(shownIds);
                }
              } else {
                setChaosQuestion(null);
                setCurrentQuestionId(null);
                setShownQuestionIds(shownIds);
              }
            }
          } else {
            // Parte 1 no completada, ir directamente a chaos
            console.log('[checkExistingProgress] ⏸️ Parte 1 no completada, avanzando a chaos directamente');
            setCurrentPart('chaos');
          }
        } else {
          // No hay progreso, empezar en chaos directamente
          console.log('[checkExistingProgress] 🆕 No hay progreso, empezando en chaos directamente');
          setCurrentPart('chaos');
          setProgressData({
            part1_completed: false,
            chaos_completed: false,
            general_knowledge_completed: false,
            chaos_questions_answered: 0,
            general_knowledge_answers_count: 0,
            general_knowledge_correct_count: 0,
          });
        }
      } else {
        console.error('[checkExistingProgress] ❌ Error en la respuesta:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[checkExistingProgress] ❌ Error checking presentation progress:', error);
    }
  };

  // Función helper para cargar actividad con todos los datos del backend
  const loadActivityWithData = async (activityId: number, teamId: number, sessionStageId: number | null) => {
    const activityUrl = new URL(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/challenges/activities/${activityId}/`
    );
    if (teamId) activityUrl.searchParams.set('team_id', teamId.toString());
    if (sessionStageId) activityUrl.searchParams.set('session_stage_id', sessionStageId.toString());
    
    const response = await fetch(activityUrl.toString());
    if (!response.ok) {
      throw new Error('Error al cargar la actividad');
    }
    return await response.json();
  };

  const loadPresentacionActivity = async (activityId: number, teamId: number, sessionStageId: number) => {
    // Evitar cargar múltiples veces
    if (loadingPresentacionRef.current) {
      console.log('[loadPresentacionActivity] Ya se está cargando, omitiendo...');
      return;
    }
    
    loadingPresentacionRef.current = true;
    try {
      // Cargar actividad con todos los datos del backend
      const activityData = await loadActivityWithData(activityId, teamId, sessionStageId);
      
      // Información sobre preguntas del caos (no se usa directamente, pero se mantiene para referencia futura)
      // const chaosDataFromBackend = activityData.chaos_data;
      const generalKnowledgeDataFromBackend = activityData.general_knowledge_data; // Preguntas de conocimiento general
      
      // Cargar preguntas de conocimiento general desde el backend si están disponibles
      if (generalKnowledgeDataFromBackend && generalKnowledgeDataFromBackend.questions && generalKnowledgeDataFromBackend.questions.length > 0) {
        console.log(`[loadPresentacionActivity] Preguntas de conocimiento general cargadas desde backend: ${generalKnowledgeDataFromBackend.questions.length}`);
        setGeneralKnowledgeQuestions(generalKnowledgeDataFromBackend.questions);
        
        // Guardar las preguntas en el progreso si existe (sin esperar respuesta)
        const progressResponse = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/?team=${teamId}&activity=${activityId}&session_stage=${sessionStageId}`
        );
        
        if (progressResponse.ok) {
          const progressData = await progressResponse.json();
          const progressResults = Array.isArray(progressData.results) ? progressData.results : (Array.isArray(progressData) ? progressData : []);
          if (progressResults.length > 0) {
            const existingProgress = progressResults[0];
            const updatedResponseData = existingProgress.response_data || {};
            if (!updatedResponseData.general_knowledge?.questions_data || updatedResponseData.general_knowledge.questions_data.length === 0) {
              updatedResponseData.general_knowledge = {
                ...updatedResponseData.general_knowledge,
                questions: generalKnowledgeDataFromBackend.questions.map((q: any) => q.id),
                questions_data: generalKnowledgeDataFromBackend.questions,
              };
              // Actualizar en el backend sin esperar respuesta
              fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/${existingProgress.id}/`,
                {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    response_data: updatedResponseData,
                  }),
                }
              ).catch(error => {
                console.error('Error guardando preguntas de conocimiento general:', error);
              });
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading presentacion activity:', error);
      toast.error('Error al cargar la actividad: ' + (error.message || 'Error desconocido'));
    } finally {
      loadingPresentacionRef.current = false;
    }
  };

  const startTimer = async (_activityId: number, gameSessionId: number) => {
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

      // Verificar si el tiempo ya expiró
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, timerDuration - elapsed);

      if (remaining <= 0) {
        setTimerRemaining('00:00');
        if (!timeExpiredRef.current) {
          timeExpiredRef.current = true;
          void advanceActivityOnTimerExpiration(gameSessionId);
        }
        return;
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

  // Función removida: loadChaosQuestion - no se utiliza, la carga se hace directamente en handleChaosButtonClick

  const handleChaosButtonClick = async () => {
    if (!team?.id || !currentActivityId || !currentSessionStageId) {
      toast.error('Faltan datos necesarios');
      return;
    }

    setLoadingChaosQuestion(true);
    
    try {
      // Obtener nueva pregunta (excluyendo las ya mostradas)
      const questionData = await challengesAPI.getRandomChaosQuestion(shownQuestionIds);
      const newQuestionId = questionData.id;
      
      // Actualizar estado inmediatamente
      const newShownIds = [...shownQuestionIds, newQuestionId];
      setShownQuestionIds(newShownIds);
      setCurrentQuestionId(newQuestionId);
      setChaosQuestion(questionData.question);
      
      // Registrar participación
      const newTotalAnswered = chaosQuestionsAnswered.size + 1;
      const newAnsweredSet = new Set(Array(newTotalAnswered).fill(0).map((_, i) => i));
      setChaosQuestionsAnswered(newAnsweredSet);
      
      // Actualizar progreso visual
      setProgressData(prev => prev ? { ...prev, chaos_questions_answered: newTotalAnswered } : { part1_completed: false, chaos_completed: false, general_knowledge_completed: false, chaos_questions_answered: newTotalAnswered, general_knowledge_answers_count: 0, general_knowledge_correct_count: 0 });
      
      // Guardar progreso del caos cada vez que se presiona el botón
      const existingProgress = await teamActivityProgressAPI.list({
        team: team.id,
        activity: currentActivityId,
        session_stage: currentSessionStageId,
      });
      
      const progressData = Array.isArray(existingProgress) ? existingProgress : [existingProgress];
      const progress = progressData.length > 0 ? progressData[0] : null;
      
      const responseData = progress?.response_data || {};
      const chaosData = responseData.chaos || {};
      const totalAnswered = chaosData.questions_answered || 0;
      const newTotal = totalAnswered + 1;
      
      // NO completar automáticamente al llegar a 5, esperar botón "Listo"
      const isCompleted = false;
      
      // Preparar el nuevo response_data
      const newResponseData = {
        ...responseData,
        chaos: {
          ...chaosData,
          questions_answered: newTotal,
          shown_question_ids: newShownIds,
          completed: isCompleted,
          current_question_id: newQuestionId,
          current_question_text: questionData.question,
        },
      };
      
      // Chaos is the first part for "No nos conocemos" teams — always mark part1 done
      newResponseData.part1_completed = true;
      
      if (progress) {
        // Actualizar progreso existente
        await teamActivityProgressAPI.update(progress.id, {
          response_data: newResponseData,
          status: isCompleted ? 'completed' : 'in_progress',
        });
      } else {
        // Crear nuevo progreso
        await teamActivityProgressAPI.create({
          team: team.id,
          activity: currentActivityId,
          session_stage: currentSessionStageId,
          status: isCompleted ? 'completed' : 'in_progress',
          response_data: {
            type: 'presentation',
            part1_completed: responseData.part1_completed || false,
            chaos: {
              questions_answered: newTotal,
              shown_question_ids: newShownIds,
              completed: isCompleted,
              current_question_id: newQuestionId,
              current_question_text: questionData.question,
            },
          },
        });
      }
    } catch (error: any) {
      console.error('Error al cargar pregunta del caos:', error);
      toast.error('Error al cargar la pregunta: ' + (error.response?.data?.error || error.message || 'Desconocido'));
    } finally {
      setLoadingChaosQuestion(false);
    }
  };

  const loadGeneralKnowledgeQuestions = async (forceReload: boolean = false) => {
    // Si ya hay preguntas cargadas y no se fuerza la recarga, no hacer nada
    if (generalKnowledgeQuestions.length > 0 && !forceReload) {
      return;
    }
    
    // Las preguntas ya deberían estar cargadas desde el backend en loadPresentacionActivity
    // Solo cargar manualmente si no están disponibles
    if (generalKnowledgeQuestions.length === 0) {
      setLoadingGeneralKnowledge(true);
      try {
        const questions = await challengesAPI.getRandomGeneralKnowledgeQuestions(5);
        const questionsArray = Array.isArray(questions) ? questions : [];
        setGeneralKnowledgeQuestions(questionsArray);
        
        // Guardar las preguntas en el progreso para que no cambien
        if (questionsArray.length > 0 && team?.id && currentActivityId && currentSessionStageId) {
          try {
            const existingProgress = await teamActivityProgressAPI.list({
              team: team.id,
              activity: currentActivityId,
              session_stage: currentSessionStageId,
            });
            
            const progressData = Array.isArray(existingProgress) ? existingProgress : [existingProgress];
            const progress = progressData.length > 0 ? progressData[0] : null;
            
            if (progress) {
              const responseData = progress.response_data || {};
              // Solo guardar si no están ya guardadas
              if (!responseData.general_knowledge?.questions) {
                await teamActivityProgressAPI.update(progress.id, {
                  response_data: {
                    ...responseData,
                    general_knowledge: {
                      ...responseData.general_knowledge,
                      questions: questionsArray.map(q => q.id), // Guardar solo los IDs
                      questions_data: questionsArray, // Guardar los datos completos
                    },
                  },
                });
              }
            }
          } catch (error) {
            console.error('Error al guardar preguntas en progreso:', error);
          }
        }
      } catch (error) {
        console.error('Error al cargar preguntas de conocimiento general:', error);
        toast.error('Error al cargar las preguntas');
      } finally {
        setLoadingGeneralKnowledge(false);
      }
    }
  };

  // Función helper para encontrar la pregunta recién respondida
  const findNewlyAnsweredQuestion = (
    previousAnswers: Map<number, number>,
    selectedAnswers: Map<number, number>,
    questions: any[]
  ): { question: any; selected: number } | null => {
    // Buscar la pregunta que tiene respuesta en selectedAnswers pero no en previousAnswers
    for (const question of questions) {
      if (selectedAnswers.has(question.id) && !previousAnswers.has(question.id)) {
        return {
          question,
          selected: selectedAnswers.get(question.id)!
        };
      }
    }
    
    // Si no encontramos por diferencia directa, usar el índice basado en el número de respuestas
    if (selectedAnswers.size > previousAnswers.size) {
      const answeredIndex = selectedAnswers.size - 1;
      if (answeredIndex >= 0 && answeredIndex < questions.length) {
        const question = questions[answeredIndex];
        return {
          question,
          selected: selectedAnswers.get(question.id)!
        };
      }
    }
    
    // Buscar cualquier pregunta que tenga respuesta nueva o modificada
    for (const question of questions) {
      if (selectedAnswers.has(question.id)) {
        const currentSelected = selectedAnswers.get(question.id);
        const previousSelected = previousAnswers.get(question.id);
        
        // Si la respuesta cambió o no existía antes
        if (previousSelected === undefined || previousSelected !== currentSelected) {
          return {
            question,
            selected: currentSelected!
          };
        }
      }
    }
    
    return null;
  };

  // Función para manejar el progreso de conocimiento general
  const handleGeneralKnowledgeProgress = async (
    currentIndex: number,
    selectedAnswers: Map<number, number>
  ) => {
    const previousAnswers = new Map(generalKnowledgeSelectedAnswers);
    setGeneralKnowledgeCurrentIndex(currentIndex);
    setGeneralKnowledgeSelectedAnswers(selectedAnswers);
    
    // Enviar respuesta individual al backend inmediatamente para otorgar token si es correcta
    if (team?.id && currentActivityId && currentSessionStageId && generalKnowledgeQuestions.length > 0) {
      try {
        const result = findNewlyAnsweredQuestion(previousAnswers, selectedAnswers, generalKnowledgeQuestions);
        
        if (result && result.selected !== undefined && result.selected !== null) {
          // Enviar solo la respuesta que se acaba de dar
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/submit_general_knowledge/`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                team: team.id,
                activity: currentActivityId,
                session_stage: currentSessionStageId,
                answers: [{
                  question_id: result.question.id,
                  selected: result.selected
                }],
              }),
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            // Actualizar progreso visual
            setProgressData(prev => prev ? { 
              ...prev, 
              general_knowledge_answers_count: selectedAnswers.size,
              general_knowledge_correct_count: data.correct_count || (prev.general_knowledge_correct_count || 0)
            } : { 
              part1_completed: false, 
              chaos_completed: false, 
              general_knowledge_completed: false, 
              chaos_questions_answered: 0, 
              general_knowledge_answers_count: selectedAnswers.size, 
              general_knowledge_correct_count: data.correct_count || 0 
            });
            
            if (data.tokens_earned > 0) {
              toast.success(`✅ ¡Correcto! +${data.tokens_earned} token`, {
                duration: 3000,
              });
              // Actualizar tokens del equipo sin recargar toda la página
              if (connectionId) {
                const statusData = await tabletConnectionsAPI.getStatus(connectionId);
                if (statusData?.team?.tokens_total !== undefined) {
                  setTeam(prev => prev ? { ...prev, tokens_total: statusData.team.tokens_total } : prev);
                }
              }
            } else {
              // Mostrar alerta si la respuesta fue incorrecta
              toast.error('❌ Respuesta incorrecta', {
                duration: 2000,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error enviando respuesta individual:', error);
        // No mostrar error al usuario, solo loguearlo
      }
    }
  };

  const handleGeneralKnowledgeComplete = async (results: Array<{ question_id: number; selected: number }>) => {
    if (!currentActivityId || !currentSessionStageId || !team?.id) {
      toast.error('Error: faltan datos necesarios');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/submit_general_knowledge/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            team: team.id,
            activity: currentActivityId,
            session_stage: currentSessionStageId,
            answers: results, // Solo question_id y selected, sin 'correct'
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al enviar respuestas');
      }

      const data = await response.json();
      setGeneralKnowledgeCompleted(true);
      setProgressData(prev => prev ? { ...prev, general_knowledge_completed: true, general_knowledge_answers_count: 5, general_knowledge_correct_count: data.correct_count || 0 } : { part1_completed: false, chaos_completed: false, general_knowledge_completed: true, chaos_questions_answered: 0, general_knowledge_answers_count: 5, general_knowledge_correct_count: data.correct_count || 0 });
      
      // El backend retorna tokens_earned, correct_count, etc.
      // Usar tokens_earned del response_data que es el total acumulado, no solo los nuevos
      const totalTokensEarned = data.response_data?.tokens_earned || data.tokens_earned || 0;
      toast.success(`¡Completado! Ganaste ${totalTokensEarned} tokens (${data.correct_count || 0}/5 correctas)`);
      
      // NO hacer consultas adicionales ni actualizaciones manuales
      // El backend ya actualizó todo (progreso, tokens, estado)
      
      // Actualizar tokens del equipo sin recargar toda la página
      try {
        if (connectionId) {
          const statusData = await tabletConnectionsAPI.getStatus(connectionId);
          if (statusData?.team?.tokens_total !== undefined) {
            setTeam(prev => prev ? { ...prev, tokens_total: statusData.team.tokens_total } : prev);
          }
        }
      } catch (error) {
        console.error('Error al actualizar tokens:', error);
      }
    } catch (error: any) {
      console.error('Error al enviar respuestas:', error);
      toast.error('Error al enviar las respuestas', {
        description: error.message || 'Por favor intenta nuevamente',
      });
    } finally {
      setSubmitting(false);
    }
  };


  const handlePresentationDone = async () => {
    if (!team || !currentActivityId || !currentSessionStageId || !connectionId) {
      toast.error('Faltan datos necesarios. Por favor, recarga la página.');
      return;
    }

    setSubmitting(true);

    try {
      // Guardar progreso de parte 1 (el backend otorga los tokens automáticamente)
      // Usar create que maneja automáticamente si ya existe un progreso
      const result = await teamActivityProgressAPI.create({
        team: team.id,
        activity: currentActivityId,
        session_stage: currentSessionStageId,
        status: 'in_progress',
        response_data: {
          type: 'presentation',
          part1_completed: true,
        },
      });

      console.log('[handlePresentationDone] Progreso guardado:', result);
      console.log('[handlePresentationDone] response_data:', result?.response_data);

      toast.success('✓ Parte 1 completada. Ganaste 5 tokens');
      setCompleted(true);
      setProgressData(prev => prev ? { ...prev, part1_completed: true } : { part1_completed: true, chaos_completed: false, general_knowledge_completed: false, chaos_questions_answered: 0, general_knowledge_answers_count: 0, general_knowledge_correct_count: 0 });
      
      // Cambiar a Parte 2 (Caos)
      setCurrentPart('chaos');
      // NO cargar pregunta automáticamente, solo cuando se presione el botón
      setChaosQuestion(null);
      
      // Actualizar tokens del equipo sin recargar toda la página
      try {
        const statusData = await tabletConnectionsAPI.getStatus(connectionId);
        if (statusData?.team?.tokens_total !== undefined) {
          setTeam(prev => prev ? { ...prev, tokens_total: statusData.team.tokens_total } : prev);
        }
      } catch (error) {
        console.error('Error al actualizar tokens:', error);
      }
    } catch (error: any) {
      toast.error('Error: ' + (error.message || 'Error desconocido'));
    } finally {
      setSubmitting(false);
    }
  };

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

  if (loading) {
    return (
      <GalacticPage className="items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
      </GalacticPage>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Error al cargar información del equipo</p>
          <Button onClick={() => navigate('/tablet/join')}>Volver a Conectar</Button>
        </div>
      </div>
    );
  }

  return (
    <GalacticPage padding="p-4 md:p-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: team?.color ? getTeamColorHex(team.color) : '#c026d3' }} />
          <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 16, fontWeight: 700, color: '#fff' }}>
            {personalization?.team_name || team?.name || 'Mi Equipo'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="glass-card" style={{ padding: '6px 14px' }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: '#fbbf24' }}>
              ⭐ {team?.tokens_total ?? 0}
            </span>
          </div>
          {timerRemaining !== '--:--' && (
            <div className="glass-card" style={{ padding: '6px 14px' }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: '#fff' }}>
                ⏱ {timerRemaining}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Activity subtitle */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div className="galactic-label" style={{ marginBottom: 4 }}>
          {currentPart === 'presentation' ? 'Registro de Socios' : currentPart === 'chaos' ? 'Preguntas del Caos' : 'Conocimiento General'}
        </div>
      </div>

      {/* Part content */}
      <GlassCard style={{ flex: 1, padding: 20 }}>
        {/* Contenido según la parte actual */}
        {currentPart === 'presentation' ? (
            <>
              {/* Parte 1: Guía visual para presentación (sin capturar respuestas) */}
              <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6 sm:p-8 mb-4 sm:mb-5 border border-purple-200/50 shadow-lg relative overflow-hidden">
                {/* Efectos de fondo decorativos */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-200/20 to-pink-200/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-200/20 to-indigo-200/20 rounded-full blur-2xl -ml-24 -mb-24"></div>
                
                <div className="relative z-10">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg mb-3">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#093c92] via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Ficha del Fundador
                    </h3>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-white/90 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-purple-200/50 shadow-md hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 mb-1.5 text-sm sm:text-base">Nombre / Apodo</p>
                          <p className="text-xs sm:text-sm text-gray-500 italic">Ejemplo: "Hola, soy María"</p>
                        </div>
                      </div>
                    </motion.div>
                    
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-white/90 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-purple-200/50 shadow-md hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 mb-1.5 text-sm sm:text-base">Carrera (Tu especialidad)</p>
                          <p className="text-xs sm:text-sm text-gray-500 italic">Ejemplo: "Estudio Ingeniería Comercial"</p>
                        </div>
                      </div>
                    </motion.div>
                    
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-white/90 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-purple-200/50 shadow-md hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-pink-500 to-orange-500 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 mb-1.5 text-sm sm:text-base">Un Dato Random</p>
                          <p className="text-xs sm:text-sm text-gray-500 italic">Ejemplo: "Me encanta tocar la guitarra"</p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                  
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-center text-gray-600 text-xs sm:text-sm mt-6 italic bg-white/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-purple-100"
                  >
                    Cuando todos los socios se hayan presentado, confirmen abajo.
                  </motion.p>
                </div>
              </div>

              {/* Botón Listo (guarda progreso y otorga 5 tokens) */}
          <Button
            onClick={handlePresentationDone}
            disabled={completed || submitting}
            className="w-full h-12 sm:h-14 bg-[#093c92] hover:bg-[#072e73] text-white text-sm sm:text-base font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Enviando...
              </>
            ) : completed ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                ✓ Completado
              </>
            ) : (
              '[ START-UP LISTA ]'
            )}
          </Button>
            </>
          ) : currentPart === 'chaos' ? (
            <>
              <div className="bg-purple-50 border-l-4 border-purple-400 rounded-lg p-4 sm:p-5 mb-4 sm:mb-5">
                <p className="text-purple-800 font-semibold text-lg sm:text-xl mb-3">
                  🎲 ¡Botón del Caos!
                </p>
                <p className="text-gray-700 text-sm sm:text-base mb-3">
                  <strong>Instrucciones:</strong> Elijan un integrante del equipo que presione el botón. Cada vez que se presione, aparecerá una pregunta aleatoria para que todos la discutan.
                </p>
                <p className="text-gray-600 text-xs sm:text-sm italic mt-3">
                  Pregunta {shownQuestionIds.length || chaosQuestionsAnswered.size} de 5
                </p>
              </div>

              {chaosQuestion && (
                <div className="bg-white border-2 border-purple-300 rounded-lg p-6 mb-4">
                  <p className="text-sm text-purple-600 font-semibold mb-2 text-center">
                    Pregunta {shownQuestionIds.length || chaosQuestionsAnswered.size} de 5
                  </p>
                  <p className="text-lg font-bold text-gray-800 text-center">
                    {chaosQuestion}
                  </p>
                  <p className="text-sm text-gray-600 text-center mt-4 italic">
                    Discutan esta pregunta en equipo
                  </p>
                </div>
              )}

              {chaosQuestionsAnswered.size >= 5 && !chaosCompleted ? (
                <Button
                  onClick={async () => {
                    // Completar el caos y avanzar a conocimiento general
                    if (!team?.id || !currentActivityId || !currentSessionStageId) {
                      toast.error('Faltan datos necesarios');
                      return;
                    }
                    
                    try {
                      const existingProgress = await teamActivityProgressAPI.list({
                        team: team.id,
                        activity: currentActivityId,
                        session_stage: currentSessionStageId,
                      });
                      
                      const progressData = Array.isArray(existingProgress) ? existingProgress : [existingProgress];
                      const progress = progressData.length > 0 ? progressData[0] : null;
                      
                      if (progress) {
                        const responseData = progress.response_data || {};
                        const chaosData = responseData.chaos || {};
                        
                        await teamActivityProgressAPI.update(progress.id, {
                          response_data: {
                            ...responseData,
                            part1_completed: true,
                            chaos: {
                              ...chaosData,
                              completed: true,
                            },
                          },
                          status: 'completed',
                        });
                        
                        setChaosCompleted(true);
                        setProgressData(prev => prev ? { ...prev, chaos_completed: true, chaos_questions_answered: 5 } : { part1_completed: false, chaos_completed: true, general_knowledge_completed: false, chaos_questions_answered: 5, general_knowledge_answers_count: 0, general_knowledge_correct_count: 0 });
                        toast.success('✓ Parte 2 completada. Ganaste 5 tokens');
                        
                        // Cargar preguntas de conocimiento general
                        if (generalKnowledgeQuestions.length === 0) {
                          await loadGeneralKnowledgeQuestions();
                        }
                        setCurrentPart('general_knowledge');
                        
                        // Actualizar tokens del equipo
                        try {
                          if (connectionId) {
                            const statusData = await tabletConnectionsAPI.getStatus(connectionId);
                            if (statusData?.team?.tokens_total !== undefined) {
                              setTeam(prev => prev ? { ...prev, tokens_total: statusData.team.tokens_total } : prev);
                            }
                          }
                        } catch (error) {
                          console.error('Error al actualizar tokens:', error);
                        }
                      }
                    } catch (error) {
                      console.error('Error al completar caos:', error);
                      toast.error('Error al completar');
                    }
                  }}
                  className="w-full h-12 sm:h-14 bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  ✓ Listo - Ir a Preguntas de Conocimiento General
                </Button>
              ) : (
                <Button
                  onClick={handleChaosButtonClick}
                  disabled={loadingChaosQuestion || chaosCompleted}
                  className="w-full h-12 sm:h-14 bg-purple-600 hover:bg-purple-700 text-white text-sm sm:text-base font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  {loadingChaosQuestion ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Cargando pregunta...
                    </>
                  ) : chaosCompleted ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      ✓ Completado
                    </>
                  ) : (
                    `🎲 Presiona para la pregunta ${shownQuestionIds.length + 1}`
                  )}
                </Button>
              )}
            </>
          ) : currentPart === 'general_knowledge' ? (
            <>
              {generalKnowledgeCompleted ? (
                <div className="bg-green-50 border-2 border-green-400 rounded-lg p-6 sm:p-8 text-center">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl sm:text-2xl font-bold text-green-800 mb-2">
                    ¡Presentación Completada!
                  </h3>
                  <p className="text-green-700 mb-4">
                    Has completado todas las partes de la presentación:
                  </p>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center justify-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Parte 1: Presentación</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Parte 2: Preguntas del Caos</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Parte 3: Conocimiento General</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Espera a que el profesor avance a la siguiente actividad.
                  </p>
                </div>
              ) : loadingGeneralKnowledge ? (
                <div className="text-center text-gray-500 py-12">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                  <p>Cargando preguntas...</p>
                </div>
              ) : generalKnowledgeQuestions.length > 0 ? (
                <GeneralKnowledgeQuiz
                  questions={generalKnowledgeQuestions}
                  onComplete={handleGeneralKnowledgeComplete}
                  initialIndex={generalKnowledgeCurrentIndex}
                  initialSelectedAnswers={generalKnowledgeSelectedAnswers}
                  onProgressChange={handleGeneralKnowledgeProgress}
                />
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <p>No hay preguntas disponibles</p>
                </div>
              )}
            </>
          ) : null}
      </GlassCard>

      {/* Modal de U-Bot para Presentación */}
      {team && (
        <UBotPresentacionModal
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


