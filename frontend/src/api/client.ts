import axios from 'axios';

// 프로덕션: VITE_API_BASE_URL 환경변수 사용, 로컬: 빈 문자열 → Vite proxy 경유
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Axios instance for API calls.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Add request interceptor — inject JWT token.
 */
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('my-atlas-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Add response interceptor — handle 401 (token expired/invalid).
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('my-atlas-token');
      localStorage.removeItem('my-atlas-user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
