import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';
import { sessionsAPI } from '@/services';
import { toast } from 'sonner';
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';

// Videos aleatorios sobre emprendimiento y educación
const videoUrls = [
  'https://www.youtube.com/embed/jNQXAC9IVRw', // Video educativo sobre emprendimiento
  'https://www.youtube.com/embed/9bZkp7q19f0', // Video sobre innovación
  'https://www.youtube.com/embed/dQw4w9WgXcQ', // Video motivacional
];

interface GameSession {
  id: number;
  room_code: string;
  status: string;
  current_activity_name?: string;
  current_stage_number?: number;
  started_at?: string;
}

export function ProfesorVideoInstitucional() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Seleccionar un video aleatorio al cargar
  const [selectedVideo] = useState(() => {
    return videoUrls[Math.floor(Math.random() * videoUrls.length)];
  });

  useEffect(() => {
    if (sessionId) {
      loadGameSession();
      
      // Auto-refresh cada 5 segundos
      intervalRef.current = setInterval(() => {
        loadGameSession();
      }, 5000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [sessionId]);

  const loadGameSession = async () => {
    if (!sessionId) return;

    try {
      const data: GameSession = await sessionsAPI.getById(sessionId);
      
      console.log('📹 Video Institucional - Estado actual:', {
        current_activity_name: data.current_activity_name,
        current_activity: data.current_activity,
        current_stage_number: data.current_stage_number
      });
      
      setGameSession(data);

      // El video es previo a las etapas, así que no hay current_activity_name
      // Si hay una actividad establecida, significa que ya pasamos el video, redirigir
      if (data.current_activity_name && data.current_stage_number) {
        console.log('🔄 Ya se inició la Etapa 1, redirigiendo desde Video Institucional:', data.current_activity_name);
        determineAndRedirectToActivity(parseInt(sessionId));
        return;
      }

      // Si no hay etapa ni actividad, estamos en el video (correcto)
      if (!data.current_stage_number && !data.current_activity_name) {
        console.log('✅ En video institucional (previo a etapas), permaneciendo en esta página');
      }

      setLoading(false);
    } catch (error: any) {
      if (error.response?.status === 401) {
        navigate('/profesor/login');
      } else {
        toast.error('Error al cargar la sesión');
      }
      setLoading(false);
    }
  };

  const determineAndRedirectToActivity = async (sessionId: number) => {
    try {
      const gameData = await sessionsAPI.getById(sessionId);

      const currentActivityName = gameData.current_activity_name;
      const currentActivityId = gameData.current_activity;
      const currentStageNumber = gameData.current_stage_number;

      if (!currentActivityName || !currentActivityId) {
        if (currentStageNumber) {
          window.location.href = `/profesor/resultados/${sessionId}/?stage_id=${currentStageNumber}`;
        } else {
          navigate('/profesor/panel');
        }
        return;
      }

      const normalizedActivityName = currentActivityName.toLowerCase().trim();
      let redirectUrl = '';

      if (currentStageNumber === 1) {
        if (normalizedActivityName.includes('video') || normalizedActivityName.includes('institucional')) {
          // Si es video institucional, no redirigir (ya estamos aquí)
          console.log('✅ Actividad es Video Institucional, no redirigir');
          return;
        } else if (normalizedActivityName.includes('instructivo') || normalizedActivityName.includes('instrucciones')) {
          redirectUrl = `/profesor/etapa1/instructivo/${sessionId}/`;
        } else if (normalizedActivityName.includes('personaliz')) {
          redirectUrl = `/profesor/etapa1/personalizacion/${sessionId}/`;
        } else if (normalizedActivityName.includes('presentaci')) {
          redirectUrl = `/profesor/etapa1/presentacion/${sessionId}/`;
        }
      }

      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error('Error determining activity:', error);
    }
  };

  const handleNextActivity = async () => {
    if (!sessionId || !gameSession) return;

    setAdvancing(true);
    try {
      // Usar directamente set_instructivo_activity que establece Instructivo como actividad actual
      // Este endpoint ya maneja la creación de la actividad si no existe
      const data = await sessionsAPI.setInstructivoActivity(sessionId);
      
      console.log('✅ Actividad Instructivo establecida:', data);
      
      // Verificar que la actividad se estableció correctamente
      if (data.current_activity_name && data.current_activity_name.toLowerCase().includes('instructivo')) {
        toast.success('Actividad Instructivo establecida correctamente');
        
        // Actualizar el estado local para reflejar el cambio
        if (data.id) {
          const updatedSession: GameSession = {
            ...gameSession,
            current_activity_name: data.current_activity_name,
            current_stage_number: data.current_stage_number || undefined,
          };
          setGameSession(updatedSession);
        }
        
        // Redirigir a Instructivo después de un breve delay para asegurar que el backend guardó
        setTimeout(() => {
          window.location.href = `/profesor/etapa1/instructivo/${sessionId}/`;
        }, 300);
      } else {
        console.warn('⚠️ La actividad no se estableció correctamente:', data);
        toast.error('Error: La actividad no se estableció correctamente');
        setAdvancing(false);
      }
    } catch (error: any) {
      console.error('Error avanzando a Instructivo:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error al avanzar a Instructivo';
      toast.error(errorMessage);
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <GalacticPage className="items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#c026d3' }} />
      </GalacticPage>
    );
  }

  if (!gameSession) {
    return (
      <GalacticPage className="items-center justify-center">
        <GlassCard style={{ padding: 32, maxWidth: 420, textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Error al cargar la sesión</p>
          <button
            onClick={() => navigate('/profesor/panel')}
            className="btn-galactic-primary"
          >
            Volver al Panel
          </button>
        </GlassCard>
      </GalacticPage>
    );
  }

  return (
    <GalacticPage>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 1</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 28, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
            Trabajo en Equipo
          </div>
        </div>
        <div className="galactic-badge" style={{ fontSize: 13 }}>Video Institucional</div>
      </div>

      {/* Video */}
      <GlassCard style={{ flex: 1, padding: 16, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', background: '#000', minHeight: 320 }}>
          <iframe
            src={`${selectedVideo}?autoplay=0&controls=1&rel=0&modestbranding=1`}
            title="Video Institucional"
            style={{ width: '100%', height: '100%', minHeight: 320 }}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </GlassCard>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button className="btn-galactic-primary" onClick={handleNextActivity} disabled={advancing}>
          {advancing ? 'Avanzando...' : 'Avanzar Actividad ▶'}
        </button>
      </div>
    </GalacticPage>
  );
}

