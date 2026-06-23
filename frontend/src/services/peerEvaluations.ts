import { api, unwrapResults } from './api';

export const peerEvaluationsAPI = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get('/sessions/peer-evaluations/', { params });
    return unwrapResults(response.data);
  },

  create: async (data: {
    evaluator_team_id: number;
    evaluated_team_id: number;
    game_session_id: number;
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

  forProfessor: async (gameSessionId: number) => {
    const response = await api.get(`/sessions/peer-evaluations/for_professor/?game_session_id=${gameSessionId}`);
    return response.data || [];
  },

  forTeam: async (teamId: number, gameSessionId: number) => {
    const response = await api.get(`/sessions/peer-evaluations/for_team/?team_id=${teamId}&game_session_id=${gameSessionId}`);
    return response.data || [];
  },
};











