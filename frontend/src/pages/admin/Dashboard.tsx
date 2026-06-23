import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  Users,
  UserCheck,
  Gamepad2,
  CheckCircle2,
  TrendingUp,
  Clock,
  Target,
  MessageSquare,
  PieChart as PieChartIcon,
  Calendar,
  ChevronRight,
  ChevronLeft,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { adminDashboardAPI } from '@/services';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';

// Colores para gráficos — paleta Mission Launchpad
const CHART_COLORS = [
  '#2563EB',
  '#FF3D2E',
  '#F5A623',
  '#22c55e',
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#10b981',
];

const COMPLETION_COLORS = {
  completed: '#22c55e',
  not_completed: '#F5A623',
  cancelled: '#FF3D2E',
};

// Configuración común para gráficos de barras horizontales
const HORIZONTAL_BAR_CONFIG = {
  margin: { top: 5, right: 30, left: 20, bottom: 5 },
  yAxis: {
    tick: { fontSize: 12 },
    width: 150,
  },
};

interface Metrics {
  total_students_played: number;
  total_professors_active: number;
  total_sessions_created: number;
  total_sessions_completed: number;
  total_sessions_running: number;
  completion_rate: number;
}

interface TimeSeriesData {
  metric: string;
  period: string;
  data: Array<{ period: string; count: number }>;
}

interface GameCompletion {
  total: number;
  completed: { count: number; percentage: number };
  cancelled: { count: number; percentage: number };
}

interface CancellationReason {
  reason: string;
  count: number;
  percentage: number;
  examples: string[];
}

interface CancellationReasonsData {
  total_cancelled: number;
  reasons: CancellationReason[];
}

interface Stage {
  stage_id: number;
  stage_number: number;
  stage_name: string;
  avg_duration_seconds: number;
}

interface Activity {
  activity_id: number;
  activity_name: string;
  activity_order: number;
  avg_duration_seconds: number;
}

interface Topic {
  topic_id: number;
  topic_name: string;
  selection_count: number;
}

interface Challenge {
  challenge_id: number;
  challenge_title: string;
  selection_count: number;
  avg_tokens_earned: number;
}

type DrillDownLevel = 'main' | 'stage' | 'activity' | 'topic' | 'challenge';

export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Métricas generales
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  
  // Series temporales
  const [timeSeriesMetric, setTimeSeriesMetric] = useState<'games' | 'professors' | 'students'>('games');
  const [timeSeriesPeriod, setTimeSeriesPeriod] = useState<'year' | 'month' | 'week' | 'day'>('month');
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData | null>(null);
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(false);
  
  // Completación
  const [gameCompletion, setGameCompletion] = useState<GameCompletion | null>(null);
  const [completionDrillDown, setCompletionDrillDown] = useState<'main' | 'cancellation_reasons'>('main');
  const [cancellationReasons, setCancellationReasons] = useState<CancellationReasonsData | null>(null);
  const [loadingCancellationReasons, setLoadingCancellationReasons] = useState(false);
  
  // Drill-down duración
  const [durationDrillDown, setDurationDrillDown] = useState<DrillDownLevel>('main');
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityAnalysis, setActivityAnalysis] = useState<any>(null);
  
  // Drill-down temas
  const [topicDrillDown, setTopicDrillDown] = useState<DrillDownLevel>('main');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengeAnalysis, setChallengeAnalysis] = useState<any>(null);
  
  // Evaluaciones
  const [evaluationResponseRate, setEvaluationResponseRate] = useState<any>(null);
  const [evaluationAnswers, setEvaluationAnswers] = useState<any>(null);
  const [evaluationComments, setEvaluationComments] = useState<any[]>([]);
  const [commentsPage, setCommentsPage] = useState(1);

  // Drill-down facultades
  const [facultyDrillDown, setFacultyDrillDown] = useState<'main' | 'careers'>('main');
  const [selectedFaculty, setSelectedFaculty] = useState<{ faculty_id: number; faculty_name: string } | null>(null);
  const [faculties, setFaculties] = useState<Array<{ faculty_id: number; faculty_name: string; games_count: number }>>([]);
  const [careers, setCareers] = useState<Array<{ career_id: number; career_name: string; games_count: number }>>([]);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/profesor/login');
      return;
    }
    loadAllData();
  }, [navigate]);

  useEffect(() => {
    if (timeSeriesMetric && timeSeriesPeriod) {
      loadTimeSeries();
    }
  }, [timeSeriesMetric, timeSeriesPeriod]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [
        metricsData,
        completionData,
        stagesData,
        topicsData,
        responseRateData,
        answersData,
      ] = await Promise.all([
        adminDashboardAPI.getMetrics(),
        adminDashboardAPI.getGameCompletion(),
        adminDashboardAPI.getStageDuration(),
        adminDashboardAPI.getTopicsSelection(),
        adminDashboardAPI.getEvaluationResponseRate(),
        adminDashboardAPI.getEvaluationAnswers(),
      ]);

      setMetrics(metricsData);
      setGameCompletion(completionData);
      setStages(stagesData.stages || []);
      setTopics(topicsData.topics || []);
      setEvaluationResponseRate(responseRateData);
      setEvaluationAnswers(answersData);
      
      await loadTimeSeries();
      await loadComments();
      await loadFacultiesGames();
    } catch (error: any) {
      toast.error('Error al cargar datos', {
        description: error.response?.data?.error || 'No se pudieron cargar las métricas',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTimeSeries = async () => {
    setTimeSeriesLoading(true);
    try {
      const data = await adminDashboardAPI.getTimeSeries({
        metric: timeSeriesMetric,
        period: timeSeriesPeriod,
      });
      setTimeSeriesData(data);
    } catch (error: any) {
      console.error('Error loading time series:', error);
      toast.error('Error al cargar series temporales', {
        description: error.response?.data?.error || 'No se pudieron cargar los datos',
      });
    } finally {
      setTimeSeriesLoading(false);
    }
  };

  const loadStageActivities = async (stageId: number) => {
    try {
      const data = await adminDashboardAPI.getStageActivitiesDuration(stageId);
      setActivities(data.activities || []);
      setSelectedStage(stages.find(s => s.stage_id === stageId) || null);
      setDurationDrillDown('stage');
    } catch (error: any) {
      toast.error('Error al cargar actividades', {
        description: error.response?.data?.error || 'No se pudieron cargar las actividades',
      });
    }
  };

  const loadActivityAnalysis = async (activityId: number) => {
    try {
      const data = await adminDashboardAPI.getActivityDurationAnalysis(activityId);
      setActivityAnalysis(data);
      setSelectedActivity(activities.find(a => a.activity_id === activityId) || null);
      setDurationDrillDown('activity');
    } catch (error: any) {
      toast.error('Error al cargar análisis', {
        description: error.response?.data?.error || 'No se pudo cargar el análisis',
      });
    }
  };

  const loadTopicChallenges = async (topicId: number) => {
    try {
      const data = await adminDashboardAPI.getTopicChallenges(topicId);
      setChallenges(data.challenges || []);
      setSelectedTopic(topics.find(t => t.topic_id === topicId) || null);
      setTopicDrillDown('topic');
    } catch (error: any) {
      toast.error('Error al cargar desafíos', {
        description: error.response?.data?.error || 'No se pudieron cargar los desafíos',
      });
    }
  };

  const loadChallengeAnalysis = async (challengeId: number) => {
    try {
      const data = await adminDashboardAPI.getChallengeAnalysis(challengeId);
      setChallengeAnalysis(data);
      setSelectedChallenge(challenges.find(c => c.challenge_id === challengeId) || null);
      setTopicDrillDown('challenge');
    } catch (error: any) {
      toast.error('Error al cargar análisis', {
        description: error.response?.data?.error || 'No se pudo cargar el análisis',
      });
    }
  };

  const loadFacultiesGames = async () => {
    try {
      const data = await adminDashboardAPI.getFacultiesGames();
      setFaculties(data.faculties || []);
    } catch (error: any) {
      toast.error('Error al cargar facultades', {
        description: error.response?.data?.error || 'No se pudieron cargar las facultades',
      });
    }
  };

  const loadFacultyCareers = async (facultyId: number) => {
    try {
      const data = await adminDashboardAPI.getFacultyCareersGames(facultyId);
      setCareers(data.careers || []);
      setSelectedFaculty({ faculty_id: data.faculty_id, faculty_name: data.faculty_name });
      setFacultyDrillDown('careers');
    } catch (error: any) {
      toast.error('Error al cargar carreras', {
        description: error.response?.data?.error || 'No se pudieron cargar las carreras',
      });
    }
  };

  const loadComments = async () => {
    try {
      const data = await adminDashboardAPI.getEvaluationComments({
        page: commentsPage,
        page_size: 10,
      });
      setEvaluationComments(data.results || []);
    } catch (error: any) {
      console.error('Error loading comments:', error);
    }
  };

  const loadCancellationReasons = async () => {
    setLoadingCancellationReasons(true);
    try {
      const data = await adminDashboardAPI.getCancellationReasons();
      setCancellationReasons(data);
      setCompletionDrillDown('cancellation_reasons');
    } catch (error: any) {
      toast.error('Error al cargar motivos de cancelación', {
        description: error.response?.data?.error || 'No se pudieron cargar los motivos',
      });
    } finally {
      setLoadingCancellationReasons(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  // Generar rango de fechas para el gráfico temporal
  const generateDateRange = (period: 'year' | 'month' | 'week' | 'day', data: Array<{period: string; count: number}>) => {
    const range: Array<{period: string; count: number}> = [];
    const today = new Date();
    const dataMap = new Map(data?.map(item => [item.period, item.count]) || []);
    
    // Siempre generar un rango completo
    if (period === 'month') {
      // Últimos 12 meses
      for (let i = 11; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        range.push({
          period: periodKey,
          count: dataMap.get(periodKey) || 0
        });
      }
    } else if (period === 'day') {
      // Si hay datos, usar las fechas de los datos y extender el rango si es necesario
      if (data && data.length > 0) {
        // Obtener todas las fechas de los datos
        const dates = data.map(item => item.period).sort();
        const minDate = new Date(dates[0]);
        const maxDate = new Date(dates[dates.length - 1]);
        
        // Extender el rango: desde 7 días antes de la fecha más antigua hasta hoy (o hasta 7 días después de la más reciente)
        const startDate = new Date(minDate);
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date(Math.max(maxDate.getTime(), today.getTime()));
        endDate.setDate(endDate.getDate() + 7);
        
        // Generar rango completo desde startDate hasta endDate
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const periodKey = currentDate.toISOString().split('T')[0];
          range.push({
            period: periodKey,
            count: dataMap.get(periodKey) || 0
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        // Si no hay datos, generar últimos 30 días
        for (let i = 29; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const periodKey = date.toISOString().split('T')[0];
          range.push({
            period: periodKey,
            count: 0
          });
        }
      }
    } else if (period === 'week') {
      // Últimas 12 semanas
      for (let i = 11; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - (i * 7));
        const year = date.getFullYear();
        const week = getWeekNumber(date);
        const periodKey = `${year}-W${String(week).padStart(2, '0')}`;
        range.push({
          period: periodKey,
          count: dataMap.get(periodKey) || 0
        });
      }
    } else { // year
      // Últimos 5 años
      const currentYear = today.getFullYear();
      for (let i = 4; i >= 0; i--) {
        const periodKey = String(currentYear - i);
        range.push({
          period: periodKey,
          count: dataMap.get(periodKey) || 0
        });
      }
    }
    
    return range;
  };

  // Función helper para obtener número de semana
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Obtener datos procesados para el gráfico temporal
  const getTimeSeriesChartData = () => {
    const backendData = timeSeriesData?.data || [];
    // Si hay datos del backend, usarlos directamente y solo llenar los huecos
    if (backendData.length > 0) {
      return generateDateRange(timeSeriesPeriod, backendData);
    }
    // Si no hay datos, generar rango vacío
    return generateDateRange(timeSeriesPeriod, []);
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#F5F0E8' }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#2563EB]" />
          <p className="text-sm text-[#1B1B2F]/50 font-medium">Cargando dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Background blobs */}
      <div
        className="absolute top-[-8%] left-[-6%] w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: '#2563EB', filter: 'blur(180px)', opacity: 0.10 }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[32rem] h-[32rem] rounded-full pointer-events-none"
        style={{ background: '#FF3D2E', filter: 'blur(200px)', opacity: 0.08 }}
      />
      <div
        className="absolute top-[40%] right-[8%] w-80 h-80 rounded-full pointer-events-none"
        style={{ background: '#F5A623', filter: 'blur(160px)', opacity: 0.08 }}
      />
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #1B1B2F18 1.5px, transparent 1.5px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="max-w-7xl mx-auto w-full relative z-10 p-4 sm:p-6 flex-1">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/admin/panel')}
            className="flex items-center gap-2 text-sm font-semibold text-[#1B1B2F]/55 hover:text-[#1B1B2F] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Panel
          </button>
          <div className="flex-1">
            <h1
              className="text-xl sm:text-2xl font-black text-[#1B1B2F]"
              style={{ fontFamily: 'Unbounded, sans-serif' }}
            >
              Dashboard
            </h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* Tarjetas de Métricas */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Alumnos que han jugado</p>
                    <p className="text-3xl font-black text-[#1B1B2F]" style={{ fontFamily: 'Unbounded, sans-serif' }}>{metrics.total_students_played}</p>
                  </div>
                  <Users className="w-12 h-12 text-blue-500" />
                </div>
              </Card>
              <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Profesores activos</p>
                    <p className="text-3xl font-black text-[#1B1B2F]" style={{ fontFamily: 'Unbounded, sans-serif' }}>{metrics.total_professors_active}</p>
                  </div>
                  <UserCheck className="w-12 h-12 text-green-500" />
                </div>
              </Card>
              <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Sesiones creadas</p>
                    <p className="text-3xl font-black text-[#1B1B2F]" style={{ fontFamily: 'Unbounded, sans-serif' }}>{metrics.total_sessions_created}</p>
                  </div>
                  <Gamepad2 className="w-12 h-12 text-purple-500" />
                </div>
              </Card>
              <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Sesiones completadas</p>
                    <p className="text-3xl font-black text-[#1B1B2F]" style={{ fontFamily: 'Unbounded, sans-serif' }}>{metrics.total_sessions_completed}</p>
                  </div>
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
              </Card>
              <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Sesiones en curso</p>
                    <p className="text-3xl font-black text-[#1B1B2F]" style={{ fontFamily: 'Unbounded, sans-serif' }}>{metrics.total_sessions_running}</p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-orange-500" />
                </div>
              </Card>
              <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Tasa de completitud</p>
                    <p className="text-3xl font-black text-[#1B1B2F]" style={{ fontFamily: 'Unbounded, sans-serif' }}>{metrics.completion_rate}%</p>
                  </div>
                  <Target className="w-12 h-12 text-pink-500" />
                </div>
              </Card>
            </div>
          )}

          {/* Gráficos de Series Temporales */}
          <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-black text-[#1B1B2F]" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                {timeSeriesMetric === 'games' && 'Juegos Realizados en el Tiempo'}
                {timeSeriesMetric === 'professors' && 'Profesores Registrados en el Tiempo'}
                {timeSeriesMetric === 'students' && 'Estudiantes Registrados en el Tiempo'}
              </h2>
              <div className="flex gap-2">
                <select
                  value={timeSeriesMetric}
                  onChange={(e) => setTimeSeriesMetric(e.target.value as any)}
                  className="px-3 py-2 border rounded-lg text-sm bg-white"
                  disabled={timeSeriesLoading}
                >
                  <option value="games">Juegos</option>
                  <option value="professors">Profesores</option>
                  <option value="students">Estudiantes</option>
                </select>
                <select
                  value={timeSeriesPeriod}
                  onChange={(e) => setTimeSeriesPeriod(e.target.value as any)}
                  className="px-3 py-2 border rounded-lg text-sm bg-white"
                  disabled={timeSeriesLoading}
                >
                  <option value="year">Año</option>
                  <option value="month">Mes</option>
                  <option value="week">Semana</option>
                  <option value="day">Día</option>
                </select>
              </div>
            </div>
            {timeSeriesLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Cargando datos...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart 
                  key={`${timeSeriesMetric}-${timeSeriesPeriod}`}
                  data={getTimeSeriesChartData()}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#666"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={timeSeriesPeriod === 'day' ? 'preserveStartEnd' : 0}
                  />
                  <YAxis stroke="#666" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #ccc',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#2563EB"
                    strokeWidth={3}
                    dot={{ fill: '#2563EB', r: 4 }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                    name={
                      timeSeriesMetric === 'games' ? 'Juegos' :
                      timeSeriesMetric === 'professors' ? 'Profesores' :
                      'Estudiantes'
                    }
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Completación de Juegos */}
          {gameCompletion && (
            <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-black text-[#1B1B2F]" style={{ fontFamily: 'Unbounded, sans-serif' }}>Completación de Juegos</h2>
                {completionDrillDown !== 'main' && (
                  <Button
                    onClick={() => {
                      setCompletionDrillDown('main');
                      setCancellationReasons(null);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Volver
                  </Button>
                )}
              </div>

              {completionDrillDown === 'main' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Completadas', value: gameCompletion.completed.count, color: COMPLETION_COLORS.completed },
                          { name: 'Canceladas', value: gameCompletion.cancelled.count, color: COMPLETION_COLORS.cancelled, clickable: true },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        onClick={(data: any) => {
                          if (data.name === 'Canceladas') {
                            loadCancellationReasons();
                          }
                        }}
                      >
                        {[
                          { name: 'Completadas', value: gameCompletion.completed.count },
                          { name: 'Canceladas', value: gameCompletion.cancelled.count },
                        ].map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.name === 'Completadas' ? COMPLETION_COLORS.completed : COMPLETION_COLORS.cancelled}
                            style={entry.name === 'Canceladas' ? { cursor: 'pointer' } : {}}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Completadas</p>
                      <p className="text-2xl font-bold text-green-700">
                        {gameCompletion.completed.count} ({gameCompletion.completed.percentage}%)
                      </p>
                    </div>
                    <div 
                      className="p-4 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                      onClick={loadCancellationReasons}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Canceladas</p>
                          <p className="text-2xl font-bold text-red-700">
                            {gameCompletion.cancelled.count} ({gameCompletion.cancelled.percentage}%)
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-red-700" />
                      </div>
                      <p className="text-xs text-red-600 mt-2">Haz clic para ver motivos</p>
                    </div>
                  </div>
                </div>
              ) : (
                // Vista de Motivos de Cancelación con Gráficos
                <div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      Total de sesiones canceladas: <span className="font-semibold text-gray-800">{cancellationReasons?.total_cancelled || 0}</span>
                    </p>
                  </div>
                  {loadingCancellationReasons ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                    </div>
                  ) : cancellationReasons && cancellationReasons.reasons.length === 0 ? (
                    <p className="text-center text-gray-500 py-12">No hay motivos de cancelación registrados</p>
                  ) : cancellationReasons ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={cancellationReasons.reasons.map((reason, index) => ({
                              name: reason.reason,
                              value: reason.count,
                              percentage: reason.percentage,
                              color: CHART_COLORS[index % CHART_COLORS.length]
                            }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {cancellationReasons.reasons.map((reason, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string, props: any) => [
                              `${value} sesiones (${props.payload.percentage}%)`,
                              props.payload.name
                            ]}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-3">
                        {cancellationReasons.reasons.map((reason, index) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-800">{reason.reason}</p>
                                <p className="text-xs text-gray-600 mt-1">
                                  {reason.count} sesión{reason.count !== 1 ? 'es' : ''} ({reason.percentage}%)
                                </p>
                              </div>
                              <div 
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </Card>
          )}

          {/* Duración por Etapas (Interactivo) */}
          <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-black text-[#1B1B2F]" style={{ fontFamily: 'Unbounded, sans-serif' }}>Duración Promedio por Etapa</h2>
              {durationDrillDown !== 'main' && (
                <Button
                  onClick={() => {
                    if (durationDrillDown === 'activity') {
                      setDurationDrillDown('stage');
                      setSelectedActivity(null);
                      setActivityAnalysis(null);
                    } else if (durationDrillDown === 'stage') {
                      setDurationDrillDown('main');
                      setSelectedStage(null);
                      setActivities([]);
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
              )}
            </div>

            {durationDrillDown === 'main' && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stages} layout="vertical" margin={HORIZONTAL_BAR_CONFIG.margin}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="stage_name" 
                    type="category" 
                    width={HORIZONTAL_BAR_CONFIG.yAxis.width}
                    tick={HORIZONTAL_BAR_CONFIG.yAxis.tick}
                  />
                  <Tooltip formatter={(value: number) => formatDuration(value)} />
                  <Bar
                    dataKey="avg_duration_seconds"
                    fill="#667eea"
                    onClick={(data: Stage) => loadStageActivities(data.stage_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {stages.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {durationDrillDown === 'stage' && selectedStage && (
              <div>
                <p className="text-lg font-semibold mb-4">
                  Actividades de {selectedStage.stage_name}
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={activities} layout="vertical" margin={HORIZONTAL_BAR_CONFIG.margin}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="activity_name" 
                      type="category" 
                      width={HORIZONTAL_BAR_CONFIG.yAxis.width}
                      tick={HORIZONTAL_BAR_CONFIG.yAxis.tick}
                    />
                    <Tooltip formatter={(value: number) => formatDuration(value)} />
                    <Bar
                      dataKey="avg_duration_seconds"
                      fill="#4facfe"
                      onClick={(data: Activity) => loadActivityAnalysis(data.activity_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {activities.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {durationDrillDown === 'activity' && selectedActivity && activityAnalysis && (
              <div className="space-y-6">
                <p className="text-lg font-semibold">Análisis Detallado: {selectedActivity.activity_name}</p>
                
                {/* Estadísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Mínimo</p>
                    <p className="text-xl font-bold text-blue-700">
                      {formatDuration(activityAnalysis.statistics.min)}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Máximo</p>
                    <p className="text-xl font-bold text-green-700">
                      {formatDuration(activityAnalysis.statistics.max)}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">Promedio</p>
                    <p className="text-xl font-bold text-purple-700">
                      {formatDuration(activityAnalysis.statistics.avg)}
                    </p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-gray-600">Mediana</p>
                    <p className="text-xl font-bold text-orange-700">
                      {formatDuration(activityAnalysis.statistics.median)}
                    </p>
                  </div>
                </div>

                {/* Histograma */}
                {activityAnalysis.histogram && activityAnalysis.histogram.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold mb-2">Distribución de Tiempos</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={activityAnalysis.histogram} layout="vertical" margin={HORIZONTAL_BAR_CONFIG.margin}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="bin_start" 
                          type="category" 
                          width={HORIZONTAL_BAR_CONFIG.yAxis.width}
                          tick={HORIZONTAL_BAR_CONFIG.yAxis.tick}
                        />
                        <Tooltip />
                        <Bar dataKey="count" fill="#667eea" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Temas Más Seleccionados (Interactivo) */}
          <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-black text-[#1B1B2F]" style={{ fontFamily: 'Unbounded, sans-serif' }}>Temas Más Seleccionados</h2>
              {topicDrillDown !== 'main' && (
                <Button
                  onClick={() => {
                    if (topicDrillDown === 'challenge') {
                      setTopicDrillDown('topic');
                      setSelectedChallenge(null);
                      setChallengeAnalysis(null);
                    } else if (topicDrillDown === 'topic') {
                      setTopicDrillDown('main');
                      setSelectedTopic(null);
                      setChallenges([]);
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
              )}
            </div>

            {topicDrillDown === 'main' && (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topics}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ topic_name, selection_count }) => `${topic_name}: ${selection_count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="selection_count"
                    onClick={(data: Topic) => loadTopicChallenges(data.topic_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {topics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}

            {topicDrillDown === 'topic' && selectedTopic && (
              <div>
                <p className="text-lg font-semibold mb-4">
                  Desafíos de {selectedTopic.topic_name}
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={challenges} layout="vertical" margin={{ ...HORIZONTAL_BAR_CONFIG.margin, left: 200 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="challenge_title" 
                      type="category" 
                      width={180}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        maxWidth: '300px',
                        wordWrap: 'break-word'
                      }}
                    />
                    <Bar
                      dataKey="selection_count"
                      fill="#f093fb"
                      onClick={(data: Challenge) => loadChallengeAnalysis(data.challenge_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {challenges.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {topicDrillDown === 'challenge' && selectedChallenge && challengeAnalysis && (
              <div className="space-y-4">
                <p className="text-lg font-semibold">Análisis: {selectedChallenge.challenge_title}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Selecciones</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {selectedChallenge.selection_count}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Tokens Promedio</p>
                    <p className="text-2xl font-bold text-green-700">
                      {selectedChallenge.avg_tokens_earned.toFixed(0)}
                    </p>
                  </div>
                </div>
                {challengeAnalysis.selection_frequency && challengeAnalysis.selection_frequency.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold mb-2">Frecuencia de Selección</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={challengeAnalysis.selection_frequency}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#667eea" fill="#667eea" fillOpacity={0.6} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Juegos por Facultad (Interactivo) */}
          <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-black text-[#1B1B2F]" style={{ fontFamily: 'Unbounded, sans-serif' }}>Juegos por Facultad</h2>
              {facultyDrillDown !== 'main' && (
                <Button
                  onClick={() => {
                    setFacultyDrillDown('main');
                    setSelectedFaculty(null);
                    setCareers([]);
                  }}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
              )}
            </div>

            {facultyDrillDown === 'main' && (
              <>
                {faculties.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    <p>No hay datos de facultades disponibles</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={faculties} layout="vertical" margin={HORIZONTAL_BAR_CONFIG.margin}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="faculty_name" 
                        type="category" 
                        width={HORIZONTAL_BAR_CONFIG.yAxis.width}
                        tick={HORIZONTAL_BAR_CONFIG.yAxis.tick}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="games_count"
                        fill="#667eea"
                        onClick={(data: { faculty_id: number; faculty_name: string; games_count: number }) => 
                          loadFacultyCareers(data.faculty_id)
                        }
                        style={{ cursor: 'pointer' }}
                      >
                        {faculties.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </>
            )}

            {facultyDrillDown === 'careers' && selectedFaculty && (
              <div>
                <p className="text-lg font-semibold mb-4">
                  Carreras de {selectedFaculty.faculty_name}
                </p>
                {careers.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    <p>No hay carreras disponibles para esta facultad</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={careers} layout="vertical" margin={HORIZONTAL_BAR_CONFIG.margin}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="career_name" 
                        type="category" 
                        width={HORIZONTAL_BAR_CONFIG.yAxis.width}
                        tick={HORIZONTAL_BAR_CONFIG.yAxis.tick}
                      />
                      <Tooltip />
                      <Bar dataKey="games_count" fill="#4facfe">
                        {careers.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </Card>

          {/* Análisis de Evaluaciones */}
          {evaluationResponseRate && (
            <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Tasa de Respuesta de Evaluaciones</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total que jugaron</p>
                    <p className="text-3xl font-bold text-blue-700">
                      {evaluationResponseRate.total_played}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total que respondieron</p>
                    <p className="text-3xl font-bold text-green-700">
                      {evaluationResponseRate.total_responded}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">Tasa de respuesta</p>
                    <p className="text-3xl font-bold text-purple-700">
                      {evaluationResponseRate.response_rate}%
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={[
                      { name: 'Jugaron', value: evaluationResponseRate.total_played - evaluationResponseRate.total_responded },
                      { name: 'Respondieron', value: evaluationResponseRate.total_responded },
                    ]}
                    layout="vertical"
                    margin={HORIZONTAL_BAR_CONFIG.margin}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={HORIZONTAL_BAR_CONFIG.yAxis.width}
                      tick={HORIZONTAL_BAR_CONFIG.yAxis.tick}
                    />
                    <Tooltip />
                    <Bar dataKey="value" fill="#667eea" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Respuestas de Evaluación */}
          {evaluationAnswers && (
            <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Distribución de Respuestas</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Áreas de Valor */}
                {evaluationAnswers.value_areas && (
                  <div>
                    <h3 className="text-md font-semibold mb-2">Áreas de Valor</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={Object.entries(evaluationAnswers.value_areas).map(([name, value]) => ({
                          name,
                          value,
                        }))}
                        layout="vertical"
                        margin={HORIZONTAL_BAR_CONFIG.margin}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={HORIZONTAL_BAR_CONFIG.yAxis.width}
                          tick={HORIZONTAL_BAR_CONFIG.yAxis.tick}
                        />
                        <Tooltip />
                        <Bar dataKey="value" fill="#4facfe" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Satisfacción */}
                {evaluationAnswers.satisfaction && (
                  <div>
                    <h3 className="text-md font-semibold mb-2">Satisfacción</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={evaluationAnswers.satisfaction.map((item: any) => ({
                          name: item.satisfaction || 'Sin respuesta',
                          value: item.count,
                        }))}
                        layout="vertical"
                        margin={HORIZONTAL_BAR_CONFIG.margin}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={HORIZONTAL_BAR_CONFIG.yAxis.width}
                          tick={HORIZONTAL_BAR_CONFIG.yAxis.tick}
                        />
                        <Tooltip />
                        <Bar dataKey="value" fill="#43e97b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Interés en Emprender */}
                {evaluationAnswers.entrepreneurship_interest && (
                  <div>
                    <h3 className="text-md font-semibold mb-2">Interés en Emprender</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={evaluationAnswers.entrepreneurship_interest.map((item: any) => ({
                          name: item.entrepreneurship_interest || 'Sin respuesta',
                          value: item.count,
                        }))}
                        layout="vertical"
                        margin={HORIZONTAL_BAR_CONFIG.margin}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={HORIZONTAL_BAR_CONFIG.yAxis.width}
                          tick={HORIZONTAL_BAR_CONFIG.yAxis.tick}
                        />
                        <Tooltip />
                        <Bar dataKey="value" fill="#fa709a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Comentarios */}
          <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/80">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Comentarios de Estudiantes</h2>
            <div className="space-y-4">
              {evaluationComments.length > 0 ? (
                evaluationComments.map((comment: any) => (
                  <div key={comment.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">{comment.student_name}</p>
                        <p className="text-sm text-gray-600">{comment.student_email}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Sesión: {comment.session_room_code} • {new Date(comment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-700 mt-2">{comment.comment}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No hay comentarios disponibles</p>
              )}
              <div className="flex items-center justify-between mt-4">
                <Button
                  onClick={() => {
                    if (commentsPage > 1) {
                      setCommentsPage(commentsPage - 1);
                      loadComments();
                    }
                  }}
                  disabled={commentsPage === 1}
                  variant="outline"
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-600">Página {commentsPage}</span>
                <Button
                  onClick={() => {
                    setCommentsPage(commentsPage + 1);
                    loadComments();
                  }}
                  variant="outline"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
