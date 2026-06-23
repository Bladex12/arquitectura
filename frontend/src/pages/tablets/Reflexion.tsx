import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { GalacticPage } from '@/components/GalacticPage';
import { sessionsAPI, reflectionEvaluationsAPI, tabletConnectionsAPI } from '@/services';
import { toast } from 'sonner';

export function TabletReflexion() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [_connectionId, setConnectionId] = useState<string | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalEstudiantes, setTotalEstudiantes] = useState(0);
  const [estudiantesRespondidos, setEstudiantesRespondidos] = useState(0);
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    const connId = searchParams.get('connection_id') || localStorage.getItem('tabletConnectionId');
    if (!connId) {
      navigate('/tablet/join');
      return;
    }
    setConnectionId(connId);
    loadSessionData(connId);
    const interval = setInterval(() => { loadProgress(); }, 5000);
    return () => clearInterval(interval);
  }, [searchParams, navigate]);

  const loadSessionData = async (connId: string) => {
    try {
      setLoading(true);
      let statusData;
      try {
        statusData = await tabletConnectionsAPI.getStatus(connId);
      } catch (error: any) {
        if (error.response?.status === 404) {
          toast.error('Conexión no encontrada, pero permaneciendo en reflexión');
          return;
        }
        throw error;
      }
      const sessionId = statusData.game_session.id;
      setGameSessionId(sessionId);
      if (sessionId) loadReflectionQR(sessionId);
      setTimeout(() => { loadProgress(); }, 100);
    } catch (error: any) {
      console.error('Error loading session data:', error);
      toast.error('Error al cargar la información');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!gameSessionId) return;
    try {
      const lobbyData = await sessionsAPI.getLobby(gameSessionId);
      const roomCode = lobbyData.game_session.room_code;
      const evaluationsData = await reflectionEvaluationsAPI.byRoom(roomCode);
      if (evaluationsData && typeof evaluationsData === 'object') {
        if ('count' in evaluationsData) {
          setEstudiantesRespondidos(evaluationsData.count || 0);
          let calculatedTotal = 0;
          if (lobbyData.teams && Array.isArray(lobbyData.teams)) {
            calculatedTotal = lobbyData.teams.reduce((sum: number, team: any) => {
              return sum + (team.students_count ?? team.students?.length ?? 0);
            }, 0);
          }
          if ('total_students' in evaluationsData && evaluationsData.total_students > 0) {
            setTotalEstudiantes(evaluationsData.total_students);
          } else if (calculatedTotal > 0) {
            setTotalEstudiantes(calculatedTotal);
          }
        } else {
          const arr = Array.isArray(evaluationsData) ? evaluationsData : (evaluationsData.results || []);
          setEstudiantesRespondidos(arr.length);
        }
      } else {
        setEstudiantesRespondidos(Array.isArray(evaluationsData) ? evaluationsData.length : 0);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const loadReflectionQR = async (sessionId: number) => {
    try {
      const qrData = await sessionsAPI.getReflectionQR(sessionId);
      if (qrData?.qr_code) setQrCode(qrData.qr_code);
    } catch (error: any) {
      console.error('Error loading QR:', error);
    }
  };

  const porcentajeCompletado = totalEstudiantes > 0
    ? (estudiantesRespondidos / totalEstudiantes) * 100
    : 0;

  if (loading) {
    return (
      <GalacticPage>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      </GalacticPage>
    );
  }

  return (
    <GalacticPage>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(192,38,211,0.15)',
            border: '1px solid rgba(192,38,211,0.4)',
            borderRadius: 999, padding: '5px 18px', marginBottom: 12,
          }}>
            <p style={{ fontFamily: "'Exo 2', sans-serif", fontSize: 12, fontWeight: 600, color: '#c026d3', letterSpacing: 2, textTransform: 'uppercase' }}>
              Reflexión Final
            </p>
          </div>
          <h1 style={{ fontFamily: "'Orbitron', monospace", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Encuesta de Reflexión
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            Escanea el código QR con tu teléfono para completar la encuesta
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: 24, width: '100%', maxWidth: 480 }}>
          <h2 style={{ fontFamily: "'Orbitron', monospace", fontSize: 14, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
            Escanea el Código QR
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 16 }}>
            Usa la cámara de tu teléfono móvil para escanear
          </p>

          {/* QR */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            {qrCode ? (
              <img
                src={qrCode}
                alt="QR Code Evaluación"
                style={{ width: 130, height: 130, border: '2px solid rgba(192,38,211,0.4)', borderRadius: 12, boxShadow: '0 0 18px rgba(192,38,211,0.15)' }}
              />
            ) : (
              <div style={{ width: 130, height: 130, border: '2px solid rgba(192,38,211,0.4)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)' }}>
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Steps */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 16 }}>
            {['Abre la cámara de tu teléfono', 'Escanea el código QR', 'Completa la encuesta'].map((text, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 5px', textAlign: 'center' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #093c92, #c026d3)',
                  boxShadow: '0 0 6px rgba(192,38,211,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, margin: '0 auto 5px',
                }}>
                  {i + 1}
                </div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>{text}</p>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div style={{ background: 'rgba(192,38,211,0.08)', border: '1px solid rgba(192,38,211,0.2)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>✓ Progreso de respuestas</span>
              <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, color: '#c026d3' }}>
                {totalEstudiantes > 0 ? `${estudiantesRespondidos} / ${totalEstudiantes}` : 'Cargando...'}
              </span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #093c92, #c026d3)', borderRadius: 3, width: `${porcentajeCompletado}%`, boxShadow: '0 0 6px rgba(192,38,211,0.5)', transition: 'width 0.5s ease' }} />
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'right' }}>
              {totalEstudiantes > 0 ? `${porcentajeCompletado.toFixed(0)}% completado` : 'Cargando...'}
            </p>
          </div>
        </div>

      </div>
    </GalacticPage>
  );
}
