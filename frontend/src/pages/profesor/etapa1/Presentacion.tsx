import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Play,
  Award,
  ClipboardList,
  Gamepad2,
  Target,
  Sparkles,
  Code,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EtapaIntroModal } from '@/components/EtapaIntroModal';
import { isDevMode } from '@/utils/devMode';
import { sessionsAPI, teamsAPI, teamPersonalizationsAPI, teamActivityProgressAPI } from '@/services';
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
}

interface ActivityProgress {
  id?: number;
  team: number;
  status: string;
  response_data?: {
    type?: string;
    correct_answers?: number;
    total_words?: number;
    tokens_earned?: number;
    answers?: Array<{ word: string; answer: string }>;
    minigame_type?: string;  // Tipo de minijuego: 'anagrama' o 'word_search'
    minigame_part?: string;  // Parte del minijuego: 'word_search' o 'anagram'
    found_words?: string[];  // Palabras encontradas en sopa de letras
    correct_words?: string[];  // Palabras correctas encontradas
    word_search_words_found?: number;
    anagram_words_found?: number;
    word_search_total_words?: number;
    anagram_total_words?: number;
    part1_completed?: boolean;  // Parte 1: Presentación
    chaos?: {
      completed?: boolean;
      questions_answered?: number;
      shown_question_ids?: number[];
    };
    general_knowledge?: {
      answers?: Array<{ question_id: number; selected: number; correct?: boolean }>;
      correct_count?: number;
      total_questions?: number;
      completed?: boolean;
      questions_data?: any[];
    };
  };
  progress_percentage?: number;
}

interface GameSession {
  id: number;
  room_code: string;
  status: string;
  current_activity_name?: string;
  current_activity?: number;
  current_stage_number?: number;
  started_at?: string;
}

export function ProfesorPresentacion() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Redirigir automáticamente si el juego está en otro estado
  useGameStateRedirect();
  
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [personalizations, setPersonalizations] = useState<Record<number, Personalization>>({});
  const [activityProgress, setActivityProgress] = useState<Record<number, ActivityProgress>>({});
  const [loading, setLoading] = useState(true);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [advancing, setAdvancing] = useState(false);
  const [showEtapaIntro, setShowEtapaIntro] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

      // Verificar si debemos mostrar la intro de la etapa
      if (sessionData.current_stage_number === 1) {
        const introKey = `etapa_intro_${sessionId}_1`;
        const hasSeenIntro = localStorage.getItem(introKey);
        if (!hasSeenIntro) {
          setShowEtapaIntro(true);
        }
      }

      // Verificar que estamos en Etapa 1
      if (sessionData.current_stage_number !== 1) {
        determineAndRedirect(sessionData);
        return;
      }

      // Verificar actividad actual
      const currentActivityName = sessionData.current_activity_name?.toLowerCase() || '';
      if (!currentActivityName.includes('presentacion') && !currentActivityName.includes('presentación')) {
        // Redirigir a la actividad correcta
        if (currentActivityName.includes('personaliz')) {
          window.location.href = `/profesor/etapa1/personalizacion/${sessionId}/`;
        } else {
          window.location.href = `/profesor/lobby/${sessionId}`;
        }
        return;
      }

      setGameSession(sessionData);

      // Obtener equipos
      const teamsList = await teamsAPI.list({ game_session: sessionId });
      const teamsData: Team[] = Array.isArray(teamsList) ? teamsList : [teamsList];
      setTeams(teamsData);

      // Obtener session_stage
      const stagesData = await sessionsAPI.getSessionStages(Number(sessionId));
      const stagesArray = Array.isArray(stagesData) ? stagesData : [stagesData];
      const sessionStageId = stagesArray.length > 0 ? stagesArray[0].id : null;

      // Obtener personalizaciones y progreso de actividad para todos los equipos
      const fetchedPersonalizations: Record<number, Personalization> = {};
      const fetchedProgress: Record<number, ActivityProgress> = {};

      for (const team of teamsData) {
        // Obtener personalización
        try {
          const persList = await teamPersonalizationsAPI.list({ team: team.id });
          const persResults = Array.isArray(persList) ? persList : [persList];
          if (persResults.length > 0) {
            fetchedPersonalizations[team.id] = persResults[0];
          }
        } catch (error) {
          console.error(`Error loading personalization for team ${team.id}:`, error);
        }

        // Obtener progreso de actividad
        if (sessionData.current_activity && sessionStageId) {
          try {
            const progressList = await teamActivityProgressAPI.list({
              team: team.id,
              activity: sessionData.current_activity,
              session_stage: sessionStageId
            });
            const progressResults = Array.isArray(progressList) ? progressList : [progressList];
            if (progressResults.length > 0) {
              const progressData = progressResults[0];
              fetchedProgress[team.id] = progressData;
            }
          } catch (error) {
            console.error(`Error loading progress for team ${team.id}:`, error);
          }
        }
      }

      setPersonalizations(fetchedPersonalizations);
      setActivityProgress(fetchedProgress);

      // Iniciar temporizador si hay actividad actual
      if (sessionData.current_activity && !timerIntervalRef.current) {
        startTimer(sessionData.current_activity, sessionData.id);
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

  const startTimer = async (activityId: number, gameSessionId: number) => {
    try {
      const timerData = await sessionsAPI.getActivityTimer(gameSessionId);

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

  const determineAndRedirect = (sessionData: GameSession) => {
    const currentStageNumber = sessionData.current_stage_number || 0;
    const currentActivityName = sessionData.current_activity_name?.toLowerCase() || '';

    if (currentStageNumber === 1) {
      if (currentActivityName.includes('personaliz')) {
        window.location.href = `/profesor/etapa1/personalizacion/${sessionId}/`;
      } else if (currentActivityName.includes('presentaci')) {
        // Ya estamos aquí
        return;
      }
    } else if (currentStageNumber === 2) {
      if (currentActivityName.includes('tema') || currentActivityName.includes('seleccionar')) {
        window.location.href = `/profesor/etapa2/seleccionar-tema/${sessionId}/`;
      } else if (currentActivityName.includes('desafío') || currentActivityName.includes('desafio')) {
                        window.location.href = `/profesor/etapa2/bubble-map/${sessionId}/`;
      } else if (currentActivityName.includes('bubble') || currentActivityName.includes('mapa')) {
        window.location.href = `/profesor/etapa2/bubble-map/${sessionId}/`;
      }
    } else if (currentStageNumber === 3) {
      window.location.href = `/profesor/etapa3/prototipo/${sessionId}/`;
    } else if (currentStageNumber === 4) {
      window.location.href = `/profesor/etapa4/formulario-pitch/${sessionId}/`;
    } else if (sessionData.status === 'finished' || sessionData.status === 'completed') {
      window.location.href = `/profesor/resultados/${sessionId}/?stage_id=${currentStageNumber}`;
    } else {
      navigate('/profesor/panel');
    }
  };

  const doAdvance = async () => {
    if (!sessionId) return;
    setAdvancing(true);
    try {
      const data = await sessionsAPI.nextActivity(sessionId);

      if (data.stage_completed) {
        toast.success(`¡${data.message}`, { duration: 2000 });
        setTimeout(() => {
          window.location.replace(`/profesor/resultados/${sessionId}/?stage_id=${data.stage_id}`);
        }, 1500);
      } else {
        const nextActivityName = data.current_activity_name?.toLowerCase() || '';
        toast.success(`¡Avanzando a la actividad de ${nextActivityName}!`, { duration: 2000 });
        setTimeout(() => {
          determineAndRedirect(data);
        }, 1500);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al avanzar a la siguiente actividad');
    } finally {
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
      <GalacticPage className="items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
      </GalacticPage>
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

  const completedTeams = teams.filter((team) => {
    const progress = activityProgress[team.id];
    return progress && progress.status === 'completed';
  }).length;

  const inProgressTeams = teams.filter((team) => {
    const progress = activityProgress[team.id];
    return progress && progress.status !== 'completed' && progress.status !== 'pending';
  }).length;

  const totalTeams = teams.length;
  const allTeamsCompleted = totalTeams > 0 && completedTeams === totalTeams;

  const completedCount = teams.filter(t => {
    const p = activityProgress[t.id];
    return p?.status === 'completed' || p?.status === 'submitted';
  }).length;

  return (
    <GalacticPage>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 1</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 30, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
            Trabajo en Equipo
          </div>
        </div>
        <div className="galactic-badge">Actividad 2</div>
      </div>

      <TimerBlock timerRemaining={timerRemaining} activityName="Presentación de Equipo" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 22 }}>
        {[
          { label: 'Equipos Listos', value: `${completedCount} / ${teams.length}`, sub: 'han completado' },
          { label: 'Actividad Actual', value: 'Presentación', sub: 'presentación + preguntas', valueStyle: { fontSize: 20, color: '#d946ef' } },
          { label: 'Código de Sala', value: gameSession?.room_code ?? '--', sub: 'para unirse', valueStyle: { letterSpacing: 4 } },
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

      <div style={{ marginTop: 22 }}>
        <div className="galactic-label" style={{ marginBottom: 12 }}>Progreso de equipos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
          {teams.map(team => {
            const prog = activityProgress[team.id];
            const done = prog?.status === 'completed' || prog?.status === 'submitted';
            const pct = prog?.progress_percentage ?? 0;
            const p = personalizations[team.id];
            return (
              <div key={team.id} className="glass-card" style={{ padding: '16px 18px', borderColor: done ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.12)', background: done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: getTeamColorHex(team.color), flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', flex: 1 }}>
                    {p?.team_name || team.name}
                  </span>
                  {done && <span style={{ fontSize: 18 }}>✅</span>}
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#7c3aed,#c026d3)', borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 15, fontWeight: 600, color: done ? '#34d399' : 'rgba(255,255,255,0.5)' }}>
                  {done ? 'Completado' : `${pct}% completado`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24, paddingBottom: 8 }}>
        <button className="btn-galactic-secondary" onClick={() => navigate('/profesor/panel')}>
          Volver al Panel
        </button>
        <button className="btn-galactic-primary" onClick={() => handleNextActivity(false)} disabled={advancing}>
          {advancing ? 'Avanzando...' : 'Avanzar Actividad ▶'}
        </button>
        {isDevMode() && (
          <button className="btn-galactic-secondary" onClick={() => handleNextActivity(true)} disabled={advancing} title="Modo Dev: Avanzar sin requisitos">
            {advancing ? 'Avanzando...' : 'Dev ▶'}
          </button>
        )}
      </div>

      {/* Modal de Introducción de Etapa */}
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
  );
}


