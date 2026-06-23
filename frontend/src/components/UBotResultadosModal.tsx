import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UBotResultadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  rank: number;
  teamColor?: string;
  stageNumber?: number;
  tokensTotal?: number;
}

export function UBotResultadosModal({ isOpen, onClose, rank, teamColor, stageNumber = 1, tokensTotal = 0 }: UBotResultadosModalProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const textContainerRef = useRef<HTMLDivElement>(null);
  
  // Función para convertir color a hex y crear variaciones oscuras
  const getTeamColorHex = (color: string) => {
    const colorMap: Record<string, string> = {
      Verde: '#28a745',
      Azul: '#007bff',
      Rojo: '#dc3545',
      Amarillo: '#ffc107',
      Naranja: '#fd7e14',
      Morado: '#6f42c1',
      Rosa: '#e83e8c',
      Cian: '#17a2b8',
      Gris: '#6c757d',
      Marrón: '#795548',
    };
    return colorMap[color] || '#667eea';
  };

  // Convertir hex a RGB para crear variaciones oscuras
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 102, g: 126, b: 234 };
  };

  // Crear variaciones oscuras del color del equipo
  const baseColor = teamColor ? getTeamColorHex(teamColor) : '#667eea';
  const rgb = hexToRgb(baseColor);
  const dark1 = `rgb(${Math.max(0, rgb.r - 100)}, ${Math.max(0, rgb.g - 100)}, ${Math.max(0, rgb.b - 100)})`;
  const dark2 = `rgb(${Math.max(0, rgb.r - 150)}, ${Math.max(0, rgb.g - 150)}, ${Math.max(0, rgb.b - 150)})`;
  const dark3 = `rgb(${Math.max(0, rgb.r - 200)}, ${Math.max(0, rgb.g - 200)}, ${Math.max(0, rgb.b - 200)})`;
  
  // Mensaje según la posición y la etapa
  const fullMessage = stageNumber === 4
    ? (rank === 1
      ? `¡Misión Cumplida! 🏆\n\nHan demostrado ser el equipo más sólido. Su valoración final ${tokensTotal} Tokens confirma que lograron el 'Product-Market Fit' perfecto. ¡Disfruten la victoria, Agentes!`
      : '¡Buen trabajo, Agentes! 🤝\n\nQuizás no lideraron el ranking hoy, pero se llevan el activo más valioso: La Experiencia. Recuerden que las empresas más grandes del mundo nacieron después de varios intentos. ¡A seguir iterando!')
    : stageNumber === 3
    ? (rank === 1
      ? '¡Estabilidad temporal detectada! 🛡️\n\nEn esta etapa el mercado creció parejo y las posiciones se mantuvieron intactas. Sigues líder, pero no te confíes.\n\nALERTA CRÍTICA: ⚠️ La Etapa 4 es la Ronda Final y es la que entrega MÁS CAPITAL de todo el juego. Un solo error aquí y pierdes la corona. ¡Prepárate para defender tu puesto!'
      : '¡El tablero no se movió! ⚓\n\nTodos sumaron lo mismo, así que la distancia con el líder se mantiene igual. Parece difícil, pero tengo el dato clave:\n\nDATO SECRETO: ⚡ La Etapa 4 es la que entrega LA MAYOR CANTIDAD DE VALORACIÓN de toda la misión. Matemáticamente, el juego sigue abierto. ¡Es su única oportunidad para dar el golpe final y ganar!')
    : stageNumber === 2
    ? (rank === 1
      ? '¡Dominio del Mercado confirmado! 🏆\n\nSu Start-up está marcando el ritmo de la competencia. Tienen la valoración más alta hasta el momento.\n\nConsejo: Ser el líder significa que ahora todos quieren quitarles el puesto. ¡No se relajen!'
      : '¡Competencia en curso! 📊\n\nAún no están en la cima, pero en el ecosistema emprendedor nada está escrito en piedra.\n\nConsejo: Dejen de mirar el puntaje del vecino y enfóquense en su propia estrategia. ¡Es el momento de concentrarse al 100% en la calidad de su solución!')
    : (rank === 1
      ? '¡Excelente ejecución! 🚀 Están liderando el mercado. Pero cuidado... mantener la cima es más difícil que llegar. ¡No bajen la guardia en la Etapa 2!'
      : '¡Atención! ⚠️ La competencia les está sacando ventaja. Analicen sus fallos, pivoten rápido y recuperen terreno en la siguiente etapa. ¡Aún pueden ganar!');

  // Frases y palabras que deben estar en negrita
  const boldPhrases = stageNumber === 4
    ? (rank === 1
      ? [
          '¡Misión Cumplida!',
          '🏆',
          'equipo más sólido',
          'valoración final',
          'Product-Market Fit',
          'perfecto',
          '¡Disfruten la victoria, Agentes!'
        ]
      : [
          '¡Buen trabajo, Agentes!',
          '🤝',
          'no lideraron el ranking',
          'activo más valioso',
          'La Experiencia',
          'empresas más grandes del mundo',
          'varios intentos',
          '¡A seguir iterando!'
        ])
    : stageNumber === 3
    ? (rank === 1
      ? [
          '¡Estabilidad temporal detectada!',
          '🛡️',
          'mercado creció parejo',
          'posiciones se mantuvieron intactas',
          'Sigues líder',
          'no te confíes',
          'ALERTA CRÍTICA',
          '⚠️',
          'Etapa 4',
          'Ronda Final',
          'MÁS CAPITAL',
          'Un solo error',
          'pierdes la corona',
          '¡Prepárate para defender tu puesto!'
        ]
      : [
          '¡El tablero no se movió!',
          '⚓',
          'distancia con el líder se mantiene igual',
          'dato clave',
          'DATO SECRETO',
          '⚡',
          'Etapa 4',
          'LA MAYOR CANTIDAD DE VALORACIÓN',
          'toda la misión',
          'Matemáticamente',
          'juego sigue abierto',
          'única oportunidad',
          'golpe final y ganar'
        ])
    : stageNumber === 2
    ? (rank === 1
      ? [
          '¡Dominio del Mercado confirmado!',
          '🏆',
          'marcando el ritmo',
          'valoración más alta',
          'Consejo',
          'Ser el líder',
          'quitarles el puesto',
          '¡No se relajen!'
        ]
      : [
          '¡Competencia en curso!',
          '📊',
          'ecosistema emprendedor',
          'nada está escrito en piedra',
          'Consejo',
          'puntaje del vecino',
          'propia estrategia',
          'calidad de su solución',
          '100%'
        ])
    : (rank === 1
      ? [
          '¡Excelente ejecución!',
          'liderando el mercado',
          'mantener la cima',
          '¡No bajen la guardia',
          'Etapa 2',
          '🚀'
        ]
      : [
          '¡Atención!',
          'competencia',
          'sacando ventaja',
          'Analicen sus fallos',
          'pivoten rápido',
          'recuperen terreno',
          '¡Aún pueden ganar!',
          '⚠️'
        ]);

  // Pre-calcular el mapa de estilos para cada carácter del mensaje completo
  const styleMap = useRef<Array<{ isBold: boolean }>>([]);

  useEffect(() => {
    // Calcular el mapa de estilos solo una vez cuando el componente se monta o fullMessage cambia
    const newStyleMap: Array<{ isBold: boolean }> = Array(fullMessage.length).fill({ isBold: false });

    // Marcar las frases en negrita
    boldPhrases.forEach(phrase => {
      let searchIndex = 0;
      while (true) {
        const phraseIndex = fullMessage.indexOf(phrase, searchIndex);
        if (phraseIndex === -1) break;
        for (let i = 0; i < phrase.length; i++) {
          newStyleMap[phraseIndex + i] = { isBold: true };
        }
        searchIndex = phraseIndex + 1;
      }
    });
    styleMap.current = newStyleMap;
  }, [fullMessage, boldPhrases]);

  useEffect(() => {
    if (isOpen) {
      setIsTyping(true);
      setDisplayedText('');
      setShowButton(false);
      let currentIndex = 0;
      
      const typeInterval = setInterval(() => {
        if (currentIndex < fullMessage.length) {
          setDisplayedText(fullMessage.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsTyping(false);
          clearInterval(typeInterval);
          setTimeout(() => {
            setShowButton(true);
          }, 500);
        }
      }, 30);

      return () => {
        clearInterval(typeInterval);
        setIsTyping(false);
        setDisplayedText('');
        setShowButton(false);
      };
    } else {
      setDisplayedText('');
      setIsTyping(false);
      setShowButton(false);
    }
  }, [isOpen, fullMessage]);

  useEffect(() => {
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = textContainerRef.current.scrollHeight;
    }
  }, [displayedText]);

  const renderText = () => {
    const elements: JSX.Element[] = [];
    let currentSegment = '';
    let currentStyle = { isBold: false };

    for (let i = 0; i < displayedText.length; i++) {
      const char = displayedText[i];
      const charStyle = styleMap.current[i] || { isBold: false };

      // Manejar saltos de línea
      if (char === '\n') {
        // Cerrar el segmento actual si existe
        if (currentSegment) {
          elements.push(
            <span 
              key={`segment-${i}`} 
              style={{ fontWeight: currentStyle.isBold ? 'bold' : 'normal' }}
            >
              {currentSegment}
            </span>
          );
          currentSegment = '';
        }
        // Agregar salto de línea
        elements.push(<br key={`br-${i}`} />);
        continue;
      }

      if (i === 0) {
        currentSegment += char;
        currentStyle = charStyle;
      } else if (charStyle.isBold === currentStyle.isBold) {
        currentSegment += char;
      } else {
        elements.push(
          <span 
            key={`segment-${i}`} 
            style={{ fontWeight: currentStyle.isBold ? 'bold' : 'normal' }}
          >
            {currentSegment}
          </span>
        );
        currentSegment = char;
        currentStyle = charStyle;
      }
    }

    if (currentSegment) {
      elements.push(
        <span 
          key={`segment-final`} 
          style={{ fontWeight: currentStyle.isBold ? 'bold' : 'normal' }}
        >
          {currentSegment}
        </span>
      );
    }
    return elements;
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
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 pointer-events-none"
          >
            <div 
              className="rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full mx-auto pointer-events-auto relative flex flex-col max-h-[90vh] min-h-[500px] overflow-hidden"
              style={{
                background: `linear-gradient(to bottom, ${dark1}, ${dark2}, ${dark3})`
              }}
            >
              {/* Efectos de fondo modernos */}
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div 
                  className="absolute top-0 left-0 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl"
                  style={{ backgroundColor: baseColor }}
                ></div>
                <div 
                  className="absolute top-0 right-0 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl"
                  style={{ backgroundColor: baseColor }}
                ></div>
                <div 
                  className="absolute bottom-0 left-1/2 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl"
                  style={{ backgroundColor: baseColor }}
                ></div>
              </div>

              {/* Botón X para cerrar */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors z-50 cursor-pointer"
                aria-label="Cerrar"
                type="button"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              <div className="p-6 sm:p-8 flex flex-col relative z-10 flex-1 min-h-0">
                {/* U-Bot Image */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="flex justify-center mb-4 flex-shrink-0"
                >
                  <img
                    src={isTyping ? "/images/mascot_animated_transparent_1764633508845.svg" : "/images/mascotaprueba.svg"}
                    alt="U-Bot"
                    className="w-32 h-32 sm:w-40 sm:h-40"
                    style={{
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 60px rgba(192, 132, 252, 0.5)) drop-shadow(0 0 90px rgba(236, 72, 153, 0.4))',
                    }}
                  />
                </motion.div>

                {/* Mensaje con animación de escritura - Altura fija con scroll */}
                <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 sm:p-6 border border-purple-500/30 shadow-xl flex flex-col" style={{ height: '200px' }}>
                  <div className="flex items-start gap-3 mb-2 flex-shrink-0">
                    <span className="font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent text-lg sm:text-xl">U-Bot:</span>
                  </div>
                  <div 
                    ref={textContainerRef}
                    className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar" 
                    style={{ maxHeight: 'calc(200px - 3rem)' }}
                  >
                    <p className="text-white text-sm sm:text-base leading-relaxed whitespace-pre-line">
                      {renderText()}
                      {isTyping && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                          className="inline-block w-2 h-5 bg-gradient-to-b from-purple-400 to-pink-400 ml-1"
                        />
                      )}
                    </p>
                  </div>
                </div>

                {/* Botón Continuar */}
                {showButton && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 flex-shrink-0"
                  >
                    <Button
                      onClick={onClose}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                      Continuar
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


