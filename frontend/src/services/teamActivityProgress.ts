import { api, unwrapResults } from './api';

// Matches game_sessions/serializers.py's TeamActivityProgressSerializer.
// `id` is a colon-joined "<team_id>:<activity_id>", not the item's raw SK
// -- see that serializer's docstring for why (SK contains '#', a URL
// fragment delimiter that silently truncates any request built from it).
export interface TeamActivityProgress {
  id: string;
  team: string;
  team_name: string | null;
  session_stage: string | null;
  stage_name: string | null;
  activity: string;
  activity_name: string | null;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  progress_percentage: number;
  response_data?: any;
  selected_topic?: any;
  selected_challenge?: any;
  prototype_image_url?: string | null;
  pitch_intro_problem?: string | null;
  pitch_solution?: string | null;
  pitch_value?: string | null;
  pitch_impact?: string | null;
  pitch_closing?: string | null;
}

export const teamActivityProgressAPI = {
  list: async (params?: Record<string, any>): Promise<TeamActivityProgress[]> => {
    const response = await api.get('/sessions/team-activity-progress/', { params });
    return unwrapResults<TeamActivityProgress[]>(response.data);
  },

  uploadPrototype: async (formData: FormData) => {
    const response = await api.post('/sessions/team-activity-progress/upload_prototype/', formData);
    return response.data;
  },

  selectChallenge: async (formData: FormData) => {
    const response = await api.post('/sessions/team-activity-progress/select_challenge/', formData);
    return response.data;
  },

  create: async (data: {
    team: string;
    activity: number;
    session_stage: number;
    status?: string;
    response_data?: any;
  }) => {
    const response = await api.post('/sessions/team-activity-progress/', data);
    return response.data;
  },

  update: async (progressId: number | string, data: {
    status?: string;
    response_data?: any;
    progress_percentage?: number;
  }) => {
    const response = await api.patch(`/sessions/team-activity-progress/${progressId}/`, data);
    return response.data;
  },

  savePitch: async (data: {
    team_id: string;
    activity_id: number;
    session_stage_id: number | string;
    pitch_intro_problem?: string;
    pitch_solution?: string;
    pitch_value?: string;
    pitch_impact?: string;
    pitch_closing?: string;
  }) => {
    const response = await api.post('/sessions/team-activity-progress/save_pitch/', data);
    return response.data;
  },
};

