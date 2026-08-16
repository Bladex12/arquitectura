import { api, unwrapResults } from './api';

// Matches game_sessions/serializers.py's PeerEvaluationSerializer. `id`
// is a computed "<evaluator_team_id>:<evaluated_team_id>", not the raw
// SK -- see that serializer's docstring for why (SK contains '#', a URL
// fragment delimiter that silently truncates any request built from it).
export interface PeerEvaluation {
  id: string;
  evaluator_team: string;
  evaluator_team_name: string | null;
  evaluated_team: string;
  evaluated_team_name: string | null;
  game_session: string;
  game_session_room_code: string;
  criteria_scores: any;
  total_score: number;
  tokens_awarded: number;
  feedback?: string | null;
  submitted_at: string;
}

export const peerEvaluationsAPI = {
  list: async (params?: Record<string, any>): Promise<PeerEvaluation[]> => {
    const response = await api.get('/sessions/peer-evaluations/', { params });
    return unwrapResults<PeerEvaluation[]>(response.data);
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











