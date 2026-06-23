import { api, unwrapResults } from './api';

export const teamPersonalizationsAPI = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get('/sessions/team-personalizations/', { params });
    return unwrapResults(response.data);
  },

  create: async (data: {
    team: number;
    team_name: string;
    team_members_know_each_other: boolean;
  }) => {
    const response = await api.post('/sessions/team-personalizations/', data);
    return response.data;
  },

  createOrUpdate: async (data: {
    team: number;
    team_name: string;
    team_members_know_each_other: boolean;
  }) => {
    const response = await api.post('/sessions/team-personalizations/', data);
    return response.data;
  },
};

