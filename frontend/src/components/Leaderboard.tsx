import { Trophy, Medal, Award, Coins } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamResult {
  team_id: number;
  team_name: string;
  team_color: string;
  tokens_total: number;
  tokens_stage?: number;
}

interface LeaderboardProps {
  equipos: TeamResult[];
}

// ---------------------------------------------------------------------------
// Mock data — remove or replace when integrating with real data
// ---------------------------------------------------------------------------

export const MOCK_EQUIPOS: TeamResult[] = [
  { team_id: 1, team_name: 'Emprendedores Alpha', team_color: 'Azul',     tokens_total: 420, tokens_stage: 140 },
  { team_id: 2, team_name: 'Los Innovadores',     team_color: 'Verde',    tokens_total: 390, tokens_stage: 130 },
  { team_id: 3, team_name: 'Startup Dreams',      team_color: 'Rojo',     tokens_total: 355, tokens_stage: 120 },
  { team_id: 4, team_name: 'Equipo Naranja',       team_color: 'Naranja',  tokens_total: 310, tokens_stage: 100 },
  { team_id: 5, team_name: 'Creativos UDD',        team_color: 'Morado',   tokens_total: 275, tokens_stage:  90 },
  { team_id: 6, team_name: 'Futuros Líderes',      team_color: 'Amarillo', tokens_total: 240, tokens_stage:  80 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getTeamColorHex = (color: string): string => {
  const colorMap: Record<string, string> = {
    Verde:    '#28a745',
    Azul:     '#007bff',
    Rojo:     '#dc3545',
    Amarillo: '#ffc107',
    Naranja:  '#fd7e14',
    Morado:   '#6f42c1',
    Rosa:     '#e83e8c',
    Cian:     '#17a2b8',
    Gris:     '#6c757d',
    Marrón:   '#795548',
  };
  return colorMap[color] ?? '#667eea';
};

// Podium slot configuration (visual order: 2nd left · 1st center · 3rd right)
const PODIUM_SLOTS = [
  {
    rank: 2,
    dataIndex: 1,
    heightClass: 'h-40',
    accentColor: '#94A3B8',        // slate-400 (silver)
    accentBg: 'bg-slate-100',
    accentBorder: 'border-slate-300',
    accentText: 'text-slate-500',
    icon: <Medal className="w-5 h-5" />,
    label: '2°',
    zIndex: 'z-10',
    scale: '',
  },
  {
    rank: 1,
    dataIndex: 0,
    heightClass: 'h-48',
    accentColor: '#F59E0B',        // amber-400 (gold)
    accentBg: 'bg-amber-50',
    accentBorder: 'border-amber-300',
    accentText: 'text-amber-500',
    icon: <Trophy className="w-6 h-6" />,
    label: '1°',
    zIndex: 'z-20',
    scale: 'scale-105',
  },
  {
    rank: 3,
    dataIndex: 2,
    heightClass: 'h-32',
    accentColor: '#B45309',        // amber-700 (bronze)
    accentBg: 'bg-orange-50',
    accentBorder: 'border-orange-300',
    accentText: 'text-orange-600',
    icon: <Award className="w-5 h-5" />,
    label: '3°',
    zIndex: 'z-10',
    scale: '',
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PodiumCard({
  team,
  slot,
}: {
  team: TeamResult;
  slot: typeof PODIUM_SLOTS[number];
}) {
  const teamColor = getTeamColorHex(team.team_color);

  return (
    <div
      className={`
        relative flex flex-col items-center justify-between
        ${slot.heightClass} w-36 sm:w-40
        bg-white border-2 ${slot.accentBorder}
        rounded-2xl shadow-md pt-4 pb-3 px-3
        ${slot.scale} transition-transform
        ${slot.zIndex}
      `}
    >
      {/* Rank badge */}
      <span
        className={`
          absolute -top-3 left-1/2 -translate-x-1/2
          inline-flex items-center gap-1
          text-xs font-bold px-2.5 py-1 rounded-full
          ${slot.accentBg} ${slot.accentText} border ${slot.accentBorder}
        `}
      >
        {slot.icon}
        {slot.label}
      </span>

      {/* Team avatar */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-2 shadow-sm"
        style={{ backgroundColor: teamColor }}
      >
        {team.team_color.charAt(0).toUpperCase()}
      </div>

      {/* Team name */}
      <p
        className="text-center text-xs font-semibold text-slate-800 leading-tight px-1 mt-1 line-clamp-2"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {team.team_name}
      </p>

      {/* Tokens */}
      <div
        className={`
          inline-flex items-center gap-1
          text-sm font-black rounded-lg px-2 py-1
          ${slot.accentBg} ${slot.accentText}
        `}
        style={{ fontFamily: 'Unbounded, sans-serif' }}
      >
        <Coins className="w-3.5 h-3.5" />
        {team.tokens_total}
      </div>
    </div>
  );
}

function HonorRow({ team, rank }: { team: TeamResult; rank: number }) {
  const teamColor = getTeamColorHex(team.team_color);

  return (
    <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Rank */}
      <span
        className="w-7 text-center text-xs font-bold text-slate-400 flex-shrink-0"
        style={{ fontFamily: 'Unbounded, sans-serif' }}
      >
        #{rank}
      </span>

      {/* Color dot */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: teamColor }}
      />

      {/* Name */}
      <p
        className="flex-1 text-sm font-semibold text-slate-800 truncate"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {team.team_name}
      </p>

      {/* Tokens */}
      <div className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 flex-shrink-0">
        <Coins className="w-4 h-4 text-amber-400" />
        <span style={{ fontFamily: 'Unbounded, sans-serif' }}>{team.tokens_total}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Leaderboard({ equipos }: LeaderboardProps) {
  const sorted = [...equipos].sort((a, b) => b.tokens_total - a.tokens_total);
  const top3   = sorted.slice(0, 3);
  const rest   = sorted.slice(3);

  return (
    <div
      className="w-full max-w-2xl mx-auto space-y-8"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Section header */}
      <div className="text-center">
        <h2
          className="text-lg font-black text-slate-900 tracking-tight"
          style={{ fontFamily: 'Unbounded, sans-serif' }}
        >
          Clasificación
        </h2>
        <p className="text-xs text-slate-400 mt-1">{sorted.length} equipos · tokens acumulados</p>
      </div>

      {/* ── Podium ── */}
      {top3.length > 0 && (
        <div className="flex flex-row items-end justify-center gap-3 sm:gap-5 px-4">
          {PODIUM_SLOTS.map((slot) => {
            const team = top3[slot.dataIndex];
            if (!team) return null;
            return <PodiumCard key={slot.rank} team={team} slot={slot} />;
          })}
        </div>
      )}

      {/* ── Lista de Honor ── */}
      {rest.length > 0 && (
        <div className="space-y-2 px-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 px-2">
            Lista de Honor
          </p>
          {rest.map((team, i) => (
            <HonorRow key={team.team_id} team={team} rank={i + 4} />
          ))}
        </div>
      )}
    </div>
  );
}
