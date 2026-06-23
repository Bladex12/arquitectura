import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Target,
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Users,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api';
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
  description?: string;
}

interface Challenge {
  id: number;
  title: string;
  icon?: string;
  persona_name?: string;
  persona_age?: number;
  persona_story?: string;
  description?: string;
}

interface TeamProgress {
  team: Team;
  topic?: Topic;
  challenge?: Challenge;
  topicStatus: 'completed' | 'in_progress' | 'pending';
  challengeStatus: 'completed' | 'in_progress' | 'pending';
}

interface GameSession {
  id: number;
  room_code: string;
  status: string;
  current_activity?: number;
  current_activity_name?: string;
  current_stage_number?: number;
}

interface Activity {
  id: number;
  name: string;
  order_number?: number;
}

export function ProfesorSeleccionarTemaDesafio() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsProgress, setTeamsProgress] = useState<TeamProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [sessionStageId, setSessionStageId] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadGameControl();

      intervalRef.current = setInterval(() => {
        loadGameControl();
      }, 5000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    }
  }, [sessionId]);

  const loadGameControl = async () => {
    if (!sessionId) return;

    try {
      // Obtener información de la sesión
      const sessionResponse = await api.get(`/sessions/game-sessions/${sessionId}/`);
      const sessionData: GameSession = sessionResponse.data;
      setGameSession(sessionData);

      // Obtener equipos
      const teamsResponse = await api.get(`/sessions/game-sessions/${sessionId}/teams/`);
      const teamsData = teamsResponse.data;
      const teamsList = Array.isArray(teamsData) ? teamsData : teamsData.results || [];
      setTeams(teamsList);

      // Obtener session_stage de Etapa 2
      let currentSessionStageId = sessionStageId;
      if (!currentSessionStageId) {
        const stagesResponse = await api.get(`/sessions/session-stages/?game_session=${sessionId}`);
        const stagesData = stagesResponse.data;
        const stages = stagesData.results || stagesData;
        const stage2 = stages.find((s: any) => s.stage_number === 2);
        if (stage2) {
          currentSessionStageId = stage2.id;
          setSessionStageId(stage2.id);
        }
      }

      // Obtener actividad actual
      if (sessionData.current_activity) {
        const activityResponse = await api.get(`/challenges/activities/${sessionData.current_activity}/`);
        const activityData: Activity = activityResponse.data;
        setCurrentActivity(activityData);
      }

      // Obtener progreso de cada equipo (siempre, incluso si no hay actividad actual)
      if (currentSessionStageId && teamsList.length > 0) {
        await loadTeamsProgress(teamsList, sessionData.current_activity || null, currentSessionStageId);
      } else if (teamsList.length > 0) {
        // Si no hay sessionStageId, al menos inicializar con los equipos básicos
        const basicProgress: TeamProgress[] = teamsList.map((team) => ({
          team,
          topic: undefined,
          challenge: undefined,
          topicStatus: 'pending',
          challengeStatus: 'pending',
        }));
        setTeamsProgress(basicProgress);
      }

      // Iniciar temporizador
      if (sessionData.current_activity) {
        startTimer(sessionData.current_activity, sessionId);
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading game control:', error);
      if (error.response?.status === 401) {
        navigate('/profesor/login');
      } else {
        toast.error('Error al cargar el control del juego');
      }
      setLoading(false);
    }
  };

  const loadTeamsProgress = async (teamsList: Team[], activityId: number | null, stageId: number) => {
    try {
      // Obtener todas las actividades de la etapa 2 para buscar tema y desafío
      const activitiesResponse = await api.get(`/challenges/activities/?stage=2`);
      const activitiesData = activitiesResponse.data;
      const activities = activitiesData.results || activitiesData;
      
      // Buscar actividades de tema y desafío
      const topicActivity = activities.find((a: Activity) => 
        a.name.toLowerCase().includes('tema') || a.name.toLowerCase().includes('seleccionar')
      );
      const challengeActivity = activities.find((a: Activity) => 
        a.name.toLowerCase().includes('desafío') || a.name.toLowerCase().includes('desafio') || 
        a.name.toLowerCase().includes('ver el') || a.name.toLowerCase().includes('ver desaf')
      );

      const progressPromises = teamsList.map(async (team) => {
        let topic: Topic | undefined;
        let challenge: Challenge | undefined;
        let topicStatus: 'completed' | 'in_progress' | 'pending' = 'pending';
        let challengeStatus: 'completed' | 'in_progress' | 'pending' = 'pending';

        // Buscar progreso de la actividad de tema
        if (topicActivity) {
          try {
            const topicProgressResponse = await api.get(
              `/sessions/team-activity-progress/?team=${team.id}&activity=${topicActivity.id}&session_stage=${stageId}`
            );
            const topicProgressData = topicProgressResponse.data;
            const topicProgress = Array.isArray(topicProgressData) ? topicProgressData[0] : topicProgressData.results?.[0];

            if (topicProgress?.selected_topic) {
              if (typeof topicProgress.selected_topic === 'object') {
                topic = topicProgress.selected_topic as Topic;
              } else {
                try {
                  const topicResponse = await api.get(`/challenges/topics/${topicProgress.selected_topic}/`);
                  topic = topicResponse.data;
                } catch {
                  topic = { id: topicProgress.selected_topic, name: 'Tema seleccionado' } as Topic;
                }
              }
              topicStatus = 'completed';
            }
          } catch (error) {
            console.error(`Error loading topic progress for team ${team.id}:`, error);
          }
        }

        // Buscar progreso de la actividad de desafío
        if (challengeActivity) {
          try {
            const challengeProgressResponse = await api.get(
              `/sessions/team-activity-progress/?team=${team.id}&activity=${challengeActivity.id}&session_stage=${stageId}`
            );
            const challengeProgressData = challengeProgressResponse.data;
            const challengeProgress = Array.isArray(challengeProgressData) ? challengeProgressData[0] : challengeProgressData.results?.[0];

            if (challengeProgress?.selected_challenge) {
              if (typeof challengeProgress.selected_challenge === 'object') {
                challenge = challengeProgress.selected_challenge as Challenge;
              } else {
                try {
                  const challengeResponse = await api.get(`/challenges/challenges/${challengeProgress.selected_challenge}/`);
                  challenge = challengeResponse.data;
                } catch {
                  challenge = { id: challengeProgress.selected_challenge, title: 'Desafío seleccionado' } as Challenge;
                }
              }
              challengeStatus = 'completed';
            }
          } catch (error) {
            console.error(`Error loading challenge progress for team ${team.id}:`, error);
          }
        }

        return {
          team,
          topic,
          challenge,
          topicStatus,
          challengeStatus,
        } as TeamProgress;
      });

      const progressList = await Promise.all(progressPromises);
      setTeamsProgress(progressList);
    } catch (error) {
      console.error('Error loading teams progress:', error);
    }
  };

  const handleNextActivity = async () => {
    if (!sessionId) return;

    setAdvancing(true);
    try {
      const response = await api.post(`/sessions/game-sessions/${sessionId}/next_activity/`);
      const data = response.data;

      if (data.stage_completed) {
        toast.success(`¡${data.message}!`, { duration: 2000 });
        setTimeout(() => {
          window.location.replace(`/profesor/resultados/${sessionId}/?stage_id=${data.stage_id}`);
        }, 1500);
      } else {
        const nextActivityName = data.current_activity_name?.toLowerCase() || '';
        toast.success(`¡Avanzando a ${data.current_activity_name}!`, { duration: 2000 });

        setTimeout(() => {
          if (nextActivityName.includes('bubble') || nextActivityName.includes('mapa')) {
            window.location.replace(`/profesor/etapa2/bubble-map/${sessionId}/`);
          } else {
            // Si todavía es seleccionar tema/desafío, recargar la página
            window.location.reload();
          }
        }, 1500);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al avanzar a la siguiente actividad');
    } finally {
      setAdvancing(false);
    }
  };

  const startTimer = async (activityId: number, gameSessionId: string) => {
    if (timerIntervalRef.current) {
      return;
    }

    try {
      const timerResponse = await api.get(`/sessions/game-sessions/${gameSessionId}/activity_timer/`);
      const timerData = timerResponse.data;

      if (timerData.error || !timerData.timer_duration) return;

      const timerDuration = timerData.timer_duration;
      const startTime = timerData.started_at
        ? new Date(timerData.started_at).getTime()
        : new Date(timerData.current_time).getTime();

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
        }
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);
    } catch (error) {
      console.error('Error starting timer:', error);
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

  const allTopicsSelected = teamsProgress.length > 0 && teamsProgress.every((tp) => tp.topicStatus === 'completed');
  const allChallengesSelected = teamsProgress.length > 0 && teamsProgress.every((tp) => tp.challengeStatus === 'completed');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!gameSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Error al cargar la sesión.</p>
          <Button onClick={() => navigate('/profesor/panel')}>Volver al Panel</Button>
        </div>
      </div>
    );
  }

  const activityName = currentActivity?.name || 'Selección de Tema y Desafío';
  const isTopicActivity = activityName.toLowerCase().includes('tema') || activityName.toLowerCase().includes('seleccionar');
  const isChallengeActivity = activityName.toLowerCase().includes('desafío') || activityName.toLowerCase().includes('desafio') || activityName.toLowerCase().includes('ver el');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 mb-4 sm:mb-6 flex items-center justify-between flex-wrap gap-4"
        >
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#093c92] mb-2">
              {isTopicActivity ? '📚 Selección de Tema' : isChallengeActivity ? '🎯 Selección de Desafío' : '📚🎯 Tema y Desafío'}
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Sesión: <span className="font-semibold">{gameSession.room_code}</span>
            </p>
          </div>
          <Button onClick={() => navigate('/profesor/panel')} variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver al Panel</span>
            <span className="sm:hidden">Volver</span>
          </Button>
        </motion.div>

        {/* Información de la Etapa */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 mb-4 sm:mb-6 text-center"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <motion.div
              animate={{
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center shadow-2xl">
                {isTopicActivity ? (
                  <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                ) : isChallengeActivity ? (
                  <Target className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                ) : (
                  <Lightbulb className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                )}
              </div>
            </motion.div>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#093c92] mb-2">
            Etapa 2: Empatía
          </h2>
          <p className="text-gray-600 text-base sm:text-lg md:text-xl mb-4">
            Actividad Actual: {activityName}
          </p>

          {/* Temporizador */}
          <div className="bg-yellow-50 border-2 border-yellow-300 text-yellow-800 p-3 sm:p-4 rounded-xl inline-block">
            <p className="font-semibold text-sm sm:text-base flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" /> Tiempo restante: {timerRemaining}
            </p>
          </div>
        </motion.div>

        {/* Estadísticas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6"
        >
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 text-center">
            <Users className="w-8 h-8 sm:w-10 sm:h-10 text-[#093c92] mx-auto mb-2" />
            <p className="text-2xl sm:text-3xl font-bold text-[#093c92]">{teams.length}</p>
            <p className="text-sm sm:text-base text-gray-600">Equipos Totales</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 text-center">
            <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-green-600 mx-auto mb-2" />
            <p className="text-2xl sm:text-3xl font-bold text-green-600">
              {teamsProgress.filter((tp) => tp.topicStatus === 'completed').length}
            </p>
            <p className="text-sm sm:text-base text-gray-600">Temas Seleccionados</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 text-center">
            <Target className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl sm:text-3xl font-bold text-purple-600">
              {teamsProgress.filter((tp) => tp.challengeStatus === 'completed').length}
            </p>
            <p className="text-sm sm:text-base text-gray-600">Desafíos Seleccionados</p>
          </div>
        </motion.div>

        {/* Equipos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 mb-4 sm:mb-6"
        >
          <h3 className="text-xl sm:text-2xl font-bold text-[#093c92] mb-4 sm:mb-6 text-center">
            <Users className="inline-block w-6 h-6 mr-2" /> Estado de los Equipos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {teamsProgress.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500 text-sm sm:text-base">Cargando estado de los equipos...</p>
              </div>
            ) : (
              teamsProgress.map((teamProgress, index) => (
              <motion.div
                key={teamProgress.team.id}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="p-4 sm:p-6 rounded-xl shadow-md border-l-4 bg-gray-50"
                style={{
                  borderLeftColor: getTeamColorHex(teamProgress.team.color),
                }}
              >
                <div className="flex items-center gap-3 sm:gap-4 mb-4">
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white text-base sm:text-lg font-bold shadow-md"
                    style={{ backgroundColor: getTeamColorHex(teamProgress.team.color) }}
                  >
                    {teamProgress.team.color.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm sm:text-base text-[#093c92]">{teamProgress.team.name}</h4>
                    <p className="text-xs sm:text-sm text-gray-600">Equipo {teamProgress.team.color}</p>
                  </div>
                </div>

                {/* Tema */}
                <div className="mb-3 sm:mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1">
                      <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" /> Tema:
                    </span>
                    <Badge
                      className={`text-xs ${
                        teamProgress.topicStatus === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {teamProgress.topicStatus === 'completed' ? (
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                      ) : (
                        <Clock className="w-3 h-3 mr-1" />
                      )}
                      {teamProgress.topicStatus === 'completed' ? 'Seleccionado' : 'Pendiente'}
                    </Badge>
                  </div>
                  {teamProgress.topic ? (
                    <div className="bg-blue-50 p-2 sm:p-3 rounded-lg">
                      <p className="text-xs sm:text-sm font-semibold text-[#093c92]">{teamProgress.topic.name}</p>
                      {teamProgress.topic.description && (
                        <p className="text-xs text-gray-600 mt-1">{teamProgress.topic.description}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-500 italic">Aún no ha seleccionado</p>
                  )}
                </div>

                {/* Desafío - Siempre mostrar si hay desafío o si estamos en actividad de desafío */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1">
                      <Target className="w-3 h-3 sm:w-4 sm:h-4" /> Desafío:
                    </span>
                    <Badge
                      className={`text-xs ${
                        teamProgress.challengeStatus === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {teamProgress.challengeStatus === 'completed' ? (
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                      ) : (
                        <Clock className="w-3 h-3 mr-1" />
                      )}
                      {teamProgress.challengeStatus === 'completed' ? 'Seleccionado' : 'Pendiente'}
                    </Badge>
                  </div>
                  {teamProgress.challenge ? (
                    <div className="bg-purple-50 p-2 sm:p-3 rounded-lg space-y-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">Nombre del Desafío:</p>
                        <p className="text-xs sm:text-sm font-semibold text-purple-800">{teamProgress.challenge.title}</p>
                      </div>
                      {teamProgress.challenge.persona_story && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-1">Historia:</p>
                          <p className="text-xs text-gray-600 line-clamp-3">{teamProgress.challenge.persona_story}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-500 italic">Aún no ha seleccionado</p>
                  )}
                </div>
              </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Botón Siguiente Actividad */}
        {(isTopicActivity ? allTopicsSelected : isChallengeActivity ? allChallengesSelected : allTopicsSelected && allChallengesSelected) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <Button
              onClick={handleNextActivity}
              disabled={advancing}
              className="w-full sm:w-auto px-8 sm:px-12 py-4 sm:py-6 text-base sm:text-lg font-semibold bg-gradient-to-r from-[#093c92] to-blue-600 hover:from-[#072e73] hover:to-[#164a9a] text-white rounded-full shadow-2xl hover:shadow-3xl"
            >
              {advancing ? (
                <>
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 animate-spin" />
                  Avanzando...
                </>
              ) : (
                <>
                  Siguiente Actividad
                  <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 ml-2" />
                </>
              )}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

