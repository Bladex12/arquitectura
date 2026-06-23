import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnagramData } from './types';

interface AnagramGameProps {
  data: AnagramData;
  currentIndex: number;
  userAnswer: string;
  setUserAnswer: (answer: string) => void;
  isCorrect: boolean | null;
  submitting: boolean;
  onVerify: () => void;
  teamColor?: string;
}

export function AnagramGame({
  data,
  currentIndex,
  userAnswer,
  setUserAnswer,
  isCorrect,
  submitting,
  onVerify,
  teamColor,
}: AnagramGameProps) {
  const [showHint, setShowHint] = useState(false);
  const currentWord = data.words[currentIndex];
  const allCompleted = currentIndex >= data.words.length;
  
  // Función para convertir color a hex
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

  const teamColorHex = teamColor ? getTeamColorHex(teamColor) : '#093c92';
  
  // Reset hint cuando cambia la palabra
  useEffect(() => {
    setShowHint(false);
  }, [currentIndex]);

  if (allCompleted) {
    return null; // El componente padre maneja la pantalla de completado
  }

  if (!currentWord) {
    return (
      <div className="text-center text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p>Cargando palabras...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <label className="block text-gray-700 font-semibold text-base sm:text-lg mb-4">
          Anagrama:
        </label>
        <div 
          className="text-3xl sm:text-4xl font-bold tracking-wider mb-4"
          style={{ color: teamColorHex }}
        >
          {currentWord.anagram.toUpperCase()}
        </div>
        
        {/* Botón de pista */}
        {!showHint && (
          <Button
            onClick={() => setShowHint(true)}
            variant="outline"
            className="mb-4 bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-400"
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            Ver pista
          </Button>
        )}
        
        {/* Mostrar pista */}
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg p-3 mb-4"
          >
            <p className="text-sm text-gray-700 font-semibold">
              💡 Pista: La palabra comienza con <span className="text-2xl font-bold" style={{ color: teamColorHex }}>{currentWord.word[0].toUpperCase()}</span>
            </p>
          </motion.div>
        )}
      </div>

      <div>
        <Input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !submitting) {
              onVerify();
            }
          }}
          placeholder="Escribe la palabra correcta aquí..."
          className={`h-14 sm:h-16 text-center text-lg sm:text-xl text-gray-900 ${
            isCorrect === true
              ? 'border-green-500 bg-green-50'
              : isCorrect === false
              ? 'border-red-500 bg-red-50'
              : 'bg-white'
          }`}
          disabled={submitting || isCorrect === true}
          autoComplete="off"
        />
        {isCorrect === true && (
          <p className="text-center text-green-600 font-semibold text-lg sm:text-xl mt-4">
            ✅ ¡Correcto!
          </p>
        )}
        {isCorrect === false && (
          <p className="text-center text-red-600 font-semibold text-lg sm:text-xl mt-4">
            ❌ Incorrecto. Intenta de nuevo.
          </p>
        )}
      </div>

      <p className="text-center text-gray-600 text-sm sm:text-base">
        ⭐ Cada palabra correcta = 1 token
      </p>

      <Button
        onClick={onVerify}
        disabled={submitting || isCorrect === true || !userAnswer.trim()}
        className="w-full h-12 sm:h-14 bg-[#093c92] hover:bg-[#072e73] text-white text-base sm:text-lg font-semibold"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Verificando...
          </>
        ) : (
          '✓ Verificar Respuesta'
        )}
      </Button>
    </div>
  );
}

