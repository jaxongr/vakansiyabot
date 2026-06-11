/// <reference types="vite/client" />

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; username?: string } };
  themeParams: Record<string, string>;
  colorScheme: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
  close: () => void;
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  MainButton: { show: () => void; hide: () => void; setText: (t: string) => void; onClick: (cb: () => void) => void };
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
  onEvent: (event: string, cb: () => void) => void;
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp };
}
