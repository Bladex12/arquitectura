import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Plus, History, Target, BookOpen, LogOut, GraduationCap,
  Users, FileSpreadsheet, Loader2, ChevronDown, Trophy, Play, Shield,
  Upload, X, BarChart2, Zap, Menu, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { CancelSessionModal } from '@/components/CancelSessionModal';
import { authAPI, sessionsAPI, teamsAPI } from '@/services';
import { toast } from 'sonner';

// ─── Estructura académica UDD (hardcoded) ─────────────────────────────────────
const uddStructure: Record<string, string[]> = {
  'Arquitectura y Arte': ['Arquitectura'],
  'Comunicaciones': ['Cine y Comunicación Audiovisual', 'Periodismo', 'Publicidad'],
  'Derecho': ['Derecho'],
  'Diseño': ['Diseño de Espacios y Objetos', 'Diseño de Interacción Digital', 'Diseño Gráfico', 'Diseño de Modas y Gestión'],
  'Economía y Negocios': ['Ingeniería Comercial', 'Global Business Administration'],
  'Educación': ['Pedagogía en Educación Básica', 'Pedagogía en Educación de Párvulos'],
  'Gobierno': ['Ciencia Política y Políticas Públicas'],
  'Ingeniería': ['Ingeniería Civil Plan Común', 'Ingeniería Civil Industrial', 'Ingeniería Civil en Obras Civiles', 'Ingeniería Civil en Minería', 'Ingeniería Civil en Informática e Innovación Tecnológica', 'Ingeniería Civil en Informática e Inteligencia Artificial', 'Ingeniería Civil en BioMedicina', 'Geología'],
  'Medicina y Ciencias de la Salud': ['Enfermería', 'Fonoaudiología', 'Kinesiología', 'Medicina', 'Nutrición y Dietética', 'Obstetricia', 'Odontología', 'Tecnología Médica', 'Terapia Ocupacional'],
  'Psicología': ['Psicología'],
};
const FACULTADES = Object.keys(uddStructure);
const SECCIONES = ['Sección 1', 'Sección 2', 'Sección 3', 'Sección 4', 'Sección 5'];

// ─── Brand tokens ────────────────────────────────────────────────────────────
const B = {
  navy: '#0F172A',
  blue: '#2563EB',
  red: '#FF3D2E',
  amber: '#F5A623',
  cream: '#F5F0E8',
  sidebar: '#0F172A',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Professor {
  id: number;
  full_name?: string;
  user?: { username: string; first_name?: string; last_name?: string };
}
interface GameSession {
  id: number;
  room_code: string;
  status: 'lobby' | 'running' | 'completed' | 'cancelled';
  course_name?: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  current_stage_name?: string;
  current_stage_number?: number;
  current_activity_name?: string;
  current_stage?: { id: number };
}
interface Team {
  id: number; name: string; tokens?: number;
  student_count?: number; color?: string;
  personalization?: { team_name?: string; color?: string };
}

type Section = 'dashboard' | 'nueva-sesion';

// ─── Sidebar nav item ─────────────────────────────────────────────────────────
function NavItem({
  icon: Icon, label, active, onClick, badge,
}: {
  icon: React.ElementType; label: string; active?: boolean; onClick: () => void; badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
        transition-all duration-150 group text-left
        ${active
          ? 'bg-white/10 text-white'
          : 'text-white/50 hover:text-white/90 hover:bg-white/5'
        }
      `}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`} />
      <span className="flex-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
      {badge && (
        <span
          className="text-[10px] font-black px-2 py-0.5 rounded-full"
          style={{ background: B.red, color: 'white', fontFamily: 'Unbounded, sans-serif' }}
        >
          {badge}
        </span>
      )}
      {active && <div className="w-1 h-4 rounded-full bg-white/60" />}
    </button>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, color, delay,
}: { icon: React.ElementType; label: string; value: string | number; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-xs text-gray-500 font-medium mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {label}
      </p>
      <p
        className="text-3xl font-black"
        style={{ fontFamily: 'Unbounded, sans-serif', color: B.navy }}
      >
        {value}
      </p>
    </motion.div>
  );
}

// ─── Team card ────────────────────────────────────────────────────────────────
function TeamCard({ team, phaseLabel }: { team: Team; phaseLabel: string }) {
  const name = team.personalization?.team_name || team.name || `Equipo ${team.id}`;
  const tokens = team.tokens ?? 0;
  const maxTokens = 200;
  const progress = Math.min(100, Math.round((tokens / maxTokens) * 100));
  const accent = team.personalization?.color || team.color || B.blue;

  return (
    <div
      className="bg-white rounded-xl p-4 border-l-4 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-sm text-[#0F172A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {name}
          </p>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">{phaseLabel}</p>
        </div>
        <div className="text-right">
          <p className="font-black text-base" style={{ fontFamily: 'Unbounded, sans-serif', color: B.amber }}>
            {tokens}
          </p>
          <p className="text-[9px] text-gray-400">tokens</p>
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: accent }}
        />
      </div>
      <p className="text-[10px] text-gray-400 mt-1 text-right">{progress}% de tokens máx.</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ProfesorPanel() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Auth / data state ──
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [activeSessions, setActiveSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sessions: 0, students: 0 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);

  // ── UI state ──
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Create-session form state ──
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedCareer, setSelectedCareer] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Cancel modal state ──
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [sessionToCancel, setSessionToCancel] = useState<{
    id: number; roomCode: string; currentStage?: string | null; currentActivity?: string | null;
  } | null>(null);


  // ── Helpers ──────────────────────────────────────────────────────────────
  const getSessionLocation = (s: GameSession): string => {
    if (s.status === 'lobby') return 'Lobby';
    if (s.status === 'running') {
      const n = s.current_stage_number || 1;
      const a = (s.current_activity_name || '').toLowerCase();
      if (n === 1) {
        if (a.includes('video') || a.includes('institucional')) return 'Etapa 1 – Video';
        if (a.includes('instructivo')) return 'Etapa 1 – Instructivo';
        if (a.includes('personaliz')) return 'Etapa 1 – Personalización';
        if (a.includes('presentaci')) return 'Etapa 1 – Presentación';
        return 'Etapa 1 – Video';
      }
      if (n === 2) return a.includes('bubble') ? 'Etapa 2 – Bubble Map' : 'Etapa 2 – Tema';
      if (n === 3) return 'Etapa 3 – Prototipo';
      if (n === 4) {
        if (a.includes('presentaci')) return 'Etapa 4 – Pitch';
        if (a.includes('formulario')) return 'Etapa 4 – Formulario';
        if (a.includes('reflexi')) return 'Etapa 4 – Reflexión';
        return 'Etapa 4 – Resultados';
      }
    }
    return 'Sesión activa';
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; bg: string; text: string }> = {
      lobby:     { label: 'Lobby',      bg: '#FEF9C3', text: '#A16207' },
      running:   { label: 'En curso',   bg: '#DCFCE7', text: '#15803D' },
      completed: { label: 'Completada', bg: '#DBEAFE', text: '#1D4ED8' },
      cancelled: { label: 'Cancelada',  bg: '#FEE2E2', text: '#B91C1C' },
    };
    return map[status] || { label: status, bg: '#F3F4F6', text: '#4B5563' };
  };

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadTeams = useCallback(async (sessionId: number) => {
    try {
      const data = await teamsAPI.list({ game_session: sessionId });
      setTeams(Array.isArray(data) ? data : []);
    } catch {
      setTeams([]);
    }
  }, []);

  const loadActiveSession = useCallback(async () => {
    try {
      const activeData = await sessionsAPI.getActiveSession();
      if (activeData?.active_sessions && Array.isArray(activeData.active_sessions)) {
        const activeOnly = activeData.active_sessions.filter(
          (s: any) => s.status === 'running' || s.status === 'lobby'
        );
        setActiveSessions(activeOnly);
        setActiveSession(activeOnly[0] || null);
        if (activeOnly[0]) loadTeams(activeOnly[0].id);
      } else if (activeData?.active_session || (activeData?.room_code && activeData?.id)) {
        const session = activeData.active_session || activeData;
        if (session.status !== 'running' && session.status !== 'lobby') {
          setActiveSession(null); setActiveSessions([]);
        } else {
          setActiveSession(session);
          setActiveSessions(session ? [session] : []);
          if (session) loadTeams(session.id);
        }
      } else {
        setActiveSession(null); setActiveSessions([]); setTeams([]);
      }
    } catch {
      setActiveSession(null); setActiveSessions([]); setTeams([]);
    }
  }, [loadTeams]);

  const loadPanelData = async () => {
    setLoading(true);
    try {
      const [activeData, sessionsList, statsData] = await Promise.all([
        sessionsAPI.getActiveSession().catch(() => null),
        sessionsAPI.list().catch(() => []),
        authAPI.getStats().catch(() => ({ sessions: 0, students: 0 })),
      ]);

      if (activeData?.active_sessions && Array.isArray(activeData.active_sessions)) {
        const activeOnly = activeData.active_sessions.filter(
          (s: any) => s.status === 'running' || s.status === 'lobby'
        );
        setActiveSessions(activeOnly);
        setActiveSession(activeOnly[0] || null);
        if (activeOnly[0]) loadTeams(activeOnly[0].id);
      } else if (activeData?.active_session || (activeData?.room_code && activeData?.id)) {
        const session = activeData.active_session || activeData;
        if (session.status === 'running' || session.status === 'lobby') {
          setActiveSession(session);
          setActiveSessions([session]);
          loadTeams(session.id);
        } else {
          setActiveSession(null); setActiveSessions([]);
        }
      } else {
        setActiveSession(null); setActiveSessions([]);
      }

      setSessions(Array.isArray(sessionsList) ? sessionsList : []);
      setStats({ sessions: statsData?.sessions || 0, students: statsData?.students || 0 });
    } catch {
      toast.error('Error al cargar el panel');
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = async () => {
    if (!localStorage.getItem('authToken')) { navigate('/profesor/login'); return; }
    try {
      const profile = await authAPI.getProfile();
      setProfessor(profile);
      try { await authAPI.getAdminProfile(); setIsAdmin(true); } catch { setIsAdmin(false); }
      await loadPanelData();
    } catch {
      localStorage.removeItem('authToken'); localStorage.removeItem('refreshToken');
      navigate('/profesor/login');
    }
  };

  useEffect(() => { checkAuth(); }, []);
  useEffect(() => {
    if (location.pathname === '/profesor/tutorial') navigate('/profesor/tutorial');
  }, [location.pathname]);

  // Polling when active session exists
  useEffect(() => {
    if (loading || (!activeSession && activeSessions.length === 0)) return;
    const interval = setInterval(loadActiveSession, 5000);
    return () => clearInterval(interval);
  }, [loading, activeSession?.id, activeSessions.length, loadActiveSession]);

  // ── Session creation ──────────────────────────────────────────────────────
  const handleFacultyChange = (val: string) => {
    setSelectedFaculty(val);
    setSelectedCareer('');
    setSelectedCourse('');
  };

  const handleCareerChange = (val: string) => {
    setSelectedCareer(val);
    setSelectedCourse('');
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty || !selectedCareer || !selectedCourse) {
      toast.error('Completa Facultad, Carrera y Sección');
      return;
    }
    if (!excelFile) { toast.error('Sube el archivo Excel'); return; }

    setCreatingSession(true);
    try {
      const formData = new FormData();
      formData.append('file', excelFile);
      formData.append('faculty_name', selectedFaculty);
      formData.append('career_name', selectedCareer);
      formData.append('course_name', selectedCourse);
      formData.append('min_team_size', '3');
      formData.append('max_team_size', '8');
      const data = await sessionsAPI.createWithExcel(formData);
      toast.success(
        `¡Sala creada! Código: ${data.game_session.room_code}. ` +
        `${data.students_processed} estudiantes, ${data.teams_created} equipos.`
      );
      await loadActiveSession();
      setTimeout(() => navigate(`/profesor/lobby/${data.game_session.id}`), 1800);
    } catch (error: any) {
      const d = error.response?.data;
      if (d?.error === 'Ya tienes una sesión activa' && d.active_session_id) {
        toast.error('Ya tienes una sesión activa', {
          description: `Sala: ${d.active_session_room_code}`,
        });
      } else {
        toast.error(d?.error || 'Error al crear la sesión');
      }
    } finally {
      setCreatingSession(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken'); localStorage.removeItem('refreshToken');
    navigate('/profesor/login');
  };

  // ── Continue / cancel session ─────────────────────────────────────────────
  const continueActiveSession = async () => {
    if (!activeSession) return;
    if (activeSession.status === 'lobby') {
      navigate(`/profesor/lobby/${activeSession.id}`);
      return;
    }
    const a = (activeSession.current_activity_name || '').toLowerCase();
    const n = activeSession.current_stage_number || 1;
    let url = '';
    if (n === 1) {
      if (a.includes('video') || a.includes('institucional')) url = `/profesor/etapa1/video-institucional/${activeSession.id}`;
      else if (a.includes('instructivo')) url = `/profesor/etapa1/instructivo/${activeSession.id}`;
      else if (a.includes('personaliz')) url = `/profesor/etapa1/personalizacion/${activeSession.id}`;
      else if (a.includes('presentaci')) url = `/profesor/etapa1/presentacion/${activeSession.id}`;
      else url = `/profesor/etapa1/personalizacion/${activeSession.id}`;
    } else if (n === 2) {
      url = a.includes('bubble') ? `/profesor/etapa2/bubble-map/${activeSession.id}` : `/profesor/etapa2/seleccionar-tema/${activeSession.id}`;
    } else if (n === 3) {
      url = `/profesor/etapa3/prototipo/${activeSession.id}`;
    } else if (n === 4) {
      if (!a || a.trim() === '') {
        try {
          const stagesData = await sessionsAPI.getSessionStages(activeSession.id);
          const stage4 = Array.isArray(stagesData) ? stagesData.find((s: any) => s.stage_number === 4) : null;
          if (stage4?.presentation_timestamps?._reflection) {
            url = `/profesor/reflexion/${activeSession.id}`;
          } else {
            url = `/profesor/resultados/${activeSession.id}/?stage_id=${stage4?.stage || 4}`;
          }
        } catch { url = `/profesor/resultados/${activeSession.id}/?stage_id=4`; }
      } else if (a.includes('presentaci')) url = `/profesor/etapa4/presentacion-pitch/${activeSession.id}`;
      else url = `/profesor/etapa4/formulario-pitch/${activeSession.id}`;
    } else {
      url = `/profesor/etapa1/personalizacion/${activeSession.id}`;
    }
    navigate(url);
  };

  const handleFinishSessionById = (sessionId: number, roomCode: string, currentStage?: string | null, currentActivity?: string | null) => {
    setSessionToCancel({ id: sessionId, roomCode, currentStage, currentActivity });
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async (reason: string, reasonOther?: string) => {
    if (!sessionToCancel) return;
    try {
      const response = await sessionsAPI.finish(sessionToCancel.id, reason, reasonOther);
      toast.success(`Sala ${sessionToCancel.roomCode} cancelada. ${response?.tablets_disconnected || 0} tablets desconectadas.`);
      setCancelModalOpen(false); setSessionToCancel(null);
      await loadPanelData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al cancelar la sesión');
    }
  };

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setExcelFile(file);
    } else {
      toast.error('Solo se aceptan archivos .xlsx o .xls');
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const firstName = professor?.user?.first_name || '';
  const lastName = professor?.user?.last_name || '';
  const displayName = `${firstName} ${lastName}`.trim() || professor?.full_name || professor?.user?.username || 'Profesor';
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '?';
  const recentSessions = sessions
    .filter((s) => !activeSession || s.id !== activeSession.id)
    .filter((s) => s.status !== 'lobby' && s.status !== 'running')
    .slice(0, 6);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: B.cream, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full"
            style={{ borderWidth: '3px' }}
          />
          <p className="text-gray-400 text-sm font-medium">Cargando panel…</p>
        </div>
      </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: B.cream, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ═══════════════════════════════════════════ SIDEBAR */}
      {/* Overlay for mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ width: '240px', background: B.sidebar }}
      >
        {/* Sidebar header */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <img src="/images/logoudd.png" alt="UDD" className="h-5 brightness-0 invert object-contain" />
            </div>
            <div className="min-w-0">
              <p
                className="text-white text-[11px] font-black leading-tight truncate"
                style={{ fontFamily: 'Unbounded, sans-serif' }}
              >
                Misión Emprende
              </p>
              <p className="text-white/40 text-[9px] uppercase tracking-widest">Profesores</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavItem
            icon={LayoutDashboard}
            label="Dashboard"
            active={currentSection === 'dashboard'}
            onClick={() => { setCurrentSection('dashboard'); setSidebarOpen(false); }}
          />
          <NavItem
            icon={Plus}
            label="Nueva Sesión"
            active={currentSection === 'nueva-sesion'}
            onClick={() => { setCurrentSection('nueva-sesion'); setSidebarOpen(false); }}
          />
          <div className="h-px bg-white/5 my-2" />
          <NavItem
            icon={History}
            label="Historial"
            onClick={() => { navigate('/profesor/historial'); setSidebarOpen(false); }}
          />
          <NavItem
            icon={Target}
            label="Objetivos"
            onClick={() => { navigate('/profesor/objetivos'); setSidebarOpen(false); }}
          />
          <NavItem
            icon={BookOpen}
            label="Tutorial"
            onClick={() => { navigate('/profesor/tutorial'); setSidebarOpen(false); }}
          />
          {isAdmin && (
            <>
              <div className="h-px bg-white/5 my-2" />
              <NavItem
                icon={Shield}
                label="Panel Admin"
                onClick={() => { navigate('/admin/panel'); setSidebarOpen(false); }}
              />
            </>
          )}
        </nav>

        {/* Sidebar footer – user */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-black"
              style={{ background: B.blue, fontFamily: 'Unbounded, sans-serif' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{displayName}</p>
              <p className="text-white/40 text-[10px]">Profesor</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="text-white/30 hover:text-white/80 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════ MAIN */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── Top bar ── */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-4 sticky top-0 z-10">
          {/* Mobile menu toggle */}
          <button
            className="lg:hidden text-gray-500 hover:text-gray-800 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <span>Panel</span>
            {currentSection !== 'dashboard' && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-gray-700 font-semibold capitalize">
                  {currentSection === 'nueva-sesion' ? 'Nueva Sesión' : currentSection}
                </span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Active session pill */}
          {activeSession && (
            <button
              onClick={continueActiveSession}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-105"
              style={{ background: `${B.navy}`, color: 'white' }}
            >
              <span
                className="font-black text-sm tracking-widest"
                style={{ fontFamily: 'Unbounded, sans-serif' }}
              >
                {activeSession.room_code}
              </span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: activeSession.status === 'running' ? '#16A34A' : '#D97706', color: 'white' }}
              >
                {activeSession.status === 'running' ? 'EN VIVO' : 'LOBBY'}
              </span>
            </button>
          )}

          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0"
            style={{ background: B.blue, fontFamily: 'Unbounded, sans-serif' }}
          >
            {initials}
          </div>
        </header>

        {/* ── Content ── */}
        <main className="flex-1 p-5 sm:p-7 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* ══════════════════════════ DASHBOARD SECTION */}
            {currentSection === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Welcome */}
                <div>
                  <h1
                    className="text-xl sm:text-2xl font-black"
                    style={{ fontFamily: 'Unbounded, sans-serif', color: B.navy }}
                  >
                    Hola, {firstName || displayName} 👋
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    {activeSession
                      ? 'Tienes una misión activa en este momento.'
                      : 'No hay sesiones activas. ¿Listo para iniciar una nueva misión?'}
                  </p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-4">
                  <StatCard icon={Trophy}  label="Sesiones realizadas" value={stats.sessions} color={B.amber} delay={0.05} />
                  <StatCard icon={Users}   label="Estudiantes totales"  value={stats.students} color={B.blue}  delay={0.1}  />
                </div>

                {/* Active mission command center */}
                {activeSession ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl overflow-hidden shadow-lg"
                    style={{ background: B.navy }}
                  >
                    {/* Header bar */}
                    <div className="px-6 py-4 flex flex-wrap items-center gap-4 border-b border-white/10">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            background: activeSession.status === 'running' ? '#22C55E' : '#F59E0B',
                            boxShadow: `0 0 0 4px ${activeSession.status === 'running' ? '#22C55E33' : '#F59E0B33'}`,
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold">Misión Activa</p>
                          <p className="text-white font-medium text-sm truncate">
                            {getSessionLocation(activeSession)}
                          </p>
                        </div>
                      </div>
                      {/* Room code */}
                      <div className="text-center">
                        <p className="text-white/40 text-[9px] uppercase tracking-[0.2em] mb-0.5">Código de Sala</p>
                        <p
                          className="text-white font-black text-2xl tracking-[0.15em]"
                          style={{ fontFamily: 'Unbounded, sans-serif' }}
                        >
                          {activeSession.room_code}
                        </p>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2">
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={continueActiveSession}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm"
                          style={{ background: B.blue, color: 'white', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          <Play className="w-4 h-4" />
                          Continuar
                        </motion.button>
                        <button
                          onClick={() =>
                            handleFinishSessionById(
                              activeSession.id,
                              activeSession.room_code,
                              activeSession.current_stage_name,
                              activeSession.current_activity_name
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                          style={{ color: '#FC8181', border: '1px solid rgba(252,129,129,0.25)' }}
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                      </div>
                    </div>

                    {/* Team monitor grid */}
                    <div className="p-5">
                      {teams.length > 0 ? (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-white/60 text-xs font-bold uppercase tracking-widest">
                              Monitor de Equipos ({teams.length})
                            </p>
                            <button
                              onClick={() => continueActiveSession()}
                              className="text-white/40 hover:text-white/70 text-xs transition-colors flex items-center gap-1"
                            >
                              Ver en vivo <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {teams.slice(0, 8).map((team) => (
                              <TeamCard
                                key={team.id}
                                team={team}
                                phaseLabel={getSessionLocation(activeSession)}
                              />
                            ))}
                          </div>
                          {teams.length > 8 && (
                            <p className="text-white/30 text-xs text-center mt-3">
                              +{teams.length - 8} equipos más • entra a la sesión para verlos todos
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <Users className="w-10 h-10 text-white/20" />
                          <p className="text-white/40 text-sm">
                            {activeSession.status === 'lobby'
                              ? 'Los equipos se formarán al iniciar la sesión'
                              : 'Cargando equipos…'}
                          </p>
                          <button
                            onClick={continueActiveSession}
                            className="text-white/60 hover:text-white text-xs font-bold underline transition-colors"
                          >
                            Ir al {activeSession.status === 'lobby' ? 'Lobby' : 'Centro de Mando'}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  /* No active session CTA */
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left"
                    style={{
                      background: 'white',
                      border: `2px dashed ${B.blue}40`,
                    }}
                  >
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${B.blue}12` }}
                    >
                      <Zap className="w-8 h-8" style={{ color: B.blue }} />
                    </div>
                    <div className="flex-1">
                      <h3
                        className="text-lg font-black mb-1"
                        style={{ fontFamily: 'Unbounded, sans-serif', color: B.navy }}
                      >
                        Lanza una nueva misión
                      </h3>
                      <p className="text-gray-500 text-sm">
                        Crea una sala, sube el Excel con los estudiantes y empieza el juego.
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentSection('nueva-sesion')}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm flex-shrink-0 transition-all hover:scale-105"
                      style={{ background: B.navy, color: 'white', fontFamily: 'Unbounded, sans-serif', letterSpacing: '0.04em' }}
                    >
                      <Plus className="w-4 h-4" />
                      Crear Sesión
                    </button>
                  </motion.div>
                )}

                {/* Recent sessions */}
                {recentSessions.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2
                        className="text-sm font-black uppercase tracking-wider"
                        style={{ fontFamily: 'Unbounded, sans-serif', color: B.navy }}
                      >
                        Sesiones Recientes
                      </h2>
                      <button
                        onClick={() => navigate('/profesor/historial')}
                        className="text-xs font-bold transition-colors flex items-center gap-1"
                        style={{ color: B.blue }}
                      >
                        Ver todo <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      {recentSessions.map((s, i) => {
                        const badge = getStatusBadge(s.status);
                        return (
                          <div
                            key={s.id}
                            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer ${i > 0 ? 'border-t border-gray-50' : ''}`}
                            onClick={() => navigate(`/profesor/historial/${s.id}`)}
                          >
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: `${B.navy}0A` }}
                            >
                              <BookOpen className="w-4 h-4" style={{ color: B.navy }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900 truncate">
                                {s.course_name || `Sesión #${s.id}`}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(s.created_at).toLocaleDateString('es-CL', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })}
                              </p>
                            </div>
                            <span
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0"
                              style={{ background: badge.bg, color: badge.text }}
                            >
                              {badge.label}
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ══════════════════════════ NUEVA SESIÓN SECTION */}
            {currentSection === 'nueva-sesion' && (
              <motion.div
                key="nueva-sesion"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="max-w-4xl mx-auto w-full"
              >
                <div className="mb-6">
                  <h1
                    className="text-xl sm:text-2xl font-black"
                    style={{ fontFamily: 'Unbounded, sans-serif', color: B.navy }}
                  >
                    Nueva Sesión
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Selecciona el curso y sube el listado de estudiantes en Excel.
                  </p>
                </div>

                <form onSubmit={handleCreateSession} className="space-y-5">
                  {/* Step 1: Academic selectors */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
                        style={{ background: B.blue, fontFamily: 'Unbounded, sans-serif' }}
                      >
                        1
                      </div>
                      <h3 className="font-bold text-sm text-gray-800">Estructura académica</h3>
                    </div>

                    {/* Faculty */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Facultad
                      </label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                          value={selectedFaculty}
                          onChange={(e) => handleFacultyChange(e.target.value)}
                          className="w-full h-12 pl-10 pr-10 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                          disabled={creatingSession}
                        >
                          <option value="">Selecciona una facultad</option>
                          {FACULTADES.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Career */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Carrera
                      </label>
                      <div className="relative">
                        <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                          value={selectedCareer}
                          onChange={(e) => handleCareerChange(e.target.value)}
                          className="w-full h-12 pl-10 pr-10 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 transition-colors appearance-none disabled:opacity-50"
                          disabled={!selectedFaculty || creatingSession}
                        >
                          <option value="">Selecciona una carrera</option>
                          {(uddStructure[selectedFaculty] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Section */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Sección
                      </label>
                      <div className="relative">
                        <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                          value={selectedCourse}
                          onChange={(e) => setSelectedCourse(e.target.value)}
                          className="w-full h-12 pl-10 pr-10 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 transition-colors appearance-none disabled:opacity-50"
                          disabled={!selectedCareer || creatingSession}
                        >
                          <option value="">Selecciona una sección</option>
                          {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Excel drag-drop */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
                        style={{ background: B.blue, fontFamily: 'Unbounded, sans-serif' }}
                      >
                        2
                      </div>
                      <h3 className="font-bold text-sm text-gray-800">Listado de estudiantes (.xlsx)</h3>
                    </div>

                    {/* Drop zone */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                      disabled={creatingSession}
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      className={`
                        relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3
                        cursor-pointer transition-all duration-200
                        ${dragOver
                          ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                          : excelFile
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/30'
                        }
                      `}
                    >
                      {excelFile ? (
                        <>
                          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                            <FileSpreadsheet className="w-6 h-6 text-green-600" />
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-sm text-green-800">{excelFile.name}</p>
                            <p className="text-xs text-green-600 mt-0.5">
                              {(excelFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setExcelFile(null); }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                          >
                            Cambiar archivo
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${B.blue}12` }}>
                            <Upload className="w-6 h-6" style={{ color: B.blue }} />
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-sm text-gray-700">
                              {dragOver ? 'Suelta aquí el archivo' : 'Arrastra tu Excel aquí'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">o haz clic para seleccionar</p>
                          </div>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg"
                            style={{ background: `${B.blue}12`, color: B.blue }}
                          >
                            .xlsx / .xls
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Submit */}
                  <motion.button
                    type="submit"
                    disabled={creatingSession || !selectedFaculty || !selectedCareer || !selectedCourse || !excelFile}
                    whileTap={{ scale: 0.98 }}
                    className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all duration-200 shadow-lg"
                    style={{
                      background:
                        creatingSession || !selectedFaculty || !selectedCareer || !selectedCourse || !excelFile
                          ? `${B.navy}40`
                          : B.navy,
                      color: 'white',
                      fontFamily: 'Unbounded, sans-serif',
                      letterSpacing: '0.04em',
                      cursor: creatingSession || !selectedFaculty || !selectedCareer || !selectedCourse || !excelFile ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {creatingSession ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Creando sala…
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Lanzar Misión
                      </>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* ── Cancel modal ── */}
      <CancelSessionModal
        isOpen={cancelModalOpen}
        onClose={() => { setCancelModalOpen(false); setSessionToCancel(null); }}
        onConfirm={handleConfirmCancel}
        currentStage={sessionToCancel?.currentStage}
        currentActivity={sessionToCancel?.currentActivity}
        roomCode={sessionToCancel?.roomCode}
      />
    </div>
  );
}
