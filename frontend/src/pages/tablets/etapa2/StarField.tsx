import { useEffect, useRef } from 'react';

interface Star {
  x: number; y: number; r: number; a: number; p: number; s: number;
}

export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;
    let stars: Star[] = [];

    function makeStars(W: number, H: number): Star[] {
      return Array.from({ length: 260 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.5 + 0.2,
        p: Math.random() * Math.PI * 2,
        s: Math.random() * 0.013 + 0.004,
      }));
    }

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      stars = makeStars(canvas!.width, canvas!.height);
    }

    function draw(ts: number) {
      const t = ts * 0.001;
      const W = canvas!.width, H = canvas!.height;
      ctx.fillStyle = '#050818';
      ctx.fillRect(0, 0, W, H);

      const g1 = ctx.createRadialGradient(W * 0.3, H * 0.38, 0, W * 0.3, H * 0.38, W * 0.58);
      g1.addColorStop(0, 'rgba(9,60,146,0.2)');
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      const g2 = ctx.createRadialGradient(W * 0.74, H * 0.6, 0, W * 0.74, H * 0.6, W * 0.36);
      g2.addColorStop(0, 'rgba(192,38,211,0.1)');
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);

      stars.forEach(s => {
        const tw = 0.5 + 0.5 * Math.sin(s.p + t * s.s * 60);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.a * tw})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
