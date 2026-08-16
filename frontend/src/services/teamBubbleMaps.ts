import { api, unwrapResults } from './api';

// Matches game_sessions/serializers.py's TeamBubbleMapSerializer. `id` is
// a colon-joined "<team_id>:<session_stage_id>", not the item's raw SK --
// see that serializer's docstring for why (SK contains '#', a URL
// fragment delimiter that silently truncates any request built from it).
export interface TeamBubbleMap {
  id: string;
  team: string;
  team_name: string | null;
  session_stage: string;
  stage_name: string | null;
  map_data: any;
  created_at: string;
  updated_at: string;
}

export const teamBubbleMapsAPI = {
  list: async (params?: Record<string, any>): Promise<TeamBubbleMap[]> => {
    const response = await api.get('/sessions/team-bubble-maps/', { params });
    return unwrapResults<TeamBubbleMap[]>(response.data);
  },

  create: async (data: {
    team: string;
    session_stage: number | string;
    map_data: any;
  }) => {
    const response = await api.post('/sessions/team-bubble-maps/', data);
    return response.data;
  },

  update: async (bubbleMapId: string, data: { map_data: any }) => {
    const response = await api.patch(`/sessions/team-bubble-maps/${bubbleMapId}/`, data);
    return response.data;
  },

  finalize: async (teamId: string, sessionStageId: number | string) => {
    const response = await api.post('/sessions/team-bubble-maps/finalize_bubble_map/', {
      team: teamId,
      session_stage: sessionStageId,
    });
    return response.data;
  },
};











