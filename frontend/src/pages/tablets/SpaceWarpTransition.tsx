import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPhase } from '@/config/phases';

export function SpaceWarpTransition() {
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  const stageParam = parseInt(searchParams.get('stage') || '1', 10);
  const phase = getPhase(stageParam);

  useEffect(() => {
    const redirect = searchParams.get('redirect') || '/tablet/lobby';
    const connId = searchParams.get('connection_id') || '';
    const p = getPhase(stageParam);

    const tc = canvasRef.current;
    if (!tc) return;
    const tx = tc.getContext('2d');
    if (!tx) return;
    tc.width = window.innerWidth;
    tc.height = window.innerHeight;
    const W = tc.width, H = tc.height;
    const info = infoRef.current;

    const wStars = Array.from({ length: 320 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      ox: 0, oy: 0,
      r: Math.random() * 1.1 + 0.3,
      a: Math.random() * 0.6 + 0.3,
    }));
    wStars.forEach(s => { s.ox = s.x - W / 2; s.oy = s.y - H / 2; });

    const rImg = new Image();
    rImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      `<svg viewBox="0 0 72 152" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(36,140)"><ellipse cx="0" cy="0" rx="10" ry="18" fill="#f97316" opacity="0.95"/>
        <ellipse cx="0" cy="-2" rx="6.5" ry="13" fill="#fbbf24"/><ellipse cx="0" cy="-4" rx="3.5" ry="8" fill="#fef3c7"/></g>
        <path d="M24 128 Q26 140 36 140 Q46 140 48 128Z" fill="#475569"/>
        <ellipse cx="36" cy="80" rx="18" ry="52" fill="#e2e8f0"/>
        <path d="M18 46 Q36 0 54 46Z" fill="#cbd5e1"/>
        <circle cx="36" cy="68" r="10" fill="#0f172a"/>
        <circle cx="36" cy="68" r="8" fill="#0ea5e9" opacity="0.85"/>
        <circle cx="33" cy="65" r="2.5" fill="white" opacity="0.55"/>
        <path d="M18 104 L4 132 L18 126Z" fill="#94a3b8"/>
        <path d="M54 104 L68 132 L54 126Z" fill="#94a3b8"/></svg>`
    );

    const TOTAL = 4000;
    const [pr, pg, pb] = p.glowRgb;
    let t0: number | null = null;
    let lastTs = 0;
    let rafId: number;
    let done = false;

    const shootingStars: { x: number; y: number; len: number; speed: number; angle: number; life: number; alpha: number }[] = [];
    let nextShoot = 0.12 + Math.random() * 0.18;

    const showUFO = Math.random() < 0.4;
    const ufo = showUFO ? {
      enterAt: 0.2 + Math.random() * 0.3,
      x: -120, y: H * (0.18 + Math.random() * 0.28),
      speed: W / 3500, wobble: 0, beamPulse: 0, done: false,
    } : null;

    function spawnShoot() {
      shootingStars.push({ x: Math.random() * W * 1.2 - W * 0.1, y: Math.random() * H * 0.55, len: 90 + Math.random() * 120, speed: 18 + Math.random() * 14, angle: Math.PI * 0.18 + Math.random() * 0.18, life: 1, alpha: 0 });
    }

    function drawShoots(dt: number) {
      nextShoot -= dt;
      if (nextShoot <= 0) { spawnShoot(); nextShoot = 0.6 + Math.random() * 1.4; }
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += Math.cos(s.angle) * s.speed; s.y += Math.sin(s.angle) * s.speed;
        s.alpha = s.life > 0.7 ? (1 - s.life) / 0.3 : s.life < 0.25 ? s.life / 0.25 : 1;
        s.life -= dt * 0.55;
        if (s.life <= 0) { shootingStars.splice(i, 1); continue; }
        const tail = { x: s.x - Math.cos(s.angle) * s.len, y: s.y - Math.sin(s.angle) * s.len };
        const g = tx.createLinearGradient(tail.x, tail.y, s.x, s.y);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, `rgba(200,220,255,${(s.alpha * 0.6).toFixed(2)})`); g.addColorStop(1, `rgba(255,255,255,${s.alpha.toFixed(2)})`);
        tx.beginPath(); tx.moveTo(tail.x, tail.y); tx.lineTo(s.x, s.y); tx.strokeStyle = g; tx.lineWidth = 2.5; tx.stroke();
        tx.beginPath(); tx.arc(s.x, s.y, 3, 0, Math.PI * 2); tx.fillStyle = `rgba(255,255,255,${s.alpha.toFixed(2)})`; tx.fill();
      }
    }

    function drawUFO(t: number, dt: number) {
      if (!ufo || ufo.done || t < ufo.enterAt) return;
      ufo.x += ufo.speed; ufo.wobble += dt * 3.5; ufo.beamPulse += dt * 4;
      const ux = ufo.x, uy = ufo.y + Math.sin(ufo.wobble) * 7;
      if (ufo.x > W + 160) { ufo.done = true; return; }
      tx.save();
      const beam = tx.createLinearGradient(ux, uy + 18, ux, uy + 120);
      beam.addColorStop(0, `rgba(120,255,180,${(0.18 + 0.1 * Math.sin(ufo.beamPulse)).toFixed(2)})`); beam.addColorStop(1, 'rgba(120,255,180,0)');
      tx.beginPath(); tx.moveTo(ux - 35, uy + 18); tx.lineTo(ux + 35, uy + 18); tx.lineTo(ux + 55, uy + 120); tx.lineTo(ux - 55, uy + 120); tx.closePath(); tx.fillStyle = beam; tx.fill();
      tx.restore(); tx.save(); tx.translate(ux, uy);
      tx.beginPath(); tx.ellipse(0, 8, 50, 14, 0, 0, Math.PI * 2); tx.fillStyle = '#374151'; tx.fill();
      tx.beginPath(); tx.ellipse(0, 8, 50, 14, 0, 0, Math.PI * 2); tx.strokeStyle = 'rgba(52,211,153,0.5)'; tx.lineWidth = 1.5; tx.stroke();
      tx.beginPath(); tx.ellipse(0, 0, 26, 16, 0, Math.PI, 0); tx.fillStyle = '#6ee7b7'; tx.fill();
      ([-22, -10, 2, 14] as number[]).forEach((wx, i) => {
        tx.beginPath(); tx.arc(wx, 8, 4, 0, Math.PI * 2);
        tx.fillStyle = `rgba(${i % 2 ? '52,211,153' : '251,191,36'},${(0.55 + 0.45 * Math.sin(ufo.beamPulse + i * 1.2)).toFixed(2)})`; tx.fill();
      });
      tx.restore();
    }

    function frame(ts: number) {
      if (done) return;
      const dt = (ts - (lastTs || ts)) / 1000; lastTs = ts;
      if (!t0) t0 = ts;
      const t = Math.min((ts - t0) / TOTAL, 1);
      const et = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      tx.fillStyle = '#000'; tx.fillRect(0, 0, W, H);
      const warp = Math.min(t * 3, 1) * Math.max(1 - (t - 0.65) / 0.35, 0);
      wStars.forEach(s => {
        const spread = 1 + warp * 40, sx = W / 2 + s.ox * spread, sy = H / 2 + s.oy * spread;
        const ang = Math.atan2(s.oy, s.ox), len = (1 + warp * 25) * s.r;
        tx.save(); tx.translate(sx, sy); tx.rotate(ang);
        tx.beginPath(); tx.ellipse(0, 0, len, s.r * 0.5, 0, 0, Math.PI * 2);
        tx.fillStyle = `rgba(255,255,255,${(s.a * (0.4 + warp * 0.6)).toFixed(2)})`; tx.fill(); tx.restore();
      });
      if (warp < 0.7) { drawShoots(dt); drawUFO(t, dt); }
      const pR = et * Math.min(W, H) * 0.24;
      if (pR > 1) {
        const pgx = W * 0.78, pgy = H * 0.5;
        const pg1 = tx.createRadialGradient(pgx, pgy, 0, pgx, pgy, pR * 2);
        pg1.addColorStop(0, `rgba(${pr},${pg},${pb},${(0.35 * et).toFixed(2)})`); pg1.addColorStop(0.55, `rgba(${pr},${pg},${pb},${(0.15 * et).toFixed(2)})`); pg1.addColorStop(1, 'transparent');
        tx.fillStyle = pg1; tx.beginPath(); tx.arc(pgx, pgy, pR * 2.2, 0, Math.PI * 2); tx.fill();
        tx.beginPath(); tx.arc(pgx, pgy, pR, 0, Math.PI * 2); tx.fillStyle = `rgba(${pr},${pg},${pb},${(0.65 * et).toFixed(2)})`; tx.fill();
      }
      const rx = W * 0.08 + et * (W * 0.44), ry = H * 0.5 - Math.sin(t * Math.PI) * H * 0.09;
      tx.save(); tx.translate(rx, ry); tx.rotate(Math.PI * 0.5 + 0.18);
      if (rImg.complete) tx.drawImage(rImg, -22, -44, 44, 88);
      tx.restore();
      if (t > 0.84) { const fa = (t - 0.84) / 0.16; tx.fillStyle = `rgba(0,0,0,${fa.toFixed(2)})`; tx.fillRect(0, 0, W, H); }
      if (info) info.style.opacity = t > 0.38 ? '1' : '0';
      if (t >= 1) {
        done = true;
        window.location.href = `/tablet/etapa-transition?stage=${stageParam}&redirect=${encodeURIComponent(redirect)}&connection_id=${connId}`;
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => { done = true; cancelAnimationFrame(rafId); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div
        ref={infoRef}
        style={{
          position: 'absolute', top: '14%', left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center', zIndex: 10, opacity: 0, transition: 'opacity 0.6s ease',
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '18px 40px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 11, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
          Viajando a
        </div>
        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(22px,3.5vw,42px)', fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase', color: '#fff', textShadow: '0 0 30px rgba(255,255,255,0.4)' }}>
          {phase.name}
        </div>
      </div>
    </div>
  );
}
