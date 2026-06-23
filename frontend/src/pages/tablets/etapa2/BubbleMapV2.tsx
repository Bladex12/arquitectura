import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import StarField from './StarField';
import {
  sessionsAPI,
  tabletConnectionsAPI,
  challengesAPI,
  teamBubbleMapsAPI,
  tokenTransactionsAPI,
  teamActivityProgressAPI,
} from '@/services';
import { getResultsRedirectUrl } from '@/utils/tabletResultsRedirect';
import { advanceActivityOnTimerExpiration } from '@/utils/timerAutoAdvance';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team { id: number; name: string; }

interface Challenge {
  id: number; title: string;
  persona_name?: string; persona_age?: number;
  persona_story?: string; persona_image_url?: string;
}

interface GameSession {
  id: number; status: string;
  current_activity?: number; current_activity_name?: string;
  current_stage_number?: number;
}

interface Idea {
  id: string; text: string; x: number | null; y: number | null;
}

interface NodeDef {
  id: string; label: string; icon: string;
  color: string; rgb: string; angle: number;
  ideas: Idea[]; isCustom?: boolean;
}

interface MapState {
  version: 2;
  central: { personName: string; emoji: string };
  nodes: NodeDef[];
  customNodes: NodeDef[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_NODES: Omit<NodeDef, 'ideas'>[] = [
  { id: 'perfil',       label: 'Perfil',       icon: '👤', color: '#c026d3', rgb: '192,38,211', angle: -90 },
  { id: 'entorno',      label: 'Entorno',      icon: '🌍', color: '#3b82f6', rgb: '59,130,246',  angle: -30 },
  { id: 'emociones',    label: 'Emociones',    icon: '💛', color: '#f97316', rgb: '249,115,22',  angle:  30 },
  { id: 'necesidades',  label: 'Necesidades',  icon: '💡', color: '#10b981', rgb: '16,185,129',  angle:  90 },
  { id: 'limitaciones', label: 'Limitaciones', icon: '🚧', color: '#ef4444', rgb: '239,68,68',   angle: 150 },
  { id: 'motivaciones', label: 'Motivaciones', icon: '⭐', color: '#f59e0b', rgb: '245,158,11',  angle: -150 },
];

const QUESTIONS: Record<string, string[]> = {
  perfil:       ['¿Cuántos años tiene y a qué se dedica?', '¿Cuál es su nivel socioeconómico o educativo?', '¿Dónde vive y con quién convive?', '¿Qué tecnología usa en su día a día?'],
  entorno:      ['¿Cómo es el lugar donde vive o trabaja?', '¿Qué personas o instituciones lo rodean?', '¿Qué recursos tiene disponibles?', '¿Qué barreras físicas o geográficas enfrenta?'],
  emociones:    ['¿Cómo se siente frente a su problema?', '¿Qué le genera frustración o angustia?', '¿Qué le da tranquilidad o esperanza?', '¿Cómo afecta esto su bienestar diario?'],
  necesidades:  ['¿Qué necesita resolver con urgencia?', '¿Qué le haría la vida más fácil hoy?', '¿Qué servicio o herramienta le falta?', '¿Cuál es su necesidad más profunda?'],
  limitaciones: ['¿Qué le impide resolver su problema solo?', '¿Tiene limitaciones económicas o culturales?', '¿Qué intentó antes y no le funcionó?', '¿Qué soluciones existen pero no puede usar?'],
  motivaciones: ['¿Qué lo impulsa a seguir adelante?', '¿Cuáles son sus metas a futuro?', '¿Qué valora más en su vida?', '¿Qué cambio concreto quisiera ver?'],
};

const CUSTOM_COLORS = ['#818cf8', '#22d3ee', '#fb7185', '#a3e635', '#e879f9', '#fbbf24'];

// ─── Pure helpers (no React deps) ────────────────────────────────────────────

function makeDefaultMapState(ch: Challenge | null): MapState {
  const firstName = ch?.persona_name?.split(' ')[0] || 'Persona';
  return {
    version: 2,
    central: { personName: firstName, emoji: '👤' },
    nodes: DEFAULT_NODES.map(n => ({ ...n, ideas: [] })),
    customNodes: [],
  };
}

function nodePos(angle: number, W: number, H: number) {
  const R = Math.min(W, H) * 0.3;
  const rad = (angle * Math.PI) / 180;
  return { x: W / 2 + R * Math.cos(rad), y: H / 2 + R * Math.sin(rad) };
}

function ideaDefaultPos(angle: number, idx: number, total: number, W: number, H: number) {
  const np = nodePos(angle, W, H);
  const outward = Math.atan2(np.y - H / 2, np.x - W / 2);
  const spread = total > 1 ? Math.min(0.55, (total - 1) * 0.25) : 0;
  const offset = total > 1 ? (idx - (total - 1) / 2) * (spread / (total - 1)) : 0;
  const a = outward + offset;
  return { x: np.x + 100 * Math.cos(a), y: np.y + 100 * Math.sin(a) };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TabletBubbleMapV2() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [team, setTeam] = useState<Team | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [sessionStageId, setSessionStageId] = useState<number | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<number | null>(null);

  const [mapData, setMapData] = useState<MapState | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelInput, setPanelInput] = useState('');
  const [view, setView] = useState<'loading' | 'map' | 'complete'>('loading');
  const [score, setScore] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState('--:--');
  const [, forceUpdate] = useState(0);

  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customColor, setCustomColor] = useState(CUSTOM_COLORS[0]);

  const mapAreaRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const mapDataRef = useRef<MapState | null>(null);
  const mapIdRef = useRef<number | null>(null);
  const teamRef = useRef<Team | null>(null);
  const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);
  const timeExpiredRef = useRef(false);
  const sessionStageIdRef = useRef<number | null>(null);
  const dragRef = useRef<{
    active: boolean; ideaId: string; nodeId: string;
    el: HTMLDivElement | null; offX: number; offY: number;
  }>({ active: false, ideaId: '', nodeId: '', el: null, offX: 0, offY: 0 });

  // Keep refs in sync with state
  useEffect(() => { mapDataRef.current = mapData; renderLines(); }, [mapData]);
  useEffect(() => { mapIdRef.current = mapId; }, [mapId]);
  useEffect(() => { teamRef.current = team; }, [team]);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) { navigate('/tablet/join'); return; }
    setConnectionId(connId);
    loadGameState(connId, true);
    intervalRef.current = setInterval(() => {
      if (!isFetchingRef.current) loadGameState(connId, false);
    }, 5000);

    const onMove = (e: PointerEvent) => handleDragMove(e);
    const onUp = () => handleDragEnd();
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);

    const onResize = () => { forceUpdate(n => n + 1); renderLines(); };
    window.addEventListener('resize', onResize);

    return () => {
      clearInterval(intervalRef.current!);
      clearInterval(timerIntervalRef.current!);
      clearInterval(timerSyncRef.current!);
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // ── Game state ────────────────────────────────────────────────────────────

  const loadGameState = async (connId: string, isInitialLoad: boolean) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const statusData = await tabletConnectionsAPI.getStatus(connId);
      const gsId = statusData.game_session.id;
      setTeam(statusData.team);
      teamRef.current = statusData.team;

      const lobbyData = await sessionsAPI.getLobby(gsId);
      const gameData: GameSession = lobbyData.game_session;

      const resultsUrl = getResultsRedirectUrl(gameData, connId);
      if (resultsUrl) { window.location.href = resultsUrl; return; }

      if (gameData.status === 'finished' || gameData.status === 'completed') {
        setTimeout(() => navigate('/tablet/join'), 2000);
        return;
      }
      if (gameData.status === 'lobby') { navigate(`/tablet/lobby?connection_id=${connId}`); return; }

      if (isInitialLoad) {
        const stages = await sessionsAPI.getSessionStages(gsId);
        const stagesArr = Array.isArray(stages) ? stages : [];
        const stage2 = stagesArr.find((s: any) => s.stage_number === 2);
        if (stage2) {
          setSessionStageId(stage2.id);
          sessionStageIdRef.current = stage2.id;
          await loadBubbleMapData(statusData.team.id, stage2.id);
          syncTimer(gsId, connId, stage2.id);
          timerSyncRef.current = setInterval(() => syncTimer(gsId, connId, stage2.id), 30000);
        } else {
          setView('map');
        }
      }
    } catch (err) {
      console.error('Error loading game state:', err);
      if (isInitialLoad) setView('map');
    } finally {
      isFetchingRef.current = false;
    }
  };

  const loadBubbleMapData = async (teamId: number, stageId: number) => {
    try {
      // Load selected challenge from progress
      const progressList = await teamActivityProgressAPI.list({ team: teamId, session_stage: stageId });
      const progressArr = Array.isArray(progressList) ? progressList : [progressList];
      const progressWithChallenge = progressArr.find((p: any) => p?.selected_challenge);
      const progress = progressWithChallenge || progressArr[0];

      let ch: Challenge | null = null;
      if (progress?.selected_challenge) {
        const raw = typeof progress.selected_challenge === 'object'
          ? progress.selected_challenge
          : { id: progress.selected_challenge };
        ch = (!raw.persona_name)
          ? await challengesAPI.getChallengeById(raw.id)
          : raw as Challenge;
        setChallenge(ch);
      }

      // Load existing bubble map (v2 format only)
      const maps = await teamBubbleMapsAPI.list({ team: teamId, session_stage: stageId });
      const mapsArr = Array.isArray(maps) ? maps : (maps?.results || []);
      const existingMap = mapsArr[0];

      if (existingMap?.map_data?.version === 2) {
        setMapId(existingMap.id);
        setMapData(existingMap.map_data as MapState);
      } else {
        setMapData(makeDefaultMapState(ch));
      }

      // Check if already finalized
      const txList = await tokenTransactionsAPI.list({ team: teamId, session_stage: stageId });
      const txArr = Array.isArray(txList) ? txList : [];
      if (txArr.length > 0) setIsSubmitted(true);

      setView('map');
    } catch (err) {
      console.error('Error loading bubble map data:', err);
      setView('map');
    }
  };

  const syncTimer = async (gsId: number, connId: string, stageId: number) => {
    try {
      const timerData = await sessionsAPI.getActivityTimer(gsId);
      if (!timerData) return;
      const remaining = timerData.remaining_seconds ?? 0;
      if (remaining <= 0 && !timeExpiredRef.current) {
        timeExpiredRef.current = true;
        await advanceActivityOnTimerExpiration(gsId, stageId, connId);
      }
      startLocalTimer(remaining);
    } catch {}
  };

  const startLocalTimer = (seconds: number) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    let s = seconds;
    const update = () => {
      const m = Math.floor(s / 60), sec = s % 60;
      setTimerRemaining(`${m}:${String(sec).padStart(2, '0')}`);
    };
    update();
    timerIntervalRef.current = setInterval(() => { s = Math.max(0, s - 1); update(); }, 1000);
  };

  // ── SVG lines ─────────────────────────────────────────────────────────────

  const renderLines = () => {
    const svg = svgRef.current;
    const area = mapAreaRef.current;
    const data = mapDataRef.current;
    if (!svg || !area || !data) { if (svg) svg.innerHTML = ''; return; }
    const W = area.clientWidth, H = area.clientHeight;
    const cx = W / 2, cy = H / 2;
    let html = '';
    [...data.nodes, ...data.customNodes].forEach(node => {
      const np = nodePos(node.angle, W, H);
      html += `<line x1="${cx}" y1="${cy}" x2="${np.x}" y2="${np.y}" stroke="${node.color}" stroke-width="1.5" stroke-opacity="0.3" stroke-dasharray="6 5"/>`;
      node.ideas.forEach(idea => {
        if (idea.x != null && idea.y != null) {
          html += `<line x1="${np.x}" y1="${np.y}" x2="${idea.x}" y2="${idea.y}" stroke="${node.color}" stroke-width="1.2" stroke-opacity="0.35" stroke-dasharray="4 4"/>`;
        }
      });
    });
    svg.innerHTML = html;
  };

  // ── Drag ──────────────────────────────────────────────────────────────────

  const handleDragStart = (
    e: React.PointerEvent<HTMLDivElement>,
    nodeId: string, ideaId: string,
    el: HTMLDivElement, ideaX: number, ideaY: number
  ) => {
    e.stopPropagation();
    dragRef.current = { active: true, ideaId, nodeId, el, offX: e.clientX - ideaX, offY: e.clientY - ideaY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';
    el.style.zIndex = '30';
  };

  const handleDragMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d.active || !d.el) return;
    const newX = e.clientX - d.offX;
    const newY = e.clientY - d.offY;
    d.el.style.left = `${newX}px`;
    d.el.style.top = `${newY}px`;
    const data = mapDataRef.current;
    if (data) {
      const allNodes = [...data.nodes, ...data.customNodes];
      const node = allNodes.find(n => n.id === d.nodeId);
      const idea = node?.ideas.find(i => i.id === d.ideaId);
      if (idea) { idea.x = newX; idea.y = newY; }
      renderLines();
    }
  };

  const handleDragEnd = () => {
    const d = dragRef.current;
    if (!d.active) return;
    if (d.el) { d.el.style.cursor = 'grab'; d.el.style.zIndex = ''; }
    d.active = false;
    if (mapDataRef.current) {
      setMapData({ ...mapDataRef.current });
      triggerAutoSave();
    }
  };

  // ── Auto-save ─────────────────────────────────────────────────────────────

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    autoSaveTimeout.current = setTimeout(() => saveMap(), 1000);
  }, []);

  const saveMap = async () => {
    const data = mapDataRef.current;
    const t = teamRef.current;
    const stageId = sessionStageIdRef.current;
    if (!data || !t || !stageId || isSubmitted) return;
    try {
      if (mapIdRef.current) {
        await teamBubbleMapsAPI.update(mapIdRef.current, { map_data: data });
      } else {
        const result = await teamBubbleMapsAPI.create({
          team: t.id, session_stage: stageId, map_data: data,
        });
        const newId = result.id;
        setMapId(newId);
        mapIdRef.current = newId;
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  };

  // ── Idea CRUD ─────────────────────────────────────────────────────────────

  const addIdea = () => {
    const text = panelInput.trim();
    if (!text || !selectedNodeId || isSubmitted) return;
    const area = mapAreaRef.current;
    const W = area?.clientWidth || 800, H = area?.clientHeight || 600;

    setMapData(prev => {
      if (!prev) return prev;
      const updateNodes = (nodes: NodeDef[]) =>
        nodes.map(n => {
          if (n.id !== selectedNodeId) return n;
          const newIdeas = [...n.ideas];
          const pos = ideaDefaultPos(n.angle, newIdeas.length, newIdeas.length + 1, W, H);
          newIdeas.push({ id: `idea-${Date.now()}-${Math.random().toString(36).slice(2)}`, text, x: pos.x, y: pos.y });
          return { ...n, ideas: newIdeas };
        });
      const next = { ...prev, nodes: updateNodes(prev.nodes), customNodes: updateNodes(prev.customNodes) };
      mapDataRef.current = next;
      return next;
    });
    setPanelInput('');
    triggerAutoSave();
  };

  const deleteIdea = (nodeId: string, ideaId: string) => {
    if (isSubmitted) return;
    setMapData(prev => {
      if (!prev) return prev;
      const removeIdea = (nodes: NodeDef[]) =>
        nodes.map(n => n.id === nodeId ? { ...n, ideas: n.ideas.filter(i => i.id !== ideaId) } : n);
      const next = { ...prev, nodes: removeIdea(prev.nodes), customNodes: removeIdea(prev.customNodes) };
      mapDataRef.current = next;
      return next;
    });
    triggerAutoSave();
  };

  // ── Custom node ───────────────────────────────────────────────────────────

  const addCustomNode = () => {
    const name = customName.trim();
    if (!name || !mapData) return;
    if (mapData.customNodes.length >= 3) { toast.error('Máximo 3 categorías propias'); return; }
    const usedAngles = [...mapData.nodes, ...mapData.customNodes].map(n => n.angle);
    const candidates = [-60, 0, 60, 120, 180, -120, -80, 80, -40, 40];
    const angle = candidates.find(a => !usedAngles.includes(a)) ?? Math.random() * 360 - 180;
    const rgb = customColor.replace('#', '').match(/.{2}/g)!.map(h => parseInt(h, 16)).join(',');
    const newNode: NodeDef = {
      id: `custom-${Date.now()}`, label: name, icon: '✦',
      color: customColor, rgb, angle, ideas: [], isCustom: true,
    };
    setMapData(prev => {
      if (!prev) return prev;
      const next = { ...prev, customNodes: [...prev.customNodes, newNode] };
      mapDataRef.current = next;
      return next;
    });
    setCustomModalOpen(false);
    setCustomName('');
    setCustomColor(CUSTOM_COLORS[0]);
    triggerAutoSave();
  };

  // ── Finalize ──────────────────────────────────────────────────────────────

  const finishMap = async () => {
    if (!teamRef.current || !sessionStageIdRef.current || isSubmitted) return;
    await saveMap();
    try {
      await teamBubbleMapsAPI.finalize(teamRef.current.id, sessionStageIdRef.current);
    } catch {}
    const data = mapDataRef.current;
    const totalIdeas = data
      ? [...data.nodes, ...data.customNodes].reduce((s, n) => s + n.ideas.length, 0)
      : 0;
    setScore(Math.min(1000, 300 + totalIdeas * 50));
    setIsSubmitted(true);
    setView('complete');
    spawnConfetti();
  };

  const spawnConfetti = () => {
    const cols = ['#c026d3', '#093c92', '#f97316', '#fbbf24', '#10b981', '#818cf8'];
    for (let i = 0; i < 55; i++) {
      const el = document.createElement('div');
      const x = Math.random() * window.innerWidth;
      const dur = (1.6 + Math.random() * 1.6).toFixed(2);
      const tx = (Math.random() * 240 - 120).toFixed(0);
      const ty = (window.innerHeight * 0.55 + Math.random() * window.innerHeight * 0.45).toFixed(0);
      const rot = (Math.random() * 720 - 360).toFixed(0);
      const delay = (Math.random() * 0.7).toFixed(2);
      el.style.cssText = [
        `position:fixed`, `pointer-events:none`, `z-index:400`,
        `width:8px`, `height:8px`, `border-radius:2px`,
        `left:${x}px`, `top:-10px`,
        `background:${cols[Math.floor(Math.random() * cols.length)]}`,
        `animation:confFall${dur.replace('.', '')} ${dur}s ease-in ${delay}s forwards`,
      ].join(';');
      const style = document.createElement('style');
      style.textContent = `@keyframes confFall${dur.replace('.', '')}{0%{opacity:1;transform:translate(0,0) rotate(0deg);}100%{opacity:0;transform:translate(${tx}px,${ty}px) rotate(${rot}deg);}}`;
      document.head.appendChild(style);
      document.body.appendChild(el);
      setTimeout(() => { el.remove(); style.remove(); }, (parseFloat(dur) + parseFloat(delay) + 0.5) * 1000);
    }
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const allNodes = mapData ? [...mapData.nodes, ...mapData.customNodes] : [];
  const selectedNode = allNodes.find(n => n.id === selectedNodeId) ?? null;
  const personFirstName = challenge?.persona_name?.split(' ')[0] || mapData?.central.personName || 'Persona';

  // ─── Loading view ─────────────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <>
        <StarField />
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div style={{ textAlign: 'center', color: '#fff', fontFamily: "'Orbitron', sans-serif" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🧠</div>
            <div style={{ fontSize: 14, letterSpacing: 3, opacity: 0.6 }}>CARGANDO MAPA...</div>
          </div>
        </div>
      </>
    );
  }

  // ─── Complete view ────────────────────────────────────────────────────────

  if (view === 'complete') {
    return (
      <>
        <StarField />
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center',
          padding: '28px 24px', fontFamily: "'Exo 2', sans-serif",
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 50, padding: '6px 20px', fontFamily: "'Exo 2', sans-serif" }}>
            Misión Completada · Fase 2
          </div>
          <div style={{ fontSize: 'clamp(48px,8vw,68px)' }}>🧠</div>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(28px,5.5vw,54px)', fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase' as const, textShadow: '0 0 50px rgba(192,38,211,0.55)', lineHeight: 1.1 }}>
            ¡Empatía<br />Activada!
          </div>
          <p style={{ fontSize: 'clamp(13px,1.7vw,15px)', fontWeight: 300, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, maxWidth: 440 }}>
            Han explorado el mapa de empatía y conocen a su usuario de una manera completamente diferente.
          </p>
          <div style={{ background: 'rgba(192,38,211,0.08)', border: '1px solid rgba(192,38,211,0.2)', borderRadius: 18, padding: '18px 40px' }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(40px,8vw,70px)', fontWeight: 900, color: '#c026d3', textShadow: '0 0 30px rgba(192,38,211,0.55)', lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.28)', marginTop: 4 }}>puntos obtenidos</div>
          </div>
          <button
            style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#fff', background: 'linear-gradient(135deg,#093c92,#c026d3)', border: 'none', borderRadius: 12, padding: '14px 32px', cursor: 'pointer', boxShadow: '0 4px 22px rgba(192,38,211,0.3)' }}
          >
            Continuar Misión →
          </button>
        </div>
      </>
    );
  }

  // ─── Map view ─────────────────────────────────────────────────────────────

  const mapArea = mapAreaRef.current;
  const W = mapArea?.clientWidth || 800;
  const H = mapArea?.clientHeight || 600;

  return (
    <>
      <StarField />

      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px 10px',
        background: 'rgba(5,8,24,0.6)', backdropFilter: 'blur(8px)',
        gap: 10,
      }}>
        {/* Persona pill */}
        <div
          role="button"
          onClick={() => setPersonDropdownOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 14px 8px 8px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 50, cursor: 'pointer', position: 'relative',
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '2px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
            👤
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700, color: '#fff' }}>{personFirstName}</div>
            <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Ver problema ▼</div>
          </div>
          {personDropdownOpen && challenge?.persona_story && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50,
                width: 320, background: 'rgba(5,8,24,0.92)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16,
                backdropFilter: 'blur(24px)', padding: 20,
              }}
            >
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                Contexto del Problema
              </div>
              <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
                {challenge.persona_story}
              </div>
            </div>
          )}
        </div>

        {/* Timer */}
        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', padding: '8px 20px', borderRadius: 50, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', whiteSpace: 'nowrap' as const }}>
          ⏱ {timerRemaining}
        </div>

        {/* Finalize */}
        <button
          onClick={finishMap}
          disabled={isSubmitted}
          style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 22px', cursor: isSubmitted ? 'not-allowed' : 'pointer', opacity: isSubmitted ? 0.4 : 1 }}
        >
          Finalizar →
        </button>
      </div>

      {/* Map area */}
      <div
        ref={mapAreaRef}
        style={{ position: 'fixed', top: 62, bottom: 0, left: 0, right: 0, zIndex: 10, overflow: 'hidden' }}
        onClick={() => setPersonDropdownOpen(false)}
      >
        <svg ref={svgRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

        {/* Center bubble */}
        {mapData && (
          <div style={{ position: 'absolute', left: W / 2, top: H / 2, transform: 'translate(-50%,-50%)', userSelect: 'none' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>👤</span>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 7, fontWeight: 700, color: '#fff', marginTop: 3, maxWidth: 68, lineHeight: 1.2 }}>{personFirstName}</div>
            </div>
          </div>
        )}

        {/* Nodes and idea bubbles */}
        {allNodes.map(node => {
          const np = nodePos(node.angle, W, H);
          const isActive = selectedNodeId === node.id;
          return (
            <div key={node.id}>
              {/* Node circle */}
              <div
                role="button"
                style={{ position: 'absolute', left: np.x, top: np.y, transform: 'translate(-50%,-50%)', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => { setSelectedNodeId(node.id); setPanelInput(''); }}
              >
                <div style={{
                  width: 68, height: 68, borderRadius: '50%',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  border: `${isActive ? '2.5px' : '2px'} solid ${node.color}`,
                  background: `rgba(${node.rgb},${isActive ? 0.22 : 0.12})`,
                  boxShadow: isActive ? `0 0 28px rgba(${node.rgb},0.4)` : `0 0 18px rgba(${node.rgb},0.2)`,
                  transition: 'background 0.2s, box-shadow 0.2s',
                }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{node.icon}</span>
                  <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 7, fontWeight: 700, letterSpacing: 0.5, color: node.color, marginTop: 3, textTransform: 'uppercase' as const }}>{node.label}</span>
                </div>
              </div>

              {/* Idea bubbles */}
              {node.ideas.map((idea, idx) => {
                const pos = (idea.x != null && idea.y != null)
                  ? { x: idea.x, y: idea.y }
                  : ideaDefaultPos(node.angle, idx, node.ideas.length, W, H);
                return (
                  <div
                    key={idea.id}
                    style={{
                      position: 'absolute', left: pos.x, top: pos.y,
                      transform: 'translate(-50%,-50%)',
                      minWidth: 72, maxWidth: 130, padding: '6px 10px', borderRadius: 20,
                      background: `rgba(${node.rgb},0.18)`,
                      border: `1.5px solid rgba(${node.rgb},0.45)`,
                      display: 'flex', alignItems: 'center', gap: 5,
                      cursor: 'grab', userSelect: 'none',
                    }}
                    onPointerDown={e => {
                      if (isSubmitted) return;
                      handleDragStart(e, node.id, idea.id, e.currentTarget as HTMLDivElement, pos.x, pos.y);
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'grab', flexShrink: 0 }}>⠿</span>
                    <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 10, fontWeight: 600, color: '#fff', lineHeight: 1.3, textAlign: 'center', flex: 1 }}>{idea.text}</span>
                    {!isSubmitted && (
                      <span
                        style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); deleteIdea(node.id, idea.id); }}
                      >✕</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Add custom node button */}
      {!isSubmitted && (
        <button
          onClick={() => setCustomModalOpen(true)}
          style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: "'Exo 2', sans-serif", fontSize: 12, fontWeight: 600,
            color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 50, padding: '9px 20px',
            cursor: 'pointer',
          }}
        >
          ＋ Añadir categoría propia
        </button>
      )}

      {/* Side panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, width: 300, height: '100%', zIndex: 50,
        background: 'rgba(5,8,24,0.94)', borderLeft: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(28px)', display: 'flex', flexDirection: 'column', padding: 20,
        transform: selectedNodeId ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1)',
      }}>
        {selectedNode && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, border: `2px solid ${selectedNode.color}`, background: `rgba(${selectedNode.rgb},0.12)` }}>
                {selectedNode.icon}
              </div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, color: selectedNode.color, flex: 1 }}>
                {selectedNode.label}
              </div>
              <span role="button" style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4 }} onClick={() => setSelectedNodeId(null)}>✕</span>
            </div>

            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
              Preguntas Guía
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {(QUESTIONS[selectedNode.id] || []).map((q, i) => (
                <div key={i} style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, borderLeft: `2px solid ${selectedNode.color}` }}>
                  {q}
                </div>
              ))}
            </div>

            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
              Ideas del equipo
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, minHeight: 0 }}>
              {selectedNode.ideas.length === 0
                ? <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '16px 0', fontStyle: 'italic' }}>Aún no hay ideas — ¡sean los primeros!</div>
                : selectedNode.ideas.map(idea => (
                  <div key={idea.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: `rgba(${selectedNode.rgb},0.1)`, border: `1px solid rgba(${selectedNode.rgb},0.25)`, borderRadius: 8 }}>
                    <span style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.8)', flex: 1, lineHeight: 1.4 }}>{idea.text}</span>
                    {!isSubmitted && (
                      <span role="button" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', cursor: 'pointer', flexShrink: 0 }} onClick={() => deleteIdea(selectedNode.id, idea.id)}>✕</span>
                    )}
                  </div>
                ))
              }
            </div>

            {!isSubmitted && (
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <textarea
                  value={panelInput}
                  onChange={e => setPanelInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addIdea(); } }}
                  placeholder="Escribe una idea…"
                  rows={1}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10, color: '#fff', fontFamily: "'Exo 2', sans-serif", fontSize: 13, padding: '10px 12px', resize: 'none', minHeight: 40, maxHeight: 80 }}
                />
                <button
                  onClick={addIdea}
                  style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#093c92,#c026d3)', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-end' }}
                >＋</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Custom node modal */}
      {customModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,8,24,0.75)', backdropFilter: 'blur(20px)' }}
          onClick={() => setCustomModalOpen(false)}
        >
          <div
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 22, backdropFilter: 'blur(24px)', padding: '36px 32px', width: 320 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#fff', marginBottom: 20 }}>Nueva Categoría</div>
            <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Nombre</div>
            <input
              value={customName}
              onChange={e => setCustomName(e.target.value.slice(0, 20))}
              placeholder="Ej: Aspiraciones, Cultura…"
              maxLength={20}
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, color: '#fff', fontFamily: "'Exo 2', sans-serif", fontSize: 14, padding: '10px 14px', marginBottom: 16, boxSizing: 'border-box' as const }}
            />
            <div style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Color</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' as const }}>
              {CUSTOM_COLORS.map(c => (
                <div
                  key={c}
                  role="button"
                  onClick={() => setCustomColor(c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: customColor === c ? '2px solid #fff' : '2px solid transparent', transform: customColor === c ? 'scale(1.15)' : 'scale(1)', transition: 'all 0.15s' }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setCustomModalOpen(false)}
                style={{ flex: 1, fontFamily: "'Exo 2', sans-serif", fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 22px', cursor: 'pointer' }}
              >Cancelar</button>
              <button
                onClick={addCustomNode}
                style={{ flex: 1, fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#fff', background: 'linear-gradient(135deg,#093c92,#c026d3)', border: 'none', borderRadius: 12, padding: '14px 20px', cursor: 'pointer' }}
              >Añadir</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
