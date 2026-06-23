import { api, unwrapResults } from './api';

export const teamsAPI = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get('/sessions/teams/', { params });
    return unwrapResults(response.data);
  },

  moveStudent: async (teamId: number, studentId: number, targetTeamId: number) => {
    const response = await api.post(`/sessions/teams/${teamId}/move_student/`, {
      student_id: studentId,
      target_team_id: targetTeamId,
    });
    return response.data;
  },

  shuffleAll: async (gameSessionId: number) => {
    const response = await api.post('/sessions/teams/shuffle_all/', {
      game_session_id: gameSessionId,
    });
    return response.data;
  },
};

