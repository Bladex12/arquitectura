import { api, unwrapResults } from './api';

export const academicAPI = {
  getFaculties: async () => {
    const response = await api.get('/academic/faculties/');
    return unwrapResults(response.data);
  },

  getCareers: async (facultyId: string) => {
    const response = await api.get('/academic/careers/', {
      params: { faculty: facultyId },
    });
    return unwrapResults(response.data);
  },

};

