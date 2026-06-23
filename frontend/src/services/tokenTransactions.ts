import { api, unwrapResults } from './api';

export const tokenTransactionsAPI = {
  list: async (params?: Record<string, any>) => {
    const response = await api.get('/sessions/token-transactions/', { params });
    return unwrapResults(response.data);
  },
};











