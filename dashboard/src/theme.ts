import type { ThemeConfig } from 'antd';

/** Master theme tokenlar — #6B46C1 primary, Outfit font */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#6B46C1',
    colorInfo: '#6B46C1',
    colorSuccess: '#16A34A',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    borderRadius: 10,
    fontFamily: "'Outfit', -apple-system, system-ui, sans-serif",
  },
};

export const STATUS_COLOR: Record<string, string> = {
  OK: 'success',
  ACTIVE: 'success',
  DEGRADED: 'warning',
  DISABLED: 'default',
  DOWN: 'error',
  ERROR: 'error',
  PAUSED: 'warning',
  BANNED: 'error',
};
