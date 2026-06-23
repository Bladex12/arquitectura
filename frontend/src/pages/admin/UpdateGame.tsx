import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings, Target, Layers, Zap, Sparkles, MoreHorizontal, ChevronRight } from 'lucide-react';

interface Stage {
  id: number | string;
  name: string;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
  accentColor: string;
  description: string;
}

export function UpdateGame() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) navigate('/profesor/login');
  }, [navigate]);

  const stages: Stage[] = [
    {
      id: 1,
      name: 'Etapa 1',
      subtitle: 'Trabajo en Equipo',
      icon: Target,
      gradient: 'from-[#2563EB] to-cyan-500',
      accentColor: '#2563EB',
      description: 'Retos, Sopa de Letras, Anagramas y preguntas de Caos',
    },
    {
      id: 2,
      name: 'Etapa 2',
      subtitle: 'Empatía',
      icon: Layers,
      gradient: 'from-purple-500 to-violet-500',
      accentColor: '#8b5cf6',
      description: 'Temas, desafíos y Mapa de Empatía',
    },
    {
      id: 3,
      name: 'Etapa 3',
      subtitle: 'Creatividad',
      icon: Zap,
      gradient: 'from-[#F5A623] to-orange-500',
      accentColor: '#F5A623',
      description: 'Prototipo y rúbricas de evaluación',
    },
    {
      id: 4,
      name: 'Etapa 4',
      subtitle: 'Comunicación',
      icon: Sparkles,
      gradient: 'from-[#FF3D2E] to-rose-500',
      accentColor: '#FF3D2E',
      description: 'Formulario de Pitch y presentación final',
    },
    {
      id: 'otros',
      name: 'General',
      subtitle: 'Configuración Global',
      icon: MoreHorizontal,
      gradient: 'from-slate-500 to-slate-600',
      accentColor: '#64748b',
      description: 'Otras configuraciones del sistema',
    },
  ];

  const handleStageClick = (stageId: number | string) => {
    if (typeof stageId === 'number') {
      navigate(`/admin/update-game/etapa${stageId}`);
    } else {
      navigate(`/admin/update-game/${stageId}`);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Background blobs */}
      <div
        className="absolute top-[-8%] left-[-6%] w-96 h-96 rounded-full pointer-events-none"
        style={{ background: '#F5A623', filter: 'blur(180px)', opacity: 0.12 }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: '#2563EB', filter: 'blur(200px)', opacity: 0.10 }}
      />
      <div
        className="absolute top-[40%] left-[30%] w-72 h-72 rounded-full pointer-events-none"
        style={{ background: '#FF3D2E', filter: 'blur(150px)', opacity: 0.08 }}
      />
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #1B1B2F18 1.5px, transparent 1.5px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 sm:p-6">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate('/admin/panel')}
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
          className="flex items-center gap-4 mb-8"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-[#F5A623] to-orange-500 rounded-2xl flex items-center justify-center shadow-sm">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1
              className="text-xl sm:text-2xl font-black text-[#1B1B2F]"
              style={{ fontFamily: 'Unbounded, sans-serif' }}
            >
              Actualizar Juego
            </h1>
            <p className="text-sm text-[#1B1B2F]/45">Configuración por etapas del contenido</p>
          </div>
        </motion.div>

        {/* Stage cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <motion.button
                key={stage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.07, type: 'spring', stiffness: 200, damping: 22 }}
                onClick={() => handleStageClick(stage.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group text-left bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm hover:shadow-md border border-white/80 hover:border-white p-5 sm:p-6 transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`bg-gradient-to-br ${stage.gradient} w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1B1B2F]/40 mb-0.5">
                          {stage.name}
                        </p>
                        <h3
                          className="text-sm font-black text-[#1B1B2F]"
                          style={{ fontFamily: 'Unbounded, sans-serif' }}
                        >
                          {stage.subtitle}
                        </h3>
                      </div>
                      <ChevronRight
                        className="w-4 h-4 text-[#1B1B2F]/25 group-hover:text-[#1B1B2F]/60 transition-colors flex-shrink-0"
                      />
                    </div>
                    <p className="text-xs text-[#1B1B2F]/50 leading-relaxed">{stage.description}</p>
                    <div
                      className="mt-3 text-xs font-semibold transition-colors"
                      style={{ color: stage.accentColor }}
                    >
                      Configurar →
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Info strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="mt-6 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white/60 border border-[#1B1B2F]/6"
        >
          <div className="w-8 h-8 rounded-xl bg-[#2563EB]/10 flex items-center justify-center flex-shrink-0">
            <Settings className="w-4 h-4 text-[#2563EB]" />
          </div>
          <p className="text-xs text-[#1B1B2F]/50">
            Los cambios que guardes aquí afectan a <strong className="text-[#1B1B2F]/70">todas las sesiones nuevas</strong> que se creen.
            Las sesiones activas no se ven afectadas.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
