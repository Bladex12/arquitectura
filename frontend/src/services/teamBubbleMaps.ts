import { api, unwrapResults } from './api';

export const teamBubbleMapsAPI = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get('/sessions/team-bubble-maps/', { params });
    return unwrapResults(response.data);
  },

  create: async (data: {
    team: number;
    session_stage: number;
    map_data: any;
  }) => {
    const response = await api.post('/sessions/team-bubble-maps/', data);
    return response.data;
  },

  update: async (bubbleMapId: number, data: { map_data: any }) => {
    const response = await api.patch(`/sessions/team-bubble-maps/${bubbleMapId}/`, data);
    return response.data;
  },

  finalize: async (teamId: number, sessionStageId: number) => {
    const response = await api.post('/sessions/team-bubble-maps/finalize_bubble_map/', {
      team: teamId,
      session_stage: sessionStageId,
    });
    return response.data;
  },
};











