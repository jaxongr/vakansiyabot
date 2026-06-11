/** Telegram WebApp bilan ishlash — themeParams -> CSS o'zgaruvchilar */

export function getWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

const THEME_MAP: Record<string, string> = {
  bg_color: '--tg-bg',
  text_color: '--tg-text',
  hint_color: '--tg-hint',
  link_color: '--tg-link',
  button_color: '--tg-button',
  button_text_color: '--tg-button-text',
  secondary_bg_color: '--tg-secondary-bg',
};

export function applyTheme(): void {
  const wa = getWebApp();
  const root = document.documentElement;
  if (!wa) {
    // brauzerda ochilganda (dev) — default qiymatlar
    root.style.setProperty('--tg-bg', '#ffffff');
    root.style.setProperty('--tg-text', '#1a1a2e');
    root.style.setProperty('--tg-hint', '#999999');
    root.style.setProperty('--tg-link', '#6b46c1');
    root.style.setProperty('--tg-button', '#6b46c1');
    root.style.setProperty('--tg-button-text', '#ffffff');
    root.style.setProperty('--tg-secondary-bg', '#f4f4f8');
    return;
  }
  const params = wa.themeParams;
  for (const [key, cssVar] of Object.entries(THEME_MAP)) {
    if (params[key]) root.style.setProperty(cssVar, params[key]);
  }
}

export function initTelegram(): void {
  const wa = getWebApp();
  if (wa) {
    wa.ready();
    wa.expand();
    applyTheme();
    wa.onEvent('themeChanged', applyTheme);
  } else {
    applyTheme();
  }
}

/** startapp parametri: vacancy_{id} yoki resume_{id} */
export function getStartParam(): string | null {
  const wa = getWebApp();
  const fromTg = (wa?.initDataUnsafe as { start_param?: string })?.start_param;
  if (fromTg) return fromTg;
  const url = new URL(window.location.href);
  return url.searchParams.get('tgWebAppStartParam') ?? url.searchParams.get('startapp');
}
