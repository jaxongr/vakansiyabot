export interface SmsSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface SmsAdapterConfig {
  login?: string | null;
  password?: string | null;
  token?: string | null;
  tokenExpiry?: Date | null;
  sender?: string | null;
  baseUrl?: string | null;
}

export interface SmsAdapter {
  readonly provider: string;
  send(config: SmsAdapterConfig, phone: string, text: string): Promise<SmsSendResult>;
  /** Token yangilanishi mumkin — yangi token/expiry qaytarsa caller saqlaydi */
  ensureToken?(config: SmsAdapterConfig): Promise<{ token: string; expiry: Date } | null>;
  balance?(config: SmsAdapterConfig): Promise<number | null>;
}
