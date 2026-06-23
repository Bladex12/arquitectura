import { api, unwrapResults } from './api';

export const sessionsAPI = {
  getActiveSession: async () => {
    const response = await api.get('/sessions/game-sessions/active_session/');
    return response.data;
  },

  getById: async (sessionId: number | string) => {
    const response = await api.get(`/sessions/game-sessions/${sessionId}/`);
    return response.data;
  },

  list: async (params?: Record<string, any>) => {
    const response = await api.get('/sessions/game-sessions/', { params });
    return unwrapResults(response.data);
  },

  getTeams: async (sessionId: number | string) => {
    const response = await api.get(`/sessions/game-sessions/${sessionId}/teams/`);
    return response.data;
  },

  getActivityTimer: async (sessionId: number | string) => {
    const response = await api.get(`/sessions/game-sessions/${sessionId}/activity_timer/`);
    return response.data;
  },

  completeStage: async (sessionId: number | string, stageNumber: number) => {
    const response = await api.post(`/sessions/game-sessions/${sessionId}/complete_stage/`, {
      stage_number: stageNumber,
    });
    return response.data;
  },

  nextActivity: async (sessionId: number | string) => {
    const response = await api.post(`/sessions/game-sessions/${sessionId}/next_activity/`);
    return response.data;
  },

  processExcel: async (formData: FormData) => {
    const response = await api.post('/sessions/game-sessions/process_excel/', formData);
    return response.data;
  },

  createWithExcel: async (formData: FormData) => {
    const response = await api.post('/sessions/game-sessions/create_with_excel/', formData);
    return response.data;
  },

  finish: async (sessionId: number, cancellationReason: string, cancellationReasonOther?: string) => {
    const response = await api.post(
      `/sessions/game-sessions/${sessionId}/end/`,
      {
        cancellation_reason: cancellationReason,
        cancellation_reason_other: cancellationReasonOther || '',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },

  getSessionStages: async (gameSessionId: number, params?: Record<string, any>) => {
    const response = await api.get('/sessions/session-stages/', {
      params: { game_session: gameSessionId, ...params },
    });
    return unwrapResults(response.data);
  },

  getLobby: async (sessionId: number | string) => {
    const response = await api.get(`/sessions/game-sessions/${sessionId}/lobby/`);
    return response.data;
  },

  start: async (sessionId: number | string) => {
    const response = await api.post(`/sessions/game-sessions/${sessionId}/start/`);
    return response.data;
  },

  syncTeams: async (
    sessionId: number | string,
    teams: { id?: number; name: string; color: string; student_ids: number[] }[]
  ) => {
    const response = await api.post(`/sessions/game-sessions/${sessionId}/sync_teams/`, { teams });
    return response.data;
  },

  getReflectionQR: async (sessionId: number | string) => {
    const response = await api.get(`/sessions/game-sessions/${sessionId}/reflection_qr/`);
    return response.data;
  },

  startStage1: async (sessionId: number | string) => {
    const response = await api.post(`/sessions/game-sessions/${sessionId}/start_stage_1/`);
    return response.data;
  },

  setVideoInstitucionalActivity: async (sessionId: number | string) => {
    const response = await api.post(`/sessions/game-sessions/${sessionId}/set_video_institucional_activity/`);
    return response.data;
  },

  setInstructivoActivity: async (sessionId: number | string) => {
    const response = await api.post(`/sessions/game-sessions/${sessionId}/set_instructivo_activity/`);
    return response.data;
  },

  getStageResults: async (sessionId: number | string, stageId?: number) => {
    const params = stageId ? { stage_id: stageId } : {};
    const response = await api.get(`/sessions/game-sessions/${sessionId}/stage_results/`, { params });
    return response.data;
  },

  nextStage: async (sessionId: number | string) => {
    const response = await api.post(`/sessions/game-sessions/${sessionId}/next_stage/`);
    return response.data;
  },

  showResults: async (sessionId: number | string, stage: number) => {
    const response = await api.post(`/sessions/game-sessions/${sessionId}/show_results/`, { stage });
    return response.data;
  },

  startReflection: async (sessionId: number | string) => {
    const response = await api.post(`/sessions/game-sessions/${sessionId}/start_reflection/`);
    return response.data;
  },
};

