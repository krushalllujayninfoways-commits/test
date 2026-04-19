import axios from 'axios';
import { toast } from 'react-hot-toast';

**// ✅ UPDATE THIS LINE WITH YOUR RENDER BACKEND URL
const API_URL = import.meta.env.VITE_API_URL || 'https://YOUR-BACKEND-NAME.onrender.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('🔄 API:', config.method?.toUpperCase(), config.url);  // ✅ Debug log
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('❌ API Error:', error.response?.data || error.message);  // ✅ Debug log
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      toast.error('Session expired. Please login again.');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
