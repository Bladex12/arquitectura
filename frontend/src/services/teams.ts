import { api, unwrapResults } from './api';

// Matches game_sessions/serializers.py's TeamSerializer.
export interface Team {
  id: string;
  game_session: string;
  game_session_room_code: string;
  name: string;
  color: string;
  tokens_total: number;
  students: Array<{ id: string; full_name: string; email: string }>;
  students_count: number;
  created_at: string;
  updated_at: string;
}

export const teamsAPI = {
  list: async (params?: Record<string, any>): Promise<Team[]> => {
    const response = await api.get('/sessions/teams/', { params });
    return unwrapResults<Team[]>(response.data);
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

