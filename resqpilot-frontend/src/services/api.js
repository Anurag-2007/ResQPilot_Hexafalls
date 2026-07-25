import axios from 'axios';
import { getCookie } from '../utils/cookies';

const api = axios.create({
  baseURL: 'http://localhost:8000/api', // FastAPI Backend URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use((config) => {
  const session = getCookie('resqpilot_session');
  if (session) {
    const { user } = JSON.parse(session);
    if (user?.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
  }
  return config;
});

// Mocking the API for frontend testing if backend is down
api.post = async (url, data) => {
  console.log(`[MOCK API POST] ${url}`, data);
  return { data: { success: true } };
};

export default api;