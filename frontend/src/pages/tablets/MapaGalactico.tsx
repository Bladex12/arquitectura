import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, Rocket } from 'lucide-react';
import { StarfieldBackground } from '@/components/StarfieldBackground';
import { getPhase, PHASES } from '@/config/phases';

// SVG coordinate space (0–100). Y=0 is top, Y=100 is bottom.
const POSITIONS = [
  { cx: 24, cy: 80 },  // Stage 1 — bottom-left
  { cx: 70, cy: 56 },  // Stage 2 — mid-right
  { cx: 28, cy: 33 },  // Stage 3 — upper-left
  { cx: 70, cy: 10 },  // Stage 4 — top-right
];

export function MapaGalactico() {
  const [searchParams] = useSearchParams();
  const stageParam = parseInt(searchParams.get('stage') || '1', 10);
  const redirect = searchParams.get('redirect') || '/tablet/lobby';
  const connId = searchParams.get('connection_id') || '';

  const phase = getPhase(stageParam);
  const [pr, pg, pb] = phase.glowRgb;

  const handleStart = () => {
    const sep = redirect.includes('?') ? '&' : '?';
    window.location.href = connId ? `${redirect}${sep}connection_id=${connId}` : redirect;
  };

  const getState = (n: number): 'completed' | 'active' | 'locked' => {
    if (n < stageParam) return 'completed';
    if (n === stageParam) return 'active';
    return 'locked';
  };

  return (
    <StarfieldBackground nebTarget={phase.glowRgb}>
      <style>{`
        @keyframes pulsePlanet {
          0%,100% { box-shadow: 0 0 0 0 rgba(${pr},${pg},${pb},0.5), 0 0 40px rgba(${pr},${pg},${pb},0.4); }
          50%      { box-shadow: 0 0 0 16px rgba(${pr},${pg},${pb},0), 0 0 70px rgba(${pr},${pg},${pb},0.6); }
        }
        @keyframes mapBtnPulse {
          0%,100% { box-shadow: 0 0 0 0 ${phase.color}55, 0 6px 32px ${phase.color}44; }
          50%      { box-shadow: 0 0 0 10px transparent, 0 6px 32px ${phase.color}44; }
        }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* ── Header ── */}
        <div style={{ paddingTop: 24, textAlign: 'center', zIndex: 10, flexShrink: 0 }}>
          <div style={{
            display: 'inline-block',
            padding: '4px 18px',
            background: `rgba(${pr},${pg},${pb},0.15)`,
            border: `1px solid ${phase.color}55`,
            borderRadius: 20,
            fontFamily: "'Exo 2', sans-serif",
            fontSize: 9, letterSpacing: 4,
            textTransform: 'uppercase' as const,
            color: phase.color,
            marginBottom: 10,
          }}>
            Misión de Innovación Interplanetaria 2026
          </div>
          <div style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 'clamp(16px,3.5vw,28px)',
            fontWeight: 900,
            letterSpacing: 3,
            textTransform: 'uppercase' as const,
            color: '#fff',
            textShadow: `0 0 30px ${phase.color}`,
          }}>
            Ruta de la Misión
          </div>
        </div>

        {/* ── Planet Map ── */}
        <div style={{ flex: 1, width: '100%', maxWidth: 500, position: 'relative', minHeight: 0, padding: '8px 16px' }}>

          {/* SVG connecting lines */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: '8px 16px', width: 'calc(100% - 32px)', height: 'calc(100% - 16px)', pointerEvents: 'none' }}
          >
            <defs>
              {[0, 1, 2].map(i => {
                const a = getPhase(i + 1);
                const b = getPhase(i + 2);
                const fromDone = i + 1 < stageParam;
                const toDone   = i + 2 <= stageParam;
                return (
                  <linearGradient
                    key={i}
                    id={`lg${i}`}
                    x1={POSITIONS[i].cx} y1={POSITIONS[i].cy}
                    x2={POSITIONS[i + 1].cx} y2={POSITIONS[i + 1].cy}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%"   stopColor={a.color} stopOpacity={fromDone ? 0.8 : 0.2} />
                    <stop offset="100%" stopColor={b.color} stopOpacity={toDone   ? 0.8 : 0.15} />
                  </linearGradient>
                );
              })}
            </defs>
            {[0, 1, 2].map(i => (
              <line
                key={i}
                x1={POSITIONS[i].cx}     y1={POSITIONS[i].cy}
                x2={POSITIONS[i + 1].cx} y2={POSITIONS[i + 1].cy}
                stroke={`url(#lg${i})`}
                strokeWidth="0.9"
                strokeDasharray="2.8 2.2"
              />
            ))}
          </svg>

          {/* Planet nodes */}
          {PHASES.map((p, idx) => {
            const n        = idx + 1;
            const pos      = POSITIONS[idx];
            const state    = getState(n);
            const [r, g, b] = p.glowRgb;
            const size     = state === 'active' ? 64 : 50;
            const labelSide = pos.cx < 50 ? 'right' : 'left';

            return (
              <div
                key={n}
                style={{
                  position: 'absolute',
                  left: `${pos.cx}%`,
                  top: `${pos.cy}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: state === 'active' ? 5 : 3,
                }}
              >
                {/* Pulsing outer ring (active only) */}
                {state === 'active' && (
                  <div style={{
                    position: 'absolute',
                    inset: -14,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(${r},${g},${b},0.25) 0%, transparent 70%)`,
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Planet circle */}
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 16, delay: idx * 0.12 }}
                  style={{
                    width: size, height: size,
                    borderRadius: '50%',
                    background: state === 'locked'
                      ? 'rgba(20,20,50,0.7)'
                      : `radial-gradient(circle at 35% 30%, rgba(${r},${g},${b},0.95) 0%, rgba(${r},${g},${b},0.45) 55%, rgba(${r},${g},${b},0.1) 100%)`,
                    border: `2px solid ${state === 'locked' ? 'rgba(255,255,255,0.12)' : p.color + (state === 'active' ? 'CC' : '77')}`,
                    boxShadow: state === 'active'
                      ? `0 0 28px rgba(${r},${g},${b},0.75), 0 0 60px rgba(${r},${g},${b},0.3)`
                      : state === 'completed'
                      ? `0 0 14px rgba(${r},${g},${b},0.45)`
                      : 'none',
                    opacity: state === 'locked' ? 0.45 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: state === 'active' ? 'pulsePlanet 2.2s ease infinite' : 'none',
                    position: 'relative',
                  }}
                >
                  {state === 'completed' && <Check size={size * 0.36} color="#fff" strokeWidth={2.5} />}
                  {state === 'active'    && <Rocket size={size * 0.38} color="#fff" strokeWidth={1.8} />}
                  {state === 'locked'    && <Lock size={size * 0.3} color="rgba(255,255,255,0.35)" />}
                </motion.div>

                {/* Label (side of planet) */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  ...(labelSide === 'right'
                    ? { left: `calc(100% + 10px)` }
                    : { right: `calc(100% + 10px)`, textAlign: 'right' as const }),
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: state === 'active' ? 10 : 8,
                    fontWeight: state === 'active' ? 700 : 400,
                    letterSpacing: 1,
                    textTransform: 'uppercase' as const,
                    color: state === 'locked' ? 'rgba(255,255,255,0.2)' : p.color + (state === 'completed' ? 'AA' : ''),
                  }}>
                    {p.name}
                  </div>
                  {state === 'active' && (
                    <div style={{
                      fontFamily: "'Exo 2', sans-serif",
                      fontSize: 9, letterSpacing: 2,
                      color: 'rgba(255,255,255,0.5)',
                      textTransform: 'uppercase' as const,
                      marginTop: 2,
                    }}>
                      Etapa {n}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Bottom: info + button ── */}
        <div style={{ flexShrink: 0, paddingBottom: 28, textAlign: 'center', zIndex: 10 }}>
          <div style={{
            fontFamily: "'Exo 2', sans-serif",
            fontSize: 10, letterSpacing: 4,
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.45)',
            marginBottom: 4,
          }}>
            Etapa {stageParam} de 4
          </div>
          <div style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 'clamp(14px,2.8vw,22px)',
            fontWeight: 700,
            color: '#fff',
            textShadow: `0 0 20px ${phase.color}`,
            marginBottom: 20,
          }}>
            {phase.name}
          </div>

          <motion.button
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.7 }}
            onClick={handleStart}
            style={{
              padding: '14px 46px',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 13, fontWeight: 700, letterSpacing: 2,
              textTransform: 'uppercase' as const,
              color: '#fff',
              background: `linear-gradient(135deg, ${phase.colorRich} 0%, rgba(${pr},${pg},${pb},0.55) 100%)`,
              border: `1.5px solid ${phase.color}`,
              clipPath: 'polygon(14px 0%, calc(100% - 14px) 0%, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0% 50%)',
              cursor: 'pointer',
              animation: 'mapBtnPulse 2s ease infinite',
              outline: 'none',
              userSelect: 'none' as const,
            }}
          >
            ▶ Comenzar Misión
          </motion.button>
        </div>
      </div>
    </StarfieldBackground>
  );
}
