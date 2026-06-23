import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings, Loader2, Target, Layers, Zap, Sparkles, MoreHorizontal, ChevronLeft, FileText, Video, Users, Gamepad2, BookOpen, Presentation, Trophy, Map, MessageCircle, PenTool, Mic, GraduationCap, HelpCircle, FileCheck, ClipboardList, X, Clock, Save, Edit, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { challengesAPI, academicAPI } from '@/services';
import { Plus, Trash2, Search } from 'lucide-react';
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

interface OtherScreen {
  id: string;
  name: string;
  description: string;
  icon: any;
  gradient: string;
}

interface Stage {
  id: number;
  name: string;
  icon: any;
  gradient: string;
  description: string;
}

export function UpdateGameEtapa3() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedStage] = useState<number>(3);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  // Estado para la vista de detalle de actividad
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  
  // Estado para el temporizador de presentaci+�n individual (solo para Presentaci+�n del Pitch)
  const [presentationTimerMinutes, setPresentationTimerMinutes] = useState(0);
  const [presentationTimerSeconds, setPresentationTimerSeconds] = useState(90);
  
  // Estado del formulario de edici+�n
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    order_number: 0,
    timer_duration: null as number | null,
    is_active: true,
  });
  const [timerMinutes, setTimerMinutes] = useState<number>(0);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [savingActivity, setSavingActivity] = useState(false);

  // Estados para gesti+�n de Temas y Desafíos
  const [topics, setTopics] = useState<any[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<any | null>(null);
  const [loadingTopic, setLoadingTopic] = useState(false);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<any | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [faculties, setFaculties] = useState<any[]>([]);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
  const [savingChallenge, setSavingChallenge] = useState(false);

  // Estados para gesti+�n de Minijuego
  const [wordSearchOptions, setWordSearchOptions] = useState<any[]>([]);
  const [loadingWordSearch, setLoadingWordSearch] = useState(false);
  const [creatingWordSearch, setCreatingWordSearch] = useState(false);
  const [wordSearchWords, setWordSearchWords] = useState<string[]>(['']);
  const [wordSearchName, setWordSearchName] = useState('');
  const [wordSearchPreview, setWordSearchPreview] = useState<any>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  const [anagramWords, setAnagramWords] = useState<any[]>([]);
  const [loadingAnagram, setLoadingAnagram] = useState(false);
  const [creatingAnagram, setCreatingAnagram] = useState(false);
  const [newAnagramWord, setNewAnagramWord] = useState('');
  const [anagramPreview, setAnagramPreview] = useState<string>('');

  const [generalKnowledgeQuestions, setGeneralKnowledgeQuestions] = useState<any[]>([]);
  const [loadingGeneralKnowledge, setLoadingGeneralKnowledge] = useState(false);
  const [creatingGeneralKnowledge, setCreatingGeneralKnowledge] = useState(false);
  const [editingGeneralKnowledge, setEditingGeneralKnowledge] = useState<any | null>(null);

  // Estados para gesti+�n de Presentaci+�n
  const [chaosQuestions, setChaosQuestions] = useState<any[]>([]);
  const [loadingChaos, setLoadingChaos] = useState(false);
  const [creatingChaos, setCreatingChaos] = useState(false);
  const [editingChaos, setEditingChaos] = useState<any | null>(null);

  const [presentationGeneralKnowledge, setPresentationGeneralKnowledge] = useState<any[]>([]);
  const [loadingPresentationGeneralKnowledge, setLoadingPresentationGeneralKnowledge] = useState(false);
  const [creatingPresentationGeneralKnowledge, setCreatingPresentationGeneralKnowledge] = useState(false);
  const [editingPresentationGeneralKnowledge, setEditingPresentationGeneralKnowledge] = useState<any | null>(null);

  useEffect(() => {
    // Verificar autenticaci�n
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/profesor/login');
      return;
    }
    
    // Cargar actividades de la Etapa 3 autom�ticamente
    const loadActivities = async () => {
      setLoadingActivities(true);
      try {
        const activitiesData = await challengesAPI.getActivities({ stage: 3, include_inactive: 'true' });
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
    
    loadActivities();
  }, [navigate]);

  const stages: Stage[] = [
    {
      id: 1,
      name: 'Etapa 3',
      icon: Target,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Configurar primera etapa',
    },
    {
      id: 2,
      name: 'Etapa 2',
      icon: Layers,
      gradient: 'from-purple-500 to-violet-500',
      description: 'Configurar segunda etapa',
    },
    {
      id: 3,
      name: 'Etapa 3',
      icon: Zap,
      gradient: 'from-orange-500 to-red-500',
      description: 'Configurar tercera etapa',
    },
    {
      id: 4,
      name: 'Etapa 4',
      icon: Sparkles,
      gradient: 'from-pink-500 to-rose-500',
      description: 'Configurar cuarta etapa',
    },
    {
      id: 'otros',
      name: 'Otros',
      icon: MoreHorizontal,
      gradient: 'from-gray-500 to-slate-600',
      description: 'Otras configuraciones',
    },
  ];

  // Mapeo de tipos de actividad a iconos (basado en nombres conocidos)
  const getActivityIcon = (activityTypeName: string, activityName: string) => {
    const lowerName = (activityName || '').toLowerCase();
    const lowerType = (activityTypeName || '').toLowerCase();
    
    if (lowerName.includes('video') || lowerName.includes('institucional')) return Video;
    if (lowerName.includes('personaliz') || lowerType.includes('personaliz')) return Users;
    if (lowerName.includes('minijuego') || lowerName.includes('minijuego') || lowerType.includes('minijuego')) return Gamepad2;
    if (lowerName.includes('instructivo') || lowerType.includes('instructivo')) return BookOpen;
    if (lowerName.includes('presentacion') || lowerType.includes('presentacion')) return Presentation;
    if (lowerName.includes('resultado') || lowerType.includes('resultado')) return Trophy;
    if (lowerName.includes('mapa') || lowerName.includes('empatia') || lowerType.includes('bubble')) return Map;
    if (lowerName.includes('tema') || lowerName.includes('desafio') || lowerType.includes('tema')) return Target;
    if (lowerName.includes('prototipo') || lowerType.includes('prototipo')) return PenTool;
    if (lowerName.includes('pitch') || lowerType.includes('pitch')) return Mic;
    if (lowerName.includes('formulario') || lowerType.includes('formulario')) return FileText;
    
    return FileText; // Icono por defecto
  };

  // Lista de pantallas "otras" que no son parte de las etapas
  const otherScreens: OtherScreen[] = [
    {
      id: 'objetivos',
      name: 'Objetivos de Juego',
      description: 'Configurar objetivos de aprendizaje del juego',
      icon: Target,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'tutorial',
      name: 'Tutorial',
      description: 'Configurar contenido del tutorial',
      icon: HelpCircle,
      gradient: 'from-purple-500 to-violet-500',
    },
    {
      id: 'video-institucional',
      name: 'Video Institucional',
      description: 'Configurar video institucional',
      icon: Video,
      gradient: 'from-orange-500 to-red-500',
    },
    {
      id: 'reflexion',
      name: 'Reflexión',
      description: 'Configurar pantalla de reflexión',
      icon: MessageCircle,
      gradient: 'from-pink-500 to-rose-500',
    },
    {
      id: 'encuesta-reflexion',
      name: 'Encuesta de Reflexión',
      description: 'Configurar encuesta de reflexión',
      icon: ClipboardList,
      gradient: 'from-emerald-500 to-teal-600',
    },
  ];

  const handleStageClick = async (stageId: number | string) => {
    if (stageId === 'otros') {
      // Para "Otros", usamos una lista est+�tica de pantallas
      setSelectedStage('otros');
      // Convertir otherScreens a formato similar a Activity para reutilizar la vista
      const otherScreensAsActivities = otherScreens.map((screen, index) => ({
        id: screen.id,
        name: screen.name,
        description: screen.description,
        order_number: index + 1,
        activity_type_name: 'Pantalla General',
      }));
      setActivities(otherScreensAsActivities as any);
      return;
    }

    setSelectedStage(stageId);
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

  const handleBackToStages = () => {
    navigate('/admin/update-game');
  };

  const handleActivityClick = async (activity: Activity | OtherScreen | any) => {
    // Solo permitir editar actividades reales (no pantallas "otras")
    if (selectedStage === 'otros') {
      toast.info(`Editar ${activity.name}`, {
        description: 'La funcionalidad de edici+�n estar+� disponible pr+�ximamente',
      });
      return;
    }

    // Si es la tarjeta unificada de tema y desafío, usar la actividad de tema
    let activityIdToLoad = activity.id;
    if (activity._isUnified && activity._topicActivityId) {
      activityIdToLoad = activity._topicActivityId;
    }

    // Cargar detalles completos de la actividad
    setLoadingActivity(true);
    try {
      const fullActivity = await challengesAPI.getActivityById(activityIdToLoad);
      
      // Si es la tarjeta unificada, también cargar la actividad de desafío
      let challengeActivity = null;
      if (activity._isUnified && activity._challengeActivityId) {
        try {
          challengeActivity = await challengesAPI.getActivityById(activity._challengeActivityId);
        } catch (error) {
          console.error('Error al cargar actividad de desafío:', error);
        }
      }
      
      // Convertir segundos a minutos y segundos para el temporizador
      const totalSeconds = fullActivity.timer_duration || 0;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      setTimerMinutes(minutes);
      setTimerSeconds(seconds);
      
      // Si es "Presentaci+�n del Pitch", cargar el temporizador de presentaci+�n individual
      const isPresentationPitch = fullActivity.name?.toLowerCase().includes('presentaci+�n') || 
                                  fullActivity.name?.toLowerCase().includes('presentacion');
      if (isPresentationPitch && fullActivity.config_data?.presentation_duration) {
        const presDuration = fullActivity.config_data.presentation_duration;
        setPresentationTimerMinutes(Math.floor(presDuration / 60));
        setPresentationTimerSeconds(presDuration % 60);
      } else if (isPresentationPitch) {
        // Valor por defecto: 1:30 (90 segundos)
        setPresentationTimerMinutes(1);
        setPresentationTimerSeconds(30);
      }
      
      // Establecer datos del formulario
      setFormData({
        name: fullActivity.name || '',
        description: fullActivity.description || '',
        order_number: fullActivity.order_number || 0,
        timer_duration: fullActivity.timer_duration || null,
        is_active: fullActivity.is_active !== undefined ? fullActivity.is_active : true,
      });
      
      // Guardar informaci+�n adicional si es unificada
      const activityToSet = {
        ...fullActivity,
        _isUnified: activity._isUnified || false,
        _challengeActivityId: activity._challengeActivityId || null,
        _challengeActivity: challengeActivity,
      };
      
      setSelectedActivity(activityToSet);
      
      // Si es la actividad "Seleccionar Tema y Desafío", cargar temas y facultades
      if (activity._isUnified || fullActivity.name?.toLowerCase().includes('tema') || 
          fullActivity.name?.toLowerCase().includes('seleccionar')) {
        await loadTopics();
        await loadFaculties();
      }
      
      // Cargar datos seg+�n el tipo de actividad
      const activityName = (fullActivity.name || '').toLowerCase();
      const activityType = (fullActivity.activity_type_name || '').toLowerCase();
      
      if (activityName.includes('minijuego') || activityType.includes('minijuego')) {
        // Cargar datos del minijuego
        await loadWordSearchOptions(fullActivity.id);
        await loadAnagramWords();
        await loadGeneralKnowledgeQuestions();
      } else if (activityName.includes('presentacion') || activityName.includes('presentaci+�n')) {
        // Cargar datos de presentaci+�n
        await loadChaosQuestions();
        await loadGeneralKnowledgeQuestions();
        setPresentationGeneralKnowledge(generalKnowledgeQuestions);
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
    setFormData({
      name: '',
      description: '',
      order_number: 0,
      timer_duration: null,
      is_active: true,
    });
    setTimerMinutes(0);
    setTimerSeconds(0);
    setPresentationTimerMinutes(1);
    setPresentationTimerSeconds(30);
  };

  const handleSaveActivity = async () => {
    if (!selectedActivity) return;

    // Validar temporizador si se est+� configurando
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
      
      // Si es la actividad unificada, solo actualizar la actividad de "Seleccionar Tema"
      // porque esa es la que se usa como current_activity en el juego y de donde se obtiene el temporizador
      if ((selectedActivity as any)._isUnified) {
        // Solo actualizar la actividad de "Seleccionar Tema" (selectedActivity.id es el ID de tema)
        await challengesAPI.updateActivity(selectedActivity.id, {
          timer_duration: timerDuration,
        });

        // Actualizar la lista de actividades localmente solo para la actividad de tema
        setActivities(activities.map(activity => {
          if (activity.id === selectedActivity.id) {
            return { ...activity, timer_duration: timerDuration };
          }
          return activity;
        }));

        toast.success('Temporizador actualizado correctamente');
      } else {
        // Verificar si es "Presentaci+�n del Pitch"
        const isPresentationPitch = selectedActivity.name?.toLowerCase().includes('presentaci+�n') || 
                                    selectedActivity.name?.toLowerCase().includes('presentacion');
        
        const updateData: any = {};
        
        if (isPresentationPitch) {
          // Solo guardar el temporizador de presentaci+�n individual en config_data
          const presentationDuration = presentationTimerMinutes * 60 + presentationTimerSeconds;
          const currentConfigData = selectedActivity.config_data || {};
          updateData.config_data = {
            ...currentConfigData,
            presentation_duration: presentationDuration,
          };
        } else {
          // Para otras actividades, guardar timer_duration normalmente
          updateData.timer_duration = timerDuration;
        }
        
        // Actualizar la actividad
        await challengesAPI.updateActivity(selectedActivity.id, updateData);

        // Actualizar la lista de actividades localmente
        setActivities(activities.map(activity => {
          if (activity.id === selectedActivity.id) {
            const updated = { ...activity };
            if (isPresentationPitch && updateData.config_data) {
              updated.config_data = updateData.config_data;
            } else if (!isPresentationPitch) {
              updated.timer_duration = timerDuration;
            }
            return updated;
          }
          return activity;
        }));

        toast.success(isPresentationPitch ? 'Temporizador de presentaci+�n actualizado correctamente' : 'Temporizador actualizado correctamente');
      }

      // Actualizar la actividad seleccionada
      const updatedActivity = { ...selectedActivity };
      const isPresentationPitch = selectedActivity.name?.toLowerCase().includes('presentaci+�n') || 
                                  selectedActivity.name?.toLowerCase().includes('presentacion');
      if (isPresentationPitch && updateData.config_data) {
        updatedActivity.config_data = updateData.config_data;
      } else if (!isPresentationPitch) {
        updatedActivity.timer_duration = timerDuration;
      }
      setSelectedActivity(updatedActivity);
    } catch (error: any) {
      console.error('Error al guardar temporizador:', error);
      toast.error('Error al guardar el temporizador', {
        description: error.response?.data?.detail || 'Por favor intenta nuevamente',
      });
    } finally {
      setSavingActivity(false);
    }
  };

  // Funciones para gesti+�n de Temas y Desafíos
  const loadTopics = async () => {
    setLoadingTopics(true);
    try {
      const topicsData = await challengesAPI.getTopics({ include_inactive: 'true' });
      setTopics(Array.isArray(topicsData) ? topicsData : []);
    } catch (error) {
      console.error('Error al cargar temas:', error);
      toast.error('Error al cargar los temas');
      setTopics([]);
    } finally {
      setLoadingTopics(false);
    }
  };

  const loadFaculties = async () => {
    try {
      const facultiesData = await academicAPI.getFaculties();
      setFaculties(Array.isArray(facultiesData) ? facultiesData : []);
    } catch (error) {
      console.error('Error al cargar facultades:', error);
      toast.error('Error al cargar las facultades');
    }
  };

  const loadChallengesForTopic = async (topicId: number) => {
    setLoadingChallenges(true);
    try {
      const challengesData = await challengesAPI.getChallenges({ 
        topic: topicId, 
        include_inactive: 'true' 
      });
      setChallenges(Array.isArray(challengesData) ? challengesData : []);
    } catch (error) {
      console.error('Error al cargar desafíos:', error);
      toast.error('Error al cargar los desafíos');
      setChallenges([]);
    } finally {
      setLoadingChallenges(false);
    }
  };

  const handleSelectTopic = async (topic: any) => {
    // Cargar los detalles completos del tema para asegurar que tenemos todas las relaciones
    try {
      const fullTopic = await challengesAPI.getTopicById(topic.id);
      setSelectedTopic(fullTopic);
    } catch (error) {
      console.error('Error al cargar tema:', error);
      toast.error('Error al cargar el tema');
      setSelectedTopic(topic); // Usar el b+�sico si falla
    }
    setSelectedChallenge(null);
    await loadChallengesForTopic(topic.id);
  };

  const handleBackToTopics = () => {
    setSelectedTopic(null);
    setSelectedChallenge(null);
    setChallenges([]);
  };

  const handleSelectChallenge = async (challenge: any) => {
    // Cargar los detalles completos del desafío
    try {
      const fullChallenge = await challengesAPI.getChallengeById(challenge.id);
      setSelectedChallenge(fullChallenge);
    } catch (error) {
      console.error('Error al cargar desafío:', error);
      toast.error('Error al cargar el desafío');
      setSelectedChallenge(challenge); // Usar el b+�sico si falla
    }
  };

  const handleBackToChallenges = () => {
    setSelectedChallenge(null);
  };

  // Funciones para gesti+�n de Minijuego - Sopa de Letras
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
      toast.error('M+�ximo 5 palabras');
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
      setWordSearchWords(['']);
      setWordSearchName('');
      setWordSearchPreview(null);
      await loadWordSearchOptions(selectedActivity.id);
    } catch (error: any) {
      toast.error('Error al guardar', {
        description: error.response?.data?.error || 'Por favor intenta nuevamente',
      });
    }
  };

  // Funciones para gesti+�n de Anagrama
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
    // Desordenar la palabra
    const wordArray = word.toUpperCase().split('');
    for (let i = wordArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wordArray[i], wordArray[j]] = [wordArray[j], wordArray[i]];
    }
    setAnagramPreview(wordArray.join(''));
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

  // Funciones para gesti+�n de Preguntas Conocimiento General
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

  // Funciones para gesti+�n de Preguntas del Caos
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

  // Funci+�n para obtener el icono correcto dependiendo si es una actividad o pantalla "otra"
  const getIconForActivity = (activity: Activity) => {
    // Si es una pantalla "otra", usar el icono espec+�fico
    if (selectedStage === 'otros') {
      const screen = otherScreens.find(s => s.id === activity.id);
      if (screen) return screen.icon;
    }
    // Si no, usar el icono basado en el tipo/nombre
    return getActivityIcon(activity.activity_type_name, activity.name);
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      {/* Fondo - mismo que el panel del profesor */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]" />

      <div className="max-w-6xl mx-auto w-full relative z-10 p-4 sm:p-5 font-sans flex-1 flex flex-col">
        {/* Bot+�n Volver */}
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
              {/* Header con bot+�n volver */}
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
                    Etapa 3 - Actividades
                  </h1>
                  <p className="text-gray-600 text-sm">
                    Lista de actividades de la Etapa 3
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
                  {(() => {
                    // Para Etapa 2, unificar "Seleccionar Tema" y "Ver el Desaf�o" en una sola tarjeta
                    if (false) { // Etapa 3 no necesita esta l�gica
                      const sortedActivities = [...activities].sort((a, b) => a.order_number - b.order_number);
                      const topicActivity = sortedActivities.find((a: Activity) => 
                        a.name.toLowerCase().includes('tema') || a.name.toLowerCase().includes('seleccionar')
                      );
                      const challengeActivity = sortedActivities.find((a: Activity) => 
                        a.name.toLowerCase().includes('desafío') || a.name.toLowerCase().includes('desafio') || 
                        a.name.toLowerCase().includes('ver el') || a.name.toLowerCase().includes('ver desaf')
                      );
                      
                      // Filtrar las otras actividades (excluir tema y desafío)
                      const otherActivities = sortedActivities.filter((a: Activity) => 
                        a.id !== topicActivity?.id && a.id !== challengeActivity?.id
                      );
                      
                      // Crear tarjeta unificada si existen ambas actividades
                      const unifiedCard = topicActivity && challengeActivity ? {
                        id: topicActivity.id, // Usar el ID de la actividad de tema como principal
                        name: 'Seleccionar Tema y Desafío',
                        description: 'Elige un tema y analiza su desafío asociado',
                        order_number: topicActivity.order_number || 1,
                        activity_type_name: topicActivity.activity_type_name || 'Selecci+�n',
                        timer_duration: topicActivity.timer_duration || null,
                        _isUnified: true,
                        _topicActivityId: topicActivity.id,
                        _challengeActivityId: challengeActivity.id,
                      } : null;
                      
                      // Combinar: tarjeta unificada + otras actividades
                      const displayActivities = unifiedCard 
                        ? [unifiedCard, ...otherActivities]
                        : sortedActivities;
                      
                      return displayActivities.map((activity: any, index: number) => {
                        if (!activity || !activity.name) return null; // Filtrar actividades inv+�lidas
                        const IconComponent = getIconForActivity(activity.activity_type_name || '', activity.name || '');
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
                                  {activity.activity_type_name || 'Actividad'}
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
                      }).filter(Boolean);
                    } else {
                      // Para Etapa 3, mostrar todas las actividades normalmente
                      return activities
                        .sort((a, b) => a.order_number - b.order_number)
                        .map((activity, index) => {
                          const IconComponent = getIconForActivity(activity.activity_type_name, activity.name);
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
                                    {selectedStage !== 'otros' && (
                                      <span className="text-xs text-gray-400 group-hover:text-white/70">
                                        Orden: {activity.order_number}
                                      </span>
                                    )}
                                    {selectedStage === 'otros' && <div />}
                                    <span className="text-xs text-pink-500 group-hover:text-white font-medium">
                                      Editar →
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        });
                    }
                  })()}
                </div>
              )}
            </>
          ) : (
            // Vista de detalle/edici+�n de actividad
            <>
              {/* Header con bot+�n volver */}
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
                    {(selectedActivity as any)?._isUnified 
                      ? 'Seleccionar Tema y Desafío' 
                      : selectedActivity?.name || 'Configuraci+�n de actividad'}
                  </p>
                </div>
              </div>

              {/* Vista de Gesti+�n de Temas y Desafíos - Solo para "Seleccionar Tema y Desafío" */}
              {loadingActivity ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                </div>
              ) : (selectedActivity as any)?._isUnified ? (
                // Vista especial para gesti+�n de temas y desafíos
                <div className="space-y-6">
                  {selectedChallenge ? (
                    // Vista de edici+�n de Desafío
                    <div className="space-y-6">
                      {/* Header con bot+�n volver */}
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleBackToChallenges}
                          variant="ghost"
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <ChevronLeft className="w-5 h-5 text-blue-900" />
                        </Button>
                        <div className="flex-1">
                          <h2 className="text-xl font-bold text-blue-900">Editar Desafío</h2>
                          <p className="text-sm text-gray-600">{selectedChallenge.title}</p>
                        </div>
                      </div>

                      {/* Formulario de edici+�n del desafío */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                          <Edit className="w-5 h-5 text-blue-900" />
                          <Label className="text-blue-900 font-semibold">Información del Desafío</Label>
                        </div>
                        <div className="space-y-4">
                          {/* T+�tulo */}
                          <div>
                            <Label htmlFor="challenge_title" className="text-sm text-gray-700 mb-2 block">
                              T+�tulo del Desafío
                            </Label>
                            <Input
                              id="challenge_title"
                              value={selectedChallenge.title || ''}
                              onChange={(e) => setSelectedChallenge({ ...selectedChallenge, title: e.target.value })}
                              placeholder="Ej: Autogesti+�n de tratamientos"
                            />
                          </div>

                          {/* Icono */}
                          <div>
                            <Label htmlFor="challenge_icon" className="text-sm text-gray-700 mb-2 block">
                              Icono (Emoji o s+�mbolo)
                            </Label>
                            <Input
                              id="challenge_icon"
                              value={selectedChallenge.icon || ''}
                              onChange={(e) => setSelectedChallenge({ ...selectedChallenge, icon: e.target.value })}
                              placeholder="Ej: ����, ��Ʀ, ����"
                              maxLength={10}
                            />
                          </div>

                          {/* Descripci+�n del Desafío */}
                          <div>
                            <Label htmlFor="challenge_description" className="text-sm text-gray-700 mb-2 block">
                              Descripci+�n del Desafío
                            </Label>
                            <Textarea
                              id="challenge_description"
                              value={selectedChallenge.description || ''}
                              onChange={(e) => setSelectedChallenge({ ...selectedChallenge, description: e.target.value })}
                              placeholder="Describe el problema o desafío que se busca resolver..."
                              rows={4}
                            />
                          </div>

                          {/* Informaci+�n de la Persona */}
                          <div className="border-t pt-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Información de la Persona</h3>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              {/* Nombre de la Persona */}
                              <div>
                                <Label htmlFor="persona_name" className="text-sm text-gray-700 mb-2 block">
                                  Nombre
                                </Label>
                                <Input
                                  id="persona_name"
                                  value={selectedChallenge.persona_name || ''}
                                  onChange={(e) => setSelectedChallenge({ ...selectedChallenge, persona_name: e.target.value })}
                                  placeholder="Ej: Mar+�a"
                                />
                              </div>

                              {/* Edad de la Persona */}
                              <div>
                                <Label htmlFor="persona_age" className="text-sm text-gray-700 mb-2 block">
                                  Edad
                                </Label>
                                <Input
                                  id="persona_age"
                                  type="number"
                                  min="0"
                                  max="120"
                                  value={selectedChallenge.persona_age || ''}
                                  onChange={(e) => setSelectedChallenge({ 
                                    ...selectedChallenge, 
                                    persona_age: e.target.value ? parseInt(e.target.value) : null 
                                  })}
                                  placeholder="Ej: 35"
                                />
                              </div>
                            </div>

                            {/* Historia de la Persona */}
                            <div className="mb-4">
                              <Label htmlFor="persona_story" className="text-sm text-gray-700 mb-2 block">
                                Historia/Cita de la Persona
                              </Label>
                              <Textarea
                                id="persona_story"
                                value={selectedChallenge.persona_story || ''}
                                onChange={(e) => setSelectedChallenge({ ...selectedChallenge, persona_story: e.target.value })}
                                placeholder="Cita o historia espec+�fica de la persona..."
                                rows={3}
                              />
                            </div>

                            {/* Imagen de la Persona */}
                            <div>
                              <Label htmlFor="persona_image" className="text-sm text-gray-700 mb-2 block">
                                Imagen de la Persona
                              </Label>
                              <Input
                                id="persona_image"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setSelectedChallenge({ ...selectedChallenge, persona_image_file: file });
                                  }
                                }}
                              />
                              {selectedChallenge.persona_image_url && !selectedChallenge.persona_image_file && (
                                <div className="mt-2">
                                  <p className="text-xs text-gray-600 mb-2">Imagen actual:</p>
                                  <img 
                                    src={selectedChallenge.persona_image_url} 
                                    alt="Persona" 
                                    className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Botones */}
                          <div className="flex gap-3 justify-end pt-4 border-t">
                            <Button
                              onClick={handleBackToChallenges}
                              variant="outline"
                              disabled={savingChallenge}
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={async () => {
                                setSavingChallenge(true);
                                try {
                                  const updateData: any = {
                                    title: selectedChallenge.title,
                                    description: selectedChallenge.description,
                                    icon: selectedChallenge.icon,
                                    persona_name: selectedChallenge.persona_name,
                                    persona_age: selectedChallenge.persona_age,
                                    persona_story: selectedChallenge.persona_story,
                                  };

                                  // Si hay una nueva imagen, incluirla
                                  if ((selectedChallenge as any).persona_image_file) {
                                    updateData.persona_image = (selectedChallenge as any).persona_image_file;
                                  }

                                  const updatedChallenge = await challengesAPI.updateChallenge(selectedChallenge.id, updateData);
                                  
                                  toast.success('Desafío actualizado correctamente');
                                  await loadChallengesForTopic(selectedTopic.id); // Recargar lista
                                  // Mantener al usuario en la vista de edici+�n, actualizando el desafío seleccionado
                                  setSelectedChallenge(updatedChallenge);
                                } catch (error: any) {
                                  toast.error('Error al actualizar el desafío', {
                                    description: error.response?.data?.detail || 'Por favor intenta nuevamente',
                                  });
                                } finally {
                                  setSavingChallenge(false);
                                }
                              }}
                              disabled={savingChallenge}
                              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                            >
                              {savingChallenge ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Guardando...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  Guardar Cambios
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : selectedTopic ? (
                    // Vista de edici+�n de Tema
                    <div className="space-y-6">
                      {/* Header con bot+�n volver */}
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleBackToTopics}
                          variant="ghost"
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <ChevronLeft className="w-5 h-5 text-blue-900" />
                        </Button>
                        <div className="flex-1">
                          <h2 className="text-xl font-bold text-blue-900">Editar Tema</h2>
                          <p className="text-sm text-gray-600">{selectedTopic.name}</p>
                        </div>
                      </div>

                      {/* Formulario de edici+�n del tema */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                          <Edit className="w-5 h-5 text-blue-900" />
                          <Label className="text-blue-900 font-semibold">Información del Tema</Label>
                        </div>
                        <div className="space-y-4">
                          {/* Nombre */}
                          <div>
                            <Label htmlFor="topic_name" className="text-sm text-gray-700 mb-2 block">
                              Nombre del Tema
                            </Label>
                            <Input
                              id="topic_name"
                              value={selectedTopic.name || ''}
                              onChange={(e) => setSelectedTopic({ ...selectedTopic, name: e.target.value })}
                              placeholder="Ej: Salud, Finanzas, Medio Ambiente"
                            />
                          </div>

                          {/* Icono */}
                          <div>
                            <Label htmlFor="topic_icon" className="text-sm text-gray-700 mb-2 block">
                              Icono (Emoji o s+�mbolo)
                            </Label>
                            <Input
                              id="topic_icon"
                              value={selectedTopic.icon || ''}
                              onChange={(e) => setSelectedTopic({ ...selectedTopic, icon: e.target.value })}
                              placeholder="Ej: ����, ��Ʀ, ���"
                              maxLength={10}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Puedes usar un emoji o s+�mbolo para representar el tema
                            </p>
                          </div>

                          {/* Descripci+�n */}
                          <div>
                            <Label htmlFor="topic_description" className="text-sm text-gray-700 mb-2 block">
                              Descripci+�n
                            </Label>
                            <Textarea
                              id="topic_description"
                              value={selectedTopic.description || ''}
                              onChange={(e) => setSelectedTopic({ ...selectedTopic, description: e.target.value })}
                              placeholder="Describe el tema..."
                              rows={3}
                            />
                          </div>

                          {/* Carreras Disponibles (Facultades) */}
                          <div>
                            <Label className="text-sm text-gray-700 mb-3 block">
                              Carreras Disponibles (Selecciona las facultades)
                            </Label>
                            {faculties.length === 0 ? (
                              <p className="text-xs text-gray-500">Cargando facultades...</p>
                            ) : (
                              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                                {faculties.map((faculty) => {
                                  const isSelected = selectedTopic.faculties?.some(
                                    (f: any) => f.id === faculty.id || f === faculty.id
                                  );
                                  return (
                                    <label
                                      key={faculty.id}
                                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          const currentFaculties = selectedTopic.faculties || [];
                                          const facultyIds = currentFaculties.map((f: any) => 
                                            typeof f === 'object' ? f.id : f
                                          );
                                          
                                          if (e.target.checked) {
                                            setSelectedTopic({
                                              ...selectedTopic,
                                              faculties: [...currentFaculties, faculty],
                                              faculty_ids: [...facultyIds, faculty.id],
                                            });
                                          } else {
                                            setSelectedTopic({
                                              ...selectedTopic,
                                              faculties: currentFaculties.filter(
                                                (f: any) => (typeof f === 'object' ? f.id : f) !== faculty.id
                                              ),
                                              faculty_ids: facultyIds.filter(id => id !== faculty.id),
                                            });
                                          }
                                        }}
                                        className="rounded"
                                      />
                                      <span className="text-sm text-gray-700">{faculty.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Botones */}
                          <div className="flex gap-3 justify-end pt-4 border-t">
                            <Button
                              onClick={handleBackToTopics}
                              variant="outline"
                              disabled={savingTopic}
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={async () => {
                                setSavingTopic(true);
                                try {
                                  const facultyIds = selectedTopic.faculties?.map((f: any) => 
                                    typeof f === 'object' ? f.id : f
                                  ) || selectedTopic.faculty_ids || [];
                                  
                                  const updatedTopic = await challengesAPI.updateTopic(selectedTopic.id, {
                                    name: selectedTopic.name,
                                    icon: selectedTopic.icon,
                                    description: selectedTopic.description,
                                    faculty_ids: facultyIds,
                                  });
                                  
                                  toast.success('Tema actualizado correctamente');
                                  await loadTopics(); // Recargar lista
                                  // Actualizar el tema seleccionado con los datos actualizados
                                  setSelectedTopic(updatedTopic);
                                } catch (error: any) {
                                  toast.error('Error al actualizar el tema', {
                                    description: error.response?.data?.detail || 'Por favor intenta nuevamente',
                                  });
                                } finally {
                                  setSavingTopic(false);
                                }
                              }}
                              disabled={savingTopic}
                              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                            >
                              {savingTopic ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Guardando...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  Guardar Cambios
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Lista de Desafíos */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-blue-900" />
                            <Label className="text-blue-900 font-semibold text-lg">Desafíos</Label>
                          </div>
                          <Button
                            onClick={async () => {
                              setCreatingChallenge(true);
                              try {
                                const newChallenge = await challengesAPI.createChallenge({
                                  topic: selectedTopic.id,
                                  title: 'Nuevo Desafío',
                                  description: '',
                                });
                                toast.success('Desafío creado');
                                await loadChallengesForTopic(selectedTopic.id);
                                handleSelectChallenge(newChallenge);
                              } catch (error: any) {
                                toast.error('Error al crear el desafío', {
                                  description: error.response?.data?.detail || 'Por favor intenta nuevamente',
                                });
                              } finally {
                                setCreatingChallenge(false);
                              }
                            }}
                            disabled={creatingChallenge}
                            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                          >
                            {creatingChallenge ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creando...
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-2" />
                                Crear Desafío
                              </>
                            )}
                          </Button>
                        </div>
                        {loadingChallenges ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                          </div>
                        ) : challenges.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No hay desafíos disponibles</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {challenges.map((challenge) => (
                              <motion.div
                                key={challenge.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-xl p-4 border border-gray-200 hover:border-pink-500 cursor-pointer group"
                                onClick={() => handleSelectChallenge(challenge)}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="text-3xl">{challenge.icon || '��Ļ'}</div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (window.confirm(`¿Estás seguro de eliminar el desafío "${challenge.title}"?`)) {
                                        try {
                                          await challengesAPI.deleteChallenge(challenge.id);
                                          toast.success('Desafío eliminado');
                                          await loadChallengesForTopic(selectedTopic.id);
                                        } catch (error: any) {
                                          toast.error('Error al eliminar el desafío', {
                                            description: error.response?.data?.detail || 'Por favor intenta nuevamente',
                                          });
                                        }
                                      }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                                <h3 className="font-semibold text-blue-900 mb-1">{challenge.title}</h3>
                                {challenge.persona_name && (
                                  <p className="text-xs text-gray-600">Persona: {challenge.persona_name}</p>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Vista principal: Lista de Temas + Temporizador
                    <div className="space-y-6">
                      {/* Temporizador */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                          <Clock className="w-5 h-5 text-blue-900" />
                          <Label className="text-blue-900 font-semibold">Temporizador</Label>
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
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <Button
                            onClick={handleSaveActivity}
                            disabled={savingActivity}
                            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
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

                      {/* Secciones de Gesti+�n para Minijuego */}
                      {selectedActivity && (
                        (selectedActivity.name?.toLowerCase().includes('minijuego') || 
                         selectedActivity.activity_type_name?.toLowerCase().includes('minijuego')) && 
                        !(selectedActivity as any)?._isUnified && (
                          <div className="space-y-6">
                            {/* Sopa de Letras */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <Gamepad2 className="w-5 h-5 text-blue-900" />
                                  <Label className="text-blue-900 font-semibold text-lg">Sopa de Letras</Label>
                                </div>
                                <Button
                                  onClick={() => {
                                    setCreatingWordSearch(true);
                                    setWordSearchWords(['']);
                                    setWordSearchName('');
                                    setWordSearchPreview(null);
                                  }}
                                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Crear Nueva Sopa
                                </Button>
                              </div>
                              
                              {creatingWordSearch ? (
                                <div className="space-y-4">
                                  <Input
                                    label="Nombre"
                                    value={wordSearchName}
                                    onChange={(e) => setWordSearchName(e.target.value)}
                                    placeholder="Ej: Sopa de Letras 1"
                                  />
                                  <div className="space-y-2">
                                    <Label>Palabras (m+�ximo 5)</Label>
                                    {wordSearchWords.map((word, index) => (
                                      <Input
                                        key={index}
                                        value={word}
                                        onChange={(e) => {
                                          const newWords = [...wordSearchWords];
                                          newWords[index] = e.target.value;
                                          setWordSearchWords(newWords);
                                        }}
                                        placeholder={`Palabra ${index + 1}`}
                                        maxLength={20}
                                      />
                                    ))}
                                    {wordSearchWords.length < 5 && (
                                      <Button
                                        variant="outline"
                                        onClick={() => setWordSearchWords([...wordSearchWords, ''])}
                                      >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Agregar Palabra
                                      </Button>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={generateWordSearchPreview}
                                      disabled={generatingPreview}
                                    >
                                      {generatingPreview ? 'Generando...' : 'Generar Preview'}
                                    </Button>
                                    {wordSearchPreview && (
                                      <>
                                        <Button
                                          variant="outline"
                                          onClick={generateWordSearchPreview}
                                          disabled={generatingPreview}
                                        >
                                          ���� Regenerar
                                        </Button>
                                        <Button
                                          onClick={confirmWordSearch}
                                          className="bg-green-600 hover:bg-green-700 text-white"
                                        >
                                          ԣ� Confirmar y Guardar
                                        </Button>
                                        <Button
                                          variant="outline"
                                          onClick={() => {
                                            setCreatingWordSearch(false);
                                            setWordSearchPreview(null);
                                          }}
                                        >
                                          Cancelar
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                  {wordSearchPreview && (
                                    <div className="mt-4">
                                      <WordSearchPreview
                                        grid={wordSearchPreview.grid}
                                        wordPositions={wordSearchPreview.wordPositions}
                                        words={wordSearchPreview.words}
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <>
                                  {loadingWordSearch ? (
                                    <div className="flex items-center justify-center py-12">
                                      <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                                    </div>
                                  ) : wordSearchOptions.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No hay sopas de letras creadas</p>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {wordSearchOptions.map((option) => (
                                        <motion.div
                                          key={option.id}
                                          initial={{ opacity: 0, scale: 0.9 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          className="bg-white rounded-xl p-4 border border-gray-200"
                                        >
                                          <div className="flex items-start justify-between mb-2">
                                            <h3 className="font-semibold text-blue-900">{option.name}</h3>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`¿Estás seguro de eliminar "${option.name}"?`)) {
                                                  try {
                                                    await challengesAPI.deleteWordSearchOption(option.id);
                                                    toast.success('Sopa de letras eliminada');
                                                    await loadWordSearchOptions(selectedActivity.id);
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
                                          <p className="text-xs text-gray-600">
                                            {option.words?.length || 0} palabra{(option.words?.length || 0) !== 1 ? 's' : ''}
                                          </p>
                                        </motion.div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Anagrama */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <Gamepad2 className="w-5 h-5 text-blue-900" />
                                  <Label className="text-blue-900 font-semibold text-lg">Anagrama</Label>
                                </div>
                                <Button
                                  onClick={() => {
                                    setCreatingAnagram(true);
                                    setNewAnagramWord('');
                                    setAnagramPreview('');
                                  }}
                                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Agregar Palabra
                                </Button>
                              </div>
                              
                              {creatingAnagram ? (
                                <div className="space-y-4">
                                  <Input
                                    label="Palabra"
                                    value={newAnagramWord}
                                    onChange={(e) => {
                                      setNewAnagramWord(e.target.value);
                                      generateAnagramPreview(e.target.value);
                                    }}
                                    placeholder="Ej: EMPRENDIMIENTO"
                                    maxLength={20}
                                  />
                                  {anagramPreview && (
                                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                                      <p className="text-sm text-gray-600 mb-2">Preview (desordenada):</p>
                                      <p className="text-2xl font-bold text-blue-900">{anagramPreview}</p>
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={confirmAnagram}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      ԣ� Confirmar y Guardar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setCreatingAnagram(false);
                                        setNewAnagramWord('');
                                        setAnagramPreview('');
                                      }}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {loadingAnagram ? (
                                    <div className="flex items-center justify-center py-12">
                                      <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                                    </div>
                                  ) : anagramWords.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No hay palabras agregadas</p>
                                  ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                      {anagramWords.map((word) => (
                                        <motion.div
                                          key={word.id}
                                          initial={{ opacity: 0, scale: 0.9 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          className="bg-white rounded-lg p-3 border border-gray-200 flex items-center justify-between"
                                        >
                                          <span className="font-medium text-blue-900">{word.word}</span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={async () => {
                                              if (window.confirm(`-+Eliminar "${word.word}"?`)) {
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
                                            <Trash2 className="w-3 h-3 text-red-500" />
                                          </Button>
                                        </motion.div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Preguntas Conocimiento General */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <HelpCircle className="w-5 h-5 text-blue-900" />
                                  <Label className="text-blue-900 font-semibold text-lg">Preguntas de Conocimiento General</Label>
                                </div>
                                <Button
                                  onClick={() => {
                                    setCreatingGeneralKnowledge(true);
                                    setEditingGeneralKnowledge({
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
                                  Crear Pregunta
                                </Button>
                              </div>
                              
                              {(creatingGeneralKnowledge || editingGeneralKnowledge) ? (
                                <div className="space-y-4 bg-white rounded-lg p-4 border border-gray-200">
                                  <Textarea
                                    label="Pregunta"
                                    value={editingGeneralKnowledge?.question || ''}
                                    onChange={(e) => setEditingGeneralKnowledge({ ...editingGeneralKnowledge, question: e.target.value })}
                                    placeholder="Ej: ¿Qué es un MVP en emprendimiento?"
                                    rows={3}
                                  />
                                  <div className="grid grid-cols-2 gap-4">
                                    <Input
                                      label="Opci+�n A"
                                      value={editingGeneralKnowledge?.option_a || ''}
                                      onChange={(e) => setEditingGeneralKnowledge({ ...editingGeneralKnowledge, option_a: e.target.value })}
                                      placeholder="Opci+�n A"
                                    />
                                    <Input
                                      label="Opci+�n B"
                                      value={editingGeneralKnowledge?.option_b || ''}
                                      onChange={(e) => setEditingGeneralKnowledge({ ...editingGeneralKnowledge, option_b: e.target.value })}
                                      placeholder="Opci+�n B"
                                    />
                                    <Input
                                      label="Opci+�n C"
                                      value={editingGeneralKnowledge?.option_c || ''}
                                      onChange={(e) => setEditingGeneralKnowledge({ ...editingGeneralKnowledge, option_c: e.target.value })}
                                      placeholder="Opci+�n C"
                                    />
                                    <Input
                                      label="Opci+�n D"
                                      value={editingGeneralKnowledge?.option_d || ''}
                                      onChange={(e) => setEditingGeneralKnowledge({ ...editingGeneralKnowledge, option_d: e.target.value })}
                                      placeholder="Opci+�n D"
                                    />
                                  </div>
                                  <div>
                                    <Label>Respuesta Correcta</Label>
                                    <select
                                      value={editingGeneralKnowledge?.correct_answer ?? 0}
                                      onChange={(e) => setEditingGeneralKnowledge({ ...editingGeneralKnowledge, correct_answer: parseInt(e.target.value) })}
                                      className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                      <option value={0}>A</option>
                                      <option value={1}>B</option>
                                      <option value={2}>C</option>
                                      <option value={3}>D</option>
                                    </select>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={async () => {
                                        try {
                                          if (editingGeneralKnowledge?.id) {
                                            await challengesAPI.updateGeneralKnowledgeQuestion(editingGeneralKnowledge.id, editingGeneralKnowledge);
                                            toast.success('Pregunta actualizada');
                                          } else {
                                            await challengesAPI.createGeneralKnowledgeQuestion(editingGeneralKnowledge);
                                            toast.success('Pregunta creada');
                                          }
                                          setCreatingGeneralKnowledge(false);
                                          setEditingGeneralKnowledge(null);
                                          await loadGeneralKnowledgeQuestions();
                                        } catch (error: any) {
                                          toast.error('Error al guardar', {
                                            description: error.response?.data?.error || 'Por favor intenta nuevamente',
                                          });
                                        }
                                      }}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      Guardar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setCreatingGeneralKnowledge(false);
                                        setEditingGeneralKnowledge(null);
                                      }}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {loadingGeneralKnowledge ? (
                                    <div className="flex items-center justify-center py-12">
                                      <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                                    </div>
                                  ) : generalKnowledgeQuestions.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No hay preguntas creadas</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {generalKnowledgeQuestions.map((question) => (
                                        <motion.div
                                          key={question.id}
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="bg-white rounded-lg p-4 border border-gray-200"
                                        >
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <p className="font-semibold text-blue-900 mb-2">{question.question}</p>
                                              <div className="grid grid-cols-2 gap-2 text-sm">
                                                <p className={question.correct_answer === 0 ? 'text-green-600 font-bold' : 'text-gray-600'}>
                                                  A: {question.option_a}
                                                </p>
                                                <p className={question.correct_answer === 1 ? 'text-green-600 font-bold' : 'text-gray-600'}>
                                                  B: {question.option_b}
                                                </p>
                                                <p className={question.correct_answer === 2 ? 'text-green-600 font-bold' : 'text-gray-600'}>
                                                  C: {question.option_c}
                                                </p>
                                                <p className={question.correct_answer === 3 ? 'text-green-600 font-bold' : 'text-gray-600'}>
                                                  D: {question.option_d}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex gap-2 ml-4">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  setEditingGeneralKnowledge(question);
                                                  setCreatingGeneralKnowledge(false);
                                                }}
                                              >
                                                <Edit className="w-4 h-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={async () => {
                                                  if (window.confirm('-+Eliminar esta pregunta?')) {
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
                                        </motion.div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )
                      )}

                      {/* Secciones de Gesti+�n para Presentaci+�n */}
                      {selectedActivity && (
                        (selectedActivity.name?.toLowerCase().includes('presentacion') || 
                         selectedActivity.name?.toLowerCase().includes('presentaci+�n')) && 
                        !(selectedActivity as any)?._isUnified && (
                          <div className="space-y-6">
                            {/* Preguntas del Caos */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <MessageCircle className="w-5 h-5 text-blue-900" />
                                  <Label className="text-blue-900 font-semibold text-lg">Preguntas del Caos</Label>
                                </div>
                                <Button
                                  onClick={() => {
                                    setCreatingChaos(true);
                                    setEditingChaos({ question: '' });
                                  }}
                                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Crear Pregunta
                                </Button>
                              </div>
                              
                              {(creatingChaos || editingChaos) ? (
                                <div className="space-y-4 bg-white rounded-lg p-4 border border-gray-200">
                                  <Textarea
                                    label="Pregunta"
                                    value={editingChaos?.question || ''}
                                    onChange={(e) => setEditingChaos({ ...editingChaos, question: e.target.value })}
                                    placeholder="Ej: ¿Cuál es tu mayor miedo al emprender?"
                                    rows={3}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={async () => {
                                        try {
                                          if (editingChaos?.id) {
                                            await challengesAPI.updateChaosQuestion(editingChaos.id, editingChaos);
                                            toast.success('Pregunta actualizada');
                                          } else {
                                            await challengesAPI.createChaosQuestion(editingChaos);
                                            toast.success('Pregunta creada');
                                          }
                                          setCreatingChaos(false);
                                          setEditingChaos(null);
                                          await loadChaosQuestions();
                                        } catch (error: any) {
                                          toast.error('Error al guardar', {
                                            description: error.response?.data?.error || 'Por favor intenta nuevamente',
                                          });
                                        }
                                      }}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      Guardar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setCreatingChaos(false);
                                        setEditingChaos(null);
                                      }}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {loadingChaos ? (
                                    <div className="flex items-center justify-center py-12">
                                      <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                                    </div>
                                  ) : chaosQuestions.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No hay preguntas creadas</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {chaosQuestions.map((question) => (
                                        <motion.div
                                          key={question.id}
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="bg-white rounded-lg p-4 border border-gray-200 flex items-start justify-between"
                                        >
                                          <p className="font-medium text-blue-900 flex-1">{question.question}</p>
                                          <div className="flex gap-2 ml-4">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                setEditingChaos(question);
                                                setCreatingChaos(false);
                                              }}
                                            >
                                              <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={async () => {
                                                if (window.confirm('-+Eliminar esta pregunta?')) {
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
                                </>
                              )}
                            </div>

                            {/* Preguntas Conocimiento General (mismas que minijuego) */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <HelpCircle className="w-5 h-5 text-blue-900" />
                                  <Label className="text-blue-900 font-semibold text-lg">Preguntas de Conocimiento General</Label>
                                </div>
                                <Button
                                  onClick={() => {
                                    setCreatingPresentationGeneralKnowledge(true);
                                    setEditingPresentationGeneralKnowledge({
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
                                  Crear Pregunta
                                </Button>
                              </div>
                              
                              {(creatingPresentationGeneralKnowledge || editingPresentationGeneralKnowledge) ? (
                                <div className="space-y-4 bg-white rounded-lg p-4 border border-gray-200">
                                  <Textarea
                                    label="Pregunta"
                                    value={editingPresentationGeneralKnowledge?.question || ''}
                                    onChange={(e) => setEditingPresentationGeneralKnowledge({ ...editingPresentationGeneralKnowledge, question: e.target.value })}
                                    placeholder="Ej: ¿Qué es un MVP en emprendimiento?"
                                    rows={3}
                                  />
                                  <div className="grid grid-cols-2 gap-4">
                                    <Input
                                      label="Opci+�n A"
                                      value={editingPresentationGeneralKnowledge?.option_a || ''}
                                      onChange={(e) => setEditingPresentationGeneralKnowledge({ ...editingPresentationGeneralKnowledge, option_a: e.target.value })}
                                      placeholder="Opci+�n A"
                                    />
                                    <Input
                                      label="Opci+�n B"
                                      value={editingPresentationGeneralKnowledge?.option_b || ''}
                                      onChange={(e) => setEditingPresentationGeneralKnowledge({ ...editingPresentationGeneralKnowledge, option_b: e.target.value })}
                                      placeholder="Opci+�n B"
                                    />
                                    <Input
                                      label="Opci+�n C"
                                      value={editingPresentationGeneralKnowledge?.option_c || ''}
                                      onChange={(e) => setEditingPresentationGeneralKnowledge({ ...editingPresentationGeneralKnowledge, option_c: e.target.value })}
                                      placeholder="Opci+�n C"
                                    />
                                    <Input
                                      label="Opci+�n D"
                                      value={editingPresentationGeneralKnowledge?.option_d || ''}
                                      onChange={(e) => setEditingPresentationGeneralKnowledge({ ...editingPresentationGeneralKnowledge, option_d: e.target.value })}
                                      placeholder="Opci+�n D"
                                    />
                                  </div>
                                  <div>
                                    <Label>Respuesta Correcta</Label>
                                    <select
                                      value={editingPresentationGeneralKnowledge?.correct_answer ?? 0}
                                      onChange={(e) => setEditingPresentationGeneralKnowledge({ ...editingPresentationGeneralKnowledge, correct_answer: parseInt(e.target.value) })}
                                      className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                      <option value={0}>A</option>
                                      <option value={1}>B</option>
                                      <option value={2}>C</option>
                                      <option value={3}>D</option>
                                    </select>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={async () => {
                                        try {
                                          if (editingPresentationGeneralKnowledge?.id) {
                                            await challengesAPI.updateGeneralKnowledgeQuestion(editingPresentationGeneralKnowledge.id, editingPresentationGeneralKnowledge);
                                            toast.success('Pregunta actualizada');
                                          } else {
                                            await challengesAPI.createGeneralKnowledgeQuestion(editingPresentationGeneralKnowledge);
                                            toast.success('Pregunta creada');
                                          }
                                          setCreatingPresentationGeneralKnowledge(false);
                                          setEditingPresentationGeneralKnowledge(null);
                                          await loadGeneralKnowledgeQuestions();
                                          setPresentationGeneralKnowledge(generalKnowledgeQuestions);
                                        } catch (error: any) {
                                          toast.error('Error al guardar', {
                                            description: error.response?.data?.error || 'Por favor intenta nuevamente',
                                          });
                                        }
                                      }}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      Guardar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setCreatingPresentationGeneralKnowledge(false);
                                        setEditingPresentationGeneralKnowledge(null);
                                      }}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {loadingPresentationGeneralKnowledge ? (
                                    <div className="flex items-center justify-center py-12">
                                      <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                                    </div>
                                  ) : presentationGeneralKnowledge.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No hay preguntas creadas</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {presentationGeneralKnowledge.map((question) => (
                                        <motion.div
                                          key={question.id}
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="bg-white rounded-lg p-4 border border-gray-200"
                                        >
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <p className="font-semibold text-blue-900 mb-2">{question.question}</p>
                                              <div className="grid grid-cols-2 gap-2 text-sm">
                                                <p className={question.correct_answer === 0 ? 'text-green-600 font-bold' : 'text-gray-600'}>
                                                  A: {question.option_a}
                                                </p>
                                                <p className={question.correct_answer === 1 ? 'text-green-600 font-bold' : 'text-gray-600'}>
                                                  B: {question.option_b}
                                                </p>
                                                <p className={question.correct_answer === 2 ? 'text-green-600 font-bold' : 'text-gray-600'}>
                                                  C: {question.option_c}
                                                </p>
                                                <p className={question.correct_answer === 3 ? 'text-green-600 font-bold' : 'text-gray-600'}>
                                                  D: {question.option_d}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex gap-2 ml-4">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  setEditingPresentationGeneralKnowledge(question);
                                                  setCreatingPresentationGeneralKnowledge(false);
                                                }}
                                              >
                                                <Edit className="w-4 h-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={async () => {
                                                  if (window.confirm('-+Eliminar esta pregunta?')) {
                                                    try {
                                                      await challengesAPI.deleteGeneralKnowledgeQuestion(question.id);
                                                      toast.success('Pregunta eliminada');
                                                      await loadGeneralKnowledgeQuestions();
                                                      setPresentationGeneralKnowledge(generalKnowledgeQuestions);
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
                                        </motion.div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )
                      )}

                      {/* Lista de Temas */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-blue-900" />
                            <Label className="text-blue-900 font-semibold text-lg">Temas</Label>
                          </div>
                          <Button
                            onClick={async () => {
                              setCreatingTopic(true);
                              try {
                                const newTopic = await challengesAPI.createTopic({
                                  name: 'Nuevo Tema',
                                  icon: '����',
                                  description: '',
                                  is_active: true,
                                });
                                toast.success('Tema creado');
                                await loadTopics();
                                await handleSelectTopic(newTopic);
                              } catch (error: any) {
                                toast.error('Error al crear el tema', {
                                  description: error.response?.data?.detail || 'Por favor intenta nuevamente',
                                });
                              } finally {
                                setCreatingTopic(false);
                              }
                            }}
                            disabled={creatingTopic}
                            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                          >
                            {creatingTopic ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creando...
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-2" />
                                Crear Tema
                              </>
                            )}
                          </Button>
                        </div>
                        {loadingTopics ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                          </div>
                        ) : topics.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No hay temas disponibles</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {topics.map((topic) => (
                              <motion.div
                                key={topic.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-xl p-4 border border-gray-200 hover:border-pink-500 cursor-pointer group"
                                onClick={() => handleSelectTopic(topic)}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="text-3xl">{topic.icon || '����'}</div>
                                    <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (window.confirm(`¿Estás seguro de eliminar el tema "${topic.name}"? Esto también eliminará todos sus desafíos asociados.`)) {
                                        try {
                                          await challengesAPI.deleteTopic(topic.id);
                                          toast.success('Tema eliminado');
                                          await loadTopics();
                                        } catch (error: any) {
                                          toast.error('Error al eliminar el tema', {
                                            description: error.response?.data?.detail || 'Por favor intenta nuevamente',
                                          });
                                        }
                                      }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                                <h3 className="font-semibold text-blue-900 mb-1">{topic.name}</h3>
                                {topic.description && (
                                  <p className="text-xs text-gray-600 line-clamp-2">{topic.description}</p>
                                )}
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-xs text-gray-500">
                                    {topic.faculties?.length || 0} carreras
                                  </span>
                                  <span className="text-xs text-gray-500">���</span>
                                  <span className="text-xs text-gray-500">
                                    {topic.challenges?.length || 0} desafíos
                                  </span>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Temporizador - Editable (solo si NO es Presentación del Pitch) */}
                  {selectedActivity && !(
                    selectedActivity.name?.toLowerCase().includes('presentaci+�n') || 
                    selectedActivity.name?.toLowerCase().includes('presentacion')
                  ) && (
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
                  )}

                  {/* Temporizador - Solo para Presentaci+�n del Pitch */}
                  {selectedActivity && (
                    (selectedActivity.name?.toLowerCase().includes('presentaci+�n') || 
                     selectedActivity.name?.toLowerCase().includes('presentacion')) && (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                          <Clock className="w-5 h-5 text-blue-900" />
                          <Label className="text-blue-900 font-semibold">
                            Temporizador
                          </Label>
                        </div>
                        <p className="text-xs text-gray-600 mb-4">
                          Duración para cada presentación individual de un equipo (por defecto: 1:30)
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="presentation_timer_minutes" className="text-sm text-gray-700 mb-2 block">
                              Minutos
                            </Label>
                            <Input
                              id="presentation_timer_minutes"
                              type="number"
                              min="0"
                              max="999"
                              value={presentationTimerMinutes}
                              onChange={(e) => setPresentationTimerMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="presentation_timer_seconds" className="text-sm text-gray-700 mb-2 block">
                              Segundos
                            </Label>
                            <Input
                              id="presentation_timer_seconds"
                              type="number"
                              min="0"
                              max="59"
                              value={presentationTimerSeconds}
                              onChange={(e) => {
                                const value = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                setPresentationTimerSeconds(value);
                              }}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              0-59 segundos
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 bg-white rounded-lg p-3 border border-blue-200">
                          <p className="text-xs text-gray-600 mb-1">Duración total por presentación:</p>
                          <p className="text-lg font-bold text-blue-900">
                            {String(presentationTimerMinutes).padStart(2, '0')}:
                            {String(presentationTimerSeconds).padStart(2, '0')}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            ({presentationTimerMinutes * 60 + presentationTimerSeconds} segundos)
                          </p>
                        </div>
                      </div>
                    )
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
                          {selectedActivity && (
                            selectedActivity.name?.toLowerCase().includes('presentaci+�n') || 
                            selectedActivity.name?.toLowerCase().includes('presentacion')
                          ) ? 'Guardar Temporizador de Presentaci+�n' : 'Guardar Temporizador'}
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
