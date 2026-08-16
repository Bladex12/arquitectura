import { api, unwrapResults } from './api';

// unwrapResults<T> defaults to {} with no explicit type argument -- every
// list endpoint below is typed against its real Django serializer shape
// (challenges/serializers.py) instead, so call sites (activitiesData.map,
// etc.) get real element types, not any.

export interface LearningObjective {
  id: string;
  stage?: string | null;
  stage_name: string | null;
  stage_number: number | null;
  title: string;
  description?: string | null;
  evaluation_criteria?: string | null;
  pedagogical_recommendations?: string | null;
  estimated_time?: number | null;
  associated_resources?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  stage: string;
  stage_name: string;
  activity_type: string;
  activity_type_name: string;
  name: string;
  description?: string | null;
  order_number: number;
  timer_duration?: number | null;
  config_data?: any;
  word_search_data?: any;
  anagram_data?: any;
  general_knowledge_data?: any;
  chaos_data?: any;
  bubble_map_config?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  faculties: Array<{ id: string; name: string; code?: string | null; is_active: boolean }>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Challenge {
  id: string;
  topic: string;
  topic_name: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  persona_name?: string | null;
  persona_age?: number | null;
  persona_story?: string | null;
  persona_image?: string | null;
  persona_image_url?: string | null;
  difficulty_level: 'low' | 'medium' | 'high';
  learning_objectives?: string | null;
  additional_resources?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WordSearchOption {
  id: string;
  activity: string;
  activity_name: string | null;
  name: string;
  words: any;
  grid?: any;
  word_positions?: any;
  seed?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnagramWord {
  id: string;
  word: string;
  scrambled_word: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChaosQuestion {
  id: string;
  question: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneralKnowledgeQuestion {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: number;
  options: Array<{ label: string; text: string }>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const challengesAPI = {
  getLearningObjectives: async (): Promise<LearningObjective[]> => {
    const response = await api.get('/challenges/learning-objectives/');
    return unwrapResults<LearningObjective[]>(response.data);
  },

  getActivities: async (params?: Record<string, any>): Promise<Activity[]> => {
    const response = await api.get('/challenges/activities/', { params });
    return unwrapResults<Activity[]>(response.data);
  },

  getActivityById: async (activityId: number | string) => {
    const response = await api.get(`/challenges/activities/${activityId}/`);
    return response.data;
  },

  getChallengeById: async (challengeId: number | string) => {
    const response = await api.get(`/challenges/challenges/${challengeId}/`);
    return response.data;
  },

  getTopics: async (params?: Record<string, any>): Promise<Topic[]> => {
    const response = await api.get('/challenges/topics/', { params });
    return unwrapResults<Topic[]>(response.data);
  },

  getTopicById: async (topicId: number | string) => {
    const response = await api.get(`/challenges/topics/${topicId}/`);
    return response.data;
  },

  getChallenges: async (params?: Record<string, any>): Promise<Challenge[]> => {
    const response = await api.get('/challenges/challenges/', { params });
    return unwrapResults<Challenge[]>(response.data);
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
  getWordSearchOptions: async (activityId?: number | string): Promise<WordSearchOption[]> => {
    const params = activityId ? { activity: activityId } : {};
    const response = await api.get('/challenges/word-search-options/', { params });
    return unwrapResults<WordSearchOption[]>(response.data);
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

  // Anagram Words CRUD
  getAnagramWords: async (): Promise<AnagramWord[]> => {
    const response = await api.get('/challenges/anagram-words/');
    return unwrapResults<AnagramWord[]>(response.data);
  },

  createAnagramWord: async (data: { word: string; is_active?: boolean }) => {
    const response = await api.post('/challenges/anagram-words/', data);
    return response.data;
  },

  deleteAnagramWord: async (wordId: number | string) => {
    const response = await api.delete(`/challenges/anagram-words/${wordId}/`);
    return response.data;
  },

  // Chaos Questions CRUD
  getChaosQuestions: async (): Promise<ChaosQuestion[]> => {
    const response = await api.get('/challenges/chaos-questions/');
    return unwrapResults<ChaosQuestion[]>(response.data);
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
  getGeneralKnowledgeQuestions: async (): Promise<GeneralKnowledgeQuestion[]> => {
    const response = await api.get('/challenges/general-knowledge-questions/');
    return unwrapResults<GeneralKnowledgeQuestion[]>(response.data);
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

