import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { sessionsAPI, tabletConnectionsAPI, teamPersonalizationsAPI } from '@/services';
import { toast } from 'sonner';
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';

interface GameSession {
  id: number;
  room_code: string;
  status: string;
  current_activity_name?: string;
  current_stage_number?: number;
}

export function TabletInstructivo() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // TODO: Reemplazar con el ID real del video de YouTube cuando esté disponible
  const videoUrl = '';

  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) {
      navigate('/tablet/join');
      return;
    }
    
    const loadInitialData = async () => {
      try {
        const statusData = await tabletConnectionsAPI.getStatus(connId);
        
        if (!statusData.game_session || !statusData.game_session.id) {
          setLoading(false);
          return;
        }

        const gameSessionId = statusData.game_session.id;

        const redirectPresentacion = async () => {
          try {
            const persList = await teamPersonalizationsAPI.list({ team: statusData.team.id });
            const persResults = Array.isArray(persList) ? persList : [persList];
            if (persResults.length > 0 && persResults[0].team_members_know_each_other === true) {
              window.location.href = `/tablet/etapa1/minijuego/?connection_id=${connId}`;
            } else {
              window.location.href = `/tablet/etapa1/presentacion/?connection_id=${connId}`;
            }
          } catch {
            window.location.href = `/tablet/etapa1/presentacion/?connection_id=${connId}`;
          }
        };

        // Usar lobby en lugar de getById para evitar problemas de autenticación
        const lobbyData = await sessionsAPI.getLobby(gameSessionId);
        const gameData = lobbyData.game_session;
        
        // Guardar valores iniciales para comparación
        const initialActivityId = gameData.current_activity;
        const initialActivityName = gameData.current_activity_name || '';
        const initialSessionStageId = gameData.current_session_stage;
        const initialStageNumber = gameData.current_stage_number;

        // Si la sesión finaliza, redirigir al join
        if (gameData.status === 'finished' || gameData.status === 'completed') {
          setTimeout(() => navigate('/tablet/join'), 2000);
          return;
        }

        // Si ya hay etapa establecida (Etapa 1 iniciada), redirigir
        if (gameData.current_stage_number) {
          const normalizedName = (gameData.current_activity_name || '').toLowerCase();
          if (normalizedName.includes('personaliz')) {
            // Check if team already submitted personalization — if so, skip it
            try {
              const persList = await teamPersonalizationsAPI.list({ team: statusData.team.id });
              const persResults = Array.isArray(persList) ? persList : [persList];
              if (persResults.length > 0) {
                await redirectPresentacion();
                return;
              }
            } catch {}
            window.location.href = `/tablet/loading?redirect=/tablet/etapa1/personalizacion&connection_id=${connId}`;
            return;
          } else if (normalizedName.includes('presentaci')) {
            await redirectPresentacion();
            return;
          } else if (gameData.current_stage_number === 1 && normalizedName && !normalizedName.includes('instructivo') && !normalizedName.includes('video')) {
            await redirectPresentacion();
            return;
          }
        }

        setLoading(false);

        // Verificar actividad y etapa periódicamente (COMO EN ETAPA 2)
        activityCheckIntervalRef.current = setInterval(async () => {
          try {
            // Usar lobby en lugar de getById para evitar problemas de autenticación
            const updatedLobbyData = await sessionsAPI.getLobby(gameSessionId);
            const updatedSession = updatedLobbyData.game_session;
            
            // Verificar si cambió la actividad o etapa
            const activityChanged = updatedSession.current_activity !== initialActivityId || 
                                   (updatedSession.current_activity_name || '') !== initialActivityName;
            const stageChanged = updatedSession.current_stage_number !== initialStageNumber;
            
            if (activityChanged || stageChanged) {
              const newActivityName = (updatedSession.current_activity_name || '').toLowerCase();
              const newStageNumber = updatedSession.current_stage_number;

              // If backend advanced to Personalización, check if team already submitted it
              if (newStageNumber === 1 && newActivityName.includes('personaliz')) {
                try {
                  const persList = await teamPersonalizationsAPI.list({ team: statusData.team.id });
                  const persResults = Array.isArray(persList) ? persList : [persList];
                  if (persResults.length > 0) {
                    // Already done — keep interval running, wait for Presentación
                    return;
                  }
                } catch {}
              }

              // Clear interval (only reached when we will redirect)
              if (activityCheckIntervalRef.current) {
                clearInterval(activityCheckIntervalRef.current);
                activityCheckIntervalRef.current = null;
              }

              if (newStageNumber === 1) {
                if (newActivityName.includes('personaliz')) {
                  window.location.href = `/tablet/loading?redirect=/tablet/etapa1/personalizacion&connection_id=${connId}`;
                  return;
                } else if (newActivityName.includes('presentaci')) {
                  await redirectPresentacion();
                  return;
                } else if (newActivityName && !newActivityName.includes('instructivo') && !newActivityName.includes('video')) {
                  await redirectPresentacion();
                  return;
                }
              } else if (newStageNumber && newStageNumber > 1) {
                const n = newActivityName.toLowerCase();
                let destBase = '';
                if (newStageNumber === 2) destBase = n.includes('bubble') || n.includes('mapa') ? '/tablet/etapa2/bubble-map/' : '/tablet/etapa2/seleccionar-tema/';
                else if (newStageNumber === 3) destBase = '/tablet/etapa3/prototipo/';
                else if (newStageNumber === 4) destBase = n.includes('presentaci') ? '/tablet/etapa4/presentacion-pitch/' : '/tablet/etapa4/formulario-pitch/';
                if (destBase) {
                  window.location.href = `/tablet/etapa-warp?stage=${newStageNumber}&redirect=${encodeURIComponent(destBase)}&connection_id=${connId}`;
                } else {
                  window.location.href = `/tablet/lobby?connection_id=${connId}`;
                }
                return;
              }
            }
          } catch (error) {
            console.error('Error verificando actividad:', error);
          }
        }, 2000); // Verificar cada 2 segundos
      } catch (error) {
        console.error('Error loading game state:', error);
        setLoading(false);
      }
    };

    loadInitialData();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (activityCheckIntervalRef.current) {
        clearInterval(activityCheckIntervalRef.current);
      }
    };
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <GalacticPage className="items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
      </GalacticPage>
    );
  }

  return (
    <GalacticPage>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div className="galactic-label" style={{ marginBottom: 8 }}>Planeta 1 · Instrucciones</div>
        <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(20px,3vw,32px)', fontWeight: 700, color: '#fff', letterSpacing: 2, textShadow: '0 0 20px rgba(192,38,211,0.5)' }}>
          Instructivo del Juego
        </h1>
      </div>

      <GlassCard className="flex-1 flex flex-col overflow-hidden" style={{ maxWidth: 900, margin: '0 auto', width: '100%', minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 300, overflow: 'hidden', borderRadius: 12, background: '#000' }}>
          {videoUrl ? (
            <iframe
              src={`https://www.youtube.com/embed/${videoUrl}?autoplay=0&controls=1&rel=0`}
              title="Instructivo del Juego"
              style={{ width: '100%', height: '100%', minHeight: 300 }}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, color: 'rgba(255,255,255,0.4)', fontFamily: "'Exo 2',sans-serif", fontSize: 16 }}>
              Video próximamente
            </div>
          )}
        </div>
      </GlassCard>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, animation: 'pulse 2s ease-in-out infinite' }}>
          Esperando a que el profesor inicie la Etapa 1...
        </p>
      </div>
    </GalacticPage>
  );
}

