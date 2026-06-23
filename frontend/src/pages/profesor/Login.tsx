import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, BookOpen, Users, Trophy, Zap, GraduationCap, Shield, Tablet } from 'lucide-react';
import { authAPI } from '@/services';
import { toast } from 'sonner';

// ─── Brand tokens ──────────────────────────────────────────────────────────────
const B = {
  navy: '#0F172A',
  blue: '#2563EB',
  red: '#FF3D2E',
  amber: '#F5A623',
  teal: '#0D9488',
  cream: '#F5F0E8',
};

// ─── Left panel cycling stats ─────────────────────────────────────────────────
const missionStats = [
  { icon: Trophy,   label: 'Sesiones completadas',   value: '1,200+', color: B.amber },
  { icon: Users,    label: 'Estudiantes alcanzados',  value: '28,000+', color: B.blue },
  { icon: Zap,      label: 'Equipos formados',         value: '6,400+',  color: B.teal },
  { icon: BookOpen, label: 'Facultades activas',       value: '12',       color: B.red  },
];

type Role = 'profesor' | 'admin';

// ─── Float label input ────────────────────────────────────────────────────────
function FloatInput({
  id, label, type, value, onChange, disabled, error, icon: Icon,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  error?: string;
  icon: React.ElementType;
}) {
  const [showPwd, setShowPwd] = useState(false);
  const inputType = type === 'password' ? (showPwd ? 'text' : 'password') : type;
  const hasValue = value.length > 0;

  return (
    <div className="space-y-1">
      <div className="relative group">
        <Icon
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors"
          style={{ color: hasValue ? B.blue : '#9CA3AF' }}
        />
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={label}
          className={`
            w-full h-14 pl-11 pr-12 rounded-xl border-2 bg-white text-[#0F172A]
            text-sm font-medium placeholder:text-gray-400
            transition-all duration-200 outline-none
            ${error
              ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
              : 'border-gray-200 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPwd((p) => !p)}
            tabIndex={-1}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-red-500 font-medium pl-1"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ProfesorLogin() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<Role>('profesor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [statIndex, setStatIndex] = useState(0);

  // Cycle stats on left panel
  useEffect(() => {
    const t = setInterval(() => setStatIndex((i) => (i + 1) % missionStats.length), 3000);
    return () => clearInterval(t);
  }, []);

  // Auto-redirect if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      if (!localStorage.getItem('authToken')) return;
      try {
        // Try admin first, then profesor
        try {
          await authAPI.getAdminProfile();
          navigate('/admin/panel');
          return;
        } catch {
          // Not admin — try profesor
        }
        await authAPI.getProfile();
        navigate('/profesor/panel');
      } catch {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
      }
    };
    checkAuth();
  }, [navigate]);

  // Clear errors when role changes
  useEffect(() => {
    setFieldErrors({});
  }, [selectedRole]);

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!email)    errs.email    = 'Ingresa tu correo';
    if (!password) errs.password = 'Ingresa tu contraseña';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setFieldErrors({});

    try {
      const loginData = await authAPI.login(email, password);
      localStorage.setItem('authToken', loginData.access);
      localStorage.setItem('refreshToken', loginData.refresh);
      await new Promise((r) => setTimeout(r, 100));

      if (selectedRole === 'admin') {
        try {
          const adminProfile = await authAPI.getAdminProfile();
          if (adminProfile) {
            toast.success('¡Bienvenido Administrador!', { description: 'Redirigiendo al panel…' });
            setTimeout(() => navigate('/admin/panel'), 900);
          }
        } catch (adminError: any) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          toast.error('Sin acceso de Administrador', {
            description:
              adminError.response?.data?.error ||
              'Esta cuenta no tiene permisos de administrador',
            duration: 8000,
          });
          setLoading(false);
        }
      } else {
        try {
          const profile = await authAPI.getProfile();
          if (profile) {
            toast.success('¡Bienvenido!', { description: 'Redirigiendo al panel…' });
            setTimeout(() => navigate('/profesor/panel'), 900);
          }
        } catch (profileError: any) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          toast.error('Sin acceso de Profesor', {
            description:
              profileError.response?.data?.error ||
              profileError.response?.data?.detail ||
              'No se pudo verificar el perfil',
            duration: 8000,
          });
          setLoading(false);
        }
      }
    } catch (error: any) {
      const d = error.response?.data;
      const msg =
        d?.detail || d?.error || d?.non_field_errors?.[0] || error.message || 'Credenciales incorrectas';
      toast.error('Error al ingresar', { description: msg, duration: 6000 });
      setFieldErrors({ password: 'Credenciales incorrectas' });
      setLoading(false);
    }
  };

  const currentStat = missionStats[statIndex];
  const StatIcon = currentStat.icon;

  const roleConfig = {
    profesor: {
      label: 'Profesores',
      sublabel: 'Accede a tu panel de gestión de sesiones',
      accentColor: B.blue,
      icon: GraduationCap,
    },
    admin: {
      label: 'Administradores',
      sublabel: 'Panel de administración del sistema',
      accentColor: B.red,
      icon: Shield,
    },
  } satisfies Record<Role, { label: string; sublabel: string; accentColor: string; icon: React.ElementType }>;

  const activeRole = roleConfig[selectedRole];

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: B.cream }}
    >
      {/* ── Left brand panel (hidden on mobile) ── */}
      <div
        className="hidden lg:flex lg:w-5/12 xl:w-2/5 flex-col relative overflow-hidden"
        style={{ background: B.navy }}
      >
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Colored blobs */}
        <div
          className="absolute -top-32 -left-32 w-80 h-80 rounded-full opacity-20"
          style={{ background: B.blue, filter: 'blur(80px)' }}
        />
        <div
          className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full opacity-15"
          style={{ background: B.red, filter: 'blur(80px)' }}
        />

        <div className="relative z-10 flex flex-col h-full p-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <img
              src="/images/logoudd.png"
              alt="UDD"
              className="h-8 object-contain brightness-0 invert opacity-90"
            />
            <div className="w-px h-6 bg-white/20" />
            <span
              className="text-white/70 text-sm font-bold tracking-widest uppercase"
              style={{ fontFamily: 'Unbounded, sans-serif', fontSize: '10px' }}
            >
              Emprendimiento
            </span>
          </div>

          {/* Main brand text */}
          <div className="mb-8">
            <p className="text-white/40 text-xs uppercase tracking-[0.3em] font-bold mb-3">
              Bienvenido a
            </p>
            <h1
              className="text-white font-black leading-[1.1] mb-4"
              style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 'clamp(28px, 3vw, 42px)' }}
            >
              Misión<br />Emprende
            </h1>
            <p className="text-white/55 text-sm leading-relaxed max-w-xs">
              Plataforma de aprendizaje activo para desarrollar competencias de emprendimiento e
              innovación en estudiantes UDD.
            </p>
          </div>

          {/* Cycling stat card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={statIndex}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="rounded-2xl p-5 mb-6"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${currentStat.color}22` }}
              >
                <StatIcon className="w-5 h-5" style={{ color: currentStat.color }} />
              </div>
              <p
                className="text-3xl font-black text-white mb-1"
                style={{ fontFamily: 'Unbounded, sans-serif' }}
              >
                {currentStat.value}
              </p>
              <p className="text-white/50 text-xs font-medium">{currentStat.label}</p>
            </motion.div>
          </AnimatePresence>

          {/* Stat dots */}
          <div className="flex gap-2">
            {missionStats.map((_, i) => (
              <button
                key={i}
                onClick={() => setStatIndex(i)}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === statIndex ? '24px' : '6px',
                  background: i === statIndex ? B.blue : 'rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: B.navy }}
            >
              <img
                src="/images/logoudd.png"
                alt="UDD"
                className="h-5 object-contain brightness-0 invert"
              />
            </div>
            <h1
              className="font-black text-[#0F172A]"
              style={{ fontFamily: 'Unbounded, sans-serif', fontSize: '18px' }}
            >
              Misión Emprende
            </h1>
          </div>

          {/* Form header */}
          <div className="mb-6">
            <p
              className="text-xs font-bold uppercase tracking-[0.2em] mb-2"
              style={{ color: B.blue }}
            >
              Portal de Acceso
            </p>
            <h2
              className="font-black leading-tight"
              style={{
                fontFamily: 'Unbounded, sans-serif',
                fontSize: 'clamp(22px, 4vw, 30px)',
                color: B.navy,
              }}
            >
              Iniciar<br />Sesión
            </h2>
          </div>

          {/* ── Role toggle ── */}
          <div
            className="flex p-1 rounded-2xl mb-6"
            style={{ background: 'rgba(15,23,42,0.06)' }}
          >
            {(['profesor', 'admin'] as Role[]).map((role) => {
              const cfg = roleConfig[role];
              const RoleIcon = cfg.icon;
              const isActive = selectedRole === role;
              return (
                <motion.button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-bold transition-all duration-200"
                  style={{
                    background: isActive ? 'white' : 'transparent',
                    color: isActive ? cfg.accentColor : '#6B7280',
                    boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  }}
                >
                  <RoleIcon className="w-4 h-4" />
                  {cfg.label}
                </motion.button>
              );
            })}
          </div>

          {/* Role sublabel */}
          <AnimatePresence mode="wait">
            <motion.p
              key={selectedRole}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-gray-500 mb-5 pl-1"
            >
              {activeRole.sublabel}
            </motion.p>
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <FloatInput
              id="email"
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={setEmail}
              disabled={loading}
              error={fieldErrors.email}
              icon={() => (
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              )}
            />
            <FloatInput
              id="password"
              label="Contraseña"
              type="password"
              value={password}
              onChange={setPassword}
              disabled={loading}
              error={fieldErrors.password}
              icon={() => (
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            />

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full h-14 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 mt-2"
              style={{
                background: loading ? `${activeRole.accentColor}80` : activeRole.accentColor,
                color: 'white',
                fontFamily: 'Unbounded, sans-serif',
                letterSpacing: '0.05em',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Verificando…
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Footer links */}
          <AnimatePresence mode="wait">
            {selectedRole === 'profesor' && (
              <motion.div
                key="profesor-footer"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-8 pt-6 border-t border-gray-200 text-center space-y-3 overflow-hidden"
              >
                <p className="text-gray-500 text-xs">¿Aún no tienes cuenta?</p>
                <button
                  onClick={() => navigate('/profesor/registro')}
                  disabled={loading}
                  className="text-xs font-bold transition-colors"
                  style={{ color: B.blue }}
                >
                  Regístrate como Profesor →
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tablet access hint */}
          <a
            href="/tablet/join"
            className="mt-6 flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors"
          >
            <Tablet className="w-4 h-4 flex-shrink-0" />
            Soy estudiante — Acceso a Tablets
            <ArrowRight className="w-4 h-4 flex-shrink-0 ml-auto" />
          </a>
        </motion.div>
      </div>
    </div>
  );
}
