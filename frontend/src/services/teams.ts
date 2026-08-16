import { api, unwrapResults } from './api';

export const teamsAPI = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get('/sessions/teams/', { params });
    return unwrapResults<any[]>(response.data);
  },

  moveStudent: async (teamId: string, studentId: number, targetTeamId: string, roomCode: string) => {
    const response = await api.post(`/sessions/teams/${teamId}/move_student/`, {
      game_session: roomCode,
      student_id: studentId,
      target_team_id: targetTeamId,
    });
    return response.data;
  },
};

