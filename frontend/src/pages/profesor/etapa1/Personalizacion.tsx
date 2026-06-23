import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
import { sessionsAPI, teamsAPI, teamPersonalizationsAPI } from '@/services';
import { toast } from 'sonner';
import { useGameStateRedirect } from '@/hooks/useGameStateRedirect';
import { AdvanceConfirmModal } from '@/components/AdvanceConfirmModal';
import { GalacticPage } from '@/components/GalacticPage';
import { TimerBlock } from '@/components/TimerBlock';

interface Student {
  id: number;
  full_name: string;
}

interface Team {
  id: number;
  name: string;
  color: string;
  students_count: number;
  students?: Student[];
}

interface Personalization {
  id?: number;
  team: number;
  team_name?: string;
  team_members_know_each_other?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

interface GameSession {
  id: number;
  room_code: string;
  status: string;
  current_activity_name?: string;
  current_stage_number?: number;
  started_at?: string;
}

export function ProfesorPersonalizacion() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [personalizations, setPersonalizations] = useState<Record<number, Personalization>>({});
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [advancing, setAdvancing] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [showEtapaIntro, setShowEtapaIntro] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Redirigir automáticamente si el juego está en otro estado
  useGameStateRedirect();

  useEffect(() => {
    if (sessionId) {
      loadGameControl();

      // Auto-refresh cada 5 segundos
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
      const sessionData: GameSession = await sessionsAPI.getById(sessionId);

      // Verificar que estamos en Etapa 1
      if (sessionData.current_stage_number !== 1) {
        // Redirigir a la vista correcta según la etapa
        determineAndRedirect(sessionData);
        return;
      }

      // Verificar actividad actual
      const currentActivityName = sessionData.current_activity_name?.toLowerCase() || '';
      if (!currentActivityName.includes('personaliz')) {
        if (currentActivityName.includes('presentaci')) {
          window.location.href = `/profesor/etapa1/presentacion/${sessionId}/`;
          return;
        }
        // Actividad desconocida o en transición (ej. 'instructivo' durante cambio de estado):
        // no redirigir — el próximo poll resolverá el estado. useGameStateRedirect gestiona
        // las redirecciones correctas sin causar retrocesos.
        return;
      }

      setGameSession(sessionData);

      // Verificar si debemos mostrar la intro de la etapa
      if (sessionData.current_stage_number === 1) {
        const introKey = `etapa_intro_${sessionId}_1`;
        const hasSeenIntro = localStorage.getItem(introKey);
        if (!hasSeenIntro) {
          setShowEtapaIntro(true);
        }
      }

      // Obtener equipos
      const teamsList = await teamsAPI.list({ game_session: sessionId });
      const teamsData = Array.isArray(teamsList) ? teamsList : [teamsList];
      setTeams(teamsData);

      // Obtener personalizaciones de todos los equipos
      const persMap: Record<number, Personalization> = {};
      for (const team of teamsData) {
        try {
          const persList = await teamPersonalizationsAPI.list({ team: team.id });
          const persResults = Array.isArray(persList) ? persList : [persList];
          if (persResults.length > 0) {
            persMap[team.id] = persResults[0];
          }
        } catch (error) {
          console.error(`Error loading personalization for team ${team.id}:`, error);
        }
      }
      setPersonalizations(persMap);

      // Iniciar temporizador
      if (!timerIntervalRef.current) {
        startTimer(0, parseInt(sessionId));
      }
    } catch (error: any) {
      console.error('Error loading game control:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      if (error.response?.status === 401) {
        navigate('/profesor/login');
      } else {
        toast.error('Error al cargar los datos de la etapa');
        setHasError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const startTimer = async (activityId: number, sessionId: number) => {
    try {
      const timerData = await sessionsAPI.getActivityTimer(sessionId);

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
          // No mostrar notificación al profesor, solo actualizar el display
        }
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const determineAndRedirect = (sessionData: GameSession) => {
    const currentStageNumber = sessionData.current_stage_number || 0;
    const currentActivityName = sessionData.current_activity_name?.toLowerCase() || '';

    // Estado previo a las etapas (Video Institucional o Instructivo)
    if (currentStageNumber === 0) {
      if (currentActivityName.includes('instructivo')) {
        window.location.href = `/profesor/etapa1/instructivo/${sessionId}/`;
      } else {
        window.location.href = `/profesor/etapa1/video-institucional/${sessionId}/`;
      }
      return;
    }

    if (currentStageNumber === 2) {
      if (currentActivityName.includes('tema') || currentActivityName.includes('seleccionar') || currentActivityName.includes('desafio') || currentActivityName.includes('desafío')) {
        window.location.href = `/profesor/etapa2/seleccionar-tema/${sessionId}/`;
      } else if (currentActivityName.includes('bubble') || currentActivityName.includes('mapa')) {
        window.location.href = `/profesor/etapa2/bubble-map/${sessionId}/`;
      }
    } else if (currentStageNumber === 3) {
      if (currentActivityName.includes('prototipo')) {
        window.location.href = `/profesor/etapa3/prototipo/${sessionId}/`;
      }
    } else if (currentStageNumber === 4) {
      if (currentActivityName.includes('pitch')) {
        if (currentActivityName.includes('formulario')) {
          window.location.href = `/profesor/etapa4/formulario-pitch/${sessionId}/`;
        } else if (currentActivityName.includes('presentacion')) {
          window.location.href = `/profesor/etapa4/presentacion-pitch/${sessionId}/`;
        }
      }
    }
  };

  const doAdvance = async () => {
    if (!sessionId) return;
    setAdvancing(true);

    try {
      const data = await sessionsAPI.nextActivity(sessionId);

      if (data.stage_completed) {
        toast.success(`¡${data.message}!`);
        setTimeout(() => {
          window.location.href = `/profesor/resultados/${sessionId}/?stage_id=${data.stage_id}`;
        }, 1500);
      } else {
        const nextActivityName = data.current_activity_name;
        toast.success(`¡Avanzando a ${nextActivityName}!`);

        if (nextActivityName === 'Presentación' || nextActivityName.toLowerCase().includes('presentacion')) {
          setTimeout(() => {
            window.location.href = `/profesor/etapa1/presentacion/${sessionId}/`;
          }, 1500);
        } else {
          setTimeout(() => {
            setAdvancing(false);
            determineAndRedirect(data);
          }, 1500);
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al avanzar a la siguiente actividad');
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

  // La carga completó pero la sesión no está en estado Personalización todavía
  // (transición de etapa, estado desactualizado o sesión redirigida).
  // Mostrar botón de recarga en vez de un spinner infinito.
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

  const submittedCount = Object.values(personalizations).filter(p => p.team_name).length;

  return (
    <>
      <GalacticPage>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 1</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 30, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
            Trabajo en Equipo
          </div>
        </div>
        <div className="galactic-badge">Actividad 1</div>
      </div>

      {/* Big timer */}
      <TimerBlock timerRemaining={timerRemaining} activityName="Personalización de Equipo" />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 22 }}>
        {[
          { label: 'Equipos Listos', value: `${submittedCount} / ${teams.length}`, sub: 'han enviado nombre' },
          { label: 'Actividad Actual', value: 'Personalización', sub: 'nombre + relación del equipo', valueStyle: { fontSize: 20, color: '#d946ef' } },
          { label: 'Código de Sala', value: gameSession?.room_code ?? '--', sub: 'para unirse', valueStyle: { fontSize: 28, letterSpacing: 4 } },
        ].map(card => (
          <div key={card.label} className="glass-card" style={{ padding: '20px 24px' }}>
            <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>{card.label}</div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#fff', ...card.valueStyle }}>
              {card.value}
            </div>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Team status grid */}
      <div style={{ marginTop: 22 }}>
        <div className="galactic-label" style={{ marginBottom: 12 }}>Estado de los equipos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
          {teams.map(team => {
            const p = personalizations[team.id];
            const done = Boolean(p?.team_name);
            return (
              <div key={team.id} className="glass-card" style={{ padding: '16px 18px', borderColor: done ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.12)', background: done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', flex: 1 }}>
                    {p?.team_name || team.name}
                  </span>
                  <span style={{ fontSize: 18 }}>{done ? '✅' : ''}</span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: done ? '100%' : '0%', background: 'linear-gradient(90deg,#7c3aed,#c026d3)', borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 600, color: done ? '#34d399' : 'rgba(255,255,255,0.5)' }}>
                  {done
                    ? `Entregado · ${p.team_members_know_each_other ? 'Ya se conocen' : 'No se conocen'}`
                    : 'Esperando...'}
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
        <button className="btn-galactic-primary" onClick={() => handleNextActivity(false)} disabled={advancing}>
          {advancing ? 'Avanzando...' : 'Avanzar Actividad ▶'}
        </button>
      </div>

      {/* Existing intro modal — preserve exactly */}
      <EtapaIntroModal
        etapaNumero={1}
        isOpen={showEtapaIntro}
        onClose={() => {
          setShowEtapaIntro(false);
          if (sessionId) {
            localStorage.setItem(`etapa_intro_${sessionId}_1`, 'true');
          }
        }}
      />
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
    </GalacticPage>
    </>

  );
}

