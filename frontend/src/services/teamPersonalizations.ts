import { api, unwrapResults } from './api';

// Matches game_sessions/serializers.py's TeamPersonalizationSerializer.
export interface TeamPersonalization {
  team: string;
  team_name_display: string;
  team_name?: string | null;
  team_members_know_each_other?: boolean | null;
  created_at: string;
  updated_at: string;
}

export const teamPersonalizationsAPI = {
  list: async (params?: Record<string, any>): Promise<TeamPersonalization[]> => {
    const response = await api.get('/sessions/team-personalizations/', { params });
    return unwrapResults<TeamPersonalization[]>(response.data);
  },

  create: async (data: {
    team: string;
    team_name: string;
    team_members_know_each_other: boolean;
  }) => {
    const response = await api.post('/sessions/team-personalizations/', data);
    return response.data;
  },

  createOrUpdate: async (data: {
    team: string;
    team_name: string;
    team_members_know_each_other: boolean;
  }) => {
    const response = await api.post('/sessions/team-personalizations/', data);
    return response.data;
  },
};

