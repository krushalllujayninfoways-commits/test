import axios from 'axios';
import { toast } from 'react-hot-toast';

**// ✅ YOUR RENDER BACKEND URL HERE
const API_URL = 'https://YOUR-BACKEND-NAME.onrender.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = token;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
