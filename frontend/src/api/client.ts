import axios from 'axios';

// 상대 경로 사용 → Vite proxy 경유 (worktree별 포트 자동 대응)
const API_BASE_URL = '';

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
