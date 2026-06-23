import { api } from './api';

export const sessionStagesAPI = {
  generatePresentationOrder: async (stageId: number) => {
    const response = await api.post(`/sessions/session-stages/${stageId}/generate_presentation_order/`);
    return response.data;
  },

  updatePresentationOrder: async (stageId: number, presentationOrder: number[]) => {
    const response = await api.post(`/sessions/session-stages/${stageId}/update_presentation_order/`, {
      presentation_order: presentationOrder,
    });
    return response.data;
  },

  startPresentation: async (stageId: number) => {
    const response = await api.post(`/sessions/session-stages/${stageId}/start_presentation/`);
    return response.data;
  },

  startTeamPitch: async (stageId: number) => {
    const response = await api.post(`/sessions/session-stages/${stageId}/start_team_pitch/`);
    return response.data;
  },

  finishTeamPresentation: async (stageId: number) => {
    const response = await api.post(`/sessions/session-stages/${stageId}/finish_team_presentation/`);
    return response.data;
  },

  nextPresentation: async (stageId: number) => {
    const response = await api.post(`/sessions/session-stages/${stageId}/next_presentation/`);
    return response.data;
  },

  getPresentationTimer: async (stageId: number) => {
    const response = await api.get(`/sessions/session-stages/${stageId}/presentation_timer/`);
    return response.data;
  },

  getPresentationStatus: async (stageId: number) => {
    const response = await api.get(`/sessions/session-stages/${stageId}/presentation_status/`);
    return response.data;
  },

  getPresentationEvaluationProgress: async (stageId: number) => {
    const response = await api.get(`/sessions/session-stages/${stageId}/presentation_evaluation_progress/`);
    return response.data;
  },
};






