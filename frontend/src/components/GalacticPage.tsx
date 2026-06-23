import { StarfieldBackground } from './StarfieldBackground';

interface GalacticPageProps {
  children: React.ReactNode;
  className?: string;
  nebTarget?: [number, number, number];
  padding?: string;
}

export function GalacticPage({
  children,
  className = '',
  nebTarget,
  padding = 'p-6 md:p-8',
}: GalacticPageProps) {
  return (
    <StarfieldBackground nebTarget={nebTarget}>
      <div
        className={`min-h-screen flex flex-col ${padding} ${className}`}
        style={{ fontFamily: "'Exo 2', sans-serif", color: '#fff' }}
      >
        {children}
      </div>
    </StarfieldBackground>
  );
}
