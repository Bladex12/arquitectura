import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Film, Play } from 'lucide-react';

export function Tutorial() {
  const navigate = useNavigate();

  // URL del video tutorial — para cambiar el video reemplaza el ID después de /embed/
  const tutorialVideoUrl =
    'https://www.youtube.com/embed/dQw4w9WgXcQ?controls=1&rel=0&modestbranding=1';

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Background blobs */}
      <div
        className="absolute top-[-8%] left-[-6%] w-96 h-96 rounded-full pointer-events-none"
        style={{ background: '#2563EB', filter: 'blur(180px)', opacity: 0.12 }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: '#FF3D2E', filter: 'blur(200px)', opacity: 0.09 }}
      />
      <div
        className="absolute top-[30%] right-[5%] w-72 h-72 rounded-full pointer-events-none"
        style={{ background: '#F5A623', filter: 'blur(150px)', opacity: 0.10 }}
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
          onClick={() => navigate('/profesor/panel')}
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
          className="flex items-center gap-4 mb-6"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-[#2563EB] to-[#FF3D2E] rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
            <Film className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1
              className="text-xl sm:text-2xl font-black text-[#1B1B2F]"
              style={{ fontFamily: 'Unbounded, sans-serif' }}
            >
              Video Instructivo
            </h1>
            <p className="text-sm text-[#1B1B2F]/45">Cómo jugar Misión Emprende</p>
          </div>
        </motion.div>

        {/* Video card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 160, damping: 22 }}
          className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm overflow-hidden flex-1"
          style={{ border: '1.5px solid rgba(255,255,255,0.9)' }}
        >
          {/* Card header stripe */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#2563EB] via-[#FF3D2E] to-[#F5A623]" />

          <div className="p-5 sm:p-7">
            {/* Tip row */}
            <div className="flex items-center gap-2 mb-5 px-3 py-2.5 bg-[#F5F0E8]/80 rounded-xl border border-[#1B1B2F]/6">
              <Play className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
              <p className="text-xs text-[#1B1B2F]/55 font-medium">
                Reproduce el video para aprender cómo guiar a tus estudiantes en cada etapa del juego
              </p>
            </div>

            {/* Video embed */}
            <motion.div
              whileHover={{ scale: 1.005 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="rounded-2xl overflow-hidden bg-black shadow-md"
              style={{ aspectRatio: '16/9' }}
            >
              <iframe
                src={tutorialVideoUrl}
                title="Tutorial - Cómo Jugar Misión Emprende"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
