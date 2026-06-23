import { api, unwrapResults } from './api';

export const reflectionEvaluationsAPI = {
  byRoom: async (roomCode: string) => {
    const response = await api.get(`/sessions/reflection-evaluations/by_room/?room_code=${roomCode}`);
    // El endpoint by_room devuelve un objeto con count, total_students, etc.
    // No usar unwrapResults aquí porque necesitamos toda la información
    return response.data;
  },

  create: async (data: {
    room_code: string;
    student_name?: string;
    student_email?: string;
    faculty?: string | number;
    career?: string | number;
    satisfaction: string;
    entrepreneurship_interest: string;
    value_areas?: string[];
    feedback?: string;
    comments?: string;
  }) => {
    const response = await api.post('/sessions/reflection-evaluations/', data);
    return response.data;
  },
};

