import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Tablet,
  Shuffle,
  Play,
  X,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Maximize2,
  Minus,
  Plus,
  XCircle,
  Save,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CancelSessionModal } from '@/components/CancelSessionModal';
import { sessionsAPI, teamsAPI, tabletConnectionsAPI } from '@/services';
import { toast } from 'sonner';

// ─── Fisher-Yates shuffle ────────────────────────────────────────────────────
function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Team configuration palette (up to 15 teams) ────────────────────────────
const TEAM_CONFIGS: { name: string; hex: string }[] = [
  { name: 'Equipo 1',  hex: '#3B82F6' },
  { name: 'Equipo 2',  hex: '#10B981' },
  { name: 'Equipo 3',  hex: '#F59E0B' },
  { name: 'Equipo 4',  hex: '#EF4444' },
  { name: 'Equipo 5',  hex: '#8B5CF6' },
  { name: 'Equipo 6',  hex: '#EC4899' },
  { name: 'Equipo 7',  hex: '#06B6D4' },
  { name: 'Equipo 8',  hex: '#84CC16' },
  { name: 'Equipo 9',  hex: '#F97316' },
  { name: 'Equipo 10', hex: '#6366F1' },
  { name: 'Equipo 11', hex: '#14B8A6' },
  { name: 'Equipo 12', hex: '#F43F5E' },
  { name: 'Equipo 13', hex: '#A855F7' },
  { name: 'Equipo 14', hex: '#22C55E' },
  { name: 'Equipo 15', hex: '#EAB308' },
];

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface Student {
  id: number;
  full_name: string;
  email?: string;
}

interface LocalTeam {
  backendId?: number; // backend team ID for API sync (undefined for extra teams)
  name: string;
  hex: string;
  students: Student[];
}

interface Team {
  id: number;
  name: string;
  color: string;
  students_count: number;
  students?: Student[];
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
    qr_code?: string;
    status: string;
    current_stage_name?: string | null;
    current_activity_name?: string | null;
  };
  teams: Team[];
  tablet_connections: TabletConnection[];
  all_teams_connected: boolean;
  connected_teams: number;
  total_teams: number;
}

// ─── Hex color → backend color name ─────────────────────────────────────────
const HEX_TO_COLOR_NAME: Record<string, string> = {
  '#3B82F6': 'Azul',
  '#10B981': 'Verde',
  '#F59E0B': 'Amarillo',
  '#EF4444': 'Rojo',
  '#8B5CF6': 'Morado',
  '#EC4899': 'Rosa',
  '#06B6D4': 'Cian',
  '#84CC16': 'Verde',
  '#F97316': 'Naranja',
  '#6366F1': 'Morado',
  '#14B8A6': 'Cian',
  '#F43F5E': 'Rojo',
  '#A855F7': 'Morado',
  '#22C55E': 'Verde',
  '#EAB308': 'Amarillo',
};

function hexToColorName(hex: string): string {
  return HEX_TO_COLOR_NAME[hex] || 'Azul';
}

// ─── Round-robin distribute into LocalTeam slots ─────────────────────────────
function distributeStudents(
  students: Student[],
  count: number,
  existingTeams?: LocalTeam[],
): LocalTeam[] {
  const teams: LocalTeam[] = Array.from({ length: count }, (_, i) => ({
    backendId: existingTeams?.[i]?.backendId,
    name: existingTeams?.[i]?.name ?? TEAM_CONFIGS[i]?.name ?? `Equipo ${i + 1}`,
    hex: existingTeams?.[i]?.hex ?? TEAM_CONFIGS[i]?.hex ?? '#667eea',
    students: [],
  }));
  students.forEach((s, idx) => teams[idx % count].students.push(s));
  return teams;
}

// ─────────────────────────────────────────────────────────────────────────────

export function ProfesorLobby() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [lobbyData, setLobbyData] = useState<LobbyData | null>(null);
  const [loading, setLoading] = useState(true);

  // Local team state (decoupled from backend polling)
  const [localTeams, setLocalTeams] = useState<LocalTeam[]>([]);
  const [numberOfTeams, setNumberOfTeams] = useState(0);
  const initializedRef = useRef(false);

  const [draggedStudent, setDraggedStudent] = useState<{
    id: number;
    sourceTeamIdx: number;
  } | null>(null);
  const [startingGame, setStartingGame] = useState(false);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [finalizingSession, setFinalizingSession] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    document.title = `Lobby - Misión Emprende`;

    if (sessionId) {
      loadLobby();

      // Auto-refresh every 5 s — only updates lobbyData (tablets, status)
      intervalRef.current = setInterval(() => {
        loadLobby();
      }, 5000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        document.title = 'Misión Emprende';
      };
    }
  }, [sessionId]);

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

  const loadLobby = async () => {
    if (!sessionId) return;

    try {
      const data: LobbyData = await sessionsAPI.getLobby(sessionId);

      if (data.game_session.status === 'running') {
        await determineAndRedirectToActivity(parseInt(sessionId));
        return;
      }

      setLobbyData(data);
      setLoading(false);

      if (!initializedRef.current) {
        // First load: full initialization
        initializedRef.current = true;
        const initTeams: LocalTeam[] = data.teams.map((team) => ({
          backendId: team.id,
          name: team.name,
          hex: getTeamColorHex(team.color),
          students: team.students ?? [],
        }));
        setLocalTeams(initTeams);
        setNumberOfTeams(data.teams.length);
      } else {
        // Subsequent polls: ONLY sync name and color — never touch students (preserves drag-and-drop)
        setLocalTeams((prev) =>
          prev.map((localTeam) => {
            const backendTeam = data.teams.find((t) => t.id === localTeam.backendId);
            if (!backendTeam) return localTeam;
            return {
              ...localTeam,
              name: backendTeam.name,
              hex: getTeamColorHex(backendTeam.color),
            };
          })
        );
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        navigate('/profesor/login');
      } else if (error.response?.status === 403) {
        toast.error('La sesión ya ha finalizado');
        setTimeout(() => navigate('/profesor/panel'), 3000);
      } else {
        toast.error('Error al cargar el lobby');
      }
      setLoading(false);
    }
  };

  const determineAndRedirectToActivity = async (sessionId: number) => {
    try {
      const gameData = await sessionsAPI.getById(sessionId);

      const currentActivityName = gameData.current_activity_name;
      const currentActivityId = gameData.current_activity;
      const currentStageNumber = gameData.current_stage_number;

      if (!currentStageNumber && !currentActivityName) {
        window.location.href = `/profesor/etapa1/video-institucional/${sessionId}/`;
        return;
      }

      if (!currentActivityName || !currentActivityId) {
        if (currentStageNumber) {
          window.location.href = `/profesor/resultados/${sessionId}/?stage_id=${currentStageNumber}`;
        } else {
          navigate('/profesor/panel');
        }
        return;
      }

      const normalizedActivityName = currentActivityName.toLowerCase().trim();
      let redirectUrl = '';

      if (currentStageNumber === 1) {
        if (normalizedActivityName.includes('video') || normalizedActivityName.includes('institucional')) {
          redirectUrl = `/profesor/etapa1/video-institucional/${sessionId}/`;
        } else if (normalizedActivityName.includes('instructivo') || normalizedActivityName.includes('instrucciones')) {
          redirectUrl = `/profesor/etapa1/instructivo/${sessionId}/`;
        } else if (normalizedActivityName.includes('personaliz')) {
          redirectUrl = `/profesor/etapa1/personalizacion/${sessionId}/`;
        } else if (normalizedActivityName.includes('presentaci')) {
          redirectUrl = `/profesor/etapa1/presentacion/${sessionId}/`;
        }
      } else if (currentStageNumber === 2) {
        if (normalizedActivityName.includes('tema') || normalizedActivityName.includes('seleccionar') || normalizedActivityName.includes('desafio') || normalizedActivityName.includes('desafío')) {
          redirectUrl = `/profesor/etapa2/seleccionar-tema/${sessionId}/`;
        } else if (normalizedActivityName.includes('bubble') || normalizedActivityName.includes('mapa')) {
          redirectUrl = `/profesor/etapa2/bubble-map/${sessionId}/`;
        }
      } else if (currentStageNumber === 3) {
        if (normalizedActivityName.includes('prototipo')) {
          redirectUrl = `/profesor/etapa3/prototipo/${sessionId}/`;
        }
      } else if (currentStageNumber === 4) {
        if (normalizedActivityName.includes('pitch') && normalizedActivityName.includes('formulario')) {
          redirectUrl = `/profesor/etapa4/formulario-pitch/${sessionId}/`;
        } else if (normalizedActivityName.includes('confirmar') && normalizedActivityName.includes('orden')) {
          redirectUrl = `/profesor/etapa4/confirmar-orden-pitch/${sessionId}/`;
        } else if (normalizedActivityName.includes('pitch') && normalizedActivityName.includes('presentacion')) {
          redirectUrl = `/profesor/etapa4/presentacion-pitch/${sessionId}/`;
        }
      }

      if (redirectUrl) window.location.href = redirectUrl;
    } catch (error) {
      console.error('Error determining activity:', error);
    }
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

  const copyToClipboard = async (roomCode: string) => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success('Código copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Error al copiar el código');
    }
  };

  // ─── Team count control ─────────────────────────────────────────────────────
  const handleNumTeamsChange = (delta: number) => {
    const newCount = Math.min(15, Math.max(2, numberOfTeams + delta));
    if (newCount === numberOfTeams) return;
    setNumberOfTeams(newCount);
    // Redistribute current students into new count without shuffling
    const allStudents = localTeams.flatMap((t) => t.students);
    setLocalTeams(distributeStudents(allStudents, newCount, localTeams));
  };

  // ─── Drag & Drop (index-based, purely local) ─────────────────────────────────
  const handleDragStart = (studentId: number, sourceTeamIdx: number) => {
    setDraggedStudent({ id: studentId, sourceTeamIdx });
  };

  const handleDragEnd = () => {
    setDraggedStudent(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetTeamIdx: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedStudent || draggedStudent.sourceTeamIdx === targetTeamIdx) {
      setDraggedStudent(null);
      return;
    }

    const studentId = draggedStudent.id;
    const sourceTeamIdx = draggedStudent.sourceTeamIdx;
    const sourceTeam = localTeams[sourceTeamIdx];
    const student = sourceTeam?.students.find((s) => s.id === studentId);

    if (!student) { setDraggedStudent(null); return; }

    // Optimistic local update
    setLocalTeams((prev) =>
      prev.map((team, idx) => {
        if (idx === sourceTeamIdx) {
          return { ...team, students: team.students.filter((s) => s.id !== studentId) };
        }
        if (idx === targetTeamIdx) {
          return { ...team, students: [...team.students, student] };
        }
        return team;
      }),
    );
    setDraggedStudent(null);

    // Sync with backend if both teams have a backend ID
    const srcBackendId = sourceTeam.backendId;
    const tgtBackendId = localTeams[targetTeamIdx]?.backendId;
    if (srcBackendId && tgtBackendId) {
      try {
        await teamsAPI.moveStudent(srcBackendId, studentId, tgtBackendId);
        toast.success('Estudiante movido', {
          duration: 1500,
          style: { fontSize: '0.875rem', padding: '0.5rem 0.75rem' },
        });
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Error al mover el estudiante', { duration: 2000 });
        // Revert
        setLocalTeams((prev) =>
          prev.map((team, idx) => {
            if (idx === sourceTeamIdx) return { ...team, students: [...team.students, student] };
            if (idx === targetTeamIdx) return { ...team, students: team.students.filter((s) => s.id !== studentId) };
            return team;
          }),
        );
      }
    }
  };

  // ─── Disconnect tablet ────────────────────────────────────────────────────────
  const disconnectTablet = async (connectionId: number) => {
    if (!confirm('¿Desconectar esta tablet?')) return;
    try {
      await tabletConnectionsAPI.disconnect(connectionId);
      toast.success('Tablet desconectada exitosamente');
      setTimeout(() => loadLobby(), 1000);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al desconectar tablet');
    }
  };

  // ─── Build sync payload from current localTeams ──────────────────────────────
  const buildTeamsPayload = () =>
    localTeams.map((team) => ({
      ...(team.backendId ? { id: team.backendId } : {}),
      name: team.name,
      color: hexToColorName(team.hex),
      student_ids: team.students.map((s) => s.id),
    }));

  // ─── Sync teams to backend (Guardar Configuración) ────────────────────────────
  const handleSyncTeams = async () => {
    if (!sessionId) return;
    setIsSyncing(true);
    try {
      const data = await sessionsAPI.syncTeams(sessionId, buildTeamsPayload());
      // Actualizar backendIds de equipos nuevos creados en el servidor
      setLocalTeams((prev) =>
        prev.map((local, idx) => {
          if (local.backendId) return local;
          const created = data.teams[idx];
          return created ? { ...local, backendId: created.id } : local;
        })
      );
      toast.success('Configuración guardada', { duration: 2000 });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al guardar la configuración');
    } finally {
      setIsSyncing(false);
    }
  };

  // ─── Shuffle all teams (revolver + guardar automáticamente) ───────────────────
  const shuffleAllTeams = async () => {
    const allStudents = localTeams.flatMap((t) => t.students);
    if (allStudents.length === 0) { toast.error('No hay estudiantes para reorganizar'); return; }

    const shuffled = fisherYates(allStudents);
    const newTeams = distributeStudents(shuffled, numberOfTeams, localTeams);
    setLocalTeams(newTeams);
    toast.success('¡Estudiantes revueltos!', { duration: 1500 });

    // Auto-guardar tras revolver para mantener el backend sincronizado
    setShuffling(true);
    try {
      const payload = newTeams.map((team) => ({
        ...(team.backendId ? { id: team.backendId } : {}),
        name: team.name,
        color: hexToColorName(team.hex),
        student_ids: team.students.map((s) => s.id),
      }));
      await sessionsAPI.syncTeams(sessionId, payload);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al sincronizar con el servidor');
    } finally {
      setShuffling(false);
    }
  };

  // ─── Launch modal: abre confirmación ─────────────────────────────────────────
  const startGame = () => {
    setIsLaunchModalOpen(true);
  };

  // ─── Confirm launch: lógica real de inicio ────────────────────────────────────
  const confirmLaunch = async () => {
    setIsLaunchModalOpen(false);
    setStartingGame(true);
    try {
      // Pre-launch sync: garantiza que el backend refleje exactamente el Lobby actual
      await sessionsAPI.syncTeams(sessionId, buildTeamsPayload());
      await sessionsAPI.start(sessionId);
      toast.success('¡Juego iniciado exitosamente! Redirigiendo al video institucional...');
      window.location.href = `/profesor/etapa1/video-institucional/${sessionId}/`;
    } catch (error: any) {
      console.error('❌ Error al iniciar juego:', error);
      toast.error(error.response?.data?.error || 'Error al iniciar el juego');
      setStartingGame(false);
    }
  };

  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const finalizeSession = async () => {
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async (reason: string, reasonOther?: string) => {
    setFinalizingSession(true);
    try {
      const data = await sessionsAPI.finish(Number(sessionId), reason, reasonOther);
      toast.success(`¡Sesión cancelada exitosamente! Se desconectaron ${data.tablets_disconnected || 0} tablets.`);
      setCancelModalOpen(false);
      setTimeout(() => navigate('/profesor/panel'), 2000);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al cancelar la sesión');
      setFinalizingSession(false);
    }
  };

  // ─── Loading / error states ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F0E8' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#0F172A' }} />
      </div>
    );
  }

  if (!lobbyData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F0E8' }}>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700 mb-4">Error al cargar el lobby</p>
          <Button onClick={() => navigate('/profesor/panel')}>Volver al Panel</Button>
        </div>
      </div>
    );
  }

  const { game_session, tablet_connections, all_teams_connected } = lobbyData;

  const connectedCount = tablet_connections.filter((tc) => tc.is_connected).length;
  const connectionProgress = localTeams.length > 0 ? (connectedCount / localTeams.length) * 100 : 0;

  const joinUrl = `${window.location.origin}/tablet/join/${game_session.room_code}`;
  const joinUrlShort = `misionemprende.cl/tablet/join/${game_session.room_code}`;

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── QR Modal ── */}
      {isQrModalOpen && game_session.qr_code && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-8"
          onClick={() => setIsQrModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-4"
            style={{ width: 'min(80vh, 90vw)', maxWidth: 600 }}
          >
            <img
              src={game_session.qr_code}
              alt="QR Code"
              className="w-full h-full object-contain rounded-2xl"
            />
            <p
              className="text-2xl font-black tracking-widest text-slate-800"
              style={{ fontFamily: 'Unbounded, sans-serif' }}
            >
              {game_session.room_code}
            </p>
            <p className="text-sm text-slate-500">{joinUrlShort}</p>
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" /> Cerrar
            </button>
          </motion.div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Botón de regreso + cancelar sesión */}
        <div className="mb-5 flex items-center justify-between">
          <button
            onClick={() => navigate('/profesor/panel')}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Panel
          </button>
          <button
            onClick={finalizeSession}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-600 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Cancelar sesión
          </button>
        </div>

        {/* Header */}
        <div className="mb-5">
          <h1
            className="text-xl sm:text-2xl font-black text-slate-900"
            style={{ fontFamily: 'Unbounded, sans-serif' }}
          >
            Lobby de Sala
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestiona equipos y tablets antes de iniciar</p>
        </div>

        {/* ── Card principal ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 mb-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-5">

            {/* QR clickeable */}
            {game_session.qr_code && (
              <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <div
                  className="cursor-pointer hover:scale-105 transition-transform relative group"
                  onClick={() => setIsQrModalOpen(true)}
                  title="Clic para ampliar"
                >
                  <img
                    src={game_session.qr_code}
                    alt="QR Code"
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border border-slate-200 shadow-sm"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors flex items-center justify-center">
                    <Maximize2 className="w-6 h-6 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Clic para ampliar</p>
              </div>
            )}

            {/* Código + link + conexiones */}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-2xl sm:text-3xl font-black tracking-widest text-slate-900"
                  style={{ fontFamily: 'Unbounded, sans-serif' }}
                >
                  {game_session.room_code}
                </span>
                <button
                  onClick={() => copyToClipboard(game_session.room_code)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors flex-shrink-0"
                  title="Copiar código"
                >
                  {copied
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    : <Copy className="w-4 h-4 text-slate-600" />}
                </button>
              </div>

              <a
                href={joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium text-xs sm:text-sm break-all hover:underline block"
              >
                {joinUrlShort}
              </a>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  {connectedCount}/{localTeams.length} tablets
                </span>
                <div className="flex-1 bg-slate-200 rounded-full h-1.5 max-w-[180px] overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-500 rounded-full"
                    style={{ width: `${connectionProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Botón Iniciar */}
            <div className="w-full lg:w-auto flex-shrink-0">
              <button
                onClick={startGame}
                disabled={!all_teams_connected || startingGame}
                className={`w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
                  all_teams_connected && !startingGame
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:shadow-md'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                style={
                  all_teams_connected && !startingGame
                    ? { fontFamily: 'Unbounded, sans-serif', letterSpacing: '0.04em' }
                    : {}
                }
              >
                {startingGame ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando…</>
                ) : all_teams_connected ? (
                  <><Play className="w-4 h-4" /> Lanzar Misión</>
                ) : (
                  <><Tablet className="w-4 h-4" /> Esperando tablets…</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Panel de reorganización ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 mb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

            {/* Control de cantidad de equipos */}
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Cantidad de Equipos
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleNumTeamsChange(-1)}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-4 h-4 text-slate-700" />
                  </button>
                  <span
                    className="w-10 text-center text-xl font-black text-slate-900"
                    style={{ fontFamily: 'Unbounded, sans-serif' }}
                  >
                    {numberOfTeams}
                  </span>
                  <button
                    onClick={() => handleNumTeamsChange(1)}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4 text-slate-700" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed hidden sm:block">
                Ajusta cuántos equipos quieres y revuelve para redistribuir.
              </p>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Revolver */}
              <button
                onClick={shuffleAllTeams}
                disabled={shuffling || isSyncing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-50 border border-blue-100 text-blue-700 text-sm font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                {shuffling
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Shuffle className="w-4 h-4" />}
                Revolver
              </button>

              {/* Guardar Configuración */}
              <button
                onClick={handleSyncTeams}
                disabled={isSyncing || shuffling}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-sm"
              >
                {isSyncing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>

        {/* Hint arrastrar */}
        <p className="text-xs text-slate-500 text-center mb-5">
          Arrastra estudiantes entre equipos para ajustar manualmente
        </p>

        {/* ── Equipos en Grid (dinámico) ── */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 ${
            localTeams.length <= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
          }`}
        >
          {localTeams.map((team, idx) => {
            // Tablet connection: match by backend team ID
            const tabletConnection = team.backendId
              ? tablet_connections.find((tc) => tc.team === team.backendId)
              : undefined;
            const isConnected = tabletConnection?.is_connected || false;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 border-l-4"
                style={{ borderLeftColor: team.hex }}
              >
                {/* Header del equipo */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="px-3 py-1 rounded-full text-white text-xs font-bold"
                    style={{ backgroundColor: team.hex }}
                  >
                    {team.name}
                  </div>

                  <button
                    onClick={() => tabletConnection && disconnectTablet(tabletConnection.id)}
                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                      isConnected
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                    title={isConnected ? 'Tablet conectada — clic para desconectar' : 'Sin tablet'}
                  >
                    <Tablet className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Lista de estudiantes (drop zone) */}
                <div
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragOver={handleDragOver}
                  className="space-y-1.5 mb-3 min-h-[140px]"
                >
                  {team.students.length > 0 ? (
                    team.students.map((student) => (
                      <div
                        key={student.id}
                        draggable
                        onDragStart={() => handleDragStart(student.id, idx)}
                        onDragEnd={handleDragEnd}
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 cursor-move transition-all"
                        title={`${student.full_name} — arrastra para mover`}
                      >
                        <div
                          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: team.hex }}
                        >
                          {getInitials(student.full_name)}
                        </div>
                        <span className="flex-1 text-xs text-slate-700 truncate font-medium">
                          {getShortName(student.full_name)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-400 py-6 text-xs italic">
                      Sin estudiantes
                    </div>
                  )}
                </div>

                <div className="text-center text-xs font-semibold text-slate-400">
                  {team.students.length} estudiante{team.students.length !== 1 ? 's' : ''}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Modal de Cancelación */}
      <CancelSessionModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        currentStage={lobbyData?.game_session?.current_stage_name}
        currentActivity={lobbyData?.game_session?.current_activity_name}
        roomCode={lobbyData?.game_session?.room_code}
      />

      {/* ── Modal Confirmar Lanzamiento ── */}
      {isLaunchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setIsLaunchModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center"
          >
            {/* Ícono */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                <Rocket className="w-8 h-8 text-slate-800" />
              </div>
            </div>

            {/* Título */}
            <h2
              className="text-xl font-bold text-slate-800 mb-2"
              style={{ fontFamily: 'Unbounded, sans-serif' }}
            >
              Confirmar Lanzamiento
            </h2>

            {/* Descripción */}
            <p className="text-slate-500 mb-8 text-sm leading-relaxed">
              ¿Iniciar el juego? Todos los equipos deben tener su tablet o
              dispositivo conectado.
            </p>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => setIsLaunchModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmLaunch}
                className="flex-1 py-3 px-4 rounded-xl text-white bg-slate-900 hover:bg-slate-800 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                style={{ fontFamily: 'Unbounded, sans-serif', letterSpacing: '0.03em' }}
              >
                <Rocket className="w-4 h-4" />
                Lanzar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
