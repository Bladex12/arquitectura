import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, Briefcase, Map, Cog } from 'lucide-react';

export function TabletLoadingScreen() {
  const [searchParams] = useSearchParams();
  const [loadingDots, setLoadingDots] = useState('');
  const [currentMessage, setCurrentMessage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const loadingMessages = [
    'Preparando tu misión',
    'Cargando recursos emprendedores',
    'Activando habilidades de innovación',
    'Iniciando el juego'
  ];

  // Animación de puntos suspensivos
  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setLoadingDots((prev) => {
        if (prev === '') return '.';
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '';
      });
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  // Rotación de mensajes temáticos
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);

    return () => clearInterval(messageInterval);
  }, []);

  // Obtener URL de redirección desde parámetros
  useEffect(() => {
    const redirect = searchParams.get('redirect');
    const connectionId = searchParams.get('connection_id');
    
    if (redirect) {
      // Construir URL completa con parámetros necesarios
      let fullUrl = redirect;
      if (connectionId) {
        fullUrl += `?connection_id=${connectionId}`;
      }
      setRedirectUrl(fullUrl);
    }
  }, [searchParams]);

  // Animación de progreso
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95; // No llegar al 100% hasta que realmente cargue
        return prev + Math.random() * 3;
      });
    }, 200);

    return () => clearInterval(progressInterval);
  }, []);

  // Redirigir después de 5 segundos si hay URL de redirección
  useEffect(() => {
    if (redirectUrl) {
      const redirectTimer = setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 300);
      }, 5000);

      return () => clearTimeout(redirectTimer);
    }
  }, [redirectUrl]);

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center">
      {/* Fondo animado igual que Panel.tsx */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <motion.div
          animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
          transition={{ duration: 20, repeat: Infinity, repeatType: 'reverse' }}
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '50px 50px' }}
        />
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-30"
              initial={{ x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920), y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080) }}
              animate={{ y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080)], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
            />
          ))}
        </div>
      </div>

      {/* Logo en esquina superior derecha - Responsivo y minimalista */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 overflow-hidden opacity-80"
        style={{ height: 'clamp(50px, 6vw, 100px)', width: 'auto' }}
      >
        <img
          src="/images/UDD-negro.png"
          alt="Logo UDD"
          className="h-full w-auto object-contain drop-shadow-lg"
        />
      </motion.div>

      {/* Contenedor principal - Centrado y optimizado */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 min-h-[60vh] max-w-4xl mx-auto">
        {/* Título del juego - Foco principal */}
        <motion.h1
          initial={{ opacity: 0, y: -30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-4xl sm:text-5xl md:text-6xl font-black text-[#f757ac] mb-8 drop-shadow-2xl text-center"
          style={{ 
            fontFamily: 'system-ui, -apple-system, sans-serif',
            letterSpacing: '-0.02em',
            textShadow: '0 4px 20px rgba(247, 87, 172, 0.4), 0 0 40px rgba(247, 87, 172, 0.2)'
          }}
        >
          Misión Emprende
        </motion.h1>

        {/* Íconos temáticos animados */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex items-center gap-4 sm:gap-6 mb-8"
        >
            {[
              { Icon: Rocket, delay: 0 },
              { Icon: Briefcase, delay: 0.1 },
              { Icon: Map, delay: 0.2 },
              { Icon: Cog, delay: 0.3 }
            ].map(({ Icon, delay }, index) => (
            <motion.div
              key={index}
              initial={{ y: 0, opacity: 0 }}
              animate={{ 
                y: [0, -10, 0],
                opacity: 1
              }}
              transition={{
                y: {
                  duration: 2,
                  repeat: Infinity,
                  delay: delay,
                  ease: 'easeInOut'
                },
                opacity: { duration: 0.5, delay: delay + 0.4 }
              }}
              className="text-[#f757ac] opacity-60"
            >
              <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
            </motion.div>
          ))}
        </motion.div>

        {/* Mensaje de carga temático - Rotativo */}
        <motion.div
          key={currentMessage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h2 
            className="text-lg sm:text-xl md:text-2xl font-semibold text-white text-center px-4"
            style={{ 
              textShadow: '0 0 20px rgba(247, 87, 172, 0.8), 0 0 40px rgba(247, 87, 172, 0.5), 0 2px 10px rgba(0, 0, 0, 0.3)',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            {loadingMessages[currentMessage]}
            <span className="inline-block w-8 text-left">{loadingDots}</span>
          </h2>
        </motion.div>

        {/* Barra de progreso animada */}
        <div className="w-full max-w-md px-4 mb-4">
          <div className="relative h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-[#f757ac] via-[#e83e8c] to-[#f757ac] rounded-full relative overflow-hidden"
              style={{
                boxShadow: '0 0 20px rgba(247, 87, 172, 0.6)'
              }}
            >
              {/* Efecto de brillo animado */}
              <motion.div
                animate={{
                  x: ['-100%', '200%']
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear'
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              />
            </motion.div>
          </div>
          <div className="text-center mt-2">
            <span className="text-xs sm:text-sm text-white/70 font-medium">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

