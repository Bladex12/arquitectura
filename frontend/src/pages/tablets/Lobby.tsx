import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Tablet,
  Loader2,
  Gamepad2,
  CheckCircle2,
  XCircle,
  Clock,
  Rocket,
  Briefcase,
  Map,
  Cog,
  Bot,
} from 'lucide-react';
import { sessionsAPI, tabletConnectionsAPI } from '@/services';
import { UBotWelcomeModal } from '@/components/UBotWelcomeModal';
import { getResultsRedirectUrl } from '@/utils/tabletResultsRedirect';
import { toast } from 'sonner';

interface Student {
  id: number;
  full_name: string;
  email?: string;
}

interface Team {
  id: number;
  name: string;
  color: string;
  students_count: number;
  students?: Student[];
  tokens_total?: number;
}

interface TabletConnection {
  id: number;
  team: number;
  is_connected: boolean;
}

interface LobbyData {
  game_session: {
    id: number;
    room_code: string;
    status: string;
  };
  teams: Team[];
  tablet_connections: TabletConnection[];
  all_teams_connected: boolean;
  connected_teams: number;
  total_teams: number;
}

export function TabletLobby() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [lobbyData, setLobbyData] = useState<LobbyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [loadingDots, setLoadingDots] = useState('');
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [currentMessage, setCurrentMessage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showUBotModal, setShowUBotModal] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadingMessages = [
    'Preparando tu misión',
    'Cargando recursos emprendedores',
    'Activando habilidades de innovación',
    'Iniciando el juego'
  ];

  // Obtener connection_id de la URL o localStorage (asegurar que sea string)
  const connectionId = String(searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId') || '').trim();

  useEffect(() => {
    if (!connectionId) {
      navigate('/tablet/join');
      return;
    }

    const loadInitialData = async () => {
      try {
        // Obtener estado de la conexión de la tablet (con reintento si es 404)
        let statusData;
        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries) {
          try {
            statusData = await tabletConnectionsAPI.getStatus(connectionId);
            break; // Si funciona, salir del loop
          } catch (error: any) {
            if (error.response?.status === 404 && retries < maxRetries - 1) {
              // Si es 404 y aún hay reintentos, esperar un poco y reintentar
              retries++;
              await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
              continue;
            } else if (error.response?.status === 404) {
              // Si es 404 y no hay más reintentos, mostrar error
              toast.error('Conexión no encontrada. Por favor reconecta.');
              setTimeout(() => {
                navigate('/tablet/join');
              }, 3000);
              setLoading(false);
              return;
            } else {
              // Otro tipo de error, re-lanzar
              throw error;
            }
          }
        }

        if (!statusData || !statusData.team || !statusData.game_session) {
          toast.error('Conexión no válida');
          navigate('/tablet/join');
          setLoading(false);
          return;
        }

        setMyTeamId(statusData.team.id);
        
        // Cargar lobby inicial (esto también carga el gameData)
        await loadLobby();

        // Obtener gameData para guardar valores iniciales usando el endpoint lobby que ya funciona
        try {
          // Usar el endpoint lobby que ya sabemos que funciona sin autenticación
          const lobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
          const gameData = lobbyData.game_session;
          
          // Guardar valores iniciales para comparación
          const initialActivityId = gameData.current_activity;
          const initialActivityName = gameData.current_activity_name || '';
          const initialSessionStageId = gameData.current_session_stage;
          const initialStageNumber = gameData.current_stage_number;

          // Verificar actividad y etapa periódicamente (COMO EN ETAPA 2)
          activityCheckIntervalRef.current = setInterval(async () => {
            try {
              // Usar lobby en lugar de getById para evitar problemas de autenticación
              const updatedLobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
              const updatedSession = updatedLobbyData.game_session;

              const resultsUrl = getResultsRedirectUrl(updatedSession, String(connectionId));
              if (resultsUrl) { window.location.href = resultsUrl; return; }

              // Verificar si cambió la actividad o etapa
              const activityChanged = updatedSession.current_activity !== initialActivityId || 
                                     (updatedSession.current_activity_name || '') !== initialActivityName;
              const stageChanged = updatedSession.current_stage_number !== initialStageNumber;
              
              if (activityChanged || stageChanged) {
                // Limpiar intervalos
                if (activityCheckIntervalRef.current) {
                  clearInterval(activityCheckIntervalRef.current);
                  activityCheckIntervalRef.current = null;
                }
                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = null;
                }

                if (stageChanged && (updatedSession.current_stage_number ?? 0) > 0) {
                  // Nueva etapa → animación warp + landing
                  const newStage = updatedSession.current_stage_number!;
                  const destBase = buildStageDestinationUrl(newStage, updatedSession.current_activity_name ?? '');
                  if (destBase) {
                    window.location.href = `/tablet/etapa-warp?stage=${newStage}&redirect=${encodeURIComponent(destBase)}&connection_id=${connectionId}`;
                  } else {
                    await determineAndRedirectToActivity(statusData.game_session.id);
                  }
                } else {
                  // Misma etapa, actividad distinta → navegación directa
                  await determineAndRedirectToActivity(statusData.game_session.id);
                }
              }
            } catch (error) {
              console.error('Error verificando actividad:', error);
            }
          }, 3000); // Verificar cada 3 segundos
        } catch (error) {
          console.error('Error obteniendo gameData inicial:', error);
          // Continuar sin la verificación de cambios si falla
        }

      } catch (error: any) {
        console.error('Error loading initial data:', error);
        const errorMessage = error.response?.data?.error || error.message || 'Error desconocido';
        toast.error('Error de conexión: ' + errorMessage);
        setLoading(false);
      }
    };

    loadInitialData();

    // Auto-refresh cada 3 segundos (mantener para actualizar lobby)
    intervalRef.current = setInterval(() => {
      loadLobby();
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (activityCheckIntervalRef.current) {
        clearInterval(activityCheckIntervalRef.current);
      }
    };
  }, [connectionId, navigate]);

  // Animación de puntos suspensivos
  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setLoadingDots((prev) => {
        if (prev === '') return '.';
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '';
      });
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  // Rotación de mensajes temáticos (solo cuando está en pantalla de carga)
  useEffect(() => {
    if (!showLoadingScreen) {
      setCurrentMessage(0);
      return;
    }
    
    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);

    return () => clearInterval(messageInterval);
  }, [showLoadingScreen, loadingMessages.length]);

  // Animación de progreso (solo cuando está en pantalla de carga)
  useEffect(() => {
    if (!showLoadingScreen) {
      // Limpiar intervalo si existe
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setProgress(0);
      return;
    }
    
    // CRÍTICO: Solo inicializar progreso si no hay un intervalo activo
    // Esto evita que se reinicie el progreso cuando loadLobby() se ejecuta periódicamente
    if (!progressIntervalRef.current) {
      setProgress(0);
      
      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return 95;
          return prev + Math.random() * 3;
        });
      }, 200);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [showLoadingScreen]);

  const loadLobby = async () => {
    if (!connectionId) return;

    try {
      // Obtener estado de la conexión de la tablet
      let statusData;
      try {
        statusData = await tabletConnectionsAPI.getStatus(connectionId);
      } catch (error: any) {
        if (error.response?.status === 404) {
          toast.error('Conexión no encontrada. Por favor reconecta.');
          setTimeout(() => {
            navigate('/tablet/join');
          }, 3000);
        }
        return;
      }

      setMyTeamId(statusData.team.id);

      // Obtener información completa del lobby
      let data: LobbyData;
      try {
        data = await sessionsAPI.getLobby(statusData.game_session.id);
      } catch (error: any) {
        if (error.response?.status === 403) {
          toast.error('La sesión ya ha finalizado. No puedes acceder al lobby.');
          setTimeout(() => {
            navigate('/tablet/join');
          }, 3000);
        } else {
          toast.error('Error al cargar el lobby');
        }
        return;
      }

      // Si el juego está corriendo, redirigir directamente (sin pantalla de carga)
      // La pantalla de carga aparecerá cuando se vaya del Instructivo a Personalización
      if (data.game_session.status === 'running' && !gameStarted) {
        setGameStarted(true);
        // Redirigir directamente sin pantalla de carga
        await determineAndRedirectToActivity(data.game_session.id);
        return;
      }

      setLobbyData(data);
      setLoading(false);
      
      // Mostrar modal de U-Bot cuando se carga el lobby por primera vez
      // Solo si hay equipos y el juego aún no ha comenzado
      if (data.teams && data.teams.length > 0 && data.game_session.status === 'lobby') {
        // Verificar si ya se mostró el modal antes (usando localStorage)
        const hasSeenModal = localStorage.getItem(`ubot_modal_${connectionId}`);
        if (!hasSeenModal) {
          setShowUBotModal(true);
          localStorage.setItem(`ubot_modal_${connectionId}`, 'true');
        }
      }
    } catch (error: any) {
      console.error('Error loading lobby:', error);
      toast.error('Error de conexión: ' + (error.message || 'Error desconocido'));
      setLoading(false);
    }
  };

  const buildStageDestinationUrl = (stageNumber: number | null, activityName: string): string => {
    const n = activityName.toLowerCase().trim();

    if (!stageNumber && !n) return `/tablet/etapa1/video-institucional/`;

    if (!stageNumber) {
      if (n.includes('instructivo') || n.includes('instrucciones')) return `/tablet/etapa1/instructivo`;
      if (n.includes('video') || n.includes('institucional')) return `/tablet/etapa1/video-institucional/`;
      return '';
    }

    if (!n) {
      return `/tablet/etapa${stageNumber}/resultados/`;
    }

    if (stageNumber === 1) {
      if (n.includes('video') || n.includes('institucional')) return `/tablet/etapa1/video-institucional/`;
      if (n.includes('instructivo') || n.includes('instrucciones')) return `/tablet/etapa1/instructivo`;
      if (n.includes('personaliz')) return `/tablet/loading?redirect=/tablet/etapa1/personalizacion`;
      if (n.includes('presentaci')) return `/tablet/etapa1/presentacion/`;
    } else if (stageNumber === 2) {
      if (n.includes('tema') || n.includes('seleccionar') || n.includes('desafio') || n.includes('desafío')) return `/tablet/etapa2/seleccionar-tema/`;
      if (n.includes('bubble') || n.includes('mapa')) return `/tablet/etapa2/bubble-map/`;
    } else if (stageNumber === 3) {
      if (n.includes('prototipo') || n.includes('lego')) return `/tablet/etapa3/prototipo/`;
      return `/tablet/etapa3/resultados/`;
    } else if (stageNumber === 4) {
      if (n.includes('presentacion') || n.includes('presentación')) return `/tablet/etapa4/presentacion-pitch/`;
      if (n.includes('formulario') || n.includes('formul')) return `/tablet/etapa4/formulario-pitch/`;
      if (n.includes('pitch')) return `/tablet/etapa4/formulario-pitch/`;
    }

    return '';
  };

  const determineAndRedirectToActivity = async (gameSessionId: number) => {
    try {
      const lobbyData = await sessionsAPI.getLobby(gameSessionId);
      const gameData = lobbyData.game_session;
      const currentActivityName = gameData.current_activity_name ?? '';
      const currentActivityId = gameData.current_activity;
      const currentStageNumber = gameData.current_stage_number;

      if (!currentStageNumber && !currentActivityName) {
        window.location.href = `/tablet/etapa1/video-institucional/?connection_id=${connectionId}`;
        return;
      }

      if (!currentActivityName || !currentActivityId) {
        const stage = currentStageNumber ?? 1;
        window.location.href = `/tablet/etapa${stage}/resultados/?connection_id=${connectionId}`;
        return;
      }

      const destBase = buildStageDestinationUrl(currentStageNumber, currentActivityName);
      if (destBase) {
        const sep = destBase.includes('?') ? '&' : '?';
        const redirectUrl = `${destBase}${sep}connection_id=${connectionId}`;
        console.log(`🔄 Redirigiendo a: ${redirectUrl} (Etapa ${currentStageNumber}, Actividad: ${currentActivityName})`);
        window.location.href = redirectUrl;
      } else {
        console.warn(`⚠️ No se encontró redirección para Etapa ${currentStageNumber}, Actividad: ${currentActivityName}`);
      }
    } catch (error: any) {
      console.error('Error determining activity:', error);
      toast.error('Error al determinar actividad: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
    }
  };

  const getTeamColorHex = (color: string) => {
    const colorMap: Record<string, string> = {
      Azul:     '#3B82F6',
      Rojo:     '#EF4444',
      Verde:    '#10B981',
      Amarillo: '#F59E0B',
      Morado:   '#8B5CF6',
      Naranja:  '#F97316',
      Rosa:     '#EC4899',
      Cian:     '#06B6D4',
      Gris:     '#6B7280',
      Marrón:   '#795548',
    };
    return colorMap[color] || '#667eea';
  };

  const getShortName = (fullName: string) => {
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    let lastName = '';
    if (nameParts.length === 2) {
      lastName = nameParts[1];
    } else if (nameParts.length >= 3) {
      lastName = nameParts[nameParts.length - 2];
    }
    return lastName ? `${firstName} ${lastName}`.trim() : firstName || fullName;
  };

  const getInitials = (fullName: string) => {
    const nameParts = fullName.trim().split(/\s+/);
    const firstInitial = nameParts[0]?.[0]?.toUpperCase() || '';
    const lastInitial = nameParts[nameParts.length - 1]?.[0]?.toUpperCase() || '';
    return firstInitial + (lastInitial && lastInitial !== firstInitial ? lastInitial : '');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!lobbyData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="text-center bg-white rounded-3xl shadow-sm p-8 max-w-sm mx-4">
          <p className="text-lg font-semibold text-slate-700 mb-4">Error al cargar el lobby</p>
          <button
            onClick={() => navigate('/tablet/join')}
            className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-colors"
          >
            Volver a Conectar
          </button>
        </div>
      </div>
    );
  }

  const { game_session, teams, tablet_connections } = lobbyData;
  const myTeam = teams.find(t => t.id === myTeamId);

  // Permitir ver la pantalla de carga con parámetro ?loading=true en la URL
  const urlParams = new URLSearchParams(window.location.search);
  const forceLoading = urlParams.get('loading') === 'true';

  // Pantalla de carga cuando el juego está iniciando
  if (showLoadingScreen || forceLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden flex items-center justify-center">
        {/* Fondo animado igual que Panel.tsx */}
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

        {/* Logo en esquina superior derecha - Responsivo y minimalista */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 overflow-hidden opacity-80"
          style={{ height: 'clamp(50px, 6vw, 100px)', width: 'auto' }}
        >
          <img
            src="/images/UDD-negro.png"
            alt="Logo UDD"
            className="h-full w-auto object-contain drop-shadow-lg"
          />
        </motion.div>

        {/* Contenedor principal - Centrado y optimizado */}
        <div className="relative z-10 flex flex-col items-center justify-center px-4 min-h-[60vh] max-w-4xl mx-auto">
          {/* Título del juego - Foco principal */}
          <motion.h1
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-4xl sm:text-5xl md:text-6xl font-black text-[#f757ac] mb-8 drop-shadow-2xl text-center"
            style={{ 
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.02em',
              textShadow: '0 4px 20px rgba(247, 87, 172, 0.4), 0 0 40px rgba(247, 87, 172, 0.2)'
            }}
          >
            Misión Emprende
          </motion.h1>

          {/* Íconos temáticos animados */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex items-center gap-4 sm:gap-6 mb-8"
          >
            {[
              { Icon: Rocket, delay: 0 },
              { Icon: Briefcase, delay: 0.1 },
              { Icon: Map, delay: 0.2 },
              { Icon: Cog, delay: 0.3 }
            ].map(({ Icon, delay }, index) => (
              <motion.div
                key={index}
                initial={{ y: 0, opacity: 0 }}
                animate={{ 
                  y: [0, -10, 0],
                  opacity: 1
                }}
                transition={{
                  y: {
                    duration: 2,
                    repeat: Infinity,
                    delay: delay,
                    ease: 'easeInOut'
                  },
                  opacity: { duration: 0.5, delay: delay + 0.4 }
                }}
                className="text-[#f757ac] opacity-60"
              >
                <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
              </motion.div>
            ))}
          </motion.div>

          {/* Mensaje de carga temático - Rotativo */}
          <motion.div
            key={currentMessage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <h2 
              className="text-lg sm:text-xl md:text-2xl font-semibold text-white text-center px-4"
              style={{ 
                textShadow: '0 0 20px rgba(247, 87, 172, 0.8), 0 0 40px rgba(247, 87, 172, 0.5), 0 2px 10px rgba(0, 0, 0, 0.3)',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              {loadingMessages[currentMessage]}
              <span className="inline-block w-8 text-left">{loadingDots}</span>
            </h2>
          </motion.div>

          {/* Barra de progreso animada */}
          <div className="w-full max-w-md px-4 mb-4">
            <div className="relative h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-[#f757ac] via-[#e83e8c] to-[#f757ac] rounded-full relative overflow-hidden"
                style={{
                  boxShadow: '0 0 20px rgba(247, 87, 172, 0.6)'
                }}
              >
                {/* Efecto de brillo animado */}
                <motion.div
                  animate={{
                    x: ['-100%', '200%']
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear'
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                />
              </motion.div>
            </div>
            <div className="text-center mt-2">
              <span className="text-xs sm:text-sm text-white/70 font-medium">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="max-w-3xl mx-auto p-4 sm:p-6">

        {/* ── Header card ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 mb-5"
        >
          {/* Color stripe */}
          {myTeam && (
            <div
              className="h-1 w-full rounded-full mb-5"
              style={{ backgroundColor: getTeamColorHex(myTeam.color) }}
            />
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">
                Sala {game_session.room_code}
              </p>
              <h1
                className="text-2xl sm:text-3xl font-black text-slate-900"
                style={{ fontFamily: 'Unbounded, sans-serif' }}
              >
                Centro de Mando
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {myTeam && (
                <>
                  {/* My team pill */}
                  <div
                    className="px-4 py-2 rounded-xl text-white text-sm font-bold shadow-sm"
                    style={{ backgroundColor: getTeamColorHex(myTeam.color) }}
                  >
                    {myTeam.name}
                  </div>
                  {/* U-Bot button */}
                  <button
                    onClick={() => setShowUBotModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 text-sm font-bold hover:opacity-90 transition-opacity"
                    title="Ver mensaje de U-Bot"
                  >
                    <Bot className="w-4 h-4" />
                    <span className="hidden sm:inline">U-Bot</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sync alert */}
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
            <p className="text-sm font-medium text-blue-700">
              Sincronizando sistemas... Esperando autorización de lanzamiento{loadingDots}
            </p>
          </div>
        </motion.div>

        {/* ── Team cards ── */}
        <div className="bg-white rounded-3xl shadow-sm p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">
            Escuadrones Activos ({teams.length})
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {[...teams]
              .sort((a, b) => {
                if (a.id === myTeamId) return -1;
                if (b.id === myTeamId) return 1;
                return 0;
              })
              .map((team, index) => {
                const tabletConnection = tablet_connections.find((tc) => tc.team === team.id);
                const isConnected = tabletConnection?.is_connected || false;
                const isMyTeam = team.id === myTeamId;
                const teamColorHex = getTeamColorHex(team.color);

                return (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.07 }}
                    className="rounded-2xl border border-slate-100 p-4 border-l-4"
                    style={{
                      borderLeftColor: teamColorHex,
                      boxShadow: isMyTeam ? `0 0 0 2px ${teamColorHex}40` : undefined,
                    }}
                  >
                    {/* Team header */}
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="px-3 py-1 rounded-full text-white text-xs font-bold"
                        style={{ backgroundColor: teamColorHex }}
                      >
                        {team.name}
                      </div>

                      {/* Connection status pill */}
                      {isConnected ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>En Línea</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Offline</span>
                        </div>
                      )}
                    </div>

                    {/* Student list */}
                    <div className="space-y-1.5">
                      {team.students && team.students.length > 0 ? (
                        team.students.map((student) => (
                          <div
                            key={student.id}
                            className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl"
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                              style={{ backgroundColor: teamColorHex }}
                            >
                              {getInitials(student.full_name)}
                            </div>
                            <span className="text-xs text-slate-700 font-medium truncate">
                              {getShortName(student.full_name)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-3 italic">
                          Sin estudiantes asignados
                        </p>
                      )}
                    </div>

                    {isMyTeam && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-center"
                          style={{ color: teamColorHex }}>
                          Tu Equipo
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Modal de U-Bot */}
      {myTeam && (
        <UBotWelcomeModal
          isOpen={showUBotModal}
          onClose={() => setShowUBotModal(false)}
          startupName={myTeam.name}
          teamColor={myTeam.color}
        />
      )}
    </div>
  );
}


