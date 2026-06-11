import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getWebApp } from '../telegram';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

export const api = axios.create({ baseURL: API_URL });

let accessToken: string | null = null;
let refreshToken: string | null = localStorage.getItem('refreshToken');
let authPromise: Promise<void> | null = null;

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('refreshToken', refresh);
}

/** initData orqali kirish (yoki dev rejimida bypass) */
async function authenticate(): Promise<void> {
  const wa = getWebApp();
  const initData = wa?.initData;
  if (!initData) {
    // Dev: brauzerda initData yo'q — token olmaymiz, public endpointlar ishlaydi
    return;
  }
  const res = await api.post('/auth/miniapp', { initData });
  setTokens(res.data.data.accessToken, res.data.data.refreshToken);
}

export function ensureAuth(): Promise<void> {
  if (accessToken) return Promise.resolve();
  if (!authPromise) authPromise = authenticate().finally(() => (authPromise = null));
  return authPromise;
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await api.post('/auth/refresh', { refreshToken });
    setTokens(res.data.data.accessToken, res.data.data.refreshToken);
    return true;
  } catch {
    refreshToken = null;
    localStorage.removeItem('refreshToken');
    return false;
  }
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const isAuthCall = config.url?.includes('/auth/');
  if (!isAuthCall) await ensureAuth();
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
    }
    return Promise.reject(error);
  },
);
