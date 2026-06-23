import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { GalacticPage } from '@/components/GalacticPage';
import { TimerBlock } from '@/components/TimerBlock';
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
import { sessionsAPI, teamActivityProgressAPI, teamPersonalizationsAPI } from '@/services';
import { toast } from 'sonner';
import { isDevMode } from '@/utils/devMode';
import { useGameStateRedirect } from '@/hooks/useGameStateRedirect';

const ANIM_CSS = `@keyframes badgePulse{0%,100%{opacity:1}50%{opacity:0.55}}`;

interface Team {
  id: number;
  name: string;
  color: string;
}

interface TeamPitch {
  team: Team;
  progress: {
    id: number;
    pitch_intro_problem: string | null;
    pitch_solution: string | null;
    pitch_value: string | null;
    pitch_impact: string | null;
    pitch_closing: string | null;
    status: string;
    progress_percentage: number;
  } | null;
}

interface GameSession {
  id: number;
  room_code: string;
  current_activity: number | null;
  current_activity_name: string | null;
  current_stage_number?: number;
}

const FIELD_KEYS = ['pitch_intro_problem', 'pitch_solution', 'pitch_value', 'pitch_impact', 'pitch_closing'] as const;
const FIELD_LABELS = ['Problema', 'Solución', 'Valor', 'Impacto', 'Cierre'];
const FIELD_COLORS = ['#ef4444', '#3b82f6', '#c026d3', '#10b981', '#f59e0b'];

export function ProfesorFormularioPitch() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  useGameStateRedirect();

  const [loading, setLoading] = useState(true);
  const [teamsWithPitch, setTeamsWithPitch] = useState<TeamPitch[]>([]);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [previewTeam, setPreviewTeam] = useState<TeamPitch | null>(null);
  const [showEtapaIntro, setShowEtapaIntro] = useState(false);
  const [personalizations, setPersonalizations] = useState<Record<number, { team_name?: string }>>({});

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartTimeRef = useRef<number | null>(null);
  const timerDurationRef = useRef<number | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadGameControl();
      intervalRef.current = setInterval(() => {
        loadGameControl();
      }, 5000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (timerSyncIntervalRef.current) clearInterval(timerSyncIntervalRef.current);
      };
    }
  }, [sessionId]);

  const loadGameControl = async () => {
    if (!sessionId) return;

    try {
      const sessionData: GameSession = await sessionsAPI.getById(sessionId);
      setGameSession(sessionData);

      if (sessionData.current_stage_number === 4) {
        const introKey = `etapa_intro_${sessionId}_4`;
        const hasSeenIntro = localStorage.getItem(introKey);
        if (!hasSeenIntro) {
          setShowEtapaIntro(true);
        }
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

      if (sessionData.current_activity) {
        const stagesData = await sessionsAPI.getSessionStages(Number(sessionId));
        const sessionStages = Array.isArray(stagesData) ? stagesData : [stagesData];
        const sessionStage = sessionStages.find((s: any) => s.stage_number === 4) || null;

        if (sessionStage) {
          await loadTeamsPitch(sessionId, sessionData.current_activity, sessionStage.id);
          startTimer(sessionData.current_activity, parseInt(sessionId));
        }
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading game control:', error);
      if (error.response?.status === 401) {
        navigate('/profesor/login');
      } else {
        toast.error('Error al cargar la sesión');
      }
      setLoading(false);
    }
  };

  const loadTeamsPitch = async (gameSessionId: string, activityId: number, sessionStageId: number) => {
    try {
      const teams = await sessionsAPI.getTeams(gameSessionId);
      const teamsArray: Team[] = Array.isArray(teams) ? teams : [teams];

      const persMap: Record<number, { team_name?: string }> = {};
      for (const team of teamsArray) {
        try {
          const persList = await teamPersonalizationsAPI.list({ team: team.id });
          const persResults = Array.isArray(persList) ? persList : [persList];
          if (persResults.length > 0 && persResults[0].team_name) {
            persMap[team.id] = { team_name: persResults[0].team_name };
          }
        } catch {
          // silently fail
        }
      }
      setPersonalizations(persMap);

      const teamsWithProgress: TeamPitch[] = await Promise.all(
        teamsArray.map(async (team) => {
          try {
            const progressList = await teamActivityProgressAPI.list({
              team: team.id,
              activity: activityId,
              session_stage: sessionStageId,
            });
            const progressArray = Array.isArray(progressList) ? progressList : [progressList];
            return { team, progress: progressArray[0] || null };
          } catch {
            return { team, progress: null };
          }
        })
      );

      setTeamsWithPitch(teamsWithProgress);
    } catch (error) {
      console.error('Error loading teams pitch:', error);
    }
  };

  const startTimer = async (_activityId: number, gameSessionId: number) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    try {
      const timerData = await sessionsAPI.getActivityTimer(gameSessionId);

      if (timerData.error || !timerData.timer_duration) return;

      timerDurationRef.current = timerData.timer_duration;
      timerStartTimeRef.current = timerData.started_at
        ? new Date(timerData.started_at).getTime()
        : new Date(timerData.current_time).getTime();

      const updateTimer = () => {
        if (timerStartTimeRef.current && timerDurationRef.current) {
          const now = Date.now();
          const elapsed = Math.floor((now - timerStartTimeRef.current) / 1000);
          const remaining = Math.max(0, timerDurationRef.current - elapsed);
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
        }
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);

      timerSyncIntervalRef.current = setInterval(async () => {
        try {
          const syncData = await sessionsAPI.getActivityTimer(gameSessionId);
          if (syncData.started_at && syncData.timer_duration) {
            timerStartTimeRef.current = new Date(syncData.started_at).getTime();
            timerDurationRef.current = syncData.timer_duration;
          }
        } catch {
          // silently fail
        }
      }, 5000);
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const handleNextActivity = async (_skipRequirements: boolean = false) => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const data = await sessionsAPI.nextActivity(sessionId);

      if (data.stage_completed) {
        navigate(`/profesor/resultados/${sessionId}/?stage_id=${data.stage_id}`);
      } else {
        const sessionData = await sessionsAPI.getById(sessionId);
        if (sessionData.current_stage_number === 4) {
          const currentActivityName = sessionData.current_activity_name?.toLowerCase() || '';
          if (currentActivityName.includes('presentacion') || currentActivityName.includes('presentación')) {
            navigate(`/profesor/etapa4/presentacion-pitch/${sessionId}`);
            return;
          }
        }
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error advancing activity:', error);
      toast.error('Error al avanzar: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
      setLoading(false);
    }
  };

  const handlePreview = (teamPitch: TeamPitch) => setPreviewTeam(teamPitch);
  const handleClosePreview = () => setPreviewTeam(null);

  const getTeamColorHex = (color: string) => {
    const colorMap: Record<string, string> = {
      Verde: '#28a745', Azul: '#007bff', Rojo: '#dc3545', Amarillo: '#ffc107',
      Naranja: '#fd7e14', Morado: '#6f42c1', Rosa: '#e83e8c', Cian: '#17a2b8',
      Gris: '#6c757d', Marrón: '#795548',
    };
    return colorMap[color] || '#667eea';
  };

  if (loading && !gameSession) {
    return (
      <GalacticPage className="items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
      </GalacticPage>
    );
  }

  return (
    <GalacticPage>
      <style>{ANIM_CSS}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 4</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 30, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
            Comunicación
          </div>
        </div>
        <div className="galactic-badge">{gameSession?.room_code || '---'}</div>
      </div>

      {/* Timer */}
      <TimerBlock timerRemaining={timerRemaining} activityName="Formulario de Pitch" />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 22 }}>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>Equipos Totales</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#fff' }}>
            {teamsWithPitch.length}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>en esta sesión</div>
        </div>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>Pitches Completados</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#34d399' }}>
            {teamsWithPitch.filter((tp) => tp.progress?.status === 'completed').length}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>completados</div>
        </div>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 10 }}>En Progreso</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 700, color: '#a78bfa' }}>
            {teamsWithPitch.filter((tp) => tp.progress && tp.progress.status !== 'pending').length}
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>activos</div>
        </div>
      </div>

      {/* Team grid */}
      <div style={{ marginTop: 22 }}>
        <div className="galactic-label" style={{ marginBottom: 12 }}>Estado de los equipos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
          {teamsWithPitch.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: "'Exo 2',sans-serif", padding: '32px 0' }}>
              Cargando estado de los equipos...
            </div>
          ) : (
            teamsWithPitch.map((teamPitch) => {
              const isCompleted = teamPitch.progress?.status === 'completed';
              const inProgress = teamPitch.progress?.status === 'in_progress';
              const hasPitch = teamPitch.progress !== null;
              const progress = teamPitch.progress?.progress_percentage || 0;
              const teamName = personalizations[teamPitch.team.id]?.team_name
                ? `Equipo ${personalizations[teamPitch.team.id].team_name}`
                : teamPitch.team.name;

              return (
                <div
                  key={teamPitch.team.id}
                  className="glass-card"
                  style={{
                    padding: '16px 18px',
                    borderColor: isCompleted ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.12)',
                    background: isCompleted ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)',
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: getTeamColorHex(teamPitch.team.color), flexShrink: 0 }} />
                    <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {teamName}
                    </span>
                    {isCompleted && <CheckCircle2 size={16} style={{ color: '#34d399', flexShrink: 0 }} />}
                  </div>

                  {/* Field dots */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                    {FIELD_KEYS.map((key, i) => {
                      const filled = Boolean(teamPitch.progress && teamPitch.progress[key]);
                      return (
                        <div
                          key={key}
                          title={FIELD_LABELS[i]}
                          style={{
                            width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                            background: filled ? FIELD_COLORS[i] : 'rgba(255,255,255,0.15)',
                            border: `2px solid ${filled ? FIELD_COLORS[i] : 'rgba(255,255,255,0.2)'}`,
                            boxShadow: filled ? `0 0 6px ${FIELD_COLORS[i]}` : 'none',
                            transition: 'all 0.3s',
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Progress bar */}
                  {hasPitch && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: '#34d399', transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  )}

                  {/* Status pill */}
                  <div
                    style={{
                      display: 'inline-block',
                      fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
                      letterSpacing: '1.5px', textTransform: 'uppercase' as const,
                      padding: '4px 10px', borderRadius: 50,
                      marginBottom: hasPitch ? 10 : 0,
                      ...(isCompleted
                        ? { background: 'rgba(16,185,129,0.2)', color: '#34d399' }
                        : inProgress
                        ? { background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }
                        : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }),
                    }}
                  >
                    {isCompleted ? 'Completado' : inProgress ? 'En Progreso' : 'Pendiente'}
                  </div>

                  {/* Preview button */}
                  {hasPitch && (
                    <button
                      onClick={() => handlePreview(teamPitch)}
                      style={{
                        display: 'block', width: '100%', padding: '8px 12px',
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 12,
                        fontFamily: "'Exo 2',sans-serif", cursor: 'pointer', textAlign: 'center',
                        transition: 'border-color 0.2s, color 0.2s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; }}
                    >
                      👁 Ver Pitch Completo
                    </button>
                  )}
                </div>
              );
            })
          )}
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
            disabled={loading}
            style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700,
              letterSpacing: '2px', textTransform: 'uppercase' as const,
              padding: '10px 20px', borderRadius: 50, background: '#f97316',
              color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, boxShadow: '0 0 12px rgba(249,115,22,0.35)',
            }}
          >
            ⚡ Dev Skip
          </button>
        )}
        <button
          className="btn-galactic-primary"
          onClick={() => handleNextActivity(false)}
          disabled={loading}
        >
          {loading ? 'Avanzando...' : 'Continuar Misión ▶'}
        </button>
      </div>

      {/* Preview modal */}
      {previewTeam && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div
            onClick={handleClosePreview}
            style={{ position: 'absolute', inset: 0, background: 'rgba(2,0,15,0.92)', backdropFilter: 'blur(12px)' }}
          />
          <div
            className="glass-card"
            style={{ position: 'relative', zIndex: 1, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, color: '#fff', fontWeight: 700 }}>
                Pitch — {personalizations[previewTeam.team.id]?.team_name
                  ? `Equipo ${personalizations[previewTeam.team.id].team_name}`
                  : previewTeam.team.name}
              </div>
              <button
                onClick={handleClosePreview}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8, color: 'rgba(255,255,255,0.7)', width: 32, height: 32,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>

            {previewTeam.progress ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {FIELD_KEYS.map((key, i) => {
                  const value = previewTeam.progress![key];
                  return (
                    <div key={key} style={{ borderLeft: `3px solid ${FIELD_COLORS[i]}`, paddingLeft: 14 }}>
                      <div style={{
                        fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700,
                        letterSpacing: '1.5px', textTransform: 'uppercase' as const,
                        color: FIELD_COLORS[i], marginBottom: 6,
                      }}>
                        {FIELD_LABELS[i]}
                      </div>
                      <div style={{
                        fontFamily: "'Exo 2',sans-serif", fontSize: 14, lineHeight: 1.6,
                        color: value ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                        fontStyle: value ? 'normal' : 'italic', whiteSpace: 'pre-wrap',
                      }}>
                        {value || 'No completado'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '32px 0', fontFamily: "'Exo 2',sans-serif", fontSize: 15 }}>
                Este equipo aún no ha completado el formulario de pitch.
              </div>
            )}
          </div>
        </div>
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
