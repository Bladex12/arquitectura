interface RocketSVGProps {
  className?: string;
  style?: React.CSSProperties;
  showFlame?: boolean;
}

export function RocketSVG({ className, style, showFlame = true }: RocketSVGProps) {
  return (
    <>
      <style>{`
        @keyframes rocketFlicker {
          from { transform: scaleX(1) scaleY(1); }
          to   { transform: scaleX(0.85) scaleY(0.92); }
        }
        .rocket-flame1 { animation: rocketFlicker 0.12s infinite alternate; }
        .rocket-flame2 { animation: rocketFlicker 0.09s 0.03s infinite alternate; }
      `}</style>
      <svg
        viewBox="0 0 72 152"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ filter: 'drop-shadow(0 0 12px rgba(249,115,22,0.6))', ...style }}
      >
        <g style={{ display: showFlame ? 'block' : 'none' }} transform="translate(36,140)">
          <ellipse className="rocket-flame1" cx="0" cy="0" rx="10" ry="18" fill="#f97316" opacity="0.95" />
          <ellipse className="rocket-flame2" cx="0" cy="-2" rx="6.5" ry="13" fill="#fbbf24" />
          <ellipse cx="0" cy="-4" rx="3.5" ry="8" fill="#fef3c7" />
        </g>
        <path d="M24 128 Q26 140 36 140 Q46 140 48 128Z" fill="#475569" />
        <ellipse cx="36" cy="80" rx="18" ry="52" fill="#e2e8f0" />
        <path d="M18 46 Q36 0 54 46Z" fill="#cbd5e1" />
        <path d="M25 36 Q36 10 47 36Z" fill="#94a3b8" opacity="0.6" />
        <circle cx="36" cy="68" r="10" fill="#0f172a" />
        <circle cx="36" cy="68" r="8" fill="#0ea5e9" opacity="0.85" />
        <circle cx="33" cy="65" r="2.5" fill="white" opacity="0.55" />
        <rect x="18" y="88" width="36" height="7" rx="1" fill="rgba(255,255,255,0.15)" />
        <rect x="18" y="100" width="36" height="4" rx="1" fill="rgba(255,255,255,0.1)" />
        <path d="M18 104 L4 132 L18 126Z" fill="#94a3b8" />
        <path d="M54 104 L68 132 L54 126Z" fill="#94a3b8" />
      </svg>
    </>
  );
}
