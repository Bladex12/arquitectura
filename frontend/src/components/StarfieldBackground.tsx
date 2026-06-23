import { useRef } from 'react';
import { useStarfield } from '@/hooks/useStarfield';

interface StarfieldBackgroundProps {
  nebTarget?: [number, number, number];
  children?: React.ReactNode;
  className?: string;
}

export function StarfieldBackground({
  nebTarget = [20, 10, 55],
  children,
  className,
}: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useStarfield(canvasRef, nebTarget);

  return (
    <div className={className} style={{ background: '#050818', minHeight: '100vh', width: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, zIndex: 0 }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
