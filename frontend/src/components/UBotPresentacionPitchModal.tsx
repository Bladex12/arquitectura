import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UBotPresentacionPitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinuar: () => void;
  teamColor?: string;
}

export function UBotPresentacionPitchModal({ 
  isOpen, 
  onClose, 
  onContinuar,
  teamColor 
}: UBotPresentacionPitchModalProps) {
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
  
  const fullMessage = `¡Es el showtime! 🎬🚀\n\nAgentes, respiren hondo. No le están hablando a sus compañeros, le están hablando al mercado.\n\nÚltimo consejo: Párense derechos, miren a los ojos y crean en su cuento. ¡Vayan al frente y hagan historia!`;

  // Frases a resaltar (bolding)
  const phrasesToBold = [
    '¡Es el showtime!',
    '🎬🚀',
    'Agentes',
    'mercado',
    'Último consejo',
    'Párense derechos',
    'miren a los ojos',
    'creen en su cuento',
    '¡Vayan al frente y hagan historia!'
  ];

  // Efecto para hacer scroll automático hacia abajo cuando cambia el texto
  useEffect(() => {
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = textContainerRef.current.scrollHeight;
    }
  }, [displayedText]);

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
          // Mostrar botón después de un pequeño delay
          setTimeout(() => {
            setShowButton(true);
          }, 500);
        }
      }, 30); // Velocidad de escritura (30ms por carácter)

      return () => {
        clearInterval(typeInterval);
        setIsTyping(false);
        setDisplayedText('');
        setShowButton(false);
      };
    } else {
      // Reset cuando se cierra
      setDisplayedText('');
      setIsTyping(false);
      setShowButton(false);
    }
  }, [isOpen, fullMessage]);

  if (!isOpen) return null;

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
                {/* Título de la Etapa */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-center mb-4 flex-shrink-0"
                >
                  <div className="bg-gray-100 rounded-full px-3 py-1 inline-block">
                    <span className="text-gray-600 text-xs font-medium">
                      Etapa 4 de 4: Pitch
                    </span>
                  </div>
                </motion.div>

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
                      {(() => {
                        // Pre-calcular todas las posiciones de estilo en el mensaje completo
                        const styleMap: Array<{ isBold: boolean }> = new Array(fullMessage.length);
                        
                        // Inicializar todo como normal
                        for (let i = 0; i < fullMessage.length; i++) {
                          styleMap[i] = { isBold: false };
                        }
                        
                        // Marcar frases en negrita
                        for (const phrase of phrasesToBold) {
                          let searchIndex = 0;
                          while (true) {
                            const phraseIndex = fullMessage.indexOf(phrase, searchIndex);
                            if (phraseIndex === -1) break;
                            for (let i = phraseIndex; i < phraseIndex + phrase.length; i++) {
                              styleMap[i] = { isBold: true };
                            }
                            searchIndex = phraseIndex + 1;
                          }
                        }
                        
                        // Renderizar carácter por carácter con el estilo correcto
                        const chars: JSX.Element[] = [];
                        let currentSpan: { text: string; style: { isBold: boolean } } | null = null;
                        
                        for (let i = 0; i < displayedText.length; i++) {
                          const char = displayedText[i];
                          const style = styleMap[i] || { isBold: false };
                          
                          // Manejar saltos de línea
                          if (char === '\n') {
                            if (currentSpan) {
                              if (currentSpan.style.isBold) {
                                chars.push(
                                  <span key={`span-${chars.length}`} className="font-bold">
                                    {currentSpan.text}
                                  </span>
                                );
                              } else {
                                chars.push(
                                  <span key={`span-${chars.length}`}>
                                    {currentSpan.text}
                                  </span>
                                );
                              }
                              currentSpan = null;
                            }
                            chars.push(<br key={`br-${i}`} />);
                            continue;
                          }
                          
                          if (!currentSpan || currentSpan.style.isBold !== style.isBold) {
                            if (currentSpan) {
                              if (currentSpan.style.isBold) {
                                chars.push(
                                  <span key={`span-${chars.length}`} className="font-bold">
                                    {currentSpan.text}
                                  </span>
                                );
                              } else {
                                chars.push(
                                  <span key={`span-${chars.length}`}>
                                    {currentSpan.text}
                                  </span>
                                );
                              }
                            }
                            currentSpan = { text: char, style };
                          } else {
                            currentSpan.text += char;
                          }
                        }
                        
                        if (currentSpan) {
                          if (currentSpan.style.isBold) {
                            chars.push(
                              <span key={`span-${chars.length}`} className="font-bold">
                                {currentSpan.text}
                              </span>
                            );
                          } else {
                            chars.push(
                              <span key={`span-${chars.length}`}>
                                {currentSpan.text}
                              </span>
                            );
                          }
                        }
                        
                        return chars;
                      })()}
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
                    className="flex-shrink-0 mt-4"
                  >
                    <Button
                      onClick={onContinuar}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                      Continuar
                      <ArrowRight className="w-5 h-5" />
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

