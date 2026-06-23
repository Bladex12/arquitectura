import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';
import { sessionsAPI } from '@/services';
import { toast } from 'sonner';
import { GalacticPage } from '@/components/GalacticPage';
import { GlassCard } from '@/components/GlassCard';

interface GameSession {
  id: number;
  room_code: string;
  status: string;
  current_activity_name?: string;
  current_stage_number?: number;
  started_at?: string;
}

export function ProfesorInstructivo() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // URL del video explicativo del juego (cambiar por el video real)
  const videoUrl = 'https://www.youtube.com/embed/VIDEO_ID_AQUI'; // Reemplazar con el ID del video real

  useEffect(() => {
    if (sessionId) {
      loadGameSession();
      
      // Auto-refresh cada 5 segundos
      intervalRef.current = setInterval(() => {
        loadGameSession();
      }, 5000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [sessionId]);

  const loadGameSession = async () => {
    if (!sessionId) return;

    try {
      const data: GameSession = await sessionsAPI.getById(sessionId);
      
      console.log('📚 Instructivo - Estado actual:', {
        current_activity_name: data.current_activity_name,
        current_stage_number: data.current_stage_number
      });
      
      setGameSession(data);

      // Si hay una actividad establecida (Personalización), redirigir a Personalización
      if (data.current_activity_name && data.current_stage_number) {
        console.log('🔄 Ya se inició la Etapa 1, redirigiendo desde Instructivo:', data.current_activity_name);
        const normalizedName = data.current_activity_name.toLowerCase();
        if (normalizedName.includes('personaliz')) {
          window.location.href = `/profesor/etapa1/personalizacion/${sessionId}/`;
          return;
        } else if (normalizedName.includes('presentaci')) {
          window.location.href = `/profesor/etapa1/presentacion/${sessionId}/`;
          return;
        }
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

  const handleNextActivity = async () => {
    if (!sessionId || !gameSession) return;

    setAdvancing(true);
    try {
      // Iniciar la Etapa 1 después del instructivo
      await sessionsAPI.startStage1(sessionId);

      // Verificar que el estado del backend realmente refleja Personalización antes de redirigir.
      // Esto evita que la página de Personalización lea estado desactualizado al cargar.
      const freshData = await sessionsAPI.getById(sessionId);
      const isReady =
        freshData.current_stage_number === 1 &&
        (freshData.current_activity_name?.toLowerCase().includes('personaliz') ?? false);

      console.log('✅ Etapa 1 iniciada — verificación post-startStage1:', {
        current_stage_number: freshData.current_stage_number,
        current_activity_name: freshData.current_activity_name,
        isReady,
      });

      toast.success('Instructivo completado. Iniciando Etapa 1...');

      if (isReady) {
        // Estado confirmado — redirigir de inmediato
        window.location.href = `/profesor/etapa1/personalizacion/${sessionId}/`;
      } else {
        // Estado aún no propagado (raro) — dar un margen breve y redirigir de todas formas
        console.warn('⚠️ Estado no refleja Personalización tras startStage1:', freshData);
        setTimeout(() => {
          window.location.href = `/profesor/etapa1/personalizacion/${sessionId}/`;
        }, 800);
      }
    } catch (error: any) {
      console.error('Error al iniciar Etapa 1:', error);
      toast.error(error.response?.data?.error || 'Error al iniciar la Etapa 1');
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
        <GlassCard style={{ padding: 32, textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.8)', marginBottom: 16 }}>Error al cargar la sesión</p>
          <button
            onClick={() => navigate('/profesor/panel')}
            className="btn-galactic-primary"
            style={{ width: '100%' }}
          >
            Volver al Panel
          </button>
        </GlassCard>
      </GalacticPage>
    );
  }

  return (
    <GalacticPage>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <div className="galactic-label" style={{ fontSize: 12, marginBottom: 4 }}>Control de Misión · Etapa 1</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 28, fontWeight: 700, color: '#fff', textShadow: '0 0 24px rgba(192,38,211,0.5)' }}>
            Trabajo en Equipo
          </div>
        </div>
        <div className="galactic-badge" style={{ fontSize: 13 }}>Instructivo</div>
      </div>

      <GlassCard style={{ flex: 1, padding: 16, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', background: '#000', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {videoUrl && !videoUrl.includes('VIDEO_ID_AQUI') ? (
            <iframe
              src={`${videoUrl}?autoplay=0&controls=1&rel=0`}
              title="Instructivo del Juego"
              style={{ width: '100%', height: '100%', minHeight: 320 }}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <p style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>
              Video próximamente
            </p>
          )}
        </div>
      </GlassCard>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button className="btn-galactic-primary" onClick={handleNextActivity} disabled={advancing}>
          {advancing ? 'Avanzando...' : 'Avanzar Actividad ▶'}
        </button>
      </div>
    </GalacticPage>
  );
}










