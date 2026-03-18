import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

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
 * Add request interceptor for common headers.
 */
apiClient.interceptors.request.use((config) => {
  // Add custom headers if needed
  return config;
});

/**
 * Add response interceptor for error handling.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default apiClient;
