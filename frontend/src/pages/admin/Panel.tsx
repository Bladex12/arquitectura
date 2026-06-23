import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  History,
  BookOpen,
  LogOut,
  GraduationCap,
  Loader2,
  Play,
  HelpCircle,
  Settings,
  BarChart3,
} from 'lucide-react';
import { authAPI, sessionsAPI } from '@/services';
import { toast } from 'sonner';

interface Admin {
  id: number;
  full_name?: string;
  user?: {
    username: string;
    first_name?: string;
    last_name?: string;
  };
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
}

type Section = 'dashboard' | 'update-game' | 'history' | 'learning-objectives' | 'tutorial';

export function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [activeSessions, setActiveSessions] = useState<GameSession[]>([]);

  const getSectionFromPath = (): Section => {
    if (location.pathname === '/admin/tutorial') return 'tutorial';
    if (location.pathname === '/admin/update-game') return 'update-game';
    return 'dashboard';
  };

  const [currentSection, setCurrentSection] = useState<Section>(getSectionFromPath());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sessions: 0, students: 0 });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    setCurrentSection(getSectionFromPath());
  }, [location.pathname]);

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/profesor/login');
      return;
    }
    try {
      const profile = await authAPI.getAdminProfile();
      if (!profile) throw new Error('No es administrador');
      setAdmin(profile);
      await loadPanelData();
    } catch (error: any) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      toast.error('Acceso denegado', {
        description: 'Esta cuenta no tiene permisos de administrador',
      });
      navigate('/profesor/login');
    }
  };

  const loadPanelData = async () => {
    setLoading(true);
    try {
      const sessionsList = await sessionsAPI.list({ ordering: '-created_at', admin_view: 'true' });
      const sessionsArray = Array.isArray(sessionsList) ? sessionsList : [sessionsList];
      setSessions(sessionsArray);

      const totalSessions = sessionsArray.length;
      const totalStudents = sessionsArray.reduce((sum: number, _session: GameSession) => sum, 0);
      setStats({ sessions: totalSessions, students: totalStudents });

      const active = sessionsArray.filter(
        (s: GameSession) => s.status === 'lobby' || s.status === 'running',
      );

      if (active.length === 1) {
        setActiveSession(active[0]);
        setActiveSessions([]);
      } else if (active.length > 1) {
        setActiveSession(null);
        setActiveSessions(active);
      } else {
        setActiveSession(null);
        setActiveSessions([]);
      }
    } catch (error) {
      console.error('Error loading panel:', error);
      toast.error('Error al cargar el panel');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    navigate('/profesor/login');
  };

  const handlePlayRedirect = () => {
    toast.info('Redirigiendo al panel del profesor...');
    navigate('/profesor/panel');
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#F5F0E8' }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  const firstName = admin?.user?.first_name || '';
  const lastName = admin?.user?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const displayName = fullName || admin?.full_name || admin?.user?.username || 'Administrador';

  const actionCards = [
    {
      delay: 0.2,
      iconGradient: 'from-[#FF3D2E] to-rose-500',
      icon: <Play className="w-5 h-5 text-white" />,
      title: 'Jugar / Nueva Sesión',
      description: 'Ir al panel del profesor',
      cta: 'Ir al panel',
      onClick: handlePlayRedirect,
    },
    {
      delay: 0.25,
      iconGradient: 'from-[#2563EB] to-cyan-500',
      icon: <History className="w-5 h-5 text-white" />,
      title: 'Historial',
      description: 'Ver juegos anteriores',
      cta: 'Ver más',
      onClick: () => navigate('/admin/historial'),
    },
    {
      delay: 0.3,
      iconGradient: 'from-purple-500 to-violet-500',
      icon: <BookOpen className="w-5 h-5 text-white" />,
      title: 'Objetivos',
      description: 'Objetivos de aprendizaje',
      cta: 'Ver más',
      onClick: () => navigate('/admin/objetivos'),
    },
    {
      delay: 0.35,
      iconGradient: 'from-[#F5A623] to-orange-500',
      icon: <Settings className="w-5 h-5 text-white" />,
      title: 'Actualizar Juego',
      description: 'Configurar contenido del juego',
      cta: 'Configurar',
      onClick: () => navigate('/admin/update-game'),
    },
    {
      delay: 0.4,
      iconGradient: 'from-emerald-500 to-teal-600',
      icon: <BarChart3 className="w-5 h-5 text-white" />,
      title: 'Dashboard',
      description: 'Estadísticas y métricas',
      cta: 'Ver más',
      onClick: () => navigate('/admin/dashboard'),
    },
    {
      delay: 0.45,
      iconGradient: 'from-indigo-500 to-purple-600',
      icon: <GraduationCap className="w-5 h-5 text-white" />,
      title: 'Profesores',
      description: 'Gestionar acceso de profesores',
      cta: 'Gestionar',
      onClick: () => navigate('/admin/professors'),
    },
  ];

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Background blobs */}
      <div
        className="absolute top-[-8%] left-[-6%] w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: '#2563EB', filter: 'blur(180px)', opacity: 0.11 }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[32rem] h-[32rem] rounded-full pointer-events-none"
        style={{ background: '#FF3D2E', filter: 'blur(200px)', opacity: 0.09 }}
      />
      <div
        className="absolute top-[45%] right-[8%] w-80 h-80 rounded-full pointer-events-none"
        style={{ background: '#F5A623', filter: 'blur(160px)', opacity: 0.09 }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #1B1B2F18 1.5px, transparent 1.5px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col max-w-6xl mx-auto w-full p-4 sm:p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          {/* UDD badge */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 24 }}
            className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-white/60"
          >
            <img src="/images/logoudd.png" alt="UDD" className="h-5 object-contain" />
            <span className="text-xs font-semibold text-[#1B1B2F]/60 tracking-wide uppercase hidden sm:inline">
              Admin
            </span>
          </motion.div>

          {/* Logout */}
          <motion.button
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 24 }}
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-[#1B1B2F]/12 bg-white/60 backdrop-blur-sm text-xs font-semibold text-[#1B1B2F]/60 hover:bg-white/90 hover:text-[#FF3D2E] hover:border-[#FF3D2E]/30 transition-all duration-200 shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </motion.button>
        </div>

        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-7 sm:mb-8"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF3D2E] mb-1">
            Panel de Administración
          </p>
          <h1
            className="text-2xl sm:text-3xl font-black text-[#1B1B2F]"
            style={{ fontFamily: 'Unbounded, sans-serif' }}
          >
            Hola,{' '}
            <span className="text-[#2563EB]">{displayName}</span>
          </h1>
          <p className="text-sm text-[#1B1B2F]/45 mt-1">Misión Emprende · UDD</p>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="flex gap-3 mb-7"
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-sm border border-[#1B1B2F]/6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#2563EB]/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#1B1B2F]/40 font-semibold">
                Sesiones
              </p>
              <p
                className="text-lg font-black text-[#1B1B2F] leading-tight"
                style={{ fontFamily: 'Unbounded, sans-serif' }}
              >
                {stats.sessions}
              </p>
            </div>
          </div>
          {(activeSessions.length > 0 || activeSession) && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-sm border border-green-200 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-xs font-semibold text-green-700">
                {activeSessions.length > 0
                  ? `${activeSessions.length} sesiones activas`
                  : `Sala ${activeSession?.room_code} activa`}
              </p>
            </div>
          )}
        </motion.div>

        {/* Action cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {actionCards.map((card) => (
            <motion.button
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: card.delay, type: 'spring', stiffness: 180, damping: 22 }}
              onClick={card.onClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group text-left bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm hover:shadow-md border border-[#1B1B2F]/6 hover:border-[#2563EB]/20 p-5 sm:p-6 transition-all duration-200"
              style={{ border: '1.5px solid rgba(255,255,255,0.9)' }}
            >
              <div className={`bg-gradient-to-br ${card.iconGradient} w-11 h-11 rounded-2xl flex items-center justify-center mb-4 shadow-sm`}>
                {card.icon}
              </div>
              <h3
                className="text-sm font-black text-[#1B1B2F] mb-1.5"
                style={{ fontFamily: 'Unbounded, sans-serif' }}
              >
                {card.title}
              </h3>
              <p className="text-xs text-[#1B1B2F]/50 mb-4">{card.description}</p>
              <div className="flex items-center text-xs font-semibold text-[#2563EB] group-hover:text-[#FF3D2E] transition-colors duration-200">
                {card.cta}
                <span className="ml-1 group-hover:translate-x-1 transition-transform duration-200">
                  →
                </span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Tutorial quick link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="flex justify-center mt-6"
        >
          <button
            onClick={() => navigate('/admin/tutorial')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-[#1B1B2F]/12 bg-white/50 backdrop-blur-sm text-xs font-semibold text-[#1B1B2F]/50 hover:bg-white/80 hover:text-[#1B1B2F]/80 hover:border-[#1B1B2F]/25 transition-all duration-200 shadow-sm"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Tutorial
          </button>
        </motion.div>
      </div>
    </div>
  );
}
