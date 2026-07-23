import { api, unwrapResults } from './api';

export const peerEvaluationsAPI = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get('/sessions/peer-evaluations/', { params });
    return unwrapResults(response.data);
  },

  create: async (data: {
    evaluator_team_id: string;
    evaluated_team_id: string;
    game_session_id: string;
    criteria_scores: {
      clarity: number;
      solution: number;
      presentation: number;
    };
    feedback?: string;
  }) => {
    const response = await api.post('/sessions/peer-evaluations/', data);
    return response.data;
  },

  forProfessor: async (gameSessionId: string) => {
    const response = await api.get(`/sessions/peer-evaluations/for_professor/?game_session_id=${gameSessionId}`);
    return response.data || [];
  },

  forTeam: async (teamId: string, gameSessionId: string) => {
    const response = await api.get(`/sessions/peer-evaluations/for_team/?team_id=${teamId}&game_session_id=${gameSessionId}`);
    return response.data || [];
  },
};











