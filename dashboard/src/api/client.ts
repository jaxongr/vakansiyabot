import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

export const api = axios.create({ baseURL: API_URL });

let accessToken: string | null = sessionStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  sessionStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  sessionStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function isAuthed(): boolean {
  return Boolean(accessToken);
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await api.post('/auth/refresh', { refreshToken });
    setTokens(res.data.data.accessToken, res.data.data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      if (await tryRefresh()) {
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      }
      if (!original.url?.includes('/auth/')) {
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(error);
  },
);
