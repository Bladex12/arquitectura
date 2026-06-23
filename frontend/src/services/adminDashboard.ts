import { api } from './api';

export const adminDashboardAPI = {
  // Métricas generales (KPI)
  getMetrics: async () => {
    const response = await api.get('/admin/dashboard/metrics/');
    return response.data;
  },

  // Series temporales
  getTimeSeries: async (params: {
    metric: 'games' | 'professors' | 'students';
    period: 'year' | 'month' | 'week' | 'day';
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await api.get('/admin/dashboard/time_series/', { params });
    return response.data;
  },

  // Completación de juegos
  getGameCompletion: async () => {
    const response = await api.get('/admin/dashboard/game_completion/');
    return response.data;
  },

  // Duración por etapas (interactivo)
  getStageDuration: async () => {
    const response = await api.get('/admin/dashboard/stage_duration/');
    return response.data;
  },

  getStageActivitiesDuration: async (stageId: number | string) => {
    const response = await api.get(`/admin/dashboard/${stageId}/stage_activities_duration/`);
    return response.data;
  },

  getActivityDurationAnalysis: async (activityId: number | string) => {
    const response = await api.get(`/admin/dashboard/${activityId}/activity_duration_analysis/`);
    return response.data;
  },

  // Temas y desafíos (interactivo)
  getTopicsSelection: async () => {
    const response = await api.get('/admin/dashboard/topics_selection/');
    return response.data;
  },

  getTopicChallenges: async (topicId: number | string) => {
    const response = await api.get(`/admin/dashboard/${topicId}/topic_challenges/`);
    return response.data;
  },

  getChallengeAnalysis: async (challengeId: number | string) => {
    const response = await api.get(`/admin/dashboard/${challengeId}/challenge_analysis/`);
    return response.data;
  },

  // Evaluaciones
  getEvaluationResponseRate: async () => {
    const response = await api.get('/admin/dashboard/evaluation_response_rate/');
    return response.data;
  },

  getEvaluationAnswers: async () => {
    const response = await api.get('/admin/dashboard/evaluation_answers/');
    return response.data;
  },

  getEvaluationComments: async (params?: {
    session_id?: number | string;
    search?: string;
    date_from?: string;
    page?: number;
    page_size?: number;
  }) => {
    const response = await api.get('/admin/dashboard/evaluation_comments/', { params });
    return response.data;
  },

  // Facultades y carreras (interactivo)
  getFacultiesGames: async () => {
    const response = await api.get('/admin/dashboard/faculties_games/');
    return response.data;
  },

  getFacultyCareersGames: async (facultyId: number | string) => {
    const response = await api.get(`/admin/dashboard/${facultyId}/faculty_careers_games/`);
    return response.data;
  },

  // Motivos de cancelación
  getCancellationReasons: async () => {
    const response = await api.get('/admin/dashboard/cancellation_reasons/');
    return response.data;
  },
};

