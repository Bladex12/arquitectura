import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Confetti } from '@/components/Confetti';
import { CancelSessionModal } from '@/components/CancelSessionModal';
import { PodiumScreen } from '@/components/PodiumScreen';
import { AdvanceConfirmModal } from '@/components/AdvanceConfirmModal';
import { GalacticPage } from '@/components/GalacticPage';
import { sessionsAPI } from '@/services';
import { toast } from 'sonner';

const fixEncoding = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .replace(/EmpatÃa/g, 'Empatía')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã/g, 'í')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã'/g, 'í')
    .replace(/Ã"/g, 'í')
    .replace(/Ã¿/g, 'ÿ')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã"/g, 'Í')
    .replace(/Ã"/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã'/g, 'Á')
    .replace(/Ã±/g, 'Ñ');
};

interface TeamResult {
  team_id: number;
  team_name: string;
  team_color: string;
  tokens_stage: number;
  tokens_total: number;
  activities_progress: Array<{ activity_name: string; status: string }>;
}

interface StageResults {
  stage_number: number;
  stage_name: string;
  teams_results: TeamResult[];
}

interface GameSession {
  id: number;
  room_code: string;
  status: string;
  current_stage_number?: number;
  current_stage_name?: string;
  current_activity_name?: string;
  current_activity?: number;
}

export function ProfesorResultadosEtapa1() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [results, setResults] = useState<StageResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Record<number, boolean>>({});
  const showResultsCalledRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stageId = searchParams.get('stage_id');

  useEffect(() => {
    if (sessionId) {
      loadResults();
      intervalRef.current = setInterval(() => { loadResults(); }, 5000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [sessionId, stageId]);

  const loadResults = async () => {
    if (!sessionId) return;
    try {
      const sessionData: GameSession = await sessionsAPI.getById(sessionId);
      setGameSession(sessionData);

      const stageIdNum = stageId ? parseInt(stageId, 10) : undefined;
      const resultsData: StageResults = await sessionsAPI.getStageResults(sessionId, stageIdNum);
      setResults(resultsData);

      if (!showResultsCalledRef.current && resultsData?.stage_number) {
        sessionsAPI.showResults(sessionId, resultsData.stage_number).catch(() => {});
        showResultsCalledRef.current = true;
      }

      try {
        const lobbyData = await sessionsAPI.getLobby(sessionId);
        const connections: Array<{ team: number; current_screen: string }> =
          lobbyData.tablet_connections ?? [];
        const stageNum = resultsData.stage_number;
        const status: Record<number, boolean> = {};
        for (const conn of connections) {
          status[conn.team] = conn.current_screen === `results_${stageNum}`;
        }
        setSyncStatus(status);
      } catch {
        // non-fatal — sync badges just won't update
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading results:', error);
      if (error.response?.status === 401) {
        navigate('/profesor/login');
      } else {
        toast.error('Error al cargar los resultados');
      }
      setLoading(false);
    }
  };

  const handleNextStage = async () => {
    if (!sessionId || !results) return;

    if (results.stage_number === 4) {
      setAdvancing(true);
      try {
        sessionsAPI.showResults(sessionId, 0).catch(() => {});
        await sessionsAPI.startReflection(sessionId);
        toast.success('Redirigiendo a reflexión...');
        navigate(`/profesor/reflexion/${sessionId}`);
      } catch (error: any) {
        console.error('Error iniciando reflexión:', error);
        toast.error('Error al iniciar reflexión. Redirigiendo de todas formas...');
        navigate(`/profesor/reflexion/${sessionId}`);
      } finally {
        setAdvancing(false);
      }
      return;
    }

    setShowConfirmModal(true);
  };

  const doAdvance = async () => {
    if (!sessionId || !results) return;

    setAdvancing(true);
    try {
      sessionsAPI.showResults(sessionId, 0).catch(() => {});
      const data = await sessionsAPI.nextStage(sessionId);
      toast.success(`¡Avanzando a ${data.message}!`, { duration: 2000 });
      setTimeout(() => {
        const nextStage = data.next_stage_number || 2;
        if (nextStage === 2) {
          window.location.replace(`/profesor/etapa2/seleccionar-tema/${sessionId}/`);
        } else if (nextStage === 3) {
          window.location.replace(`/profesor/etapa3/prototipo/${sessionId}/`);
        } else if (nextStage === 4) {
          window.location.replace(`/profesor/etapa4/formulario-pitch/${sessionId}/`);
        }
      }, 1500);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al avanzar a la siguiente etapa');
    } finally {
      setAdvancing(false);
    }
  };

  const handleFinalizeSession = () => {
    if (!sessionId) return;
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async (reason: string, reasonOther?: string) => {
    if (!sessionId) return;
    try {
      await sessionsAPI.finish(parseInt(sessionId), reason, reasonOther);
      toast.success('Sesión cancelada correctamente');
      setCancelModalOpen(false);
      setTimeout(() => { navigate('/profesor/panel'); }, 1500);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al cancelar la sesión');
    }
  };

  if (loading) {
    return (
      <GalacticPage className="items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
      </GalacticPage>
    );
  }

  if (!gameSession || !results) {
    return (
      <GalacticPage className="items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Error al cargar los resultados.</p>
          <button className="btn-galactic-secondary" onClick={() => navigate('/profesor/panel')}>Volver al Panel</button>
        </div>
      </GalacticPage>
    );
  }

  const actionButtons = (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
      <button className="btn-galactic-secondary" onClick={handleFinalizeSession}>
        Cancelar Sala
      </button>
      <button className="btn-galactic-primary" onClick={handleNextStage} disabled={advancing}>
        {advancing
          ? 'Avanzando...'
          : results.stage_number === 4
          ? 'Ir a Reflexión ▶'
          : `Ir a Etapa ${results.stage_number + 1} ▶`}
      </button>
    </div>
  );

  return (
    <>
      <Confetti active={!!results} />
      <PodiumScreen
        teams={results.teams_results}
        stageName={fixEncoding(results.stage_name)}
        onContinue={handleNextStage}
        syncStatus={syncStatus}
        actionButtons={actionButtons}
      />
      <CancelSessionModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        currentStage={gameSession?.current_stage_name}
        currentActivity={gameSession?.current_activity_name}
        roomCode={gameSession?.room_code}
      />
      <AdvanceConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false);
          doAdvance();
        }}
        title="Avanzar Etapa"
        message="Esto iniciará la siguiente etapa del juego para todos los equipos."
      />
    </>
  );
}
