import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface Question {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: number; // 0=A, 1=B, 2=C, 3=D
  options?: Array<{ label: string; text: string }>;
}

interface GeneralKnowledgeQuizProps {
  questions: Question[];
  onComplete: (results: Array<{ question_id: number; selected: number }>) => void;
  initialIndex?: number;
  initialSelectedAnswers?: Map<number, number>;
  onProgressChange?: (currentIndex: number, selectedAnswers: Map<number, number>) => void;
}

const OPTION_COLORS = [
  'bg-red-500 hover:bg-red-600', // A
  'bg-blue-500 hover:bg-blue-600', // B
  'bg-yellow-500 hover:bg-yellow-600', // C
  'bg-green-500 hover:bg-green-600', // D
];

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function GeneralKnowledgeQuiz({ questions, onComplete, initialIndex = 0, initialSelectedAnswers, onProgressChange }: GeneralKnowledgeQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [selectedAnswers, setSelectedAnswers] = useState<Map<number, number>>(initialSelectedAnswers || new Map());
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const completedRef = useRef(false);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restaurar índice y respuestas desde el progreso cuando cambian los props
  useEffect(() => {
    if (initialIndex !== undefined && initialIndex >= 0 && questions.length > 0) {
      // El índice inicial representa el número de respuestas dadas
      // Si hay 2 respuestas (índice 2), debemos mostrar la pregunta 3 (índice 2)
      // Si todas están respondidas (índice = questions.length), mostrar la última pregunta
      let displayIndex = initialIndex;
      
      // Si el índice es mayor o igual al número de preguntas, mostrar la última
      if (displayIndex >= questions.length) {
        displayIndex = questions.length - 1;
      }
      
      // Asegurar que esté dentro del rango válido
      displayIndex = Math.max(0, Math.min(displayIndex, questions.length - 1));
      
      console.log('[GeneralKnowledgeQuiz] Restaurando índice:', displayIndex, 'de', questions.length, 'preguntas (respuestas dadas:', initialIndex, ')');
      
      setCurrentIndex(displayIndex);
      setShowFeedback(false);
    }
  }, [initialIndex, questions.length]);

  useEffect(() => {
    if (initialSelectedAnswers && initialSelectedAnswers.size > 0) {
      console.log('[GeneralKnowledgeQuiz] Restaurando respuestas seleccionadas:', initialSelectedAnswers.size);
      setSelectedAnswers(new Map(initialSelectedAnswers));
    }
  }, [initialSelectedAnswers]);

  // Reset feedback cuando cambia la pregunta
  useEffect(() => {
    setShowFeedback(false);
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  }, [currentIndex]);

  // Verificar que el índice esté dentro del rango válido
  const totalQuestions = questions.length;
  const validIndex = totalQuestions > 0 ? Math.min(Math.max(0, currentIndex), totalQuestions - 1) : 0;
  const currentQuestion = totalQuestions > 0 ? questions[validIndex] : null;
  const progress = totalQuestions > 0 ? ((validIndex + 1) / totalQuestions) * 100 : 0;

  // Obtener opciones del formato del backend o construir desde campos individuales
  const getOptions = (question: Question) => {
    if (question.options) {
      return question.options;
    }
    return [
      { label: 'A', text: question.option_a },
      { label: 'B', text: question.option_b },
      { label: 'C', text: question.option_c },
      { label: 'D', text: question.option_d },
    ];
  };

  const options = currentQuestion ? getOptions(currentQuestion) : [];

  const handleSelectAnswer = (answerIndex: number) => {
    if (!currentQuestion) return;
    
    // Limpiar timeout anterior si existe
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }
    
    const newSelectedAnswers = new Map(selectedAnswers);
    newSelectedAnswers.set(currentQuestion.id, answerIndex);
    setSelectedAnswers(newSelectedAnswers);

    // Mostrar feedback inmediatamente
    const isCorrect = answerIndex === currentQuestion.correct_answer;
    setFeedbackCorrect(isCorrect);
    setShowFeedback(true);

    // Verificar si todas las preguntas están respondidas
    const allAnswered = newSelectedAnswers.size === totalQuestions;
    
    // Auto-avanzar después de mostrar el feedback (2.5 segundos para que el usuario vea el mensaje)
    autoAdvanceTimeoutRef.current = setTimeout(() => {
      setShowFeedback(false);
      
      // Notificar cambio de progreso antes de avanzar
      if (onProgressChange) {
        const nextIndex = currentIndex < totalQuestions - 1 ? currentIndex + 1 : currentIndex;
        onProgressChange(nextIndex, newSelectedAnswers);
      }
      
      if (currentIndex < totalQuestions - 1) {
        const newIndex = currentIndex + 1;
        setCurrentIndex(newIndex);
        // Notificar cambio de progreso después de avanzar
        if (onProgressChange) {
          onProgressChange(newIndex, newSelectedAnswers);
        }
      } else if (allAnswered) {
        // Última pregunta y todas respondidas, completar automáticamente
        // Asegurar que la última respuesta esté guardada antes de completar
        setTimeout(() => {
          handleComplete();
        }, 100);
      }
    }, 2500);
  };

  const handleComplete = () => {
    // Solo enviar question_id y selected, NO calcular correct en el frontend
    // El backend calculará si es correcto
    // IMPORTANTE: Filtrar respuestas que no tienen selected válido (no -1)
    const results = questions
      .map((q) => {
        const selected = selectedAnswers.get(q.id);
        // Solo incluir si tiene una respuesta seleccionada válida (no undefined y no -1)
        if (selected !== undefined && selected !== null && selected !== -1) {
          return {
            question_id: q.id,
            selected: selected, // El backend calculará si es correcto
          };
        }
        return null;
      })
      .filter((r): r is { question_id: number; selected: number } => r !== null);
    
    console.log('[GeneralKnowledgeQuiz] handleComplete - Enviando respuestas:', results.length, 'de', questions.length);
    console.log('[GeneralKnowledgeQuiz] handleComplete - selectedAnswers:', Array.from(selectedAnswers.entries()));
    
    onComplete(results);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  if (!currentQuestion || totalQuestions === 0) {
    return (
      <div className="text-center text-gray-500">
        <p>Cargando preguntas...</p>
      </div>
    );
  }

  const selectedAnswer = selectedAnswers.get(currentQuestion.id);
  const isLastQuestion = validIndex === totalQuestions - 1;
  const allAnswered = selectedAnswers.size === totalQuestions;
  
  // Si todas las preguntas están respondidas y estamos en la última pregunta con respuesta, completar automáticamente
  useEffect(() => {
    if (allAnswered && isLastQuestion && selectedAnswer !== undefined && !completedRef.current) {
      completedRef.current = true;
      // Pequeño delay para mostrar el feedback de la última respuesta antes de completar
      // Asegurar que la última respuesta esté guardada antes de completar
      const timer = setTimeout(() => {
        // Verificar que todas las respuestas estén en el Map antes de completar
        const allResponsesPresent = questions.every(q => {
          const selected = selectedAnswers.get(q.id);
          return selected !== undefined && selected !== null && selected !== -1;
        });
        
        if (allResponsesPresent) {
          console.log('[GeneralKnowledgeQuiz] Todas las respuestas están presentes, completando...');
          handleComplete();
        } else {
          console.warn('[GeneralKnowledgeQuiz] Algunas respuestas faltan, esperando...');
          // Esperar un poco más si faltan respuestas
          setTimeout(() => {
            handleComplete();
          }, 500);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [allAnswered, isLastQuestion, selectedAnswer, questions.length, selectedAnswers]);

  return (
    <div className="space-y-6">
      {/* Barra de progreso */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            Pregunta {validIndex + 1} de {totalQuestions}
          </span>
          <span className="text-sm font-semibold text-gray-700">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-green-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Pregunta */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-100">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 text-center mb-6">
          {currentQuestion.question}
        </h2>

        {/* Opciones */}
        <div className="grid grid-cols-2 gap-4">
          {options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = index === currentQuestion.correct_answer;
            const showCorrect = selectedAnswer !== undefined && isCorrect;

            return (
              <motion.button
                key={index}
                onClick={() => handleSelectAnswer(index)}
                disabled={selectedAnswer !== undefined}
                className={`
                  ${OPTION_COLORS[index]}
                  text-white font-bold py-4 px-6 rounded-xl
                  transition-all duration-200
                  ${isSelected ? 'ring-4 ring-offset-2 ring-white' : ''}
                  ${showCorrect ? 'ring-green-300' : ''}
                  ${selectedAnswer !== undefined && !isSelected ? 'opacity-50' : ''}
                  disabled:cursor-not-allowed
                `}
                whileHover={selectedAnswer === undefined ? { scale: 1.05 } : {}}
                whileTap={selectedAnswer === undefined ? { scale: 0.95 } : {}}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold mb-2">{option.label}</div>
                  <div className="text-sm sm:text-base">{option.text}</div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Feedback */}
        {showFeedback && selectedAnswer !== undefined && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={`mt-6 p-5 rounded-xl text-center font-bold text-lg shadow-lg border-2 ${
              feedbackCorrect
                ? 'bg-green-50 text-green-800 border-green-400'
                : 'bg-red-50 text-red-800 border-red-400'
            }`}
          >
            {feedbackCorrect ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">✅</span>
                  <span>¡Correcto!</span>
                </div>
                <div className="text-base font-semibold mt-1 text-green-700">
                  Has ganado 1 token
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">❌</span>
                  <span>Incorrecto</span>
                </div>
                <div className="text-base font-semibold mt-1">
                  La respuesta correcta es: <span className="text-xl">{OPTION_LABELS[currentQuestion.correct_answer]}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Navegación */}
      {!allAnswered || !isLastQuestion ? (
        <div className="flex justify-between gap-4">
          <Button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            variant="outline"
            className="flex-1 text-gray-700 bg-white hover:bg-gray-50"
          >
            ← Anterior
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selectedAnswer}
            className="flex-1 bg-[#093c92] hover:bg-[#072e73] text-white"
          >
            {isLastQuestion ? 'Siguiente →' : 'Siguiente →'}
          </Button>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-green-600 font-semibold">Completando...</p>
        </div>
      )}

      {/* Información de tokens */}
      <p className="text-center text-gray-600 text-sm">
        ⭐ Gana 1 token por cada respuesta correcta
      </p>
    </div>
  );
}

