import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { tabletConnectionsAPI } from '@/services';
import { toast } from 'sonner';

// ─── Floating background blob ─────────────────────────────────────────────────
function Blob({
  style,
  color,
  delay,
  size,
}: {
  style: React.CSSProperties;
  color: string;
  delay: number;
  size: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        ...style,
        width: size,
        height: size,
        background: color,
        filter: `blur(${size * 0.45}px)`,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.18, 0.3, 0.18], y: [0, -24, 0] }}
      transition={{ duration: 8 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

// ─── PIN-style character boxes for room code ──────────────────────────────────
function PinInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const slots = Array.from({ length: 6 });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    onChange(raw);
  };

  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      {/* Hidden real input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        maxLength={6}
        autoCapitalize="characters"
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        autoFocus
        aria-label="Código de sesión"
      />
      {/* Visual PIN boxes */}
      <div className="flex gap-2 sm:gap-3 justify-center">
        {slots.map((_, i) => {
          const char = value[i] ?? '';
          const isActive = value.length === i;
          return (
            <motion.div
              key={i}
              animate={isActive ? { scale: [1, 1.06, 1], borderColor: '#FF3D2E' } : {}}
              transition={{ duration: 0.3 }}
              style={{
                fontFamily: 'Unbounded, sans-serif',
                borderColor: char ? '#1B1B2F' : isActive ? '#FF3D2E' : '#D1C9BA',
              }}
              className={`
                w-12 h-14 sm:w-14 sm:h-16 rounded-xl border-2 flex items-center justify-center
                text-xl sm:text-2xl font-black text-[#1B1B2F] bg-white
                transition-all duration-200 shadow-sm select-none
                ${char ? 'shadow-md' : ''}
              `}
            >
              {char ? (
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                >
                  {char}
                </motion.span>
              ) : isActive ? (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                  className="w-0.5 h-6 bg-[#FF3D2E] rounded-full inline-block"
                />
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Animated counter for decoration ─────────────────────────────────────────
function CountUp({ to }: { to: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(count, to, { duration: 2, ease: 'easeOut', delay: 1 });
    const unsub = rounded.on('change', (v) => setDisplay(v));
    return () => { controls.stop(); unsub(); };
  }, [to]);

  return <span>{display}</span>;
}

// ─── Team color palette ───────────────────────────────────────────────────────
const TEAM_COLORS = [
  { hex: '#3B82F6', name: 'Azul' },
  { hex: '#EF4444', name: 'Rojo' },
  { hex: '#10B981', name: 'Verde' },
  { hex: '#F59E0B', name: 'Amarillo' },
  { hex: '#8B5CF6', name: 'Morado' },
  { hex: '#F97316', name: 'Naranja' },
] as const;

// ─── Main component ───────────────────────────────────────────────────────────
export function TabletJoin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'code' | 'tablet'>('code');

  useEffect(() => {
    // Silent reconnect for BYOD: if token exists in localStorage, try to rejoin
    const savedToken = localStorage.getItem('team_session_token');
    if (savedToken) {
      tabletConnectionsAPI
        .reconnect(savedToken)
        .then((data) => {
          localStorage.setItem('tabletConnectionId', String(data.connection.id));
          localStorage.setItem('teamId', String(data.team.id));
          localStorage.setItem('gameSessionId', String(data.game_session.id));
          localStorage.setItem('roomCode', String(data.game_session.room_code));
          navigate(`/tablet/lobby?connection_id=${data.connection.id}`);
        })
        .catch(() => {
          // Token expired or session ended — clear and show form normally
          localStorage.removeItem('team_session_token');
        });
    }

    const fromUrl = searchParams.get('room_code');
    if (fromUrl) {
      setRoomCode(fromUrl.toUpperCase());
      setStep('tablet');
    }
    const parts = window.location.pathname.split('/');
    const idx = parts.indexOf('join');
    if (idx !== -1 && parts[idx + 1]?.length === 6) {
      setRoomCode(parts[idx + 1].toUpperCase());
      setStep('tablet');
    }
  }, [searchParams]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedRoom = roomCode.trim().toUpperCase();
    const trimmedName = teamName.trim();

    if (!trimmedRoom || !trimmedName || !teamColor) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const data = await tabletConnectionsAPI.connect(trimmedRoom, trimmedName, teamColor);
      localStorage.setItem('team_session_token', String(data.team_session_token));
      localStorage.setItem('tabletConnectionId', String(data.connection.id));
      localStorage.setItem('teamId', String(data.team.id));
      localStorage.setItem('gameSessionId', String(data.game_session.id));
      localStorage.setItem('roomCode', String(data.game_session.room_code));

      toast.success(data.message || '¡Conectado exitosamente!', {
        description: 'Redirigiendo al lobby…',
      });
      setTimeout(() => navigate(`/tablet/lobby?connection_id=${data.connection.id}`), 1000);
    } catch (error: any) {
      toast.error('No pudimos conectar', {
        description:
          error.response?.data?.error ||
          error.message ||
          'Verifica los datos e intenta nuevamente',
      });
      setLoading(false);
    }
  };

  const advanceStep = () => {
    if (roomCode.length === 6) setStep('tablet');
    else toast.error('El código tiene 6 caracteres', { description: 'Complétalo para continuar' });
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden flex flex-col items-center justify-center"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Background blobs ── */}
      <Blob style={{ top: '-8%', left: '-6%' }} color="#2563EB" delay={0} size={440} />
      <Blob style={{ bottom: '-10%', right: '-5%' }} color="#FF3D2E" delay={1.5} size={500} />
      <Blob style={{ top: '5%', right: '15%' }} color="#F5A623" delay={3} size={300} />
      <Blob style={{ bottom: '15%', left: '5%' }} color="#4ECDC4" delay={2} size={340} />

      {/* ── Noise texture overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
      />

      {/* ── Dot grid ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #1B1B2F18 1.5px, transparent 1.5px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── Floating badge top-left ── */}
      <motion.div
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 24 }}
        className="absolute top-5 left-5 flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-md border border-white/60"
      >
        <img src="/images/logoudd.png" alt="UDD" className="h-6 object-contain" />
        <span className="text-xs font-semibold text-[#1B1B2F] opacity-70 tracking-wide uppercase">
          Emprendimiento
        </span>
      </motion.div>


      {/* ── Main card ── */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 160, damping: 22 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div
          className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden"
          style={{ border: '1.5px solid rgba(255,255,255,0.9)' }}
        >
          {/* Card header stripe */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#2563EB] via-[#FF3D2E] to-[#F5A623]" />

          <div className="p-7 sm:p-9">
            {/* Logo + title */}
            <div className="flex items-center gap-4 mb-8">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="flex-shrink-0"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#F5F0E8] flex items-center justify-center shadow-inner">
                  <img
                    src="/images/mascotaprueba.svg"
                    alt="Mascota"
                    className="w-12 h-12 sm:w-16 sm:h-16 object-contain drop-shadow-md"
                  />
                </div>
              </motion.div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF3D2E] mb-1">
                  ¡Bienvenido!
                </p>
                <h1
                  className="text-xl sm:text-2xl font-black text-[#1B1B2F] leading-tight"
                  style={{ fontFamily: 'Unbounded, sans-serif' }}
                >
                  Misión<br />Emprende
                </h1>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-7">
              {['Sesión', 'Equipo'].map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                      (i === 0 && step === 'code') || (i === 1 && step === 'tablet')
                        ? 'bg-[#1B1B2F] text-white shadow-md'
                        : i === 0 && step === 'tablet'
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#F5F0E8] text-[#1B1B2F]/40'
                    }`}
                  >
                    <span>{i + 1}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                  {i < 1 && (
                    <div
                      className={`flex-1 h-0.5 w-8 rounded transition-all duration-500 ${
                        step === 'tablet' ? 'bg-[#2563EB]' : 'bg-[#1B1B2F]/10'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* ── Form ── */}
            <form onSubmit={handleConnect} className="space-y-6">
              <AnimatePresence mode="wait">
                {step === 'code' ? (
                  <motion.div
                    key="step-code"
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -30, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="space-y-4"
                  >
                    <div>
                      <label
                        className="block text-xs font-bold uppercase tracking-[0.15em] text-[#1B1B2F]/60 mb-3"
                      >
                        Código de Sesión
                      </label>
                      <PinInput value={roomCode} onChange={setRoomCode} disabled={loading} />
                      <p className="text-center text-xs text-[#1B1B2F]/40 mt-3">
                        Tu profesor te dará este código
                      </p>
                    </div>

                    <motion.button
                      type="button"
                      onClick={advanceStep}
                      whileTap={{ scale: 0.97 }}
                      whileHover={{ scale: 1.02 }}
                      disabled={roomCode.length !== 6}
                      className={`
                        w-full h-14 sm:h-16 rounded-2xl font-black text-base sm:text-lg
                        transition-all duration-200 shadow-lg flex items-center justify-center gap-3
                        ${
                          roomCode.length === 6
                            ? 'bg-[#1B1B2F] text-white hover:bg-[#FF3D2E] hover:shadow-xl cursor-pointer'
                            : 'bg-[#1B1B2F]/10 text-[#1B1B2F]/30 cursor-not-allowed'
                        }
                      `}
                      style={{ fontFamily: 'Unbounded, sans-serif', letterSpacing: '0.05em' }}
                    >
                      Continuar
                      <motion.span
                        animate={roomCode.length === 6 ? { x: [0, 4, 0] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        →
                      </motion.span>
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step-tablet"
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -30, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="space-y-5"
                  >
                    {/* Confirmed session code chip */}
                    <div className="flex items-center gap-2 bg-[#F5F0E8] rounded-xl px-4 py-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
                      <span className="text-xs text-[#1B1B2F]/50 font-medium">Sesión</span>
                      <span
                        className="text-sm font-black text-[#1B1B2F] tracking-widest ml-auto"
                        style={{ fontFamily: 'Unbounded, sans-serif' }}
                      >
                        {roomCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep('code')}
                        className="text-[#FF3D2E] text-xs font-bold ml-2 hover:underline"
                      >
                        cambiar
                      </button>
                    </div>

                    {/* Team name input */}
                    <div>
                      <label
                        htmlFor="teamName"
                        className="block text-xs font-bold uppercase tracking-[0.15em] text-[#1B1B2F]/60 mb-3"
                      >
                        Nombre del Equipo
                      </label>
                      <input
                        id="teamName"
                        type="text"
                        placeholder="Ej: Los Innovadores"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        disabled={loading}
                        autoFocus
                        maxLength={50}
                        className="
                          w-full h-14 sm:h-16 px-5 rounded-2xl border-2 border-[#1B1B2F]/10
                          text-lg font-bold text-[#1B1B2F]
                          bg-white focus:outline-none focus:border-[#FF3D2E] focus:ring-4
                          focus:ring-[#FF3D2E]/10 transition-all placeholder:text-[#1B1B2F]/25
                          placeholder:font-normal placeholder:text-sm
                        "
                      />
                    </div>

                    {/* Color picker */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.15em] text-[#1B1B2F]/60 mb-3">
                        Color del Equipo
                      </label>
                      <div className="flex gap-3 flex-wrap">
                        {TEAM_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setTeamColor(c.name)}
                            disabled={loading}
                            title={c.name}
                            className="relative w-10 h-10 rounded-full transition-transform hover:scale-110 focus:outline-none flex-shrink-0"
                            style={{ backgroundColor: c.hex }}
                          >
                            {teamColor === c.name && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute inset-0 rounded-full flex items-center justify-center"
                                style={{ boxShadow: `0 0 0 3px white, 0 0 0 5px ${c.hex}` }}
                              >
                                <svg
                                  className="w-4 h-4 text-white drop-shadow"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </motion.div>
                            )}
                          </button>
                        ))}
                      </div>
                      {teamColor && (
                        <p className="text-xs text-[#1B1B2F]/40 mt-2 ml-1">
                          Color seleccionado: {teamColor}
                        </p>
                      )}
                    </div>

                    {/* CTA button */}
                    <motion.button
                      type="submit"
                      disabled={loading || teamName.trim().length < 2 || !teamColor}
                      whileTap={{ scale: 0.96 }}
                      className={`
                        w-full h-16 sm:h-20 rounded-2xl font-black text-lg sm:text-xl
                        transition-all duration-200 relative overflow-hidden
                        flex items-center justify-center gap-3 shadow-xl
                        ${
                          !loading && teamName.trim().length >= 2 && teamColor
                            ? 'bg-[#FF3D2E] text-white hover:bg-[#e03426] hover:shadow-2xl cursor-pointer'
                            : 'bg-[#FF3D2E]/30 text-white/50 cursor-not-allowed'
                        }
                      `}
                      style={{ fontFamily: 'Unbounded, sans-serif', letterSpacing: '0.03em' }}
                    >
                      {/* Shimmer effect */}
                      {!loading && teamName.trim().length >= 2 && teamColor && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
                        />
                      )}

                      {loading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                            className="w-6 h-6 rounded-full"
                            style={{
                              borderWidth: '3px',
                              borderStyle: 'solid',
                              borderColor: 'rgba(255,255,255,0.3)',
                              borderTopColor: 'white',
                            }}
                          />
                          <span>Conectando…</span>
                        </>
                      ) : (
                        <>
                          <span>Entrar a la Misión</span>
                          <motion.span
                            animate={{ x: [0, 5, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                            className="text-2xl"
                          >
                            🚀
                          </motion.span>
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>

          {/* Card footer */}
          <div className="px-7 sm:px-9 pb-6 pt-0">
            <div className="border-t border-[#1B1B2F]/6 pt-4 flex items-center justify-between">
              <p className="text-xs text-[#1B1B2F]/35 font-medium">
                ¿Necesitas ayuda? Consulta al profesor
              </p>
              <div className="flex gap-1">
                {['#2563EB', '#FF3D2E', '#F5A623'].map((c, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Floating decorative pills ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex gap-3 justify-center mt-5"
        >
          {['Creatividad', 'Emprendimiento', 'Innovación'].map((tag, i) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + i * 0.1 }}
              className="text-[10px] font-bold uppercase tracking-wider text-[#1B1B2F]/50 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/80"
            >
              {tag}
            </motion.span>
          ))}
        </motion.div>

        {/* ── Professor access button ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="flex justify-center mt-4"
        >
          <a
            href="/profesor/login"
            className="
              inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl
              border border-[#1B1B2F]/15 bg-white/50 backdrop-blur-sm
              text-xs font-semibold text-[#1B1B2F]/55 tracking-wide
              hover:bg-white/80 hover:border-[#1B1B2F]/30 hover:text-[#1B1B2F]/80
              transition-all duration-200 shadow-sm
            "
          >
            Acceso profesores →
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}
