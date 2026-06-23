import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, ImageIcon } from 'lucide-react';
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
import { isDevMode } from '@/utils/devMode';
import { sessionsAPI, challengesAPI, teamActivityProgressAPI, teamPersonalizationsAPI } from '@/services';
import { toast } from 'sonner';
import { useGameStateRedirect } from '@/hooks/useGameStateRedirect';
import { AdvanceConfirmModal } from '@/components/AdvanceConfirmModal';
import { GalacticPage } from '@/components/GalacticPage';
import { TimerBlock } from '@/components/TimerBlock';

interface Team {
  id: number;
  name: string;
  color: string;
}

interface TeamProgress {
  team: Team;
  progress: {
    id: number;
    status: string;
    prototype_image_url?: string;
    completed_at?: string;
  } | null;
}

interface GameSession {
  id: number;
  room_code: string;
  status: string;
  current_activity?: number;
  current_stage?: number;
  current_stage_number?: number;
  current_activity_name?: string | null;
}

export function ProfesorPrototipo() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Redirigir automáticamente si el juego está en otro estado
  useGameStateRedirect();
  
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [teamsWithProgress, setTeamsWithProgress] = useState<TeamProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [showEtapaIntro, setShowEtapaIntro] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [personalizations, setPersonalizations] = useState<Record<number, { team_name?: string }>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartTimeRef = useRef<number | null>(null);
  const timerDurationRef = useRef<number | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadGameControl();

      // Auto-refresh cada 3 segundos
      intervalRef.current = setInterval(() => {
        loadGameControl();
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
    }
  }, [sessionId]);

  const loadGameControl = async () => {
    if (!sessionId) return;

    try {
      const gameData: GameSession = await sessionsAPI.getById(sessionId);
      setGameSession(gameData);

      // Verificar si debemos mostrar la intro de la etapa
      if (gameData.current_stage_number === 3) {
        const introKey = `etapa_intro_${sessionId}_3`;
        const hasSeenIntro = localStorage.getItem(introKey);
        if (!hasSeenIntro) {
          setShowEtapaIntro(true);
        }
      }

      // Verificar que estamos en la etapa correcta
      const currentStageNumber = gameData.current_stage_number || 1;
      if (currentStageNumber !== 3) {
        // Redirigir a la etapa actual
        if (currentStageNumber === 4) {
          const currentActivityName = gameData.current_activity_name?.toLowerCase() || '';
          if (currentActivityName.includes('pitch') && currentActivityName.includes('formulario')) {
            window.location.replace(`/profesor/etapa4/formulario-pitch/${sessionId}/`);
          } else if (currentActivityName.includes('pitch') && currentActivityName.includes('presentacion')) {
            window.location.replace(`/profesor/etapa4/presentacion-pitch/${sessionId}/`);
          } else {
            window.location.replace(`/profesor/etapa4/formulario-pitch/${sessionId}/`);
          }
        } else if (currentStageNumber === 2) {
          window.location.replace(`/profesor/etapa2/seleccionar-tema/${sessionId}/`);
        } else if (currentStageNumber === 1) {
          window.location.replace(`/profesor/etapa1/personalizacion/${sessionId}/`);
        } else {
          window.location.replace(`/profesor/panel`);
        }
        return;
      }

      // Si la etapa 3 ya terminó (no hay actividad actual), no cargar prototipos
      if (!gameData.current_activity) {
        console.log('⚠️ Etapa 3 completada, no hay actividad actual');
        setLoading(false);
        return;
      }

      if (gameData.current_activity && !timerIntervalRef.current) {
        await startTimer(gameData.current_activity, parseInt(sessionId));
      }

      await loadTeamsPrototypes();
      setLoading(false);
    } catch (error: any) {
      console.error('Error loading game control:', error);
      if (error.response?.status === 401) {
        navigate('/profesor/login');
      } else {
        toast.error('Error de conexión: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
        setHasError(true);
      }
      setLoading(false);
    }
  };

  const loadTeamsPrototypes = async () => {
    if (!sessionId) return;

    try {
      const teams = await sessionsAPI.getTeams(sessionId);
      const teamsArray = Array.isArray(teams) ? teams : [teams];

      const sessionData = await sessionsAPI.getById(sessionId);

      if (!sessionData.current_stage) {
        return;
      }

      // Obtener session_stage para la etapa actual (Etapa 3: Creatividad)
      const stagesData = await sessionsAPI.getSessionStages(Number(sessionId));
      const sessionStages = Array.isArray(stagesData) ? stagesData : [stagesData];

      // Buscar el session_stage de la Etapa 3 (Creatividad)
      const sessionStage = sessionStages.find((s: any) => s.stage_number === 3) || 
                          sessionStages.find((s: any) => s.stage === sessionData.current_stage);

      if (!sessionStage) {
        console.warn('⚠️ No se encontró session_stage para Etapa 3');
        return;
      }

      // Validar que existe current_activity antes de intentar obtenerlo
      if (!sessionData.current_activity) {
        console.warn('⚠️ No hay actividad actual, la etapa ya terminó');
        return;
      }

      const activity = await challengesAPI.getActivityById(sessionData.current_activity);

      // Fetch personalizations for all teams
      const persMap: Record<number, { team_name?: string }> = {};
      for (const team of teamsArray) {
        try {
          const persList = await teamPersonalizationsAPI.list({ team: team.id });
          const persResults = Array.isArray(persList) ? persList : [persList];
          if (persResults.length > 0 && persResults[0].team_name) {
            persMap[team.id] = { team_name: persResults[0].team_name };
          }
        } catch (error) {
          console.error(`Error loading personalization for team ${team.id}:`, error);
        }
      }
      setPersonalizations(persMap);

      const progressPromises = teamsArray.map(async (team: Team) => {
        try {
          let progressList = await teamActivityProgressAPI.list({
            team: team.id,
            activity: activity.id,
            session_stage: sessionStage.id
          });

          if (!progressList || (Array.isArray(progressList) && progressList.length === 0)) {
            progressList = await teamActivityProgressAPI.list({
              team: team.id,
              activity: activity.id
            });
          }

          const progressArray = Array.isArray(progressList) ? progressList : [progressList];

          let progress = null;
          if (progressArray.length > 0) {
            progress = progressArray.find((p: any) => p.session_stage === sessionStage.id) ||
                      progressArray.find((p: any) => {
                        return p.stage_name && p.stage_name.toLowerCase().includes('creatividad');
                      }) ||
                      progressArray[0];
          }

          return { team, progress };
        } catch (error) {
          console.error(`Error al obtener progreso para equipo ${team.name}:`, error);
          return { team, progress: null };
        }
      });

      const teamsWithProgressData = await Promise.all(progressPromises);
      setTeamsWithProgress(teamsWithProgressData);
    } catch (error: any) {
      console.error('Error loading teams prototypes:', error);
      toast.error('Error al cargar prototipos: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
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

  const startTimer = async (_activityId: number, gameSessionId: number) => {
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
        }
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const doAdvance = async () => {
    if (!sessionId) return;

    setAdvancing(true);
    try {
      const response = await sessionsAPI.nextActivity(sessionId);

      if (response.stage_completed) {
        navigate(`/profesor/resultados/${sessionId}/?stage_id=${response.stage_id}`);
      } else {
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error advancing activity:', error);
      toast.error('Error al avanzar: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
      setAdvancing(false);
    }
  };

  const handleNextActivity = (skipRequirements: boolean = false) => {
    if (!sessionId) return;

    if (!skipRequirements) {
      setShowConfirmModal(true);
      return;
    }

    doAdvance();
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

  if (!gameSession && !hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="text-center bg-white rounded-3xl shadow-sm p-8 max-w-sm mx-4">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-base font-semibold text-slate-700 mb-1">Sincronizando estado...</p>
          <p className="text-sm text-slate-500 mb-6">
            La sesión puede estar transitando entre etapas. Se actualizará automáticamente.
          </p>
          <button
            onClick={() => { setLoading(true); loadGameControl(); }}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
          >
            Recargar estado
          </button>
        </div>
      </div>
    );
  }

  if (hasError || !gameSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="text-center bg-white rounded-3xl shadow-sm p-8 max-w-sm mx-4">
          <p className="text-lg font-semibold text-slate-700 mb-4">Error al cargar la sesión</p>
          <button
            onClick={() => navigate('/profesor/panel')}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
          >
            Volver al Panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <GalacticPage>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 3</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 30, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
            Creatividad
          </div>
        </div>
        <div className="galactic-badge">Actividad 1</div>
      </div>

      {/* Timer */}
      <TimerBlock timerRemaining={timerRemaining} activityName="Prototipos de Lego" />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 22 }}>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>Equipos Totales</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#fff' }}>
            {teamsWithProgress.length}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            en esta sesión
          </div>
        </div>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>Completados</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#34d399' }}>
            {teamsWithProgress.filter(({ progress }) => progress?.status === 'completed' || progress?.status === 'submitted').length}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            prototipos
          </div>
        </div>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>Fotos Subidas</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#a78bfa' }}>
            {teamsWithProgress.filter(({ progress }) => !!progress?.prototype_image_url?.trim()).length}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            imágenes
          </div>
        </div>
      </div>

      {/* Team grid */}
      <div style={{ marginTop: 22 }}>
        <div className="galactic-label" style={{ marginBottom: 12 }}>Estado de los equipos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
          {teamsWithProgress.map(({ team, progress }) => {
            const isCompleted = progress?.status === 'completed' || progress?.status === 'submitted';
            const hasImage = Boolean(progress?.prototype_image_url?.trim());
            const imageUrl = progress?.prototype_image_url || '';
            const teamColorHex = getTeamColorHex(team.color);
            const teamName = personalizations[team.id]?.team_name
              ? `Equipo ${personalizations[team.id].team_name}`
              : team.name;

            return (
              <div
                key={team.id}
                className="glass-card"
                style={{
                  padding: '16px 18px',
                  borderColor: isCompleted ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.12)',
                  background: isCompleted ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)',
                }}
              >
                {/* Team header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: teamColorHex, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {teamName}
                  </span>
                  {isCompleted && <CheckCircle2 size={16} style={{ color: '#34d399', flexShrink: 0 }} />}
                </div>

                {/* Prototype image */}
                {hasImage ? (
                  <img
                    src={imageUrl.startsWith('/') ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000'}${imageUrl}` : imageUrl}
                    alt={`Prototipo ${teamName}`}
                    style={{ width: '100%', height: 120, objectFit: 'contain', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.3)', marginBottom: 10, display: 'block' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div style={{ width: '100%', height: 80, border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: "'Exo 2',sans-serif", marginBottom: 10 }}>
                    <ImageIcon size={16} style={{ opacity: 0.4 }} />
                    Sin foto aún
                  </div>
                )}

                {/* Status pill */}
                <div style={{
                  display: 'inline-block',
                  fontFamily: "'Orbitron',sans-serif",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase' as const,
                  padding: '4px 10px',
                  borderRadius: 50,
                  ...(progress?.status === 'completed'
                    ? { background: 'rgba(16,185,129,0.2)', color: '#34d399' }
                    : progress?.status === 'submitted'
                    ? { background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }
                    : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }),
                }}>
                  {progress?.status === 'completed'
                    ? 'Completado'
                    : progress?.status === 'submitted'
                    ? 'Foto subida'
                    : 'Pendiente'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24, paddingBottom: 8 }}>
        <button className="btn-galactic-secondary" onClick={() => navigate('/profesor/panel')}>
          Cancelar Sesión
        </button>
        {isDevMode() && (
          <button
            onClick={() => handleNextActivity(true)}
            disabled={advancing}
            style={{
              fontFamily: "'Orbitron',sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '2px',
              textTransform: 'uppercase' as const,
              padding: '10px 20px',
              borderRadius: 50,
              background: '#f97316',
              color: '#fff',
              border: 'none',
              cursor: advancing ? 'not-allowed' : 'pointer',
              opacity: advancing ? 0.6 : 1,
              boxShadow: '0 0 12px rgba(249,115,22,0.35)',
            }}
          >
            ⚡ Dev Skip
          </button>
        )}
        <button
          className="btn-galactic-primary"
          onClick={() => handleNextActivity(false)}
          disabled={advancing}
        >
          {advancing ? 'Avanzando...' : 'Continuar Misión ▶'}
        </button>
      </div>

      <AdvanceConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false);
          doAdvance();
        }}
        title="Avanzar Actividad"
        message="Todos los equipos deben haber completado la actividad actual antes de continuar."
      />

      <EtapaIntroModal
        etapaNumero={3}
        isOpen={showEtapaIntro}
        onClose={() => {
          setShowEtapaIntro(false);
          if (sessionId) {
            localStorage.setItem(`etapa_intro_${sessionId}_3`, 'true');
          }
        }}
      />
    </GalacticPage>
  );
}

