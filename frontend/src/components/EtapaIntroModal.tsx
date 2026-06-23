import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Lightbulb, Users, Target, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EtapaInfo {
  numero: number;
  titulo: string;
  descripcion: string;
  actividades: string[];
  icono: React.ComponentType<{ className?: string }>;
  colorGradiente: string;
}

const etapasInfo: Record<number, EtapaInfo> = {
  1: {
    numero: 1,
    titulo: 'TRABAJO EN EQUIPO',
    descripcion: 'En esta etapa desarrollaremos la capacidad de trabajar colaborativamente, comunicarnos efectivamente y construir relaciones sólidas dentro del equipo.',
    actividades: [
      'Personalizar el equipo y conocerse mejor',
      'Establecer roles y responsabilidades',
      'Fomentar la comunicación efectiva'
    ],
    icono: Users,
    colorGradiente: 'from-blue-500 to-cyan-500'
  },
  2: {
    numero: 2,
    titulo: 'Empatía',
    descripcion: 'En esta etapa desarrollaremos la capacidad de entender y conectar con las necesidades, emociones y perspectivas de los demás.',
    actividades: [
      'Identificar problemas y necesidades reales',
      'Comprender las perspectivas de los usuarios',
      'Desarrollar soluciones centradas en las personas'
    ],
    icono: Lightbulb,
    colorGradiente: 'from-purple-500 to-pink-500'
  },
  3: {
    numero: 3,
    titulo: 'Creatividad',
    descripcion: 'En esta etapa desarrollaremos la capacidad de crear ideas innovadoras y soluciones originales, transformándolas en prototipos tangibles.',
    actividades: [
      'Pensar fuera de lo común',
      'Generar múltiples alternativas',
      'Diseñar y prototipar soluciones creativas'
    ],
    icono: Rocket,
    colorGradiente: 'from-orange-500 to-red-500'
  },
  4: {
    numero: 4,
    titulo: 'Comunicación',
    descripcion: 'En esta etapa aprenderemos a comunicar nuestras ideas de manera clara, convincente y efectiva ante una audiencia.',
    actividades: [
      'Estructurar el pitch de manera efectiva',
      'Desarrollar habilidades de presentación',
      'Comunicar el valor de la solución'
    ],
    icono: Target,
    colorGradiente: 'from-green-500 to-emerald-500'
  }
};

interface EtapaIntroModalProps {
  etapaNumero: number;
  isOpen: boolean;
  onClose: () => void;
  onContinuar?: () => void;
}

export function EtapaIntroModal({ etapaNumero, isOpen, onClose, onContinuar }: EtapaIntroModalProps) {
  const etapa = etapasInfo[etapaNumero];
  
  if (!etapa) {
    return null;
  }

  const Icono = etapa.icono;

  const handleContinuar = () => {
    onClose();
    if (onContinuar) {
      onContinuar();
    }
  };

  const handleClose = () => {
    onClose();
    // Guardar en localStorage que se vio la intro (solo si se cierra, no si se continúa)
    // Esto se manejará desde el componente padre si es necesario
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 pointer-events-none"
          >
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-auto pointer-events-auto relative flex flex-col">
              {/* Botón X para cerrar */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors z-10"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>

              <div className="p-4 sm:p-5 flex flex-col">
                {/* Icono */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="flex justify-center mb-2"
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${etapa.colorGradiente} flex items-center justify-center shadow-lg`}>
                    <Icono className="w-7 h-7 text-white stroke-[2.5]" />
                  </div>
                </motion.div>

                {/* Badge Etapa */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex justify-center mb-2"
                >
                  <div className="bg-gray-100 rounded-full px-3 py-1">
                    <span className="text-gray-600 text-xs font-medium">
                      Etapa {etapa.numero} de 4
                    </span>
                  </div>
                </motion.div>

                {/* Título */}
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xl font-bold text-[#093c92] text-center mb-2"
                >
                  {etapa.titulo}
                </motion.h1>

                {/* Descripción */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-600 text-center text-sm mb-3 leading-relaxed"
                >
                  {etapa.descripcion}
                </motion.p>

                {/* Subtítulo */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-gray-700 text-center text-xs font-medium mb-2"
                >
                  En esta etapa trabajaremos:
                </motion.p>

                {/* Lista de Actividades */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="space-y-2 mb-4"
                >
                  {etapa.actividades.map((actividad, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100 flex items-center gap-2.5"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-white font-bold text-xs">{index + 1}</span>
                      </div>
                      <p className="text-gray-800 text-sm font-medium flex-1">
                        {actividad}
                      </p>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Botón Comenzar */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="flex justify-center"
                >
                  <Button
                    onClick={handleContinuar}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-2.5 text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 w-full"
                  >
                    ¡Comenzar!
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

