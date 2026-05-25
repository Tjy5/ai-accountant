import axios from 'axios';

const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register'];

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const shouldRedirectToLogin = (status?: number, url?: string) => {
  if (status !== 401) return false;
  return !PUBLIC_AUTH_PATHS.some((path) => url?.endsWith(path));
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (shouldRedirectToLogin(error.response?.status, error.config?.url)) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

export default api;
