import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, CalendarDays, Clock, ChevronRight } from 'lucide-react';
import { sessionsAPI } from '@/services';
import { toast } from 'sonner';

interface GameSession {
  id: number;
  room_code: string;
  status: 'lobby' | 'running' | 'completed' | 'cancelled';
  course_name?: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  current_stage_number?: number;
  current_stage_name?: string;
  current_activity_name?: string;
  cancellation_reason?: string;
  cancellation_reason_other?: string;
}

export function Historial() {
  const navigate = useNavigate();
  const location = useLocation();
  const [historySessions, setHistorySessions] = useState<GameSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isAdminRoute = location.pathname.startsWith('/admin/historial');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const params: Record<string, any> = { ordering: '-created_at' };
      if (isAdminRoute) {
        params.admin_view = 'true';
      }
      const sessionsList = await sessionsAPI.list(params);
      const sessionsArray = Array.isArray(sessionsList) ? sessionsList : [sessionsList];
      setHistorySessions(sessionsArray);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Error al cargar historial');
    } finally {
      setLoadingHistory(false);
    }
  };

  const viewSessionDetail = (sessionId: number) => {
    if (isAdminRoute) {
      navigate(`/admin/historial/${sessionId}`);
    } else {
      navigate(`/profesor/historial/${sessionId}`);
    }
  };

  const getStatusText = (session: GameSession) => {
    const statusMap: Record<string, string> = {
      lobby: 'Lobby',
      running: 'En Curso',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };
    return statusMap[session.status] || session.status;
  };

  const getStatusClass = (session: GameSession) => {
    const classMap: Record<string, string> = {
      lobby: 'bg-amber-100 text-amber-700',
      running: 'bg-blue-100 text-[#2563EB]',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-[#FF3D2E]',
    };
    return classMap[session.status] || 'bg-gray-100 text-gray-600';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Background blobs */}
      <div
        className="absolute top-[-8%] left-[-6%] w-96 h-96 rounded-full pointer-events-none"
        style={{ background: '#2563EB', filter: 'blur(160px)', opacity: 0.12 }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: '#FF3D2E', filter: 'blur(180px)', opacity: 0.09 }}
      />
      <div
        className="absolute top-[35%] right-[8%] w-72 h-72 rounded-full pointer-events-none"
        style={{ background: '#F5A623', filter: 'blur(140px)', opacity: 0.10 }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #1B1B2F18 1.5px, transparent 1.5px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 sm:p-6">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate(isAdminRoute ? '/admin/panel' : '/profesor/panel')}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#1B1B2F]/55 hover:text-[#1B1B2F] transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Panel
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-6 rounded-full bg-[#2563EB]" />
            <h1
              className="text-xl sm:text-2xl font-black text-[#1B1B2F]"
              style={{ fontFamily: 'Unbounded, sans-serif' }}
            >
              Historial de Sesiones
            </h1>
          </div>
          <p className="text-sm text-[#1B1B2F]/45 ml-4">Registro de todas las partidas</p>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-[#1B1B2F]/6 flex-1 p-5 sm:p-6"
          style={{ border: '1.5px solid rgba(255,255,255,0.9)' }}
        >
          {loadingHistory ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-[#2563EB]" />
            </div>
          ) : historySessions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#1B1B2F]/35 text-sm">No hay sesiones registradas aún.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historySessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * index }}
                  onClick={() => viewSessionDetail(session.id)}
                  whileHover={{ scale: 1.005 }}
                  className="group bg-[#F5F0E8]/70 hover:bg-white border border-[#1B1B2F]/6 hover:border-[#2563EB]/25 hover:shadow-md rounded-2xl p-4 cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="font-black text-[#1B1B2F] text-sm tracking-widest"
                          style={{ fontFamily: 'Unbounded, sans-serif' }}
                        >
                          {session.room_code}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusClass(session)}`}
                        >
                          {getStatusText(session)}
                        </span>
                      </div>

                      <p className="text-xs text-[#1B1B2F]/50 mb-2">
                        {session.course_name || 'Curso'}
                      </p>

                      <div className="flex items-center gap-3 flex-wrap text-[10px] text-[#1B1B2F]/40">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDateTime(session.created_at).date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(session.created_at).time}
                        </span>
                      </div>

                      {session.status === 'completed' && (
                        <p className="text-green-600 text-[10px] font-semibold mt-1.5">
                          ✅ Juego Completado
                          {session.ended_at
                            ? ` · ${formatDateTime(session.ended_at).date}`
                            : ''}
                        </p>
                      )}

                      {session.status === 'cancelled' && (
                        <div className="mt-1.5">
                          <p className="text-[#FF3D2E] text-[10px] font-semibold">
                            ❌ Cancelada
                            {session.current_stage_number
                              ? ` · Etapa ${session.current_stage_number}`
                              : ''}
                            {session.current_stage_name
                              ? `: ${session.current_stage_name}`
                              : ''}
                            {session.current_activity_name
                              ? ` — ${session.current_activity_name}`
                              : ''}
                          </p>
                          {session.ended_at && (
                            <p className="text-[#1B1B2F]/35 text-[10px] mt-0.5">
                              {formatDateTime(session.ended_at).date} a las{' '}
                              {formatDateTime(session.ended_at).time}
                            </p>
                          )}
                          {session.cancellation_reason && (
                            <p className="text-[#1B1B2F]/40 text-[10px] mt-0.5">
                              Motivo:{' '}
                              {session.cancellation_reason === 'Otro' &&
                              session.cancellation_reason_other
                                ? session.cancellation_reason_other
                                : session.cancellation_reason}
                            </p>
                          )}
                        </div>
                      )}

                      {session.started_at &&
                        session.status !== 'completed' &&
                        session.status !== 'cancelled' && (
                          <p className="text-[#1B1B2F]/35 text-[10px] mt-1">
                            Iniciada: {formatDateTime(session.started_at).time}
                          </p>
                        )}

                      {!session.started_at && session.status === 'lobby' && (
                        <p className="text-[#1B1B2F]/35 text-[10px] mt-1">En lobby</p>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#1B1B2F]/20 group-hover:text-[#2563EB] transition-colors flex-shrink-0 mt-1" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
