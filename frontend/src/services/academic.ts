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

  getCourses: async (careerId: string) => {
    const response = await api.get('/academic/courses/', {
      params: { career: careerId },
    });
    return unwrapResults(response.data);
  },

  getCourseById: async (courseId: number | string) => {
    const response = await api.get(`/academic/courses/${courseId}/`);
    return response.data;
  },

  getCareerById: async (careerId: number | string) => {
    const response = await api.get(`/academic/careers/${careerId}/`);
    return response.data;
  },
};

