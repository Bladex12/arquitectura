import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  ChevronDown,
  Target,
  Users,
  Heart,
  Lightbulb,
  MessageSquare,
  Trophy,
  Check,
} from 'lucide-react';
import { challengesAPI } from '@/services';
import { toast } from 'sonner';

interface LearningObjective {
  id: number;
  title: string;
  description?: string;
  evaluation_criteria?: string;
  pedagogical_recommendations?: string;
  estimated_time?: number;
  stage_name?: string;
  stage_number?: number;
}

export function Objetivos() {
  const navigate = useNavigate();
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([]);
  const [loadingObjectives, setLoadingObjectives] = useState(false);
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set(['checklist']));

  useEffect(() => {
    loadLearningObjectives();
  }, []);

  const loadLearningObjectives = async () => {
    setLoadingObjectives(true);
    try {
      const data = await challengesAPI.getLearningObjectives();
      const objectivesArray = Array.isArray(data) ? data : [data];
      setLearningObjectives(objectivesArray);
    } catch (error) {
      console.error('Error loading objectives:', error);
      toast.error('Error al cargar objetivos');
    } finally {
      setLoadingObjectives(false);
    }
  };

  const toggleAccordion = (id: string) => {
    const newOpen = new Set(openAccordions);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    setOpenAccordions(newOpen);
  };

  const getStageName = (stageName: string) => {
    const stageMap: Record<string, string> = {
      'Etapa 1': '🎯 Etapa 1: Trabajo en Equipo',
      'Etapa 2': '💡 Etapa 2: Empatía',
      'Etapa 3': '🧩 Etapa 3: Creatividad',
      'Etapa 4': '📢 Etapa 4: Comunicación',
      General: '📖 Objetivos Generales',
    };
    return stageMap[stageName] || stageName;
  };

  const getStageOrder = (stageName: string, objective?: LearningObjective): number => {
    if (objective?.stage_number) {
      return objective.stage_number;
    }
    const orderMap: Record<string, number> = {
      'Etapa 1': 1,
      'Etapa 2': 2,
      'Etapa 3': 3,
      'Etapa 4': 4,
      'Trabajo en equipo': 1,
      Empatía: 2,
      Creatividad: 3,
      Comunicación: 4,
      General: 5,
    };
    return orderMap[stageName] || 99;
  };

  const stageCards = [
    {
      delay: 0.1,
      gradient: 'from-[#2563EB] to-cyan-500',
      icon: <Users className="w-8 h-8 text-white" />,
      title: 'Etapa 1: Trabajo en Equipo',
      description: 'Fomentar la colaboración efectiva, comunicación y liderazgo dentro de grupos diversos',
      habilidades: ['Comunicación efectiva', 'Liderazgo colaborativo', 'Resolución de conflictos', 'Delegación de tareas'],
    },
    {
      delay: 0.2,
      gradient: 'from-purple-500 to-pink-500',
      icon: <Heart className="w-8 h-8 text-white" />,
      title: 'Etapa 2: Empatía',
      description: 'Desarrollar la capacidad de entender y relacionarse con las necesidades y problemas de otros',
      habilidades: ['Comprensión de problemas', 'Identificación de necesidades', 'Perspectiva del usuario', 'Análisis de contextos'],
    },
    {
      delay: 0.3,
      gradient: 'from-[#F5A623] to-orange-500',
      icon: <Lightbulb className="w-8 h-8 text-white" />,
      title: 'Etapa 3: Creatividad',
      description: 'Desarrollar la capacidad de generar ideas innovadoras y soluciones creativas a problemas reales',
      habilidades: ['Generación de ideas originales', 'Pensamiento lateral', 'Resolución creativa de problemas', 'Innovación aplicada'],
    },
    {
      delay: 0.4,
      gradient: 'from-emerald-500 to-teal-500',
      icon: <MessageSquare className="w-8 h-8 text-white" />,
      title: 'Etapa 4: Comunicación',
      description: 'Presentar ideas de manera efectiva y desarrollar habilidades de comunicación y presentación',
      habilidades: ['Presentación de pitch', 'Comunicación clara', 'Estructura de mensajes', 'Persuasión efectiva'],
    },
  ];

  const competencias = [
    'Creatividad e innovación',
    'Trabajo colaborativo',
    'Comunicación efectiva',
    'Liderazgo',
    'Emprendimiento',
    'Resolución de problemas',
    'Pensamiento crítico',
    'Presentación en público',
  ];

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Background blobs */}
      <div
        className="absolute top-[-8%] left-[-6%] w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: '#2563EB', filter: 'blur(180px)', opacity: 0.11 }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[32rem] h-[32rem] rounded-full pointer-events-none"
        style={{ background: '#FF3D2E', filter: 'blur(200px)', opacity: 0.09 }}
      />
      <div
        className="absolute top-[40%] right-[10%] w-80 h-80 rounded-full pointer-events-none"
        style={{ background: '#F5A623', filter: 'blur(160px)', opacity: 0.10 }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #1B1B2F18 1.5px, transparent 1.5px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col max-w-6xl mx-auto w-full p-4 sm:p-6">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate('/profesor/panel')}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#1B1B2F]/55 hover:text-[#1B1B2F] transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Panel
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-center mb-8 sm:mb-10"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="inline-block mb-4"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-[#FF3D2E] to-[#F5A623] rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <Target className="w-8 h-8 text-white" />
            </div>
          </motion.div>
          <h1
            className="text-2xl sm:text-3xl font-black text-[#1B1B2F] mb-3"
            style={{ fontFamily: 'Unbounded, sans-serif' }}
          >
            Objetivos de Aprendizaje
          </h1>
          <p className="text-[#1B1B2F]/55 text-sm sm:text-base max-w-2xl mx-auto">
            Este juego está diseñado para desarrollar competencias clave en emprendimiento e innovación
          </p>
        </motion.div>

        {/* Stage cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-6">
          {stageCards.map((card) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: card.delay }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm p-6"
              style={{ border: '1.5px solid rgba(255,255,255,0.9)' }}
            >
              <div className="flex items-start gap-4 mb-5">
                <div className={`bg-gradient-to-br ${card.gradient} p-3.5 rounded-2xl shrink-0 shadow-sm`}>
                  {card.icon}
                </div>
                <div>
                  <h3
                    className="text-base font-black text-[#1B1B2F] mb-1.5"
                    style={{ fontFamily: 'Unbounded, sans-serif' }}
                  >
                    {card.title}
                  </h3>
                  <p className="text-[#1B1B2F]/55 text-xs sm:text-sm">{card.description}</p>
                </div>
              </div>
              <div className="space-y-2">
                {card.habilidades.map((habilidad, i) => (
                  <motion.div
                    key={habilidad}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: card.delay + 0.1 * i }}
                    className="flex items-center gap-3 bg-[#F5F0E8]/80 p-3 rounded-xl"
                  >
                    <div className={`bg-gradient-to-br ${card.gradient} p-1 rounded-md flex-shrink-0`}>
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs sm:text-sm text-[#1B1B2F]/70">{habilidad}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Competencias card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm p-6 sm:p-8 mb-6"
          style={{ border: '1.5px solid rgba(255,255,255,0.9)' }}
        >
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-[#F5A623] to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h2
              className="text-lg sm:text-xl font-black text-[#1B1B2F] mb-1"
              style={{ fontFamily: 'Unbounded, sans-serif' }}
            >
              Competencias Desarrolladas
            </h2>
            <p className="text-[#1B1B2F]/50 text-xs sm:text-sm">
              Al finalizar el juego, los estudiantes habrán trabajado estas competencias
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {competencias.map((competencia, i) => (
              <motion.div
                key={competencia}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.05 }}
                whileHover={{ scale: 1.04 }}
                className="bg-[#F5F0E8]/80 hover:bg-white border border-[#1B1B2F]/6 hover:border-[#2563EB]/20 hover:shadow-sm p-4 rounded-2xl text-center transition-all duration-200 cursor-default"
              >
                <div className="bg-gradient-to-br from-[#2563EB] to-[#FF3D2E] w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2.5 shadow-sm">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs sm:text-sm text-[#1B1B2F]/70 font-medium">{competencia}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Objetivos por Etapa from API */}
        {learningObjectives.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm p-5 sm:p-7 mb-4"
            style={{ border: '1.5px solid rgba(255,255,255,0.9)' }}
          >
            <h2
              className="text-base sm:text-lg font-black text-[#1B1B2F] mb-5"
              style={{ fontFamily: 'Unbounded, sans-serif' }}
            >
              Objetivos por Etapa
            </h2>

            {loadingObjectives ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-7 h-7 animate-spin text-[#2563EB]" />
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(
                  learningObjectives.reduce(
                    (acc, obj) => {
                      const stageName = obj.stage_name || 'General';
                      if (!acc[stageName]) acc[stageName] = [];
                      acc[stageName].push(obj);
                      return acc;
                    },
                    {} as Record<string, LearningObjective[]>,
                  ),
                )
                  .sort(([stageA, objsA], [stageB, objsB]) => {
                    const firstObjA = objsA[0];
                    const firstObjB = objsB[0];
                    return getStageOrder(stageA, firstObjA) - getStageOrder(stageB, firstObjB);
                  })
                  .map(([stageName, objs]) => (
                    <div
                      key={stageName}
                      className="rounded-2xl overflow-hidden border border-[#1B1B2F]/8"
                    >
                      <button
                        onClick={() => toggleAccordion(stageName)}
                        className="w-full px-4 py-3.5 bg-[#F5F0E8]/60 hover:bg-[#F5F0E8] flex justify-between items-center font-semibold text-left transition-colors"
                      >
                        <span className="text-sm text-[#1B1B2F] font-bold">
                          {getStageName(stageName)}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-[#1B1B2F]/40 transition-transform duration-200 ${
                            openAccordions.has(stageName) ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      <AnimatePresence>
                        {openAccordions.has(stageName) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 space-y-3 bg-white/60">
                              {objs.map((obj) => (
                                <div
                                  key={obj.id}
                                  className="bg-[#F5F0E8]/70 p-4 rounded-xl border border-[#1B1B2F]/6"
                                >
                                  <h4 className="font-bold text-[#1B1B2F] text-sm mb-2">{obj.title}</h4>
                                  {obj.description && (
                                    <p className="text-[#1B1B2F]/60 text-xs mb-2">{obj.description}</p>
                                  )}
                                  {obj.evaluation_criteria && (
                                    <p className="text-xs text-[#1B1B2F]/60">
                                      <span className="font-semibold text-[#1B1B2F]/80">Criterios:</span>{' '}
                                      {obj.evaluation_criteria}
                                    </p>
                                  )}
                                  {obj.pedagogical_recommendations && (
                                    <p className="text-xs text-[#1B1B2F]/60 mt-1">
                                      <span className="font-semibold text-[#1B1B2F]/80">Recomendaciones:</span>{' '}
                                      {obj.pedagogical_recommendations}
                                    </p>
                                  )}
                                  {obj.estimated_time && (
                                    <p className="text-xs text-[#1B1B2F]/60 mt-1">
                                      <span className="font-semibold text-[#1B1B2F]/80">Tiempo estimado:</span>{' '}
                                      {obj.estimated_time} min
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
