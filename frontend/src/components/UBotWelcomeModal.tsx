import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface UBotWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  startupName: string;
  teamColor?: string;
}

export function UBotWelcomeModal({ isOpen, onClose, startupName, teamColor }: UBotWelcomeModalProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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

  // Crear variaciones oscuras del color del equipo - Calcular una vez al inicio
  const baseColor = teamColor ? getTeamColorHex(teamColor) : '#667eea';
  const rgb = hexToRgb(baseColor);
  const dark1 = `rgb(${Math.max(0, rgb.r - 100)}, ${Math.max(0, rgb.g - 100)}, ${Math.max(0, rgb.b - 100)})`;
  const dark2 = `rgb(${Math.max(0, rgb.r - 150)}, ${Math.max(0, rgb.g - 150)}, ${Math.max(0, rgb.b - 150)})`;
  const dark3 = `rgb(${Math.max(0, rgb.r - 200)}, ${Math.max(0, rgb.g - 200)}, ${Math.max(0, rgb.b - 200)})`;
  
  const fullMessage = `¡Enlace establecido! 🤖 Soy U-Bot, tu Asistente Táctico.

He analizado los datos y el sistema los ha reclutado específicamente para la ${startupName}. Mis cálculos predicen una compatibilidad del 99%.

Tu Misión Prioritaria: Escanea el perímetro visualmente, localiza a los otros miembros de tu escuadrón y reúnanse AHORA. ¡El reloj corre!`;

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
      let currentIndex = 0;
      
      const typeInterval = setInterval(() => {
        if (currentIndex < fullMessage.length) {
          setDisplayedText(fullMessage.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsTyping(false);
          clearInterval(typeInterval);
        }
      }, 30); // Velocidad de escritura (30ms por carácter)

      return () => {
        clearInterval(typeInterval);
        setIsTyping(false);
        setDisplayedText('');
      };
    } else {
      // Reset cuando se cierra
      setDisplayedText('');
      setIsTyping(false);
    }
  }, [isOpen, fullMessage]);

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
                {/* U-Bot Image - Tamaño fijo */}
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

                {/* Título U-Bot - Tamaño fijo */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center mb-4 flex-shrink-0"
                >
                  <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                    U-Bot
                  </h2>
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
                        // Frases y palabras que deben estar en negrita
                        const boldPhrases = [
                          '¡Enlace establecido!',
                          'Asistente Táctico',
                          'Misión Prioritaria',
                          '¡El reloj corre!',
                          'U-Bot',
                          '99%',
                          'AHORA'
                        ];
                        
                        const currentText = displayedText;
                        const fullText = fullMessage;
                        
                        // Pre-calcular todas las posiciones de estilo en el mensaje completo
                        const styleMap: Array<{ isStartup: boolean; isBold: boolean }> = new Array(fullText.length);
                        
                        // Inicializar todo como normal
                        for (let i = 0; i < fullText.length; i++) {
                          styleMap[i] = { isStartup: false, isBold: false };
                        }
                        
                        // Marcar el nombre de la startup
                        const startupIndex = fullText.indexOf(startupName);
                        if (startupIndex !== -1) {
                          for (let i = startupIndex; i < startupIndex + startupName.length; i++) {
                            styleMap[i] = { isStartup: true, isBold: true };
                          }
                        }
                        
                        // Marcar frases en negrita
                        for (const phrase of boldPhrases) {
                          let searchIndex = 0;
                          while (true) {
                            const phraseIndex = fullText.indexOf(phrase, searchIndex);
                            if (phraseIndex === -1) break;
                            for (let i = phraseIndex; i < phraseIndex + phrase.length; i++) {
                              // Solo aplicar si no es parte de la startup
                              if (!styleMap[i].isStartup) {
                                styleMap[i] = { isStartup: false, isBold: true };
                              }
                            }
                            searchIndex = phraseIndex + 1;
                          }
                        }
                        
                        // Renderizar carácter por carácter con el estilo correcto
                        const chars: JSX.Element[] = [];
                        let currentSpan: { text: string; style: { isStartup: boolean; isBold: boolean } } | null = null;
                        
                        for (let i = 0; i < currentText.length; i++) {
                          const char = currentText[i];
                          // Usar el estilo del mensaje completo para esta posición
                          const style = styleMap[i] || { isStartup: false, isBold: false };
                          
                          // Si el estilo cambió o es el primer carácter, crear un nuevo span
                          if (!currentSpan || 
                              currentSpan.style.isStartup !== style.isStartup || 
                              currentSpan.style.isBold !== style.isBold) {
                            // Cerrar el span anterior si existe
                            if (currentSpan) {
                              if (currentSpan.style.isStartup) {
                                chars.push(
                                  <span key={`span-${chars.length}`} style={{ color: baseColor, fontWeight: 'bold' }}>
                                    {currentSpan.text}
                                  </span>
                                );
                              } else if (currentSpan.style.isBold) {
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
                            
                            // Crear nuevo span
                            currentSpan = { text: char, style };
                          } else {
                            // Agregar carácter al span actual
                            currentSpan.text += char;
                          }
                        }
                        
                        // Cerrar el último span
                        if (currentSpan) {
                          if (currentSpan.style.isStartup) {
                            chars.push(
                              <span key={`span-${chars.length}`} style={{ color: baseColor, fontWeight: 'bold' }}>
                                {currentSpan.text}
                              </span>
                            );
                          } else if (currentSpan.style.isBold) {
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
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

