import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Loader2,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Clock,
  Award,
  Info,
  Camera,
  Box,
  Bot,
  Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
import { UBotPrototipoModal } from '@/components/UBotPrototipoModal';
import {
  sessionsAPI,
  challengesAPI,
  teamActivityProgressAPI,
  tabletConnectionsAPI
} from '@/services';
import { getResultsRedirectUrl } from '@/utils/tabletResultsRedirect';
import { advanceActivityOnTimerExpiration } from '@/utils/timerAutoAdvance';
import { toast } from 'sonner';

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total?: number;
}

export function TabletPrototipo() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prototypeImageUrl, setPrototypeImageUrl] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<number | null>(null);
  const [currentSessionStageId, setCurrentSessionStageId] = useState<number | null>(null);
  const [showEtapaIntro, setShowEtapaIntro] = useState(false);
  const [showUBotModal, setShowUBotModal] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartTimeRef = useRef<number | null>(null);
  const timerDurationRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) {
      navigate('/tablet/join');
      return;
    }
    setConnectionId(connId);
    loadGameState(connId);

    // Polling cada 3 segundos
    intervalRef.current = setInterval(() => {
      loadGameState(connId);
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (timerSyncIntervalRef.current) {
        clearInterval(timerSyncIntervalRef.current);
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
          return;
        }
        throw error;
      }
      setTeam(statusData.team);
      setGameSessionId(statusData.game_session.id);

      // Verificar estado del juego (usar lobby en lugar de getById para evitar problemas de autenticación)
      const lobbyData = await sessionsAPI.getLobby(statusData.game_session.id);
      const gameData = lobbyData.game_session;
      const sessionId = statusData.game_session.id;

      const resultsUrl = getResultsRedirectUrl(gameData, connId);
      if (resultsUrl) { window.location.href = resultsUrl; return; }

      // Mostrar modal de U-Bot si no se ha visto
      if (gameData.current_stage_number === 3) {
        const ubotKey = `ubot_prototipo_${sessionId}`;
        const hasSeenUBot = localStorage.getItem(ubotKey);
        if (!hasSeenUBot) {
          setTimeout(() => {
            setShowUBotModal(true);
            localStorage.setItem(ubotKey, 'true');
          }, 500);
        }
      }

      // Si la sesión finaliza, redirigir al join (excepto en reflexión)
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

      const currentActivityId = gameData.current_activity;
      const currentActivityName = gameData.current_activity_name?.toLowerCase() || '';
      const currentStageNumber = gameData.current_stage_number || 1;

      // Si la etapa terminó, redirigir a resultados
      if (currentStageNumber === 3 && (!currentActivityName || !currentActivityId)) {
        window.location.href = `/tablet/etapa3/resultados/?connection_id=${connId}`;
        return;
      }

      // Si el profesor avanzó a otra etapa
      if (currentStageNumber > 3) {
        const n = currentActivityName;
        let destBase = '';
        if (currentStageNumber === 4) {
          destBase = n.includes('presentaci') ? '/tablet/etapa4/presentacion-pitch/' : '/tablet/etapa4/formulario-pitch/';
        }
        if (destBase) {
          window.location.href = `/tablet/etapa-warp?stage=${currentStageNumber}&redirect=${encodeURIComponent(destBase)}&connection_id=${connId}`;
        } else {
          window.location.href = `/tablet/lobby?connection_id=${connId}`;
        }
        return;
      }

      // Si hay una actividad de la etapa 3 que no es prototipo, redirigir
      if (currentStageNumber === 3 && currentActivityName && !currentActivityName.includes('prototipo')) {
        window.location.href = `/tablet/etapa3/resultados/?connection_id=${connId}`;
        return;
      }

      setCurrentActivityId(currentActivityId);

      // Obtener session_stage de Etapa 3
      if (!currentSessionStageId && currentActivityId) {
        const stagesData = await sessionsAPI.getSessionStages(statusData.game_session.id);
        const stages = Array.isArray(stagesData) ? stagesData : [stagesData];
        const stage3 = stages.find((s: any) => s.stage_number === 3);
        if (stage3) {
          setCurrentSessionStageId(stage3.id);
        }
      }

      // Cargar estado del prototipo
      if (currentActivityId && currentSessionStageId && statusData.team.id) {
        await loadPrototypeStatus(statusData.game_session.id, statusData.team.id, currentActivityId, currentSessionStageId);
        await startTimer(currentActivityId, statusData.game_session.id);
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading game state:', error);
      toast.error('Error de conexión: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
      setLoading(false);
    }
  };

  const loadPrototypeStatus = async (gameSessionId: number, teamId: number, activityId: number, sessionStageId: number) => {
    try {
      const progressList = await teamActivityProgressAPI.list({
        team: teamId,
        activity: activityId,
        session_stage: sessionStageId
      });
      const progressArray = Array.isArray(progressList) ? progressList : [progressList];
      const progress = progressArray[0];

      if (progress && progress.prototype_image_url) {
        // Construir URL completa si es relativa
        let imageUrl = progress.prototype_image_url;
        if (imageUrl.startsWith('/')) {
          const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
          const baseUrl = apiBaseUrl.replace('/api', '');
          imageUrl = `${baseUrl}${imageUrl}`;
        }
        setPrototypeImageUrl(imageUrl);
        console.log('📷 Prototipo cargado:', imageUrl);
      }
    } catch (error) {
      console.error('Error loading prototype status:', error);
    }
  };

  const syncTimer = async (gameSessionId: number) => {
    try {
      const data = await sessionsAPI.getActivityTimer(gameSessionId);

      if (data.started_at && data.timer_duration) {
        timerStartTimeRef.current = new Date(data.started_at).getTime();
        timerDurationRef.current = data.timer_duration;
      }
    } catch (error) {
      console.error('Error sincronizando timer:', error);
    }
  };

  const startTimer = async (activityId: number, gameSessionId: number) => {
    try {
      await syncTimer(gameSessionId);

      if (timerSyncIntervalRef.current) {
        clearInterval(timerSyncIntervalRef.current);
      }

      timerSyncIntervalRef.current = setInterval(() => {
        syncTimer(gameSessionId);
      }, 5000);

      const updateTimer = () => {
        if (!timerStartTimeRef.current || !timerDurationRef.current) return;

        const now = Date.now();
        const elapsed = Math.floor((now - timerStartTimeRef.current) / 1000);
        const remaining = Math.max(0, timerDurationRef.current - elapsed);

        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        setTimerRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

        if (remaining === 0 && timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          void advanceActivityOnTimerExpiration(gameSessionId);
        }
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen es demasiado grande. Máximo 5MB');
      return;
    }

    setSelectedImage(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const cancelImageSelection = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadPrototype = async () => {
    if (!selectedImage || !team || !currentActivityId || !currentSessionStageId) {
      toast.error('Faltan datos necesarios para subir el prototipo');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('team', team.id.toString());
      formData.append('activity', currentActivityId.toString());
      formData.append('session_stage', currentSessionStageId.toString());
      formData.append('image', selectedImage);

      const response = await teamActivityProgressAPI.uploadPrototype(formData);

      if (response.prototype_image_url) {
        // Construir URL completa si es relativa
        let imageUrl = response.prototype_image_url;
        if (imageUrl.startsWith('/')) {
          const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
          const baseUrl = apiBaseUrl.replace('/api', '');
          imageUrl = `${baseUrl}${imageUrl}`;
        }
        setPrototypeImageUrl(imageUrl);
        setSelectedImage(null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        toast.success('✓ Prototipo subido exitosamente');
        
        // Recargar el estado del prototipo para asegurar sincronización
        if (currentActivityId && currentSessionStageId && team) {
          setTimeout(() => {
            loadPrototypeStatus(gameSessionId || 0, team.id, currentActivityId, currentSessionStageId);
          }, 500);
        }
      }
    } catch (error: any) {
      console.error('Error uploading prototype:', error);
      toast.error('Error al subir prototipo: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
    } finally {
      setUploading(false);
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
          <Button onClick={() => navigate('/tablet/join')}>Volver</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      {/* Fondo animado igual que Panel */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <motion.div
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
        
        {/* Efectos de partículas adicionales */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-30"
              initial={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
                y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080),
              }}
              animate={{
                y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080)],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 p-3 sm:p-4">
        <div className="max-w-6xl mx-auto relative z-20">
          {/* Header Mejorado */}
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
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">{team.name}</h3>
                <p className="text-xs sm:text-sm text-gray-600">Equipo {team.color}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {team && (
                <motion.button
                  onClick={() => setShowUBotModal(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-5 py-2.5 rounded-full font-semibold text-sm sm:text-base flex items-center gap-2 shadow-lg"
                >
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>U-Bot</span>
                </motion.button>
              )}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-[#093c92] to-blue-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm sm:text-base flex items-center gap-2 shadow-lg"
              >
                <Coins className="w-4 h-4 sm:w-5 sm:h-5" /> {team.tokens_total || 0} Tokens
              </motion.div>
            </div>
          </motion.div>

          {/* Contenedor Principal Mejorado */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-xl p-4 sm:p-6 relative"
          >
            {/* Temporizador en esquina superior derecha */}
            {timerRemaining !== '--:--' && (
              <div className="absolute top-0 right-0 bg-yellow-50 border-2 border-yellow-300 rounded-lg px-3 py-2 shadow-sm z-10" style={{ isolation: 'isolate' }}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-700" />
                  <span className="text-yellow-800 font-semibold text-sm sm:text-base">
                    <span className="font-bold">{timerRemaining}</span>
                  </span>
                </div>
              </div>
            )}
            {/* Título y Descripción */}
            <div className="mb-4 sm:mb-5 pr-24 sm:pr-32">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#093c92] to-[#f757ac] rounded-lg flex items-center justify-center shadow-md">
                  <Box className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#093c92]">
                  Registro de Prototipo (MVP)
                </h1>
              </div>
              <p className="text-gray-600 text-sm sm:text-base">
                Sube la evidencia de tu solución física.
              </p>
            </div>

            {/* Instrucciones */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-blue-50 border-2 border-blue-300 p-3 sm:p-4 rounded-lg mb-3 sm:mb-4"
            >
              <h3 className="text-base sm:text-lg font-bold text-blue-800 mb-2 flex items-center gap-2">
                <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                Instrucciones:
              </h3>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-700 text-xs sm:text-sm">
                <li>Construye el modelo de tu idea.</li>
                <li>Toma una foto clara.</li>
                <li>Confirma el envío.</li>
              </ol>
            </motion.div>

            {/* Prototipo ya subido */}
            {prototypeImageUrl && !selectedImage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-50 border-2 border-green-400 rounded-lg p-4 sm:p-5 mb-3 sm:mb-4 text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  <p className="text-green-800 font-semibold text-base sm:text-lg">✓ Prototipo subido exitosamente</p>
                </div>
                <img
                  src={prototypeImageUrl}
                  alt="Prototipo subido"
                  className="max-w-full max-h-80 sm:max-h-96 mx-auto rounded-lg shadow-lg border-2 border-green-300"
                  onError={(e) => {
                    console.error('Error cargando imagen:', prototypeImageUrl);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    toast.error('Error al cargar la imagen del prototipo');
                  }}
                  onLoad={() => {
                    console.log('✅ Imagen cargada exitosamente:', prototypeImageUrl);
                  }}
                />
              </motion.div>
            )}

            {/* Contenedor para subir prototipo */}
            {!prototypeImageUrl && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 sm:p-12 md:p-16 text-center mb-3 sm:mb-4 min-h-[300px] sm:min-h-[400px] flex flex-col items-center justify-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {!previewUrl ? (
                  <div className="w-full flex flex-col items-center justify-center">
                    <Upload className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 text-gray-400 mx-auto mb-6 sm:mb-8" />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      size="lg"
                      className="bg-[#093c92] hover:bg-[#082d6e] text-white px-8 sm:px-12 md:px-16 py-5 sm:py-6 md:py-7 text-lg sm:text-xl md:text-2xl font-semibold w-full max-w-md"
                    >
                      <Camera className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 mr-3" />
                      [ TOMAR FOTO ]
                    </Button>
                  </div>
                ) : (
                  <div>
                    <img
                      src={previewUrl}
                      alt="Vista previa"
                      className="max-w-full max-h-80 sm:max-h-96 mx-auto rounded-lg shadow-lg mb-4 sm:mb-6 border-2 border-gray-200"
                    />
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button
                        onClick={cancelImageSelection}
                        variant="destructive"
                        size="lg"
                        className="px-5 sm:px-6 py-3 text-sm sm:text-base"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button
                        onClick={uploadPrototype}
                        disabled={uploading}
                        size="lg"
                        className="bg-green-600 hover:bg-green-700 text-white px-5 sm:px-6 py-3 text-sm sm:text-base"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Subiendo...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            [ SUBIR FOTO ]
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Modal de U-Bot */}
      {team && (
        <UBotPrototipoModal
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

