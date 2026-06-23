import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Lightbulb, Users, Target, Rocket } from 'lucide-react';
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
    titulo: 'Trabajo en Equipo',
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
    titulo: 'Creatividad',
    descripcion: 'En esta etapa desarrollaremos la capacidad de crear ideas innovadoras y soluciones originales.',
    actividades: [
      'Pensar fuera de lo común',
      'Generar múltiples alternativas',
      'Conectar ideas de forma innovadora'
    ],
    icono: Lightbulb,
    colorGradiente: 'from-purple-500 to-pink-500'
  },
  3: {
    numero: 3,
    titulo: 'Prototipado',
    descripcion: 'En esta etapa transformaremos las ideas en prototipos tangibles y funcionales que puedan ser probados y mejorados.',
    actividades: [
      'Diseñar prototipos visuales',
      'Desarrollar funcionalidades clave',
      'Iterar y mejorar el diseño'
    ],
    icono: Rocket,
    colorGradiente: 'from-orange-500 to-red-500'
  },
  4: {
    numero: 4,
    titulo: 'Presentación',
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

interface EtapaIntroProps {
  etapaNumero: number;
  onContinuar: () => void;
}

export function EtapaIntro({ etapaNumero, onContinuar }: EtapaIntroProps) {
  const etapa = etapasInfo[etapaNumero];
  
  if (!etapa) {
    return null;
  }

  const Icono = etapa.icono;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        {/* Icono - Más pequeño y cuadrado como en la imagen */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex justify-center mb-5"
        >
          <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br ${etapa.colorGradiente} flex items-center justify-center shadow-lg`}>
            <Icono className="w-10 h-10 sm:w-12 sm:h-12 text-white stroke-[2.5]" />
          </div>
        </motion.div>

        {/* Badge Etapa - Más pequeño y redondeado */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center mb-4"
        >
          <div className="bg-gray-100 rounded-full px-3 py-1">
            <span className="text-gray-600 text-xs sm:text-sm font-medium">
              Etapa {etapa.numero} de 4
            </span>
          </div>
        </motion.div>

        {/* Título */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-2xl sm:text-3xl font-bold text-[#093c92] text-center mb-4"
        >
          {etapa.titulo}
        </motion.h1>

        {/* Descripción */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-gray-600 text-center text-sm sm:text-base mb-8 leading-relaxed px-4"
        >
          {etapa.descripcion}
        </motion.p>

        {/* Subtítulo */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-gray-700 text-center text-sm font-medium mb-5"
        >
          En esta etapa trabajaremos:
        </motion.p>

        {/* Lista de Actividades - Números rosas como en la imagen */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="space-y-3 mb-8"
        >
          {etapa.actividades.map((actividad, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + index * 0.1 }}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white font-bold text-sm">{index + 1}</span>
              </div>
              <p className="text-gray-800 text-sm sm:text-base font-medium flex-1">
                {actividad}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Botón Comenzar - Gradiente morado-rosa como en la imagen */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="flex justify-center"
        >
          <Button
            onClick={onContinuar}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-12 sm:px-16 py-4 sm:py-5 text-base sm:text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 w-full sm:w-auto"
          >
            ¡Comenzar!
            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

// Componente wrapper para usar con routing
export function EtapaIntroPage() {
  const { sessionId, etapaNumero } = useParams<{ sessionId: string; etapaNumero: string }>();
  const navigate = useNavigate();
  const etapa = parseInt(etapaNumero || '1');

  const handleContinuar = () => {
    if (!sessionId) return;

    // Redirigir a la primera actividad de la etapa correspondiente
    switch (etapa) {
      case 1:
        navigate(`/profesor/etapa1/personalizacion/${sessionId}/`);
        break;
      case 2:
        navigate(`/profesor/etapa2/seleccionar-tema/${sessionId}/`);
        break;
      case 3:
        navigate(`/profesor/etapa3/prototipo/${sessionId}/`);
        break;
      case 4:
        navigate(`/profesor/etapa4/formulario-pitch/${sessionId}/`);
        break;
      default:
        navigate(`/profesor/panel`);
    }
  };

  return <EtapaIntro etapaNumero={etapa} onContinuar={handleContinuar} />;
}

