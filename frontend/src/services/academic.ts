import { api, unwrapResults } from './api';

export interface Faculty {
  id: string;
  name: string;
  code?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Matches academic/serializers.py's CareerListSerializer -- the `list`
// action (this endpoint) uses that leaner serializer, not the full
// CareerSerializer used by retrieve/create/update.
export interface CareerListItem {
  id: string;
  name: string;
  faculty_name: string | null;
  code?: string | null;
  is_active: boolean;
}

export const academicAPI = {
  getFaculties: async (): Promise<Faculty[]> => {
    const response = await api.get('/academic/faculties/');
    return unwrapResults<Faculty[]>(response.data);
  },

  getCareers: async (facultyId: string): Promise<CareerListItem[]> => {
    const response = await api.get('/academic/careers/', {
      params: { faculty: facultyId },
    });
    return unwrapResults<CareerListItem[]>(response.data);
  },

};

