import { api, unwrapResults } from './api';

export const teamActivityProgressAPI = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get('/sessions/team-activity-progress/', { params });
    return unwrapResults(response.data);
  },

  uploadPrototype: async (formData: FormData) => {
    const response = await api.post('/sessions/team-activity-progress/upload_prototype/', formData);
    return response.data;
  },

  selectTopic: async (data: {
    team: number;
    activity: number;
    session_stage: number;
    topic: number;
  }) => {
    const response = await api.post('/sessions/team-activity-progress/select_topic/', data);
    return response.data;
  },

  selectChallenge: async (formData: FormData) => {
    const response = await api.post('/sessions/team-activity-progress/select_challenge/', formData);
    return response.data;
  },

  create: async (data: {
    team: number;
    activity: number;
    session_stage: number;
    status?: string;
    response_data?: any;
  }) => {
    const response = await api.post('/sessions/team-activity-progress/', data);
    return response.data;
  },

  update: async (progressId: number | string, data: {
    status?: string;
    response_data?: any;
    progress_percentage?: number;
  }) => {
    const response = await api.patch(`/sessions/team-activity-progress/${progressId}/`, data);
    return response.data;
  },

  savePitch: async (data: {
    team_id: number;
    activity_id: number;
    session_stage_id: number;
    pitch_intro_problem?: string;
    pitch_solution?: string;
    pitch_value?: string;
    pitch_impact?: string;
    pitch_closing?: string;
  }) => {
    const response = await api.post('/sessions/team-activity-progress/save_pitch/', data);
    return response.data;
  },
};

