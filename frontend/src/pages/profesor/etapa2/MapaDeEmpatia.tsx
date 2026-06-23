import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Loader2, Clock, ArrowRight, Users, CheckCircle2, X, Lightbulb, XCircle, UserCircle, Eye, Ear, Heart, MessageCircle, Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GroupBadge } from '@/components/GroupBadge';
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
import { sessionsAPI, teamBubbleMapsAPI } from '@/services';
import { toast } from 'sonner';
import { isDevMode } from '@/utils/devMode';

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total: number;
}

interface EmpathyItem {
  id: number;
  text: string;
}

interface EmpathyMapData {
  central: {
    personName: string;
    profileImage?: string;
  };
  quadrants: {
    ver: EmpathyItem[];
    oir: EmpathyItem[];
    pensar: EmpathyItem[];
    decir: EmpathyItem[];
  };
}

interface EmpathyMap {
  id: number;
  team: number;
  map_data: EmpathyMapData | {
    nodes?: any[];
    edges?: any[];
  };
  created_at: string;
  updated_at: string;
}

interface TeamWithMap {
  team: Team;
  empathyMap: EmpathyMap | null;
}

// Configuración de cuadrantes
const QUADRANTS_CONFIG = [
  {
    id: 'ver',
    title: 'Ver',
    icon: <Eye className="w-5 h-5" />,
    color: '#667eea'
  },
  {
    id: 'oir',
    title: 'Oír',
    icon: <Ear className="w-5 h-5" />,
    color: '#f093fb'
  },
  {
    id: 'pensar',
    title: 'Pensar/Sentir',
    icon: <Heart className="w-5 h-5" />,
    color: '#43e97b'
  },
  {
    id: 'decir',
    title: 'Decir/Hacer',
    icon: <MessageCircle className="w-5 h-5" />,
    color: '#4facfe'
  }
];

export function ProfesorMapaDeEmpatia() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [teamsWithMaps, setTeamsWithMaps] = useState<TeamWithMap[]>([]);
  const [gameSession, setGameSession] = useState<any>(null);
  const [currentActivity, setCurrentActivity] = useState<any>(null);
  const [currentSessionStage, setCurrentSessionStage] = useState<any>(null);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [allTeamsCompleted, setAllTeamsCompleted] = useState(false);
  const [previewMap, setPreviewMap] = useState<{ team: Team; empathyMap: EmpathyMap } | null>(null);
  const [showEtapaIntro, setShowEtapaIntro] = useState(false);

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

      const gameSessionData = await sessionsAPI.getSession(parseInt(sessionId!));
      setGameSession(gameSessionData);

      if (gameSessionData.current_activity) {
        const activity = gameSessionData.current_activity;
        setCurrentActivity(activity);
      }

      if (gameSessionData.current_session_stage) {
        const sessionStage = gameSessionData.current_session_stage;
        setCurrentSessionStage(sessionStage);

        // Cargar equipos y sus mapas de empatía
        const teams = gameSessionData.teams || [];
        
        // Cargar mapas de empatía para cada equipo (usando teamBubbleMapsAPI como base)
        const teamsWithMapsData: TeamWithMap[] = await Promise.all(
          teams.map(async (team: Team) => {
            try {
              const mapsList = await teamBubbleMapsAPI.list({
                team: team.id,
                session_stage: sessionStage.id
              });
              const mapsArray = Array.isArray(mapsList) ? mapsList : [mapsList];
              const empathyMap = mapsArray[0] as EmpathyMap | undefined;
              
              return {
                team,
                empathyMap: empathyMap || null
              };
            } catch (error) {
              return {
                team,
                empathyMap: null
              };
            }
          })
        );

        setTeamsWithMaps(teamsWithMapsData);

        // Verificar si todos los equipos completaron
        const completedTeams = teamsWithMapsData.filter(twm => {
          if (!twm.empathyMap) return false;
          const mapData = twm.empathyMap.map_data as EmpathyMapData;
          if (!mapData || !mapData.quadrants) return false;
          
          // Verificar que cada cuadrante tenga al menos 2 items
          return Object.values(mapData.quadrants).every(
            items => Array.isArray(items) && items.length >= 2
          );
        });
        
        setAllTeamsCompleted(completedTeams.length === teams.length && teams.length > 0);

        // Sincronizar timer
        if (gameSessionData.current_activity) {
          await syncTimer(gameSessionData.id);
          if (!timerIntervalRef.current) {
            startTimer(gameSessionData.current_activity.id, gameSessionData.id);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading game control:', error);
      toast.error('Error al cargar datos de la sesión');
    } finally {
      setLoading(false);
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

      timerStartTimeRef.current = startTime;
      timerDurationRef.current = timerDuration;

      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, timerDuration - elapsed);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      setTimerRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    } catch (error) {
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

    await syncTimer(gameSessionId);

    timerIntervalRef.current = setInterval(() => {
      if (timerStartTimeRef.current !== null && timerDurationRef.current !== null) {
        const now = Date.now();
        const elapsed = Math.floor((now - timerStartTimeRef.current) / 1000);
        const remaining = Math.max(0, timerDurationRef.current - elapsed);
        
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        setTimerRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    timerSyncIntervalRef.current = setInterval(() => {
      syncTimer(gameSessionId);
    }, 30000);
  };

  const handleContinue = async (skipRequirements: boolean = false) => {
    if (!currentSessionStage || !gameSession) {
      toast.error('No se puede continuar');
      return;
    }

    try {
      // Continuar a la siguiente actividad
      await sessionsAPI.nextActivity(gameSession.id);
      toast.success('Continuando a la siguiente actividad');
      
      // Recargar datos
      setTimeout(() => {
        loadGameControl();
      }, 1000);
    } catch (error: any) {
      toast.error('Error al continuar: ' + (error.response?.data?.error || error.message));
    }
  };

  const handlePreviewMap = (team: Team, empathyMap: EmpathyMap) => {
    setPreviewMap({ team, empathyMap });
  };

  const handleClosePreview = () => {
    setPreviewMap(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  if (!gameSession || !currentSessionStage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <div className="text-white text-center">
          <p className="text-xl mb-4">No se encontró la sesión activa</p>
          <Button onClick={() => navigate('/profesor/panel')}>Volver al Panel</Button>
        </div>
      </div>
    );
  }

  const mapData = previewMap?.empathyMap.map_data as EmpathyMapData | undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac] p-4 sm:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-xl shadow-xl p-4 sm:p-6 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#093c92] mb-2">
                Mapa de Empatía
              </h1>
              <p className="text-gray-600">{currentActivity?.name || 'Actividad en curso'}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-yellow-50 border-2 border-yellow-300 text-yellow-800 px-4 py-2 rounded-xl font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5" /> {timerRemaining}
              </div>
              <div className="flex gap-2">
                {allTeamsCompleted && (
                  <Button
                    onClick={() => handleContinue(false)}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    Continuar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
                {/* Botón Dev - Solo en modo desarrollo */}
                {isDevMode() && (
                  <Button
                    onClick={() => handleContinue(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                    title="Modo Dev: Avanzar sin requisitos"
                  >
                    <Code className="w-4 h-4 mr-2" />
                    Dev
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de equipos */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {teamsWithMaps.map((twm) => {
            const teamMapData = twm.empathyMap?.map_data as EmpathyMapData | undefined;
            const hasMap = !!twm.empathyMap;
            const isComplete = hasMap && teamMapData && 
              Object.values(teamMapData.quadrants || {}).every(
                items => Array.isArray(items) && items.length >= 2
              );
            const totalItems = teamMapData ? 
              Object.values(teamMapData.quadrants || {}).reduce((sum, items) => sum + (items?.length || 0), 0) : 0;

            return (
              <motion.div
                key={twm.team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <GroupBadge team={twm.team} size="lg" />
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{twm.team.name}</h3>
                      <p className="text-sm text-gray-600">Equipo {twm.team.color}</p>
                    </div>
                  </div>
                  {isComplete ? (
                    <Badge className="bg-green-500 text-white">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Completado
                    </Badge>
                  ) : hasMap ? (
                    <Badge className="bg-yellow-500 text-white">En progreso</Badge>
                  ) : (
                    <Badge className="bg-gray-400 text-white">Sin iniciar</Badge>
                  )}
                </div>

                {hasMap && teamMapData ? (
                  <>
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCircle className="w-5 h-5 text-gray-600" />
                        <span className="font-semibold text-gray-800">{teamMapData.central?.personName || 'Persona'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        {QUADRANTS_CONFIG.map((qConfig) => {
                          const items = teamMapData.quadrants?.[qConfig.id as keyof typeof teamMapData.quadrants] || [];
                          return (
                            <div key={qConfig.id} className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: qConfig.color }}
                              />
                              <span>{qConfig.title}: {items.length || 0}</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Total: {totalItems} items</p>
                    </div>
                    <Button
                      onClick={() => handlePreviewMap(twm.team, twm.empathyMap!)}
                      className="w-full"
                      variant="outline"
                    >
                      Ver Mapa Completo
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">El equipo aún no ha iniciado</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Modal de preview */}
      {previewMap && mapData && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header del modal */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-4">
                <GroupBadge team={previewMap.team} size="lg" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{previewMap.team.name}</h2>
                  <p className="text-gray-600">Equipo {previewMap.team.color}</p>
                </div>
              </div>
              <Button
                onClick={handleClosePreview}
                variant="outline"
                className="w-10 h-10 p-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Contenido del modal */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Persona central */}
              <div className="flex flex-col items-center mb-8">
                <div 
                  className="w-32 h-32 rounded-full shadow-2xl overflow-hidden border-4 border-white relative mb-4"
                  style={{ background: 'linear-gradient(135deg, #f757ac 0%, #d946a0 100%)' }}
                >
                  {mapData.central?.profileImage ? (
                    <img
                      src={mapData.central.profileImage.startsWith('http') 
                        ? mapData.central.profileImage 
                        : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000'}${mapData.central.profileImage.startsWith('/') ? '' : '/'}${mapData.central.profileImage}`}
                      alt={mapData.central.personName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white">
                      <UserCircle className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="px-6 py-3 rounded-full shadow-xl" style={{ background: '#f757ac' }}>
                  <span className="text-white font-semibold text-lg">{mapData.central?.personName || 'Persona'}</span>
                </div>
              </div>

              {/* Cuadrantes en grid 2x2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {QUADRANTS_CONFIG.map((qConfig) => {
                  const items = mapData.quadrants?.[qConfig.id as keyof typeof mapData.quadrants] || [];
                  return (
                    <div
                      key={qConfig.id}
                      className="bg-white rounded-xl shadow-lg border-2 p-4"
                      style={{ borderColor: qConfig.color }}
                    >
                      {/* Header del cuadrante */}
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: qConfig.color }}>
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: qConfig.color }}
                        >
                          {qConfig.icon}
                        </div>
                        <h3 className="text-lg font-bold" style={{ color: qConfig.color }}>
                          {qConfig.title}
                        </h3>
                      </div>

                      {/* Items del cuadrante */}
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {items.length > 0 ? (
                          items.map((item, index) => (
                            <div
                              key={item.id || index}
                              className="px-3 py-2 rounded-lg text-sm"
                              style={{ 
                                backgroundColor: `${qConfig.color}15`,
                                border: `1px solid ${qConfig.color}40`
                              }}
                            >
                              <span className="text-gray-500 text-xs mr-2">{index + 1}.</span>
                              {item.text}
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-400 text-sm italic text-center py-4">
                            No hay items en este cuadrante
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}




