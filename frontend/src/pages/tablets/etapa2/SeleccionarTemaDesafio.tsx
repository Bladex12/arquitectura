import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Loader2,
  Award,
  Target,
  ArrowRight,
  ArrowLeft,
  Clock,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UBotEtapa2Modal } from '@/components/UBotEtapa2Modal';
import { Bot } from 'lucide-react';
import { sessionsAPI, tabletConnectionsAPI, challengesAPI, teamActivityProgressAPI, academicAPI, teamPersonalizationsAPI } from '@/services';
import { getResultsRedirectUrl } from '@/utils/tabletResultsRedirect';
import { advanceActivityOnTimerExpiration } from '@/utils/timerAutoAdvance';
import { toast } from 'sonner';

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total?: number;
}

interface Topic {
  id: number;
  name: string;
  icon?: string;
  description?: string;
}

interface Challenge {
  id: number;
  title: string;
  icon?: string;
  persona_name?: string;
  persona_age?: number;
  persona_story?: string;
  persona_image_url?: string;
  description?: string;
}

interface GameSession {
  id: number;
  status: string;
  current_activity?: number;
  current_activity_name?: string;
  current_stage_number?: number;
  course?: number;
}

type Step = 'topic' | 'challenge';

// Mapeo de iconos por ID de tema (se usa como respaldo si la BD no tiene icono)
// Basado en los temas que existen en la base de datos según update_challenges.py
const topicIconsMap: Record<number, string> = {
  // Temas principales del sistema (orden puede variar según creación en BD)
  1: '🏥',  // Salud
  2: '📚',  // Educación
  3: '🌱',  // Sustentabilidad
};

// Mapeo de iconos por nombre de tema (respaldo adicional)
// Prioridad: Temas principales del sistema (Salud, Educación, Sustentabilidad)
const topicIconsByName: Record<string, string> = {
  // Temas principales del sistema (exactos como están en la BD)
  'salud': '🏥',
  'Salud': '🏥',
  'health': '🏥',
  
  'educación': '📚',
  'Educación': '📚',
  'educacion': '📚',
  'Educacion': '📚',
  'education': '📚',
  
  'sustentabilidad': '🌱',
  'Sustentabilidad': '🌱',
  'sostenibilidad': '🌱',
  'Sostenibilidad': '🌱',
  
  // Variaciones y temas relacionados
  'medicina': '🏥',
  'bienestar': '🏥',
  'aprendizaje': '📚',
  'enseñanza': '📚',
  'académico': '📚',
  'academico': '📚',
  'universidad': '🎓',
  'colegio': '📚',
  'escuela': '📚',
  'fitness': '💪',
  'ejercicio': '💪',
  'nutrición': '🥗',
  'nutricion': '🥗',
  
  // Tecnología
  'tecnología': '💡',
  'tecnologia': '💡',
  'tech': '💡',
  'digital': '💡',
  'software': '💻',
  'aplicación': '📱',
  'aplicacion': '📱',
  'app': '📱',
  'innovación': '💡',
  'innovacion': '💡',
  'startup': '🚀',
  
  // Negocios
  'negocio': '💼',
  'business': '💼',
  'emprendimiento': '💼',
  'empresa': '💼',
  'comercio': '🏪',
  'ventas': '💰',
  'marketing': '📢',
  'finanzas': '💰',
  'economía': '📈',
  'economia': '📈',
  
  // Hogar
  'hogar': '🏠',
  'home': '🏠',
  'casa': '🏠',
  'familia': '👨‍👩‍👧‍👦',
  'decoración': '🛋️',
  'decoracion': '🛋️',
  'muebles': '🪑',
  
  // Comida
  'comida': '🍽️',
  'food': '🍽️',
  'restaurante': '🍽️',
  'gastronomía': '👨‍🍳',
  'gastronomia': '👨‍🍳',
  'cocina': '👨‍🍳',
  'bebida': '🥤',
  'café': '☕',
  'cafe': '☕',
  
  // Transporte
  'transporte': '🚗',
  'transport': '🚗',
  'movilidad': '🚗',
  'vehículo': '🚗',
  'vehiculo': '🚗',
  'automóvil': '🚗',
  'automovil': '🚗',
  'delivery': '🚚',
  'logística': '📦',
  'logistica': '📦',
  
  // Deportes
  'deporte': '⚽',
  'sport': '⚽',
  'fútbol': '⚽',
  'futbol': '⚽',
  'fitness': '💪',
  'gimnasio': '🏋️',
  'yoga': '🧘',
  'running': '🏃',
  
  // Música
  'música': '🎵',
  'musica': '🎵',
  'music': '🎵',
  'entretenimiento': '🎬',
  'cine': '🎬',
  'teatro': '🎭',
  
  // Juegos
  'juego': '🎮',
  'game': '🎮',
  'gaming': '🎮',
  'videojuego': '🎮',
  'esports': '🎮',
  
  // Fotografía
  'fotografía': '📷',
  'fotografia': '📷',
  'photo': '📷',
  'cámara': '📷',
  'camara': '📷',
  'video': '🎥',
  
  // Arte
  'arte': '🎨',
  'art': '🎨',
  'diseño': '🎨',
  'diseno': '🎨',
  'creativo': '🎨',
  'pintura': '🖌️',
  'ilustración': '✏️',
  'ilustracion': '✏️',
  
  // Viajes
  'viaje': '✈️',
  'travel': '✈️',
  'turismo': '✈️',
  'tourism': '✈️',
  'hotel': '🏨',
  'vacaciones': '🏖️',
  
  // Moda
  'moda': '👗',
  'fashion': '👗',
  'estilo': '👗',
  'ropa': '👕',
  'accesorios': '💍',
  
  // Servicios
  'servicio': '🔧',
  'service': '🔧',
  'herramienta': '🔧',
  'tool': '🔧',
  'reparación': '🔨',
  'reparacion': '🔨',
  'mantenimiento': '🛠️',
  
  // Social
  'social': '👥',
  'community': '👥',
  'comunidad': '👥',
  'personas': '👥',
  'redes': '📱',
  'networking': '🤝',
  
  // Amor y relaciones
  'amor': '❤️',
  'love': '❤️',
  'relación': '💑',
  'relacion': '💑',
  'pareja': '💑',
  
  // Sostenibilidad
  'sostenibilidad': '🌱',
  'sustentabilidad': '🌱',
  'medio ambiente': '🌍',
  'ecología': '🌿',
  'ecologia': '🌿',
  'verde': '🌱',
  'reciclaje': '♻️',
  
  // Otros
  'mascota': '🐾',
  'pet': '🐾',
  'animal': '🐾',
  'libro': '📖',
  'lectura': '📖',
  'cultura': '🏛️',
  'evento': '🎉',
  'celebración': '🎊',
  'celebracion': '🎊',
};

// Función para obtener el icono del tema
const getTopicIcon = (topic: Topic): string => {
  // 1. Si tiene icono en la BD y NO es "?" (problema de encoding), usarlo
  if (topic.icon && topic.icon !== '?' && topic.icon.trim() !== '') {
    return topic.icon;
  }
  
  // 2. Si el icono es "?" o está vacío, buscar por ID en el mapeo
  if (topicIconsMap[topic.id]) {
    return topicIconsMap[topic.id];
  }
  
  // 3. Buscar por nombre exacto primero (case-sensitive)
  if (topicIconsByName[topic.name]) {
    return topicIconsByName[topic.name];
  }
  
  // 4. Buscar por nombre (case-insensitive)
  const nameLower = topic.name.toLowerCase();
  for (const [key, icon] of Object.entries(topicIconsByName)) {
    if (nameLower === key.toLowerCase() || nameLower.includes(key.toLowerCase())) {
      return icon;
    }
  }
  
  // 5. Por defecto
  return '📚';
};

// Mapeo de iconos por ID de desafío (se usa como respaldo si la BD no tiene icono)
const challengeIconsMap: Record<number, string> = {
  // Los IDs pueden variar según la creación en BD
};

// Mapeo de iconos por título de desafío (respaldo adicional)
// Basado en los desafíos que existen en update_challenges.py
const challengeIconsByTitle: Record<string, string> = {
  // Salud
  'autogestión de tratamientos': '🏥',
  'autogestion de tratamientos': '🏥',
  'autogestión': '🏥',
  'tratamientos': '🏥',
  'obesidad': '⚖️',
  'sobrepeso': '⚖️',
  'envejecimiento activo': '🚶',
  'envejecimiento': '🚶',
  'adultos mayores': '🚶',
  
  // Educación
  'educación financiera accesible': '💰',
  'educacion financiera accesible': '💰',
  'educación financiera': '💰',
  'educacion financiera': '💰',
  'financiera': '💰',
  'inicio de vida laboral': '🎓',
  'vida laboral': '🎓',
  'primer empleo': '🎓',
  'empleo': '🎓',
  'tecnología adultos mayores': '📱',
  'tecnologia adultos mayores': '📱',
  'tecnología': '📱',
  'tecnologia': '📱',
  'adultos mayores tecnología': '📱',
  
  // Sustentabilidad
  'contaminación por fast fashion': '👕',
  'contaminacion por fast fashion': '👕',
  'fast fashion': '👕',
  'contaminación': '👕',
  'contaminacion': '👕',
  'moda': '👕',
  'acceso al agua en la agricultura': '💧',
  'acceso al agua': '💧',
  'agua': '💧',
  'agricultura': '💧',
  'gestión de residuos electrónicos': '♻️',
  'gestion de residuos electronicos': '♻️',
  'residuos electrónicos': '♻️',
  'residuos electronicos': '♻️',
  'residuos': '♻️',
  'reciclaje': '♻️',
  'desechos electrónicos': '♻️',
};

// Función para obtener el icono del desafío
const getChallengeIcon = (challenge: Challenge): string => {
  // 1. Si tiene icono en la BD y NO es "?" (problema de encoding), usarlo
  if (challenge.icon && challenge.icon !== '?' && challenge.icon.trim() !== '') {
    return challenge.icon;
  }
  
  // 2. Si el icono es "?" o está vacío, buscar por ID en el mapeo
  if (challengeIconsMap[challenge.id]) {
    return challengeIconsMap[challenge.id];
  }
  
  // 3. Buscar por título exacto primero (case-insensitive)
  const titleLower = challenge.title.toLowerCase();
  if (challengeIconsByTitle[titleLower]) {
    return challengeIconsByTitle[titleLower];
  }
  
  // 4. Buscar por palabras clave en el título
  for (const [key, icon] of Object.entries(challengeIconsByTitle)) {
    if (titleLower.includes(key)) {
      return icon;
    }
  }
  
  // 5. Por defecto
  return '🎯';
};

export function TabletSeleccionarTemaDesafio() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [personalization, setPersonalization] = useState<{ team_name?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<Step>('topic');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [pendingTopicId, setPendingTopicId] = useState<number | null>(null);
  const [pendingChallengeId, setPendingChallengeId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<number | null>(null);
  const [sessionStageId, setSessionStageId] = useState<number | null>(null);
  const [showUBotModal, setShowUBotModal] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeExpiredRef = useRef<boolean>(false);
  const scrollPositionRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const lastActivityIdRef = useRef<number | null>(null);

  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) {
      navigate('/tablet/join');
      return;
    }
    setConnectionId(connId);
    
    loadGameState(connId, true);

    intervalRef.current = setInterval(() => {
      if (!isFetchingRef.current) {
        loadGameState(connId, false);
      }
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


  const loadGameState = async (connId: string, isInitialLoad: boolean = false) => {
    if (isFetchingRef.current) {
      return;
    }
    
    isFetchingRef.current = true;
    
    try {
      const statusData = await tabletConnectionsAPI.getStatus(connId);
      
      setTeam(statusData.team);
      setGameSessionId(statusData.game_session.id);

      // Cargar personalización del equipo para obtener el nombre personalizado
      try {
        const persList = await teamPersonalizationsAPI.list({ team: statusData.team.id });
        const persResults = Array.isArray(persList) ? persList : [persList];
        if (persResults.length > 0 && persResults[0]) {
          setPersonalization(persResults[0]);
        }
      } catch (error) {
        // Si no hay personalización, continuar sin ella
        setPersonalization(null);
      }

      // Usar lobby en lugar de getById para evitar problemas de autenticación
      const lobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
      const gameData: GameSession = lobbyData.game_session;

      const sessionId = statusData.game_session.id;

      const resultsUrl = getResultsRedirectUrl(gameData, connId);
      if (resultsUrl) { window.location.href = resultsUrl; return; }

      // Mostrar modal de U-Bot si no se ha visto
      if (gameData.current_stage_number === 2 && isInitialLoad) {
        const ubotKey = `ubot_etapa2_${sessionId}`;
        const hasSeenUBot = localStorage.getItem(ubotKey);
        if (!hasSeenUBot) {
          setTimeout(() => {
            setShowUBotModal(true);
            localStorage.setItem(ubotKey, 'true');
          }, 500);
        }
      }

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

      const currentActivityName = gameData.current_activity_name?.toLowerCase() || '';
      const currentStageNumber = gameData.current_stage_number;
      const currentActivityId = gameData.current_activity;

      if (currentStageNumber === 2 && currentActivityId) {
        const normalizedActivityName = currentActivityName.toLowerCase().trim();
        if (normalizedActivityName.includes('bubble') || 
            normalizedActivityName.includes('mapa') || 
            normalizedActivityName.includes('mapa mental') ||
            normalizedActivityName.includes('bubble map') ||
            normalizedActivityName.includes('bubblemap')) {
          window.location.href = `/tablet/etapa2/bubble-map/?connection_id=${connId}`;
          return;
        }
      }

      if (currentStageNumber !== 2) {
        // Si avanzó a una etapa posterior → warp; si retrocedió → lobby
        if (currentStageNumber > 2) {
          const n = currentActivityName;
          let destBase = '';
          if (currentStageNumber === 3) destBase = '/tablet/etapa3/prototipo/';
          else if (currentStageNumber === 4) destBase = n.includes('presentaci') ? '/tablet/etapa4/presentacion-pitch/' : '/tablet/etapa4/formulario-pitch/';
          if (destBase) {
            window.location.href = `/tablet/etapa-warp?stage=${currentStageNumber}&redirect=${encodeURIComponent(destBase)}&connection_id=${connId}`;
          } else {
            window.location.href = `/tablet/lobby?connection_id=${connId}`;
          }
        } else {
          window.location.href = `/tablet/lobby?connection_id=${connId}`;
        }
        return;
      }

      if (currentStageNumber === 2 && (!currentActivityName || currentActivityName.includes('resultados'))) {
        window.location.href = `/tablet/etapa2/resultados/?connection_id=${connId}`;
        return;
      }

      setCurrentActivityId(currentActivityId);

      let currentSessionStageId = sessionStageId;
      if (!currentSessionStageId && currentActivityId) {
        try {
          const stages = await sessionsAPI.getSessionStages(statusData.game_session.id);
          
          const stagesArray = Array.isArray(stages) ? stages : [];
          const stage2 = stagesArray.find((s: any) => s.stage_number === 2);
          if (stage2) {
            currentSessionStageId = stage2.id;
            setSessionStageId(stage2.id);
          }
        } catch (error) {
          // Error loading session stages
        }
      }

      if (currentActivityId && statusData.team.id && currentSessionStageId) {
        await loadProgress(
          statusData.team.id,
          currentActivityId,
          currentSessionStageId,
          statusData.game_session.id,
          isInitialLoad
        );
      }

      if (currentActivityId && lastActivityIdRef.current !== currentActivityId) {
        lastActivityIdRef.current = currentActivityId;
        startTimer(currentActivityId, statusData.game_session.id);
      }

      setLoading(false);
    } catch (error: any) {
      toast.error('Error de conexión: ' + (error.message || 'Error desconocido'));
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  };

  const loadProgress = async (teamId: number, activityId: number, stageId: number, gameSessionId: number, forceUpdateStep: boolean = false) => {
    try {
      const progressList = await teamActivityProgressAPI.list({
        team: teamId,
        activity: activityId,
        session_stage: stageId,
      });
      
      const progress = Array.isArray(progressList) ? progressList[0] : null;

      if (progress) {
        // Si hay desafío seleccionado, entonces el tema también está confirmado
        if (progress.selected_challenge) {
          const challenge = typeof progress.selected_challenge === 'object' 
            ? progress.selected_challenge 
            : { id: progress.selected_challenge };
          
          // Buscar el challenge en el array para obtener la URL completa si está disponible
          const challengeFromArray = challenges.find(c => c.id === challenge.id);
          
          // Priorizar la URL completa del array sobre la ruta relativa del progress
          let finalImageUrl = challenge.persona_image_url;
          if (challengeFromArray?.persona_image_url) {
            // Si el array tiene URL completa, usarla
            if (challengeFromArray.persona_image_url.startsWith('http://') || challengeFromArray.persona_image_url.startsWith('https://')) {
              finalImageUrl = challengeFromArray.persona_image_url;
            } else if (finalImageUrl && (finalImageUrl.startsWith('http://') || finalImageUrl.startsWith('https://'))) {
              // Si el progress tiene URL completa, usarla
            } else if (challengeFromArray.persona_image_url) {
              // Si el array tiene ruta relativa pero el progress no tiene nada, usar la del array
              finalImageUrl = challengeFromArray.persona_image_url;
            }
          } else if (selectedChallenge && selectedChallenge.id === challenge.id && selectedChallenge.persona_image_url) {
            // Si no hay challenge en el array, preservar la imagen del selectedChallenge actual
            if (!finalImageUrl || finalImageUrl === '') {
              finalImageUrl = selectedChallenge.persona_image_url;
            }
          }
          
          const finalChallenge = {
            ...challenge,
            persona_image_url: finalImageUrl
          } as Challenge;
          
          // Si hay tema seleccionado, marcarlo como confirmado y cargar desafíos
          if (progress.selected_topic) {
            const topic = typeof progress.selected_topic === 'object' 
              ? progress.selected_topic 
              : { id: progress.selected_topic };
            setSelectedTopic(topic as Topic);
            setPendingTopicId(null); // Limpiar pendingTopicId ya que está confirmado
            
            if (challenges.length === 0 || pendingTopicId !== topic.id) {
              await loadChallenges(topic.id);
            }
            
            setSelectedChallenge(finalChallenge);
            setPendingChallengeId(null);
            
            // Cambiar al paso de desafíos si hay desafío confirmado
            if (forceUpdateStep || currentStep === 'topic') {
              setCurrentStep('challenge');
            }
          } else {
            setSelectedChallenge(finalChallenge);
            setPendingChallengeId(null);
          }
        } else if (progress.selected_topic) {
          const topic = typeof progress.selected_topic === 'object' 
            ? progress.selected_topic 
            : { id: progress.selected_topic };
          setPendingTopicId(topic.id);
          setSelectedTopic(null);
          setSelectedChallenge(null);
          
          if (challenges.length === 0 || pendingTopicId !== topic.id) {
            await loadChallenges(topic.id);
          }
        } else {
          setSelectedTopic(null);
          setSelectedChallenge(null);
          setPendingTopicId(null);
          setPendingChallengeId(null);
          if (forceUpdateStep) {
            setCurrentStep('topic');
          }
        }
      }
    } catch (error) {
      // Error loading progress
    }
  };

  const loadTopics = async (gameSessionId: number) => {
    try {
      // Obtener información de la sesión para obtener la facultad (usar lobby en lugar de getById)
      const lobbyData = await sessionsAPI.getLobby(gameSessionId);
      const sessionData = lobbyData.game_session;

      if (!sessionData.course) {
        toast.error('Error: No se pudo obtener la información del curso');
        return;
      }

      // Obtener course para obtener la facultad
      const courseData = await academicAPI.getCourseById(sessionData.course);

      if (!courseData.career) {
        toast.error('Error: No se pudo obtener la información de la carrera');
        return;
      }

      // Obtener la carrera para obtener el ID de la facultad
      const careerData = await academicAPI.getCareerById(courseData.career);

      if (!careerData.faculty) {
        toast.error('Error: No se pudo obtener la información de la facultad');
        return;
      }

      const facultyId = careerData.faculty;

      // Obtener temas filtrados por facultad
      const topicsList = await challengesAPI.getTopics({ faculty: facultyId });
      
      const topicsArray = Array.isArray(topicsList) ? topicsList : [];
      setTopics(topicsArray);
    } catch (error: any) {
      toast.error('Error al cargar temas: ' + (error.message || 'Error desconocido'));
    }
  };

  const loadChallenges = async (topicId: number) => {
    if (challenges.length > 0 && pendingTopicId === topicId) {
      return;
    }
    
    try {
      const challengesList = await challengesAPI.getChallenges({ topic: topicId });
      const challengesArray = Array.isArray(challengesList) ? challengesList : [];
      
      // Preservar imágenes de challenges que ya estaban en el estado (si tienen imagen)
      setChallenges(prevChallenges => {
        const updated = challengesArray.map((newChallenge: Challenge) => {
          const existingChallenge = prevChallenges.find(c => c.id === newChallenge.id);
          if (existingChallenge && existingChallenge.persona_image_url && 
              (!newChallenge.persona_image_url || newChallenge.persona_image_url === '')) {
            return {
              ...newChallenge,
              persona_image_url: existingChallenge.persona_image_url
            };
          }
          return newChallenge;
        });
        return updated;
      });
    } catch (error: any) {
      throw error;
    }
  };

  const handleTopicSelect = async (topic: Topic) => {
    if (selectedChallenge) {
      toast.error('Ya has confirmado un desafío. No puedes cambiar el tema.');
      return;
    }

    if (!team || !currentActivityId || !sessionStageId) {
      toast.error('Error: Faltan datos necesarios');
      return;
    }

    setPendingTopicId(topic.id);
    setCurrentStep('challenge');
    
    Promise.all([
      teamActivityProgressAPI.selectTopic({
        team: team.id,
        activity: currentActivityId,
        session_stage: sessionStageId,
        topic: topic.id,
      }).catch(() => {}),
      loadChallenges(topic.id).catch((error: any) => {
        toast.error('Error al cargar desafíos: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
        setCurrentStep('topic');
        setPendingTopicId(null);
      })
    ]);
  };

  const handleChallengeSelect = (challenge: Challenge, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (selectedChallenge) {
      toast.error('Ya has confirmado un desafío. No puedes cambiarlo.');
      return;
    }
    
    // Guardar posición del scroll antes de cambiar el estado
    scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop || window.pageYOffset;
    
    setPendingChallengeId(challenge.id);
  };

  useEffect(() => {
    if (pendingChallengeId !== null) {
      const restoreScroll = () => {
        const savedPosition = scrollPositionRef.current;
        if (savedPosition !== undefined && savedPosition !== null) {
          window.scrollTo({ top: savedPosition, behavior: 'instant' });
          document.documentElement.scrollTop = savedPosition;
          if (document.body) {
            document.body.scrollTop = savedPosition;
          }
        }
      };

      restoreScroll();
      requestAnimationFrame(() => {
        restoreScroll();
        setTimeout(() => restoreScroll(), 100);
      });
    }
  }, [pendingChallengeId]);

  const handleChallengeConfirm = async () => {
    if (!pendingChallengeId || !team || !currentActivityId || !sessionStageId) {
      toast.error('Error: Faltan datos necesarios');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('team', team.id.toString());
      formData.append('activity', currentActivityId.toString());
      formData.append('session_stage', sessionStageId.toString());
      formData.append('challenge', pendingChallengeId.toString());
      if (pendingTopicId) {
        formData.append('topic', pendingTopicId.toString());
      }

      const challengeResponse = await teamActivityProgressAPI.selectChallenge(formData);

      let challenge = challenges.find((c) => c.id === pendingChallengeId);
      
      if (!challenge && challengeResponse?.selected_challenge) {
        challenge = challengeResponse.selected_challenge as Challenge;
      }
      
      if (challenge) {
        // Priorizar URL completa del array sobre ruta relativa del response
        const responseImageUrl = challengeResponse?.selected_challenge?.persona_image_url;
        const arrayImageUrl = challenge.persona_image_url;
        
        let challengeImageUrl = arrayImageUrl; // Por defecto usar la del array
        
        // Si el array tiene URL completa, usarla siempre
        if (arrayImageUrl && (arrayImageUrl.startsWith('http://') || arrayImageUrl.startsWith('https://'))) {
          challengeImageUrl = arrayImageUrl;
        } 
        // Si el response tiene URL completa y el array no, usar la del response
        else if (responseImageUrl && (responseImageUrl.startsWith('http://') || responseImageUrl.startsWith('https://'))) {
          challengeImageUrl = responseImageUrl;
        }
        // Si el response tiene ruta relativa y el array no tiene nada, usar la del response
        else if (responseImageUrl && (!arrayImageUrl || arrayImageUrl === '')) {
          challengeImageUrl = responseImageUrl;
        }
        // Si el array tiene ruta relativa, mantenerla
        else if (arrayImageUrl) {
          challengeImageUrl = arrayImageUrl;
        }
        
        setChallenges(prevChallenges => {
          const updated = prevChallenges.map(c => 
            c.id === challenge.id
              ? { ...c, persona_image_url: challengeImageUrl }
              : c
          );
          return updated;
        });
        
        const newSelectedChallenge = {
          ...challenge,
          persona_image_url: challengeImageUrl
        };
        
        setSelectedChallenge(newSelectedChallenge);
        setPendingChallengeId(null);
        
        if (challengeResponse?.selected_topic) {
          setSelectedTopic(challengeResponse.selected_topic as Topic);
          setPendingTopicId(null);
        } else if (pendingTopicId) {
          const topic = topics.find((t) => t.id === pendingTopicId);
          if (topic) {
            setSelectedTopic(topic);
          }
          setPendingTopicId(null);
        }
        
        toast.success('✓ Desafío y tema confirmados exitosamente');
      } else {
        toast.error('Error: No se pudo encontrar el desafío confirmado');
      }
    } catch (error: any) {
      toast.error('Error al seleccionar desafío: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
    } finally {
      setSubmitting(false);
    }
  };

  const startTimer = async (activityId: number, gameSessionId: number) => {
    if (timerIntervalRef.current) {
      return;
    }
    
    try {
      const timerData = await sessionsAPI.getActivityTimer(gameSessionId);
      
      if (timerData.error || !timerData.timer_duration) {
        return;
      }

      const timerDuration = timerData.timer_duration;
      const startTime = timerData.started_at
        ? new Date(timerData.started_at).getTime()
        : new Date(timerData.current_time).getTime();

      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, timerDuration - elapsed);

      if (remaining <= 0) {
        setTimerRemaining('00:00');
        timeExpiredRef.current = true;
        void advanceActivityOnTimerExpiration(gameSessionId);
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
      // Error starting timer
    }
  };

  useEffect(() => {
    if (gameSessionId && currentStep === 'topic' && topics.length === 0) {
      loadTopics(gameSessionId);
    }
  }, [gameSessionId, currentStep]);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Error al cargar la información del equipo.</p>
          <Button onClick={() => navigate('/tablet/join')}>Volver a Conectar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Fondo animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <motion.div
          animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
          transition={{ duration: 20, repeat: Infinity, repeatType: 'reverse' }}
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '50px 50px' }}
        />
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-30"
              initial={{ x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920), y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080) }}
              animate={{ y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080)], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
            />
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="relative z-0 max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 mb-4 sm:mb-6 flex items-center justify-between flex-wrap gap-4"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-lg"
              style={{ backgroundColor: getTeamColorHex(team.color) }}
            >
              {team.color.charAt(0).toUpperCase()}
            </motion.div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                {personalization?.team_name 
                  ? `Start-up ${personalization.team_name}` 
                  : (team.name?.replace(/^Equipo\s+/i, 'Start-up ') || `Start-up ${team.color}`)
                }
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">Start-up {team.color}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {team && (
              <motion.div
                onClick={() => setShowUBotModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-5 py-2.5 rounded-full font-semibold text-sm sm:text-base flex items-center gap-2 shadow-lg cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setShowUBotModal(true);
                  }
                }}
              >
                <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>U-Bot</span>
              </motion.div>
            )}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-[#093c92] to-blue-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm sm:text-base flex items-center gap-2 shadow-lg"
            >
              <Award className="w-4 h-4 sm:w-5 sm:h-5" /> {team.tokens_total || 0} Tokens
            </motion.div>
          </div>
        </motion.div>

        {/* Contenedor Principal */}
        <div className="relative">
          {/* Temporizador en esquina superior derecha */}
          <div className="absolute top-0 right-0 bg-yellow-50 border-2 border-yellow-300 rounded-lg px-3 py-2 shadow-sm z-10" style={{ isolation: 'isolate' }}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-700" />
              <span className="text-yellow-800 font-semibold text-sm sm:text-base">
                <span className="font-bold">{timerRemaining}</span>
              </span>
            </div>
          </div>
          <AnimatePresence mode="wait">
            {currentStep === 'topic' ? (
              <motion.div
                key="topic"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative z-0 bg-white/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10 lg:p-12 pr-24 sm:pr-32"
              >
                <div className="text-center mb-8 sm:mb-10">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', duration: 0.8 }}
                    className="inline-block mb-5 sm:mb-6"
                  >
                    <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-gradient-to-br from-purple-500 via-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-purple-200/50">
                      <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-white stroke-[2.5]" />
                    </div>
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#093c92] mb-3 drop-shadow-sm"
                  >
                    Selección del Tema
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-gray-600 text-base sm:text-lg md:text-xl font-medium"
                  >
                    Hemos detectado oportunidades en {topics.length} sectores críticos. Decidan su objetivo.
                  </motion.p>
                </div>

                <div className={`grid gap-4 sm:gap-6 mb-6 sm:mb-8 ${
                  topics.length === 3 
                    ? 'grid-cols-1 sm:grid-cols-3' 
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}>
                  {topics.map((topic, index) => {
                    const isSelected = selectedTopic?.id === topic.id;
                    const isPending = pendingTopicId === topic.id;

                    return (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: index * 0.1, type: 'spring', stiffness: 100 }}
                        whileHover={{ scale: 1.05, y: -8 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => !selectedChallenge && !submitting && handleTopicSelect(topic)}
                        className={`h-full flex flex-col p-4 sm:p-6 md:p-8 rounded-2xl cursor-pointer border-3 transition-all text-center relative overflow-hidden ${
                          isSelected
                            ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100 shadow-2xl ring-4 ring-green-300/50'
                            : isPending
                            ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100 shadow-xl ring-4 ring-yellow-300/50'
                            : selectedChallenge
                            ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
                            : 'border-blue-200 bg-white hover:border-blue-400 hover:shadow-2xl hover:ring-4 hover:ring-blue-200/50 active:scale-95 shadow-lg'
                        }`}
                      >
                        {/* Efecto de brillo en hover */}
                        {!isSelected && !selectedChallenge && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity"
                            initial={{ x: '-100%' }}
                            whileHover={{ x: '100%' }}
                            transition={{ duration: 0.6 }}
                          />
                        )}
                        
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: index * 0.1 + 0.2, type: 'spring' }}
                          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-3 sm:mb-4 flex-shrink-0"
                        >
                          {getTopicIcon(topic)}
                        </motion.div>
                        <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-[#093c92] mb-2 sm:mb-3 flex-shrink-0">{topic.name}</h3>
                        {topic.description && (
                          <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-4 flex-1 min-h-[3rem] sm:min-h-[3.5rem] line-clamp-3 leading-relaxed">{topic.description}</p>
                        )}
                        {!topic.description && (
                          <div className="flex-1 min-h-[3rem] sm:min-h-[3.5rem]"></div>
                        )}
                        {!isSelected && !selectedChallenge && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-auto pt-2 flex-shrink-0"
                          >
                            <p className="text-blue-600 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-blue-50 px-3 py-1.5 sm:py-2 rounded-full">
                              [ EXPLORAR TEMA]
                            </p>
                          </motion.div>
                        )}
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 200 }}
                            className="mt-auto pt-2 flex-shrink-0"
                          >
                            <div className="bg-gradient-to-br from-green-500 to-green-600 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto shadow-lg ring-4 ring-green-200/50">
                              <Check className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white stroke-[3]" />
                            </div>
                            <p className="text-green-700 font-bold mt-2 sm:mt-3 text-xs sm:text-sm md:text-base">✓ Confirmado</p>
                          </motion.div>
                        )}
                        {isPending && !isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="mt-auto pt-2 flex-shrink-0"
                          >
                            <p className="text-yellow-700 font-semibold text-xs sm:text-sm bg-yellow-50 px-3 py-1 rounded-full">Vista previa</p>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

            </motion.div>
            ) : (
              <motion.div
                key="challenge"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative z-0 bg-white/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10 lg:p-12 pr-24 sm:pr-32"
                style={{ isolation: 'isolate' }}
              >
              {/* Botón Cambiar Tema en esquina superior izquierda */}
              {!selectedChallenge && (
                <div className="absolute top-0 left-0 z-10 bg-white/90 backdrop-blur-sm px-2 py-1">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCurrentStep('topic');
                      setPendingChallengeId(null);
                      setPendingTopicId(null);
                    }}
                    className="h-auto p-2 hover:bg-gray-100 text-gray-700 font-semibold text-xs sm:text-sm rounded-sm"
                    disabled={submitting}
                    size="sm"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                    Cambiar Tema
                  </Button>
                </div>
              )}

              <div className="relative z-30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                {challenges.map((challenge, index) => {
                  const isSelected = selectedChallenge?.id === challenge.id;
                  const isPending = pendingChallengeId === challenge.id && !selectedChallenge;

                  // Función helper para convertir ruta relativa a URL completa
                  const getImageUrl = (imageSrc: string | undefined): string => {
                    if (!imageSrc) return '';
                    if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
                      return imageSrc;
                    }
                    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
                    const baseUrl = apiBaseUrl.replace('/api', '');
                    return `${baseUrl}${imageSrc.startsWith('/') ? '' : '/'}${imageSrc}`;
                  };

                  // Priorizar la URL del array (tiene URL completa) sobre selectedChallenge (puede tener ruta relativa)
                  // Solo usar selectedChallenge si el array no tiene imagen
                  let challengeImageUrl = challenge.persona_image_url;
                  if (isSelected && selectedChallenge?.persona_image_url) {
                    // Si el array no tiene imagen o tiene ruta relativa, usar selectedChallenge
                    if (!challenge.persona_image_url || (!challenge.persona_image_url.startsWith('http://') && !challenge.persona_image_url.startsWith('https://'))) {
                      challengeImageUrl = selectedChallenge.persona_image_url;
                    }
                  }
                  
                  // Normalizar la URL (convertir ruta relativa a URL completa si es necesario)
                  challengeImageUrl = getImageUrl(challengeImageUrl);

                  // Usar función para obtener icono (maneja "?" de encoding)
                  const icon = getChallengeIcon(challenge);

                  // Colores de gradiente para cada desafío (rotando entre diferentes colores)
                  const gradientColors = [
                    'from-green-400 to-green-600',
                    'from-blue-400 to-blue-600',
                    'from-pink-400 via-purple-500 to-purple-600',
                    'from-yellow-400 to-orange-500',
                    'from-cyan-400 to-blue-500',
                    'from-red-400 to-pink-500',
                  ];
                  const gradientColor = gradientColors[index % gradientColors.length];

                  // Usar datos de persona del modelo
                  const personaName = challenge.persona_name;
                  const personaAge = challenge.persona_age;
                  const personaStory = challenge.persona_story;

                  return (
                    <motion.div
                      key={challenge.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!selectedChallenge) {
                          scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop || window.pageYOffset;
                          handleChallengeSelect(challenge, e);
                        }
                      }}
                      className={`relative z-30 h-full flex flex-col rounded-xl cursor-pointer overflow-hidden transition-all border-4 ${
                        isSelected
                          ? 'ring-4 ring-green-500 shadow-2xl border-green-500'
                          : isPending
                          ? 'ring-4 ring-yellow-400 shadow-xl border-yellow-400'
                          : 'border-blue-300 shadow-xl hover:border-blue-500 hover:shadow-2xl hover:ring-4 hover:ring-blue-200 active:scale-[0.98]'
                      }`}
                    >
                      {/* Top Section - Gradient with Title - FIXED HEIGHT */}
                      <div className={`bg-gradient-to-br ${gradientColor} p-6 text-white flex-shrink-0 h-32 flex flex-col items-center justify-center`}>
                        <h3 className="text-lg font-bold text-center leading-tight flex items-center justify-center">
                          {challenge.title}
                        </h3>
                      </div>

                      {/* Bottom Section - White background with description and persona - Flexible */}
                      <div className="bg-white p-4 flex-1 flex flex-col min-h-0">
                        {/* Description - Always visible */}
                        {challenge.description && (
                          <div className="mb-4">
                            <p className="text-sm text-gray-700 leading-relaxed font-medium">
                              {challenge.description}
                            </p>
                          </div>
                        )}

                        {/* Persona Section - Always visible */}
                        {personaStory && personaName && (
                          <div className="border-t pt-4">
                            <div className="flex items-start gap-3">
                              {challengeImageUrl ? (
                                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden flex-shrink-0 border-3 border-white shadow-lg">
                                    <img 
                                      src={challengeImageUrl} 
                                      alt={personaName}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br ${gradientColor} flex items-center justify-center flex-shrink-0`}>
                                    <span className="text-white text-2xl sm:text-3xl">👤</span>
                                  </div>
                                )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-bold text-gray-900 text-base">
                                    {personaName}
                                  </span>
                                  {personaAge && (
                                    <span className="text-sm text-gray-600 font-medium">
                                      {personaAge} años
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 italic leading-relaxed">
                                  "{personaStory}"
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Espaciado flexible para igualar alturas - después de la historia de usuario */}
                        <div className="flex-1"></div>

                        {/* Selection Status - Fixed at bottom */}
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="mt-4 pt-4 border-t text-center"
                          >
                            <div className="bg-green-500 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                              <Check className="w-5 h-5 text-white" />
                            </div>
                            <p className="text-green-700 font-semibold text-sm">Confirmado</p>
                          </motion.div>
                        )}
                        {isPending && !selectedChallenge && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="mt-4 pt-4 border-t text-center"
                          >
                            <p className="text-yellow-700 font-semibold text-sm flex items-center justify-center gap-1">
                              <span>👆</span> Toca "Confirmar" abajo
                            </p>
                          </motion.div>
                        )}
                        {!isPending && !isSelected && !selectedChallenge && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 pt-4 border-t text-center"
                          >
                            <p className="text-blue-600 font-semibold text-sm flex items-center justify-center gap-1">
                              <span>👆</span> Toca para seleccionar
                            </p>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {pendingChallengeId && !selectedChallenge && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                  onAnimationStart={() => {
                    const savedPosition = scrollPositionRef.current;
                    if (savedPosition !== undefined && savedPosition !== null) {
                      window.scrollTo({ top: savedPosition, behavior: 'instant' });
                      document.documentElement.scrollTop = savedPosition;
                      if (document.body) {
                        document.body.scrollTop = savedPosition;
                      }
                    }
                  }}
                  onAnimationComplete={() => {
                    const savedPosition = scrollPositionRef.current;
                    if (savedPosition !== undefined && savedPosition !== null) {
                      requestAnimationFrame(() => {
                        window.scrollTo({ top: savedPosition, behavior: 'instant' });
                        document.documentElement.scrollTop = savedPosition;
                        if (document.body) {
                          document.body.scrollTop = savedPosition;
                        }
                      });
                    }
                  }}
                >
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleChallengeConfirm();
                    }}
                    disabled={submitting}
                    className="w-full sm:w-auto px-8 sm:px-12 py-4 sm:py-6 text-base sm:text-lg font-semibold bg-gradient-to-r from-[#f757ac] to-pink-600 hover:from-[#e6498a] hover:to-[#d13a7a] text-white rounded-full shadow-2xl"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        Confirmar Desafío
                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 ml-2" />
                      </>
                    )}
                  </Button>
                </motion.div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {/* Modal de U-Bot para Etapa 2 */}
      {team && (
        <UBotEtapa2Modal
          isOpen={showUBotModal}
          onClose={() => setShowUBotModal(false)}
          onContinuar={() => setShowUBotModal(false)}
          teamColor={team.color}
        />
      )}

      {/* Música de fondo */}
    </div>
  );
}

