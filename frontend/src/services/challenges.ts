import { api, unwrapResults } from './api';

export const challengesAPI = {
  getLearningObjectives: async () => {
    const response = await api.get('/challenges/learning-objectives/');
    return unwrapResults(response.data);
  },

  getActivities: async (params?: Record<string, any>) => {
    const response = await api.get('/challenges/activities/', { params });
    return unwrapResults(response.data);
  },

  getActivityById: async (activityId: number | string) => {
    const response = await api.get(`/challenges/activities/${activityId}/`);
    return response.data;
  },

  getChallengeById: async (challengeId: number | string) => {
    const response = await api.get(`/challenges/challenges/${challengeId}/`);
    return response.data;
  },

  getTopics: async (params?: Record<string, any>) => {
    const response = await api.get('/challenges/topics/', { params });
    return unwrapResults(response.data);
  },

  getTopicById: async (topicId: number | string) => {
    const response = await api.get(`/challenges/topics/${topicId}/`);
    return response.data;
  },

  getChallenges: async (params?: Record<string, any>) => {
    const response = await api.get('/challenges/challenges/', { params });
    return unwrapResults(response.data);
  },

  updateActivity: async (activityId: number | string, data: Partial<{
    name?: string;
    description?: string | null;
    order_number?: number;
    timer_duration?: number | null;
    is_active?: boolean;
    config_data?: any;
  }>) => {
    const response = await api.patch(`/challenges/activities/${activityId}/`, data);
    return response.data;
  },

  // Topics CRUD
  createTopic: async (data: {
    name: string;
    icon?: string;
    description?: string;
    image_url?: string;
    category?: string;
    faculty_ids?: number[];
    is_active?: boolean;
  }) => {
    const response = await api.post('/challenges/topics/', data);
    return response.data;
  },

  updateTopic: async (topicId: number | string, data: Partial<{
    name?: string;
    icon?: string;
    description?: string;
    image_url?: string;
    category?: string;
    faculty_ids?: number[];
    is_active?: boolean;
  }>) => {
    const response = await api.patch(`/challenges/topics/${topicId}/`, data);
    return response.data;
  },

  deleteTopic: async (topicId: number | string) => {
    const response = await api.delete(`/challenges/topics/${topicId}/`);
    return response.data;
  },

  // Challenges CRUD
  createChallenge: async (data: {
    topic: number;
    title: string;
    description?: string;
    icon?: string;
    persona_name?: string;
    persona_age?: number;
    persona_story?: string;
    persona_image?: File | null;
    difficulty_level?: 'low' | 'medium' | 'high';
    learning_objectives?: string;
    additional_resources?: string;
    is_active?: boolean;
  }) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (key === 'persona_image' && data[key] instanceof File) {
        formData.append(key, data[key]);
      } else if (data[key as keyof typeof data] !== undefined && data[key as keyof typeof data] !== null) {
        formData.append(key, String(data[key as keyof typeof data]));
      }
    });
    const response = await api.post('/challenges/challenges/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateChallenge: async (challengeId: number | string, data: Partial<{
    topic?: number;
    title?: string;
    description?: string;
    icon?: string;
    persona_name?: string;
    persona_age?: number;
    persona_story?: string;
    persona_image?: File | null;
    difficulty_level?: 'low' | 'medium' | 'high';
    learning_objectives?: string;
    additional_resources?: string;
    is_active?: boolean;
  }>) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (key === 'persona_image' && data[key] instanceof File) {
        formData.append(key, data[key]);
      } else if (data[key as keyof typeof data] !== undefined && data[key as keyof typeof data] !== null) {
        formData.append(key, String(data[key as keyof typeof data]));
      }
    });
    const response = await api.patch(`/challenges/challenges/${challengeId}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteChallenge: async (challengeId: number | string) => {
    const response = await api.delete(`/challenges/challenges/${challengeId}/`);
    return response.data;
  },

  // Word Search Options CRUD
  getWordSearchOptions: async (activityId?: number | string) => {
    const params = activityId ? { activity: activityId } : {};
    const response = await api.get('/challenges/word-search-options/', { params });
    return unwrapResults(response.data);
  },

  generateWordSearchPreview: async (data: { words: string[]; name: string }) => {
    const response = await api.post('/challenges/word-search-options/generate_preview/', data);
    return response.data;
  },

  confirmWordSearch: async (data: {
    words: string[];
    name: string;
    grid: string[][];
    word_positions: any[];
    seed: number;
    activity_id: number;
  }) => {
    const response = await api.post('/challenges/word-search-options/confirm_and_save/', data);
    return response.data;
  },

  deleteWordSearchOption: async (optionId: number | string) => {
    const response = await api.delete(`/challenges/word-search-options/${optionId}/`);
    return response.data;
  },

  getRandomWordSearch: async (activityId: number | string) => {
    const response = await api.get('/challenges/word-search-options/random/', {
      params: { activity_id: activityId },
    });
    return response.data;
  },

  // Anagram Words CRUD
  getAnagramWords: async () => {
    const response = await api.get('/challenges/anagram-words/');
    return unwrapResults(response.data);
  },

  createAnagramWord: async (data: { word: string; is_active?: boolean }) => {
    const response = await api.post('/challenges/anagram-words/', data);
    return response.data;
  },

  updateAnagramWord: async (wordId: number | string, data: Partial<{
    word?: string;
    is_active?: boolean;
  }>) => {
    const response = await api.patch(`/challenges/anagram-words/${wordId}/`, data);
    return response.data;
  },

  deleteAnagramWord: async (wordId: number | string) => {
    const response = await api.delete(`/challenges/anagram-words/${wordId}/`);
    return response.data;
  },

  getRandomAnagramWords: async (count: number = 5) => {
    const response = await api.get('/challenges/anagram-words/random/', {
      params: { count },
    });
    return response.data;
  },

  // Chaos Questions CRUD
  getChaosQuestions: async () => {
    const response = await api.get('/challenges/chaos-questions/');
    return unwrapResults(response.data);
  },

  createChaosQuestion: async (data: { question: string; is_active?: boolean }) => {
    const response = await api.post('/challenges/chaos-questions/', data);
    return response.data;
  },

  updateChaosQuestion: async (questionId: number | string, data: Partial<{
    question?: string;
    is_active?: boolean;
  }>) => {
    const response = await api.patch(`/challenges/chaos-questions/${questionId}/`, data);
    return response.data;
  },

  deleteChaosQuestion: async (questionId: number | string) => {
    const response = await api.delete(`/challenges/chaos-questions/${questionId}/`);
    return response.data;
  },

  getRandomChaosQuestion: async (excludeIds: number[] = []) => {
    const params: any = {};
    if (excludeIds.length > 0) {
      params.exclude_ids = excludeIds.join(',');
    }
    const response = await api.get('/challenges/chaos-questions/random/', { params });
    return response.data;
  },

  // General Knowledge Questions CRUD
  getGeneralKnowledgeQuestions: async () => {
    const response = await api.get('/challenges/general-knowledge-questions/');
    return unwrapResults(response.data);
  },

  createGeneralKnowledgeQuestion: async (data: {
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: number; // 0=A, 1=B, 2=C, 3=D
    is_active?: boolean;
  }) => {
    const response = await api.post('/challenges/general-knowledge-questions/', data);
    return response.data;
  },

  updateGeneralKnowledgeQuestion: async (questionId: number | string, data: Partial<{
    question?: string;
    option_a?: string;
    option_b?: string;
    option_c?: string;
    option_d?: string;
    correct_answer?: number;
    is_active?: boolean;
  }>) => {
    const response = await api.patch(`/challenges/general-knowledge-questions/${questionId}/`, data);
    return response.data;
  },

  deleteGeneralKnowledgeQuestion: async (questionId: number | string) => {
    const response = await api.delete(`/challenges/general-knowledge-questions/${questionId}/`);
    return response.data;
  },

  getRandomGeneralKnowledgeQuestions: async (count: number = 5) => {
    const response = await api.get('/challenges/general-knowledge-questions/random/', {
      params: { count },
    });
    return response.data;
  },
};

