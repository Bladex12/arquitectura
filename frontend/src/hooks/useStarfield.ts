import { useEffect, useRef, RefObject } from 'react';

interface Star {
  x: number; y: number; r: number; a: number; p: number; s: number;
}

interface ShootingStar {
  x: number; y: number; len: number; speed: number; angle: number; life: number;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpC(a: number[], b: number[], t: number) { return a.map((v, i) => lerp(v, b[i], t)); }

export function useStarfield(
  canvasRef: RefObject<HTMLCanvasElement>,
  nebTarget: [number, number, number] = [20, 10, 55]
) {
  // Keep ref in sync with latest prop — animation loop reads it without restarting
  const nebTargetRef = useRef<[number, number, number]>(nebTarget);
  nebTargetRef.current = nebTarget;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let BW = 0, BH = 0;
    let stars: Star[] = [];
    let nebRgb: number[] = [20, 10, 55];
    let rafId: number;
    let bgPrev = 0;
    const bgShoot: ShootingStar[] = [];
    let bgShootNext = 1.2 + Math.random() * 2;

    function resize() {
      BW = canvas.width = window.innerWidth;
      BH = canvas.height = window.innerHeight;
    }

    function makeStars() {
      stars = [];
      for (let i = 0; i < 300; i++) {
        stars.push({
          x: Math.random() * BW,
          y: Math.random() * BH,
          r: Math.random() * 1.3 + 0.25,
          a: Math.random() * 0.7 + 0.2,
          p: Math.random() * Math.PI * 2,
          s: Math.random() * 0.016 + 0.005,
        });
      }
    }

    function spawnBgShoot() {
      bgShoot.push({
        x: Math.random() * BW * 1.1,
        y: Math.random() * BH * 0.6,
        len: 70 + Math.random() * 110,
        speed: 12 + Math.random() * 10,
        angle: Math.PI * 0.18 + Math.random() * 0.16,
        life: 1,
      });
    }

    function drawBgShoots(dt: number) {
      bgShootNext -= dt;
      if (bgShootNext <= 0) { spawnBgShoot(); bgShootNext = 1.8 + Math.random() * 3.5; }
      for (let i = bgShoot.length - 1; i >= 0; i--) {
        const s = bgShoot[i];
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        const alpha = s.life > 0.7 ? (1 - s.life) / 0.3 : s.life < 0.25 ? s.life / 0.25 : 1;
        s.life -= dt * 0.5;
        if (s.life <= 0) { bgShoot.splice(i, 1); continue; }
        const tx = s.x - Math.cos(s.angle) * s.len;
        const ty = s.y - Math.sin(s.angle) * s.len;
        const g = ctx.createLinearGradient(tx, ty, s.x, s.y);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.65, `rgba(200,220,255,${(alpha * 0.55).toFixed(2)})`);
        g.addColorStop(1, `rgba(255,255,255,${alpha.toFixed(2)})`);
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`; ctx.fill();
      }
    }

    function bgLoop(ts: number) {
      const dt = (ts - bgPrev) / 1000;
      bgPrev = ts;
      const t = ts * 0.001;
      nebRgb = lerpC(nebRgb, nebTargetRef.current, 0.022);
      const [r, g, b] = nebRgb;

      ctx.fillStyle = '#050818';
      ctx.fillRect(0, 0, BW, BH);

      const g1 = ctx.createRadialGradient(BW * 0.28, BH * 0.38, 0, BW * 0.28, BH * 0.38, BW * 0.65);
      g1.addColorStop(0, `rgba(${r | 0},${g | 0},${b | 0},.3)`);
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1; ctx.fillRect(0, 0, BW, BH);

      const g2 = ctx.createRadialGradient(BW * 0.75, BH * 0.6, 0, BW * 0.75, BH * 0.6, BW * 0.4);
      g2.addColorStop(0, `rgba(${Math.min(255, (r | 0) + 20)},${Math.max(0, (g | 0) - 8)},${Math.min(255, (b | 0) + 45)},.13)`);
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, BW, BH);

      stars.forEach(s => {
        const tw = 0.5 + 0.5 * Math.sin(s.p + t * s.s * 60);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(s.a * tw).toFixed(2)})`; ctx.fill();
      });

      drawBgShoots(dt > 0.1 ? 0.1 : dt);
      rafId = requestAnimationFrame(bgLoop);
    }

    function handleResize() { resize(); makeStars(); }

    resize();
    makeStars();
    rafId = requestAnimationFrame(bgLoop);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]);
}
