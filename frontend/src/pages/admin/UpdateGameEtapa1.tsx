import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, ChevronLeft, Clock, Save, FileText, Video, Users, Gamepad2, BookOpen, Presentation, Trophy, Map, MessageCircle, PenTool, Mic, GraduationCap, HelpCircle, FileCheck, ClipboardList, Target, Plus, Trash2, Search, Edit, X, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { challengesAPI } from '@/services';
import { WordSearchPreview } from '@/components/admin/WordSearchPreview';

interface Activity {
  id: number;
  name: string;
  description?: string;
  order_number: number;
  activity_type_name: string;
  timer_duration?: number | null;
  is_active?: boolean;
  config_data?: any;
  stage_name?: string;
}

export function UpdateGameEtapa1() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const selectedStage = 1; // Siempre es la Etapa 1
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  // Estado para la vista de detalle de actividad
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  
  // Estado del formulario de edición
  const [timerMinutes, setTimerMinutes] = useState<number>(0);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [savingActivity, setSavingActivity] = useState(false);

  // Estados para gestión de Sopa de Letras
  const [wordSearchOptions, setWordSearchOptions] = useState<any[]>([]);
  const [loadingWordSearch, setLoadingWordSearch] = useState(false);
  const [creatingWordSearch, setCreatingWordSearch] = useState(false);
  const [wordSearchWords, setWordSearchWords] = useState<string[]>(['', '', '', '', '']);
  const [wordSearchName, setWordSearchName] = useState('');
  const [wordSearchPreview, setWordSearchPreview] = useState<any>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  // Estados para gestión de Anagrama
  const [anagramWords, setAnagramWords] = useState<any[]>([]);
  const [loadingAnagram, setLoadingAnagram] = useState(false);
  const [creatingAnagram, setCreatingAnagram] = useState(false);
  const [newAnagramWord, setNewAnagramWord] = useState('');
  const [anagramPreview, setAnagramPreview] = useState<string>('');

  // Estados para gestión de Preguntas del Caos
  const [chaosQuestions, setChaosQuestions] = useState<any[]>([]);
  const [loadingChaos, setLoadingChaos] = useState(false);
  const [creatingChaos, setCreatingChaos] = useState(false);
  const [editingChaos, setEditingChaos] = useState<any | null>(null);
  const [newChaosQuestion, setNewChaosQuestion] = useState('');

  // Estados para gestión de Preguntas de Conocimiento General
  const [generalKnowledgeQuestions, setGeneralKnowledgeQuestions] = useState<any[]>([]);
  const [loadingGeneralKnowledge, setLoadingGeneralKnowledge] = useState(false);
  const [creatingGeneralKnowledge, setCreatingGeneralKnowledge] = useState(false);
  const [editingGeneralKnowledge, setEditingGeneralKnowledge] = useState<any | null>(null);
  const [newGeneralKnowledgeQuestion, setNewGeneralKnowledgeQuestion] = useState({
    question: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 0, // 0=A, 1=B, 2=C, 3=D
  });

  // Función para obtener el icono según el tipo de actividad
  const getActivityIcon = (activityTypeName: string, activityName: string): any => {
    const typeLower = (activityTypeName || '').toLowerCase();
    const nameLower = (activityName || '').toLowerCase();

    if (nameLower.includes('presentación') || nameLower.includes('presentacion')) return Presentation;
    if (nameLower.includes('personalización') || nameLower.includes('personalizacion')) return Users;
    if (nameLower.includes('instructivo') || nameLower.includes('instrucciones')) return BookOpen;
    if (nameLower.includes('minijuego') || nameLower.includes('minigame')) return Gamepad2;
    if (nameLower.includes('tema') || nameLower.includes('seleccionar')) return Target;
    if (nameLower.includes('desafío') || nameLower.includes('desafio')) return Trophy;
    if (nameLower.includes('mapa') || nameLower.includes('empatía') || nameLower.includes('empatia')) return Map;
    if (nameLower.includes('prototipo') || nameLower.includes('creatividad')) return PenTool;
    if (nameLower.includes('pitch') || nameLower.includes('comunicación') || nameLower.includes('comunicacion')) return Mic;
    if (nameLower.includes('reflexión') || nameLower.includes('reflexion')) return MessageCircle;
    if (nameLower.includes('evaluación') || nameLower.includes('evaluacion')) return FileCheck;
    if (nameLower.includes('video')) return Video;
    if (nameLower.includes('tutorial')) return GraduationCap;
    if (nameLower.includes('objetivo')) return Target;
    
    if (typeLower.includes('presentation') || typeLower.includes('presentación')) return Presentation;
    if (typeLower.includes('personalization') || typeLower.includes('personalización')) return Users;
    if (typeLower.includes('minigame') || typeLower.includes('minijuego')) return Gamepad2;
    if (typeLower.includes('topic') || typeLower.includes('tema')) return Target;
    if (typeLower.includes('challenge') || typeLower.includes('desafío')) return Trophy;
    
    return FileText; // Icono por defecto
  };

  const handleStageClick = async (stageId: number) => {
    setLoadingActivities(true);

    try {
      // Obtener actividades de la etapa desde el API
      const activitiesData = await challengesAPI.getActivities({ stage: stageId, include_inactive: 'true' });
      // Asegurarse de que las actividades tengan el campo timer_duration
      const activitiesWithTimers = (activitiesData || []).map((activity: any) => ({
        ...activity,
        timer_duration: activity.timer_duration ?? null,
      }));
      setActivities(activitiesWithTimers);
    } catch (error) {
      console.error('Error al cargar actividades:', error);
      toast.error('Error al cargar las actividades');
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    // Verificar autenticación
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/profesor/login');
      return;
    }
    
    // Cargar actividades al montar el componente
    handleStageClick(selectedStage);
  }, [navigate]);

  const handleBackToStages = () => {
    navigate('/admin/update-game');
  };

  const handleActivityClick = async (activity: Activity) => {
    // Cargar detalles completos de la actividad
    setLoadingActivity(true);
    try {
      const fullActivity = await challengesAPI.getActivityById(activity.id);
      
      // Convertir segundos a minutos y segundos para el temporizador
      const totalSeconds = fullActivity.timer_duration || 0;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      setTimerMinutes(minutes);
      setTimerSeconds(seconds);
      
      // Establecer la actividad seleccionada
      setSelectedActivity(fullActivity);

      // Si es la actividad de Presentación, cargar datos de gestión
      const isPresentation = fullActivity.name?.toLowerCase().includes('presentación') || 
                            fullActivity.name?.toLowerCase().includes('presentacion');
      
      if (isPresentation) {
        await loadWordSearchOptions(fullActivity.id);
        await loadAnagramWords();
        await loadChaosQuestions();
        await loadGeneralKnowledgeQuestions();
      }
    } catch (error: any) {
      console.error('Error al cargar actividad:', error);
      toast.error('Error al cargar la actividad');
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleBackToActivities = () => {
    setSelectedActivity(null);
    setTimerMinutes(0);
    setTimerSeconds(0);
    // Limpiar estados de gestión
    setWordSearchOptions([]);
    setAnagramWords([]);
    setChaosQuestions([]);
    setGeneralKnowledgeQuestions([]);
    setCreatingWordSearch(false);
    setCreatingAnagram(false);
    setCreatingChaos(false);
    setCreatingGeneralKnowledge(false);
    setEditingChaos(null);
    setEditingGeneralKnowledge(null);
  };

  const handleSaveActivity = async () => {
    if (!selectedActivity) return;

    // Validar temporizador si se está configurando
    if (timerMinutes > 0 || timerSeconds > 0) {
      if (timerSeconds < 0 || timerSeconds >= 60) {
        toast.error('Los segundos deben estar entre 0 y 59');
        return;
      }
      if (timerMinutes < 0) {
        toast.error('Los minutos no pueden ser negativos');
        return;
      }
    }

    setSavingActivity(true);

    try {
      // Convertir minutos y segundos a segundos totales
      const totalSeconds = timerMinutes * 60 + timerSeconds;
      const timerDuration = (timerMinutes === 0 && timerSeconds === 0) ? null : totalSeconds;
      
      // Actualizar la actividad
      await challengesAPI.updateActivity(selectedActivity.id, {
        timer_duration: timerDuration,
      });

      // Actualizar la lista de actividades localmente
      setActivities(activities.map(activity => {
        if (activity.id === selectedActivity.id) {
          return { ...activity, timer_duration: timerDuration };
        }
        return activity;
      }));

      // Actualizar la actividad seleccionada
      const updatedActivity = { ...selectedActivity, timer_duration: timerDuration };
      setSelectedActivity(updatedActivity);

      toast.success('Temporizador actualizado correctamente');
    } catch (error: any) {
      console.error('Error al guardar temporizador:', error);
      toast.error('Error al guardar el temporizador', {
        description: error.response?.data?.detail || 'Por favor intenta nuevamente',
      });
    } finally {
      setSavingActivity(false);
    }
  };

  // Funciones para gestión de Sopa de Letras
  const loadWordSearchOptions = async (activityId: number) => {
    setLoadingWordSearch(true);
    try {
      const options = await challengesAPI.getWordSearchOptions(activityId);
      setWordSearchOptions(Array.isArray(options) ? options : []);
    } catch (error) {
      console.error('Error al cargar sopas de letras:', error);
      toast.error('Error al cargar las sopas de letras');
      setWordSearchOptions([]);
    } finally {
      setLoadingWordSearch(false);
    }
  };

  const generateWordSearchPreview = async () => {
    const words = wordSearchWords.filter(w => w.trim()).map(w => w.trim().toUpperCase());
    if (words.length === 0) {
      toast.error('Ingresa al menos una palabra');
      return;
    }
    if (words.length > 5) {
      toast.error('Máximo 5 palabras');
      return;
    }
    // Validar longitud de palabras (máximo 8 caracteres)
    const invalidWords = words.filter(w => w.length > 8);
    if (invalidWords.length > 0) {
      toast.error(`Las palabras no pueden tener más de 8 caracteres: ${invalidWords.join(', ')}`);
      return;
    }
    setGeneratingPreview(true);
    try {
      const response = await challengesAPI.generateWordSearchPreview({
        words,
        name: wordSearchName || 'Sopa de Letras',
      });
      setWordSearchPreview(response.preview);
      toast.success('Preview generado');
    } catch (error: any) {
      toast.error('Error al generar preview', {
        description: error.response?.data?.error || 'Por favor intenta nuevamente',
      });
    } finally {
      setGeneratingPreview(false);
    }
  };

  const retryWordSearchPreview = async () => {
    // Reintentar con las mismas palabras pero generando un nuevo preview
    await generateWordSearchPreview();
  };

  const confirmWordSearch = async () => {
    if (!wordSearchPreview || !selectedActivity) return;
    try {
      await challengesAPI.confirmWordSearch({
        words: wordSearchWords.filter(w => w.trim()).map(w => w.trim().toUpperCase()),
        name: wordSearchName || 'Sopa de Letras',
        grid: wordSearchPreview.grid,
        word_positions: wordSearchPreview.wordPositions,
        seed: wordSearchPreview.seed,
        activity_id: selectedActivity.id,
      });
      toast.success('Sopa de letras guardada');
      setCreatingWordSearch(false);
      setWordSearchWords(['', '', '', '', '']);
      setWordSearchName('');
      setWordSearchPreview(null);
      await loadWordSearchOptions(selectedActivity.id);
    } catch (error: any) {
      toast.error('Error al guardar', {
        description: error.response?.data?.error || 'Por favor intenta nuevamente',
      });
    }
  };

  // Funciones para gestión de Anagrama
  const loadAnagramWords = async () => {
    setLoadingAnagram(true);
    try {
      const words = await challengesAPI.getAnagramWords();
      setAnagramWords(Array.isArray(words) ? words : []);
    } catch (error) {
      console.error('Error al cargar palabras de anagrama:', error);
      toast.error('Error al cargar las palabras');
      setAnagramWords([]);
    } finally {
      setLoadingAnagram(false);
    }
  };

  const generateAnagramPreview = (word: string) => {
    if (!word.trim()) return;
    const wordArray = word.toUpperCase().split('');
    for (let i = wordArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wordArray[i], wordArray[j]] = [wordArray[j], wordArray[i]];
    }
    setAnagramPreview(wordArray.join(''));
  };

  const retryAnagramPreview = () => {
    // Reintentar con la misma palabra pero generando una nueva versión desordenada
    if (newAnagramWord.trim()) {
      generateAnagramPreview(newAnagramWord);
    }
  };

  const confirmAnagram = async () => {
    if (!newAnagramWord.trim()) {
      toast.error('Ingresa una palabra');
      return;
    }
    try {
      await challengesAPI.createAnagramWord({ word: newAnagramWord.trim().toUpperCase() });
      toast.success('Palabra agregada');
      setCreatingAnagram(false);
      setNewAnagramWord('');
      setAnagramPreview('');
      await loadAnagramWords();
    } catch (error: any) {
      toast.error('Error al agregar palabra', {
        description: error.response?.data?.error || 'Por favor intenta nuevamente',
      });
    }
  };

  // Funciones para gestión de Preguntas del Caos
  const loadChaosQuestions = async () => {
    setLoadingChaos(true);
    try {
      const questions = await challengesAPI.getChaosQuestions();
      setChaosQuestions(Array.isArray(questions) ? questions : []);
    } catch (error) {
      console.error('Error al cargar preguntas del caos:', error);
      toast.error('Error al cargar las preguntas');
      setChaosQuestions([]);
    } finally {
      setLoadingChaos(false);
    }
  };

  const saveChaosQuestion = async () => {
    if (!newChaosQuestion.trim()) {
      toast.error('Ingresa una pregunta');
      return;
    }
    try {
      if (editingChaos) {
        await challengesAPI.updateChaosQuestion(editingChaos.id, {
          question: newChaosQuestion.trim(),
        });
        toast.success('Pregunta actualizada');
      } else {
        await challengesAPI.createChaosQuestion({
          question: newChaosQuestion.trim(),
        });
        toast.success('Pregunta agregada');
      }
      setCreatingChaos(false);
      setEditingChaos(null);
      setNewChaosQuestion('');
      await loadChaosQuestions();
    } catch (error: any) {
      toast.error(editingChaos ? 'Error al actualizar pregunta' : 'Error al agregar pregunta', {
        description: error.response?.data?.error || 'Por favor intenta nuevamente',
      });
    }
  };

  const handleEditChaos = (question: any) => {
    setEditingChaos(question);
    setNewChaosQuestion(question.question);
    setCreatingChaos(true);
  };

  // Funciones para gestión de Preguntas de Conocimiento General
  const loadGeneralKnowledgeQuestions = async () => {
    setLoadingGeneralKnowledge(true);
    try {
      const questions = await challengesAPI.getGeneralKnowledgeQuestions();
      setGeneralKnowledgeQuestions(Array.isArray(questions) ? questions : []);
    } catch (error) {
      console.error('Error al cargar preguntas:', error);
      toast.error('Error al cargar las preguntas');
      setGeneralKnowledgeQuestions([]);
    } finally {
      setLoadingGeneralKnowledge(false);
    }
  };

  const saveGeneralKnowledgeQuestion = async () => {
    if (!newGeneralKnowledgeQuestion.question.trim()) {
      toast.error('Ingresa la pregunta');
      return;
    }
    if (!newGeneralKnowledgeQuestion.option_a.trim() || 
        !newGeneralKnowledgeQuestion.option_b.trim() || 
        !newGeneralKnowledgeQuestion.option_c.trim() || 
        !newGeneralKnowledgeQuestion.option_d.trim()) {
      toast.error('Ingresa todas las opciones');
      return;
    }
    try {
      if (editingGeneralKnowledge) {
        await challengesAPI.updateGeneralKnowledgeQuestion(editingGeneralKnowledge.id, {
          question: newGeneralKnowledgeQuestion.question.trim(),
          option_a: newGeneralKnowledgeQuestion.option_a.trim(),
          option_b: newGeneralKnowledgeQuestion.option_b.trim(),
          option_c: newGeneralKnowledgeQuestion.option_c.trim(),
          option_d: newGeneralKnowledgeQuestion.option_d.trim(),
          correct_answer: newGeneralKnowledgeQuestion.correct_answer,
        });
        toast.success('Pregunta actualizada');
      } else {
        await challengesAPI.createGeneralKnowledgeQuestion({
          question: newGeneralKnowledgeQuestion.question.trim(),
          option_a: newGeneralKnowledgeQuestion.option_a.trim(),
          option_b: newGeneralKnowledgeQuestion.option_b.trim(),
          option_c: newGeneralKnowledgeQuestion.option_c.trim(),
          option_d: newGeneralKnowledgeQuestion.option_d.trim(),
          correct_answer: newGeneralKnowledgeQuestion.correct_answer,
        });
        toast.success('Pregunta agregada');
      }
      setCreatingGeneralKnowledge(false);
      setEditingGeneralKnowledge(null);
      setNewGeneralKnowledgeQuestion({
        question: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_answer: 0,
      });
      await loadGeneralKnowledgeQuestions();
    } catch (error: any) {
      toast.error(editingGeneralKnowledge ? 'Error al actualizar pregunta' : 'Error al agregar pregunta', {
        description: error.response?.data?.error || 'Por favor intenta nuevamente',
      });
    }
  };

  const handleEditGeneralKnowledge = (question: any) => {
    setEditingGeneralKnowledge(question);
    setNewGeneralKnowledgeQuestion({
      question: question.question,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_answer: question.correct_answer,
    });
    setCreatingGeneralKnowledge(true);
  };

  const isPresentationActivity = selectedActivity?.name?.toLowerCase().includes('presentación') || 
                                 selectedActivity?.name?.toLowerCase().includes('presentacion');

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      {/* Fondo - mismo que el panel del profesor */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]" />

      <div className="max-w-6xl mx-auto w-full relative z-10 p-4 sm:p-5 font-sans flex-1 flex flex-col">
        {/* Botón Volver */}
        <Button
          onClick={() => navigate('/admin/panel')}
          className="bg-white text-blue-900 hover:bg-gray-100 flex items-center gap-2 px-3 py-2 mb-4 rounded-lg shadow-md text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Panel</span>
        </Button>

        {/* Contenido */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8"
        >
          {selectedActivity === null ? (
            // Vista de lista de actividades
            <>
              {/* Header con botón volver */}
              <div className="flex items-center gap-3 mb-6">
                <Button
                  onClick={handleBackToStages}
                  variant="ghost"
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5 text-blue-900" />
                </Button>
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-blue-900">
                    Etapa 1 - Actividades
                  </h1>
                  <p className="text-gray-600 text-sm">
                    Lista de actividades de la Etapa 1
                  </p>
                </div>
              </div>

              {/* Lista de Actividades */}
              {loadingActivities ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">
                    No se encontraron actividades para esta etapa
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activities
                    .sort((a, b) => a.order_number - b.order_number)
                    .map((activity, index) => {
                      const IconComponent = getActivityIcon(activity.activity_type_name, activity.name);
                      const iconGradient = 'from-gray-400 to-gray-500';
                      
                      return (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, scale: 0.9, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleActivityClick(activity)}
                          className="group cursor-pointer overflow-hidden relative"
                        >
                          <div className="bg-white/95 backdrop-blur-sm rounded-xl p-5 py-6 shadow-lg border border-gray-200 group-hover:bg-gradient-to-br group-hover:from-pink-500 group-hover:to-purple-600 group-hover:border-0 transition-all">
                            <div className="relative z-10">
                              <div className={`bg-gradient-to-br ${iconGradient} group-hover:from-white group-hover:to-white/90 w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>
                                <IconComponent className="w-5 h-5 text-white group-hover:text-pink-500" />
                              </div>
                              
                              <h3 className="text-sm font-semibold text-blue-900 mb-1.5 group-hover:text-white">
                                {activity.name}
                              </h3>
                              
                              <p className="text-xs text-gray-600 mb-2 group-hover:text-white/90">
                                {activity.activity_type_name}
                              </p>

                              {activity.description && (
                                <p className="text-xs text-gray-500 mb-2.5 group-hover:text-white/80 line-clamp-2">
                                  {activity.description}
                                </p>
                              )}

                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-xs text-gray-400 group-hover:text-white/70">
                                  Orden: {activity.order_number}
                                </span>
                                <span className="text-xs text-pink-500 group-hover:text-white font-medium">
                                  Editar →
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              )}
            </>
          ) : (
            // Vista de detalle/edición de actividad
            <>
              {/* Header con botón volver */}
              <div className="flex items-center gap-3 mb-6">
                <Button
                  onClick={handleBackToActivities}
                  variant="ghost"
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5 text-blue-900" />
                </Button>
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-blue-900">
                    Editar Actividad
                  </h1>
                  <p className="text-gray-600 text-sm">
                    {selectedActivity?.name || 'Configuración de actividad'}
                  </p>
                </div>
              </div>

              {loadingActivity ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Temporizador - Editable */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-blue-900" />
                      <Label className="text-blue-900 font-semibold">
                        Temporizador
                      </Label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="timer_minutes" className="text-sm text-gray-700 mb-2 block">
                          Minutos
                        </Label>
                        <Input
                          id="timer_minutes"
                          type="number"
                          min="0"
                          max="999"
                          value={timerMinutes}
                          onChange={(e) => setTimerMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="timer_seconds" className="text-sm text-gray-700 mb-2 block">
                          Segundos
                        </Label>
                        <Input
                          id="timer_seconds"
                          type="number"
                          min="0"
                          max="59"
                          value={timerSeconds}
                          onChange={(e) => {
                            const value = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                            setTimerSeconds(value);
                          }}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          0-59 segundos
                        </p>
                      </div>
                    </div>
                    {timerMinutes > 0 || timerSeconds > 0 ? (
                      <div className="mt-4 bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">Duración total:</p>
                        <p className="text-lg font-bold text-blue-900">
                          {String(Math.floor((timerMinutes * 60 + timerSeconds) / 60)).padStart(2, '0')}:
                          {String((timerMinutes * 60 + timerSeconds) % 60).padStart(2, '0')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          ({timerMinutes * 60 + timerSeconds} segundos)
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-2">
                        Deja ambos en 0 para desactivar el temporizador
                      </p>
                    )}
                  </div>

                  {/* Secciones de Gestión para Presentación */}
                  {isPresentationActivity && (
                    <div className="space-y-6">
                      {/* Sopa de Letras */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Search className="w-5 h-5 text-blue-900" />
                            <Label className="text-blue-900 font-semibold text-lg">Sopa de Letras</Label>
                          </div>
                          {!creatingWordSearch && (
                            <Button
                              onClick={() => {
                                setCreatingWordSearch(true);
                                setWordSearchWords(['', '', '', '', '']);
                                setWordSearchName('');
                                setWordSearchPreview(null);
                              }}
                              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Agregar
                            </Button>
                          )}
                        </div>

                        {creatingWordSearch ? (
                          <div className="space-y-4 bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-blue-900">
                                {wordSearchPreview ? 'Confirmar Sopa de Letras' : 'Nueva Sopa de Letras'}
                              </h3>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCreatingWordSearch(false);
                                  setWordSearchWords(['', '', '', '', '']);
                                  setWordSearchName('');
                                  setWordSearchPreview(null);
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            {!wordSearchPreview ? (
                              <>
                                <div>
                                  <Label className="text-sm text-gray-700 mb-2 block">
                                    Nombre de la Sopa de Letras
                                  </Label>
                                  <Input
                                    value={wordSearchName}
                                    onChange={(e) => setWordSearchName(e.target.value)}
                                    placeholder="Ej: Sopa de Letras 1"
                                    maxLength={100}
                                  />
                                </div>

                                <div>
                                  <Label className="text-sm text-gray-700 mb-2 block">
                                    Palabras (máximo 5, máximo 8 caracteres cada una)
                                  </Label>
                                  {wordSearchWords.map((word, index) => (
                                    <div key={index} className="mb-2">
                                      <Input
                                        value={word}
                                        onChange={(e) => {
                                          const newWords = [...wordSearchWords];
                                          newWords[index] = e.target.value;
                                          setWordSearchWords(newWords);
                                        }}
                                        placeholder={`Palabra ${index + 1}`}
                                        maxLength={8}
                                      />
                                    </div>
                                  ))}
                                </div>

                                <Button
                                  onClick={generateWordSearchPreview}
                                  disabled={generatingPreview}
                                  className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                                >
                                  {generatingPreview ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Generando...
                                    </>
                                  ) : (
                                    <>
                                      <Search className="w-4 h-4 mr-2" />
                                      Generar Preview
                                    </>
                                  )}
                                </Button>
                              </>
                            ) : (
                              <>
                                <WordSearchPreview
                                  grid={wordSearchPreview.grid}
                                  wordPositions={wordSearchPreview.wordPositions}
                                  words={wordSearchWords.filter(w => w.trim()).map(w => w.trim().toUpperCase())}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => setWordSearchPreview(null)}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    Volver
                                  </Button>
                                  <Button
                                    onClick={retryWordSearchPreview}
                                    disabled={generatingPreview}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    {generatingPreview ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generando...
                                      </>
                                    ) : (
                                      <>
                                        <RotateCw className="w-4 h-4 mr-2" />
                                        Reintentar
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    onClick={confirmWordSearch}
                                    className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                                  >
                                    <Save className="w-4 h-4 mr-2" />
                                    Confirmar y Guardar
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : null}

                        {loadingWordSearch ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                          </div>
                        ) : wordSearchOptions.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No hay sopas de letras disponibles</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {wordSearchOptions.map((option) => (
                              <motion.div
                                key={option.id}
                                className="bg-white rounded-lg p-4 border border-gray-200"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h4 className="font-semibold text-blue-900">{option.name}</h4>
                                    <p className="text-xs text-gray-600">
                                      {Array.isArray(option.words) ? option.words.length : 0} palabras
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      if (window.confirm(`¿Estás seguro de eliminar "${option.name}"?`)) {
                                        try {
                                          await challengesAPI.deleteWordSearchOption(option.id);
                                          toast.success('Sopa de letras eliminada');
                                          if (selectedActivity) {
                                            await loadWordSearchOptions(selectedActivity.id);
                                          }
                                        } catch (error: any) {
                                          toast.error('Error al eliminar', {
                                            description: error.response?.data?.error || 'Por favor intenta nuevamente',
                                          });
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                                {Array.isArray(option.words) && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {option.words.slice(0, 5).map((word: string, idx: number) => (
                                      <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                        {word}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Anagrama */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Gamepad2 className="w-5 h-5 text-blue-900" />
                            <Label className="text-blue-900 font-semibold text-lg">Anagrama</Label>
                          </div>
                          {!creatingAnagram && (
                            <Button
                              onClick={() => {
                                setCreatingAnagram(true);
                                setNewAnagramWord('');
                                setAnagramPreview('');
                              }}
                              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Agregar
                            </Button>
                          )}
                        </div>

                        {creatingAnagram ? (
                          <div className="space-y-4 bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-blue-900">Nueva Palabra de Anagrama</h3>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCreatingAnagram(false);
                                  setNewAnagramWord('');
                                  setAnagramPreview('');
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            <div>
                              <Label className="text-sm text-gray-700 mb-2 block">
                                Palabra
                              </Label>
                              <Input
                                value={newAnagramWord}
                                onChange={(e) => {
                                  setNewAnagramWord(e.target.value);
                                  generateAnagramPreview(e.target.value);
                                }}
                                placeholder="Ej: EMPRENDER"
                                maxLength={100}
                              />
                              {anagramPreview && (
                                <div className="mt-2 p-2 bg-gray-100 rounded">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs text-gray-600">Preview (desordenada):</p>
                                    <Button
                                      onClick={retryAnagramPreview}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                    >
                                      <RotateCw className="w-3 h-3 mr-1" />
                                      Reintentar
                                    </Button>
                                  </div>
                                  <p className="text-lg font-bold text-blue-900">{anagramPreview}</p>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  setCreatingAnagram(false);
                                  setNewAnagramWord('');
                                  setAnagramPreview('');
                                }}
                                variant="outline"
                                className="flex-1"
                              >
                                Cancelar
                              </Button>
                              <Button
                                onClick={confirmAnagram}
                                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Guardar
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {loadingAnagram ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                          </div>
                        ) : anagramWords.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No hay palabras de anagrama disponibles</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {anagramWords.map((word) => (
                              <motion.div
                                key={word.id}
                                className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between"
                              >
                                <div>
                                  <p className="font-semibold text-blue-900">{word.word}</p>
                                  {word.scrambled_word && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      Desordenada: {word.scrambled_word}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    if (window.confirm(`¿Estás seguro de eliminar "${word.word}"?`)) {
                                      try {
                                        await challengesAPI.deleteAnagramWord(word.id);
                                        toast.success('Palabra eliminada');
                                        await loadAnagramWords();
                                      } catch (error: any) {
                                        toast.error('Error al eliminar', {
                                          description: error.response?.data?.error || 'Por favor intenta nuevamente',
                                        });
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Preguntas del Caos */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="w-5 h-5 text-blue-900" />
                            <Label className="text-blue-900 font-semibold text-lg">Preguntas del Caos</Label>
                          </div>
                          {!creatingChaos && (
                            <Button
                              onClick={() => {
                                setCreatingChaos(true);
                                setEditingChaos(null);
                                setNewChaosQuestion('');
                              }}
                              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Agregar
                            </Button>
                          )}
                        </div>

                        {creatingChaos ? (
                          <div className="space-y-4 bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-blue-900">
                                {editingChaos ? 'Editar Pregunta del Caos' : 'Nueva Pregunta del Caos'}
                              </h3>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCreatingChaos(false);
                                  setEditingChaos(null);
                                  setNewChaosQuestion('');
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            <div>
                              <Label className="text-sm text-gray-700 mb-2 block">
                                Pregunta
                              </Label>
                              <Textarea
                                value={newChaosQuestion}
                                onChange={(e) => setNewChaosQuestion(e.target.value)}
                                placeholder="Ej: ¿Cuál es el mayor desafío que enfrentas como emprendedor?"
                                rows={3}
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  setCreatingChaos(false);
                                  setEditingChaos(null);
                                  setNewChaosQuestion('');
                                }}
                                variant="outline"
                                className="flex-1"
                              >
                                Cancelar
                              </Button>
                              <Button
                                onClick={saveChaosQuestion}
                                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                {editingChaos ? 'Actualizar' : 'Guardar'}
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {loadingChaos ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                          </div>
                        ) : chaosQuestions.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No hay preguntas del caos disponibles</p>
                        ) : (
                          <div className="space-y-2">
                            {chaosQuestions.map((question) => (
                              <motion.div
                                key={question.id}
                                className="bg-white rounded-lg p-4 border border-gray-200 flex items-start justify-between"
                              >
                                <p className="text-sm text-gray-700 flex-1">{question.question}</p>
                                <div className="flex gap-2 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditChaos(question)}
                                  >
                                    <Edit className="w-4 h-4 text-blue-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      if (window.confirm('¿Estás seguro de eliminar esta pregunta?')) {
                                        try {
                                          await challengesAPI.deleteChaosQuestion(question.id);
                                          toast.success('Pregunta eliminada');
                                          await loadChaosQuestions();
                                        } catch (error: any) {
                                          toast.error('Error al eliminar', {
                                            description: error.response?.data?.error || 'Por favor intenta nuevamente',
                                          });
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Preguntas de Conocimiento General */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-blue-900" />
                            <Label className="text-blue-900 font-semibold text-lg">Preguntas de Conocimiento General</Label>
                          </div>
                          {!creatingGeneralKnowledge && (
                            <Button
                              onClick={() => {
                                setCreatingGeneralKnowledge(true);
                                setEditingGeneralKnowledge(null);
                                setNewGeneralKnowledgeQuestion({
                                  question: '',
                                  option_a: '',
                                  option_b: '',
                                  option_c: '',
                                  option_d: '',
                                  correct_answer: 0,
                                });
                              }}
                              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Agregar
                            </Button>
                          )}
                        </div>

                        {creatingGeneralKnowledge ? (
                          <div className="space-y-4 bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-blue-900">
                                {editingGeneralKnowledge ? 'Editar Pregunta' : 'Nueva Pregunta'}
                              </h3>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCreatingGeneralKnowledge(false);
                                  setEditingGeneralKnowledge(null);
                                  setNewGeneralKnowledgeQuestion({
                                    question: '',
                                    option_a: '',
                                    option_b: '',
                                    option_c: '',
                                    option_d: '',
                                    correct_answer: 0,
                                  });
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            <div>
                              <Label className="text-sm text-gray-700 mb-2 block">
                                Pregunta
                              </Label>
                              <Textarea
                                value={newGeneralKnowledgeQuestion.question}
                                onChange={(e) => setNewGeneralKnowledgeQuestion({
                                  ...newGeneralKnowledgeQuestion,
                                  question: e.target.value,
                                })}
                                placeholder="Ej: ¿Cuál es la capital de Francia?"
                                rows={2}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm text-gray-700 mb-2 block">Opción A</Label>
                                <Input
                                  value={newGeneralKnowledgeQuestion.option_a}
                                  onChange={(e) => setNewGeneralKnowledgeQuestion({
                                    ...newGeneralKnowledgeQuestion,
                                    option_a: e.target.value,
                                  })}
                                  placeholder="Opción A"
                                />
                              </div>
                              <div>
                                <Label className="text-sm text-gray-700 mb-2 block">Opción B</Label>
                                <Input
                                  value={newGeneralKnowledgeQuestion.option_b}
                                  onChange={(e) => setNewGeneralKnowledgeQuestion({
                                    ...newGeneralKnowledgeQuestion,
                                    option_b: e.target.value,
                                  })}
                                  placeholder="Opción B"
                                />
                              </div>
                              <div>
                                <Label className="text-sm text-gray-700 mb-2 block">Opción C</Label>
                                <Input
                                  value={newGeneralKnowledgeQuestion.option_c}
                                  onChange={(e) => setNewGeneralKnowledgeQuestion({
                                    ...newGeneralKnowledgeQuestion,
                                    option_c: e.target.value,
                                  })}
                                  placeholder="Opción C"
                                />
                              </div>
                              <div>
                                <Label className="text-sm text-gray-700 mb-2 block">Opción D</Label>
                                <Input
                                  value={newGeneralKnowledgeQuestion.option_d}
                                  onChange={(e) => setNewGeneralKnowledgeQuestion({
                                    ...newGeneralKnowledgeQuestion,
                                    option_d: e.target.value,
                                  })}
                                  placeholder="Opción D"
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="text-sm text-gray-700 mb-2 block">
                                Respuesta Correcta
                              </Label>
                              <select
                                value={newGeneralKnowledgeQuestion.correct_answer}
                                onChange={(e) => setNewGeneralKnowledgeQuestion({
                                  ...newGeneralKnowledgeQuestion,
                                  correct_answer: parseInt(e.target.value),
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              >
                                <option value={0}>A</option>
                                <option value={1}>B</option>
                                <option value={2}>C</option>
                                <option value={3}>D</option>
                              </select>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  setCreatingGeneralKnowledge(false);
                                  setEditingGeneralKnowledge(null);
                                  setNewGeneralKnowledgeQuestion({
                                    question: '',
                                    option_a: '',
                                    option_b: '',
                                    option_c: '',
                                    option_d: '',
                                    correct_answer: 0,
                                  });
                                }}
                                variant="outline"
                                className="flex-1"
                              >
                                Cancelar
                              </Button>
                              <Button
                                onClick={saveGeneralKnowledgeQuestion}
                                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                {editingGeneralKnowledge ? 'Actualizar' : 'Guardar'}
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {loadingGeneralKnowledge ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                          </div>
                        ) : generalKnowledgeQuestions.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No hay preguntas disponibles</p>
                        ) : (
                          <div className="space-y-4">
                            {generalKnowledgeQuestions.map((question) => (
                              <motion.div
                                key={question.id}
                                className="bg-white rounded-lg p-4 border border-gray-200"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <p className="font-semibold text-blue-900 flex-1">{question.question}</p>
                                  <div className="flex gap-2 ml-4">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditGeneralKnowledge(question)}
                                    >
                                      <Edit className="w-4 h-4 text-blue-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        if (window.confirm('¿Estás seguro de eliminar esta pregunta?')) {
                                          try {
                                            await challengesAPI.deleteGeneralKnowledgeQuestion(question.id);
                                            toast.success('Pregunta eliminada');
                                            await loadGeneralKnowledgeQuestions();
                                          } catch (error: any) {
                                            toast.error('Error al eliminar', {
                                              description: error.response?.data?.error || 'Por favor intenta nuevamente',
                                            });
                                          }
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div className={`p-2 rounded ${question.correct_answer === 0 ? 'bg-green-100 text-green-800 font-semibold' : 'bg-gray-50'}`}>
                                    A) {question.option_a}
                                  </div>
                                  <div className={`p-2 rounded ${question.correct_answer === 1 ? 'bg-green-100 text-green-800 font-semibold' : 'bg-gray-50'}`}>
                                    B) {question.option_b}
                                  </div>
                                  <div className={`p-2 rounded ${question.correct_answer === 2 ? 'bg-green-100 text-green-800 font-semibold' : 'bg-gray-50'}`}>
                                    C) {question.option_c}
                                  </div>
                                  <div className={`p-2 rounded ${question.correct_answer === 3 ? 'bg-green-100 text-green-800 font-semibold' : 'bg-gray-50'}`}>
                                    D) {question.option_d}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Botones */}
                  <div className="flex gap-3 justify-end pt-4 border-t">
                    <Button
                      onClick={handleBackToActivities}
                      variant="outline"
                      disabled={savingActivity}
                      className="px-6"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSaveActivity}
                      disabled={savingActivity}
                      className="px-6 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                    >
                      {savingActivity ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Guardar Temporizador
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

