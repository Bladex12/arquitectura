import { api, unwrapResults } from './api';

export const teamsAPI = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get('/sessions/teams/', { params });
    return unwrapResults(response.data);
  },

  moveStudent: async (teamId: string, studentId: number, targetTeamId: string, roomCode: string) => {
    const response = await api.post(`/sessions/teams/${teamId}/move_student/`, {
      game_session: roomCode,
      student_id: studentId,
      target_team_id: targetTeamId,
    });
    return response.data;
  },

  // NOTE: no call sites use this today (Lobby.tsx shuffles client-side and calls
  // sessionsAPI.syncTeams instead). Backend expects `game_session` (room_code
  // string), not `game_session_id` -- fix the payload key if this is ever wired up.
  shuffleAll: async (gameSessionId: string) => {
    const response = await api.post('/sessions/teams/shuffle_all/', {
      game_session_id: gameSessionId,
    });
    return response.data;
  },
};

