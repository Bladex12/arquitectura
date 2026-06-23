import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { sessionsAPI, tabletConnectionsAPI } from '@/services';
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';

export function TabletVideoInstitucional() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Videos aleatorios sobre emprendimiento y educación
  const videoUrls = [
    'https://www.youtube.com/embed/jNQXAC9IVRw', // Video educativo sobre emprendimiento
    'https://www.youtube.com/embed/9bZkp7q19f0', // Video sobre innovación
  ];
  
  // Seleccionar un video aleatorio al cargar
  const [selectedVideo] = useState(() => {
    return videoUrls[Math.floor(Math.random() * videoUrls.length)];
  });

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

        // Si ya hay actividad, redirigir inmediatamente
        // Nota: Instructivo puede tener current_activity_name pero NO current_stage_number (es pre-etapa)
        if (gameData.current_activity_name) {
          const normalizedName = gameData.current_activity_name.toLowerCase();
          if (normalizedName.includes('instructivo') || normalizedName.includes('instrucciones')) {
            window.location.href = `/tablet/etapa1/instructivo?connection_id=${connId}`;
            return;
          } else if (gameData.current_stage_number) {
            // Solo verificar estas actividades si hay stage_number (son parte de una etapa)
            if (normalizedName.includes('personaliz')) {
              window.location.href = `/tablet/loading?redirect=/tablet/etapa1/personalizacion&connection_id=${connId}`;
              return;
            } else if (normalizedName.includes('presentaci')) {
              window.location.href = `/tablet/etapa1/presentacion?connection_id=${connId}`;
              return;
            }
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
              // Limpiar intervalos
              if (activityCheckIntervalRef.current) {
                clearInterval(activityCheckIntervalRef.current);
                activityCheckIntervalRef.current = null;
              }
              
              // Redirigir según la nueva actividad
              const newActivityName = (updatedSession.current_activity_name || '').toLowerCase();
              const newStageNumber = updatedSession.current_stage_number;
              
              // Instructivo puede tener actividad pero NO stage_number (es pre-etapa)
              if (newActivityName.includes('instructivo') || newActivityName.includes('instrucciones')) {
                window.location.href = `/tablet/etapa1/instructivo?connection_id=${connId}`;
                return;
              } else if (newStageNumber === 1) {
                // Actividades de la Etapa 1
                if (newActivityName.includes('personaliz')) {
                  window.location.href = `/tablet/loading?redirect=/tablet/etapa1/personalizacion&connection_id=${connId}`;
                  return;
                } else if (newActivityName.includes('presentaci')) {
                  window.location.href = `/tablet/etapa1/presentacion?connection_id=${connId}`;
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
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div className="galactic-label" style={{ marginBottom: 8 }}>Planeta 1 · Etapa Inicial</div>
        <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(20px,3vw,32px)', fontWeight: 700, color: '#fff', letterSpacing: 2, textShadow: '0 0 20px rgba(192,38,211,0.5)' }}>
          Como la UDD apoya el emprendimiento
        </h1>
      </div>

      {/* Video card */}
      <GlassCard className="flex-1 flex flex-col overflow-hidden" style={{ maxWidth: 900, margin: '0 auto', width: '100%', minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 300, overflow: 'hidden', borderRadius: 12, background: '#000' }}>
          <iframe
            src={`${selectedVideo}?autoplay=0&mute=0&controls=1&rel=0&modestbranding=1`}
            title="Video Institucional UDD"
            style={{ width: '100%', height: '100%', minHeight: 300 }}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </GlassCard>

      {/* Waiting message */}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, animation: 'pulse 2s ease-in-out infinite' }}>
          Esperando a que el profesor inicie la Etapa 1...
        </p>
      </div>
    </GalacticPage>
  );
}

