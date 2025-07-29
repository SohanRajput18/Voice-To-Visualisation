import axios from 'axios';
import { QueryResult } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const queryService = {
  processVoiceQuery: async (query: string): Promise<QueryResult> => {
    try {
      const response = await api.post('/query/process', { text: query });
      return response.data;
    } catch (error) {
      console.error('Query processing error:', error);
      
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.response?.data?.error || error.message;
        throw new Error(message);
      }
      
      throw new Error('Failed to process query');
    }
  },
};

export default api;