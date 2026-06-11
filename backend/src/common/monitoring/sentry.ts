import * as Sentry from '@sentry/node';

let enabled = false;

/** SENTRY_DSN sozlangan bo'lsa Sentry'ni ishga tushiradi (ixtiyoriy) */
export function initSentry(dsn: string | undefined, env: string): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: env === 'production' ? 0.1 : 0,
  });
  enabled = true;
}

export function captureException(error: unknown): void {
  if (enabled) Sentry.captureException(error);
}

export function isSentryEnabled(): boolean {
  return enabled;
}
