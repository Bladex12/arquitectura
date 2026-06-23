import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Loader2, CheckCircle2, Coins, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UBotMinijuegoModal } from '@/components/UBotMinijuegoModal';
import { toast } from 'sonner';
import { tabletConnectionsAPI, sessionsAPI, teamPersonalizationsAPI, teamActivityProgressAPI } from '@/services';
import { advanceActivityOnTimerExpiration } from '@/utils/timerAutoAdvance';
import { getResultsRedirectUrl } from '@/utils/tabletResultsRedirect';
import { AnagramGame } from '@/components/minigames/AnagramGame';
import { WordSearchGame } from '@/components/minigames/WordSearchGame';
import { GeneralKnowledgeQuiz } from '@/components/minigames/GeneralKnowledgeQuiz';
import { parseMinigameConfig } from '@/components/minigames/MinigameSelector';
import { MinigameType, AnyMinigameData, WordSearchData } from '@/components/minigames/types';
import { challengesAPI } from '@/services';
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total?: number;
}

export function TabletMinijuego() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [minigameData, setMinigameData] = useState<AnyMinigameData | null>(null);
  const [currentGameType, setCurrentGameType] = useState<MinigameType | null>(null);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<number | null>(null);
  const [currentSessionStageId, setCurrentSessionStageId] = useState<number | null>(null);
  // completedItems removido - no se usa realmente, solo se establecía pero nunca se leía
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [currentPart, setCurrentPart] = useState<'word_search' | 'anagram' | 'general_knowledge'>('word_search'); // Parte actual del minijuego
  const [generalKnowledgeQuestions, setGeneralKnowledgeQuestions] = useState<any[]>([]);
  const [loadingGeneralKnowledge, setLoadingGeneralKnowledge] = useState(false);
  const [generalKnowledgeCompleted, setGeneralKnowledgeCompleted] = useState(false);
  const [generalKnowledgeCurrentIndex, setGeneralKnowledgeCurrentIndex] = useState(0);
  const [generalKnowledgeSelectedAnswers, setGeneralKnowledgeSelectedAnswers] = useState<Map<number, number>>(new Map());
  const previousGeneralKnowledgeAnswersRef = useRef<Map<number, number>>(new Map());
  const [personalization, setPersonalization] = useState<{ team_name?: string } | null>(null);
  const [showUBotModal, setShowUBotModal] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeExpiredRef = useRef<boolean>(false);

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

      if (currentStageNumber !== 1 || (!currentActivityName.includes('presentacion') && !currentActivityName.includes('presentación'))) {
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
      // Si la actividad es "presentacion" pero el equipo NO se conoce, redirigir a Presentacion
      // Si el equipo SÍ se conoce, quedarse en Minijuego (esta página)
      if (currentActivityName.includes('presentacion') || currentActivityName.includes('presentación')) {
        if (knowsEachOther === false || knowsEachOther === null) {
          // El equipo no se conoce o no ha respondido, debe ir a Presentacion
          window.location.href = `/tablet/etapa1/presentacion/?connection_id=${connId}`;
          return;
        }
        // Si knowsEachOther === true, el equipo se queda en Minijuego (esta página)
      }

      setCurrentActivityId(gameData.current_activity);

      // Obtener session_stage desde lobby data (ya disponible, sin fetch extra)
      if (!currentSessionStageId && gameData.current_session_stage) {
        setCurrentSessionStageId(gameData.current_session_stage);
      }

      // Mostrar modal de U-Bot automáticamente si no se ha visto
      if (gameData.current_stage_number === 1 && statusData.team) {
        const ubotKey = `ubot_modal_minijuego_${connId}`;
        const hasSeenUBot = localStorage.getItem(ubotKey);
        if (!hasSeenUBot) {
          setTimeout(() => {
            setShowUBotModal(true);
            localStorage.setItem(ubotKey, 'true');
          }, 500);
        }
      }

      // Verificar progreso existente PRIMERO para restaurar el estado correcto (tiene más prioridad)
      // No verificar en cada polling para evitar sobrescribir el estado actual
      if (gameData.current_activity && gameData.current_session_stage && statusData.team.id && !progressCheckedRef.current) {
        console.log('[loadGameState] ✅ Primera vez, llamando a checkExistingProgress para restaurar estado...');
        await checkExistingProgress(statusData.team.id, gameData.current_activity, gameData.current_session_stage);
        progressCheckedRef.current = true;
        // Pequeño delay para asegurar que el estado se haya actualizado
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Cargar actividad del minijuego DESPUÉS de restaurar progreso
      // Solo cargar si no hay minigameData Y no estamos en anagram o general_knowledge (esos se cargan con switchToPart o checkExistingProgress)
      if (gameData.current_activity && !minigameData && statusData.team?.id && !loadingMinijuegoRef.current && currentPart === 'word_search' && !minigameDataLoadedRef.current) {
        await loadMinijuegoActivity(gameData.current_activity, statusData.team.id, gameData.current_session_stage);
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

  // Función helper para cargar actividad con word_search_data del backend
  const loadActivityWithWordSearch = async (activityId: number, teamId: number, sessionStageId: number | null) => {
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

  const loadingMinijuegoRef = useRef(false);
  const progressCheckedRef = useRef(false);
  const minigameDataLoadedRef = useRef(false); // Ref para rastrear si ya se cargó inicialmente

  const loadMinijuegoActivity = async (activityId: number, teamId: number, sessionStageIdParam?: number | null) => {
    // Protecciones para evitar cargas múltiples
    if (minigameDataLoadedRef.current || loadingMinijuegoRef.current || minigameData || currentPart === 'general_knowledge') {
      return;
    }
    
    // Si estamos en anagram sin datos, checkExistingProgress ya debería haberlo cargado
    if (currentPart === 'anagram' && !minigameData) {
      // Esperar un momento por si checkExistingProgress aún está cargando
      await new Promise(resolve => setTimeout(resolve, 100));
      if (minigameData) {
        minigameDataLoadedRef.current = true;
        return;
      }
    }
    
    loadingMinijuegoRef.current = true;
    setLoading(true);
    try {
      const sessionStageId: number | null = sessionStageIdParam ?? currentSessionStageId ?? null;
      
      // Obtener la actividad y el progreso en paralelo para optimizar la carga
      const [activityData, progressData] = await Promise.all([
        loadActivityWithWordSearch(activityId, teamId, sessionStageId),
        sessionStageId ? fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/?team=${teamId}&activity=${activityId}&session_stage=${sessionStageId}`
        ).then(res => res.ok ? res.json() : null).catch(() => null) : Promise.resolve(null)
      ]);
      
      const config = activityData.config_data || {};
      const wordSearchDataFromBackend = activityData.word_search_data; // Datos generados por el backend
      const anagramDataFromBackend = activityData.anagram_data; // Datos del anagrama del backend
      const generalKnowledgeDataFromBackend = activityData.general_knowledge_data; // Datos de conocimiento general del backend
      
      let existingProgress: any = null;
      if (progressData) {
          const progressResults = Array.isArray(progressData.results) ? progressData.results : (Array.isArray(progressData) ? progressData : []);
          if (progressResults.length > 0) {
            existingProgress = progressResults[0];
        }
      }
      
      // Cargar preguntas de conocimiento general desde el backend si están disponibles
      // Solo cargar si no están ya cargadas para evitar recargas innecesarias
      if (generalKnowledgeDataFromBackend && generalKnowledgeDataFromBackend.questions && generalKnowledgeDataFromBackend.questions.length > 0) {
        // Solo actualizar si no hay preguntas cargadas o si son diferentes
        if (generalKnowledgeQuestions.length === 0 || 
            JSON.stringify(generalKnowledgeQuestions.map(q => q.id)) !== 
            JSON.stringify(generalKnowledgeDataFromBackend.questions.map((q: any) => q.id))) {
          console.log(`[loadMinijuegoActivity] Preguntas de conocimiento general cargadas desde backend: ${generalKnowledgeDataFromBackend.questions.length}`);
          setGeneralKnowledgeQuestions(generalKnowledgeDataFromBackend.questions);
          
          // Guardar las preguntas en el progreso para mantener consistencia (después de obtener existingProgress)
          if (existingProgress && generalKnowledgeDataFromBackend.questions.length === 5) {
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
      
      const responseData = existingProgress?.response_data || {};
      const anagramCompleted = responseData.anagram_completed || false;
      const generalKnowledgeData = responseData.general_knowledge || {};
      const hasGeneralKnowledgeProgress = generalKnowledgeData.answers && generalKnowledgeData.answers.length > 0;
      
      // Si hay progreso en general_knowledge o anagrama completado, avanzar directamente ahí
      // Solo si checkExistingProgress no lo hizo ya (verificar si ya está en general_knowledge)
      if ((hasGeneralKnowledgeProgress || generalKnowledgeData.completed || anagramCompleted) && currentPart !== 'general_knowledge') {
        console.log('[loadMinijuegoActivity] Anagrama completado o general_knowledge en progreso, avanzando directamente a general_knowledge');
        setCurrentPart('general_knowledge');
        // Restaurar preguntas si están guardadas
        if (generalKnowledgeData.questions_data && generalKnowledgeData.questions_data.length > 0) {
          setGeneralKnowledgeQuestions(generalKnowledgeData.questions_data);
        }
        // Restaurar respuestas e índice como fallback
        if (generalKnowledgeData.answers && Array.isArray(generalKnowledgeData.answers)) {
          const answeredCount = generalKnowledgeData.answers.length;
          const answersMap = new Map<number, number>();
          generalKnowledgeData.answers.forEach((a: any) => {
            if (a.question_id !== undefined && a.selected !== undefined) {
              answersMap.set(a.question_id, a.selected);
            }
          });
          setGeneralKnowledgeSelectedAnswers(answersMap);
          previousGeneralKnowledgeAnswersRef.current = new Map(answersMap);
          setGeneralKnowledgeCurrentIndex(answeredCount);
        }
        setLoading(false);
        loadingMinijuegoRef.current = false;
        return;
      }
      
      const foundWordsFromProgress = responseData.found_words || [];
      const answersFromProgress = responseData.answers || [];
      
      const hasAnagramProgress = answersFromProgress.length > 0;
      const totalWordsExpectedForAnagram = responseData.total_words || 5;
      
      // Si hay progreso en anagrama pero no está completado, restaurar anagrama
      if (hasAnagramProgress && answersFromProgress.length < totalWordsExpectedForAnagram && !anagramCompleted) {
        console.log('[loadMinijuegoActivity] 🔍 Hay progreso en anagrama, restaurando desde progreso...', {
          answersLength: answersFromProgress.length,
          totalWordsExpected: totalWordsExpectedForAnagram,
          anagramCompleted,
          hasSavedWords: !!responseData.anagram_words,
          savedWordsLength: responseData.anagram_words?.length || 0
        });
        setCurrentPart('anagram');
        const anagramType = MinigameType.ANAGRAMA;
        setCurrentGameType(anagramType);
        console.log('[loadMinijuegoActivity] ✅ currentPart establecido a "anagram", currentGameType establecido a ANAGRAMA');
        
        const savedAnagramWords = responseData.anagram_words;
        // Solo usar palabras guardadas si hay exactamente 5 palabras y tienen el formato correcto
        if (savedAnagramWords && Array.isArray(savedAnagramWords) && savedAnagramWords.length === 5) {
          // Verificar si todas las palabras tienen el formato correcto
          const allHaveCorrectFormat = savedAnagramWords.every((w: any) => 
            typeof w === 'object' && w.word && (w.anagram || w.scrambled_word)
          );
          
          if (allHaveCorrectFormat) {
            const formattedWords = savedAnagramWords.map((w: any) => {
              return { word: w.word, anagram: w.anagram || w.scrambled_word };
            });
            setMinigameData({
              type: anagramType,
              words: formattedWords,
            });
            minigameDataLoadedRef.current = true;
            if (responseData.anagram_current_index !== undefined && responseData.anagram_current_index !== null) {
              setCurrentGameIndex(responseData.anagram_current_index);
            } else if (answersFromProgress.length > 0) {
              setCurrentGameIndex(answersFromProgress.length);
            }
            console.log(`[loadMinijuegoActivity] ✅ Anagrama restaurado desde progreso: ${formattedWords.length} palabras`);
            setLoading(false);
            loadingMinijuegoRef.current = false;
            return;
          } else {
            // Si las palabras vienen como strings, no podemos restaurar el estado completo
            // Continuar con la carga normal desde la API
            console.log('[loadMinijuegoActivity] ⚠️ anagram_words viene como strings, cargando desde API...');
          }
        } else {
          // Cargar desde backend si no hay palabras guardadas o hay menos de 5
          const anagramDataFromBackend = activityData.anagram_data;
          if (anagramDataFromBackend && anagramDataFromBackend.words && anagramDataFromBackend.words.length > 0) {
            // Asegurar que tengamos exactamente 5 palabras
            let wordsToUse = anagramDataFromBackend.words;
            if (wordsToUse.length < 5) {
              console.error(`ERROR: Backend solo devolvió ${wordsToUse.length} palabras, se esperaban 5`);
              toast.error(`Error: Solo se recibieron ${wordsToUse.length} palabras del anagrama. Se esperaban 5.`);
              setLoading(false);
              loadingMinijuegoRef.current = false;
              return;
            } else if (wordsToUse.length > 5) {
              wordsToUse = wordsToUse.slice(0, 5);
            }
            
            // Validar formato de palabras
            const validWords = wordsToUse.filter(w => w && (typeof w === 'string' || (typeof w === 'object' && w.word)));
            if (validWords.length !== 5) {
              console.error(`ERROR: Solo ${validWords.length} palabras válidas de ${wordsToUse.length}`);
              toast.error('Error: Las palabras del anagrama no tienen el formato correcto.');
              setLoading(false);
              loadingMinijuegoRef.current = false;
              return;
            }
            
            // El backend debe enviar objetos con word y anagram ya mezclado
            const formattedWords = validWords.map((w: any) => {
              if (typeof w === 'object' && w.word) {
                // Usar el anagrama que viene del backend
                if (!w.anagram && !w.scrambled_word) {
                  console.error('ERROR: El backend no envió el anagrama mezclado para la palabra:', w.word);
                  toast.error('Error: El backend no envió el anagrama mezclado. Por favor, recarga la página.');
                  throw new Error('Anagrama faltante del backend');
                }
                return { word: w.word, anagram: w.anagram || w.scrambled_word };
              }
              // Si viene como string, es un error - el backend debe enviar objetos
              console.error('ERROR: El backend envió una palabra como string simple. Debe enviar objetos con word y anagram.');
              toast.error('Error: Formato de datos incorrecto del backend.');
              throw new Error('Formato de anagrama incorrecto');
            });
            setMinigameData({
              type: anagramType,
              words: formattedWords,
            });
            minigameDataLoadedRef.current = true;
            if (responseData.anagram_current_index !== undefined && responseData.anagram_current_index !== null) {
              setCurrentGameIndex(responseData.anagram_current_index);
            } else if (answersFromProgress.length > 0) {
              setCurrentGameIndex(answersFromProgress.length);
            }
            console.log(`[loadMinijuegoActivity] ✅ Anagrama cargado desde backend: ${formattedWords.length} palabras`);
            
            // Guardar las palabras en el progreso para mantener consistencia
            if (existingProgress && formattedWords.length === 5) {
              const updatedResponseData = existingProgress.response_data || {};
              updatedResponseData.anagram_words = formattedWords;
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
                console.error('Error guardando palabras del anagrama:', error);
              });
            }
            
            setLoading(false);
            loadingMinijuegoRef.current = false;
            return;
          } else {
            console.error('[loadMinijuegoActivity] Backend no devolvió anagram_data');
            toast.error('Error: No se pudieron cargar las palabras del anagrama. Por favor, recarga la página.');
            setLoading(false);
            loadingMinijuegoRef.current = false;
            return;
          }
        }
      }
      
      let wordSearchData: WordSearchData;
      if (wordSearchDataFromBackend && wordSearchDataFromBackend.words && wordSearchDataFromBackend.grid) {
        wordSearchData = {
          type: MinigameType.WORD_SEARCH,
          words: wordSearchDataFromBackend.words,
          grid: wordSearchDataFromBackend.grid,
          wordPositions: wordSearchDataFromBackend.wordPositions || [],
        };
      } else {
        console.warn('El backend no devolvió word_search_data, usando fallback');
        const wordSearchType = MinigameType.WORD_SEARCH;
        const seed = sessionStageId && teamId ? `${teamId}_${sessionStageId}` : undefined;
        wordSearchData = parseMinigameConfig(config, wordSearchType, seed) as WordSearchData;
      }
      
      const totalWordsExpected = wordSearchData.words.length;
      if (foundWordsFromProgress.length >= totalWordsExpected) {
        if (anagramCompleted) {
          setCurrentPart('general_knowledge');
          // Restaurar preguntas si están guardadas
          if (generalKnowledgeData.questions_data && generalKnowledgeData.questions_data.length > 0) {
            setGeneralKnowledgeQuestions(generalKnowledgeData.questions_data);
          }
          setLoading(false);
          minigameDataLoadedRef.current = true;
          return;
        }
        
        setCurrentPart('anagram');
        const anagramType = MinigameType.ANAGRAMA;
        setCurrentGameType(anagramType);
        
        // Restaurar palabras desde response_data si ya están guardadas
        const savedAnagramWords = responseData.anagram_words;
        if (savedAnagramWords && Array.isArray(savedAnagramWords) && savedAnagramWords.length > 0) {
          // Verificar si todas las palabras tienen formato correcto (objetos con word y anagram)
          const allHaveFormat = savedAnagramWords.every((w: any) => 
            typeof w === 'object' && w.word && (w.anagram || w.scrambled_word)
          );
          
          if (allHaveFormat) {
            // Las palabras guardadas tienen formato correcto, usarlas directamente
            const formattedWords = savedAnagramWords.map((w: any) => ({
              word: w.word,
              anagram: w.anagram || w.scrambled_word
            }));
            setMinigameData({
              type: anagramType,
              words: formattedWords,
            });
            minigameDataLoadedRef.current = true;
            if (responseData.anagram_current_index !== undefined && responseData.anagram_current_index !== null) {
              setCurrentGameIndex(responseData.anagram_current_index);
            }
            console.log(`Anagrama restaurado desde progreso: ${savedAnagramWords.length} palabras`);
            return; // Salir temprano si se restauró correctamente
          } else {
            // Si las palabras están como strings simples, necesitamos cargar desde el backend
            console.log('[loadMinijuegoActivity] Palabras guardadas como strings, cargando desde backend para obtener anagramas...');
          }
        }
        
        // Si no hay palabras guardadas o están en formato incorrecto, cargar desde el backend
        {
          // Si no hay palabras guardadas, cargar desde el backend y guardarlas
          const anagramDataFromBackend = activityData.anagram_data;
          if (anagramDataFromBackend && anagramDataFromBackend.words && anagramDataFromBackend.words.length > 0) {
            // Asegurar que tengamos exactamente 5 palabras
            let wordsToUse = anagramDataFromBackend.words;
            if (wordsToUse.length < 5) {
              console.error(`ERROR: Backend solo devolvió ${wordsToUse.length} palabras, se esperaban 5`);
              toast.error(`Error: Solo se recibieron ${wordsToUse.length} palabras del anagrama. Se esperaban 5.`);
              // No establecer minigameData si no hay 5 palabras
              return;
            } else if (wordsToUse.length > 5) {
              wordsToUse = wordsToUse.slice(0, 5);
            }
            
            // Validar que todas las palabras tengan el formato correcto
            const validWords = wordsToUse.filter(w => w && (typeof w === 'string' || (typeof w === 'object' && w.word)));
            if (validWords.length !== 5) {
              console.error(`ERROR: Solo ${validWords.length} palabras válidas de ${wordsToUse.length}`);
              toast.error('Error: Las palabras del anagrama no tienen el formato correcto.');
              return;
            }
            
            // El backend debe enviar objetos con word y anagram ya mezclado
            const formattedWords = validWords.map((w: any) => {
              if (typeof w === 'object' && w.word) {
                if (!w.anagram && !w.scrambled_word) {
                  console.error('ERROR: El backend no envió el anagrama mezclado para la palabra:', w.word);
                  toast.error('Error: El backend no envió el anagrama mezclado.');
                  throw new Error('Anagrama faltante del backend');
                }
                return { word: w.word, anagram: w.anagram || w.scrambled_word };
              }
              console.error('ERROR: El backend envió una palabra como string simple. Debe enviar objetos con word y anagram.');
              toast.error('Error: Formato de datos incorrecto del backend.');
              throw new Error('Formato de anagrama incorrecto');
            });
            
            setMinigameData({
              type: anagramType,
              words: formattedWords,
            });
            console.log(`Anagrama cargado desde backend: ${formattedWords.length} palabras`);
            
            // Guardar las palabras en el progreso para mantener consistencia
            if (existingProgress && formattedWords.length === 5) {
              const updatedResponseData = existingProgress.response_data || {};
              updatedResponseData.anagram_words = formattedWords;
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
                console.error('Error guardando palabras del anagrama:', error);
              });
            }
          } else {
            // NO usar fallback - esperar a que el backend devuelva anagram_data
            console.error('ERROR: Backend no devolvió anagram_data. No se puede usar fallback para anagramas.');
            toast.error('Error: No se pudieron cargar las palabras del anagrama. Por favor, recarga la página.');
            // No establecer minigameData si no hay datos del backend
            return;
          }
        }
      } else {
        if (currentPart !== 'anagram') {
        setCurrentPart('word_search');
        }
        setCurrentGameType(MinigameType.WORD_SEARCH);
        setMinigameData(wordSearchData);
        minigameDataLoadedRef.current = true;
      }
      
      if (foundWordsFromProgress.length > 0) {
        setFoundWords(foundWordsFromProgress.map((w: string) => w.toUpperCase()));
      }
      
      setLoading(false);
      minigameDataLoadedRef.current = true;
    } catch (error: any) {
      console.error('Error loading minijuego activity:', error);
      toast.error('Error al cargar la actividad: ' + (error.message || 'Error desconocido'));
      minigameDataLoadedRef.current = false;
      setLoading(false);
    } finally {
      loadingMinijuegoRef.current = false;
    }
  };

  const checkExistingProgress = async (teamId: number, activityId: number, sessionStageId: number) => {
    try {
      if (progressCheckedRef.current) {
        return;
      }
      progressCheckedRef.current = true;
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/?team=${teamId}&activity=${activityId}&session_stage=${sessionStageId}`
      );

      if (response.ok) {
        const data = await response.json();
        const results = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
        
        if (results.length > 0) {
          const progress = results[0];
          const responseData = progress.response_data || {};
          const answers = responseData.answers || [];
          
          // Restaurar índice actual del anagrama
          const savedIndex = responseData.anagram_current_index;
          if (savedIndex !== undefined && savedIndex !== null) {
            console.log(`[checkExistingProgress] Restaurando índice del anagrama desde progreso: ${savedIndex}`);
            setCurrentGameIndex(savedIndex);
          } else if (answers.length > 0) {
            // Si no hay índice guardado, calcular basado en respuestas correctas
            const correctAnswers = answers.filter((a: any) => 
              a.word && a.answer && a.word.toLowerCase() === a.answer.toLowerCase()
            );
            const indexToSet = correctAnswers.length;
            console.log(`[checkExistingProgress] No hay índice guardado, calculando desde respuestas correctas: ${indexToSet} de ${answers.length} respuestas`);
            setCurrentGameIndex(indexToSet);
          }
          
          const foundWordsFromData = responseData.found_words || [];
          if (foundWordsFromData.length > 0) {
            setFoundWords(foundWordsFromData.map((w: string) => w.toUpperCase()));
          }
          
          const hasWordSearchProgress = foundWordsFromData.length > 0;
          const hasAnagramProgress = answers.length > 0;
          
          const generalKnowledgeData = responseData.general_knowledge || {};
          const hasGeneralKnowledgeProgress = generalKnowledgeData.answers && generalKnowledgeData.answers.length > 0;
          const generalKnowledgeCompleted = generalKnowledgeData.completed || false;
          const totalWordsExpected = responseData.total_words || 5;
          
          // Si hay progreso en general_knowledge, mostrar esa parte
          if (hasGeneralKnowledgeProgress || generalKnowledgeCompleted) {
            setCurrentPart('general_knowledge');
            if (generalKnowledgeData.questions_data && generalKnowledgeData.questions_data.length > 0) {
              // Primero establecer las preguntas
              if (generalKnowledgeQuestions.length === 0 || 
                  JSON.stringify(generalKnowledgeQuestions.map(q => q.id)) !== 
                  JSON.stringify(generalKnowledgeData.questions_data.map((q: any) => q.id))) {
                setGeneralKnowledgeQuestions(generalKnowledgeData.questions_data);
              }
              
              // IMPORTANTE: Restaurar respuestas DESPUÉS de establecer las preguntas
              if (generalKnowledgeData.answers && Array.isArray(generalKnowledgeData.answers)) {
                const answeredCount = generalKnowledgeData.answers.length;
                const totalQuestions = generalKnowledgeData.questions_data?.length || 0;
                console.log(`[checkExistingProgress] 📝 Conocimiento general: ya se respondieron ${answeredCount} preguntas de ${totalQuestions}`);
                
                const answersMap = new Map<number, number>();
                generalKnowledgeData.answers.forEach((a: any) => {
                  if (a.question_id !== undefined && a.selected !== undefined) {
                    answersMap.set(a.question_id, a.selected);
                  }
                });
                
                // Establecer respuestas e índice INMEDIATAMENTE (antes de que el componente se renderice)
                setGeneralKnowledgeSelectedAnswers(answersMap);
                previousGeneralKnowledgeAnswersRef.current = new Map(answersMap);
                // El índice actual es la cantidad de respuestas (mostrar la siguiente)
                setGeneralKnowledgeCurrentIndex(answeredCount);
              }
            } else if (generalKnowledgeQuestions.length === 0) {
              loadGeneralKnowledgeQuestions();
            }
          } else if (hasAnagramProgress && (answers.length >= totalWordsExpected || responseData.anagram_completed)) {
            setCurrentPart('general_knowledge');
            if (minigameData?.type === MinigameType.ANAGRAMA) {
              setCurrentGameIndex(minigameData.words.length);
            } else {
              setCurrentGameIndex(totalWordsExpected);
            }
            if (responseData.general_knowledge?.questions_data && responseData.general_knowledge.questions_data.length > 0) {
              console.log('[checkExistingProgress] 📚 Restaurando preguntas de conocimiento general:', responseData.general_knowledge.questions_data.length);
              setGeneralKnowledgeQuestions(responseData.general_knowledge.questions_data);
              
              // Restaurar respuestas DESPUÉS de establecer las preguntas
              if (responseData.general_knowledge.answers && Array.isArray(responseData.general_knowledge.answers)) {
                const answeredCount = responseData.general_knowledge.answers.length;
                console.log('[checkExistingProgress] 📝 Conocimiento general: ya se respondieron', answeredCount, 'preguntas de', responseData.general_knowledge.questions_data.length);
                
                const answersMap = new Map<number, number>();
                responseData.general_knowledge.answers.forEach((a: any) => {
                  if (a.question_id !== undefined && a.selected !== undefined) {
                    answersMap.set(a.question_id, a.selected);
                  }
                });
                
                // Establecer respuestas e índice INMEDIATAMENTE
                setGeneralKnowledgeSelectedAnswers(answersMap);
                previousGeneralKnowledgeAnswersRef.current = new Map(answersMap);
                // El índice actual es la cantidad de respuestas (mostrar la siguiente)
                setGeneralKnowledgeCurrentIndex(answeredCount);
              }
            } else if (generalKnowledgeQuestions.length === 0) {
              loadGeneralKnowledgeQuestions();
            }
          } else if (hasWordSearchProgress && foundWordsFromData.length >= totalWordsExpected && !hasAnagramProgress) {
            setCurrentPart('anagram');
            if (minigameData?.type !== MinigameType.ANAGRAMA && activityId && teamId && sessionStageId) {
              loadActivityWithWordSearch(activityId, teamId, sessionStageId)
                .then(activityData => {
                  const anagramType = MinigameType.ANAGRAMA;
                  setCurrentGameType(anagramType);
                  const anagramDataFromBackend = activityData.anagram_data;
                  if (anagramDataFromBackend && anagramDataFromBackend.words && anagramDataFromBackend.words.length > 0) {
                    const formattedWords = anagramDataFromBackend.words.map((w: any) => {
                      if (typeof w === 'object' && w.word && (w.anagram || w.scrambled_word)) {
                        return { word: w.word, anagram: w.anagram || w.scrambled_word };
                      }
                      console.error('ERROR: El backend envió formato incorrecto:', w);
                      throw new Error('Formato de anagrama incorrecto del backend');
                    });
                    setMinigameData({
                      type: anagramType,
                      words: formattedWords,
                    });
                    minigameDataLoadedRef.current = true;
                  } else {
                    console.error('[checkExistingProgress] Backend no devolvió anagram_data');
                    toast.error('Error: No se pudieron cargar las palabras del anagrama.');
                  }
                })
                .catch(error => {
                  console.error('Error loading activity:', error);
                });
            }
          } else if (hasWordSearchProgress && foundWordsFromData.length < totalWordsExpected) {
            setCurrentPart('word_search');
            if (!minigameData || minigameData.type !== MinigameType.WORD_SEARCH) {
              if (activityId && teamId && sessionStageId && !loadingMinijuegoRef.current) {
                loadingMinijuegoRef.current = true;
              loadActivityWithWordSearch(activityId, teamId, sessionStageId)
                .then(activityData => {
                  const wordSearchDataFromBackend = activityData.word_search_data;
                  const wordSearchType = MinigameType.WORD_SEARCH;
                  setCurrentGameType(wordSearchType);
                  let parsedData: WordSearchData;
                  if (wordSearchDataFromBackend && wordSearchDataFromBackend.words && wordSearchDataFromBackend.grid) {
                    parsedData = {
                      type: MinigameType.WORD_SEARCH,
                      words: wordSearchDataFromBackend.words,
                      grid: wordSearchDataFromBackend.grid,
                      wordPositions: wordSearchDataFromBackend.wordPositions || [],
                    };
                  } else {
                    // Fallback solo si el backend no devuelve datos
                    console.warn('El backend no devolvió word_search_data, usando fallback');
                    const config = activityData.config_data || {};
                    const seed = sessionStageId && teamId ? `${teamId}_${sessionStageId}` : undefined;
                    parsedData = parseMinigameConfig(config, wordSearchType, seed) as WordSearchData;
                  }
                  setMinigameData(parsedData);
                    loadingMinijuegoRef.current = false;
                })
                .catch(error => {
                  console.error('Error loading activity:', error);
                    loadingMinijuegoRef.current = false;
                  });
              }
            }
          } else if (hasAnagramProgress && answers.length < totalWordsExpected && !responseData.anagram_completed) {
            setCurrentPart('anagram');
            const savedAnagramWords = responseData.anagram_words;
            if (savedAnagramWords && Array.isArray(savedAnagramWords) && savedAnagramWords.length > 0) {
              const anagramType = MinigameType.ANAGRAMA;
              setCurrentGameType(anagramType);
              const formattedWords = savedAnagramWords.map((w: any) => {
                if (typeof w === 'object' && w.word && (w.anagram || w.scrambled_word)) {
                  return { word: w.word, anagram: w.anagram || w.scrambled_word };
                }
                console.error('ERROR: Palabra guardada sin formato correcto:', w);
                throw new Error('Formato de palabra guardada incorrecto');
              });
              
                setMinigameData({
                  type: anagramType,
                words: formattedWords,
              });
              minigameDataLoadedRef.current = true;
              const savedIndex = responseData.anagram_current_index;
              if (savedIndex !== undefined && savedIndex !== null) {
                console.log(`[checkExistingProgress] Restaurando índice del anagrama: ${savedIndex}`);
                setCurrentGameIndex(savedIndex);
              } else if (answers.length > 0) {
                setCurrentGameIndex(answers.length);
              }
            } else if (activityId && teamId && sessionStageId) {
              loadActivityWithWordSearch(activityId, teamId, sessionStageId)
                .then(activityData => {
                  const anagramType = MinigameType.ANAGRAMA;
                  setCurrentGameType(anagramType);
                  const anagramDataFromBackend = activityData.anagram_data;
                    if (anagramDataFromBackend && anagramDataFromBackend.words && anagramDataFromBackend.words.length > 0) {
                      // Validar que tenga exactamente 5 palabras
                      if (anagramDataFromBackend.words.length !== 5) {
                        console.error(`ERROR: Backend devolvió ${anagramDataFromBackend.words.length} palabras, se esperaban exactamente 5`);
                        toast.error(`Error: Se recibieron ${anagramDataFromBackend.words.length} palabras del anagrama. Se esperaban 5.`);
                        return;
                      }
                      
                      // Validar formato de palabras
                      const validWords = anagramDataFromBackend.words.filter(w => 
                        w && (typeof w === 'string' || (typeof w === 'object' && w.word))
                      );
                      
                      if (validWords.length !== 5) {
                        console.error(`ERROR: Solo ${validWords.length} palabras válidas de ${anagramDataFromBackend.words.length}`);
                        toast.error('Error: Las palabras del anagrama no tienen el formato correcto.');
                        return;
                      }
                      
                      // El backend debe enviar objetos con word y anagram ya mezclado
                      const formattedWords = validWords.map((w: any) => {
                        if (typeof w === 'object' && w.word) {
                          if (!w.anagram && !w.scrambled_word) {
                            console.error('ERROR: El backend no envió el anagrama mezclado para la palabra:', w.word);
                            toast.error('Error: El backend no envió el anagrama mezclado.');
                            throw new Error('Anagrama faltante del backend');
                          }
                          return { word: w.word, anagram: w.anagram || w.scrambled_word };
                        }
                        console.error('ERROR: El backend envió una palabra como string simple. Debe enviar objetos con word y anagram.');
                        toast.error('Error: Formato de datos incorrecto del backend.');
                        throw new Error('Formato de anagrama incorrecto');
                      });
                      
                      setMinigameData({
                        type: anagramType,
                        words: formattedWords,
                      });
                    minigameDataLoadedRef.current = true;
                    const savedIndex = responseData.anagram_current_index;
                    if (savedIndex !== undefined && savedIndex !== null) {
                      console.log(`[checkExistingProgress] Restaurando índice del anagrama: ${savedIndex}`);
                      setCurrentGameIndex(savedIndex);
                    } else if (answers.length > 0) {
                      setCurrentGameIndex(answers.length);
                    }
                    
                    // Guardar las palabras en el progreso
                      if (results.length > 0 && formattedWords.length === 5) {
                        const progressToUpdate = results[0];
                        const updatedResponseData = progressToUpdate.response_data || {};
                        updatedResponseData.anagram_words = formattedWords;
                        // Actualizar en el backend sin esperar respuesta
                        fetch(
                          `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/${progressToUpdate.id}/`,
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
                          console.error('Error guardando palabras del anagrama:', error);
                      });
                    }
                  } else {
                    console.error('ERROR: Backend no devolvió anagram_data');
                    toast.error('Error: No se pudieron cargar las palabras del anagrama. Por favor, recarga la página.');
                  }
                })
                .catch(error => {
                  console.error('Error loading activity:', error);
                  toast.error('Error al cargar el anagrama. Por favor, recarga la página.');
                });
            }
          }
        }
      }
      progressCheckedRef.current = true;
    } catch (error) {
      console.error('Error checking game progress:', error);
      progressCheckedRef.current = true;
    }
  };

  const startTimer = async (activityId: number, gameSessionId: number) => {
    if (timerIntervalRef.current) {
      return;
    }

    try {
      const timerResponse = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/game-sessions/${gameSessionId}/activity_timer/`
      );

      if (!timerResponse.ok) return;

      const timerData = await timerResponse.json();
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

  const verifyAnswer = async () => {
    if (!userAnswer.trim()) {
      toast.error('Por favor escribe una respuesta');
      return;
    }

    if (!team || !currentActivityId || !currentSessionStageId || !minigameData) {
      toast.error('Faltan datos necesarios');
      return;
    }

    if (minigameData.type !== MinigameType.ANAGRAMA) {
      return;
    }

    const currentWord = minigameData.words[currentGameIndex];
    if (!currentWord) return;

    const userAnswerLower = userAnswer.trim().toLowerCase();
    const correctWordLower = currentWord.word.toLowerCase();
    const isAnswerCorrect = userAnswerLower === correctWordLower;

    setIsCorrect(isAnswerCorrect);
    setSubmitting(true);

    if (isAnswerCorrect) {
      // Guardar respuesta (usar la palabra original en mayúsculas y la respuesta también en mayúsculas para consistencia con el backend)
      const newCompletedItem = { word: currentWord.word.toUpperCase(), answer: userAnswerLower.toUpperCase() };

      // Guardar el índice actual en el progreso
      const newIndex = currentGameIndex + 1;

      // Enviar respuesta
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/submit_anagram/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              team: team.id,
              activity: currentActivityId,
              session_stage: currentSessionStageId,
              answers: [newCompletedItem],
              minigame_type: currentGameType,  // Enviar tipo de minijuego
              total_words: minigameData?.words.length || 0, // Enviar el número real de palabras generadas
              current_index: newIndex, // Guardar el índice actual
              anagram_words: minigameData.words.map((w: any) => w.word.toUpperCase()), // Enviar las palabras del anagrama
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const tokensEarned = data.tokens_earned || 0;
          
          console.log(`[verifyAnswer] Respuesta del backend: tokens_earned=${tokensEarned}, correct_answers=${data.correct_answers || 0}, total_correct=${data.total_correct || 0}`);
          
          if (tokensEarned > 0) {
            toast.success(`¡Correcto! +${tokensEarned} token${tokensEarned > 1 ? 's' : ''}`);
            // Actualizar tokens sin recargar toda la página (evitar que loadMinijuegoActivity se ejecute)
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
          } else {
            // Si no se otorgaron tokens pero la respuesta fue correcta, puede ser que ya se otorgaron antes
            console.log('[verifyAnswer] No se otorgaron tokens nuevos (puede ser que ya se otorgaron antes)');
          }

          // Verificar si completó todas las palabras del anagrama
          const newIndex = currentGameIndex + 1;
          const isAnagramComplete = newIndex >= minigameData.words.length;
          
          console.log(`[verifyAnswer] currentGameIndex=${currentGameIndex}, newIndex=${newIndex}, words.length=${minigameData.words.length}, isAnagramComplete=${isAnagramComplete}`);
          
          if (isAnagramComplete) {
            // Asegurar que el índice esté en el límite correcto
            setCurrentGameIndex(minigameData.words.length);
            
            // Completó el anagrama, guardar progreso y cargar preguntas de conocimiento general
            // Guardar que el anagrama está completado
            try {
              const progressResponse = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/?team=${team.id}&activity=${currentActivityId}&session_stage=${currentSessionStageId}`
              );
              if (progressResponse.ok) {
                const progressData = await progressResponse.json();
                const results = Array.isArray(progressData.results) ? progressData.results : (Array.isArray(progressData) ? progressData : []);
                if (results.length > 0) {
                  const progress = results[0];
                  const responseData = progress.response_data || {};
                  await fetch(
                    `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/${progress.id}/`,
                    {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        response_data: {
                          ...responseData,
                          anagram_completed: true,
                          anagram_current_index: minigameData.words.length,
                        },
                      }),
                    }
                  );
                }
              }
            } catch (error) {
              console.error('Error al guardar progreso del anagrama completado:', error);
            }
            
            // Avanzar directamente a parte 3 - las preguntas ya deberían estar cargadas desde el inicio
            console.log('[verifyAnswer] Anagrama completado, avanzando a parte 3...');
            setSubmitting(false);
            setUserAnswer('');
            setIsCorrect(null);
            
            // Cambiar a parte 3 directamente (sin pantalla de carga)
            setCurrentPart('general_knowledge');
            
            // Verificar que las preguntas estén cargadas (si no, cargarlas)
            if (generalKnowledgeQuestions.length === 0) {
              console.warn('[verifyAnswer] No hay preguntas de conocimiento general cargadas, cargando...');
              try {
                await loadGeneralKnowledgeQuestions();
              } catch (error) {
                console.error('[verifyAnswer] Error al cargar preguntas:', error);
                toast.error('Error al cargar las preguntas de conocimiento general. Intenta recargar la página.');
              }
            } else {
              console.log(`[verifyAnswer] Preguntas de conocimiento general ya cargadas: ${generalKnowledgeQuestions.length}`);
            }
            
            // Restaurar progreso de conocimiento general si existe
            if (currentActivityId && currentSessionStageId && team.id) {
              try {
                const progressResponse = await fetch(
                  `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/?team=${team.id}&activity=${currentActivityId}&session_stage=${currentSessionStageId}`
                );
                if (progressResponse.ok) {
                  const progressData = await progressResponse.json();
                  const results = Array.isArray(progressData.results) ? progressData.results : (Array.isArray(progressData) ? progressData : []);
                  if (results.length > 0) {
                    const progress = results[0];
                    const responseData = progress.response_data || {};
                    const generalKnowledgeData = responseData.general_knowledge || {};
                    
                    // IMPORTANTE: Restaurar preguntas PRIMERO, luego el índice
                    if (generalKnowledgeData.questions_data && generalKnowledgeData.questions_data.length > 0) {
                      console.log('[verifyAnswer] 📚 Restaurando preguntas de conocimiento general:', generalKnowledgeData.questions_data.length);
                      setGeneralKnowledgeQuestions(generalKnowledgeData.questions_data);
                      
                      // Restaurar respuestas DESPUÉS de establecer las preguntas
                      if (generalKnowledgeData.answers && Array.isArray(generalKnowledgeData.answers)) {
                        const answeredCount = generalKnowledgeData.answers.length;
                        console.log('[verifyAnswer] 📝 Conocimiento general: ya se respondieron', answeredCount, 'preguntas de', generalKnowledgeData.questions_data.length);
                        
                        const answersMap = new Map<number, number>();
                        generalKnowledgeData.answers.forEach((a: any) => {
                          if (a.question_id !== undefined && a.selected !== undefined) {
                            answersMap.set(a.question_id, a.selected);
                          }
                        });
                        
                        // Establecer respuestas e índice INMEDIATAMENTE
                        setGeneralKnowledgeSelectedAnswers(answersMap);
                        previousGeneralKnowledgeAnswersRef.current = new Map(answersMap);
                        // El índice actual es la cantidad de respuestas (mostrar la siguiente)
                        setGeneralKnowledgeCurrentIndex(answeredCount);
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('[verifyAnswer] Error al restaurar progreso de conocimiento general:', error);
              }
            }
          } else {
          // Esperar un momento y mostrar siguiente palabra
          setTimeout(() => {
              setCurrentGameIndex(newIndex);
            setUserAnswer('');
            setIsCorrect(null);
            setSubmitting(false);
          }, 1500);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          toast.error('Error: ' + (errorData.error || 'Error desconocido'));
          setSubmitting(false);
        }
      } catch (error: any) {
        toast.error('Error de conexión: ' + (error.message || 'Error desconocido'));
        setSubmitting(false);
      }
    } else {
      // Respuesta incorrecta
      setTimeout(() => {
        setUserAnswer('');
        setIsCorrect(null);
        setSubmitting(false);
      }, 2000);
    }
  };


  // handleKeyPress removido - no se usa, el componente AnagramGame maneja su propio onKeyPress

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

  const handleWordFound = async (word: string, cells: Array<{ row: number; col: number }>) => {
    const newFoundWords = [...foundWords, word];
    setFoundWords(newFoundWords);

    if (!team || !currentActivityId || !currentSessionStageId) {
      return;
    }

    // Guardar progreso
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/submit_word_search/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            team: team.id,
            activity: currentActivityId,
            session_stage: currentSessionStageId,
            found_words: newFoundWords, // Enviar todas las palabras encontradas
            minigame_type: currentGameType,
            total_words: minigameData?.words.length || 0, // Enviar el número real de palabras generadas
            completed: newFoundWords.length >= (minigameData?.words.length || 0), // Completado si encontraron todas las palabras
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const tokensEarned = data.tokens_earned || 0;
        
        // Mostrar mensaje siempre, incluso si no se otorgaron tokens nuevos (puede que ya se habían otorgado antes)
        if (tokensEarned > 0) {
          toast.success(`¡Palabra encontrada! +${tokensEarned} tokens`);
        } else {
          toast.success(`¡Palabra encontrada!`);
        }
        
        // Recargar estado del equipo para actualizar tokens y progreso
        if (connectionId) {
          loadGameState(connectionId);
        }
        
        // No recargar progreso aquí para evitar sobrescribir el estado actual
        // El progreso se actualiza automáticamente cuando se envía la respuesta
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error('Error: ' + (errorData.error || 'Error desconocido'));
      }
    } catch (error: any) {
      console.error('Error saving word search progress:', error);
      toast.error('Error al guardar progreso');
    }
  };

  const handleWordSearchComplete = async () => {
    // Esta función se llama automáticamente cuando se completa la sopa de letras
    // Solo guardamos el progreso, pero NO cambiamos de parte automáticamente
    // El usuario debe hacer clic en el botón "Continuar a Parte 2" para avanzar
    if (!team || !currentActivityId || !currentSessionStageId) {
      return;
    }

    // Guardar progreso (pero no cambiar de parte todavía)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/submit_word_search/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            team: team.id,
            activity: currentActivityId,
            session_stage: currentSessionStageId,
            found_words: foundWords,
            minigame_type: currentGameType,
            total_words: minigameData?.words.length || 0,
            completed: foundWords.length >= (minigameData?.words.length || 0),
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // No mostrar toast aquí, se mostrará cuando el usuario haga clic en el botón
        // toast.success(`¡Has completado la Parte 1: Sopa de Letras! ${data.tokens_earned || 0} tokens ganados`);
      }
    } catch (error: any) {
      console.error('Error saving word search progress:', error);
      // No mostrar error aquí, se manejará cuando el usuario intente continuar
    }
  };
  
  const loadGeneralKnowledgeQuestions = async (forceReload: boolean = false) => {
    // Si ya hay preguntas cargadas y no se fuerza la recarga, no hacer nada
    if (generalKnowledgeQuestions.length > 0 && !forceReload) {
      console.log('[loadGeneralKnowledgeQuestions] Ya hay preguntas cargadas, no recargando');
      return;
    }
    
    console.log('[loadGeneralKnowledgeQuestions] Iniciando carga de preguntas...');
    setLoadingGeneralKnowledge(true);
    
    try {
      // Agregar timeout para evitar que se quede pegado
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: La carga de preguntas tomó demasiado tiempo')), 10000);
      });
      
      const questionsPromise = challengesAPI.getRandomGeneralKnowledgeQuestions(5);
      const questions = await Promise.race([questionsPromise, timeoutPromise]) as any;
      
      const questionsArray = Array.isArray(questions) ? questions : [];
      console.log(`[loadGeneralKnowledgeQuestions] Preguntas recibidas: ${questionsArray.length}`);
      setGeneralKnowledgeQuestions(questionsArray);
      
      // Guardar las preguntas en el progreso para que no cambien
      if (questionsArray.length > 0 && team?.id && currentActivityId && currentSessionStageId) {
        try {
          console.log('[loadGeneralKnowledgeQuestions] Guardando preguntas en progreso...');
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
            if (!responseData.general_knowledge?.questions_data || responseData.general_knowledge.questions_data.length === 0) {
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
              console.log('[loadGeneralKnowledgeQuestions] Preguntas guardadas en progreso');
            } else {
              console.log('[loadGeneralKnowledgeQuestions] Las preguntas ya estaban guardadas');
            }
          }
        } catch (error) {
          console.error('[loadGeneralKnowledgeQuestions] Error al guardar preguntas en progreso:', error);
          // No bloquear el flujo si falla el guardado
        }
      } else {
        console.warn('[loadGeneralKnowledgeQuestions] No se pueden guardar preguntas: faltan datos', {
          hasTeam: !!team?.id,
          hasActivity: !!currentActivityId,
          hasSessionStage: !!currentSessionStageId,
        });
      }
    } catch (error: any) {
      console.error('[loadGeneralKnowledgeQuestions] Error al cargar preguntas de conocimiento general:', error);
      toast.error('Error al cargar las preguntas: ' + (error.message || 'Error desconocido'));
      // No lanzar el error, solo loguearlo para que el flujo continúe
    } finally {
      setLoadingGeneralKnowledge(false);
      console.log('[loadGeneralKnowledgeQuestions] Finalizado');
    }
  };

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
      
      console.log(`[handleGeneralKnowledgeComplete] Respuesta del backend: tokens_earned=${data.tokens_earned || 0}, correct_count=${data.correct_count || 0}, total_questions=${data.total_questions || 0}`);
      
      // El backend retorna tokens_earned, correct_count, etc.
      const tokensEarned = data.response_data?.tokens_earned || data.tokens_earned || 0;
      const correctCount = data.correct_count || 0;
      const totalQuestions = data.total_questions || 5;
      
      if (tokensEarned > 0) {
        toast.success(`¡Completado! Ganaste ${tokensEarned} token${tokensEarned > 1 ? 's' : ''} (${correctCount}/${totalQuestions} correctas)`);
      } else {
        toast.success(`¡Completado! (${correctCount}/${totalQuestions} correctas)`);
      }
      
      // Recargar estado del equipo para actualizar tokens
      if (connectionId) {
        await loadGameState(connectionId);
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

  const switchToPart = async (part: 'word_search' | 'anagram' | 'general_knowledge') => {
    if (!currentActivityId || !team || !currentSessionStageId) return;
    
    // Limpiar minigameData primero para evitar mostrar el juego anterior mientras se carga el nuevo
    setMinigameData(null);
    setCurrentPart(part);
    
    // Resetear refs para permitir la carga del nuevo juego
    minigameDataLoadedRef.current = false;
    loadingMinijuegoRef.current = false;
    
    try {
      if (!currentSessionStageId) {
        toast.error('Error: falta session_stage_id');
        return;
      }

      const activityData = await loadActivityWithWordSearch(currentActivityId, team.id, currentSessionStageId);
      const config = activityData.config_data || {};
      
      if (part === 'word_search') {
        const wordSearchType = MinigameType.WORD_SEARCH;
        setCurrentGameType(wordSearchType);
        
        const wordSearchDataFromBackend = activityData.word_search_data;
        // Usar word_search_data del backend
        let parsedData: WordSearchData;
        if (wordSearchDataFromBackend && wordSearchDataFromBackend.words && wordSearchDataFromBackend.grid) {
          parsedData = {
            type: MinigameType.WORD_SEARCH,
            words: wordSearchDataFromBackend.words,
            grid: wordSearchDataFromBackend.grid,
            wordPositions: wordSearchDataFromBackend.wordPositions || [],
          };
        } else {
          // Fallback solo si el backend no devuelve datos
          console.warn('El backend no devolvió word_search_data, usando fallback');
          const seed = currentSessionStageId && team.id ? `${team.id}_${currentSessionStageId}` : undefined;
          parsedData = parseMinigameConfig(config, wordSearchType, seed) as WordSearchData;
        }
        setMinigameData(parsedData);
        minigameDataLoadedRef.current = true;
      } else if (part === 'anagram') {
        // Cargar anagrama desde el backend (NO usar parseMinigameConfig como fallback)
        const anagramType = MinigameType.ANAGRAMA;
        setCurrentGameType(anagramType);
        
        // Usar anagram_data del backend si está disponible
        const anagramDataFromBackend = activityData.anagram_data;
        if (anagramDataFromBackend && anagramDataFromBackend.words && anagramDataFromBackend.words.length > 0) {
          const formattedWords = anagramDataFromBackend.words.map((w: any) => {
            if (typeof w === 'object' && w.word && (w.anagram || w.scrambled_word)) {
              return { word: w.word, anagram: w.anagram || w.scrambled_word };
            }
            console.error('ERROR: El backend envió formato incorrecto:', w);
            throw new Error('Formato de anagrama incorrecto del backend');
          });
          setMinigameData({
            type: anagramType,
            words: formattedWords,
          });
          minigameDataLoadedRef.current = true;
          // Resetear el índice del anagrama a 0 cuando se carga por primera vez
          setCurrentGameIndex(0);
          setUserAnswer('');
          setIsCorrect(null);
          console.log(`[switchToPart] Anagrama cargado desde backend: ${formattedWords.length} palabras`);
        } else {
          console.error('[switchToPart] Backend no devolvió anagram_data');
          toast.error('Error: No se pudieron cargar las palabras del anagrama.');
        }
      }
    } catch (error: any) {
      console.error('Error switching part:', error);
      toast.error('Error al cambiar de parte');
      // Resetear refs en caso de error para permitir reintentos
      minigameDataLoadedRef.current = false;
      loadingMinijuegoRef.current = false;
    }
  };

  // allCompleted solo debe ser true cuando TODO el minijuego esté completo (anagrama + conocimiento general)
  // NO cuando solo se completa la sopa de letras (word_search), porque debe pasar directamente al anagrama
  const allCompleted = minigameData 
    ? (minigameData.type === MinigameType.ANAGRAMA 
        ? currentGameIndex >= minigameData.words.length && generalKnowledgeCompleted
        : false) // Nunca mostrar "completado" cuando estamos en word_search, debe pasar a anagrama
    : false;

  return (
    <GalacticPage padding="p-4 md:p-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: team?.color || '#c026d3' }} />
          <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 16, fontWeight: 700, color: '#fff' }}>
            {personalization?.team_name || team?.name || 'Mi Equipo'}
          </span>
        </div>
        <div className="glass-card" style={{ padding: '6px 14px' }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: '#fbbf24' }}>
            ⭐ {team?.tokens_total ?? 0}
          </span>
        </div>
      </div>

      {/* Activity label */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div className="galactic-label" style={{ marginBottom: 4 }}>
          {currentPart === 'word_search' ? 'Sopa de Letras' : currentPart === 'anagram' ? 'Anagrama' : 'Conocimiento General'}
        </div>
      </div>

      {/* Game content */}
      <GlassCard style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
        {allCompleted ? (
          <div className="bg-green-50 border-2 border-green-400 rounded-lg p-6 sm:p-8 text-center">
            <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-green-600 mx-auto mb-3" />
            <p className="text-xl sm:text-2xl font-bold text-green-700 mb-2">¡Felicidades!</p>
            <p className="text-green-800 text-sm sm:text-base">Has completado el minijuego</p>
          </div>
        ) : currentPart === 'word_search' && minigameData && minigameData.type === MinigameType.WORD_SEARCH && foundWords.length >= minigameData.words.length ? (
          // Cuando se completa la sopa de letras, mostrar botón para continuar al anagrama
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 rounded-lg p-6 sm:p-8 text-center relative overflow-hidden"
          >
            {/* Elementos decorativos animados */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, type: "spring", bounce: 0.4 }}
              className="absolute top-4 right-4"
            >
              <div className="text-4xl">🎉</div>
            </motion.div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5, type: "spring", bounce: 0.4 }}
              className="absolute bottom-4 left-4"
            >
              <div className="text-3xl">⭐</div>
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-green-600 mx-auto mb-4 drop-shadow-lg" />
            </motion.div>
            
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-2xl sm:text-3xl font-bold text-green-700 mb-3 drop-shadow-sm"
            >
              ¡Parte 1 Completada!
            </motion.p>
            
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-green-800 text-base sm:text-lg mb-8 font-medium"
            >
              Has encontrado todas las palabras en la sopa de letras
            </motion.p>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              <Button
                onClick={async () => {
                  if (!team || !currentActivityId || !currentSessionStageId) {
                    toast.error('Error: faltan datos necesarios');
                    return;
                  }

                  // Marcar como completado en el backend
                  try {
                    const response = await fetch(
                      `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/sessions/team-activity-progress/submit_word_search/`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          team: team.id,
                          activity: currentActivityId,
                          session_stage: currentSessionStageId,
                          found_words: foundWords,
                          minigame_type: currentGameType,
                          total_words: minigameData?.words.length || 0,
                          completed: true,
                        }),
                      }
                    );

                    if (response.ok) {
                      const data = await response.json();
                      toast.success(`¡Has completado la Parte 1: Sopa de Letras! ${data.tokens_earned || 0} tokens ganados`);

                      // Cambiar a la parte 2 (anagrama)
                      await switchToPart('anagram');

                      if (connectionId) {
                        loadGameState(connectionId);
                      }
                    } else {
                      const errorData = await response.json().catch(() => ({}));
                      toast.error('Error: ' + (errorData.error || 'Error desconocido'));
                    }
                  } catch (error: any) {
                    console.error('Error completing word search:', error);
                    toast.error('Error al completar la sopa de letras');
                  }
                }}
                className="bg-gradient-to-r from-[#093c92] to-[#0a4bc7] hover:from-[#072e73] hover:to-[#093c92] text-white px-10 py-4 text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                🚀 Continuar a Parte 2: Anagrama
              </Button>
            </motion.div>
          </motion.div>
        ) : currentPart === 'general_knowledge' ? (
          loadingGeneralKnowledge ? (
            <div className="text-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Cargando preguntas...</p>
            </div>
          ) : generalKnowledgeQuestions.length > 0 ? (
            <GeneralKnowledgeQuiz
              questions={generalKnowledgeQuestions}
              onComplete={handleGeneralKnowledgeComplete}
              initialIndex={generalKnowledgeCurrentIndex}
              initialSelectedAnswers={generalKnowledgeSelectedAnswers}
              onProgressChange={async (currentIndex, selectedAnswers) => {
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
              }}
            />
          ) : (
            <div className="text-center text-gray-500">
              <p>No hay preguntas disponibles</p>
            </div>
          )
        ) : currentPart === 'anagram' ? (
          minigameData && minigameData.type === MinigameType.ANAGRAMA ? (
            <AnagramGame
              data={minigameData}
              currentIndex={currentGameIndex}
              userAnswer={userAnswer}
              setUserAnswer={setUserAnswer}
              isCorrect={isCorrect}
              submitting={submitting}
              onVerify={verifyAnswer}
              teamColor={team?.color}
            />
          ) : (
            <div className="text-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Cargando anagrama...</p>
            </div>
          )
        ) : currentPart === 'word_search' && minigameData && currentGameType === MinigameType.WORD_SEARCH ? (
          <WordSearchGame
            data={minigameData}
            foundWords={foundWords}
            onWordFound={handleWordFound}
            onComplete={handleWordSearchComplete}
            teamColor={team?.color}
          />
        ) : (
          <div className="text-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Cargando minijuego...</p>
          </div>
        )}
      </GlassCard>

      {/* Modal de U-Bot */}
      {team && (
        <UBotMinijuegoModal
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


