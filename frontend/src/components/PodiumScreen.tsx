import { useEffect, useState } from 'react';
import { StarfieldBackground } from './StarfieldBackground';

interface TeamResult {
  team_id: number;
  team_name: string;
  team_color: string;
  tokens_stage: number;
  tokens_total: number;
}

interface PodiumScreenProps {
  teams: TeamResult[];          // unsorted — component sorts by tokens_total desc
  stageName: string;            // e.g. "Trabajo en Equipo"
  onContinue: () => void;
  syncStatus?: Record<number, boolean>;   // team_id → tablet is on results screen
  actionButtons?: React.ReactNode;        // replaces the default Continuar button
}

const STAGE_HEIGHT_PCT = [0.90, 0.60, 0.44]; // 1st, 2nd, 3rd bar heights

function spawnConfetti() {
  const colors = ['#f59e0b', '#818cf8', '#f472b6', '#22d3ee', '#34d399', '#fb923c'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    const dur = (1.8 + Math.random() * 1.4).toFixed(2);
    const tx = (Math.random() * 200 - 100).toFixed(0);
    const ty = (window.innerHeight * 0.6 + Math.random() * window.innerHeight * 0.4).toFixed(0);
    const rot = (Math.random() * 720 - 360).toFixed(0);
    const delay = (Math.random() * 0.8).toFixed(2);
    el.style.cssText = `
      position:fixed;pointer-events:none;z-index:200;
      width:8px;height:8px;border-radius:2px;
      left:${Math.random() * window.innerWidth}px;top:-10px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      --tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;
      animation:confetti-fall ${dur}s ease-in ${delay}s forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), (parseFloat(dur) + parseFloat(delay) + 0.5) * 1000);
  }
}

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

function SyncBadge({ synced }: { synced?: boolean }) {
  if (synced === undefined) return null;
  if (synced) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.4)',
        borderRadius: 999, padding: '2px 8px', fontSize: 9, letterSpacing: 1,
        color: '#34d399', marginBottom: 5, textTransform: 'uppercase',
        animation: 'syncPulse 1.4s infinite',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
        tablet OK
      </div>
    );
  }
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 999, padding: '2px 8px', fontSize: 9, letterSpacing: 1,
      color: 'rgba(255,255,255,0.3)', marginBottom: 5, textTransform: 'uppercase',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'inline-block' }} />
      esperando
    </div>
  );
}

export function PodiumScreen({ teams, stageName, onContinue, syncStatus, actionButtons }: PodiumScreenProps) {
  const sorted = [...teams].sort((a, b) => b.tokens_total - a.tokens_total);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  // reveal states
  const [showLower, setShowLower]       = useState<boolean[]>(rest.map(() => false));
  const [barHeights, setBarHeights]     = useState([0, 0, 0]);
  const [showAvatars, setShowAvatars]   = useState([false, false, false]);
  const [showContinue, setShowContinue] = useState(false);

  const stageH = Math.round(window.innerHeight * 0.38);

  useEffect(() => {
    let cancelled = false;
    async function reveal() {
      // 4th and 5th (rest in reverse: 5th first, then 4th)
      for (let i = rest.length - 1; i >= 0; i--) {
        await delay(700);
        if (cancelled) return;
        setShowLower(prev => { const n = [...prev]; n[i] = true; return n; });
      }

      // 3rd bar
      await delay(900);
      if (cancelled) return;
      setBarHeights(prev => { const n = [...prev]; n[2] = Math.round(stageH * STAGE_HEIGHT_PCT[2]); return n; });
      await delay(500);
      if (cancelled) return;
      setShowAvatars(prev => { const n = [...prev]; n[2] = true; return n; });

      // 2nd bar
      await delay(1000);
      if (cancelled) return;
      setBarHeights(prev => { const n = [...prev]; n[1] = Math.round(stageH * STAGE_HEIGHT_PCT[1]); return n; });
      await delay(500);
      if (cancelled) return;
      setShowAvatars(prev => { const n = [...prev]; n[1] = true; return n; });

      // 1st bar + confetti
      await delay(1100);
      if (cancelled) return;
      setBarHeights(prev => { const n = [...prev]; n[0] = Math.round(stageH * STAGE_HEIGHT_PCT[0]); return n; });
      spawnConfetti();
      await delay(600);
      if (cancelled) return;
      setShowAvatars(prev => { const n = [...prev]; n[0] = true; return n; });

      await delay(800);
      if (!cancelled) setShowContinue(true);
    }
    reveal();
    return () => { cancelled = true; };
  }, []);

  // Layout: 2nd left, 1st center, 3rd right (Kahoot style)
  const layoutOrder = [
    { idx: 1, barClass: 'bar-2', heightIdx: 1 },
    { idx: 0, barClass: 'bar-1', heightIdx: 0 },
    { idx: 2, barClass: 'bar-3', heightIdx: 2 },
  ];

  return (
    <StarfieldBackground nebTarget={[20, 10, 55]}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', padding: 'clamp(16px,3vh,32px) 24px clamp(8px,1.5vh,16px)' }}>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
            Después de
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, color: '#fff' }}>
            {stageName}
          </div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 'clamp(28px,5vw,60px)', fontWeight: 900, color: '#fff', letterSpacing: 3, textTransform: 'uppercase', textShadow: '0 0 40px rgba(192,38,211,0.6),0 0 80px rgba(124,58,237,0.3)' }}>
            Clasifi<span style={{ color: '#f59e0b' }}>cación</span>
          </div>
        </div>

        {/* 4th and 5th */}
        {rest.length > 0 && (
          <div style={{ display: 'flex', gap: 10, padding: '0 24px', marginBottom: 'clamp(8px,1.5vh,16px)', flexWrap: 'wrap', justifyContent: 'center' }}>
            {rest.map((t, i) => (
              <div key={t.team_id} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
                padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 180,
                opacity: showLower[i] ? 1 : 0,
                transform: showLower[i] ? 'none' : 'translateX(40px)',
                transition: 'opacity 0.55s ease, transform 0.55s cubic-bezier(0.22,1,0.36,1)',
              }}>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900, color: 'rgba(255,255,255,0.25)', width: 24, textAlign: 'center' }}>
                  {i + 4}
                </div>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.team_color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 14, fontWeight: 600, color: '#fff' }}>{t.team_name}</div>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{t.tokens_total.toLocaleString()} pts</div>
                </div>
                {syncStatus !== undefined && (
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: syncStatus[t.team_id] ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${syncStatus[t.team_id] ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: syncStatus[t.team_id] ? '#34d399' : 'rgba(255,255,255,0.3)',
                  }}>
                    {syncStatus[t.team_id] ? '✓' : '···'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Podium bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', flex: 1, width: '100%', padding: '0 clamp(16px,4vw,60px)', gap: 'clamp(4px,1vw,12px)' }}>
          {layoutOrder.map(({ idx, barClass, heightIdx }) => {
            const t = top3[idx];
            if (!t) return null;
            const rank = idx + 1;
            return (
              <div key={t.team_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 'clamp(100px,22vw,200px)' }}>
                {rank === 1 && (
                  <div style={{ fontSize: 'clamp(16px,2.5vw,26px)', marginBottom: 2, opacity: showAvatars[idx] ? 1 : 0, transform: showAvatars[idx] ? 'none' : 'translateY(8px) scale(0.5)', transition: 'opacity 0.5s ease, transform 0.6s cubic-bezier(0.34,1.8,0.64,1)' }}>
                    👑
                  </div>
                )}
                <div style={{
                  width: 'clamp(50px,7vw,72px)', height: 'clamp(50px,7vw,72px)', borderRadius: '50%',
                  background: t.team_color, border: '3px solid rgba(255,255,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'clamp(20px,3vw,30px)', marginBottom: 6,
                  opacity: showAvatars[idx] ? 1 : 0,
                  transform: showAvatars[idx] ? 'none' : 'translateY(24px) scale(0.7)',
                  transition: 'opacity 0.6s ease, transform 0.7s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  🚀
                </div>
                <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 'clamp(11px,1.1vw,14px)', fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 2, whiteSpace: 'nowrap', opacity: showAvatars[idx] ? 1 : 0, transition: 'opacity 0.4s ease' }}>
                  {t.team_name}
                </div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 'clamp(10px,1vw,12px)', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6, opacity: showAvatars[idx] ? 1 : 0, transition: 'opacity 0.4s ease 0.1s' }}>
                  {t.tokens_total.toLocaleString()} pts
                </div>
                {syncStatus !== undefined && showAvatars[idx] && (
                  <SyncBadge synced={syncStatus[t.team_id]} />
                )}
                <div className={`pd-bar ${barClass}`} style={{ height: barHeights[heightIdx] }}>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 'clamp(22px,3.5vw,40px)', fontWeight: 900, color: 'rgba(255,255,255,0.25)' }}>
                    {rank}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Continue / action buttons */}
        <div style={{ position: 'relative', zIndex: 2, margin: 'clamp(10px,2vh,20px) 0 clamp(16px,3vh,30px)' }}>
          {actionButtons ?? (
            <button
              className="btn-galactic-primary"
              onClick={onContinue}
              style={{
                opacity: showContinue ? 1 : 0,
                transform: showContinue ? 'none' : 'translateY(16px)',
                transition: 'opacity 0.5s ease, transform 0.5s ease',
                pointerEvents: showContinue ? 'all' : 'none',
              }}
            >
              Continuar →
            </button>
          )}
        </div>

      </div>
    </StarfieldBackground>
  );
}
