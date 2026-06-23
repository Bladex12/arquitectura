import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getPhase } from '@/config/phases';
import { StarfieldBackground } from '@/components/StarfieldBackground';
import { RocketSVG } from '@/components/RocketSVG';

interface DustParticle {
  id: number;
  tx: number;
  ty: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
}

// Rocket touches down at: delay(700ms start) + duration(2800ms) + 450ms cushion = 3950ms
// Then: label +160ms, name +220ms, desc +500ms, button +700ms
const LAND = 3950;

export function PlanetLandingTransition() {
  const [searchParams] = useSearchParams();
  const stageParam = parseInt(searchParams.get('stage') || '1', 10);
  const redirect = searchParams.get('redirect') || '/tablet/lobby';
  const connId = searchParams.get('connection_id') || '';
  const phase = getPhase(stageParam);

  const [planetVisible, setPlanetVisible] = useState(false);
  const [showFlame, setShowFlame] = useState(true);
  const [dustParticles, setDustParticles] = useState<DustParticle[]>([]);
  const [quake, setQuake] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [showName, setShowName] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [vh] = useState(window.innerHeight);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPlanetVisible(true), 350),
      setTimeout(() => {
        setShowFlame(false);
        setQuake(true);
        setDustParticles(
          Array.from({ length: 22 }, (_, i) => ({
            id: i,
            tx: (Math.random() - 0.5) * 280,
            ty: -(Math.random() * 90 + 20),
            left: (Math.random() - 0.5) * 80,
            size: Math.random() * 10 + 5,
            delay: Math.random() * 0.18,
            duration: 0.6 + Math.random() * 0.4,
          }))
        );
        setTimeout(() => setQuake(false), 450);
      }, LAND),
      setTimeout(() => setShowLabel(true), LAND + 160),
      setTimeout(() => setShowName(true), LAND + 380),
      setTimeout(() => setShowDesc(true), LAND + 880),
      setTimeout(() => setShowButton(true), LAND + 1580),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const rocketLandY = vh * 0.62 - 152;

  const handleStart = () => {
    const encodedRedirect = encodeURIComponent(redirect);
    window.location.href = connId
      ? `/tablet/mapa-galactico?stage=${stageParam}&redirect=${encodedRedirect}&connection_id=${connId}`
      : `/tablet/mapa-galactico?stage=${stageParam}&redirect=${encodedRedirect}`;
  };

  const [pr, pg, pb] = phase.glowRgb;

  return (
    <StarfieldBackground nebTarget={phase.glowRgb}>
      <style>{`
        @keyframes dustfly {
          0%   { transform: translate(0,0) scale(1); opacity: 0.8; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        @keyframes quake {
          0%,100% { transform: translate(0,0); }
          20%     { transform: translate(-4px, 2px); }
          40%     { transform: translate(4px,-2px); }
          60%     { transform: translate(-2px, 3px); }
          80%     { transform: translate(3px,-1px); }
        }
        @keyframes btnPulse {
          0%,100% { box-shadow: 0 0 0 0 ${phase.color}55, 0 6px 32px ${phase.color}44; }
          50%     { box-shadow: 0 0 0 10px transparent,  0 6px 32px ${phase.color}44; }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0,
        animation: quake ? 'quake 0.45s ease-out' : 'none',
      }}>
        {/* Planet glow */}
        <div style={{
          position: 'fixed', bottom: '-25vh', left: '50%',
          transform: 'translateX(-50%)',
          width: '130vw', height: '70vh', borderRadius: '50%',
          background: `radial-gradient(ellipse at center, rgba(${pr},${pg},${pb},0.45) 0%, rgba(${pr},${pg},${pb},0.15) 45%, transparent 70%)`,
          filter: 'blur(80px)',
          opacity: planetVisible ? 1 : 0,
          transition: 'opacity 1.3s ease',
          pointerEvents: 'none',
          zIndex: 2,
        }} />

        {/* Planet surface */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: '38vh',
          background: phase.surface,
          borderRadius: '50% 50% 0 0 / 18% 18% 0 0',
          transform: planetVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 1.1s cubic-bezier(0.22,1,0.36,1)',
          boxShadow: `0 -20px 60px rgba(${pr},${pg},${pb},0.35)`,
          zIndex: 3,
        }} />

        {/* Stage progress dots */}
        <div style={{
          position: 'fixed', top: 28, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', gap: 10, zIndex: 20,
        }}>
          {[1, 2, 3, 4].map(n => (
            <div key={n} style={{
              width: n === stageParam ? 28 : 10, height: 10,
              borderRadius: 5,
              background: n === stageParam ? '#fff' : 'rgba(255,255,255,0.25)',
              boxShadow: n === stageParam ? `0 0 12px ${phase.color}` : 'none',
              transition: 'all 0.4s',
            }} />
          ))}
        </div>

        {/* Rocket (Framer Motion descent) */}
        <motion.div
          initial={{ top: -220 }}
          animate={{ top: rocketLandY }}
          transition={{ delay: 0.7, duration: 2.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed', left: '50%',
            transform: 'translateX(-50%)',
            width: 72, zIndex: 15,
          }}
        >
          <RocketSVG showFlame={showFlame} style={{ width: 72, height: 152 }} />
        </motion.div>

        {/* Dust particles (appear on landing) */}
        {dustParticles.map(p => (
          <div key={p.id} style={{
            position: 'fixed',
            left: `calc(50% + ${p.left}px)`,
            top: rocketLandY + 135,
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: `rgba(${pr},${pg},${pb},0.65)`,
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            animation: `dustfly ${p.duration}s ${p.delay}s ease-out forwards`,
            pointerEvents: 'none',
            zIndex: 14,
          } as React.CSSProperties} />
        ))}

        {/* Text content — centered in upper half */}
        <div style={{
          position: 'fixed', top: '12%', left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center', zIndex: 20,
          width: '90%', maxWidth: 620,
        }}>
          {showLabel && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                fontFamily: "'Exo 2', sans-serif",
                fontSize: 11, letterSpacing: 6,
                textTransform: 'uppercase' as const,
                color: phase.color, marginBottom: 14,
              }}
            >
              Etapa {stageParam} — Aterrizando en
            </motion.div>
          )}

          {showName && (
            <motion.div
              initial={{ opacity: 0, scale: 0.65 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 18 }}
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 'clamp(26px,5.5vw,68px)',
                fontWeight: 900, letterSpacing: 3,
                textTransform: 'uppercase' as const,
                color: '#fff',
                textShadow: `0 0 40px ${phase.color}, 0 0 90px rgba(${pr},${pg},${pb},0.5)`,
                marginBottom: 18, lineHeight: 1.1,
              }}
            >
              {phase.name}
            </motion.div>
          )}

          {showDesc && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
              style={{
                fontFamily: "'Exo 2', sans-serif",
                fontWeight: 300,
                color: 'rgba(255,255,255,0.72)',
                lineHeight: 1.75,
                maxWidth: 480, margin: '0 auto',
                fontSize: 'clamp(13px,1.8vw,16px)',
              }}
            >
              <div style={{ marginBottom: 4 }}>{phase.desc[0]}</div>
              <div>{phase.desc[1]}</div>
            </motion.div>
          )}

          {showButton && (
            <motion.button
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={handleStart}
              style={{
                marginTop: 300,
                padding: '15px 48px',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 13, fontWeight: 700, letterSpacing: 2,
                textTransform: 'uppercase' as const,
                color: '#fff',
                background: `linear-gradient(135deg, ${phase.colorRich} 0%, rgba(${pr},${pg},${pb},0.6) 100%)`,
                border: `1.5px solid ${phase.color}`,
                clipPath: 'polygon(14px 0%,calc(100% - 14px) 0%,100% 50%,calc(100% - 14px) 100%,14px 100%,0% 50%)',
                cursor: 'pointer',
                animation: 'btnPulse 2s ease infinite',
                outline: 'none',
                userSelect: 'none' as const,
              }}
            >
              ▶ Iniciar Misión
            </motion.button>
          )}
        </div>
      </div>
    </StarfieldBackground>
  );
}
